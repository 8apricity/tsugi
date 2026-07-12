import { shiftSchoolDate } from "./dailyPlanView";

export type CachedTimetableLayerState = {
  status: "ready";
  schoolDate: string;
  periodNumber: number;
};

type DateRange = { startDate: string; endDate: string };

export class TimetableLayerMemoryCache<
  State extends CachedTimetableLayerState = CachedTimetableLayerState,
> {
  private readonly states = new Map<string, State>();

  get size() {
    return this.states.size;
  }

  get(schoolDate: string, periodNumber: number) {
    return this.states.get(cacheKey(schoolDate, periodNumber));
  }

  store(states: readonly State[]) {
    for (const state of states) {
      this.states.set(cacheKey(state.schoolDate, state.periodNumber), state);
    }
  }

  clear() {
    this.states.clear();
  }

  selectWindow(
    selectedDate: string,
    minimumDate: string,
    maximumDate: string,
  ): DateRange & { missingRanges: DateRange[] } {
    const startDate = maxDate(shiftSchoolDate(selectedDate, -2), minimumDate);
    const endDate = minDate(shiftSchoolDate(selectedDate, 2), maximumDate);

    for (const [key, state] of this.states) {
      if (state.schoolDate < startDate || state.schoolDate > endDate) {
        this.states.delete(key);
      }
    }

    const missingDates = listDates(startDate, endDate).filter((schoolDate) =>
      Array.from({ length: 7 }, (_, index) => index + 1).some(
        (periodNumber) => !this.get(schoolDate, periodNumber),
      ),
    );

    return {
      startDate,
      endDate,
      missingRanges: groupContiguousDates(missingDates),
    };
  }
}

function cacheKey(schoolDate: string, periodNumber: number) {
  return `${schoolDate}:${periodNumber}`;
}

function maxDate(left: string, right: string) {
  return left > right ? left : right;
}

function minDate(left: string, right: string) {
  return left < right ? left : right;
}

function listDates(startDate: string, endDate: string) {
  const dates: string[] = [];
  for (
    let date = startDate;
    date <= endDate;
    date = shiftSchoolDate(date, 1)
  ) {
    dates.push(date);
  }
  return dates;
}

function groupContiguousDates(dates: readonly string[]) {
  const ranges: DateRange[] = [];
  for (const date of dates) {
    const last = ranges.at(-1);
    if (last && shiftSchoolDate(last.endDate, 1) === date) {
      last.endDate = date;
    } else {
      ranges.push({ startDate: date, endDate: date });
    }
  }
  return ranges;
}
