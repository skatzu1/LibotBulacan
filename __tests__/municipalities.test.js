import { BULACAN_MUNICIPALITIES, municipalityError } from "../utils/municipalities";

// The sign-up form's list; Malolos, the capital, was missing from the old
// welcome screen's own copy.
describe("Bulacan municipalities", () => {
  it("has all 24, Malolos included", () => {
    expect(BULACAN_MUNICIPALITIES).toHaveLength(24);
    expect(BULACAN_MUNICIPALITIES).toContain("Malolos");
  });

  it("requires a name from the list", () => {
    expect(municipalityError("Malolos")).toBeNull();
    expect(municipalityError("")).toMatch(/municipality/);
  });
});
