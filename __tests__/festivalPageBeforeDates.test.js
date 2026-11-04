import React from "react";
import { render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../context/ThemeContext";

// Before its dates a festival's page can be read (panel, 2026-11-04), but
// directions, the Bakit List and the review box's invitation wait for the dates.

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("@clerk/clerk-expo", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true, userId: "u1", getToken: async () => "token" }),
  useUser: () => ({ user: { id: "u1", firstName: "Ana" }, isLoaded: true }),
}));
jest.mock("../api", () => ({
  __esModule: true,
  BASE_URL: "https://api.test",
  default: { get: jest.fn(async () => ({ data: { success: true, reviews: [] } })), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("../components/AppAlert", () => ({ showAlert: jest.fn(), showToast: jest.fn() }));
jest.mock("react-native-image-crop-picker", () => ({ openCamera: jest.fn(), openPicker: jest.fn(), cleanSingle: jest.fn() }));
jest.mock("../utils/ModelViewer", () => () => null);
jest.mock("../utils/arLocationGate", () => ({ ensureAtSpotForAR: jest.fn(async () => false), spotHasAR: () => false }));
jest.mock("../utils/cameraAccess", () => ({ afterAlertCloses: jest.fn(), ensureCameraAccess: jest.fn(), explainPickerError: jest.fn() }));
jest.mock("../context/PointsContext", () => ({ usePoints: () => ({ hasVisited: () => false, refresh: async () => {} }) }));
jest.mock("../context/ProfileImageContext", () => ({ useProfileImage: () => ({ profileImage: null, loading: false }) }));
jest.mock("../context/BookmarkContext", () => ({ useBookmark: () => ({ isBookmarked: () => false, toggleBookmark: jest.fn() }) }));
jest.mock("../context/ReviewContext", () => ({
  useReviews: () => ({
    getReviewsForSpot: () => [], hasReviewsFor: () => true, addReview: jest.fn(),
    reactToReview: jest.fn(), getAverageRating: () => null, getReviewCount: () => 0,
    fetchReviews: jest.fn(async () => true), deleteReview: jest.fn(),
  }),
}));
jest.mock("../context/MissionContext", () => ({
  useMissions: () => ({
    fetchMissions: jest.fn(async () => true), refetchMissions: jest.fn(async () => true),
    getMissionsForSpot: () => [], hasMissionsFor: () => true, completedMissions: [],
  }),
}));
jest.mock("@react-navigation/native", () => {
  const { useEffect } = require("react");
  return {
    useIsFocused: () => true,
    useFocusEffect: (fn) => useEffect(fn, [fn]),
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => false, addListener: () => () => {} }),
  };
});

const InformationScreen = require("../Screens/InformationScreen").default;

const festival = (visitingHours) => ({
  _id: "f1", name: "Carabao Festival", city: "Pulilan", category: ["Festivals"], visitingHours,
  description: "Carabaos kneel in front of the church.",
});
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const open = (spot, params = {}) => render(
  <SafeAreaProvider initialMetrics={metrics}>
    <ThemeProvider>
      <InformationScreen route={{ params: { spot, ...params } }} navigation={{ navigate: jest.fn(), goBack: jest.fn() }} />
    </ThemeProvider>
  </SafeAreaProvider>,
);

const now = new Date("2030-02-01T04:00:00Z");
beforeEach(() => jest.useFakeTimers({ now, doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] }));
afterEach(() => jest.useRealTimers());

it("shows the details and when it opens, without directions or the Bakit List", async () => {
  const tree = open(festival("Celebrated on May 14–15"));
  expect(await tree.findByText("Carabaos kneel in front of the church.")).toBeTruthy();
  expect(tree.getByText("Opens May 14–15, 2030")).toBeTruthy();
  expect(tree.getByText("Celebrated on May 14–15")).toBeTruthy();
  expect(tree.getByLabelText("Bookmark this spot")).toBeTruthy();
  expect(tree.queryByLabelText("Navigate to Carabao Festival")).toBeNull();
  expect(tree.queryByText("Things to do here")).toBeNull();
  expect(tree.queryByText("Visit to write a review")).toBeNull();
  expect(tree.queryByText("Go back")).toBeNull();
});

it("doesn't let a link to the Bakit List past the lock", async () => {
  const tree = open(festival("Celebrated on May 14–15"), { tab: "BucketList" });
  expect(await tree.findByText("Carabaos kneel in front of the church.")).toBeTruthy();
  expect(tree.queryByText("Things to do here")).toBeNull();
});

it("says so when the festival has no dates yet", async () => {
  const tree = open(festival(""));
  expect(await tree.findByText("No dates set yet")).toBeTruthy();
  expect(tree.getByText("Carabaos kneel in front of the church.")).toBeTruthy();
});

it("opens fully on its dates", async () => {
  const tree = open(festival("Celebrated on February 1"));
  expect(await tree.findByLabelText("Navigate to Carabao Festival")).toBeTruthy();
  expect(tree.queryByText(/^Opens /)).toBeNull();
  expect(tree.getByText("Visit to write a review")).toBeTruthy();
});
