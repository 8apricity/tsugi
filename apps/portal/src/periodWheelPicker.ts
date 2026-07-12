export type PeriodCenter = {
  periodNumber: number;
  center: number;
};

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
