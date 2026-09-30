// Live map for the "Nearby Eats" location mission (Screens/LocationMission.js):
// the eatery's pin inside the radius it has to be completed in, and the
// user's own position as they walk. (The parent spot is left off: it sits a
// few dozen metres away and its marker kept landing under the pin or its
// label. The screen names it in text instead.)
//
// Same stack as the Track screen — Leaflet in a WebView — but deliberately
// WITHOUT Track's OSRM route line. The eateries sit a short walk from their
// spot (Emotea is 83 m from Barasoain), and the public OSRM demo server only
// routes cars, so it would send a walker round one-way streets.
// A dotted straight line to the pin is the honest shape at this scale, and it
// is the same straight-line distance the server checks on completion.
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { WebView } from "react-native-webview";
import { useTheme, radius, shadow } from "../context/ThemeContext";
import Icon from "./Icon";

// A JS string literal that is also safe inside an inline <script> block —
// names are admin-entered, so a stray "</script>" must not end the block.
const jsString = (s) => JSON.stringify(String(s ?? "")).replace(/</g, "\\u003c");

const hexA = (hex, a) => {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${a})`;
};

function buildHtml({ target, radiusMeters, placeName, colors, isDark }) {
  // Teardrop pin, same silhouette as Track's destination pin, with a fork and
  // knife in place of the dot so it reads as "food" at a glance.
  const pinSvg = [
    '<svg width="36" height="46" viewBox="0 0 36 46" xmlns="http://www.w3.org/2000/svg"',
    ' style="filter:drop-shadow(0 5px 8px rgba(11,46,49,0.35));">',
    `<path d="M18 1C9 1 1.5 8.3 1.5 17.4 1.5 29 18 45 18 45s16.5-16 16.5-27.6C34.5 8.3 27 1 18 1z" fill="${colors.brand}" stroke="#fff" stroke-width="2.5"/>`,
    `<g fill="none" stroke="${colors.onBrand}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">`,
    '<path d="M11.8 10.6v3.6M14.2 10.6v3.6M16.6 10.6v3.6"/>',
    '<path d="M11.8 14.2c0 1.6 1 2.6 2.4 2.6s2.4-1 2.4-2.6"/>',
    '<path d="M14.2 16.8v7.6"/>',
    '<path d="M21.4 24.4V10.6c1.8.8 2.8 2.9 2.8 5.5 0 1.1-.7 1.7-2.8 1.7"/>',
    "</g></svg>",
  ].join("");

  return `<!DOCTYPE html><html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <!-- Same pinned Leaflet build + SRI hashes as Screens/Track.js. -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
    <!-- The app's UI face for the pin label. media=print + onload keeps it
         from blocking the map on a slow connection; offline it just falls
         back to the system font. -->
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@600;700&display=swap"
      media="print" onload="this.media='all'" />
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      html, body, #map { width:100%; height:100%; background:${colors.background}; }
      .leaflet-container {
        font-family:'Schibsted Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
        background:${colors.background};
      }
      path.leaflet-interactive { stroke-linecap:round; stroke-linejoin:round; }
      ${isDark
        // OSM only publishes a light style. Invert + hue-rotate turns it into
        // a dark map while keeping water blue and parks green; only the tile
        // pane is filtered, so the pin, ring and dot keep their real colours.
        ? ".leaflet-tile-pane { filter:invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.88) saturate(0.7); }"
        : ""}
      .leaflet-control-attribution {
        background:${hexA(colors.card, 0.78)} !important; color:${colors.textSecondary};
        font-size:9.5px; line-height:1.4; padding:1px 7px; border-radius:0 0 8px 0;
      }

      #veil {
        position:fixed; inset:0; z-index:9999;
        display:flex; align-items:center; justify-content:center;
        padding:0 28px; text-align:center;
        background:${colors.background}; color:${colors.textSecondary};
        font:600 13px/1.45 'Schibsted Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
        transition:opacity .3s ease;
      }
      .spinner {
        width:28px; height:28px; border-radius:50%;
        border:3px solid ${hexA(colors.brand, 0.18)}; border-top-color:${colors.brand};
        animation:spin .7s linear infinite;
      }
      @keyframes spin { to { transform:rotate(360deg); } }

      .place-label {
        background:${colors.card}; color:${colors.textPrimary};
        border:none; border-radius:999px; padding:4px 10px;
        font-size:12px; font-weight:700; letter-spacing:-0.1px; white-space:nowrap;
        box-shadow:0 4px 12px rgba(11,46,49,0.18);
      }
      .place-label::before { display:none; }
      .leaflet-popup-content-wrapper {
        background:${colors.card}; border-radius:14px;
        box-shadow:0 10px 30px rgba(11,46,49,0.18);
      }
      .leaflet-popup-content { margin:9px 13px; font-size:12.5px; font-weight:600; color:${colors.textPrimary}; }
      .leaflet-popup-tip { background:${colors.card}; box-shadow:none; }

      /* The user — the familiar blue dot, as on Track. */
      .you { position:relative; width:20px; height:20px; }
      .you::before {
        content:''; position:absolute; inset:-10px; border-radius:50%;
        background:rgba(66,133,244,0.28); animation:you-pulse 2s ease-in-out infinite;
      }
      .you::after {
        content:''; position:absolute; inset:0; border-radius:50%;
        background:#4285F4; border:3px solid #fff; box-shadow:0 2px 5px rgba(0,0,0,0.3);
      }
      @keyframes you-pulse {
        0%, 100% { transform:scale(0.8); opacity:1; }
        50%      { transform:scale(1.2); opacity:0.45; }
      }
    </style>
  </head>
  <body>
    <div id="veil"><div class="spinner"></div></div>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
    <script>
      (function () {
        var veil = document.getElementById('veil');
        function lift() {
          if (veil._gone) return;
          veil._gone = true;
          veil.style.opacity = '0';
          setTimeout(function () { veil.style.display = 'none'; }, 350);
        }

        // Leaflet comes from a CDN; without a connection there is no map to
        // draw. Say so instead of spinning forever.
        if (!window.L) {
          veil.textContent = 'Map unavailable \\u2014 check your connection.';
          return;
        }

        var T      = L.latLng(${target.lat}, ${target.lng});
        var RADIUS = ${radiusMeters};
        var PLACE  = ${jsString(placeName)};
        var BRAND  = '${colors.brand}';
        var OK     = '${colors.success}';

        var map = L.map('map', {
          zoomControl:false, attributionControl:false, minZoom:9, maxZoom:19,
        }).setView(T, 17);

        // OpenStreetMap's own tiles — what Track actually ends up showing
        // too. Not CARTO: its keyless basemaps now answer every request with
        // an "API KEY REQUIRED" image (as a 200, so no error to fall back
        // on). OSM's tile policy asks for visible attribution; top-left is
        // the corner nothing floats over.
        L.control.attribution({ position:'topleft', prefix:false })
          .addAttribution('\\u00A9 OpenStreetMap contributors')
          .addTo(map);
        var tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19 });
        tiles.once('load', lift);
        tiles.addTo(map);
        setTimeout(lift, 5000);

        // The radius the server checks — "get inside this ring".
        var ring = L.circle(T, {
          radius:RADIUS, color:BRAND, weight:2, opacity:0.9,
          fillColor:BRAND, fillOpacity:0.12, interactive:false,
        }).addTo(map);

        // Dotted line from the user to the pin, hidden once they're inside.
        var trail = L.polyline([], {
          color:BRAND, weight:3, opacity:0.85, dashArray:'2 9', interactive:false,
        }).addTo(map);

        var pin = L.marker(T, {
          icon: L.divIcon({ html:${jsString(pinSvg)}, className:'', iconSize:[36,46], iconAnchor:[18,45] }),
          zIndexOffset:500, keyboard:false,
        });
        if (PLACE) {
          // A text node, not an HTML string — Leaflet puts tooltip strings
          // straight into innerHTML.
          var placeLabel = document.createElement('span');
          placeLabel.textContent = PLACE;
          pin.bindTooltip(placeLabel, {
            permanent:true, direction:'top', offset:[0,-48], className:'place-label',
          });
        }
        pin.addTo(map);

        var you = null, youAt = null, fitted = false;

        // Frame the whole ring plus the user. The top padding leaves room for
        // the pin and its label; the bottom for the chips React Native floats
        // over the map.
        window.fitAll = function (animate) {
          var bounds = T.toBounds(RADIUS * 2);
          if (youAt) bounds.extend(youAt);
          map.fitBounds(bounds, {
            paddingTopLeft:[40, 84], paddingBottomRight:[40, 72], maxZoom:18, animate:!!animate,
          });
        };

        // Called from React Native on every filtered GPS fix.
        window.updateUser = function (lat, lng, inRange) {
          youAt = L.latLng(lat, lng);
          if (!you) {
            you = L.marker(youAt, {
              icon: L.divIcon({ html:'<div class="you"></div>', className:'', iconSize:[20,20], iconAnchor:[10,10] }),
              zIndexOffset:1000, interactive:false, keyboard:false,
            }).addTo(map);
          } else {
            you.setLatLng(youAt);
          }
          trail.setLatLngs(inRange ? [] : [youAt, T]);
          ring.setStyle(inRange
            ? { color:OK, fillColor:OK, fillOpacity:0.22 }
            : { color:BRAND, fillColor:BRAND, fillOpacity:0.12 });
          // Frame both once, on the first fix. After that the map stays where
          // the user pans it; the recenter button re-frames on demand.
          if (!fitted) { fitted = true; window.fitAll(false); }
        };

        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type:'ready' }));
        }
      })();
    </script>
  </body></html>`;
}

/**
 * target        { lat, lng } of the eatery
 * radiusMeters  completion radius, drawn as a ring
 * placeName     eatery name, shown as a label on the pin
 * user          latest { latitude, longitude }, or null while locating
 * inRange       whether `user` is inside the ring (turns it green)
 * children      overlays floated over the map (status chip, buttons)
 */
export default function MissionMap({
  target, radiusMeters, placeName, user, inRange, height, children, style,
}) {
  const { colors, isDark } = useTheme();
  const webRef = useRef(null);
  const ready = useRef(false);

  const html = useMemo(
    () => buildHtml({ target, radiusMeters, placeName, colors, isDark }),
    // Primitives, not the object — a new-but-equal target must not reload the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [target.lat, target.lng, radiusMeters, placeName, colors, isDark],
  );

  const pushUser = useCallback(() => {
    if (!ready.current || !user) return;
    webRef.current?.injectJavaScript(
      `try { window.updateUser(${user.latitude}, ${user.longitude}, ${!!inRange}); } catch (e) {} true;`,
    );
  }, [user, inRange]);

  useEffect(() => { pushUser(); }, [pushUser]);

  // The page says when its functions exist; flush the latest fix then (and
  // again after a theme change reloads the page).
  const onMessage = useCallback((event) => {
    let data;
    try { data = JSON.parse(event.nativeEvent.data); } catch { return; }
    if (data?.type === "ready") {
      ready.current = true;
      pushUser();
    }
  }, [pushUser]);

  const recenter = () => {
    webRef.current?.injectJavaScript("try { window.fitAll(true); } catch (e) {} true;");
  };

  return (
    <View
      style={[
        styles.frame,
        { height, backgroundColor: colors.background, borderColor: colors.cardBorder },
        style,
      ]}
    >
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html }}
        style={[styles.web, { backgroundColor: colors.background }]}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        overScrollMode="never"
        onMessage={onMessage}
        onLoadStart={() => { ready.current = false; }}
        onError={(e) => console.error("MissionMap WebView error:", e.nativeEvent)}
        accessibilityLabel={`Map of ${placeName || "the eatery"} and your location`}
      />

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Show you and ${placeName || "the eatery"} on the map`}
        onPress={recenter}
        style={[styles.recenter, { backgroundColor: colors.card }, shadow.md]}
        activeOpacity={0.8}
        hitSlop={6}
      >
        <Icon name="crosshair" size={19} color={colors.brand} />
      </TouchableOpacity>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // overflow:hidden clips the WebView to the card's rounded corners.
  frame: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  web: { flex: 1 },
  recenter: {
    position: "absolute", top: 10, right: 10,
    width: 42, height: 42, borderRadius: 21,
    alignItems: "center", justifyContent: "center",
  },
});
