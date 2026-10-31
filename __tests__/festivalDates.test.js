import { isFestivalSpot, isOpenNow, nextRun, formatRun, lockedText, manilaDay } from "../utils/festivalDates";

// A festival can only be visited on its own dates (2026-10-31).
const on = (day) => new Date(`${day}T04:00:00Z`).getTime();
const fest = (festivalDates) => ({ category: ["Festivals"], festivalDates });

describe("festival dates", () => {
  it("are Philippine days, whatever the phone's zone", () => {
    expect(manilaDay(new Date("2026-10-31T16:00:00Z"))).toBe("2026-11-01");
  });

  it("open only from the first day to the last", () => {
    const s = fest([{ start: "2027-03-24", end: "2027-03-26" }]);
    expect(isOpenNow(s, on("2027-03-23"))).toBe(false);
    expect(isOpenNow(s, on("2027-03-25"))).toBe(true);
    expect(isOpenNow(s, on("2027-03-27"))).toBe(false);
  });

  it("repeat every year when set to", () => {
    const s = fest([{ start: "2026-12-29", end: "2026-12-30", everyYear: true }]);
    expect(isOpenNow(s, on("2030-12-30"))).toBe(true);
    expect(nextRun(s, on("2030-12-31"))).toEqual({ start: "2031-12-29", end: "2031-12-30" });
  });

  it("a festival with no dates stays locked; other spots are always open", () => {
    expect(isOpenNow(fest([]))).toBe(false);
    expect(isOpenNow({ category: ["Religious"] })).toBe(true);
    expect(isFestivalSpot({ category: "festivals" })).toBe(true);
    expect(lockedText(fest([]))).toBe("No dates yet");
  });

  it("say when they open", () => {
    const s = fest([{ start: "2027-05-14", end: "2027-05-15" }]);
    expect(lockedText(s, on("2027-01-01"))).toBe("Opens May 14–15, 2027");
    expect(lockedText(s, on("2027-01-01"), { short: true })).toBe("Opens May 14–15");
    expect(formatRun({ start: "2027-01-31", end: "2027-01-31" })).toBe("January 31, 2027");
    expect(formatRun({ start: "2026-12-30", end: "2027-01-02" }, { short: true })).toBe("Dec 30 – Jan 2");
  });
});
