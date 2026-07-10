import { shiftSchoolDate } from "./dailyPlanView";

export type DailyPlanForCache = {
  status: "ready";
  schoolDate: string;
  weekday: number;
  studentAffiliation: {
    schoolYear: number;
    grade: number;
    classId: string;
    classNumber: number;
    trackId: string;
    trackName: string;
  };
  periods: Array<{
    periodNumber: number;
    lessonName: string;
    hasTasks: boolean;
    notes: DailyPlanNoteForCache[];
  }>;
  tasks: DailyPlanTaskForCache[];
  notes: DailyPlanNoteForCache[];
};

export type DailyPlanTaskForCache = {
  taskId: string;
  title: string;
  dueDate?: string;
  dueLabel?: string;
  relatedLesson?: {
    schoolDate: string;
    periodNumber: number;
    lessonName: string;
  };
  relatedLessonName?: string;
  completed: false;
};

export type DailyPlanNoteForCache = {
  noteId: string;
  body: string;
  relatedContext:
    | {
        type: "daily-lesson";
        schoolDate: string;
        periodNumber: number;
      }
    | {
        type: "school-date";
        schoolDate: string;
      }
    | null;
};

type DailyPlansFetchResult =
  | {
      status: "ready";
      dailyPlans: Record<string, DailyPlanForCache>;
    }
  | { status: "unauthenticated" }
  | { status: "invalid-date" }
  | { status: "date-range-too-large" }
  | { status: "daily-plan-unavailable" }
  | { status: "affiliation-renewal-needed"; schoolYear: number };

export function createDailyPlanCache({
  fetchDailyPlans,
  radius,
  edgePrefetchThreshold = 5,
  edgePrefetchDays = 14,
}: {
  fetchDailyPlans: (
    start: string,
    end: string,
  ) => Promise<DailyPlansFetchResult>;
  radius: number;
  edgePrefetchThreshold?: number;
  edgePrefetchDays?: number;
}) {
  const dailyPlans = new Map<string, DailyPlanForCache>();
  const inFlightRanges = new Map<string, Promise<DailyPlansFetchResult>>();
  const loadedRanges: Array<{ start: string; end: string }> = [];

  async function getDailyPlan(schoolDate: string) {
    const cached = getCachedDailyPlan(schoolDate);

    if (cached) {
      return cached;
    }

    const result = await fetchRange(
      shiftSchoolDate(schoolDate, -radius),
      shiftSchoolDate(schoolDate, radius),
    );

    if (result.status !== "ready") {
      return result;
    }

    return dailyPlans.get(schoolDate) ?? { status: "daily-plan-unavailable" };
  }

  function getCachedDailyPlan(schoolDate: string) {
    return dailyPlans.get(schoolDate) ?? null;
  }

  async function fetchRange(start: string, end: string) {
    if (isRangeLoaded(start, end)) {
      return { status: "ready", dailyPlans: {} } as const;
    }

    const rangeKey = `${start}:${end}`;
    const existingRequest = inFlightRanges.get(rangeKey);

    if (existingRequest) {
      return existingRequest;
    }

    const request = fetchDailyPlans(start, end).then((result) => {
      if (result.status === "ready") {
        for (const plan of Object.values(result.dailyPlans)) {
          dailyPlans.set(plan.schoolDate, plan);
        }

        rememberLoadedRange(start, end);
      }

      inFlightRanges.delete(rangeKey);
      return result;
    });

    inFlightRanges.set(rangeKey, request);
    return request;
  }

  async function prefetchNearLoadedEdge(schoolDate: string) {
    const containingRange = loadedRanges.find(
      (range) => range.start <= schoolDate && schoolDate <= range.end,
    );

    if (!containingRange) {
      return;
    }

    if (
      schoolDate >= shiftSchoolDate(containingRange.end, -edgePrefetchThreshold)
    ) {
      await fetchRange(
        shiftSchoolDate(containingRange.end, 1),
        shiftSchoolDate(containingRange.end, edgePrefetchDays),
      );
    }

    if (
      schoolDate <=
      shiftSchoolDate(containingRange.start, edgePrefetchThreshold)
    ) {
      await fetchRange(
        shiftSchoolDate(containingRange.start, -edgePrefetchDays),
        shiftSchoolDate(containingRange.start, -1),
      );
    }
  }

  function isRangeLoaded(start: string, end: string) {
    return loadedRanges.some((range) => range.start <= start && end <= range.end);
  }

  function rememberLoadedRange(start: string, end: string) {
    loadedRanges.push({ start, end });
    loadedRanges.sort((left, right) => left.start.localeCompare(right.start));

    for (let index = 0; index < loadedRanges.length - 1; index += 1) {
      const current = loadedRanges[index];
      const next = loadedRanges[index + 1];

      if (shiftSchoolDate(current.end, 1) >= next.start) {
        current.end = current.end > next.end ? current.end : next.end;
        loadedRanges.splice(index + 1, 1);
        index -= 1;
      }
    }
  }

  return {
    getCachedDailyPlan,
    getDailyPlan,
    prefetchNearLoadedEdge,
    prefetchRange: fetchRange,
  };
}
