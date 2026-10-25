// Rewards owed play wherever the traveler is (2026-10-24), from one request
// at a time: callers at the same moment share it, so each moment plays once.

jest.mock("@clerk/clerk-expo", () => ({ useAuth: () => ({ getToken: async () => "token" }) }));
jest.mock("../api", () => ({ __esModule: true, BASE_URL: "https://api.test", default: {} }));
let mockLive = null;
jest.mock("../utils/live", () => ({ subscribeLive: (topics, cb) => { mockLive = { topics, cb }; return () => {}; } }));
let mockNavState = null;
jest.mock("../navigation/navigationRef", () => ({
  navigationRef: { addListener: (_event, cb) => { mockNavState = cb; return () => { mockNavState = null; }; } },
}));

const React = require("react");
const { render, act } = require("@testing-library/react-native");
const { setRewardHandlers } = require("../utils/rewards");
const { fetchAchievements, OwedRewards } = require("../utils/owedRewards");

const BODY = {
  spots: [],
  unlocked: { spotBadges: [{ name: "Barasoain Church" }], townBadges: [{ municipality: "Malolos" }], districtBadges: [], title: null },
};

describe("fetchAchievements", () => {
  let played;
  beforeEach(() => {
    played = [];
    setRewardHandlers({ items: (items) => played.push(...items), banner: () => {} });
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => BODY }));
  });
  afterEach(() => setRewardHandlers(null));

  it("callers at the same moment share one request, and its moments play once", async () => {
    const getToken = async () => "token";
    const [a, b] = await Promise.all([fetchAchievements(getToken), fetchAchievements(getToken)]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(played.map((m) => m.kind)).toEqual(["spot", "town"]);
  });

  it("asks again once the last one is back", async () => {
    const getToken = async () => "token";
    await fetchAchievements(getToken);
    await fetchAchievements(getToken);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("a failed request plays nothing and lets the caller keep what it shows", async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 503 }));
    await expect(fetchAchievements(async () => "token")).rejects.toThrow("achievements 503");
    expect(played).toEqual([]);
  });
});

// 2026-10-25: also on a change of screen (at most every 15 s) and when badges change.
describe("OwedRewards", () => {
  beforeEach(() => {
    setRewardHandlers({ items: () => {}, banner: () => {} });
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => BODY }));
  });
  afterEach(() => { setRewardHandlers(null); jest.useRealTimers(); });

  it("asks on opening, on a screen change after 15 s, and on a live hint", async () => {
    jest.useFakeTimers({ now: 1_000_000 });
    const tree = render(React.createElement(OwedRewards));
    await act(async () => {});
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockLive.topics).toEqual(["achievements", "badges"]);

    await act(async () => { mockNavState(); });
    expect(global.fetch).toHaveBeenCalledTimes(1); // too soon after the last

    jest.setSystemTime(1_000_000 + 15000);
    await act(async () => { mockNavState(); });
    expect(global.fetch).toHaveBeenCalledTimes(2);

    await act(async () => { mockLive.cb(); });
    expect(global.fetch).toHaveBeenCalledTimes(3);

    tree.unmount();
    expect(mockNavState).toBeNull();
  });
});
