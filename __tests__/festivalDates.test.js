import { isFestivalSpot, isOpenNow, nextRun, formatRun, lockedText, manilaDay, datesFromHours } from "../utils/festivalDates";

// A festival can only be visited on its own dates (2026-10-31), which are its
// visiting hours (2026-11-01).
const on = (day) => new Date(`${day}T04:00:00Z`).getTime();
const fest = (visitingHours) => ({ category: ["Festivals"], visitingHours });

describe("festival dates", () => {
  it("are Philippine days, whatever the phone's zone", () => {
    expect(manilaDay(new Date("2026-10-31T16:00:00Z"))).toBe("2026-11-01");
  });

  it("are read from the visiting hours, like the server reads them", () => {
    expect(datesFromHours("Celebrated on May 14-15")).toEqual([{ start: "2000-05-14", end: "2000-05-15", everyYear: true }]);
    expect(datesFromHours("Celebrated on March 24, 2027 and March 26, 2027")).toEqual([
      { start: "2027-03-24", end: "2027-03-24", everyYear: false },
      { start: "2027-03-26", end: "2027-03-26", everyYear: false },
    ]);
    expect(datesFromHours("Celebrated on the last Sunday of January")).toEqual([]);
  });

  it("open only from the first day to the last", () => {
    const s = fest("Celebrated on March 24–26, 2027");
    expect(isOpenNow(s, on("2027-03-23"))).toBe(false);
    expect(isOpenNow(s, on("2027-03-25"))).toBe(true);
    expect(isOpenNow(s, on("2027-03-27"))).toBe(false);
  });

  it("repeat every year when no year is given", () => {
    const s = fest("Celebrated on December 29 to 30");
    expect(isOpenNow(s, on("2030-12-30"))).toBe(true);
    expect(nextRun(s, on("2030-12-31"))).toEqual({ start: "2031-12-29", end: "2031-12-30" });
  });

  it("a festival whose hours name no dates stays locked; other spots are always open", () => {
    expect(isOpenNow(fest("Every second week of September"))).toBe(false);
    expect(isOpenNow({ category: ["Religious"], visitingHours: "Celebrated on June 23" })).toBe(true);
    expect(isFestivalSpot({ category: "festivals" })).toBe(true);
    expect(lockedText(fest(""))).toBe("No dates yet");
  });

  it("say when they open", () => {
    const s = fest("Celebrated on May 14–15, 2027");
    expect(lockedText(s, on("2027-01-01"))).toBe("Opens May 14–15, 2027");
    expect(lockedText(s, on("2027-01-01"), { short: true })).toBe("Opens May 14–15");
    expect(formatRun({ start: "2027-01-31", end: "2027-01-31" })).toBe("January 31, 2027");
    expect(formatRun({ start: "2026-12-30", end: "2027-01-02" }, { short: true })).toBe("Dec 30 – Jan 2");
  });
});
