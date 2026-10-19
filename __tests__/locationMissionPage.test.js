import React from "react";
import { render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeProvider } from "../context/ThemeContext";
import LocationMission from "../Screens/LocationMission";

// The Nearby Eats page: a header that fits, the eatery and its spot named in
// full, and no stock mission text.

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("../api", () => ({ __esModule: true, BASE_URL: "https://api.test", default: {} }));
jest.mock("../components/AppAlert", () => ({ showAlert: jest.fn(), showToast: jest.fn() }));
jest.mock("../context/MissionContext", () => ({
  useMissions: () => ({ completeMission: jest.fn(), completedMissions: [] }),
}));
// Locating never finishes here; the page is checked as it first shows.
jest.mock("expo-location", () => ({
  Accuracy: { High: 4, BestForNavigation: 6 },
  requestForegroundPermissionsAsync: () => new Promise(() => {}),
}));
jest.mock("../components/MissionMap", () => {
  const { View } = require("react-native");
  const MissionMap = ({ children }) => <View>{children}</View>;
  return MissionMap;
});

const SPOT = "The Cathedral-Basilica Minore and Parish of the Immaculate Conception";
const mission = {
  _id: "m2",
  type: "location",
  title: `Try a Recommended Eatery Near ${SPOT}`,
  description: `Head to the food spot recommended near ${SPOT} — get within range to complete this mission. (Location pending — an admin needs to pin it.)`,
  locationConfigured: true,
  locationName: "Burger King",
  coordinates: { lat: 14.8441, lng: 120.8115 },
  radiusMeters: 40,
};

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const renderPage = (spot) => render(
  <SafeAreaProvider initialMetrics={metrics}>
    <ThemeProvider>
      <LocationMission navigation={{ goBack: jest.fn() }} route={{ params: { spot, mission } }} />
    </ThemeProvider>
  </SafeAreaProvider>,
);

beforeEach(() => AsyncStorage.clear());

describe("Nearby Eats page", () => {
  it("has a header that fits, and no stock mission text", async () => {
    const page = renderPage({ name: SPOT, coordinates: { lat: 14.8436, lng: 120.8112 } });
    const header = await page.findByRole("header");
    expect(header).toHaveTextContent("Nearby Eats");
    expect(page.queryByText(/Head to the food spot/)).toBeNull();
    expect(page.queryByText(mission.title)).toBeNull();
  });

  it("names the eatery and the spot it's near in full", async () => {
    const page = renderPage({ name: SPOT, coordinates: { lat: 14.8436, lng: 120.8112 } });
    expect(await page.findByText("Burger King")).toBeTruthy();
    const near = page.getByText(new RegExp(`m from ${SPOT}$`));
    expect(near.props.numberOfLines).toBeGreaterThan(1);
  });

  it("still names the spot when its position isn't known", async () => {
    const page = renderPage({ name: SPOT });
    expect(await page.findByText(`Near ${SPOT}`)).toBeTruthy();
  });
});
