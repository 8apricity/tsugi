import {
  createDailyPlanCache,
  type DailyPlanForCache,
  type FetchDailyPlans,
} from "./dailyPlanCache";
import {
  buildDateStrip,
  formatCurrentJstSchoolDate,
  shiftSchoolDate,
} from "./dailyPlanView";

export type DailyPlanClientState =
  | { status: "loading" }
  | { status: "ready"; dailyPlan: DailyPlanForCache }
  | { status: "affiliation-renewal-needed"; schoolYear: number }
  | { status: "unauthenticated" }
  | { status: "error" };

export type DailyPlanClientSnapshot = {
  selectedSchoolDate: string;
  currentSchoolDate: string;
  dateStrip: ReturnType<typeof buildDateStrip>;
  dailyPlanState: DailyPlanClientState;
};

export function createDailyPlanClient({
  initialSchoolDate = formatCurrentJstSchoolDate(),
  currentSchoolDate = formatCurrentJstSchoolDate,
  datePickerRadius = 180,
  cacheRadius = 7,
  fetchDailyPlans,
}: {
  initialSchoolDate?: string;
  currentSchoolDate?: () => string;
  datePickerRadius?: number;
  cacheRadius?: number;
  fetchDailyPlans: FetchDailyPlans;
}) {
  const listeners = new Set<() => void>();
  let cache = createCache();
  let loadGeneration = 0;
  let snapshot: DailyPlanClientSnapshot = {
    selectedSchoolDate: initialSchoolDate,
    currentSchoolDate: currentSchoolDate(),
    dateStrip: buildDateStrip(initialSchoolDate, datePickerRadius),
    dailyPlanState: { status: "loading" },
  };

  function createCache() {
    return createDailyPlanCache({
      fetchDailyPlans,
      radius: cacheRadius,
    });
  }

  function update(next: Partial<DailyPlanClientSnapshot>) {
    snapshot = { ...snapshot, ...next };
    listeners.forEach((listener) => listener());
  }

  function selectSchoolDate(schoolDate: string) {
    update({
      selectedSchoolDate: schoolDate,
      currentSchoolDate: currentSchoolDate(),
      dailyPlanState: { status: "loading" },
      dateStrip: snapshot.dateStrip.some(
        (date) => date.schoolDate === schoolDate,
      )
        ? snapshot.dateStrip
        : buildDateStrip(schoolDate, datePickerRadius),
    });

    return loadSelectedDailyPlan();
  }

  function shiftSelectedSchoolDate(days: number) {
    return selectSchoolDate(
      shiftSchoolDate(snapshot.selectedSchoolDate, days),
    );
  }

  function isCurrentLoad(generation: number, schoolDate: string) {
    return (
      generation === loadGeneration &&
      schoolDate === snapshot.selectedSchoolDate
    );
  }

  async function loadSelectedDailyPlan() {
    const generation = ++loadGeneration;
    const schoolDate = snapshot.selectedSchoolDate;
    const cachedDailyPlan = cache.getCachedDailyPlan(schoolDate);

    update({
      dailyPlanState: cachedDailyPlan
        ? { status: "ready", dailyPlan: cachedDailyPlan }
        : { status: "loading" },
    });

    try {
      const result = await cache.getDailyPlan(schoolDate);

      if (!isCurrentLoad(generation, schoolDate)) {
        return snapshot.dailyPlanState;
      }

      if (result.status === "unauthenticated") {
        const state = { status: "unauthenticated" } as const;
        update({ dailyPlanState: state });
        return state;
      }

      if (result.status === "affiliation-renewal-needed") {
        const state = {
          status: "affiliation-renewal-needed",
          schoolYear: result.schoolYear,
        } as const;
        update({ dailyPlanState: state });
        return state;
      }

      if (result.status !== "ready") {
        const state = { status: "error" } as const;
        update({ dailyPlanState: state });
        return state;
      }

      const state = { status: "ready", dailyPlan: result } as const;
      update({ dailyPlanState: state });
      void cache.prefetchNearLoadedEdge(schoolDate).catch(() => undefined);
      return state;
    } catch {
      if (!isCurrentLoad(generation, schoolDate)) {
        return snapshot.dailyPlanState;
      }

      const state = { status: "error" } as const;
      update({ dailyPlanState: state });
      return state;
    }
  }

  function reload() {
    loadGeneration += 1;
    cache = createCache();
    update({ dailyPlanState: { status: "loading" } });
    return loadSelectedDailyPlan();
  }

  function reset() {
    loadGeneration += 1;
    cache = createCache();
    update({
      currentSchoolDate: currentSchoolDate(),
      dailyPlanState: { status: "loading" },
    });
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    selectSchoolDate,
    shiftSelectedSchoolDate,
    loadSelectedDailyPlan,
    reload,
    reset,
  };
}
