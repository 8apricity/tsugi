import { describe, expect, it, vi } from "vitest";
import { createDailyPlanClient } from "./dailyPlanClient";
import type { DailyPlanForCache } from "./dailyPlanCache";

function dailyPlan(schoolDate: string): DailyPlanForCache {
  return {
    status: "ready",
    schoolDate,
    weekday: 5,
    studentAffiliation: {
      schoolYear: 2026,
      grade: 2,
      classId: "class-1",
      classNumber: 3,
      trackId: "track-1",
      trackName: "文科",
    },
    schoolYearRange: {
      startsOn: "2026-04-01",
      endsOn: "2027-03-31",
    },
    periods: [],
    tasks: [],
    notes: [],
  };
}

describe("Daily Plan client module", () => {
  it("selects a School Date and loads its Daily Plan through one interface", async () => {
    const fetchDailyPlans = vi.fn(async (start: string, end: string) => ({
      status: "ready" as const,
      dailyPlans: Object.fromEntries(
        ["2026-07-09", "2026-07-10", "2026-07-11"]
          .filter((schoolDate) => schoolDate >= start && schoolDate <= end)
          .map((schoolDate) => [schoolDate, dailyPlan(schoolDate)]),
      ),
    }));
    const client = createDailyPlanClient({
      initialSchoolDate: "2026-07-10",
      currentSchoolDate: () => "2026-07-10",
      datePickerRadius: 2,
      cacheRadius: 1,
      fetchDailyPlans,
    });

    const load = client.selectSchoolDate("2026-07-11");
    expect(client.getSnapshot()).toMatchObject({
      selectedSchoolDate: "2026-07-11",
      currentSchoolDate: "2026-07-10",
      dailyPlanState: { status: "loading" },
    });
    expect(
      client.getSnapshot().dateStrip.map(({ schoolDate }) => schoolDate),
    ).toEqual([
      "2026-07-08",
      "2026-07-09",
      "2026-07-10",
      "2026-07-11",
      "2026-07-12",
    ]);

    await expect(load).resolves.toMatchObject({
      status: "ready",
      dailyPlan: { schoolDate: "2026-07-11" },
    });
    expect(fetchDailyPlans).toHaveBeenCalledWith("2026-07-10", "2026-07-12");
  });

  it("reuses the memory cache until reload resets it", async () => {
    const fetchDailyPlans = vi.fn(async (start: string, end: string) => {
      const dailyPlans: Record<string, DailyPlanForCache> = {};

      if (start === "2026-07-10" && end === "2026-07-10") {
        dailyPlans["2026-07-10"] = dailyPlan("2026-07-10");
      }

      return { status: "ready" as const, dailyPlans };
    });
    const client = createDailyPlanClient({
      initialSchoolDate: "2026-07-10",
      currentSchoolDate: () => "2026-07-10",
      cacheRadius: 0,
      fetchDailyPlans,
    });

    await client.loadSelectedDailyPlan();
    await client.loadSelectedDailyPlan();
    expect(
      fetchDailyPlans.mock.calls.filter(
        ([start, end]) => start === "2026-07-10" && end === "2026-07-10",
      ),
    ).toHaveLength(1);

    await client.reload();
    expect(
      fetchDailyPlans.mock.calls.filter(
        ([start, end]) => start === "2026-07-10" && end === "2026-07-10",
      ),
    ).toHaveLength(2);
  });

  it("ignores an older Daily Plan response after the selected School Date changes", async () => {
    const firstRequest = deferred<ReturnType<typeof readyResult>>();
    const secondRequest = deferred<ReturnType<typeof readyResult>>();
    let requestNumber = 0;
    const fetchDailyPlans = vi.fn(() => {
      requestNumber += 1;

      if (requestNumber === 1) {
        return firstRequest.promise;
      }

      if (requestNumber === 2) {
        return secondRequest.promise;
      }

      return Promise.resolve(readyResult());
    });
    const client = createDailyPlanClient({
      initialSchoolDate: "2026-07-10",
      currentSchoolDate: () => "2026-07-10",
      cacheRadius: 0,
      fetchDailyPlans,
    });

    const firstLoad = client.loadSelectedDailyPlan();
    const secondLoad = client.selectSchoolDate("2026-07-11");

    secondRequest.resolve(readyResult("2026-07-11"));
    await secondLoad;
    firstRequest.resolve(readyResult("2026-07-10"));
    await firstLoad;

    expect(client.getSnapshot()).toMatchObject({
      selectedSchoolDate: "2026-07-11",
      dailyPlanState: {
        status: "ready",
        dailyPlan: { schoolDate: "2026-07-11" },
      },
    });
  });

  it("exposes Affiliation Renewal through the client state", async () => {
    const client = createDailyPlanClient({
      initialSchoolDate: "2026-07-10",
      fetchDailyPlans: async () => ({
        status: "affiliation-renewal-needed",
        schoolYear: 2026,
      }),
    });

    await expect(client.loadSelectedDailyPlan()).resolves.toEqual({
      status: "affiliation-renewal-needed",
      schoolYear: 2026,
    });
    expect(client.getSnapshot().dailyPlanState).toEqual({
      status: "affiliation-renewal-needed",
      schoolYear: 2026,
    });
  });

  it("exposes a retryable error when loading fails", async () => {
    const client = createDailyPlanClient({
      initialSchoolDate: "2026-07-10",
      fetchDailyPlans: async () => {
        throw new Error("network unavailable");
      },
    });

    await expect(client.loadSelectedDailyPlan()).resolves.toEqual({
      status: "error",
    });
    expect(client.getSnapshot().dailyPlanState).toEqual({ status: "error" });
  });

  it("exposes an expired Student Session when reload is unauthenticated", async () => {
    let selectedDateRequests = 0;
    const client = createDailyPlanClient({
      initialSchoolDate: "2026-07-10",
      cacheRadius: 0,
      fetchDailyPlans: async (start, end) => {
        if (start !== "2026-07-10" || end !== "2026-07-10") {
          return readyResult();
        }

        selectedDateRequests += 1;
        return selectedDateRequests === 1
          ? readyResult("2026-07-10")
          : { status: "unauthenticated" as const };
      },
    });

    await client.loadSelectedDailyPlan();
    await expect(client.reload()).resolves.toEqual({
      status: "unauthenticated",
    });
    expect(client.getSnapshot().dailyPlanState).toEqual({
      status: "unauthenticated",
    });
  });

  it("selects tomorrow after the last lesson and exposes only the School Year", async () => {
    const fetchDailyPlans = vi.fn(async (start: string, end: string) => ({
      status: "ready" as const,
      dailyPlans: Object.fromEntries(
        ["2026-07-10", "2026-07-11"]
          .filter((date) => start <= date && date <= end)
          .map((date) => [
            date,
            {
              ...dailyPlan(date),
              periods: [
                { periodNumber: 1, lessonName: "数学", hasTasks: false, notes: [] },
                { periodNumber: 2, lessonName: "", hasTasks: false, notes: [] },
              ],
              schoolYearRange: {
                startsOn: "2026-07-09",
                endsOn: "2026-07-12",
              },
            },
          ]),
      ),
    }));
    const client = createDailyPlanClient({
      initialSchoolDate: "2026-07-10",
      currentSchoolDate: () => "2026-07-10",
      now: () => new Date("2026-07-10T00:10:00.000Z"),
      cacheRadius: 1,
      fetchDailyPlans,
    });

    await client.loadSelectedDailyPlan();

    expect(client.getSnapshot().selectedSchoolDate).toBe("2026-07-11");
    expect(
      client.getSnapshot().dateStrip.map(({ schoolDate }) => schoolDate),
    ).toEqual(["2026-07-09", "2026-07-10", "2026-07-11", "2026-07-12"]);
  });

  it("reset restores today's initial Daily Plan selection", async () => {
    const client = createDailyPlanClient({
      initialSchoolDate: "2026-07-10",
      currentSchoolDate: () => "2026-07-10",
      fetchDailyPlans: async () => readyResult("2026-07-10"),
    });

    await client.selectSchoolDate("2026-07-12");
    client.reset();

    expect(client.getSnapshot().selectedSchoolDate).toBe("2026-07-10");
  });

  it("does not select a date outside the School Year", async () => {
    const client = createDailyPlanClient({
      initialSchoolDate: "2026-07-10",
      currentSchoolDate: () => "2026-07-10",
      fetchDailyPlans: async () => ({
        status: "ready",
        dailyPlans: {
          "2026-07-10": {
            ...dailyPlan("2026-07-10"),
            schoolYearRange: {
              startsOn: "2026-07-09",
              endsOn: "2026-07-10",
            },
          },
        },
      }),
    });

    await client.loadSelectedDailyPlan();
    await client.shiftSelectedSchoolDate(1);

    expect(client.getSnapshot().selectedSchoolDate).toBe("2026-07-10");
  });

  it("bounds the initial selection after the School Year range loads", async () => {
    const fetchDailyPlans = vi.fn(async (start: string, end: string) => {
      const requestedDate = start === end ? start : "2026-03-31";
      const plan = dailyPlan(requestedDate);

      return {
        status: "ready" as const,
        dailyPlans: {
          [requestedDate]: {
            ...plan,
            schoolYearRange: {
              startsOn: "2026-04-01",
              endsOn: "2027-03-31",
            },
          },
          "2026-04-01": {
            ...dailyPlan("2026-04-01"),
            schoolYearRange: {
              startsOn: "2026-04-01",
              endsOn: "2027-03-31",
            },
          },
        },
      };
    });
    const client = createDailyPlanClient({
      initialSchoolDate: "2026-03-31",
      currentSchoolDate: () => "2026-03-31",
      cacheRadius: 0,
      fetchDailyPlans,
    });

    await client.loadSelectedDailyPlan();

    expect(client.getSnapshot().selectedSchoolDate).toBe("2026-04-01");
    expect(client.getSnapshot().dailyPlanState).toMatchObject({
      status: "ready",
      dailyPlan: { schoolDate: "2026-04-01" },
    });
  });
});

function readyResult(schoolDate?: string) {
  return {
    status: "ready" as const,
    dailyPlans: schoolDate ? { [schoolDate]: dailyPlan(schoolDate) } : {},
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}
