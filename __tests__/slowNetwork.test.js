import React from "react";
import { Text } from "react-native";
import { render, fireEvent, act, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../context/ThemeContext";

// On a slow or failing connection, what's already on screen stays there: a
// request that fails or takes long used to empty the saved spots, blank the
// leaderboard and hold the whole spot page behind a skeleton (2026-10-18).

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("@clerk/clerk-expo", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: false, userId: "u1", getToken: async () => "token" }),
  useUser: () => ({ user: { id: "u1", firstName: "Ana" }, isLoaded: true }),
}));
const mockApiGet = jest.fn();
jest.mock("../api", () => ({
  __esModule: true,
  BASE_URL: "https://api.test",
  default: { get: (...args) => mockApiGet(...args), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("../components/AppAlert", () => ({ showAlert: jest.fn(), showToast: jest.fn() }));
jest.mock("react-native-image-crop-picker", () => ({ openCamera: jest.fn(), openPicker: jest.fn(), cleanSingle: jest.fn() }));
jest.mock("../utils/ModelViewer", () => () => null);
jest.mock("../utils/arLocationGate", () => ({ ensureAtSpotForAR: jest.fn(), spotHasAR: () => false }));
jest.mock("../utils/cameraAccess", () => ({ afterAlertCloses: jest.fn(), ensureCameraAccess: jest.fn(), explainPickerError: jest.fn() }));
jest.mock("../context/PointsContext", () => ({ usePoints: () => ({ hasVisited: () => false, refresh: async () => {} }) }));
jest.mock("../context/ProfileImageContext", () => ({ useProfileImage: () => ({ profileImage: null, loading: false }) }));
const mockFocusListeners = [];
jest.mock("@react-navigation/native", () => {
  const { useEffect } = require("react");
  return {
    useIsFocused: () => true,
    useFocusEffect: (fn) => useEffect(fn, [fn]),
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      canGoBack: () => false,
      addListener: (event, cb) => { if (event === "focus") mockFocusListeners.push(cb); return () => {}; },
    }),
  };
});
const { showToast } = require("../components/AppAlert");

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (ui) => render(
  <SafeAreaProvider initialMetrics={metrics}>
    <ThemeProvider>{ui}</ThemeProvider>
  </SafeAreaProvider>,
);

const json = (body) => ({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => body });
const offline = () => Promise.reject(new TypeError("Network request failed"));
const pending = () => {
  let settle;
  const promise = new Promise((resolve, reject) => { settle = { resolve, reject }; });
  return { promise, ...settle };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFocusListeners.length = 0;
  global.fetch = jest.fn();
});

describe("saved spots", () => {
  const { BookmarkProvider, useBookmark } = require("../context/BookmarkContext");

  it("stay when a later sync fails", async () => {
    global.fetch
      .mockResolvedValueOnce(json({ success: true, bookmarks: [{ _id: "b1", spotId: "s1" }] }))
      .mockImplementationOnce(offline);
    let ctx;
    const Probe = () => { ctx = useBookmark(); return <Text>{ctx.bookmarks.length} saved</Text>; };
    const tree = render(<BookmarkProvider><Probe /></BookmarkProvider>);
    await tree.findByText("1 saved");

    await act(() => ctx.fetchBookmarks());
    expect(tree.getByText("1 saved")).toBeTruthy();
    expect(ctx.isBookmarked("s1")).toBe(true);
  });
});

describe("the spot page", () => {
  const InformationScreen = require("../Screens/InformationScreen").default;
  const { ReviewProvider } = require("../context/ReviewContext");
  const { MissionProvider } = require("../context/MissionContext");
  const SPOT = { _id: "s1", name: "Barasoain Church", city: "Malolos", description: "Where the First Republic was born." };

  const { BookmarkProvider } = require("../context/BookmarkContext");
  const open = () => wrap(
    <BookmarkProvider>
      <ReviewProvider>
        <MissionProvider>
          <InformationScreen route={{ params: { spot: SPOT } }} navigation={{ navigate: jest.fn(), goBack: jest.fn() }} />
        </MissionProvider>
      </ReviewProvider>
    </BookmarkProvider>,
  );

  it("opens at once while its reviews are still loading, and offers a retry if they fail", async () => {
    const reviews = pending();
    mockApiGet.mockReturnValueOnce(reviews.promise);
    global.fetch.mockReturnValue(new Promise(() => {})); // missions: still on their way
    const tree = open();

    expect(await tree.findByText("Where the First Republic was born.")).toBeTruthy();
    expect(tree.getByLabelText("Loading reviews")).toBeTruthy();
    expect(tree.queryByText("No reviews yet")).toBeNull(); // slow isn't empty

    await act(async () => reviews.reject(new Error("timeout of 60000ms exceeded")));
    expect(await tree.findByText("Couldn't load the reviews. Check your connection.")).toBeTruthy();

    mockApiGet.mockResolvedValueOnce({ data: { success: true, reviews: [] } });
    fireEvent.press(tree.getByLabelText("Retry"));
    expect(await tree.findByText("No reviews yet")).toBeTruthy();
  });
});

describe("the leaderboard", () => {
  const Leaderboard = require("../Screens/Leaderboard").default;
  const board = { users: [{ _id: "1", clerkUserId: "u2", name: "Ben Cruz", points: 120, spotsVisited: 4 }], total: 1 };

  it("keeps the board when a refresh in the background fails", async () => {
    global.fetch.mockResolvedValueOnce(json(board));
    const tree = wrap(<Leaderboard />);
    await tree.findAllByText("Ben Cruz", {}, { timeout: 8000 });

    global.fetch.mockImplementation(offline);
    await act(async () => { mockFocusListeners.forEach((cb) => cb()); });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

    expect(tree.getAllByText("Ben Cruz").length).toBeGreaterThan(0);
    expect(tree.queryByText("Failed to load leaderboard.")).toBeNull();
    expect(showToast).not.toHaveBeenCalled(); // nobody asked; nothing to say
  }, 15000);
});
