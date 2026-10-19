/*
 * The road route as the maps draw it: one copy of the code for both maps that
 * give directions, the navigation map (Screens/Track.js) and the Nearby Eats
 * map (components/MissionMap.js). Both pages paste ROUTE_LINE_JS into their
 * <script> after Leaflet, then
 *
 *   var route = makeRouteLine(map, [destLat, destLng], { color, casing });
 *   route.draw(latlngs)  // the route from GET /api/route, or null to clear it
 *   route.place(latlng)  // the traveler moved
 *   route.show(on)       // takes the whole line off the map, or puts it back
 *
 * The route runs on the roads, from the road point nearest the traveler (who
 * may be in a house, a yard, or off the roads the server knows) to the one
 * nearest the destination, so dotted links join it to the blue dot and to the
 * pin. As the traveler moves, the part already passed is cut off, so the line
 * always starts at them. A wide casing runs under the line.
 *
 * Plain ES5 with no backslashes or ${…}: it is pasted as-is into the template
 * strings that build both pages.
 */
export const ROUTE_LINE_JS = `
function makeRouteLine(map, dest, style) {
  var pts = null;   // the route as fetched
  var from = 0;     // the segment the traveler was last nearest
  var here = null;  // where the traveler last was

  var dots = { color:style.color, weight:4, opacity:0.8, dashArray:'1 9', lineCap:'round', interactive:false };
  var layer = L.layerGroup().addTo(map);
  var startLink = L.polyline([], dots).addTo(layer);
  var endLink = L.polyline([], dots).addTo(layer);
  var casing = L.polyline([], { color:style.casing, weight:10, opacity:0.95, interactive:false, className:'route-line' }).addTo(layer);
  var line = L.polyline([], { color:style.color, weight:5.5, opacity:1, interactive:false, className:'route-line' }).addTo(layer);

  // [lat, lng] to metres on a flat map around latitude lat0.
  function metresAround(lat0) {
    var kx = Math.cos(lat0 * Math.PI / 180) * 111320;
    return function(p) { return [p[1] * kx, p[0] * 110540]; };
  }

  // The point of the route nearest (lat, lng), looking from segment number
  // "start" on: { i: segment, pt: [lat, lng], d: metres away }.
  function nearestOnRoute(lat, lng, start) {
    var xy = metresAround(lat), u = xy([lat, lng]), best = null;
    for (var i = Math.max(0, start); i < pts.length - 1; i++) {
      var a = xy(pts[i]), b = xy(pts[i + 1]);
      var dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy;
      var t = len2 ? Math.max(0, Math.min(1, ((u[0] - a[0]) * dx + (u[1] - a[1]) * dy) / len2)) : 0;
      var d = Math.hypot(a[0] + t * dx - u[0], a[1] + t * dy - u[1]);
      if (!best || d < best.d) {
        best = { i: i, d: d, pt: [pts[i][0] + t * (pts[i + 1][0] - pts[i][0]), pts[i][1] + t * (pts[i + 1][1] - pts[i][1])] };
      }
    }
    return best;
  }

  // Fits the line to where the traveler is now: trims what they have passed
  // and redraws the two dotted links.
  function fit() {
    if (!pts) {
      [startLink, endLink, casing, line].forEach(function(l) { l.setLatLngs([]); });
      return;
    }
    var rest = pts, start = null;
    if (here) {
      // From one segment back, so GPS jitter can't skip ahead and a route
      // that doubles back near itself isn't cut short.
      var near = nearestOnRoute(here.lat, here.lng, from - 1);
      from = near.i;
      rest = [near.pt].concat(pts.slice(near.i + 1));
      if (near.d > 3) start = [[here.lat, here.lng], near.pt];
    }
    casing.setLatLngs(rest);
    line.setLatLngs(rest);
    startLink.setLatLngs(start || []);
    var end = pts[pts.length - 1];
    endLink.setLatLngs(map.distance(end, dest) > 3 ? [end, dest] : []);
  }

  return {
    draw: function(latlngs) {
      pts = latlngs && latlngs.length >= 2 ? latlngs : null;
      from = 0;
      fit();
    },
    place: function(latlng) {
      here = latlng ? L.latLng(latlng) : null;
      fit();
    },
    show: function(on) {
      if (on) layer.addTo(map); else layer.remove();
    },
  };
}
`;
