// Repeat reads from the backend cost only their headers (utils/etagCache.js,
// 2026-11-10: "the app uses too much internet").

const { withConditionalGets, addConditionalGets, forgetAll, recall } = require("../utils/etagCache");

const BASE = "https://api.test";

const answer = (status, body, headers = {}) => {
  const h = { "content-type": "application/json", ...headers };
  const res = {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (k) => h[k.toLowerCase()] ?? null },
    text: async () => body,
    json: async () => JSON.parse(body),
  };
  res.clone = () => ({ ...res });
  return res;
};
const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => forgetAll());

describe("conditional reads with fetch", () => {
  it("sends the last tag and hands a 304 back as the kept answer", async () => {
    const net = jest.fn()
      .mockResolvedValueOnce(answer(200, '{"spots":[1,2]}', { etag: 'W/"a"' }))
      .mockResolvedValueOnce(answer(304, ""));
    const fetch = withConditionalGets(net, BASE);

    await (await fetch(`${BASE}/api/spots`)).json();
    await settle();
    const again = await fetch(`${BASE}/api/spots`, { headers: { Authorization: "Bearer t" } });

    expect(net.mock.calls[1][1].headers).toEqual({ Authorization: "Bearer t", "If-None-Match": 'W/"a"' });
    expect(again.status).toBe(200);
    expect(again.ok).toBe(true);
    expect(await again.json()).toEqual({ spots: [1, 2] });
  });

  it("a changed answer replaces the kept one", async () => {
    const net = jest.fn()
      .mockResolvedValueOnce(answer(200, '{"v":1}', { etag: '"1"' }))
      .mockResolvedValueOnce(answer(200, '{"v":2}', { etag: '"2"' }));
    const fetch = withConditionalGets(net, BASE);
    await fetch(`${BASE}/api/users?page=1`);
    await settle();
    expect(await (await fetch(`${BASE}/api/users?page=1`)).json()).toEqual({ v: 2 });
    await settle();
    expect(recall(`${BASE}/api/users?page=1`).etag).toBe('"2"');
  });

  it("leaves writes, other sites and answers without a tag alone", async () => {
    const net = jest.fn().mockResolvedValue(answer(200, "{}", { etag: '"x"' }));
    const fetch = withConditionalGets(net, BASE);
    await fetch(`${BASE}/api/arrivals`, { method: "POST", body: "{}" });
    await fetch("https://tile.openstreetmap.org/1/1/1.png");
    await settle();
    expect(recall(`${BASE}/api/arrivals`)).toBeNull();
    expect(recall("https://tile.openstreetmap.org/1/1/1.png")).toBeNull();
  });
});

describe("conditional reads with axios", () => {
  const fakeAxios = () => {
    const req = [];
    const res = [];
    return {
      req, res,
      interceptors: { request: { use: (fn) => req.push(fn) }, response: { use: (fn) => res.push(fn) } },
      getUri: (c) => c.url,
    };
  };

  it("replays the kept JSON on a 304", async () => {
    const ax = fakeAxios();
    addConditionalGets(ax);
    const first = ax.req[0]({ method: "get", url: `${BASE}/api/spots/s1`, headers: {} });
    ax.res[0]({ status: 200, headers: { etag: '"s1"' }, data: { spot: { name: "Barasoain" } }, config: first });

    const second = ax.req[0]({ method: "get", url: `${BASE}/api/spots/s1`, headers: {} });
    expect(second.headers["If-None-Match"]).toBe('"s1"');
    expect(second.validateStatus(304)).toBe(true);
    const out = ax.res[0]({ status: 304, headers: {}, data: "", config: second });
    expect(out.status).toBe(200);
    expect(out.data).toEqual({ spot: { name: "Barasoain" } });
  });
});
