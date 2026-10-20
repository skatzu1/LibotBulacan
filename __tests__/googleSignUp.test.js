import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeProvider } from "../context/ThemeContext";

// "Continue with Google" on the sign-up screen (2026-10-20): a Google account
// that already has a Libot account is asked to log in — not signed in quietly
// and told "Account created".

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
  warmUpAsync: jest.fn(),
  coolDownAsync: jest.fn(),
  openAuthSessionAsync: jest.fn(async () => ({
    type: "success",
    url: "libot://oauth-native-callback?rotating_token_nonce=n1",
  })),
}));
jest.mock("expo-auth-session", () => ({ makeRedirectUri: () => "libot://oauth-native-callback" }));
jest.mock("@react-native-community/datetimepicker", () => {
  const Picker = () => null;
  Picker.displayName = "DateTimePicker";
  return { __esModule: true, default: Picker, DateTimePickerAndroid: { open: jest.fn() } };
});

// jest.mock factories may only reference variables prefixed `mock`.
let mockReloaded = null; // what Clerk's sign-in says once Google is done
const mockSetActive = jest.fn(async () => {});
const mockSignOut = jest.fn(async () => {});
const mockSignUpCreate = jest.fn(async () => ({ createdSessionId: "sess_new" }));
jest.mock("@clerk/clerk-expo", () => ({
  useSignUp: () => ({ isLoaded: true, signUp: { create: mockSignUpCreate }, setActive: mockSetActive }),
  useSignIn: () => ({
    isLoaded: true,
    signIn: {
      create: async () => ({
        firstFactorVerification: { externalVerificationRedirectURL: new URL("https://accounts.google.test/o") },
        reload: async () => mockReloaded,
      }),
    },
  }),
  useClerk: () => ({ signOut: mockSignOut }),
}));
const mockRegister = jest.fn(async () => ({ success: true }));
jest.mock("../api", () => ({
  __esModule: true,
  default: {},
  authAPI: { register: (...args) => mockRegister(...args), isDisposableEmail: jest.fn(async () => false) },
}));
jest.mock("../components/AppAlert", () => ({ showAlert: jest.fn(), showToast: jest.fn() }));
const { showAlert, showToast } = require("../components/AppAlert");
const Register = require("../Screens/Register").default;
const { LEGAL_VERSION } = require("../utils/legalText");

// The Terms pop-up opens first (2026-10-21): read to the end, then I agree.
async function agreeToTerms(tree) {
  const scroll = await tree.findByTestId("legal-scroll");
  fireEvent(scroll, "layout", { nativeEvent: { layout: { height: 700 } } });
  fireEvent(scroll, "contentSizeChange", 390, 6000);
  fireEvent.scroll(scroll, {
    nativeEvent: { layoutMeasurement: { height: 700 }, contentOffset: { y: 5300 }, contentSize: { height: 6000 } },
  });
  fireEvent.press(tree.getByLabelText("I agree to the Terms and Conditions and Privacy Policy"));
}

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

// Fills what Google sign-up needs first, then taps "Continue with Google".
async function continueWithGoogle() {
  const navigate = jest.fn();
  const tree = render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider><Register navigation={{ navigate }} /></ThemeProvider>
    </SafeAreaProvider>,
  );
  fireEvent.press(await tree.findByLabelText("Choose your municipality", {}, { timeout: 8000 }));
  fireEvent.press(tree.getByLabelText("Bocaue"));
  fireEvent.changeText(tree.getByLabelText("Date of birth, month slash day slash year"), "05172000");
  fireEvent.press(tree.getByLabelText("Continue with Google"));
  await agreeToTerms(tree); // and Google opens straight after
  return { tree, navigate };
}

