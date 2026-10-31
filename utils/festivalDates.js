// A festival can only be visited on its own dates (2026-10-31), and those are
// its visiting hours (2026-11-01): outside them its page stays locked, it
// isn't watched for arrivals or announced as nearby, and the server wouldn't
// count an arrival anyway. The same rule as LibotBackend
// utils/festivalDates.js (which enforces it) and the panel's
// src/utils/festivalDates.js (whose date pickers write the line); keep the
// three equal. The line names one or more runs:
//
//   "Celebrated on May 14–15"                     every year (no year given)
//   "Celebrated on January 31, 2027"              that year only
//   "Celebrated on March 24, 2027 and March 26, 2027"
//
// Philippine calendar days. A line nothing can read names no dates, and a
// festival with none is never open.

/** Whether the spot is filed under Festivals, in any letter case. */
export function isFestivalSpot(spot) {
  const cats = Array.isArray(spot?.category) ? spot.category : [spot?.category];
  return cats.some((c) => String(c ?? "").trim().toLowerCase() === "festivals");
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];
const MONTH = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const monthIndex = (m) => MONTHS.findIndex((name) => name.toLowerCase().startsWith(m.toLowerCase().slice(0, 3)));
const DAY = "(\\d{1,2})(?:st|nd|rd|th)?";
const RUN_RE = new RegExp(`^${MONTH}\\.?\\s+${DAY}(?:,?\\s*(\\d{4}))?(?:\\s*-\\s*(?:${MONTH}\\.?\\s+)?${DAY}(?:,?\\s*(\\d{4}))?)?$`, "i");
// Without a capture group: split() would put what it captured into the list.
const ANY_MONTH = MONTH.replace("(", "(?:");
const SPLIT_RE = new RegExp(`\\s*(?:;|,|\\band\\b)\\s*(?=${ANY_MONTH}\\b)`, "i");
const FIRST_MONTH_RE = new RegExp(`\\b${ANY_MONTH}\\b`, "i");
// Every-year runs are kept in 2000, a leap year, so Feb 29 is a real day.
const ANY_YEAR = 2000;

// The day `years` years after "2027-05-14" (Feb 29 rolls over to Mar 1).
const addYears = (d, years = 0) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y + years, m - 1, dd)).toISOString().slice(0, 10);
};
const ymd = (y, m, d) => `${String(y).padStart(4, "0")}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const real = (d) => addYears(d) === d;

/** The runs a visiting-hours line names, [{ start, end, everyYear }], or [] when it names none or any part can't be read. */
export function datesFromHours(text) {
  const line = String(text ?? "").replace(/[–—]/g, "-").replace(/\s+(?:to|until|through)\s+/gi, " - ");
  const from = line.search(FIRST_MONTH_RE);
  if (from < 0) return [];
  const body = line.slice(from).trim().replace(/\.$/, "");
  const runs = [];
  for (const part of body.split(SPLIT_RE).filter(Boolean)) {
    const m = part.trim().match(RUN_RE);
    if (!m) return [];
    const [, m1, d1, y1, m2, d2, y2] = m;
    const sm = monthIndex(m1);
    const em = m2 ? monthIndex(m2) : sm;
    const sd = Number(d1);
    const ed = d2 ? Number(d2) : sd;
    // "May 15–14" is a slip; Dec 30 – Jan 2 ends in the next year.
    if (em === sm && ed < sd) return [];
    const wraps = em < sm;
    const sy = Number(y1 || y2 || ANY_YEAR);
    const ey = y2 ? Number(y2) : sy + (wraps ? 1 : 0);
    const start = ymd(!y1 && y2 && wraps ? sy - 1 : sy, sm, sd);
    const end = ymd(ey, em, ed);
    if (!real(start) || !real(end) || end < start) return [];
    runs.push({ start, end, everyYear: !(y1 || y2) });
  }
  return runs;
}

/** The day `at` falls on in the Philippines (UTC+8, no daylight saving), whatever the phone's zone. */
export const manilaDay = (at = Date.now()) =>
  new Date(new Date(at).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);

function occurrences(runs, today) {
  const year = Number(today.slice(0, 4));
  const out = [];
  for (const r of runs) {
    if (!r.everyYear) { out.push({ start: r.start, end: r.end }); continue; }
    // Last year's run can still be going (Dec 30 to Jan 2).
    const from = Number(r.start.slice(0, 4));
    for (const y of [year - 1, year, year + 1]) {
      out.push({ start: addYears(r.start, y - from), end: addYears(r.end, y - from) });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

/** Whether the spot can be visited today. Spots that aren't festivals always can. */
export function isOpenNow(spot, at = Date.now()) {
  if (!isFestivalSpot(spot)) return true;
  const today = manilaDay(at);
  return occurrences(datesFromHours(spot.visitingHours), today).some((o) => o.start <= today && today <= o.end);
}

/** The next run still to come or running, { start, end }, or null if none. */
export function nextRun(spot, at = Date.now()) {
  const today = manilaDay(at);
  return occurrences(datesFromHours(spot?.visitingHours), today).find((o) => o.end >= today) || null;
}

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
