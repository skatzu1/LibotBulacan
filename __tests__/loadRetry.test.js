// A screen's load gets one quiet second try, and its error says what went
// wrong (2026-10-30).

const { withRetry, loadErrorText, LoadError } = require("../utils/loadRetry");

describe("withRetry", () => {
  it("tries once more after no answer, and the second try's result is the load's", async () => {
    const load = jest.fn()
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValueOnce("board");
    await expect(withRetry(load, { delayMs: 0 })).resolves.toBe("board");
    expect(load.mock.calls).toEqual([[1], [2]]);
  });

  it("tries once more after a server error or an expired token", async () => {
    for (const status of [401, 502, 503]) {
      const load = jest.fn().mockRejectedValueOnce(new LoadError("x", status)).mockResolvedValueOnce("ok");
      await expect(withRetry(load, { delayMs: 0 })).resolves.toBe("ok");
    }
  });

  it("doesn't try again after too many requests, a 403 or a 404", async () => {
    for (const status of [429, 403, 404]) {
      const load = jest.fn().mockRejectedValue(new LoadError("x", status));
      await expect(withRetry(load, { delayMs: 0 })).rejects.toMatchObject({ status });
      expect(load).toHaveBeenCalledTimes(1);
    }
  });

  it("gives up after the second try", async () => {
    const load = jest.fn().mockRejectedValue(new LoadError("x", 503));
    await expect(withRetry(load, { delayMs: 0 })).rejects.toMatchObject({ status: 503 });
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe("loadErrorText", () => {
  const text = (e) => loadErrorText(e, "the leaderboard");

  it("tells a dropped connection, a timeout and each kind of server answer apart", () => {
    expect(text(new TypeError("Network request failed"))).toMatch(/No internet connection/);
    expect(text(Object.assign(new Error("Aborted"), { name: "AbortError" }))).toMatch(/took too long/);
    expect(text(new LoadError("x", 401))).toMatch(/sign-in ran out/);
    expect(text(new LoadError("x", 429))).toMatch(/Too many requests/);
    expect(text(new LoadError("x", 503))).toMatch(/server had trouble loading the leaderboard/);
  });

  it("a bug in the app isn't called a connection problem", () => {
    expect(text(new TypeError("undefined is not a function"))).toBe("Couldn't load the leaderboard. Try again.");
  });
});
