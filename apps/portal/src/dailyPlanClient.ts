import {
  createDailyPlanCache,
  type DailyPlanForCache,
  type FetchDailyPlans,
  type SchoolYearRange,
} from "./dailyPlanCache";
import {
  buildDateStrip,
  buildSchoolYearDateStrip,
  formatCurrentJstSchoolDate,
  isAfterLastDailyLesson,
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
  schoolYearRange: SchoolYearRange | null;
  dateStrip: ReturnType<typeof buildDateStrip>;
  dailyPlanState: DailyPlanClientState;
};

export function createDailyPlanClient({
  initialSchoolDate,
  currentSchoolDate = formatCurrentJstSchoolDate,
  now = () => new Date(),
  datePickerRadius = 180,
  cacheRadius = 7,
  fetchDailyPlans,
}: {
  initialSchoolDate?: string;
  currentSchoolDate?: () => string;
  now?: () => Date;
  datePickerRadius?: number;
  cacheRadius?: number;
  fetchDailyPlans: FetchDailyPlans;
}) {
  const listeners = new Set<() => void>();
  const resolvedInitialSchoolDate = initialSchoolDate ?? currentSchoolDate();
  let cache = createCache();
  let loadGeneration = 0;
  let shouldResolveInitialSchoolDate = true;
  let schoolYearRange: SchoolYearRange | null = null;
  let snapshot: DailyPlanClientSnapshot = {
    selectedSchoolDate: resolvedInitialSchoolDate,
    currentSchoolDate: currentSchoolDate(),
    schoolYearRange: null,
    dateStrip: buildDateStrip(resolvedInitialSchoolDate, datePickerRadius),
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
    if (
      schoolYearRange &&
      (schoolDate < schoolYearRange.startsOn || schoolDate > schoolYearRange.endsOn)
    ) {
      return Promise.resolve(snapshot.dailyPlanState);
    }

    shouldResolveInitialSchoolDate = false;
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

      schoolYearRange = result.schoolYearRange;
      const dateStrip = buildSchoolYearDateStrip(
        schoolYearRange.startsOn,
        schoolYearRange.endsOn,
      );
      const boundedSchoolDate = boundSchoolDateToRange(
        schoolDate,
        schoolYearRange,
      );

      if (boundedSchoolDate !== schoolDate) {
        update({
          selectedSchoolDate: boundedSchoolDate,
          schoolYearRange,
          dateStrip,
          dailyPlanState: { status: "loading" },
        });
        return loadSelectedDailyPlan();
      }

      if (
        shouldResolveInitialSchoolDate &&
        schoolDate === snapshot.currentSchoolDate
      ) {
        shouldResolveInitialSchoolDate = false;
        const targetSchoolDate = isAfterLastDailyLesson(now(), result.periods)
          ? shiftSchoolDate(snapshot.currentSchoolDate, 1)
          : snapshot.currentSchoolDate;
        const boundedTargetSchoolDate = boundSchoolDateToRange(
          targetSchoolDate,
          schoolYearRange,
        );

        if (boundedTargetSchoolDate !== schoolDate) {
          update({
            selectedSchoolDate: boundedTargetSchoolDate,
            schoolYearRange,
            dateStrip,
            dailyPlanState: { status: "loading" },
          });
          return loadSelectedDailyPlan();
        }
      }
      shouldResolveInitialSchoolDate = false;

      const state = { status: "ready", dailyPlan: result } as const;
      update({ dailyPlanState: state, schoolYearRange, dateStrip });
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
    schoolYearRange = null;
    shouldResolveInitialSchoolDate = true;
    const nextCurrentSchoolDate = currentSchoolDate();
    update({
      selectedSchoolDate: nextCurrentSchoolDate,
      currentSchoolDate: nextCurrentSchoolDate,
      schoolYearRange: null,
      dateStrip: buildDateStrip(nextCurrentSchoolDate, datePickerRadius),
      dailyPlanState: { status: "loading" },
    });
  }

  return {
    getCachedDailyPlans: () => cache.getCachedDailyPlans(),
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

function boundSchoolDateToRange(
  schoolDate: string,
  schoolYearRange: SchoolYearRange,
) {
  if (schoolDate < schoolYearRange.startsOn) {
    return schoolYearRange.startsOn;
  }

  if (schoolDate > schoolYearRange.endsOn) {
    return schoolYearRange.endsOn;
  }

  return schoolDate;
}
