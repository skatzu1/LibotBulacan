import React from "react";
import { Image } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../context/ThemeContext";

// The spot page's 3D Model tab shows the model where the photo is, in the
// hero at the top (user, 2026-10-20), not in a second card further down.

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
jest.mock("../utils/ModelViewer", () => {
  const { View } = require("react-native");
  const ModelViewer = ({ url }) => <View testID="model-viewer" accessibilityLabel={url} />;
  return ModelViewer;
});
jest.mock("../utils/arLocationGate", () => ({ ensureAtSpotForAR: jest.fn(async () => false), spotHasAR: () => true }));
jest.mock("../utils/cameraAccess", () => ({ afterAlertCloses: jest.fn(), ensureCameraAccess: jest.fn(), explainPickerError: jest.fn() }));
jest.mock("../context/PointsContext", () => ({ usePoints: () => ({ hasVisited: () => false, refresh: async () => {} }) }));
jest.mock("../context/ProfileImageContext", () => ({ useProfileImage: () => ({ profileImage: null, loading: false }) }));
jest.mock("../context/BookmarkContext", () => ({ useBookmark: () => ({ isBookmarked: () => false, toggleBookmark: jest.fn() }) }));
jest.mock("../context/ReviewContext", () => ({
  useReviews: () => ({
    getReviewsForSpot: () => [], hasReviewsFor: () => true, addReview: jest.fn(), reportReview: jest.fn(),
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
const SPOT = {
  _id: "s1", name: "Barasoain Church", city: "Malolos", description: "Where the First Republic was born.",
  category: ["Historical"], image: "https://res.cloudinary.com/demo/image/upload/v1/spots/barasoain.jpg",
  modelUrl: "https://res.cloudinary.com/demo/raw/upload/v1/models/barasoain.glb",
};

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const open = (tab) => render(
  <SafeAreaProvider initialMetrics={metrics}>
    <ThemeProvider>
      <InformationScreen route={{ params: { spot: SPOT, tab } }} navigation={{ navigate: jest.fn(), goBack: jest.fn() }} />
    </ThemeProvider>
  </SafeAreaProvider>,
);

const photo = (tree) => tree.UNSAFE_queryAllByType(Image).filter((i) => /barasoain\.jpg/.test(i.props.source?.uri ?? ""));
// Everything on the page, in reading order.
const inOrder = (tree) => tree.UNSAFE_root.findAll(() => true);

it("shows the model in the hero, above the tabs, in place of the photo", async () => {
  const tree = open("Model3D");
  const viewer = await tree.findByTestId("model-viewer");
  expect(viewer.props.accessibilityLabel).toBe(SPOT.modelUrl);
  expect(tree.getAllByTestId("model-viewer")).toHaveLength(1);
  expect(photo(tree)).toHaveLength(0);

  const all = inOrder(tree);
  const tab = tree.getByRole("tab", { name: "3D Model" });
  expect(tab.props.accessibilityState).toEqual({ selected: true });
  expect(all.indexOf(viewer)).toBeGreaterThan(-1);
  expect(all.indexOf(viewer)).toBeLessThan(all.indexOf(tab));
  expect(all.indexOf(tree.getByText(/Drag the model above/))).toBeGreaterThan(all.indexOf(tab));
  // Only the hint; the AR View note under it was removed (user, 2026-10-20).
  expect(tree.queryByText(/AR View puts the models around you/)).toBeNull();
});

it("puts the photo back on the other tabs", async () => {
  const tree = open("Model3D");
  await tree.findByTestId("model-viewer");
  fireEvent.press(tree.getByRole("tab", { name: "Overview" }));
  expect(tree.queryByTestId("model-viewer")).toBeNull();
  expect(photo(tree)).toHaveLength(1);
});