// The "You already have an account" prompt's buttons, by their text.
async function promptButtons() {
  await waitFor(() => expect(showAlert).toHaveBeenCalledWith(
    "You already have an account",
    "This Google account is already registered with Libot Bulacan. Log in with it instead.",
    expect.any(Array),
    expect.objectContaining({ cancelable: false }),
  ));
  const buttons = showAlert.mock.calls.at(-1)[2];
  return Object.fromEntries(buttons.map((b) => [b.text, b]));
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe("The Terms pop-up before sign-up", () => {
  it("Google waits for the Terms; I agree stays off until the end", async () => {
    const tree = render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ThemeProvider><Register navigation={{ navigate: jest.fn() }} /></ThemeProvider>
      </SafeAreaProvider>,
    );
    fireEvent.press(await tree.findByLabelText("Choose your municipality", {}, { timeout: 8000 }));
    fireEvent.press(tree.getByLabelText("Bocaue"));
    fireEvent.changeText(tree.getByLabelText("Date of birth, month slash day slash year"), "05172000");
    fireEvent.press(tree.getByLabelText("Continue with Google"));

    const scroll = await tree.findByTestId("legal-scroll");
    fireEvent(scroll, "layout", { nativeEvent: { layout: { height: 700 } } });
    fireEvent(scroll, "contentSizeChange", 390, 6000);
    // Halfway: still off, and pressing it does nothing.
    fireEvent.scroll(scroll, {
      nativeEvent: { layoutMeasurement: { height: 700 }, contentOffset: { y: 2650 }, contentSize: { height: 6000 } },
    });
    const off =tree.getByLabelText("Scroll to the end to agree");
    expect(off.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    fireEvent.press(off);
    expect(mockSignUpCreate).not.toHaveBeenCalled();
    expect(tree.getByText(/50% read/)).toBeTruthy();

    // Closing it leaves the box unticked and nothing signed up.
    fireEvent.press(tree.getByLabelText("Close without agreeing"));
    await waitFor(() => expect(tree.getByText("Read the Terms and Privacy Policy to the end and agree first.")).toBeTruthy());
    expect(tree.getByRole("checkbox").props.accessibilityState).toEqual(expect.objectContaining({ checked: false }));
    expect(mockSignUpCreate).not.toHaveBeenCalled();
  });
});

describe("Continue with Google on the sign-up screen", () => {
  it("asks an existing account to log in, and Log in signs it in", async () => {
    mockReloaded = { status: "complete", createdSessionId: "sess_old" };
    await continueWithGoogle();
    const { "Log in": logIn } = await promptButtons();

    // Nothing happens behind the prompt: no new account, no sign-in yet.
    expect(mockSignUpCreate).not.toHaveBeenCalled();
    expect(mockRegister).not.toHaveBeenCalled();
    expect(mockSetActive).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalledWith("Account created with Google!", expect.anything());

    await logIn.onPress();
    expect(mockSetActive).toHaveBeenCalledWith({ session: "sess_old" });
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("throws the Google sign-in away on Cancel", async () => {
    mockReloaded = { status: "complete", createdSessionId: "sess_old" };
    await continueWithGoogle();
    const { Cancel: cancel } = await promptButtons();

    cancel.onPress();
    expect(mockSignOut).toHaveBeenCalledWith({ sessionId: "sess_old" });
    expect(mockSetActive).not.toHaveBeenCalled();
  });

  it("still creates the account for a Google account Libot hasn't seen", async () => {
    mockReloaded = { status: "needs_identifier", firstFactorVerification: { status: "transferable" } };
    const { navigate } = await continueWithGoogle();

    await waitFor(() => expect(showToast).toHaveBeenCalledWith("Account created with Google!", { type: "success" }));
    expect(mockSignUpCreate).toHaveBeenCalledWith({
      transfer: true,
      unsafeMetadata: { municipality: "Bocaue", middleName: "", termsVersion: LEGAL_VERSION, termsAcceptedAt: expect.any(String) },
    });
    expect(mockSetActive).toHaveBeenCalledWith({ session: "sess_new" });
    expect(mockRegister).toHaveBeenCalledWith({ clerkSessionId: "sess_new", isGoogle: true });
    expect(navigate).toHaveBeenCalledWith("Home");
    expect(showAlert).not.toHaveBeenCalled();
  });
});
