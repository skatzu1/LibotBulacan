import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeProvider } from "../context/ThemeContext";

// Smoke tests for the screens the QA pass (2026-10-16) rewrote: they render,
// in the order the QA asked for, and the report goes to the server.

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
  warmUpAsync: jest.fn(),
  coolDownAsync: jest.fn(),
}));
jest.mock("expo-constants", () => ({ expoConfig: { version: "1.3.0" } }));
jest.mock("@react-native-community/datetimepicker", () => {
  const Picker = () => null;
  Picker.displayName = "DateTimePicker";
  return { __esModule: true, default: Picker, DateTimePickerAndroid: { open: jest.fn() } };
});
jest.mock("@clerk/clerk-expo", () => ({
  useSignUp: () => ({ isLoaded: true, signUp: { create: jest.fn() }, setActive: jest.fn() }),
  useSignIn: () => ({ isLoaded: true, signIn: { create: jest.fn() } }),
  useClerk: () => ({ signOut: jest.fn(async () => {}) }),
  useUser: () => ({ user: { primaryEmailAddress: { emailAddress: "ana@test.local" } }, isLoaded: true }),
}));
const mockPost = jest.fn();
jest.mock("../api", () => ({
  __esModule: true,
  default: { post: (...args) => mockPost(...args) },
  authAPI: { register: jest.fn(), isDisposableEmail: jest.fn(async () => false) },
}));
jest.mock("../components/AppAlert", () => ({ showAlert: jest.fn(), showToast: jest.fn() }));
const { showAlert } = require("../components/AppAlert");

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (ui) => render(
  <SafeAreaProvider initialMetrics={metrics}>
    <ThemeProvider>{ui}</ThemeProvider>
  </SafeAreaProvider>,
);

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe("Register", () => {
  const Register = require("../Screens/Register").default;

  it("asks first, middle (optional) and last name, municipality and email, in that order", async () => {
    const tree = wrap(<Register navigation={{ navigate: jest.fn() }} />);
    await tree.findByText("Create an Account", {}, { timeout: 8000 }); // the first render loads the screen's modules
    const labels = tree.UNSAFE_root
      .findAll((n) => typeof n.props?.accessibilityLabel === "string" && n.type !== "View")
      .map((n) => n.props.accessibilityLabel);
    // The middle name came back on 2026-10-21 (the thesis panel), optional.
    const order = ["First name", "Middle name, optional", "Last name", "Choose your municipality", "Email address"]
      .map((l) => labels.indexOf(l));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // The date of birth can be typed or picked from a calendar.
    expect(tree.getByLabelText("Date of birth, month slash day slash year")).toBeTruthy();
    expect(tree.getByLabelText("Pick your date of birth from a calendar")).toBeTruthy();
  });

  it("asks the municipality itself and turns away people outside Bulacan", async () => {
    const tree = wrap(<Register navigation={{ navigate: jest.fn() }} />);
    fireEvent.press(await tree.findByLabelText("Choose your municipality"));
    // A popup, once the list has closed (an iPhone won't show it over the sheet).
    fireEvent.press(tree.getByLabelText("I don't live in Bulacan"));
    await waitFor(() => expect(showAlert).toHaveBeenCalledWith(
      "For Bulacan residents only",
      "Sorry, LibotBulacan is for residents of Bulacan only.",
      expect.anything(),
      expect.anything(),
    ));
    fireEvent.press(tree.getByLabelText("Choose your municipality"));
    fireEvent.press(tree.getByLabelText("Bocaue"));
    expect(tree.getByLabelText("Municipality, Bocaue. Change")).toBeTruthy();
  });

  it("formats a typed date of birth as MM/DD/YYYY", async () => {
    const tree = wrap(<Register navigation={{ navigate: jest.fn() }} />);
    await tree.findByText("Create an Account");
    const dob = tree.getByLabelText("Date of birth, month slash day slash year");
    fireEvent.changeText(dob, "05172000");
    expect(tree.getByDisplayValue("05/17/2000")).toBeTruthy();
  });
});

describe("Report a Problem", () => {
  const ReportProblem = require("../Screens/ReportProblem").default;

  it("counts characters and sends the report to the server", async () => {
    mockPost.mockResolvedValue({ data: { success: true } });
    const goBack = jest.fn();
    const tree = wrap(<ReportProblem navigation={{ goBack }} />);
    const box = await tree.findByLabelText("What happened");
    expect(tree.getByText("0/1000")).toBeTruthy();
    fireEvent.changeText(box, "The map stays blank after I tap Navigate.");
    expect(tree.getByText("41/1000")).toBeTruthy();
    expect(tree.getByText(/ana@test\.local/)).toBeTruthy();

    fireEvent.press(tree.getByLabelText("Send report"));
    await waitFor(() => expect(goBack).toHaveBeenCalled());
    expect(mockPost).toHaveBeenCalledWith("/api/support/report", expect.objectContaining({
      category: "bug",
      message: "The map stays blank after I tap Navigate.",
      device: expect.objectContaining({ appVersion: "1.3.0" }),
    }));
  });

  it("offers the email app when the server can't send", async () => {
    mockPost.mockRejectedValue({ response: { status: 503, data: { notConfigured: true } } });
    const tree = wrap(<ReportProblem navigation={{ goBack: jest.fn() }} />);
    fireEvent.changeText(await tree.findByLabelText("What happened"), "The app closes when I open AR View.");
    fireEvent.press(tree.getByLabelText("Send report"));
    expect(await tree.findByText("Write the email")).toBeTruthy();
  });
});
