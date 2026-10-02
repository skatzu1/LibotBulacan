import {
  cleanName, nameError, NAME_MAX,
  cleanEmail, isValidEmail, emailError,
  digitsOnly, dobError, MIN_AGE,
  NETWORK_ERROR, GOOGLE_BUSY, googleWindowBusy, googleWindowClosed, googleErrorMessage,
} from "../utils/authValidation";

describe("names", () => {
  it("drops digits and symbols as they are typed or pasted", () => {
    expect(cleanName("Juan123 Dela Cruz")).toBe("Juan Dela Cruz");
    expect(cleanName("Maria@#$ Santos!")).toBe("Maria Santos");
    expect(cleanName("😀Ana")).toBe("Ana");
  });

  it("keeps the letters and punctuation real names use", () => {
    expect(cleanName("José Ñoño")).toBe("José Ñoño");
    expect(cleanName("Mary-Ann D'Angelo")).toBe("Mary-Ann D'Angelo");
    expect(cleanName("Ma. Clara Jr.")).toBe("Ma. Clara Jr.");
  });

  it("turns curly apostrophes into straight ones and tidies spaces", () => {
    expect(cleanName("O’Brien")).toBe("O'Brien");
    expect(cleanName("  Juan    Luna")).toBe("Juan Luna");
    expect(cleanName("Juan ")).toBe("Juan "); // the space before the next name survives typing
  });

  it("caps the length", () => {
    expect(cleanName("a".repeat(80))).toHaveLength(NAME_MAX);
  });

  it("explains what is wrong", () => {
    expect(nameError("")).toBe("Enter your full name.");
    expect(nameError("  ", "your first name")).toBe("Enter your first name.");
    expect(nameError("Juan 3")).toMatch(/letters only/);
    expect(nameError("-Juan")).toBe("Start with a letter.");
    expect(nameError("J")).toBe("Use at least 2 letters.");
    expect(nameError("Juan Dela Cruz")).toBeNull();
    expect(nameError("Ñiño")).toBeNull();
  });
});

describe("email", () => {
  it("drops whitespace", () => {
    expect(cleanEmail(" juan @gmail.com ")).toBe("juan@gmail.com");
  });

  it("accepts ordinary addresses", () => {
    for (const ok of ["juan@gmail.com", "juan.dela-cruz+libot@school.edu.ph", "a_b@sub.domain.co"]) {
      expect(isValidEmail(ok)).toBe(true);
    }
  });

  it("rejects addresses that can't receive mail", () => {
    for (const bad of ["juan@gmail", "juan@gmail.c", "juan..luna@gmail.com", ".juan@gmail.com", "juan@-gmail.com", "juan@gmail.com.", "juan@@gmail.com", "juan gmail.com"]) {
      expect(isValidEmail(bad)).toBe(false);
    }
    expect(emailError("juan@gmail")).toMatch(/valid email/);
  });
});

it("codes keep digits only", () => {
  expect(digitsOnly("12a3-45 6")).toBe("123456");
});

describe("date of birth", () => {
  const today = new Date(2026, 9, 1); // 1 Oct 2026

  it("checks the date is real and in the past", () => {
    expect(dobError("", today)).toBe("Enter your date of birth.");
    expect(dobError("02/3", today)).toBe("Finish the date as MM/DD/YYYY.");
    expect(dobError("02/30/2000", today)).toMatch(/doesn't exist/);
    expect(dobError("13/01/2000", today)).toMatch(/doesn't exist/);
    expect(dobError("01/01/1899", today)).toBe("Check the year.");
    expect(dobError("01/01/2027", today)).toMatch(/future/);
  });

  it(`requires an age of at least ${MIN_AGE}`, () => {
    expect(dobError("10/01/2013", today)).toBeNull();          // 13 today
    expect(dobError("10/02/2013", today)).toMatch(/at least 13/); // 13 tomorrow
    expect(dobError("06/15/2015", today)).toMatch(/at least 13/);
    expect(dobError("02/29/2004", today)).toBeNull();
  });
});

// The results and messages below are the ones expo-web-browser 15 actually
// produces (build/WebBrowser.js), not invented ones.
describe("Google window", () => {
  it("treats the back button / X / swipe as closed, not as success", () => {
    expect(googleWindowClosed({ type: "dismiss" })).toBe(true); // Android back button
    expect(googleWindowClosed({ type: "cancel" })).toBe(true);  // iOS sheet closed
    expect(googleWindowClosed({ type: "success", url: "x://cb" })).toBe(false);
  });

  it("spots a window that is already open", () => {
    expect(googleWindowBusy({ type: "locked" })).toBe(true);
    expect(googleWindowBusy({ type: "dismiss" })).toBe(false);
    expect(googleErrorMessage(new Error("WebBrowser is already open, only one can be open at a time"))).toBe(GOOGLE_BUSY);
    expect(googleErrorMessage(new Error("The WebBrowser's auth session is in an invalid state with a redirect handler set when it should not be"))).toBe(GOOGLE_BUSY);
  });

  it("says offline when nothing reached Clerk", () => {
    expect(googleErrorMessage(new TypeError("Network request failed"))).toBe(NETWORK_ERROR);
  });

  it("says rate limited for Clerk's throttle", () => {
    expect(googleErrorMessage({ errors: [{ code: "too_many_requests" }] })).toMatch(/Too many attempts/);
  });

  it("falls back to a plain message naming the action", () => {
    expect(googleErrorMessage(new Error("No session returned from Google OAuth"), "sign up"))
      .toBe("Couldn't sign up with Google. Please try again.");
    expect(googleErrorMessage({ errors: [{ code: "oauth_access_denied" }] }))
      .toBe("Couldn't sign in with Google. Please try again.");
  });
});
