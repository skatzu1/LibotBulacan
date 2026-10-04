import { withTimeout, installFetchTimeout } from "../utils/fetchTimeout";

// A fetch that never answers unless aborted — a dead connection.
const hangingFetch = () => jest.fn((_url, init) => new Promise((_resolve, reject) => {
  init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("Aborted"), { name: "AbortError" })));
}));

describe("withTimeout", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("gives up on a request that never answers", async () => {
    const f = withTimeout(hangingFetch(), 1000);
    const pending = f("https://x.test/api/spots");
    jest.advanceTimersByTime(1000);
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("leaves a call that brings its own signal alone", async () => {
    const inner = jest.fn(() => Promise.resolve("ok"));
    const signal = new AbortController().signal;
    await withTimeout(inner, 1000)("https://x.test", { method: "POST", signal });
    expect(inner).toHaveBeenCalledWith("https://x.test", { method: "POST", signal });
  });

  it("passes the response through, keeping the caller's options", async () => {
    const inner = jest.fn(() => Promise.resolve("response"));
    await expect(withTimeout(inner, 1000)("https://x.test", { headers: { A: "1" } })).resolves.toBe("response");
    expect(inner.mock.calls[0][1]).toMatchObject({ headers: { A: "1" } });
    expect(inner.mock.calls[0][1].signal).toBeDefined();
    jest.advanceTimersByTime(5000); // the timer was cleared: nothing left to fire
  });
});

describe("onRequest", () => {
  it("is told when a request ends, whether it answered or failed", async () => {
    const ended = jest.fn();
    const onRequest = jest.fn(() => ended);
    await withTimeout(() => Promise.resolve("ok"), 1000, { onRequest })("https://x.test/a", { method: "GET" });
    await withTimeout(() => Promise.reject(new Error("down")), 1000, { onRequest })("https://x.test/b").catch(() => {});
    expect(onRequest).toHaveBeenCalledWith("https://x.test/a", { method: "GET" });
    expect(ended).toHaveBeenCalledTimes(2);
  });
});

describe("installFetchTimeout", () => {
  it("wraps the global fetch once", () => {
    const original = global.fetch;
    global.fetch = jest.fn();
    installFetchTimeout(1000);
    const wrapped = global.fetch;
    installFetchTimeout(1000);
    expect(global.fetch).toBe(wrapped);
    expect(wrapped.withDefaultTimeout).toBe(true);
    global.fetch = original;
  });
});
