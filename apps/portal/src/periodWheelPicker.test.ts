import { describe, expect, it } from "vitest";
import { findPeriodClosestToCenter } from "./periodWheelPicker";

describe("findPeriodClosestToCenter", () => {
  it("selects the center row instead of the first visible row", () => {
    expect(
      findPeriodClosestToCenter(95, [
        { periodNumber: 3, center: 19 },
        { periodNumber: 4, center: 57 },
        { periodNumber: 5, center: 95 },
        { periodNumber: 6, center: 133 },
        { periodNumber: 7, center: 171 },
      ]),
    ).toBe(5);
  });

  it("returns null when no period rows exist", () => {
    expect(findPeriodClosestToCenter(95, [])).toBeNull();
  });
});
