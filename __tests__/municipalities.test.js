import { BULACAN_MUNICIPALITIES, normalizeMunicipality, municipalityError } from "../utils/municipalities";

// The welcome screen and sign-up share this list; Malolos, the capital, was
// missing from the welcome screen's own copy.
describe("Bulacan municipalities", () => {
  it("has all 24, Malolos included", () => {
    expect(BULACAN_MUNICIPALITIES).toHaveLength(24);
    expect(BULACAN_MUNICIPALITIES).toContain("Malolos");
  });

  it("reads the spellings older builds saved", () => {
    expect(normalizeMunicipality("Baliuag")).toBe("Baliwag");
    expect(normalizeMunicipality("Meycauayan City")).toBe("Meycauayan");
    expect(normalizeMunicipality("San Jose del Monte City")).toBe("San Jose del Monte");
    expect(normalizeMunicipality("I don't live in Bulacan")).toBe("");
    expect(normalizeMunicipality(null)).toBe("");
  });

  it("requires a name from the list", () => {
    expect(municipalityError("Malolos")).toBeNull();
    expect(municipalityError("")).toMatch(/municipality/);
  });
});
