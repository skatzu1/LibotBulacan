// Live updates in the app (utils/live.js): the server says what changed and
// the screens showing it load again. A stand-in socket plays the server.

const mockApp = { state: "active", onChange: null };
jest.mock("react-native", () => ({
  AppState: {
    get currentState() { return mockApp.state; },
    addEventListener: (_event, fn) => { mockApp.onChange = fn; return { remove: () => { mockApp.onChange = null; } }; },
  },
}));
jest.mock("../api", () => ({ BASE_URL: "https://api.test" }));

const mockSocket = { current: null };
jest.mock("socket.io-client", () => ({
  io: (url, options) => {
    const handlers = {};
    mockSocket.current = {
      url, options, connected: true, active: true,
      on: (event, fn) => { handlers[event] = fn; },
      emit: (event, arg) => handlers[event]?.(arg),
      connect: jest.fn(),
      disconnect: jest.fn(function disconnect() { this.connected = false; this.active = false; }),
    };
    return mockSocket.current;
  },
}));

const { connectLive, disconnectLive, subscribeLive } = require("../utils/live");

// Each phone waits up to 1.9 s before loading, so not all ask at once.
const SETTLE_MS = 2000;

beforeEach(() => {
  jest.useFakeTimers();
  mockApp.state = "active";
});
afterEach(() => {
  disconnectLive();
  jest.useRealTimers();
});

describe("live updates in the app", () => {
  it("signs in with a fresh Clerk token, or as no one", async () => {
    connectLive({ getToken: () => Promise.resolve("clerk-jwt") });
    const sent = jest.fn();
    mockSocket.current.options.auth(sent);
    for (let i = 0; i < 10; i += 1) await Promise.resolve(); // getToken settles
    expect(sent).toHaveBeenCalledWith({ token: "clerk-jwt" });

    connectLive();
    const anon = jest.fn();
    mockSocket.current.options.auth(anon);
    expect(anon).toHaveBeenCalledWith({});
  });

  it("loads once for a burst, and only for its own topics", () => {
    connectLive();
    const reviews = jest.fn();
    const spots = jest.fn();
    const stop = [subscribeLive(["reviews"], reviews), subscribeLive(["spots"], spots)];
    mockSocket.current.emit("changed", { topics: ["reviews"] });
    mockSocket.current.emit("changed", { topics: ["reviews"] });
    jest.advanceTimersByTime(SETTLE_MS);
    expect(reviews).toHaveBeenCalledTimes(1);
    expect(spots).not.toHaveBeenCalled();
    stop.forEach((s) => s());
  });

  it("in the background nothing loads; it loads on return", () => {
    connectLive();
    const run = jest.fn();
    const stop = subscribeLive(["moderation"], run);
    mockApp.state = "background";
    mockSocket.current.emit("changed", { topics: ["moderation"] });
    jest.advanceTimersByTime(SETTLE_MS);
    expect(run).not.toHaveBeenCalled();
    mockApp.state = "active";
    mockApp.onChange("active");
    jest.advanceTimersByTime(SETTLE_MS);
    expect(run).toHaveBeenCalledTimes(1);
    stop();
  });

  it("closes after a minute in the background, and opens again on return", () => {
    connectLive();
    const socket = mockSocket.current;
    mockApp.state = "background";
    mockApp.onChange("background");
    jest.advanceTimersByTime(60_000);
    expect(socket.disconnect).toHaveBeenCalled();
    mockApp.state = "active";
    mockApp.onChange("active");
    expect(socket.connect).toHaveBeenCalled();
  });

  it("after the connection comes back, every screen loads once", () => {
    connectLive();
    const run = jest.fn();
    const stop = subscribeLive(["progress"], run);
    mockSocket.current.emit("connect");
    jest.advanceTimersByTime(SETTLE_MS);
    expect(run).not.toHaveBeenCalled();
    mockSocket.current.emit("connect");
    jest.advanceTimersByTime(SETTLE_MS);
    expect(run).toHaveBeenCalledTimes(1);
    stop();
  });

  it("a refused (expired) token tries again", () => {
    connectLive({ getToken: () => Promise.resolve("old") });
    mockSocket.current.active = false;
    mockSocket.current.emit("connect_error", new Error("unauthorized"));
    jest.advanceTimersByTime(10_000);
    expect(mockSocket.current.connect).toHaveBeenCalled();
  });
});
