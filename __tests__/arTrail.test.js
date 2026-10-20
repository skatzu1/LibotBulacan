import { resolveTrail, triviaForModel } from "../utils/arTrail";

describe("triviaForModel", () => {
  const facts = ["first", "second", "third"];

  it("gives model n fact n, in the moderator's order", () => {
    expect(triviaForModel(facts, 0)).toBe("first");
    expect(triviaForModel(facts, 1)).toBe("second");
    expect(triviaForModel(facts, 2)).toBe("third");
  });

  it("wraps when a spot has more models than facts", () => {
    expect(triviaForModel(facts, 3)).toBe("first");
    expect(triviaForModel(facts, 4)).toBe("second");
  });

  it("shows only one fact even when there are more facts than models", () => {
    expect(triviaForModel(["a", "b", "c", "d", "e"], 0)).toBe("a");
  });

  it("falls back to a generic line when the spot has no trivia", () => {
    expect(triviaForModel([], 0, "Barasoain Church")).toBe(
      "Barasoain Church is a remarkable place worth exploring!"
    );
    expect(triviaForModel(undefined, 2)).toBe("This spot is a remarkable place worth exploring!");
  });

  it("skips blank entries instead of showing an empty card", () => {
    expect(triviaForModel(["", "  ", "real fact"], 0)).toBe("real fact");
  });

  it("treats a missing or invalid index as the first model", () => {
    expect(triviaForModel(facts, undefined)).toBe("first");
    expect(triviaForModel(facts, -1)).toBe("first");
  });
});

describe("resolveTrail", () => {
  const anchor = (index, isInRange) => ({ index, label: `Model ${index + 1}`, distance: 10, radius: 20, isInRange });

  it("walks the trail in index order and holds the next model back while a trivia card is open", () => {
    const anchors = [anchor(1, true), anchor(0, true)];
    expect(resolveTrail(anchors, new Set(), false).focus.index).toBe(0);
    expect(resolveTrail(anchors, new Set([0]), false).focus.index).toBe(1);
    expect(resolveTrail(anchors, new Set([0]), true).focus).toBeNull();
  });
});

// Each AR position's own fact (the thesis panel, 2026-10-21: the fact should
// be about the place the model stands at).
describe("factForModel / placeName", () => {
  const { factForModel, placeName } = require("../utils/arTrail");
  const spot = {
    name: "Barasoain Church",
    trivia: ["list fact 1", "list fact 2"],
    modelsCoordinates: [
      { label: "Bell tower", trivia: "The bell tower fact." },
      { label: "Model" },
      { label: "Facade", trivia: "  " },
    ],
  };

  it("shows the position's own fact, else the list's fact for that model", () => {
    expect(factForModel(spot, 0)).toBe("The bell tower fact.");
    expect(factForModel(spot, 1)).toBe("list fact 2");
    expect(factForModel(spot, 2)).toBe("list fact 1"); // blank own fact: the list, wrapping
    expect(factForModel({ name: "X", modelsCoordinates: [{}] }, 0)).toBe("X is a remarkable place worth exploring!");
  });

  it("names the place, but not the old placeholder", () => {
    expect(placeName("Bell tower")).toBe("Bell tower");
    expect(placeName("Model")).toBeNull();
    expect(placeName("Model 3")).toBeNull();
    expect(placeName("  ")).toBeNull();
    expect(placeName(undefined)).toBeNull();
  });
});
