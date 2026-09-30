import { ensureAtSpotForPhoto } from "../utils/arLocationGate";
import * as Location from "expo-location";
import { showAlert } from "../components/AppAlert";

// jest.mock factories may only reference variables prefixed `mock`.
let mockPermission = "granted";
let mockPosition = null;

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: mockPermission })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: mockPermission })),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: mockPosition })),
}));
jest.mock("../components/AppAlert", () => ({ showAlert: jest.fn() }));

const SPOT = { name: "Barasoain Church", coordinates: { lat: 14.8456, lng: 120.8121 } };
const north = (m) => ({ latitude: SPOT.coordinates.lat + m / 111_320, longitude: SPOT.coordinates.lng, accuracy: 8 });

beforeEach(() => {
  mockPermission = "granted";
  mockPosition = null;
  jest.clearAllMocks();
});

describe("ensureAtSpotForPhoto", () => {
  it("lets the camera open at the spot, with the position to send", async () => {
    mockPosition = north(40);
    await expect(ensureAtSpotForPhoto(SPOT)).resolves.toEqual(mockPosition);
    expect(showAlert).not.toHaveBeenCalled();
  });

  it("refuses away from the spot — no 'start anyway', since the server would refuse too", async () => {
    mockPosition = north(3_000);
    await expect(ensureAtSpotForPhoto(SPOT)).resolves.toBeNull();
    expect(showAlert).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = showAlert.mock.calls[0];
    expect(title).toBe("You're not at Barasoain Church");
    expect(message).toMatch(/about 3\.0 km away/);
    expect(buttons).toBeUndefined();
  });

  it("asks for location when it isn't granted, and refuses without it", async () => {
    mockPermission = "denied";
    await expect(ensureAtSpotForPhoto(SPOT)).resolves.toBeNull();
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
    expect(showAlert.mock.calls[0][0]).toBe("Location needed");
  });

  it("leaves a spot without a position to the server to decide", async () => {
    mockPosition = north(3_000);
    await expect(ensureAtSpotForPhoto({ name: "X" })).resolves.toEqual(mockPosition);
  });
});
