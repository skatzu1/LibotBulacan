import { arrivalNoticeContent } from "../utils/arrivalNotice";

// Spots 29–75 m apart share arrival circles; their arrivals share one
// notification instead of two or three at once.
describe("arrivalNoticeContent", () => {
  const church = { spotId: "a", spotName: "San Isidro Labrador", isFirstVisit: true };
  const museum = { spotId: "b", spotName: "Museo San Ysidro", isFirstVisit: false };
  const fest   = { spotId: "c", spotName: "Kneeling Carabao Festival", isFirstVisit: false };

  it("keeps the single-spot wording", () => {
    expect(arrivalNoticeContent([church])).toEqual({
      title: "You arrived!",
      body: "You've reached San Isidro Labrador! Open Libot Bulacan to claim your badge.",
      data: { spotId: "a", spotName: "San Isidro Labrador", isFirstVisit: true },
    });
    expect(arrivalNoticeContent([museum]).title).toBe("Welcome back!");
  });

  it("names every spot in one notification, and opens the first on a tap", () => {
    const n = arrivalNoticeContent([church, museum, fest]);
    expect(n.title).toBe("You arrived at 3 spots!");
    expect(n.body).toBe(
      "You've reached San Isidro Labrador, Museo San Ysidro and Kneeling Carabao Festival! Open Libot Bulacan to claim your badges."
    );
    expect(n.data).toEqual({
      spotId: "a", spotName: "San Isidro Labrador", isFirstVisit: true, spotIds: ["a", "b", "c"],
    });
  });

  it("is a welcome back when every spot was visited before", () => {
    const n = arrivalNoticeContent([museum, fest]);
    expect(n.title).toBe("Welcome back!");
    expect(n.body).toBe("You've arrived at Museo San Ysidro and Kneeling Carabao Festival. Open Libot Bulacan to explore!");
  });
});
