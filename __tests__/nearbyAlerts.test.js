import {
  nearbyToAnnounce, nearbyNoticeContent, NEARBY_COOLDOWN_MS, NEARBY_RADIUS_METERS,
} from "../utils/nearbyAlerts";

// The geofence alert from the system specification: "notify the user when
// they are within the geofencing perimeter of a nearby attraction".
const north = (from, m) => ({ latitude: from.lat + m / 111_320, longitude: from.lng, accuracy: 10 });
const BARASOAIN = { _id: "b", name: "Barasoain Church", coordinates: { lat: 14.8466, lng: 120.8125 } };
const CASA_REAL = { _id: "c", name: "Casa Real Shrine", coordinates: { lat: 14.8434, lng: 120.8109 } };
const FAR       = { _id: "f", name: "Biak-na-Bato", coordinates: { lat: 15.10, lng: 121.08 } };
const spots = [BARASOAIN, CASA_REAL, FAR];
const now = 1_800_000_000_000;

describe("nearbyToAnnounce", () => {
  it("announces an unvisited spot within 500 m, and not one further away", () => {
    const { due } = nearbyToAnnounce({ spots: [BARASOAIN, FAR], fix: north(BARASOAIN.coordinates, 300), now });
    expect(due.map((s) => s.spotId)).toEqual(["b"]);
    expect(Math.round(due[0].distance)).toBe(300);
    expect(NEARBY_RADIUS_METERS).toBe(500);
  });

  it("leaves a spot you are arriving at to the arrival alert", () => {
    const { due } = nearbyToAnnounce({ spots: [BARASOAIN], fix: north(BARASOAIN.coordinates, 30), now, innerMeters: 50 });
    expect(due).toEqual([]);
  });

  it("skips visited spots and the one you are already navigating to", () => {
    // 100 m south of Barasoain, about 310 m from Casa Real.
    const fix = north(BARASOAIN.coordinates, -100);
    expect(nearbyToAnnounce({ spots, fix, now }).due.map((s) => s.spotId)).toEqual(["b", "c"]);
    expect(nearbyToAnnounce({ spots, fix, now, skip: new Set(["b"]) }).due.map((s) => s.spotId)).toEqual(["c"]);
    expect(nearbyToAnnounce({ spots, fix, now, skip: new Set(["b", "c"]) }).due).toEqual([]);
  });

  it("announces a spot at most once a day", () => {
    const fix = north(BARASOAIN.coordinates, 300);
    const first = nearbyToAnnounce({ spots: [BARASOAIN], fix, now });
    expect(first.due).toHaveLength(1);
    expect(first.notifiedAt).toEqual({ b: now });

    const again = nearbyToAnnounce({ spots: [BARASOAIN], fix, now: now + 60_000, notifiedAt: first.notifiedAt });
    expect(again.due).toEqual([]);

    const tomorrow = nearbyToAnnounce({ spots: [BARASOAIN], fix, now: now + NEARBY_COOLDOWN_MS + 1, notifiedAt: first.notifiedAt });
    expect(tomorrow.due).toHaveLength(1);
  });

  it("ignores a fix too vague to tell 300 m from 700 m", () => {
    const fix = { ...north(BARASOAIN.coordinates, 300), accuracy: 400 };
    expect(nearbyToAnnounce({ spots, fix, now }).due).toEqual([]);
  });

  it("lists several nearby spots nearest first", () => {
    // Between the two, closer to Casa Real.
    const fix = { latitude: 14.8440, longitude: 120.8112, accuracy: 10 };
    expect(nearbyToAnnounce({ spots, fix, now }).due.map((s) => s.spotId)).toEqual(["c", "b"]);
  });
});

describe("nearbyNoticeContent", () => {
  it("names one spot and how far it is; a tap opens directions to it", () => {
    const n = nearbyNoticeContent([{ spotId: "b", spotName: "Barasoain Church", lat: 1, lng: 2, distance: 412 }]);
    expect(n.title).toBe("Barasoain Church is nearby");
    expect(n.body).toBe("It's about 400 m away. Tap for directions.");
    expect(n.data).toEqual({ type: "nearby", spotId: "b", spotName: "Barasoain Church", lat: 1, lng: 2, spotIds: ["b"] });
  });

  it("names several in one notification", () => {
    const n = nearbyNoticeContent([
      { spotId: "c", spotName: "Casa Real Shrine", lat: 1, lng: 2, distance: 80 },
      { spotId: "b", spotName: "Barasoain Church", lat: 3, lng: 4, distance: 330 },
    ]);
    expect(n.title).toBe("2 spots are near you");
    expect(n.body).toBe("Casa Real Shrine and Barasoain Church. The nearest is less than 100 m away — tap for directions.");
    expect(n.data.spotId).toBe("c");
  });
});
