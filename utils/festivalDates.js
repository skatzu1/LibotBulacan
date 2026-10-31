// A festival can only be visited on its own dates (2026-10-31): outside them
// its page stays locked, it isn't watched for arrivals or announced as nearby,
// and the server wouldn't count an arrival anyway. The same rule as
// LibotBackend utils/festivalDates.js (which enforces it) and the panel's
// src/utils/festivalDates.js; keep the three equal. A spot's festivalDates:
//
//   [{ start: "2027-05-14", end: "2027-05-15", everyYear: true }]
//
// Philippine calendar days. A festival with no dates is never open.

/** Whether the spot is filed under Festivals, in any letter case. */
export function isFestivalSpot(spot) {
  const cats = Array.isArray(spot?.category) ? spot.category : [spot?.category];
  return cats.some((c) => String(c ?? "").trim().toLowerCase() === "festivals");
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// The day `years` years after "2027-05-14" (Feb 29 rolls over to Mar 1).
const addYears = (d, years = 0) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y + years, m - 1, dd)).toISOString().slice(0, 10);
};

const day = (v) => (typeof v === "string" && DAY_RE.test(v) && addYears(v) === v ? v : null);

/** The day `at` falls on in the Philippines (UTC+8, no daylight saving), whatever the phone's zone. */
export const manilaDay = (at = Date.now()) =>
  new Date(new Date(at).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);

function occurrences(ranges, today) {
  const year = Number(today.slice(0, 4));
  const out = [];
  for (const r of ranges || []) {
    const start = day(r?.start);
    const end = day(r?.end);
    if (!start || !end || end < start) continue;
    if (!r.everyYear) { out.push({ start, end }); continue; }
    // Last year's run can still be going (Dec 30 to Jan 2).
    const from = Number(start.slice(0, 4));
    for (const y of [year - 1, year, year + 1]) {
      out.push({ start: addYears(start, y - from), end: addYears(end, y - from) });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

/** Whether the spot can be visited today. Spots that aren't festivals always can. */
export function isOpenNow(spot, at = Date.now()) {
  if (!isFestivalSpot(spot)) return true;
  const today = manilaDay(at);
  return occurrences(spot.festivalDates, today).some((o) => o.start <= today && today <= o.end);
}

/** The next run still to come or running, { start, end }, or null if none is set. */
export function nextRun(spot, at = Date.now()) {
  const today = manilaDay(at);
  return occurrences(spot?.festivalDates, today).find((o) => o.end >= today) || null;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];

/** { start, end } → "May 14–15, 2027", "January 31, 2027", "March 30 – April 2, 2027". */
export function formatRun(run, { short = false } = {}) {
  if (!run) return "";
  const parts = (d) => {
    const [y, m, dd] = d.split("-").map(Number);
    const name = MONTHS[m - 1];
    return { y, m, d: dd, month: short ? name.slice(0, 3) : name };
  };
  const a = parts(run.start);
  const b = parts(run.end);
  const yr = short ? "" : `, ${a.y}`;
  if (run.start === run.end) return `${a.month} ${a.d}${yr}`;
  if (a.y === b.y && a.m === b.m) return `${a.month} ${a.d}–${b.d}${yr}`;
  if (a.y === b.y) return `${a.month} ${a.d} – ${b.month} ${b.d}${yr}`;
  return short ? `${a.month} ${a.d} – ${b.month} ${b.d}` : `${a.month} ${a.d}, ${a.y} – ${b.month} ${b.d}, ${b.y}`;
}

/** What a locked festival's page and card say, e.g. "Opens May 14–15, 2027". */
export function lockedText(spot, at = Date.now(), opts) {
  const run = nextRun(spot, at);
  return run ? `Opens ${formatRun(run, opts)}` : "No dates yet";
}
