import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../context/ThemeContext";

// An account made before sign-up asked for the home municipality is asked once,
// and the answer goes to the server.

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("@clerk/clerk-expo", () => ({ useAuth: () => ({ signOut: jest.fn() }) }));
const mockPatch = jest.fn();
jest.mock("../api", () => ({ __esModule: true, default: { patch: (...args) => mockPatch(...args) } }));
jest.mock("../components/AppAlert", () => ({ showAlert: jest.fn(), showToast: jest.fn() }));
const MunicipalityScreen = require("../Screens/MunicipalityScreen").default;

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (ui) => render(
  <SafeAreaProvider initialMetrics={metrics}>
    <ThemeProvider>{ui}</ThemeProvider>
  </SafeAreaProvider>,
);

beforeEach(() => jest.clearAllMocks());

const choose = async (tree, town) => {
  fireEvent.press(await tree.findByLabelText("Choose your municipality"));
  fireEvent.press(tree.getByLabelText(town));
};

it("saves the chosen municipality, then lets the traveler in", async () => {
  mockPatch.mockResolvedValueOnce({ data: { success: true } });
  const onDone = jest.fn();
  const tree = wrap(<MunicipalityScreen onDone={onDone} />);

  // Nothing to send until a town is chosen.
  expect((await tree.findByLabelText("Continue")).props.accessibilityState.disabled).toBe(true);
  await choose(tree, "Bocaue");
  fireEvent.press(tree.getByLabelText("Continue"));

  await waitFor(() => expect(onDone).toHaveBeenCalledWith("Bocaue"));
  expect(mockPatch).toHaveBeenCalledWith("/api/users/me", { municipality: "Bocaue" });
});

it("stays, with the server's reason, when the save fails", async () => {
  const refusal = new Error("Request failed with status code 400");
  refusal.response = { status: 400, data: { success: false, message: "Choose the municipality you live in." } };
  mockPatch.mockRejectedValueOnce(refusal);
  const onDone = jest.fn();
  const tree = wrap(<MunicipalityScreen onDone={onDone} />);

  await choose(tree, "Hagonoy");
  fireEvent.press(tree.getByLabelText("Continue"));

  expect(await tree.findByText("Choose the municipality you live in.")).toBeTruthy();
  expect(onDone).not.toHaveBeenCalled();
});
