import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../context/ThemeContext";

// 2026-10-25: a traveler opens another traveler's profile from the leaderboard
// or a review, and can report them to the admins.

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock("../api", () => ({ __esModule: true, BASE_URL: "https://api.test", default: { get: (...a) => mockGet(...a), post: (...a) => mockPost(...a) } }));
const mockAlert = jest.fn();
const mockToast = jest.fn();
jest.mock("../components/AppAlert", () => ({ showAlert: (...a) => mockAlert(...a), showToast: (...a) => mockToast(...a) }));
jest.mock("../utils/live", () => ({ useLive: () => {} }));

const TravelerProfile = require("../Screens/TravelerProfile").default;
const ReportTraveler = require("../Screens/ReportTraveler").default;

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (ui) => render(
  <SafeAreaProvider initialMetrics={metrics}>
    <ThemeProvider>{ui}</ThemeProvider>
  </SafeAreaProvider>,
);
const nav = () => ({ navigate: jest.fn(), goBack: jest.fn(), addListener: () => () => {} });
const ana = { clerkUserId: "u_ana", name: "Ana Reyes", profileImage: null, municipality: "Malolos", points: 120, spotsVisited: 4, badges: 2, townBadges: 1, title: null, joinedAt: "2026-10-01T00:00:00Z", isMe: false, reportedByMe: false };

beforeEach(() => { mockGet.mockReset(); mockPost.mockReset(); mockAlert.mockReset(); mockToast.mockReset(); });

describe("TravelerProfile", () => {
  it("shows the traveler at once from what the opening screen had, then their figures, and opens the report", async () => {
    mockGet.mockResolvedValue({ data: { traveler: ana } });
    const navigation = nav();
    const tree = wrap(<TravelerProfile navigation={navigation} route={{ params: { clerkUserId: "u_ana", name: "Ana Reyes" } }} />);
    expect(await tree.findByText("Ana Reyes")).toBeTruthy();
    expect(await tree.findByText("120")).toBeTruthy();
    expect(tree.getByText("3")).toBeTruthy(); // 2 spot badges + 1 municipality badge
    expect(tree.getByText(/Lives in Malolos/)).toBeTruthy();
    expect(mockGet).toHaveBeenCalledWith("/api/users/traveler/u_ana");

    fireEvent.press(tree.getByText("Report this traveler"));
    expect(navigation.navigate).toHaveBeenCalledWith("ReportTraveler", { clerkUserId: "u_ana", name: "Ana Reyes" });
  });

  it("says so once you've reported them, and offers no second report", async () => {
    mockGet.mockResolvedValue({ data: { traveler: { ...ana, reportedByMe: true } } });
    const tree = wrap(<TravelerProfile navigation={nav()} route={{ params: { clerkUserId: "u_ana" } }} />);
    expect(await tree.findByText("You reported this traveler")).toBeTruthy();
    expect(tree.queryByText("Report this traveler")).toBeNull();
  });

  it("a traveler out of public view is gone", async () => {
    mockGet.mockRejectedValue({ response: { status: 404 } });
    const tree = wrap(<TravelerProfile navigation={nav()} route={{ params: { clerkUserId: "u_ana", name: "Ana Reyes" } }} />);
    expect(await tree.findByText("This traveler is no longer here")).toBeTruthy();
  });
});

describe("ReportTraveler", () => {
  const open = async (navigation = nav()) => {
    const tree = wrap(<ReportTraveler navigation={navigation} route={{ params: { clerkUserId: "u_ana", name: "Ana Reyes" } }} />);
    await tree.findByText("Send report");
    return tree;
  };

  it("needs a reason, and details for 'Something else'", async () => {
    const tree = await open();
    fireEvent.press(tree.getByText("Send report"));
    expect(mockAlert).toHaveBeenCalledWith("Choose a reason", expect.any(String));
    fireEvent.press(tree.getByText("Something else"));
    fireEvent.press(tree.getByText("Send report"));
    expect(mockAlert).toHaveBeenLastCalledWith("A little more, please", "Tell us what happened.");
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("sends the reason and details, then goes back", async () => {
    mockPost.mockResolvedValue({ data: { success: true } });
    const navigation = nav();
    const tree = await open(navigation);
    fireEvent.press(tree.getByText("Offensive name"));
    fireEvent.changeText(tree.getByLabelText("Anything to add, optional"), "  On the leaderboard  ");
    fireEvent.press(tree.getByText("Send report"));
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(mockPost).toHaveBeenCalledWith("/api/reports/user", { reportedClerkUserId: "u_ana", reason: "offensive_name", details: "On the leaderboard" });
    expect(mockToast).toHaveBeenCalledWith("Report sent. The admins will look at it.", { type: "success" });
  });

  it("a report already waiting goes back with the server's word for it", async () => {
    mockPost.mockRejectedValue({ response: { status: 409, data: { message: "You've already reported this traveler." } } });
    const navigation = nav();
    const tree = await open(navigation);
    fireEvent.press(tree.getByText("Harassment or bullying"));
    fireEvent.press(tree.getByText("Send report"));
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(mockToast).toHaveBeenCalledWith("You've already reported this traveler.", { type: "info" });
  });
});
