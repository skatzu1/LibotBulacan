import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../context/ThemeContext";

// The spot page's Bakit List tab is one checklist (user, 2026-10-20: "make it
// simple"): arriving and the AR first, marked must-do, then the rest; each
// item Done or saying how to do it, with its points.

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
jest.mock("../utils/arLocationGate", () => ({ ensureAtSpotForAR: jest.fn(async () => false), spotHasAR: () => true }));
jest.mock("../utils/cameraAccess", () => ({ afterAlertCloses: jest.fn(), ensureCameraAccess: jest.fn(), explainPickerError: jest.fn() }));
jest.mock("../context/PointsContext", () => ({ usePoints: () => ({ hasVisited: () => true, refresh: async () => {} }) }));
jest.mock("../context/ProfileImageContext", () => ({ useProfileImage: () => ({ profileImage: null, loading: false }) }));
jest.mock("../context/BookmarkContext", () => ({ useBookmark: () => ({ isBookmarked: () => false, toggleBookmark: jest.fn() }) }));
jest.mock("../context/ReviewContext", () => ({
  useReviews: () => ({
    getReviewsForSpot: () => [], hasReviewsFor: () => true, addReview: jest.fn(),
    reactToReview: jest.fn(), getAverageRating: () => null, getReviewCount: () => 0,
    fetchReviews: jest.fn(async () => true), deleteReview: jest.fn(),
  }),
}));
// Stored in the admin's order: scan, eatery, AR. The AI scan is done.
const mockMissions = [
  { _id: "m-ai", type: "ai", order: 1, title: "Scan the Philippine Flag", points: 20 },
  { _id: "m-eat", type: "location", order: 2, title: "Try a Recommended Eatery", points: 15, locationConfigured: true },
  { _id: "m-ar", type: "ar", order: 3, title: "AR Experience at Barasoain Church", points: 50 },
];
jest.mock("../context/MissionContext", () => ({
  useMissions: () => ({
    fetchMissions: jest.fn(async () => true), refetchMissions: jest.fn(async () => true),
    getMissionsForSpot: () => mockMissions, hasMissionsFor: () => true, completedMissions: ["m-ai"],
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
const SPOT = {
  _id: "s1", name: "Barasoain Church", city: "Malolos", description: "Where the First Republic was born.", category: ["Historical"],
  AR3DModelURL: "https://res.cloudinary.com/demo/raw/upload/m.glb", modelsCoordinates: [{ lat: 14.8466, lng: 120.8125 }],
};

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const navigation = { navigate: jest.fn(), goBack: jest.fn() };
const open = () => render(
  <SafeAreaProvider initialMetrics={metrics}>
    <ThemeProvider>
      <InformationScreen route={{ params: { spot: SPOT, tab: "BucketList" } }} navigation={navigation} />
    </ThemeProvider>
  </SafeAreaProvider>,
);

beforeEach(() => jest.clearAllMocks());

it("lists every item in one checklist: must-dos first, then the rest", async () => {
  const tree = open();
  expect(await tree.findByText("2 of 4 done")).toBeTruthy();
  const labels = tree.UNSAFE_root
    .findAll((n) => typeof n.props?.accessibilityLabel === "string" && /points, /.test(n.props.accessibilityLabel) && n.type !== "View")
    .map((n) => n.props.accessibilityLabel)
    .filter((l, i, all) => all.indexOf(l) === i);
  expect(labels).toEqual([
    "Arrive at Barasoain Church, 10 points, Done",
    "AR Experience at Barasoain Church, 50 points, Must-do · Opens when you're at the spot",
    "Scan the Philippine Flag, 20 points, Done",
    "Try a Recommended Eatery, 15 points, Visit the recommended eatery",
  ]);
  // The old split into two sections, each with its own blurb, is gone.
  expect(tree.queryByText("Must-Dos")).toBeNull();
  expect(tree.queryByText("Side Trips")).toBeNull();
});

it("opens an item from its row", async () => {
  const tree = open();
  fireEvent.press(await tree.findByLabelText("Try a Recommended Eatery, 15 points, Visit the recommended eatery"));
  expect(navigation.navigate).toHaveBeenCalledWith("LocationMission", { spot: expect.objectContaining({ _id: "s1" }), mission: mockMissions[1] });
});
