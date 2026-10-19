import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeProvider } from "../context/ThemeContext";
import Mission from "../Screens/Mission";
import { runPrediction } from "../utils/missionAI";

// The AI Scan page, kept simple (2026-10-20): what to photograph, the photo,
// one status line, one button — no greeting, guide, meter or "Mark as Done".

// jest.mock factories may only reference variables prefixed `mock`.
let mockCompleted = [];
const mockMarkCompleted = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("../components/AppAlert", () => ({ showAlert: jest.fn(), showToast: jest.fn() }));
jest.mock("../context/MissionContext", () => ({
  useMissions: () => ({ completedMissions: mockCompleted, markCompleted: mockMarkCompleted }),
}));
jest.mock("@clerk/clerk-expo", () => ({ useAuth: () => ({ getToken: async () => "token" }) }));
jest.mock("@react-navigation/native", () => ({ useIsFocused: () => true }));
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: "success" },
}));
jest.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg" },
  manipulateAsync: jest.fn(async () => ({ uri: "file:///cropped.jpg", width: 1000, height: 2000 })),
}));
jest.mock("react-native-vision-camera", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Camera = React.forwardRef(function Camera(props, ref) {
    React.useImperativeHandle(ref, () => ({
      takePhoto: async () => ({ path: "/photo.jpg" }),
      focus: async () => {},
    }));
    return <View testID="camera" />;
  });
  return {
    Camera,
    useCameraDevice: () => ({ neutralZoom: 1, maxZoom: 8, supportsFocus: true }),
    useCameraPermission: () => ({ hasPermission: true }),
  };
});
jest.mock("../utils/cameraAccess", () => ({ ensureCameraAccess: async () => true }));
jest.mock("../utils/arLocationGate", () => ({
  ensureAtSpotForPhoto: async () => ({ latitude: 14.8456, longitude: 120.8121, accuracy: 8 }),
  currentCoords: async () => ({ latitude: 14.8456, longitude: 120.8121, accuracy: 8 }),
}));
jest.mock("../utils/missionAI", () => ({ runPrediction: jest.fn() }));

const spot = { name: "Barasoain Church", coordinates: { lat: 14.8456, lng: 120.8121 } };
const mission = {
  _id: "m1",
  type: "ai",
  title: "Scan the Philippine Flag",
  description: "Find a Philippine flag on display here and snap a clear photo of it — the AI scan confirms your sighting.",
  points: 5,
  aiTargetLabel: "Philippine Flag",
  aiTargetPhrase: "the Philippine flag",
  aiHint: "Point your camera at a Philippine flag on display here.",
};

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const renderPage = () => render(
  <SafeAreaProvider initialMetrics={metrics}>
    <ThemeProvider>
      <Mission navigation={{ goBack: jest.fn() }} route={{ params: { spot, mission } }} />
    </ThemeProvider>
  </SafeAreaProvider>,
);

// Opens the camera, takes the photo and waits for the answer.
async function scan(page) {
  fireEvent.press(await page.findByRole("button", { name: "Open Camera" }));
  expect(await page.findByText("Keep the Philippine flag inside the frame")).toBeTruthy();
  expect(page.getByText("Philippine Flag")).toBeTruthy();
  fireEvent.press(page.getByRole("button", { name: "Take the photo" }));
}

beforeEach(() => {
  mockCompleted = [];
  jest.clearAllMocks();
  return AsyncStorage.clear();
});

describe("AI Scan page", () => {
  it("says what to photograph, with one button and none of the old clutter", async () => {
    const page = renderPage();
    expect(await page.findByRole("header")).toHaveTextContent("AI Scan");
    expect(page.getByText("Take a photo of the Philippine flag")).toBeTruthy();
    expect(page.getByText("Barasoain Church · 5 points")).toBeTruthy();
    expect(page.getByRole("button", { name: "Open Camera" })).toBeTruthy();
    // Not an empty page: the frame the photo will fill, and what makes it count.
    expect(page.getByText("Your photo shows here")).toBeTruthy();
    expect(page.getByText("Take it at Barasoain Church. Photos from anywhere else don't count.")).toBeTruthy();
    expect(page.getByText("Fit the Philippine flag inside the frame.")).toBeTruthy();
    expect(page.getByText("Use good light and hold the phone still.")).toBeTruthy();
    for (const gone of [/Hello there/, /What to do/, /Mark as Done/, /Match confidence/, /On the hunt/, /snap a clear photo/, /Point your camera/]) {
      expect(page.queryByText(gone)).toBeNull();
    }
  });

  it("shows a mission already done", async () => {
    mockCompleted = ["m1"];
    const page = renderPage();
    expect(await page.findByText("Already done. You can scan again for fun.")).toBeTruthy();
  });

  it("accepts a matching photo in one step: points, score, and the way back", async () => {
    runPrediction.mockResolvedValue({ verified: true, confidence: 91.4, completed: true, pointsAwarded: 5 });
    const page = renderPage();
    await scan(page);
    expect(await page.findByText("Found it! +5 points")).toBeTruthy();
    expect(page.getByText("AI match: 91%")).toBeTruthy();
    expect(page.getByLabelText("The photo you took")).toBeTruthy();
    expect(page.getByRole("button", { name: "Back to Bakit List" })).toBeTruthy();
    expect(mockMarkCompleted).toHaveBeenCalledWith("m1");
  });

  it("explains a photo that didn't match and offers another try", async () => {
    runPrediction.mockResolvedValue({ verified: false, confidence: 34.2, completed: false, pointsAwarded: 0 });
    const page = renderPage();
    await scan(page);
    expect(await page.findByText("Couldn't find the Philippine flag. Get closer, in good light, and try again.")).toBeTruthy();
    expect(page.getByText("AI match: 34%")).toBeTruthy();
    await waitFor(() => expect(page.getByRole("button", { name: "Try Again" })).toBeTruthy());
    expect(mockMarkCompleted).not.toHaveBeenCalled();
  });
});
