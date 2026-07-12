import { describe, expect, it } from "vitest";
import {
  PeriodWheelInteraction,
  findPeriodClosestToCenter,
} from "./periodWheelPicker";

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

describe("PeriodWheelInteraction", () => {
  it("never closes while touched and waits 400ms after released scrolling settles", () => {
    const interaction = new PeriodWheelInteraction();

    interaction.beginContact();
    expect(interaction.scrollSettled()).toBe("stay-open");
    expect(interaction.endContact(true)).toBe("wait-for-scroll-settle");
    expect(interaction.scrollSettled()).toBe("close-after-delay");
  });

  it("keeps a trigger tap open and closes an option tap after animation", () => {
    const interaction = new PeriodWheelInteraction();

    interaction.beginTriggerContact();
    expect(interaction.endContact(false)).toBe("stay-open");
    expect(interaction.selectOption(true)).toBe("stay-open");
    interaction.allowOptionSelection();
    expect(interaction.selectOption(true)).toBe("wait-for-animation");
    expect(interaction.isWaitingForAnimation()).toBe(true);
    expect(interaction.scrollSettled()).toBe("close-now");
  });
});
