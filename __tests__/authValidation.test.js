import {
  cleanName, nameError, NAME_MAX,
  cleanEmail, isValidEmail, emailError,
  digitsOnly, dobError, MIN_AGE,
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
