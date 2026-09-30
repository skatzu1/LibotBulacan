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
