export type PeriodCenter = {
  periodNumber: number;
  center: number;
};

export type PeriodWheelAction =
  | "stay-open"
  | "wait-for-scroll-settle"
  | "close-after-delay"
  | "wait-for-animation"
  | "close-now";

export class PeriodWheelInteraction {
  private touching = false;
  private waitingForAnimation = false;
  private optionSelectionSuppressed = false;

  beginContact() {
    this.touching = true;
    this.waitingForAnimation = false;
  }

  beginTriggerContact() {
    this.beginContact();
    this.optionSelectionSuppressed = true;
  }

  allowOptionSelection() {
    this.optionSelectionSuppressed = false;
  }

  isWaitingForAnimation() {
    return this.waitingForAnimation;
  }

  endContact(moved: boolean): PeriodWheelAction {
    this.touching = false;
    return moved ? "wait-for-scroll-settle" : "stay-open";
  }

  scrollSettled(): PeriodWheelAction {
    if (this.touching) return "stay-open";
    if (this.waitingForAnimation) return "close-now";
    return "close-after-delay";
  }

  selectOption(animationNeeded: boolean): PeriodWheelAction {
    if (this.optionSelectionSuppressed) return "stay-open";
    this.touching = false;
    this.waitingForAnimation = animationNeeded;
    return animationNeeded ? "wait-for-animation" : "close-now";
  }

}

export function findPeriodClosestToCenter(
  pickerCenter: number,
  periods: readonly PeriodCenter[],
) {
  if (periods.length === 0) return null;

  return periods.reduce((closest, period) =>
    Math.abs(period.center - pickerCenter) <
    Math.abs(closest.center - pickerCenter)
      ? period
      : closest,
  ).periodNumber;
}
