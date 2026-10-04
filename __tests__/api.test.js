// BASE_URL is read once when api.js loads, so each case loads a fresh copy.
const loadApi = (url) => {
  jest.resetModules();
  if (url === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = url;
  let mod;
  jest.isolateModules(() => { mod = require("../api"); });
  return mod;
};

afterAll(() => { delete process.env.EXPO_PUBLIC_API_URL; });

describe("backend URL", () => {
  it("defaults to production when nothing is configured", () => {
    const { BASE_URL, API_ENDPOINTS } = loadApi(undefined);
    expect(BASE_URL).toBe("https://libotbackend.onrender.com");
    expect(API_ENDPOINTS.spots).toBe("https://libotbackend.onrender.com/api/spots");
  });

  it("follows EXPO_PUBLIC_API_URL and drops a trailing slash", () => {
    const { BASE_URL, API_ENDPOINTS } = loadApi("https://staging.example.com/");
    expect(BASE_URL).toBe("https://staging.example.com");
    expect(API_ENDPOINTS.spotVisit("abc")).toBe("https://staging.example.com/api/spots/abc/visit");
  });

  it("no longer exposes the removed auth endpoints", () => {
    const { API_ENDPOINTS, authAPI } = loadApi(undefined);
    expect(API_ENDPOINTS.auth.login).toBeUndefined();
    expect(API_ENDPOINTS.auth.checkUser).toBeUndefined();
    expect(API_ENDPOINTS.auth.verify).toBeUndefined();
    expect(authAPI.login).toBeUndefined();
    expect(authAPI.verifyToken).toBeUndefined();
  });
});
