import { describe, expect, it, vi } from "vitest";
import { createDailyPlanCache, type DailyPlanForCache } from "./dailyPlanCache";

function dailyPlan(schoolDate: string): DailyPlanForCache {
  return {
    status: "ready",
    schoolDate,
    weekday: 1,
    studentAffiliation: {
      schoolYear: 2026,
      grade: 2,
      classId: "class-1",
      classNumber: 3,
      trackId: "track-1",
      trackName: "文科",
    },
    periods: [],
    tasks: [],
    notes: [],
  };
}

describe("Daily Plan client cache", () => {
  it("serves a cached Daily Plan without fetching the same date again", async () => {
    const fetchDailyPlans = vi.fn(async () => ({
      status: "ready" as const,
      dailyPlans: {
        "2026-07-09": dailyPlan("2026-07-09"),
        "2026-07-10": dailyPlan("2026-07-10"),
        "2026-07-11": dailyPlan("2026-07-11"),
      },
    }));
    const cache = createDailyPlanCache({ fetchDailyPlans, radius: 1 });

    await expect(cache.getDailyPlan("2026-07-10")).resolves.toMatchObject({
      status: "ready",
      schoolDate: "2026-07-10",
    });
    await expect(cache.getDailyPlan("2026-07-11")).resolves.toMatchObject({
      status: "ready",
      schoolDate: "2026-07-11",
    });

    expect(fetchDailyPlans).toHaveBeenCalledTimes(1);
    expect(fetchDailyPlans).toHaveBeenCalledWith("2026-07-09", "2026-07-11");
  });

  it("prefetches the next range when the selected date approaches a loaded edge", async () => {
    const fetchDailyPlans = vi.fn(async (start: string, end: string) => ({
      status: "ready" as const,
      dailyPlans: Object.fromEntries(
        [
          "2026-07-09",
          "2026-07-10",
          "2026-07-11",
          "2026-07-12",
          "2026-07-13",
          "2026-07-14",
        ]
          .filter((schoolDate) => schoolDate >= start && schoolDate <= end)
          .map((schoolDate) => [schoolDate, dailyPlan(schoolDate)]),
      ),
    }));
    const cache = createDailyPlanCache({
      fetchDailyPlans,
      radius: 1,
      edgePrefetchThreshold: 1,
      edgePrefetchDays: 2,
    });

    await cache.getDailyPlan("2026-07-10");
    await cache.prefetchNearLoadedEdge("2026-07-11");

    expect(fetchDailyPlans).toHaveBeenCalledTimes(2);
    expect(fetchDailyPlans).toHaveBeenLastCalledWith(
      "2026-07-12",
      "2026-07-13",
    );
  });
});
