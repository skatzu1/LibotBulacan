// What the spot screen's review list needs, kept out of the screen so it can
// be tested: the star breakdown, search / filter / sort, paging, and
// "2 weeks ago".

export const REVIEW_SORTS = [
  { key: "recent",  label: "Most recent" },
  { key: "helpful", label: "Most helpful" },
  { key: "highest", label: "Highest rated" },
  { key: "lowest",  label: "Lowest rated" },
];

export const REVIEWS_PER_PAGE = 5;

/**
 * A spot's star rating, "4.3": each reviewer counted once, by their newest
 * review — the same rule as the server's ratingAvg (LibotBackend
 * utils/ratings.js), so the figure doesn't change when the spot's page loads
 * its reviews. A traveler may review a spot many times; without this, one
 * person's ten 5-star reviews outweighed nine other people. "0.0" with none.
 */
export function averageRating(reviews = []) {
  const latest = new Map();
  for (const r of reviews) {
    const key = r.clerkUserId ?? r._id;
    const prev = latest.get(key);
    if (!prev || time(r) > time(prev)) latest.set(key, r);
  }
  if (!latest.size) return "0.0";
  const sum = [...latest.values()].reduce((acc, r) => acc + r.rating, 0);
  return (Math.round((sum / latest.size) * 10) / 10).toFixed(1);
}

/** [{ stars: 5, count, percent }, …, { stars: 1, … }]; percents of all reviews. */
export function ratingBreakdown(reviews = []) {
  const total = reviews.length;
  return [5, 4, 3, 2, 1].map((stars) => {
    const count = reviews.filter((r) => Math.round(r.rating) === stars).length;
    return { stars, count, percent: total ? Math.round((count / total) * 100) : 0 };
  });
}

const time = (r) => new Date(r.createdAt || 0).getTime() || 0;
const helpfulness = (r) => (r.likes || 0) - (r.dislikes || 0);

const SORTERS = {
  recent:  (a, b) => time(b) - time(a),
  helpful: (a, b) => helpfulness(b) - helpfulness(a) || (b.likes || 0) - (a.likes || 0) || time(b) - time(a),
  highest: (a, b) => b.rating - a.rating || time(b) - time(a),
  lowest:  (a, b) => a.rating - b.rating || time(b) - time(a),
};

/**
 * @param query       matched against the review text and the reviewer's name
 * @param stars       1–5 to keep only that rating, or null for all
 * @param withPhotos  keep only reviews that have photos
 */
export function filterAndSortReviews(reviews = [], { query = "", sort = "recent", stars = null, withPhotos = false } = {}) {
  const q = query.trim().toLowerCase();
  return reviews
    .filter((r) => !stars || Math.round(r.rating) === stars)
    .filter((r) => !withPhotos || (r.photos?.length || 0) > 0)
    .filter((r) => !q
      || (r.comment || "").toLowerCase().includes(q)
      || (r.userName || "").toLowerCase().includes(q))
    .sort(SORTERS[sort] || SORTERS.recent);
}

/** One page of a list, with the page number clamped to what exists. */
export function pageOf(list, page, perPage = REVIEWS_PER_PAGE) {
  const pageCount = Math.max(1, Math.ceil(list.length / perPage));
  const current = Math.min(Math.max(0, page), pageCount - 1);
  return { items: list.slice(current * perPage, current * perPage + perPage), page: current, pageCount };
}

/**
 * Page buttons to show (0-based), with null where a run is skipped:
 * 5 pages or fewer → all of them; more → first, last and the ones around the
 * current page, e.g. [0, null, 4, 5, 6, null, 11].
 */
export function pageNumbers(page, pageCount) {
  if (pageCount <= 5) return [...Array(pageCount).keys()];
  const keep = [...new Set([0, pageCount - 1, page - 1, page, page + 1])]
    .filter((n) => n >= 0 && n < pageCount)
    .sort((a, b) => a - b);
  const out = [];
  keep.forEach((n, i) => {
    if (i > 0 && n - keep[i - 1] > 1) out.push(null);
    out.push(n);
  });
  return out;
}

const UNITS = [
  ["year", 365 * 86400],
  ["month", 30 * 86400],
  ["week", 7 * 86400],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

/** "Just now", "5 minutes ago", "1 year ago". Empty for a missing date. */
export function timeAgo(date, now = Date.now()) {
  const t = new Date(date).getTime();
  if (!date || Number.isNaN(t)) return "";
  const seconds = Math.max(0, Math.floor((now - t) / 1000));
  for (const [unit, size] of UNITS) {
    const n = Math.floor(seconds / size);
    if (n >= 1) return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
  }
  return "Just now";
}
