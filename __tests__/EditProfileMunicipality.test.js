import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../context/ThemeContext";

// Edit Profile shows the home municipality from the server and saves a change.

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("react-native-image-crop-picker", () => ({ openCamera: jest.fn(), openPicker: jest.fn(), cleanSingle: jest.fn() }));
const mockClerkUser = {
  firstName: "Chyna", lastName: "Medina", passwordEnabled: true, hasImage: false, unsafeMetadata: {},
  primaryEmailAddress: { emailAddress: "chyna@test.local" },
  update: jest.fn(async () => {}), reload: jest.fn(async () => {}),
};
jest.mock("@clerk/clerk-expo", () => ({
  useUser: () => ({ user: mockClerkUser, isLoaded: true }),
  useAuth: () => ({ getToken: async () => "token" }),
}));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ logout: jest.fn() }) }));
jest.mock("../context/ProfileImageContext", () => ({
  useProfileImage: () => ({ profileImage: null, setProfileImage: jest.fn(), clearProfileImage: jest.fn() }),
}));
const mockGet = jest.fn();
jest.mock("../api", () => ({
  __esModule: true,
  BASE_URL: "https://api.test",
  default: { get: (...args) => mockGet(...args), post: jest.fn() },
}));
jest.mock("../utils/cameraAccess", () => ({
  afterAlertCloses: jest.fn(), ensureCameraAccess: jest.fn(), explainPickerError: jest.fn(),
}));
jest.mock("../components/AppAlert", () => ({ showAlert: jest.fn(), showToast: jest.fn() }));
const EditProfile = require("../Screens/EditProfile").default;

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const navigation = { addListener: () => () => {}, goBack: jest.fn(), dispatch: jest.fn() };
const wrap = () => render(
  <SafeAreaProvider initialMetrics={metrics}>
    <ThemeProvider><EditProfile navigation={navigation} /></ThemeProvider>
  </SafeAreaProvider>,
);

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ success: true }) }));
});

it("shows an empty municipality for an older account, and saves the one picked", async () => {
  mockGet.mockResolvedValueOnce({ data: { user: { municipality: "" } } });
  const tree = wrap();

  const field = await tree.findByLabelText("Municipality, Choose where you live");
  expect(tree.getByLabelText("Save").props.accessibilityState.disabled).toBe(true);
  fireEvent.press(field);
  fireEvent.press(tree.getByLabelText("Guiguinto"));
  expect(tree.getByLabelText("Municipality, Guiguinto. Change")).toBeTruthy();

  fireEvent.press(tree.getByLabelText("Save"));
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  const [url, init] = global.fetch.mock.calls[0];
  expect(url).toBe("https://api.test/api/users/me");
  expect(JSON.parse(init.body)).toMatchObject({ firstName: "Chyna", lastName: "Medina", municipality: "Guiguinto" });
});

it("shows the municipality the account has", async () => {
  mockGet.mockResolvedValueOnce({ data: { user: { municipality: "Malolos" } } });
  const tree = wrap();
  expect(await tree.findByLabelText("Municipality, Malolos. Change")).toBeTruthy();
  expect(tree.getByLabelText("Save").props.accessibilityState.disabled).toBe(true);
});
