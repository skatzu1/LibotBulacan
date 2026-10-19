import React from "react";
import { act, render } from "@testing-library/react-native";
import useRoadRoute, { fmtDistance, fmtDuration } from "../hooks/useRoadRoute";
import { ROUTE_LINE_JS } from "../utils/routeLine";
import { distanceMeters } from "../utils/arrivalEngine";

// The navigation map (Screens/Track.js) and the Nearby Eats map
// (components/MissionMap.js) give directions with this same code.

jest.mock("../api", () => ({ __esModule: true, BASE_URL: "https://api.test", default: {} }));

const reply = (status, body) => Promise.resolve({ ok: status < 300, status, json: () => Promise.resolve(body) });
const ROUTE = { distance: 412, duration: 95, coordinates: [[14.84, 120.81], [14.84, 120.812]] };

describe("useRoadRoute", () => {
  let road, now;
  const Probe = ({ to }) => { road = useRoadRoute(to); return null; };
  const at = (latitude, longitude, heading) => ({ latitude, longitude, ...(heading != null && { heading }) });
  const update = (coords) => act(async () => { await road.update(coords); });

  beforeEach(() => {
    now = 1_000_000;
    jest.spyOn(Date, "now").mockImplementation(() => now);
    global.fetch = jest.fn(() => reply(200, ROUTE));
  });
  afterEach(() => jest.restoreAllMocks());

  it("asks the backend's router for the eatery's route, with the heading", async () => {
    render(<Probe to={{ missionId: "m2" }} />);
    await update(at(14.84, 120.81, 91.6));
    expect(fetch).toHaveBeenCalledWith("https://api.test/api/route?from=14.84,120.81&missionId=m2&heading=92");
    expect(road.route).toEqual(ROUTE.coordinates);
    expect(road.info).toEqual({ distance: 412, time: 95 });
    expect(road.note).toBeNull();
  });

  it("asks for a spot the same way", async () => {
    render(<Probe to={{ spotId: "s1" }} />);
    await update(at(14.84, 120.81));
    expect(fetch).toHaveBeenCalledWith("https://api.test/api/route?from=14.84,120.81&spotId=s1");
  });

  it("re-routes at most every 15 s, and only once the traveler has moved ~45 m", async () => {
    render(<Probe to={{ missionId: "m2" }} />);
    await update(at(14.84, 120.81));
    now += 5_000;
    await update(at(14.841, 120.81)); // ~110 m on, but too soon
    now += 15_000;
    await update(at(14.8402, 120.81)); // ~22 m from the last route's start
    expect(fetch).toHaveBeenCalledTimes(1);
    await update(at(14.841, 120.81));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("says why when there is no road route", async () => {
    render(<Probe to={{ missionId: "m2" }} />);
    fetch.mockImplementationOnce(() => reply(422, { message: "No road route to Emotea was found." }));
    await update(at(14.84, 120.81));
    expect(road.route).toBeNull();
    expect(road.info).toBeNull();
    expect(road.note).toBe("No road route to Emotea was found.");
  });

  it("keeps the last route when a request fails", async () => {
    render(<Probe to={{ missionId: "m2" }} />);
    await update(at(14.84, 120.81));
    now += 20_000;
    fetch.mockImplementationOnce(() => Promise.reject(new Error("offline")));
    await update(at(14.85, 120.81));
    fetch.mockImplementationOnce(() => reply(503, {}));
    now += 20_000;
    await update(at(14.86, 120.81));
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(road.route).toEqual(ROUTE.coordinates);
  });

  it("asks nothing without a destination", async () => {
    render(<Probe to={null} />);
    await update(at(14.84, 120.81));
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("route text", () => {
  it("reads like the navigation map's card", () => {
    expect(fmtDistance(83)).toBe("80 m");
    expect(fmtDistance(1430)).toBe("1.4 km");
    expect(fmtDistance(31200)).toBe("31 km");
    expect(fmtDuration(95)).toBe("2 min");
    expect(fmtDuration(3900)).toBe("1 hr 5 min");
  });
});

// The in-page drawing code, run against a small stand-in for Leaflet.
describe("ROUTE_LINE_JS", () => {
  const toLL = (p) => (Array.isArray(p) ? { lat: p[0], lng: p[1] } : p);
  let lines, group, route;

  beforeEach(() => {
    lines = [];
    group = { onMap: false };
    const L = {
      layerGroup: () => Object.assign(group, {
        addTo() { group.onMap = true; return group; },
        remove() { group.onMap = false; return group; },
      }),
      polyline: (pts, opts) => {
        const line = { pts, opts, addTo: () => line, setLatLngs: (v) => { line.pts = v; return line; } };
        lines.push(line);
        return line;
      },
      latLng: toLL,
    };
    const map = {
      distance: (a, b) => { const [p, q] = [toLL(a), toLL(b)]; return distanceMeters(p.lat, p.lng, q.lat, q.lng); },
    };
    const makeRouteLine = new Function("L", `${ROUTE_LINE_JS}; return makeRouteLine;`)(L);
    route = makeRouteLine(map, [14.84, 120.8121], { color: "#0B6E6E", casing: "#FFFFFF" });
  });

  // Made in this order: the two dotted links, then the casing, then the line.
  const pts = () => {
    const [startLink, endLink, casing, line] = lines;
    expect(casing.pts).toEqual(line.pts);
    return { start: startLink.pts, end: endLink.pts, line: line.pts };
  };
  const close = (actual, expected) => actual.forEach((p, i) => p.forEach((v, j) => expect(v).toBeCloseTo(expected[i][j], 6)));

  it("cuts off the part the traveler has passed and joins them to it", () => {
    route.draw([[14.84, 120.81], [14.84, 120.811], [14.84, 120.812]]);
    route.place([14.8401, 120.8105]);
    const { start, end, line } = pts();
    close(line, [[14.84, 120.8105], [14.84, 120.811], [14.84, 120.812]]);
    close(start, [[14.8401, 120.8105], [14.84, 120.8105]]);
    // The road ends ~11 m short of the pin; a dotted link covers the rest.
    expect(end).toEqual([[14.84, 120.812], [14.84, 120.8121]]);
  });

  it("looks back only one stretch, so GPS jitter can't undo the trim", () => {
    route.draw([[14.84, 120.81], [14.84, 120.811], [14.84, 120.812], [14.84, 120.813]]);
    route.place([14.84, 120.8125]);
    route.place([14.84, 120.8102]); // two segments back: out of reach
    close(pts().line.slice(0, 1), [[14.84, 120.811]]);
  });

  it("clears everything for no route, and can be put away", () => {
    route.draw([[14.84, 120.81], [14.84, 120.812]]);
    route.place([14.8401, 120.8105]);
    route.draw(null);
    expect(lines.every((l) => l.pts.length === 0)).toBe(true);
    expect(group.onMap).toBe(true);
    route.show(false);
    expect(group.onMap).toBe(false);
    route.show(true);
    expect(group.onMap).toBe(true);
  });
});
