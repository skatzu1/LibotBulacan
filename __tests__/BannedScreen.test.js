import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../context/ThemeContext";

// A refused appeal shows the server's own words, not axios's
// "Request failed with status code 410".

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("@clerk/clerk-expo", () => ({ useAuth: () => ({ signOut: jest.fn() }) }));
const mockSubmit = jest.fn();
jest.mock("../api", () => ({ appealAPI: { submit: (...args) => mockSubmit(...args) } }));
jest.mock("../components/AppAlert", () => ({ showAlert: jest.fn(), showToast: jest.fn() }));
const { showAlert } = require("../components/AppAlert");
const BannedScreen = require("../Screens/BannedScreen").default;

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (ui) => render(
  <SafeAreaProvider initialMetrics={metrics}>
    <ThemeProvider>{ui}</ThemeProvider>
  </SafeAreaProvider>,
);

it("explains a refused appeal in the server's words", async () => {
  const refusal = new Error("Request failed with status code 410");
  refusal.response = { status: 410, data: { success: false, message: "Appeal window has expired" } };
  mockSubmit.mockRejectedValueOnce(refusal);

  const tree = wrap(<BannedScreen banInfo={{ archiveReason: "ban", appealStatus: "none", daysLeft: 3 }} />);
  fireEvent.changeText(await tree.findByLabelText("Your appeal"), "Please look again.");
  fireEvent.press(tree.getByText("Submit appeal"));

  await waitFor(() => expect(showAlert).toHaveBeenCalledWith("Error", "Appeal window has expired"));
});
