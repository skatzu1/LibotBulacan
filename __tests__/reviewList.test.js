import { averageRating, ratingBreakdown, filterAndSortReviews, pageOf, pageNumbers, timeAgo } from "../utils/reviewList";

const day = 86400 * 1000;
const NOW = new Date("2026-10-02T12:00:00Z").getTime();
const at = (daysAgo) => new Date(NOW - daysAgo * day).toISOString();

const reviews = [
  { _id: "a", rating: 5, comment: "Beautiful church", userName: "Ana",  createdAt: at(1),  likes: 2, dislikes: 0 },
  { _id: "b", rating: 2, comment: "Too crowded",      userName: "Ben",  createdAt: at(10), likes: 5, dislikes: 1, photos: [{ url: "x" }] },
  { _id: "c", rating: 5, comment: "Must visit",       userName: "Cara", createdAt: at(3),  likes: 0, dislikes: 0 },
  { _id: "d", rating: 4, comment: "Nice museum",      userName: "Dan",  createdAt: at(40), likes: 1, dislikes: 3 },
];

describe("averageRating", () => {
  it("counts each reviewer once, by their newest review", () => {
    // u1 posted three 5-star reviews, then changed their mind to 1 star.
    const list = [
      { clerkUserId: "u1", rating: 1, createdAt: at(1) },
      { clerkUserId: "u1", rating: 5, createdAt: at(5) },
      { clerkUserId: "u1", rating: 5, createdAt: at(9) },
      { clerkUserId: "u2", rating: 4, createdAt: at(3) },
    ];
    expect(averageRating(list)).toBe("2.5"); // (1 + 4) / 2, as the server's ratingAvg
  });
  it("is the plain average when everyone reviewed once", () => {
    expect(averageRating(reviews.map((r, i) => ({ ...r, clerkUserId: `u${i}` })))).toBe("4.0");
  });
  it("is 0.0 with no reviews", () => {
    expect(averageRating([])).toBe("0.0");
  });
});

describe("ratingBreakdown", () => {
  it("counts each star level, as a share of all reviews", () => {
    expect(ratingBreakdown(reviews)).toEqual([
      { stars: 5, count: 2, percent: 50 },
      { stars: 4, count: 1, percent: 25 },
      { stars: 3, count: 0, percent: 0 },
      { stars: 2, count: 1, percent: 25 },
      { stars: 1, count: 0, percent: 0 },
    ]);
  });
  it("is all zeros with no reviews", () => {
    expect(ratingBreakdown([]).every((r) => r.count === 0 && r.percent === 0)).toBe(true);
  });
});

describe("filterAndSortReviews", () => {
  const ids = (list) => list.map((r) => r._id);
  it("sorts", () => {
    expect(ids(filterAndSortReviews(reviews, { sort: "recent" }))).toEqual(["a", "c", "b", "d"]);
    expect(ids(filterAndSortReviews(reviews, { sort: "helpful" }))).toEqual(["b", "a", "c", "d"]);
    expect(ids(filterAndSortReviews(reviews, { sort: "highest" }))).toEqual(["a", "c", "d", "b"]);
    expect(ids(filterAndSortReviews(reviews, { sort: "lowest" }))).toEqual(["b", "d", "a", "c"]);
  });
  it("filters by stars, photos and search (text or name, any case)", () => {
    expect(ids(filterAndSortReviews(reviews, { stars: 5 }))).toEqual(["a", "c"]);
    expect(ids(filterAndSortReviews(reviews, { withPhotos: true }))).toEqual(["b"]);
    expect(ids(filterAndSortReviews(reviews, { query: "  MUSEUM " }))).toEqual(["d"]);
    expect(ids(filterAndSortReviews(reviews, { query: "cara" }))).toEqual(["c"]);
  });
  it("does not change the list it was given", () => {
    const copy = reviews.map((r) => r._id);
    filterAndSortReviews(reviews, { sort: "lowest" });
    expect(reviews.map((r) => r._id)).toEqual(copy);
  });
});

describe("pageOf", () => {
  const list = Array.from({ length: 12 }, (_, i) => i);
  it("slices pages of 5 and clamps the page number", () => {
    expect(pageOf(list, 0)).toEqual({ items: [0, 1, 2, 3, 4], page: 0, pageCount: 3 });
    expect(pageOf(list, 2).items).toEqual([10, 11]);
    expect(pageOf(list, 9).page).toBe(2);
    expect(pageOf([], 3)).toEqual({ items: [], page: 0, pageCount: 1 });
  });
});

describe("pageNumbers", () => {
  it("shows every page up to 5, and gaps beyond that", () => {
    expect(pageNumbers(0, 3)).toEqual([0, 1, 2]);
    expect(pageNumbers(2, 5)).toEqual([0, 1, 2, 3, 4]);
    expect(pageNumbers(0, 12)).toEqual([0, 1, null, 11]);
    expect(pageNumbers(5, 12)).toEqual([0, null, 4, 5, 6, null, 11]);
    expect(pageNumbers(11, 12)).toEqual([0, null, 10, 11]);
  });
});

describe("timeAgo", () => {
  it("reads like a person would say it", () => {
    expect(timeAgo(new Date(NOW - 20 * 1000), NOW)).toBe("Just now");
    expect(timeAgo(new Date(NOW - 5 * 60 * 1000), NOW)).toBe("5 minutes ago");
    expect(timeAgo(at(1), NOW)).toBe("1 day ago");
    expect(timeAgo(at(14), NOW)).toBe("2 weeks ago");
    expect(timeAgo(at(70), NOW)).toBe("2 months ago");
    expect(timeAgo(at(400), NOW)).toBe("1 year ago");
    expect(timeAgo(undefined, NOW)).toBe("");
  });
});
