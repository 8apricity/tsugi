import { describe, expect, it } from "vitest";
import {
  TimetableLayerMemoryCache,
  type CachedTimetableLayerState,
} from "./timetableLayerCache";

function state(
  schoolDate: string,
  periodNumber: number,
): CachedTimetableLayerState {
  return { status: "ready", schoolDate, periodNumber };
}

describe("TimetableLayerMemoryCache", () => {
  it("keeps the selected date plus two days either side and requests only missing dates", () => {
    const cache = new TimetableLayerMemoryCache();
    const firstWindow = cache.selectWindow(
      "2026-07-10",
      "2026-04-01",
      "2027-03-31",
    );
    expect(firstWindow).toEqual({
      startDate: "2026-07-08",
      endDate: "2026-07-12",
      missingRanges: [{ startDate: "2026-07-08", endDate: "2026-07-12" }],
    });

    cache.store(
      Array.from({ length: 5 }, (_, day) =>
        Array.from({ length: 7 }, (_, period) =>
          state(`2026-07-${String(day + 8).padStart(2, "0")}`, period + 1),
        ),
      ).flat(),
    );
    expect(cache.size).toBe(35);

    const movedWindow = cache.selectWindow(
      "2026-07-11",
      "2026-04-01",
      "2027-03-31",
    );
    expect(movedWindow.missingRanges).toEqual([
      { startDate: "2026-07-13", endDate: "2026-07-13" },
    ]);
    expect(cache.size).toBe(28);
    expect(cache.get("2026-07-09", 1)).toMatchObject({
      schoolDate: "2026-07-09",
      periodNumber: 1,
    });
    expect(cache.get("2026-07-08", 1)).toBeUndefined();
  });

  it("retains projected Layer state for dates with Timetable Change drafts", () => {
    const cache = new TimetableLayerMemoryCache();
    cache.store([state("2026-07-08", 1), state("2026-07-15", 1)]);

    cache.selectWindow(
      "2026-07-15",
      "2026-04-01",
      "2027-03-31",
      ["2026-07-08"],
    );

    expect(cache.get("2026-07-08", 1)).toEqual(state("2026-07-08", 1));
  });
});
