import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent as ReactFocusEvent,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import "./App.css";
import { createDailyPlanClient } from "./dailyPlanClient";
import { buildDateHeader, shiftSchoolDate } from "./dailyPlanView";
import { lockPageScroll } from "./pageScrollLock";
import {
  createLessonNameComboboxClient,
  type LessonNameComboboxOption,
} from "./lessonNameCombobox";
import {
  PeriodWheelInteraction,
  findPeriodClosestToCenter,
} from "./periodWheelPicker";
import { TimetableLayerMemoryCache } from "./timetableLayerCache";
import {
  createTimetableEditorClient,
  createNewTaskDraftForm,
  normalizeDirectLessonReplacement,
  type NewTaskDraftForm,
  type TargetScopeType,
  type TimetableLayerState,
  type TimetableLayerKey,
  type TimetableReference,
  type TimetableReplacement,
} from "./timetableEditorClient";
import { createDirectTimetableChangeTransport } from "./timetableSubmissionTransport";
import type { RegisteredLessonNameOption } from "../shared/lessonNames";
import type { DailyPlanTaskForCache } from "./dailyPlanCache";
import {
  TaskEditHistoryDialog,
  type TaskEditHistoryState,
} from "./taskEditHistoryView";
import {
  formatDueDate,
  formatSchoolDate as formatUiSchoolDate,
  formatTaskDueLabel,
  targetScopeLabel,
  type TargetScopeDisplayContext,
} from "./uiCopy";

const DATE_PICKER_RADIUS = 180;
const DATE_SWIPE_THRESHOLD_PX = 48;
const DATE_PICKER_SCALE_DISTANCE_PX = 78;
const DAILY_PLAN_PREFETCH_RADIUS = 7;
const NO_ACTIVE_TIMETABLE_CHANGE_MESSAGE =
  "この適用範囲には削除できる時間割変更がありません。";

type RequestStatus =
  | "checking"
  | "idle"
  | "sending"
  | "sent"
  | "verifying"
  | "setup"
  | "authenticated"
  | "error";

type StudentAccount = {
  schoolEmail: string;
  displayName: string;
};

type InitialSetupOptions = {
  status: "ready";
  schoolEmail: string;
  schoolYear: number;
  grades: Array<{
    grade: number;
    classes: Array<{
      classId: string;
      classNumber: number;
      tracks: Array<{ trackId: string; trackName: string }>;
    }>;
  }>;
};

type TimetableEditorOptions = {
  status: "ready";
  periodReferences: Array<{
    weekday: number;
    periodNumber: number;
    lessonName: string;
  }>;
  floatingLessonReferenceLabels: Array<{
    floatingLessonReferenceLabelId: string;
    referenceLabel: string;
    lessonName: string | null;
  }>;
  registeredLessonNames: RegisteredLessonNameOption[];
  allRegisteredLessonNames: RegisteredLessonNameOption[];
};

type TimetableEditorForm = TimetableLayerKey & {
  replacement: TimetableReplacement;
  sourceId?: string;
};

type TaskEditorForm = Omit<NewTaskDraftForm, "relatedLessonName"> & {
  relatedLessonInput: string;
  editingTask: DailyPlanTaskForCache | null;
};

type TimetableLayerDialog = {
  schoolDate: string;
  periodNumber: number;
  requestId: number;
  state:
    | { status: "loading" }
    | { status: "error" }
    | TimetableLayerState;
};

type TimetableChangeHistoryEntry = {
  sharedInformationChangeId: string;
  sharedInformationItemId: string;
  changeKind: "add" | "update" | "remove";
  sourceType: "direct" | "proposal";
  primaryActorDisplayName: string;
  changedAt: number;
  before: TimetableReplacement | null;
  after: TimetableReplacement | null;
};

type TimetableChangeHistoryResponse = {
  status: "ready";
  targetScope: { type: TargetScopeType; value: string };
  changeDate: string;
  periodNumber: number;
  entries: TimetableChangeHistoryEntry[];
};

type DirectTimetableChangeDetail = TimetableChangeHistoryEntry & {
  status: "ready";
  targetScope: { type: TargetScopeType; value: string };
  changeDate: string;
  periodNumber: number;
};

type TimetableHistoryDialog = {
  targetScopeType: TargetScopeType;
  changeDate: string;
  periodNumber: number;
  requestId: number;
  history:
    | { status: "loading" }
    | { status: "error" }
    | TimetableChangeHistoryResponse;
  detail:
    | null
    | { status: "loading"; sharedInformationChangeId: string }
    | { status: "error"; sharedInformationChangeId: string }
    | DirectTimetableChangeDetail;
};

type TaskHistoryDialog = {
  task: DailyPlanTaskForCache;
  requestId: number;
  state: TaskEditHistoryState;
};

function lessonNameOptionId(prefix: string, index: number) {
  return `${prefix}-${index}`;
}

function shouldShowLessonNameOptions({
  listOpen,
  optionCount,
  expandedToAll,
  hasAdditionalOptions,
}: {
  listOpen: boolean;
  optionCount: number;
  expandedToAll: boolean;
  hasAdditionalOptions: boolean;
}) {
  return (
    listOpen &&
    (optionCount > 0 || (!expandedToAll && hasAdditionalOptions))
  );
}

function dismissLessonNameOptionsWhenFocusLeaves(
  event: ReactFocusEvent<HTMLDivElement>,
  onDismiss: () => void,
) {
  const nextTarget = event.relatedTarget as Node | null;
  if (nextTarget && event.currentTarget.contains(nextTarget)) return;
  onDismiss();
}

function useLessonNameOptionsDismissal(
  listOpen: boolean,
  setListOpen: (open: boolean) => void,
  setActiveIndex: (index: number) => void,
) {
  const comboboxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!listOpen) return;

    const dismissOnOutsidePointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target as Node | null;
      if (target && comboboxRef.current?.contains(target)) return;
      setListOpen(false);
      setActiveIndex(-1);
    };

    document.addEventListener("pointerdown", dismissOnOutsidePointerDown);
    return () =>
      document.removeEventListener("pointerdown", dismissOnOutsidePointerDown);
  }, [listOpen, setActiveIndex, setListOpen]);

  return comboboxRef;
}

function LessonNameOptionsPopover({
  listboxId,
  optionIdPrefix,
  options,
  activeIndex,
  expandedToAll,
  hasAdditionalOptions,
  ariaLabel,
  onChoose,
  onExpand,
}: {
  listboxId: string;
  optionIdPrefix: string;
  options: readonly LessonNameComboboxOption[];
  activeIndex: number;
  expandedToAll: boolean;
  hasAdditionalOptions: boolean;
  ariaLabel?: string;
  onChoose: (option: LessonNameComboboxOption) => void;
  onExpand: () => void;
}) {
  return (
    <div className="lesson-name-options-popover">
      <div id={listboxId} role="listbox" aria-label={ariaLabel}>
        {options.map((option, index) => (
          <button
            id={lessonNameOptionId(optionIdPrefix, index)}
            type="button"
            role="option"
            tabIndex={-1}
            aria-selected={index === activeIndex}
            className={index === activeIndex ? "active" : ""}
            key={option.registeredLessonNameId}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => onChoose(option)}
          >
            {option.displayLabel}
          </button>
        ))}
      </div>
      {!expandedToAll && hasAdditionalOptions ? (
        <button
          className="lesson-name-more"
          type="button"
          onPointerDown={(event) => event.preventDefault()}
          onClick={onExpand}
        >
          その他の候補を表示
        </button>
      ) : null}
    </div>
  );
}

function App() {
  const [schoolEmailNumber, setSchoolEmailNumber] = useState("");
  const [schoolEmail, setSchoolEmail] = useState<string | null>(null);
  const [setupSchoolEmail, setSetupSchoolEmail] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [studentAccount, setStudentAccount] = useState<StudentAccount | null>(
    null,
  );
  const [setupOptions, setSetupOptions] = useState<InitialSetupOptions | null>(
    null,
  );
  const [displayName, setDisplayName] = useState("");
  const [realName, setRealName] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedTrackId, setSelectedTrackId] = useState("");
  const [confirmedSetup, setConfirmedSetup] = useState(false);
  const [status, setStatus] = useState<RequestStatus>("checking");
  const [message, setMessage] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAreaRef = useRef<HTMLDivElement | null>(null);
  const [dailyPlanClient] = useState(() =>
    createDailyPlanClient({
      datePickerRadius: DATE_PICKER_RADIUS,
      cacheRadius: DAILY_PLAN_PREFETCH_RADIUS,
      fetchDailyPlans: async (start, end) => {
        const response = await fetch(
          `/api/daily-plans?start=${encodeURIComponent(
            start,
          )}&end=${encodeURIComponent(end)}`,
        );

        return response.json();
      },
    }),
  );
  const {
    selectedSchoolDate,
    currentSchoolDate,
    schoolYearRange,
    dateStrip,
    dailyPlanState,
  } = useSyncExternalStore(
    dailyPlanClient.subscribe,
    dailyPlanClient.getSnapshot,
    dailyPlanClient.getSnapshot,
  );
  const datePickerRef = useRef<HTMLElement | null>(null);
  const dateButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const datePickerScrollFrameRef = useRef<number | null>(null);
  const datePickerScrollEndTimerRef = useRef<number | null>(null);
  const shouldCenterDatePickerRef = useRef(true);
  const centeredDateStripBoundsRef = useRef<[string, string] | null>(null);
  const suppressDatePickerScrollRef = useRef(false);
  const swipeStartXRef = useRef<number | null>(null);
  const [timetableEditorClient] = useState(() =>
    createTimetableEditorClient({
      storage: window.localStorage,
      submitDirectTimetableChanges: createDirectTimetableChangeTransport(),
    }),
  );
  const timetableLayerCacheRef = useRef(
    new TimetableLayerMemoryCache<TimetableLayerState>(),
  );
  const timetableEditor = useSyncExternalStore(
    timetableEditorClient.subscribe,
    timetableEditorClient.getSnapshot,
    timetableEditorClient.getSnapshot,
  );
  const [timetableEditorOptions, setTimetableEditorOptions] =
    useState<TimetableEditorOptions | null>(null);
  const [timetableEditorForm, setTimetableEditorForm] =
    useState<TimetableEditorForm | null>(null);
  const [taskEditorForm, setTaskEditorForm] =
    useState<TaskEditorForm | null>(null);
  const [taskDetail, setTaskDetail] =
    useState<DailyPlanTaskForCache | null>(null);
  const [taskHistoryDialog, setTaskHistoryDialog] =
    useState<TaskHistoryDialog | null>(null);
  const [taskLessonNamesExpanded, setTaskLessonNamesExpanded] =
    useState(false);
  const [taskLessonNameListOpen, setTaskLessonNameListOpen] =
    useState(false);
  const [activeTaskLessonNameOption, setActiveTaskLessonNameOption] =
    useState(-1);
  const taskLessonNameComboboxRef = useLessonNameOptionsDismissal(
    taskLessonNameListOpen,
    setTaskLessonNameListOpen,
    setActiveTaskLessonNameOption,
  );
  const [lessonNameOptionsExpanded, setLessonNameOptionsExpanded] =
    useState(false);
  const [lessonNameListOpen, setLessonNameListOpen] = useState(false);
  const [activeLessonNameOption, setActiveLessonNameOption] = useState(-1);
  const lessonNameComboboxRef = useLessonNameOptionsDismissal(
    lessonNameListOpen,
    setLessonNameListOpen,
    setActiveLessonNameOption,
  );
  const [timetableLayerDialog, setTimetableLayerDialog] =
    useState<TimetableLayerDialog | null>(null);
  const [timetableHistoryDialog, setTimetableHistoryDialog] =
    useState<TimetableHistoryDialog | null>(null);
  const layerDialogSchoolDate = timetableLayerDialog?.schoolDate;
  const layerDialogRequestId = timetableLayerDialog?.requestId;
  const [timetableEditorMessage, setTimetableEditorMessage] = useState<
    string | null
  >(null);
  const timetableDialogOpen = Boolean(
    timetableLayerDialog || timetableHistoryDialog || timetableEditorForm ||
      taskEditorForm || taskDetail || taskHistoryDialog,
  );

  useEffect(() => {
    if (!timetableDialogOpen) return;

    return lockPageScroll(document);
  }, [timetableDialogOpen]);

  useEffect(() => {
    if (!timetableEditorMessage) return;

    const timeoutId = window.setTimeout(() => {
      setTimetableEditorMessage(null);
    }, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [timetableEditorMessage]);

  useEffect(() => {
    if (!lessonNameListOpen || activeLessonNameOption < 0) return;
    document
      .getElementById(`lesson-name-option-${activeLessonNameOption}`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeLessonNameOption, lessonNameListOpen]);

  useEffect(() => {
    if (!taskLessonNameListOpen || activeTaskLessonNameOption < 0) return;
    document
      .getElementById(`task-lesson-name-option-${activeTaskLessonNameOption}`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeTaskLessonNameOption, taskLessonNameListOpen]);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      const response = await fetch("/api/auth/session");
      const body = (await response.json()) as
        | { status: "authenticated"; studentAccount: StudentAccount }
        | { status: "unauthenticated" };

      if (cancelled) {
        return;
      }

      if ("studentAccount" in body && body.status === "authenticated") {
        setStudentAccount(body.studentAccount);
        setStatus("authenticated");
        return;
      }

      const hasSetupSession = await loadInitialSetup();

      if (hasSetupSession) {
        return;
      }

      setStatus("idle");
    }

    loadSession().catch(() => setStatus("idle"));

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return dailyPlanClient.subscribe(() => {
      if (
        dailyPlanClient.getSnapshot().dailyPlanState.status ===
        "unauthenticated"
      ) {
        setStudentAccount(null);
        setStatus("idle");
      }
    });
  }, [dailyPlanClient]);

  useEffect(() => {
    if (status !== "authenticated" || !studentAccount) {
      return;
    }

    shouldCenterDatePickerRef.current = true;
    dailyPlanClient.reset();
    void dailyPlanClient.loadSelectedDailyPlan();
  }, [dailyPlanClient, status, studentAccount]);

  useEffect(() => {
    if (
      status !== "authenticated" ||
      !studentAccount ||
      !timetableEditor.editing ||
      timetableEditorOptions
    ) {
      return;
    }
    let cancelled = false;
    fetch("/api/timetable-changes/direct/options")
      .then(async (response) => {
        if (!response.ok) throw new Error("options unavailable");
        const options = (await response.json()) as TimetableEditorOptions;
        if (!cancelled) setTimetableEditorOptions(options);
      })
      .catch(() => {
        if (!cancelled)
          setTimetableEditorMessage("編集設定を読み込めませんでした。");
      });
    return () => {
      cancelled = true;
    };
  }, [status, studentAccount, timetableEditor.editing, timetableEditorOptions]);

  useEffect(() => {
    if (
      status !== "authenticated" ||
      !studentAccount ||
      timetableEditor.unreconciledDrafts.length === 0
    )
      return;
    const controller = new AbortController();
    Promise.all(
      timetableEditor.unreconciledDrafts.map(async (draft) => {
        const response = await fetch(
          `/api/timetable-changes/layers?date=${encodeURIComponent(
            draft.changeDate,
          )}&period=${draft.periodNumber}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("draft reconciliation unavailable");
        return (await response.json()) as TimetableLayerState;
      }),
    )
      .then((states) => timetableEditorClient.reconcileLayerStates(states))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setTimetableEditorMessage(
          "下書きと現在の変更内容を照合できませんでした。",
        );
      });
    return () => controller.abort();
  }, [
    status,
    studentAccount,
    timetableEditor.unreconciledDrafts,
    timetableEditorClient,
  ]);

  useEffect(() => {
    if (
      layerDialogSchoolDate === undefined ||
      layerDialogRequestId === undefined ||
      !schoolYearRange
    )
      return;
    const schoolDate = layerDialogSchoolDate;
    const requestId = layerDialogRequestId;
    const cache = timetableLayerCacheRef.current;
    const { missingRanges } = cache.selectWindow(
      schoolDate,
      schoolYearRange.startsOn,
      schoolYearRange.endsOn,
    );
    setTimetableLayerDialog((current) => {
      if (!current || current.schoolDate !== schoolDate) return current;
      const cached = cache.get(current.schoolDate, current.periodNumber);
      return cached ? { ...current, state: cached } : current;
    });
    if (missingRanges.length === 0) return;

    const controller = new AbortController();
    Promise.all(
      missingRanges.map(async ({ startDate, endDate }) => {
        const response = await fetch(
          `/api/timetable-changes/layers/batch?start=${encodeURIComponent(
            startDate,
          )}&end=${encodeURIComponent(endDate)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("layers unavailable");
        return (await response.json()) as {
          status: "ready";
          states: TimetableLayerState[];
        };
      }),
    )
      .then((responses) => {
        const states = responses.flatMap((response) => response.states);
        cache.store(states);
        timetableEditorClient.reconcileLayerStates(states);
        setTimetableLayerDialog((current) => {
          if (
            current?.schoolDate !== schoolDate ||
            current.requestId !== requestId
          )
            return current;
          const state = cache.get(current.schoolDate, current.periodNumber);
          return state ? { ...current, state } : current;
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setTimetableLayerDialog((current) => {
          if (
            current?.schoolDate !== schoolDate ||
            current.requestId !== requestId ||
            cache.get(current.schoolDate, current.periodNumber)
          )
            return current;
          return { ...current, state: { status: "error" } };
        });
      });
    return () => controller.abort();
  }, [
    layerDialogSchoolDate,
    layerDialogRequestId,
    schoolYearRange,
    timetableEditorClient,
  ]);

  useEffect(() => {
    if (!timetableHistoryDialog ||
      timetableHistoryDialog.history.status !== "loading") return;
    const {
      targetScopeType,
      changeDate,
      periodNumber,
      requestId,
    } = timetableHistoryDialog;
    const controller = new AbortController();
    const url = new URL("/api/timetable-changes/history", window.location.origin);
    url.searchParams.set("scope", targetScopeType);
    url.searchParams.set("date", changeDate);
    url.searchParams.set("period", String(periodNumber));
    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("history unavailable");
        return response.json() as Promise<TimetableChangeHistoryResponse>;
      })
      .then((history) => {
        setTimetableHistoryDialog((current) =>
          current?.requestId === requestId &&
          current.targetScopeType === targetScopeType &&
          current.changeDate === changeDate &&
          current.periodNumber === periodNumber
            ? { ...current, history }
            : current,
        );
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setTimetableHistoryDialog((current) =>
          current?.requestId === requestId &&
          current.targetScopeType === targetScopeType &&
          current.changeDate === changeDate &&
          current.periodNumber === periodNumber
            ? { ...current, history: { status: "error" } }
            : current,
        );
      });
    return () => controller.abort();
  }, [timetableHistoryDialog]);

  useEffect(() => {
    if (!taskHistoryDialog || taskHistoryDialog.state.status !== "loading") {
      return;
    }
    const { task, requestId } = taskHistoryDialog;
    const { taskId } = task;
    const controller = new AbortController();
    fetch(`/api/tasks/${encodeURIComponent(taskId)}/history`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Task Edit History unavailable");
        return response.json() as Promise<
          Extract<TaskEditHistoryState, { status: "ready" }>
        >;
      })
      .then((history) => {
        setTaskHistoryDialog((current) =>
          current?.task.taskId === taskId && current.requestId === requestId
            ? { ...current, state: history }
            : current,
        );
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setTaskHistoryDialog((current) =>
          current?.task.taskId === taskId && current.requestId === requestId
            ? { ...current, state: { status: "error" } }
            : current,
        );
      });
    return () => controller.abort();
  }, [taskHistoryDialog]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function closeMenuWhenOutside(event: PointerEvent) {
      const target = event.target;

      if (target instanceof Node && menuAreaRef.current?.contains(target)) {
        return;
      }

      setMenuOpen(false);
    }

    document.addEventListener("pointerdown", closeMenuWhenOutside);

    return () => {
      document.removeEventListener("pointerdown", closeMenuWhenOutside);
    };
  }, [menuOpen]);

  useEffect(() => {
    const dateStripBounds: [string, string] = [
      dateStrip[0]?.schoolDate ?? "",
      dateStrip.at(-1)?.schoolDate ?? "",
    ];
    const centeredBounds = centeredDateStripBoundsRef.current;
    const dateStripRangeChanged =
      !centeredBounds ||
      centeredBounds[0] !== dateStripBounds[0] ||
      centeredBounds[1] !== dateStripBounds[1];

    if (
      status !== "authenticated" ||
      (!shouldCenterDatePickerRef.current && !dateStripRangeChanged)
    ) {
      return;
    }

    const button = dateButtonRefs.current.get(selectedSchoolDate);

    if (!button) {
      return;
    }

    shouldCenterDatePickerRef.current = false;
    centeredDateStripBoundsRef.current = dateStripBounds;
    suppressDatePickerScrollRef.current = true;
    button.scrollIntoView({
      behavior: "auto",
      block: "nearest",
      inline: "center",
    });
    window.setTimeout(() => {
      suppressDatePickerScrollRef.current = false;
      datePickerRef.current?.dispatchEvent(new Event("scroll"));
    }, 120);
  }, [selectedSchoolDate, dateStrip, status]);

  useEffect(() => {
    return () => {
      if (datePickerScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(datePickerScrollFrameRef.current);
      }

      if (datePickerScrollEndTimerRef.current !== null) {
        window.clearTimeout(datePickerScrollEndTimerRef.current);
      }
    };
  }, []);

  function selectSchoolDate(schoolDate: string, centerDatePicker: boolean) {
    shouldCenterDatePickerRef.current = centerDatePicker;
    void dailyPlanClient.selectSchoolDate(schoolDate);
  }

  function updateDatePickerCenterState(shouldSelectDate: boolean) {
    const picker = datePickerRef.current;

    if (!picker) {
      return;
    }

    const pickerRect = picker.getBoundingClientRect();
    const pickerCenter = pickerRect.left + pickerRect.width / 2;
    let closestSchoolDate: string | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const [schoolDate, button] of dateButtonRefs.current) {
      const buttonRect = button.getBoundingClientRect();
      const buttonCenter = buttonRect.left + buttonRect.width / 2;
      const distance = Math.abs(buttonCenter - pickerCenter);
      const centerStrength = Math.max(
        0,
        1 - distance / DATE_PICKER_SCALE_DISTANCE_PX,
      );
      const easedStrength = 1 - (1 - centerStrength) ** 2;

      button.style.setProperty(
        "--date-cell-scale",
        String(0.82 + easedStrength * 0.36),
      );
      button.style.setProperty(
        "--date-cell-opacity",
        String(0.54 + easedStrength * 0.46),
      );

      if (distance < closestDistance) {
        closestDistance = distance;
        closestSchoolDate = schoolDate;
      }
    }

    if (
      shouldSelectDate &&
      closestSchoolDate &&
      closestSchoolDate !== selectedSchoolDate
    ) {
      selectSchoolDate(closestSchoolDate, false);
    }
  }

  function handleDatePickerScroll() {
    if (datePickerScrollFrameRef.current !== null) {
      return;
    }

    datePickerScrollFrameRef.current = window.requestAnimationFrame(() => {
      datePickerScrollFrameRef.current = null;
      updateDatePickerCenterState(!suppressDatePickerScrollRef.current);
    });
  }

  function handleDatePickerPointerDown() {
    suppressDatePickerScrollRef.current = false;
  }

  function centerDatePickerOnDate(schoolDate: string) {
    const button = dateButtonRefs.current.get(schoolDate);

    if (!button) {
      return;
    }

    suppressDatePickerScrollRef.current = true;
    button.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });

    if (datePickerScrollEndTimerRef.current !== null) {
      window.clearTimeout(datePickerScrollEndTimerRef.current);
    }

    datePickerScrollEndTimerRef.current = window.setTimeout(() => {
      suppressDatePickerScrollRef.current = false;
      updateDatePickerCenterState(true);
    }, 420);
  }

  function handleDateTap(schoolDate: string) {
    selectSchoolDate(schoolDate, false);
    centerDatePickerOnDate(schoolDate);
  }

  function handleMainPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    swipeStartXRef.current = event.clientX;
  }

  function handleMainPointerUp(event: ReactPointerEvent<HTMLElement>) {
    const startX = swipeStartXRef.current;
    swipeStartXRef.current = null;

    if (startX === null || !schoolYearRange) {
      return;
    }

    const deltaX = event.clientX - startX;

    if (Math.abs(deltaX) < DATE_SWIPE_THRESHOLD_PX) {
      return;
    }

    shouldCenterDatePickerRef.current = true;
    void dailyPlanClient.shiftSelectedSchoolDate(deltaX < 0 ? 1 : -1);
  }

  async function loadInitialSetup() {
    const response = await fetch("/api/auth/initial-setup");

    if (!response.ok) {
      return false;
    }

    const body = (await response.json()) as
      | InitialSetupOptions
      | { status: "invalid-setup-session" | "setup-unavailable" };

    if (body.status !== "ready") {
      return false;
    }

    setSetupOptions(body);
    setSetupSchoolEmail(body.schoolEmail);
    setSelectedGrade(String(body.grades[0]?.grade ?? ""));
    setSelectedClassId(body.grades[0]?.classes[0]?.classId ?? "");
    setSelectedTrackId(body.grades[0]?.classes[0]?.tracks[0]?.trackId ?? "");
    setStatus("setup");
    return true;
  }

  async function requestVerificationCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage(null);
    setSchoolEmail(null);

    const response = await fetch("/api/auth/verification-code-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ schoolEmailNumber }),
    });

    if (response.ok) {
      const body = (await response.json()) as { schoolEmail: string };
      setSchoolEmail(body.schoolEmail);
      setStatus("sent");
      setMessage("学校のメールに認証コードを送りました。");
      return;
    }

    setStatus("error");

    if (response.status === 400) {
      setMessage("8桁の半角数字を入力してください。");
      return;
    }

    if (response.status === 429) {
      setMessage("少し時間をおいてから、もう一度送信してください。");
      return;
    }

    if (response.status === 502) {
      setMessage(
        "現在、認証コードを送信できません。時間をおいてもう一度お試しください。",
      );
      return;
    }

    setMessage(
      "認証コードを送信できませんでした。時間をおいて再度お試しください。",
    );
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("verifying");
    setMessage(null);

    const response = await fetch("/api/auth/verification-code-verifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ schoolEmailNumber, code: verificationCode }),
    });

    if (response.ok) {
      const body = (await response.json()) as
        | { status: "authenticated"; studentAccount: StudentAccount }
        | { status: "setup-required"; schoolEmail: string };

      if ("studentAccount" in body && body.status === "authenticated") {
        setStudentAccount(body.studentAccount);
        setStatus("authenticated");
        setMessage(null);
        return;
      }

      setSetupSchoolEmail(body.schoolEmail);
      const loadedInitialSetup = await loadInitialSetup();

      if (!loadedInitialSetup) {
        setStatus("error");
        setMessage(
          "プロフィール設定を読み込めませんでした。時間をおいて再度お試しください。",
        );
        return;
      }

      setMessage(null);
      return;
    }

    setStatus("error");
    setMessage(
      "認証コードが正しくないか、期限が切れています。もう一度お試しください。",
    );
  }

  async function logout() {
    await fetch("/api/auth/session", { method: "DELETE" });
    setStudentAccount(null);
    setSchoolEmail(null);
    setSetupSchoolEmail(null);
    setVerificationCode("");
    setSetupOptions(null);
    dailyPlanClient.reset();
    timetableEditorClient.reset();
    timetableLayerCacheRef.current.clear();
    setTimetableEditorForm(null);
    setTaskEditorForm(null);
    setTaskDetail(null);
    setTaskHistoryDialog(null);
    setTimetableLayerDialog(null);
    setTimetableEditorOptions(null);
    setMenuOpen(false);
    setStatus("idle");
    setMessage("ログアウトしました。");
  }

  function enterTimetableEditing() {
    setTimetableEditorMessage(null);
    timetableEditorClient.enterEditing();
  }

  function leaveTimetableEditing() {
    if (
      timetableEditorClient.shouldConfirmExit() &&
      !window.confirm(
        "変更の下書きは削除されます。本当に編集を終了しますか。",
      )
    ) {
      return;
    }
    timetableEditorClient.discard();
    setTimetableEditorForm(null);
    setTaskEditorForm(null);
    setTimetableEditorMessage(null);
  }

  function openTaskEditor() {
    const initial = createNewTaskDraftForm(selectedSchoolDate);
    setTaskLessonNamesExpanded(false);
    setTaskLessonNameListOpen(false);
    setActiveTaskLessonNameOption(-1);
    setTaskEditorForm({
      title: initial.title,
      dueDate: initial.dueDate,
      targetScopeType: initial.targetScopeType,
      relatedLessonInput: "",
      editingTask: null,
    });
  }

  function openTaskUpdateEditor(task: DailyPlanTaskForCache) {
    setTaskLessonNamesExpanded(false);
    setTaskLessonNameListOpen(false);
    setActiveTaskLessonNameOption(-1);
    setTaskEditorForm({
      title: task.title,
      dueDate: task.dueDate,
      targetScopeType: task.targetScopeType,
      relatedLessonInput: task.relatedLessonName ?? "",
      editingTask: task,
    });
    setTaskDetail(null);
  }

  function saveTaskDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!taskEditorForm || timetableEditor.submitting) return;
    const lessonInput = taskEditorForm.relatedLessonInput.trim();
    const resolvedLesson = lessonInput
      ? createLessonNameComboboxClient({
          prioritizedOptions:
            timetableEditorOptions?.registeredLessonNames ?? [],
          allOptions:
            timetableEditorOptions?.allRegisteredLessonNames ?? [],
        }).resolveInput(lessonInput).replacement
      : null;
    const relatedLessonName =
      taskEditorForm.editingTask?.registeredRelatedLessonNameId &&
        lessonInput === taskEditorForm.editingTask.relatedLessonName
        ? {
            lessonName: lessonInput,
            registeredLessonNameId:
              taskEditorForm.editingTask.registeredRelatedLessonNameId,
          }
        : resolvedLesson
          ? {
              lessonName: resolvedLesson.lessonName,
              ...(resolvedLesson.registeredLessonNameId
                ? {
                    registeredLessonNameId:
                      resolvedLesson.registeredLessonNameId,
                  }
                : {}),
            }
          : lessonInput
            ? { lessonName: lessonInput }
            : null;
    const result = taskEditorForm.editingTask
      ? timetableEditorClient.saveTaskUpdateDraft(
          editableTask(taskEditorForm.editingTask),
          {
            title: taskEditorForm.title,
            dueDate: taskEditorForm.dueDate,
            relatedLessonName,
          },
        )
      : timetableEditorClient.saveTaskDraft({
          title: taskEditorForm.title,
          dueDate: taskEditorForm.dueDate,
          targetScopeType: taskEditorForm.targetScopeType,
          relatedLessonName,
        });
    if (result.status === "invalid-task") {
      setTimetableEditorMessage(
        "タイトル、期限、関連する授業、変更適用範囲を確認してください。",
      );
      return;
    }
    if (result.status === "limit-reached") {
      setTimetableEditorMessage("下書きは合計50件までです。");
      return;
    }
    setTaskEditorForm(null);
    setTimetableEditorMessage(null);
  }

  function openTimetableEditor(periodNumber: number) {
    setTimetableEditorForm(null);
    const cached = timetableLayerCacheRef.current.get(
      selectedSchoolDate,
      periodNumber,
    );
    setTimetableLayerDialog({
      schoolDate: selectedSchoolDate,
      periodNumber,
      requestId: 0,
      state: cached ?? { status: "loading" },
    });
  }

  function openLayerReplacement(targetScopeType: TargetScopeType) {
    if (
      !timetableEditor.editing ||
      timetableEditor.submitting ||
      !timetableLayerDialog ||
      timetableLayerDialog.state.status !== "ready"
    )
      return;
    const existing = timetableEditorClient.findDraft(
      targetScopeType,
      timetableLayerDialog.schoolDate,
      timetableLayerDialog.periodNumber,
    );
    const serverLayer = timetableLayerDialog.state.layers.find(
      (layer) => layer.targetScopeType === targetScopeType,
    );
    setLessonNameOptionsExpanded(false);
    setLessonNameListOpen(false);
    setActiveLessonNameOption(-1);
    setTimetableEditorForm(
      existing
        ? {
            targetScopeType: existing.targetScopeType,
            changeDate: existing.changeDate,
            periodNumber: existing.periodNumber,
            sourceId: existing.sourceId,
            replacement:
              existing.changeKind === "remove"
                ? existing.serverReplacement
                : existing.replacement,
          }
        :
        (serverLayer?.state === "active"
          ? {
              targetScopeType,
              changeDate: timetableLayerDialog.schoolDate,
              periodNumber: timetableLayerDialog.periodNumber,
              replacement: serverLayer.replacement,
            }
          : {
              targetScopeType,
              changeDate: timetableLayerDialog.schoolDate,
              periodNumber: timetableLayerDialog.periodNumber,
              replacement: { type: "lesson_name", lessonName: "" },
            }),
    );
  }

  function openLayerHistory(targetScopeType: TargetScopeType) {
    if (!timetableLayerDialog) return;
    setTimetableHistoryDialog({
      targetScopeType,
      changeDate: timetableLayerDialog.schoolDate,
      periodNumber: timetableLayerDialog.periodNumber,
      requestId: 0,
      history: { status: "loading" },
      detail: null,
    });
  }

  function openTaskHistory(task: DailyPlanTaskForCache) {
    setTaskDetail(null);
    setTaskHistoryDialog({
      task,
      requestId: 0,
      state: { status: "loading" },
    });
  }

  async function openDirectChangeDetail(sharedInformationChangeId: string) {
    setTimetableHistoryDialog((current) => current ? {
      ...current,
      detail: { status: "loading", sharedInformationChangeId },
    } : current);
    try {
      const response = await fetch(
        `/api/timetable-changes/direct/${encodeURIComponent(sharedInformationChangeId)}`,
      );
      if (!response.ok) throw new Error("detail unavailable");
      const detail = await response.json() as DirectTimetableChangeDetail;
      setTimetableHistoryDialog((current) =>
        current && current.detail?.sharedInformationChangeId ===
          sharedInformationChangeId
          ? { ...current, detail }
          : current,
      );
    } catch {
      setTimetableHistoryDialog((current) =>
        current && current.detail?.sharedInformationChangeId ===
          sharedInformationChangeId
          ? {
              ...current,
              detail: { status: "error", sharedInformationChangeId },
            }
          : current,
      );
    }
  }

  function planLayerRemoval(targetScopeType: TargetScopeType) {
    if (!timetableLayerDialog || timetableEditor.submitting) return;
    const result = timetableEditorClient.removeDesiredState({
      targetScopeType,
      changeDate: timetableLayerDialog.schoolDate,
      periodNumber: timetableLayerDialog.periodNumber,
    });
    if (result.status === "not-active") {
      setTimetableEditorMessage(
        NO_ACTIVE_TIMETABLE_CHANGE_MESSAGE,
      );
    } else if (result.status === "limit-reached") {
      setTimetableEditorMessage(
        "下書きは50件までです。既存の下書きを変更または取り消してください。",
      );
    } else {
      setTimetableEditorMessage(null);
    }
  }

  function planTimetableRemoval() {
    if (!timetableEditorForm || timetableEditor.submitting) return;
    const result = timetableEditorClient.removeDesiredState({
      targetScopeType: timetableEditorForm.targetScopeType,
      changeDate: timetableEditorForm.changeDate,
      periodNumber: timetableEditorForm.periodNumber,
    });
    if (result.status === "not-active") {
      setTimetableEditorMessage(
        NO_ACTIVE_TIMETABLE_CHANGE_MESSAGE,
      );
      return;
    }
    if (result.status === "limit-reached") {
      setTimetableEditorMessage(
        "下書きは50件までです。既存の下書きを変更または取り消してください。",
      );
      return;
    }
    setTimetableEditorForm(null);
    setTimetableEditorMessage(null);
  }

  function closeTimetableDialogFlow() {
    setTimetableEditorForm(null);
    setTimetableHistoryDialog(null);
    setTimetableLayerDialog(null);
  }

  function goBackInTimetableHistoryDialog() {
    setTimetableHistoryDialog((current) =>
      current?.detail ? { ...current, detail: null } : null,
    );
  }

  function navigateLayerDialog(schoolDate: string, periodNumber: number) {
    setTimetableEditorForm(null);
    setTimetableLayerDialog((current) =>
      current
        ? {
            schoolDate,
            periodNumber,
            requestId:
              current.schoolDate === schoolDate
                ? current.requestId
                : current.requestId + 1,
            state:
              timetableLayerCacheRef.current.get(schoolDate, periodNumber) ??
              { status: "loading" },
          }
        : current,
    );
  }

  function saveTimetableDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!timetableEditorForm || timetableEditor.submitting) return;
    let replacement = timetableEditorForm.replacement;
    if (replacement.type === "lesson_name") {
      const normalizedReplacement = normalizeDirectLessonReplacement(
        replacement.lessonName,
      );
      if (
        normalizedReplacement.type === "lesson_name" &&
        !replacement.registeredLessonNameId &&
        !timetableEditorOptions
      ) {
        setTimetableEditorMessage(
          "授業名の候補を読み込んでいます。読み込み後に保存してください。",
        );
        return;
      }
      replacement = normalizedReplacement.type === "lesson_name" &&
          replacement.registeredLessonNameId
        ? replacement
        : normalizedReplacement.type === "lesson_name"
          ? createLessonNameComboboxClient({
              prioritizedOptions:
                timetableEditorOptions?.registeredLessonNames ?? [],
              allOptions:
                timetableEditorOptions?.allRegisteredLessonNames ?? [],
            }).resolveInput(normalizedReplacement.lessonName).replacement
          : normalizedReplacement;
      if (replacement.type === "lesson_name" && !replacement.lessonName) {
        setTimetableEditorMessage("授業名を入力してください。");
        return;
      }
    }
    if (
      replacement.type === "floating_lesson_reference" &&
      !replacement.floatingLessonReferenceLabelId
    ) {
      setTimetableEditorMessage(
        "時間割記号を選択してください。",
      );
      return;
    }
    const result = timetableEditorClient.setDesiredState({
      ...timetableEditorForm,
      replacement,
    });
    if (result.status === "limit-reached") {
      setTimetableEditorMessage(
        "下書きは50件までです。既存の下書きを変更または取り消してください。",
      );
      return;
    }
    setTimetableEditorForm(null);
    setTimetableEditorMessage(null);
  }

  async function refreshSubmittedTimetableLayers(
    keys: readonly TimetableLayerKey[],
    signal: AbortSignal,
  ) {
    const uniqueSlots = [
      ...new Map(
        keys.map((key) => [
          `${key.changeDate}:${key.periodNumber}`,
          key,
        ]),
      ).values(),
    ];
    if (uniqueSlots.length === 0) {
      throw new Error("no Timetable Layer keys to refresh");
    }
    const states = await Promise.all(
      uniqueSlots.map(async ({ changeDate, periodNumber }) => {
        const response = await fetch(
          `/api/timetable-changes/layers?date=${encodeURIComponent(
            changeDate,
          )}&period=${periodNumber}`,
          { signal },
        );
        if (!response.ok) throw new Error("Timetable Layers unavailable");
        const state = (await response.json()) as TimetableLayerState;
        if (state.status !== "ready") {
          throw new Error("invalid Timetable Layer response");
        }
        return state;
      }),
    );
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    timetableLayerCacheRef.current.store(states);
    timetableEditorClient.reconcileLayerStates(states);
    setTimetableLayerDialog((current) => {
      if (!current) return current;
      const state = states.find(
        (candidate) =>
          candidate.schoolDate === current.schoolDate &&
          candidate.periodNumber === current.periodNumber,
      );
      return state ? { ...current, state } : current;
    });
  }

  async function commitTimetableDrafts() {
    const currentDailyPlanState = dailyPlanClient.getSnapshot().dailyPlanState;
    const targetScopeContext = currentDailyPlanState.status === "ready"
      ? currentDailyPlanState.dailyPlan.studentAffiliation
      : undefined;
    const result = await timetableEditorClient.submitCurrentBatch({
      confirmSubmission: ({ changes }) => {
        const summary = changes
          .map((draft) =>
            "changeDate" in draft
              ? `${formatUiSchoolDate(draft.changeDate, { referenceSchoolDate: selectedSchoolDate })} ${draft.periodNumber}限 / ${scopeLabel(draft.targetScopeType, targetScopeContext)} / ${draft.changeKind === "remove" ? "削除" : replacementLabel(draft.replacement)}`
              : draft.changeKind === "remove"
                ? `タスク / ${scopeLabel(draft.targetScopeType, targetScopeContext)} / 削除`
                : `タスク / ${scopeLabel(draft.targetScopeType, targetScopeContext)} / ${draft.title} / ${formatTaskDueLabel(draft.dueDate, selectedSchoolDate)}`,
          )
          .join("\n");
        const confirmed = window.confirm(
          `${changes.length}件の変更を強制的に反映します。よろしいですか？\n\n${summary}`,
        );
        if (confirmed) setTimetableEditorMessage("変更を反映しています…");
        return confirmed;
      },
      applyFreshness: async (effect) => {
        timetableLayerCacheRef.current.clear();
        const timetableKeys = effect.type === "applied"
          ? effect.affectedKeys
          : effect.conflictingKeys;
        if (timetableKeys.length > 0) {
          await refreshSubmittedTimetableLayers(timetableKeys, effect.signal);
        }
        const dailyPlanState = await dailyPlanClient.reload();
        if (effect.signal.aborted) return "stale" as const;
        return dailyPlanState.status === "error"
          ? "stale" as const
          : "refreshed" as const;
      },
    });

    if (result.status === "empty" || result.status === "cancelled") {
      setTimetableEditorMessage(null);
      return;
    }
    if (result.status === "local-conflict") {
      setTimetableEditorMessage(
        "ほかの変更と重なっている下書きを取り消すか、現在の状態から編集し直してください。",
      );
      return;
    }
    if (result.status === "already-submitting") return;
    if (result.status === "network-error") {
      setTimetableEditorMessage(
        "ネットワークに接続できません。下書きはこの端末に保存されています。",
      );
      return;
    }
    if (
      result.status === "remote-conflict" ||
      result.status === "idempotency-conflict"
    ) {
      setTimetableEditorMessage(
        result.freshness === "stale"
          ? "表示中の内容が更新されました。表示を再読み込みして、ほかの変更と重なっている下書きを確認してください。"
          : "表示中の内容が更新されました。ほかの変更と重なっている下書きを確認してください。",
      );
      return;
    }
    if (result.status === "applied") {
      setTimetableEditorMessage(
        result.freshness === "stale"
          ? "変更は反映されましたが、最新の表示を読み込めませんでした。再読み込みしてください。"
          : null,
      );
      return;
    }
    setTimetableEditorMessage("変更を反映できませんでした。もう一度お試しください。");
  }

  async function submitInitialSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const response = await fetch("/api/auth/initial-setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName,
        realName,
        trackId: selectedTrackId,
        confirmed: confirmedSetup,
      }),
    });

    if (response.ok) {
      const body = (await response.json()) as
        | { status: "authenticated"; studentAccount: StudentAccount }
        | { status: string };

      if ("studentAccount" in body && body.status === "authenticated") {
        setStudentAccount(body.studentAccount);
        setStatus("authenticated");
        setSetupSchoolEmail(null);
        setSetupOptions(null);
        setMessage(null);
        return;
      }

      setMessage(
        "初回設定を完了できませんでした。時間をおいて再度お試しください。",
      );
      return;
    }

    if (response.status === 400) {
      setMessage("入力内容を確認してください。");
      return;
    }

    setMessage(
      "初回設定を保存できませんでした。時間をおいて再度お試しください。",
    );
  }

  if (status === "checking") {
    return (
      <main className="app-page signup-page">
        <section className="panel signup-panel" aria-live="polite">
          <p className="lead">ログイン状態を確認しています…</p>
        </section>
      </main>
    );
  }

  if (status === "authenticated" && studentAccount) {
    const dateHeader = buildDateHeader(selectedSchoolDate, currentSchoolDate);
    const loadedLayerState =
      timetableLayerDialog?.state.status === "ready"
        ? timetableLayerDialog.state
        : null;
    const layerPreview = loadedLayerState
      ? timetableEditorClient.previewLayerState(
          loadedLayerState,
          (replacement) =>
            resolveReplacementLessonName(replacement, timetableEditorOptions),
        )
      : null;
    const lessonNameQuery =
      timetableEditorForm?.replacement.type === "lesson_name"
        ? timetableEditorForm.replacement.lessonName
        : "";
    const lessonNameCombobox = createLessonNameComboboxClient({
      prioritizedOptions: timetableEditorOptions?.registeredLessonNames ?? [],
      allOptions: timetableEditorOptions?.allRegisteredLessonNames ?? [],
      initialQuery: lessonNameQuery,
      initialExpandedToAll: lessonNameOptionsExpanded,
      initialActiveIndex: activeLessonNameOption,
    });
    const lessonNameComboboxSnapshot = lessonNameCombobox.getSnapshot();
    const taskLessonNameCombobox = createLessonNameComboboxClient({
      prioritizedOptions: timetableEditorOptions?.registeredLessonNames ?? [],
      allOptions: timetableEditorOptions?.allRegisteredLessonNames ?? [],
      initialQuery: taskEditorForm?.relatedLessonInput ?? "",
      initialExpandedToAll: taskLessonNamesExpanded,
      initialActiveIndex: activeTaskLessonNameOption,
    });
    const taskLessonNameSnapshot = taskLessonNameCombobox.getSnapshot();
    const lessonNameOptionsPopoverOpen = shouldShowLessonNameOptions({
      listOpen:
        lessonNameListOpen &&
        timetableEditorForm?.replacement.type === "lesson_name",
      optionCount: lessonNameComboboxSnapshot.options.length,
      expandedToAll: lessonNameOptionsExpanded,
      hasAdditionalOptions:
        lessonNameComboboxSnapshot.hasAdditionalOptions,
    });
    const taskLessonNameOptionsPopoverOpen = shouldShowLessonNameOptions({
      listOpen: taskLessonNameListOpen,
      optionCount: taskLessonNameSnapshot.options.length,
      expandedToAll: taskLessonNamesExpanded,
      hasAdditionalOptions: taskLessonNameSnapshot.hasAdditionalOptions,
    });
    const taskLessonResolution = taskEditorForm?.relatedLessonInput.trim()
      ? taskLessonNameCombobox.resolveInput()
      : null;
    const targetScopeContext = dailyPlanState.status === "ready"
      ? dailyPlanState.dailyPlan.studentAffiliation
      : undefined;

    return (
      <main className="app-page daily-plan-page">
        <section
          className="daily-plan-shell"
          aria-labelledby="daily-plan-title"
        >
          <header className="daily-plan-topbar">
            <div className="menu-area" ref={menuAreaRef}>
              <button
                className="icon-button"
                type="button"
                aria-label="メニュー"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <span aria-hidden="true">☰</span>
              </button>
              {menuOpen ? (
                <div className="menu-popover">
                  <p className="menu-name">{studentAccount.displayName}</p>
                  {dailyPlanState.status === "ready" ? (
                    <p className="menu-affiliation">
                      {dailyPlanState.dailyPlan.studentAffiliation.schoolYear}
                      年度 {dailyPlanState.dailyPlan.studentAffiliation.grade}年
                      {dailyPlanState.dailyPlan.studentAffiliation.classNumber}
                      組 {dailyPlanState.dailyPlan.studentAffiliation.trackName}
                    </p>
                  ) : (
                    <p className="menu-affiliation">
                      {dailyPlanState.status === "loading"
                        ? "所属情報を読み込んでいます…"
                        : dailyPlanState.status === "affiliation-renewal-needed"
                          ? "所属の更新が必要です"
                          : "所属情報を読み込めません"}
                    </p>
                  )}
                  <button className="menu-item" type="button" disabled>
                    設定
                  </button>
                  <button className="menu-item" type="button" onClick={logout}>
                    ログアウト
                  </button>
                </div>
              ) : null}
            </div>
            <h1 id="daily-plan-title" className="daily-plan-title">
              <span className="date-heading-main">
                <span className="date-heading-small">{dateHeader.year}年</span>
                <span className="date-heading-large">{dateHeader.month}</span>
                <span className="date-heading-small">月</span>
                <span className="date-heading-large">{dateHeader.day}</span>
                <span className="date-heading-small">
                  日 ({dateHeader.weekdayLabel})
                </span>
              </span>
              {dateHeader.relativeLabel ? (
                <span className="date-heading-relative">
                  {dateHeader.relativeLabel}
                </span>
              ) : null}
            </h1>
            {timetableEditor.editing ? (
              <span className="edit-mode-indicator" role="status">
                編集中
              </span>
            ) : (
              <div className="topbar-spacer" aria-hidden="true" />
            )}
          </header>

          {timetableEditorMessage ? (
            <div className="timetable-editor-toast" role="status">
              {timetableEditorMessage}
            </div>
          ) : null}

          <div
            className="daily-plan-main"
            onPointerDown={handleMainPointerDown}
            onPointerUp={handleMainPointerUp}
            onPointerCancel={() => {
              swipeStartXRef.current = null;
            }}
          >
            {dailyPlanState.status === "loading" ? (
              <div className="panel state-panel" aria-live="polite">
                この日の予定を読み込んでいます…
              </div>
            ) : null}

            {dailyPlanState.status === "affiliation-renewal-needed" ? (
              <div className="panel state-panel" role="status">
                <h2>所属の更新が必要です</h2>
                <p>
                  {dailyPlanState.schoolYear}
                  年度の所属情報を入力すると、この日の予定を確認できます。
                </p>
              </div>
            ) : null}

            {dailyPlanState.status === "error" ? (
              <div className="panel state-panel" role="alert">
                <h2>この日の予定を読み込めませんでした</h2>
                <p>時間をおいて再度お試しください。</p>
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => void dailyPlanClient.reload()}
                >
                  再読み込み
                </button>
              </div>
            ) : null}

            {dailyPlanState.status === "ready" ? (
              <>
                <section
                  className="panel timetable-panel"
                  aria-label="時間割"
                >
                  <div className="period-list">
                    {dailyPlanState.dailyPlan.periods.map((period) => (
                      <article
                        className={`period-row inspectable ${
                          timetableEditorClient.isLessonEdited(
                            selectedSchoolDate,
                            period.periodNumber,
                          )
                            ? "draft-edited"
                            : ""
                        } ${timetableEditor.editing ? "editable" : ""}`}
                        key={period.periodNumber}
                        role="button"
                        tabIndex={0}
                        aria-label={`${period.periodNumber}限 ${period.lessonName || "空欄"}${
                          timetableEditorClient.isLessonEdited(
                            selectedSchoolDate,
                            period.periodNumber,
                          )
                            ? " 変更下書きあり"
                            : ""
                        }`}
                        onClick={() => openTimetableEditor(period.periodNumber)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            openTimetableEditor(period.periodNumber);
                          }
                        }}
                      >
                        <div className="period-number">
                          {period.periodNumber}
                        </div>
                        <div className="period-main">
                          <div className="lesson-line">
                            <span className="lesson-name">
                              {period.lessonName}
                            </span>
                            {period.hasTasks ? (
                              <span className="task-pill">タスク</span>
                            ) : null}
                          </div>
                          {period.notes.length > 0 ? (
                            <ul className="lesson-notes">
                              {period.notes.map((note) => (
                                <li key={note.noteId}>{note.body}</li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <section
                  className="panel daily-section"
                  aria-labelledby="tasks-title"
                >
                  <div className="daily-section-heading">
                    <h2 id="tasks-title">タスク</h2>
                    {timetableEditor.editing ? (
                      <button
                        className="task-add-button"
                        type="button"
                        aria-label="タスクを追加"
                        disabled={timetableEditor.atLimit || timetableEditor.submitting}
                        onClick={openTaskEditor}
                      >
                        <span className="task-add-icon" aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                  <div className="task-list">
                    {timetableEditor.taskDrafts.map((task) => (
                      <article
                        className="task-item task-draft"
                        key={task.sourceId}
                      >
                        <span>
                          <strong>{task.title}</strong>
                          <small>
                            {formatTaskDueLabel(task.dueDate, selectedSchoolDate)}
                            {task.relatedLessonName
                              ? ` · ${task.relatedLessonName.lessonName}`
                              : ""}
                          </small>
                          <span className="task-scope-badge">
                            {scopeLabel(task.targetScopeType, targetScopeContext)}
                          </span>
                          <small>
                            {task.conflicted
                              ? "ほかの変更あり"
                              : task.changeKind === "remove"
                                ? "削除予定"
                                : task.changeKind === "update"
                                  ? "変更予定"
                                  : "追加予定"}
                          </small>
                        </span>
                        <button
                          className="button-link"
                          type="button"
                          aria-label={`${task.title}の下書きを取り消す`}
                          onClick={() =>
                            timetableEditorClient.removeTaskDraft(task.sourceId)
                          }
                        >
                          取り消す
                        </button>
                      </article>
                    ))}
                    {dailyPlanState.dailyPlan.tasks.map((task) => (
                      <button
                        className="task-item"
                        type="button"
                        key={task.taskId}
                        onClick={() => setTaskDetail(task)}
                      >
                        <span>
                          <strong>{task.title}</strong>
                          <small>
                            {formatTaskDueLabel(task.dueDate, selectedSchoolDate)}
                            {task.relatedLessonName
                              ? ` · ${task.relatedLessonName}`
                              : ""}
                          </small>
                          <span className="task-scope-badge">
                            {scopeLabel(task.targetScopeType, targetScopeContext)}
                          </span>
                        </span>
                        <span aria-hidden="true">›</span>
                      </button>
                    ))}
                    {timetableEditor.taskDrafts.length === 0 &&
                    dailyPlanState.dailyPlan.tasks.length === 0 ? (
                      <p className="empty-state">タスクはありません。</p>
                    ) : null}
                  </div>
                </section>

                <section
                  className="panel daily-section"
                  aria-labelledby="notes-title"
                >
                  <h2 id="notes-title">ノート</h2>
                  <div className="note-list">
                    {dailyPlanState.dailyPlan.notes.map((note) => (
                      <article className="note-item" key={note.noteId}>
                        <p>{note.body}</p>
                        {note.relatedContext?.type === "school-date" ? (
                          <small>{formatUiSchoolDate(note.relatedContext.schoolDate, { referenceSchoolDate: selectedSchoolDate })}</small>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </section>
              </>
            ) : null}
          </div>

          {schoolYearRange ? (
            <footer className="date-strip-footer">
              <nav
                className="date-strip"
                aria-label="日付を選択"
                ref={datePickerRef}
                onPointerDown={handleDatePickerPointerDown}
                onScroll={handleDatePickerScroll}
              >
                {dateStrip.map((date) => (
                  <button
                    className={`date-cell ${
                      date.schoolDate === selectedSchoolDate ? "selected" : ""
                    }`}
                    key={date.schoolDate}
                    type="button"
                    aria-label={`${formatUiSchoolDate(date.schoolDate, { referenceSchoolDate: selectedSchoolDate })}（${date.weekdayLabel}）`}
                    ref={(element) => {
                      if (element) {
                        dateButtonRefs.current.set(date.schoolDate, element);
                      } else {
                        dateButtonRefs.current.delete(date.schoolDate);
                      }
                    }}
                    onClick={() => handleDateTap(date.schoolDate)}
                  >
                    <span className="date-cell-day">{date.day}</span>
                    <span className="date-cell-weekday">
                      {date.weekdayLabel}
                    </span>
                    {timetableEditor.draftDates.includes(date.schoolDate) ? (
                      <span
                        className="date-draft-mark"
                        aria-label="変更下書きあり"
                      />
                    ) : null}
                  </button>
                ))}
              </nav>
              <div className="timetable-edit-controls">
                {timetableEditor.editing ? (
                  <button
                    className="button-secondary"
                    type="button"
                    disabled={
                      timetableEditor.submitting ||
                      timetableEditor.draftCount === 0 ||
                      timetableEditor.conflictCount > 0
                    }
                    onClick={() => void commitTimetableDrafts()}
                  >
                    変更を反映 ({timetableEditor.draftCount})
                  </button>
                ) : null}
                <button
                  className={`icon-button edit-mode-button${timetableEditor.editing ? " active" : ""}`}
                  type="button"
                  disabled={timetableEditor.submitting}
                  aria-label={
                    timetableEditor.editing
                      ? "編集を終了"
                      : "この日の予定を編集"
                  }
                  onClick={() =>
                    timetableEditor.editing
                      ? leaveTimetableEditing()
                      : enterTimetableEditing()
                  }
                >
                  <span aria-hidden="true">✎</span>
                </button>
              </div>
            </footer>
          ) : null}

          {taskEditorForm ? (
            <div className="editor-dialog-backdrop" role="presentation">
              <section
                className="timetable-editor-dialog task-editor-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="task-editor-title"
              >
                <header className="editor-dialog-header">
                  <h2 id="task-editor-title">
                    {taskEditorForm.editingTask
                      ? "タスクを編集"
                      : "タスクを追加"}
                  </h2>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="閉じる"
                    onClick={() => setTaskEditorForm(null)}
                  >
                    ×
                  </button>
                </header>
                <form onSubmit={saveTaskDraft}>
                  <label>
                    <span>タイトル</span>
                    <input
                      autoFocus
                      required
                      maxLength={120}
                      value={taskEditorForm.title}
                      onChange={(event) =>
                        setTaskEditorForm((current) =>
                          current
                            ? { ...current, title: event.target.value }
                            : current,
                        )
                      }
                    />
                  </label>
                  <div className="task-form-field">
                    <label htmlFor="task-due-date">期限</label>
                    <div className="task-due-date-row">
                      <input
                        id="task-due-date"
                        type="date"
                        min={schoolYearRange?.startsOn}
                        max={schoolYearRange?.endsOn}
                        value={taskEditorForm.dueDate ?? ""}
                        onChange={(event) =>
                          setTaskEditorForm((current) =>
                            current
                              ? {
                                  ...current,
                                  dueDate: event.target.value || null,
                                }
                              : current,
                          )
                        }
                      />
                      <button
                        className="task-due-date-clear"
                        type="button"
                        aria-label="期限をクリア"
                        title="期限をクリア"
                        disabled={!taskEditorForm.dueDate}
                        onClick={() =>
                          setTaskEditorForm((current) =>
                            current ? { ...current, dueDate: null } : current,
                          )
                        }
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          width="20"
                          height="20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M4 7h16" />
                          <path d="M9 7V4h6v3" />
                          <path d="m6 7 1 13h10l1-13" />
                          <path d="M10 11v5M14 11v5" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="task-form-field">
                    <label htmlFor="task-related-lesson-name">
                      関連する授業（原則設定する）
                    </label>
                    <div
                      ref={taskLessonNameComboboxRef}
                      className="lesson-name-combobox"
                      onBlur={(event) =>
                        dismissLessonNameOptionsWhenFocusLeaves(event, () => {
                          setTaskLessonNameListOpen(false);
                          setActiveTaskLessonNameOption(-1);
                        })
                      }
                    >
                    <input
                      id="task-related-lesson-name"
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={taskLessonNameOptionsPopoverOpen}
                      aria-controls="task-lesson-name-options"
                      aria-activedescendant={
                        taskLessonNameOptionsPopoverOpen &&
                        taskLessonNameSnapshot.activeIndex >= 0
                          ? lessonNameOptionId(
                              "task-lesson-name-option",
                              taskLessonNameSnapshot.activeIndex,
                            )
                          : undefined
                      }
                      value={taskEditorForm.relatedLessonInput}
                      onFocus={() => setTaskLessonNameListOpen(true)}
                      onChange={(event) => {
                        setTaskLessonNameListOpen(true);
                        setActiveTaskLessonNameOption(-1);
                        setTaskEditorForm((current) =>
                          current
                            ? {
                                ...current,
                                relatedLessonInput: event.target.value,
                              }
                            : current,
                        );
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                          event.preventDefault();
                          setTaskLessonNameListOpen(true);
                          taskLessonNameCombobox.moveActive(
                            event.key === "ArrowDown" ? 1 : -1,
                          );
                          setActiveTaskLessonNameOption(
                            taskLessonNameCombobox.getSnapshot().activeIndex,
                          );
                        } else if (
                          event.key === "Enter" &&
                          taskLessonNameListOpen &&
                          taskLessonNameSnapshot.activeIndex >= 0
                        ) {
                          event.preventDefault();
                          const option = taskLessonNameSnapshot.options[
                            taskLessonNameSnapshot.activeIndex
                          ];
                          if (!option) return;
                          setTaskEditorForm((current) =>
                            current
                              ? { ...current, relatedLessonInput: option.fullLessonName }
                              : current,
                          );
                          setTaskLessonNameListOpen(false);
                          setActiveTaskLessonNameOption(-1);
                        } else if (
                          event.key === "Escape" &&
                          taskLessonNameListOpen
                        ) {
                          event.preventDefault();
                          setTaskLessonNameListOpen(false);
                          setActiveTaskLessonNameOption(-1);
                        }
                      }}
                    />
                    {taskLessonNameOptionsPopoverOpen ? (
                      <LessonNameOptionsPopover
                        listboxId="task-lesson-name-options"
                        optionIdPrefix="task-lesson-name-option"
                        options={taskLessonNameSnapshot.options}
                        activeIndex={activeTaskLessonNameOption}
                        expandedToAll={taskLessonNamesExpanded}
                        hasAdditionalOptions={
                          taskLessonNameSnapshot.hasAdditionalOptions
                        }
                        ariaLabel="登録済みの授業名"
                        onChoose={(option) => {
                          setTaskLessonNameListOpen(false);
                          setActiveTaskLessonNameOption(-1);
                          setTaskEditorForm((current) =>
                            current
                              ? {
                                  ...current,
                                  relatedLessonInput: option.fullLessonName,
                                }
                              : current,
                          );
                        }}
                        onExpand={() => {
                          setTaskLessonNamesExpanded(true);
                          setTaskLessonNameListOpen(true);
                          setActiveTaskLessonNameOption(-1);
                        }}
                      />
                    ) : null}
                    </div>
                  </div>
                  {taskLessonResolution?.custom &&
                  !(
                    taskEditorForm.editingTask
                      ?.registeredRelatedLessonNameId &&
                    taskEditorForm.relatedLessonInput.trim() ===
                      taskEditorForm.editingTask.relatedLessonName
                  ) ? (
                    <p className="field-warning" role="status">
                      候補にない授業名として保存されます。
                    </p>
                  ) : null}
                  {taskEditorForm.editingTask ? (
                    <div className="readonly-field">
                      <span>変更適用範囲</span>
                      <strong>
                        {scopeLabel(
                          taskEditorForm.editingTask.targetScopeType,
                          targetScopeContext,
                        )}
                      </strong>
                      <small>変更適用範囲は変更できません。</small>
                    </div>
                  ) : (
                    <label>
                      <span>変更適用範囲</span>
                      <select
                        required
                        value={taskEditorForm.targetScopeType ?? ""}
                        onChange={(event) =>
                          setTaskEditorForm((current) =>
                            current
                              ? {
                                  ...current,
                                  targetScopeType:
                                    (event.target.value || null) as
                                      TargetScopeType | null,
                                }
                              : current,
                          )
                        }
                      >
                        <option value="" disabled hidden>
                          選択してください
                        </option>
                        {(["grade", "class", "track", "student"] as const).map(
                          (scope) => (
                            <option key={scope} value={scope}>
                              {scopeLabel(scope, targetScopeContext)}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  )}
                  <div className="editor-dialog-actions">
                    <button
                      className="button-secondary"
                      type="button"
                      onClick={() => setTaskEditorForm(null)}
                    >
                      キャンセル
                    </button>
                    <button className="button-primary" type="submit">
                      {taskEditorForm.editingTask
                        ? "変更を下書きに保存"
                        : "下書きに保存"}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          ) : null}

          {taskDetail ? (
            <div className="editor-dialog-backdrop" role="presentation">
              <section
                className="timetable-editor-dialog task-detail-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="task-detail-title"
              >
                <header className="editor-dialog-header">
                  <h2 id="task-detail-title">タスクの詳細</h2>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="閉じる"
                    onClick={() => setTaskDetail(null)}
                  >
                    ×
                  </button>
                </header>
                <dl className="detail-list">
                  <div><dt>タイトル</dt><dd>{taskDetail.title}</dd></div>
                  <div><dt>期限</dt><dd>{taskDetail.dueDate ? formatDueDate(taskDetail.dueDate, selectedSchoolDate) : "期限なし"}</dd></div>
                  <div><dt>関連する授業</dt><dd>{taskDetail.relatedLessonName ?? "なし"}</dd></div>
                  <div><dt>変更適用範囲</dt><dd>{scopeLabel(taskDetail.targetScopeType, targetScopeContext)}</dd></div>
                </dl>
                <div className="editor-dialog-actions">
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => openTaskHistory(taskDetail)}
                  >
                    編集履歴
                  </button>
                  {timetableEditor.editing ? (
                    <>
                      <button
                        className="button-secondary"
                        type="button"
                        onClick={() => openTaskUpdateEditor(taskDetail)}
                      >
                        編集
                      </button>
                      <button
                        className="button-danger"
                        type="button"
                        onClick={() => {
                          timetableEditorClient.saveTaskRemoveDraft(
                            editableTask(taskDetail),
                          );
                          setTaskDetail(null);
                        }}
                      >
                        削除
                      </button>
                    </>
                  ) : null}
                </div>
              </section>
            </div>
          ) : null}

          {taskHistoryDialog ? (
            <TaskEditHistoryDialog
              taskTitle={taskHistoryDialog.task.title}
              targetScopeContext={targetScopeContext}
              referenceSchoolDate={selectedSchoolDate}
              state={taskHistoryDialog.state}
              onBack={() => {
                setTaskDetail(taskHistoryDialog.task);
                setTaskHistoryDialog(null);
              }}
              onClose={() => setTaskHistoryDialog(null)}
              onRetry={() => setTaskHistoryDialog((current) =>
                current ? {
                  ...current,
                  requestId: current.requestId + 1,
                  state: { status: "loading" },
                } : current)}
            />
          ) : null}

          {timetableHistoryDialog ? (
            <div className="editor-dialog-backdrop" role="presentation">
              <section
                className="timetable-editor-dialog timetable-history-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="timetable-history-title"
                onKeyDown={(event) => {
                  if (event.key !== "Escape") return;
                  goBackInTimetableHistoryDialog();
                }}
              >
                <header className="editor-dialog-header">
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={timetableHistoryDialog.detail
                      ? "編集履歴に戻る"
                      : "変更状況に戻る"}
                    onClick={goBackInTimetableHistoryDialog}
                  >
                    ‹
                  </button>
                  <div className="timetable-dialog-heading">
                    <h2 id="timetable-history-title">
                      {timetableHistoryDialog.detail
                        ? "変更の詳細"
                        : "編集履歴"}
                    </h2>
                    <p className="layer-dialog-selection">
                      {formatUiSchoolDate(timetableHistoryDialog.changeDate, {
                        referenceSchoolDate: selectedSchoolDate,
                      })}
                      ・{timetableHistoryDialog.periodNumber}限・
                      {scopeLabel(
                        timetableHistoryDialog.targetScopeType,
                        targetScopeContext,
                      )}
                    </p>
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="閉じる"
                    onClick={closeTimetableDialogFlow}
                  >
                    ×
                  </button>
                </header>

                {timetableHistoryDialog.detail ? (
                  timetableHistoryDialog.detail.status === "loading" ? (
                    <p className="layer-dialog-status" aria-live="polite">
                      変更内容を読み込んでいます…
                    </p>
                  ) : timetableHistoryDialog.detail.status === "error" ? (
                    <div className="layer-dialog-status" role="alert">
                      <p>変更内容を読み込めませんでした。</p>
                      <button
                        className="button-secondary"
                        type="button"
                        onClick={() => void openDirectChangeDetail(
                          timetableHistoryDialog.detail!
                            .sharedInformationChangeId,
                        )}
                      >
                        再読み込み
                      </button>
                    </div>
                  ) : (
                    <DirectChangeDetailView
                      detail={timetableHistoryDialog.detail}
                      targetScopeContext={targetScopeContext}
                      referenceSchoolDate={selectedSchoolDate}
                    />
                  )
                ) : timetableHistoryDialog.history.status === "loading" ? (
                  <p className="layer-dialog-status" aria-live="polite">
                    編集履歴を読み込んでいます。
                  </p>
                ) : timetableHistoryDialog.history.status === "error" ? (
                  <div className="layer-dialog-status" role="alert">
                    <p>編集履歴を読み込めませんでした。</p>
                    <button
                      className="button-secondary"
                      type="button"
                      onClick={() => setTimetableHistoryDialog((current) =>
                        current ? {
                          ...current,
                          requestId: current.requestId + 1,
                          history: { status: "loading" },
                        } : current)}
                    >
                      再読み込み
                    </button>
                  </div>
                ) : timetableHistoryDialog.history.entries.length === 0 ? (
                  <p className="history-empty-state">
                    この日・時限・変更適用範囲には編集履歴がありません。
                  </p>
                ) : (
                  <div className="history-list" aria-label="編集履歴">
                    {timetableHistoryDialog.history.entries.map((entry) => (
                      <button
                        className="history-row"
                        type="button"
                        key={entry.sharedInformationChangeId}
                        onClick={() => void openDirectChangeDetail(
                          entry.sharedInformationChangeId,
                        )}
                      >
                        <span className={`history-kind history-kind-${entry.changeKind}`}>
                          {changeKindLabel(entry.changeKind)}
                        </span>
                        <strong>{storedTransitionLabel(entry)}</strong>
                        <span>{entry.sourceType === "direct"
                          ? "強制変更"
                          : "提案による変更"}</span>
                        <span>{entry.primaryActorDisplayName}</span>
                        <time dateTime={new Date(entry.changedAt).toISOString()}>
                          {formatRelativeTime(entry.changedAt)}
                        </time>
                        <span aria-hidden="true">›</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : null}

          {timetableLayerDialog && !timetableEditorForm && !timetableHistoryDialog ? (
            <div className="editor-dialog-backdrop" role="presentation">
              <section
                className="timetable-editor-dialog timetable-layer-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="timetable-layer-title"
                onKeyDown={(event) => {
                  if (event.key === "Escape") closeTimetableDialogFlow();
                }}
              >
                <header className="editor-dialog-header">
                  <div className="layer-dialog-heading">
                    <h2 id="timetable-layer-title">時間割の変更状況</h2>
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="閉じる"
                    autoFocus
                    onClick={closeTimetableDialogFlow}
                  >
                    ×
                  </button>
                </header>

                <div className="layer-dialog-navigation" aria-label="日付と時限">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="前の日"
                    disabled={
                      !schoolYearRange ||
                      timetableLayerDialog.schoolDate <=
                        schoolYearRange.startsOn
                    }
                    onClick={() =>
                      navigateLayerDialog(
                        shiftSchoolDate(timetableLayerDialog.schoolDate, -1),
                        timetableLayerDialog.periodNumber,
                      )
                    }
                  >
                    ‹
                  </button>
                  <input
                    type="date"
                    aria-label="変更対象日"
                    min={schoolYearRange?.startsOn}
                    max={schoolYearRange?.endsOn}
                    value={timetableLayerDialog.schoolDate}
                    onChange={(event) =>
                      navigateLayerDialog(
                        event.target.value,
                        timetableLayerDialog.periodNumber,
                      )
                    }
                  />
                  <PeriodWheelPicker
                    value={timetableLayerDialog.periodNumber}
                    onChange={(periodNumber) =>
                      navigateLayerDialog(
                        timetableLayerDialog.schoolDate,
                        periodNumber,
                      )
                    }
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="次の日"
                    disabled={
                      !schoolYearRange ||
                      timetableLayerDialog.schoolDate >=
                        schoolYearRange.endsOn
                    }
                    onClick={() =>
                      navigateLayerDialog(
                        shiftSchoolDate(timetableLayerDialog.schoolDate, 1),
                        timetableLayerDialog.periodNumber,
                      )
                    }
                  >
                    ›
                  </button>
                </div>

                {timetableEditor.editing ? (
                  <div className="layer-edit-guidance" role="status">
                    <span>
                      {timetableEditor.lastCommitFailed
                        ? "前回の反映に失敗しました。下書きは保持されています。"
                        : "時間割変更の適用範囲を選んでください。"}
                    </span>
                    <strong>
                      下書き {timetableEditor.draftCount}/50
                    </strong>
                  </div>
                ) : null}

                {timetableLayerDialog.state.status === "loading" ? (
                  <p className="layer-dialog-status" aria-live="polite">
                    適用状態を読み込んでいます。
                  </p>
                ) : timetableLayerDialog.state.status === "error" ? (
                  <div className="layer-dialog-status" role="alert">
                    <p>適用状態を読み込めませんでした。</p>
                    <button
                      className="button-secondary"
                      type="button"
                      onClick={() =>
                        setTimetableLayerDialog({
                          schoolDate: timetableLayerDialog.schoolDate,
                          periodNumber: timetableLayerDialog.periodNumber,
                          requestId: timetableLayerDialog.requestId + 1,
                          state: { status: "loading" },
                        })
                      }
                    >
                      再読み込み
                    </button>
                  </div>
                ) : layerPreview ? (
                  <div className="timetable-layer-stack">
                    <LayerRow
                      label="通常の時間割"
                      value={`${
                        buildDateHeader(
                          timetableLayerDialog.schoolDate,
                          currentSchoolDate,
                        ).weekdayLabel
                      }${timetableLayerDialog.periodNumber}`}
                    />
                    {layerPreview.layers.map((layer) => {
                      const existingDraft = timetableEditorClient.findDraft(
                        layer.targetScopeType,
                        timetableLayerDialog.schoolDate,
                        timetableLayerDialog.periodNumber,
                      );
                      const serverLayer = loadedLayerState?.layers.find(
                        (candidate) =>
                          candidate.targetScopeType === layer.targetScopeType,
                      );
                      const editable =
                        timetableEditor.editing &&
                        !timetableEditor.submitting &&
                        (!!existingDraft ||
                          (!!serverLayer && !timetableEditor.atLimit));
                      return (
                      <LayerRow
                        key={layer.targetScopeType}
                        label={scopeLabel(
                          layer.targetScopeType,
                          targetScopeContext,
                        )}
                        value={
                          "removalPlanned" in layer && layer.removalPlanned
                            ? "削除予定"
                            : layer.state === "active"
                            ? replacementLabel(layer.replacement)
                            : "変更無し"
                        }
                        detail={
                          layer.desired
                            ? layer.conflicted
                              ? "ほかの変更と重なっています"
                              : "removalPlanned" in layer && layer.removalPlanned
                                ? "削除予定"
                                : "下書きの内容"
                            : layer.state === "active" && "changedAt" in layer
                            ? `最終更新 ${formatRelativeTime(layer.changedAt)}`
                            : undefined
                        }
                        desired={layer.desired}
                        conflicted={layer.conflicted}
                        onClick={
                          editable
                            ? () => openLayerReplacement(layer.targetScopeType)
                            : undefined
                        }
                        menuActions={[
                          ...(timetableEditor.editing &&
                            !timetableEditor.submitting ? [{
                            label: serverLayer?.state === "active"
                              ? "更新"
                              : "追加",
                            onClick: () => openLayerReplacement(
                              layer.targetScopeType,
                            ),
                            disabled: !editable,
                          }] : []),
                          ...(timetableEditor.editing &&
                            !timetableEditor.submitting &&
                            serverLayer?.state === "active" ? [{
                              label: "削除",
                              onClick: () => planLayerRemoval(
                                layer.targetScopeType,
                              ),
                            }] : []),
                          {
                            label: "編集履歴",
                            onClick: () => openLayerHistory(
                              layer.targetScopeType,
                            ),
                          },
                        ]}
                      />
                      );
                    })}
                    <div className="layer-result-row">
                      <span>表示される授業名</span>
                      <strong>
                        {layerPreview.finalDailyLesson.lessonName}
                      </strong>
                    </div>
                  </div>
                ) : null}
              </section>
            </div>
          ) : null}

          {timetableEditorForm && schoolYearRange ? (
            <div className="editor-dialog-backdrop" role="presentation">
              <section
                className="timetable-editor-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="timetable-editor-title"
                onKeyDown={(event) => {
                  if (event.key === "Escape") setTimetableEditorForm(null);
                }}
              >
                <form onSubmit={saveTimetableDraft}>
                  <header className="editor-dialog-header">
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="時間割の変更状況に戻る"
                      onClick={() => setTimetableEditorForm(null)}
                    >
                      ‹
                    </button>
                    <div className="timetable-dialog-heading">
                      <h2 id="timetable-editor-title">時間割変更</h2>
                    </div>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="閉じる"
                      autoFocus
                      onClick={closeTimetableDialogFlow}
                    >
                      ×
                    </button>
                  </header>
                  <div className="editor-fields">
                    <label>
                      変更対象日
                      <output>{formatUiSchoolDate(
                        timetableEditorForm.changeDate,
                        { referenceSchoolDate: selectedSchoolDate },
                      )}</output>
                    </label>
                    <label>
                      時限
                      <output>{timetableEditorForm.periodNumber}限</output>
                    </label>
                    <label className="editor-field-wide">
                      変更適用範囲
                      <output>
                        {scopeLabel(
                          timetableEditorForm.targetScopeType,
                          targetScopeContext,
                        )}
                      </output>
                    </label>
                  </div>

                  <div className="replacement-options">
                    <p className="replacement-section-label">
                      通常の時間割から選択
                    </p>
                    <div
                      className="period-reference-grid"
                      aria-label="通常の時間割から選択"
                    >
                      {Array.from({ length: 7 }, (_, periodIndex) =>
                        Array.from({ length: 6 }, (_, weekdayIndex) => {
                          const selected =
                            timetableEditorForm.replacement.type ===
                              "period_reference" &&
                            timetableEditorForm.replacement.weekday ===
                              weekdayIndex + 1 &&
                            timetableEditorForm.replacement.periodNumber ===
                              periodIndex + 1;
                          return (
                            <button
                              className={selected ? "selected" : ""}
                              type="button"
                              key={`${weekdayIndex}-${periodIndex}`}
                              onClick={() =>
                                setTimetableEditorForm({
                                  ...timetableEditorForm,
                                  replacement: {
                                    type: "period_reference",
                                    weekday: weekdayIndex + 1,
                                    periodNumber: periodIndex + 1,
                                  },
                                })
                              }
                            >
                              {"月火水木金土"[weekdayIndex]}
                              {periodIndex + 1}
                            </button>
                          );
                        }),
                      )}
                    </div>

                    <div className="floating-reference-list">
                      {(
                        timetableEditorOptions?.floatingLessonReferenceLabels ??
                        []
                      ).map((label) => (
                        <button
                          type="button"
                          className={
                            timetableEditorForm.replacement.type ===
                              "floating_lesson_reference" &&
                            timetableEditorForm.replacement
                              .floatingLessonReferenceLabelId ===
                              label.floatingLessonReferenceLabelId
                              ? "selected"
                              : ""
                          }
                          key={label.floatingLessonReferenceLabelId}
                          onClick={() =>
                            setTimetableEditorForm({
                              ...timetableEditorForm,
                              replacement: {
                                type: "floating_lesson_reference",
                                floatingLessonReferenceLabelId:
                                  label.floatingLessonReferenceLabelId,
                                referenceLabel: label.referenceLabel,
                              },
                            })
                          }
                        >
                          {label.referenceLabel}
                        </button>
                      ))}
                    </div>

                    <button
                      className={`replacement-cancel-button${
                        timetableEditorForm.replacement.type === "cancelled"
                          ? " selected"
                          : ""
                      }`}
                      type="button"
                      onClick={() =>
                        setTimetableEditorForm({
                          ...timetableEditorForm,
                          replacement: { type: "cancelled" },
                        })
                      }
                    >
                      休講
                    </button>

                    <div
                      ref={lessonNameComboboxRef}
                      className="lesson-name-combobox"
                      onBlur={(event) =>
                        dismissLessonNameOptionsWhenFocusLeaves(event, () => {
                          setLessonNameListOpen(false);
                          setActiveLessonNameOption(-1);
                        })
                      }
                    >
                      <input
                        className="direct-lesson-input"
                        aria-label="授業名"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded={
                          lessonNameOptionsPopoverOpen
                        }
                        aria-controls="lesson-name-options"
                        aria-activedescendant={
                          lessonNameOptionsPopoverOpen &&
                          lessonNameComboboxSnapshot.activeIndex >= 0
                            ? lessonNameOptionId(
                                "lesson-name-option",
                                lessonNameComboboxSnapshot.activeIndex,
                              )
                            : undefined
                        }
                        maxLength={80}
                        placeholder="または授業名を直接入力"
                        value={
                          timetableEditorForm.replacement.type === "lesson_name"
                            ? timetableEditorForm.replacement.lessonName
                            : ""
                        }
                        onFocus={() => setLessonNameListOpen(true)}
                        onChange={(event) => {
                          setTimetableEditorForm({
                            ...timetableEditorForm,
                            replacement: {
                              type: "lesson_name",
                              lessonName: event.target.value,
                            },
                          });
                          setLessonNameListOpen(true);
                          setActiveLessonNameOption(-1);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                            event.preventDefault();
                            event.stopPropagation();
                            setLessonNameListOpen(true);
                            lessonNameCombobox.moveActive(
                              event.key === "ArrowDown" ? 1 : -1,
                            );
                            setActiveLessonNameOption(
                              lessonNameCombobox.getSnapshot().activeIndex,
                            );
                          } else if (
                            event.key === "Enter" &&
                            lessonNameListOpen &&
                            lessonNameComboboxSnapshot.activeIndex >= 0
                          ) {
                            event.preventDefault();
                            const replacement = lessonNameCombobox.chooseActive();
                            if (!replacement) return;
                            setTimetableEditorForm({
                              ...timetableEditorForm,
                              replacement,
                            });
                            setLessonNameListOpen(false);
                            setActiveLessonNameOption(-1);
                          } else if (
                            event.key === "Escape" &&
                            lessonNameListOpen
                          ) {
                            event.preventDefault();
                            event.stopPropagation();
                            setLessonNameListOpen(false);
                            setActiveLessonNameOption(-1);
                          }
                        }}
                      />
                      {lessonNameOptionsPopoverOpen ? (
                        <LessonNameOptionsPopover
                          listboxId="lesson-name-options"
                          optionIdPrefix="lesson-name-option"
                          options={lessonNameComboboxSnapshot.options}
                          activeIndex={activeLessonNameOption}
                          expandedToAll={lessonNameOptionsExpanded}
                          hasAdditionalOptions={
                            lessonNameComboboxSnapshot.hasAdditionalOptions
                          }
                          onChoose={(option) => {
                            setTimetableEditorForm({
                              ...timetableEditorForm,
                              replacement: {
                                type: "lesson_name",
                                registeredLessonNameId:
                                  option.registeredLessonNameId,
                                lessonName: option.shortLessonName,
                              },
                            });
                            setLessonNameListOpen(false);
                            setActiveLessonNameOption(-1);
                          }}
                          onExpand={() => {
                            lessonNameCombobox.expandToAll();
                            const snapshot = lessonNameCombobox.getSnapshot();
                            setLessonNameOptionsExpanded(
                              snapshot.expandedToAll,
                            );
                            setActiveLessonNameOption(snapshot.activeIndex);
                          }}
                        />
                      ) : null}
                      {timetableEditorForm.replacement.type === "lesson_name" &&
                      timetableEditorOptions &&
                      !timetableEditorForm.replacement.registeredLessonNameId &&
                      timetableEditorForm.replacement.lessonName.trim() &&
                      lessonNameCombobox.resolveInput().custom ? (
                        <p className="custom-lesson-name-warning" role="status">
                          候補にない授業名として保存されます。
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <footer className="editor-dialog-actions">
                    {timetableEditorClient.findDraft(
                      timetableEditorForm.targetScopeType,
                      timetableEditorForm.changeDate,
                      timetableEditorForm.periodNumber,
                    ) ? (
                      <button
                        className="button-secondary"
                        type="button"
                        disabled={timetableEditor.submitting}
                        onClick={() => {
                          timetableEditorClient.restoreServerState(
                            timetableEditorForm.targetScopeType,
                            timetableEditorForm.changeDate,
                            timetableEditorForm.periodNumber,
                          );
                          setTimetableEditorForm(null);
                        }}
                      >
                        下書きを取り消す
                      </button>
                    ) : null}
                    {timetableLayerDialog?.state.status === "ready" &&
                    timetableLayerDialog.state.layers.some(
                      (layer) =>
                        layer.targetScopeType ===
                          timetableEditorForm.targetScopeType &&
                        layer.state === "active",
                    ) ? (
                      <button
                        className="replacement-remove-button"
                        type="button"
                        disabled={timetableEditor.submitting}
                        onClick={planTimetableRemoval}
                      >
                        削除を下書きに追加
                      </button>
                    ) : null}
                    <button
                      className="button-primary"
                      type="submit"
                      disabled={
                        timetableEditor.submitting ||
                        (timetableEditorForm.replacement.type === "lesson_name" &&
                          !timetableEditorForm.replacement
                            .registeredLessonNameId &&
                          !timetableEditorOptions)
                      }
                    >
                      下書きに保存
                    </button>
                  </footer>
                </form>
              </section>
            </div>
          ) : null}
        </section>
      </main>
    );
  }

  if (status === "setup" && setupOptions) {
    const currentGrade = setupOptions.grades.find(
      (gradeOption) => String(gradeOption.grade) === selectedGrade,
    );
    const classOptions = currentGrade?.classes ?? [];
    const currentClass = classOptions.find(
      (classOption) => classOption.classId === selectedClassId,
    );
    const trackOptions = currentClass?.tracks ?? [];

    return (
      <main className="app-page signup-page">
        <section className="panel signup-panel" aria-labelledby="setup-title">
          <div className="signup-header">
            <p className="eyebrow">初回設定</p>
            <h1 id="setup-title">プロフィールを設定</h1>
            <p className="lead">
              認証できました。次に名前・所属情報を入力してください。
            </p>
          </div>
          <form className="form-grid" onSubmit={submitInitialSetup}>
            <label className="field-label" htmlFor="display-name">
              表示名（ハンドルネーム）
            </label>
            <input
              id="display-name"
              className="text-input"
              maxLength={24}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />

            <label className="field-label" htmlFor="real-name">
              本名
            </label>
            <input
              id="real-name"
              className="text-input"
              maxLength={40}
              value={realName}
              onChange={(event) => setRealName(event.target.value)}
            />

            <label className="field-label" htmlFor="grade">
              学年
            </label>
            <select
              id="grade"
              className="text-input"
              value={selectedGrade}
              onChange={(event) => {
                const nextGrade = event.target.value;
                const nextGradeOption = setupOptions.grades.find(
                  (gradeOption) => String(gradeOption.grade) === nextGrade,
                );
                const nextClass = nextGradeOption?.classes[0];

                setSelectedGrade(nextGrade);
                setSelectedClassId(nextClass?.classId ?? "");
                setSelectedTrackId(nextClass?.tracks[0]?.trackId ?? "");
              }}
            >
              {setupOptions.grades.map((gradeOption) => (
                <option key={gradeOption.grade} value={gradeOption.grade}>
                  {gradeOption.grade}年
                </option>
              ))}
            </select>

            <label className="field-label" htmlFor="class-id">
              組
            </label>
            <select
              id="class-id"
              className="text-input"
              value={selectedClassId}
              onChange={(event) => {
                const nextClassId = event.target.value;
                const nextClass = classOptions.find(
                  (classOption) => classOption.classId === nextClassId,
                );

                setSelectedClassId(nextClassId);
                setSelectedTrackId(nextClass?.tracks[0]?.trackId ?? "");
              }}
            >
              {classOptions.map((classOption) => (
                <option key={classOption.classId} value={classOption.classId}>
                  {classOption.classNumber}組
                </option>
              ))}
            </select>

            <label className="field-label" htmlFor="track-id">
              履修タイプ
            </label>
            <select
              id="track-id"
              className="text-input"
              value={selectedTrackId}
              onChange={(event) => setSelectedTrackId(event.target.value)}
            >
              {trackOptions.map((trackOption) => (
                <option key={trackOption.trackId} value={trackOption.trackId}>
                  {trackOption.trackName}
                </option>
              ))}
            </select>

            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={confirmedSetup}
                onChange={(event) => setConfirmedSetup(event.target.checked)}
              />
              所属情報に間違いありません
            </label>

            <button className="button-primary" type="submit">
              この内容で始める
            </button>
          </form>

          {message ? (
            <div
              className={`notice ${
                message.includes("確認しました")
                  ? "notice-success"
                  : "notice-error"
              }`}
            >
              <p>{message}</p>
              {setupSchoolEmail ? (
                <p>
                  認証済みの学校のメール: <strong>{setupSchoolEmail}</strong>
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className="app-page signup-page">
      <section className="panel signup-panel" aria-labelledby="signup-title">
        <div className="signup-header">
          <p className="eyebrow">ログイン</p>
          <h1 id="signup-title">学校のメールでログイン</h1>
          <p className="lead">
            学校のメールの8桁の番号を入力してください。認証コードを送ります。
          </p>
        </div>

        <form className="form-grid" onSubmit={requestVerificationCode}>
          <label className="field-label" htmlFor="school-email-number">
            学校のメールの番号
          </label>
          <div className="input-group">
            <span aria-hidden="true">110-</span>
            <input
              id="school-email-number"
              aria-label="学校のメールの8桁の番号"
              inputMode="numeric"
              maxLength={8}
              pattern="[0-9]{8}"
              placeholder="00000000"
              value={schoolEmailNumber}
              onChange={(event) => setSchoolEmailNumber(event.target.value)}
            />
            <span aria-hidden="true">mkn@e.osakamanabi.jp</span>
          </div>

          <button
            className="button-primary"
            type="submit"
            disabled={status === "sending"}
          >
            {status === "sending" ? "送信中…" : "認証コードを送信"}
          </button>
        </form>

        {message ? (
          <div
            className={`notice ${
              status === "error" ? "notice-error" : "notice-success"
            }`}
          >
            <p>{message}</p>
            {schoolEmail ? (
              <p>
                送信先: <strong>{schoolEmail}</strong>
              </p>
            ) : null}
          </div>
        ) : null}

        {schoolEmail ? (
          <form className="form-grid verify-form" onSubmit={verifyCode}>
            <label className="field-label" htmlFor="verification-code">
              認証コード
            </label>
            <input
              id="verification-code"
              className="text-input"
              inputMode="numeric"
              maxLength={6}
              pattern="[0-9]{6}"
              placeholder="000000"
              value={verificationCode}
              onChange={(event) => setVerificationCode(event.target.value)}
            />
            <button
              className="button-primary"
              type="submit"
              disabled={status === "verifying"}
            >
              {status === "verifying" ? "確認中…" : "認証して進む"}
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}

function LayerRow({
  label,
  value,
  detail,
  desired = false,
  conflicted = false,
  onClick,
  menuActions = [],
}: {
  label: string;
  value: string;
  detail?: string;
  desired?: boolean;
  conflicted?: boolean;
  onClick?: () => void;
  menuActions?: Array<{
    label: string;
    onClick: () => void;
    disabled?: boolean;
  }>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const content = (
    <>
      <span className="timetable-layer-label">{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
      {desired ? (
        <span className={`layer-draft-badge${conflicted ? " conflict" : ""}`}>
          {conflicted ? "要確認" : "下書き"}
        </span>
      ) : null}
    </>
  );
  return (
    <>
      <div
        className={`layer-row-shell${menuActions.length ? " has-menu" : ""}${desired ? " desired" : ""}${conflicted ? " conflict" : ""}`}
      >
        {onClick ? (
          <button
            className={`timetable-layer-row editable${desired ? " desired" : ""}${conflicted ? " conflict" : ""}`}
            type="button"
            onClick={onClick}
            aria-label={`${label}の時間割を編集${desired ? "、下書きあり" : ""}`}
          >
            {content}
          </button>
        ) : (
          <div className={`timetable-layer-row${desired ? " desired" : ""}${conflicted ? " conflict" : ""}`}>
            {content}
          </div>
        )}
        {menuActions.length ? (
          <div className="layer-kebab-area">
            <button
              className="layer-kebab-button"
              type="button"
              aria-label={`${label}のメニュー`}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              ⋮
            </button>
            {menuOpen ? (
              <div className="layer-kebab-menu" role="menu">
                {menuActions.map((action) => (
                  <button
                    type="button"
                    role="menuitem"
                    key={action.label}
                    disabled={action.disabled}
                    onClick={() => {
                      setMenuOpen(false);
                      action.onClick();
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="layer-flow-arrow" aria-hidden="true">
        ↓
      </div>
    </>
  );
}

function PeriodWheelPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (periodNumber: number) => void;
}) {
  const wheelSettleDelay = 120;
  const closeDelay = 250;
  const snapDuration = 100;
  const [open, setOpen] = useState(false);
  const [pendingValue, setPendingValue] = useState(value);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const pendingValueRef = useRef(value);
  const interactionRef = useRef(new PeriodWheelInteraction());
  const viewportMovedRef = useRef(false);
  const scrollSettleTimerRef = useRef<number | null>(null);
  const confirmTimerRef = useRef<number | null>(null);
  const optionClickReleaseTimerRef = useRef<number | null>(null);
  const snapAnimationFrameRef = useRef<number | null>(null);
  const suppressScrollRef = useRef(false);
  const triggerDragCleanupRef = useRef<(() => void) | null>(null);
  const triggerDragRef = useRef<{
    pointerId: number;
    startY: number;
    startScrollTop: number | null;
    moved: boolean;
  } | null>(null);

  function clearTimer(timerRef: { current: number | null }) {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  function clearTriggerDragListeners() {
    triggerDragCleanupRef.current?.();
    triggerDragCleanupRef.current = null;
  }

  function cancelSnapAnimation() {
    if (snapAnimationFrameRef.current === null) return;
    window.cancelAnimationFrame(snapAnimationFrameRef.current);
    snapAnimationFrameRef.current = null;
  }

  function updatePendingValue(periodNumber: number) {
    if (pendingValueRef.current === periodNumber) return;
    pendingValueRef.current = periodNumber;
    setPendingValue(periodNumber);
    onChange(periodNumber);
  }

  function centeredPeriod() {
    const picker = pickerRef.current;
    if (!picker) return pendingValueRef.current;
    const pickerCenter = picker.scrollTop + picker.clientHeight / 2;
    const periods = Array.from(
      picker.querySelectorAll<HTMLElement>("[data-period]"),
    );
    if (periods.length === 0) return pendingValueRef.current;

    return (
      findPeriodClosestToCenter(
        pickerCenter,
        periods.map((period) => ({
          periodNumber: Number(period.dataset.period),
          center: period.offsetTop + period.clientHeight / 2,
        })),
      ) ?? pendingValueRef.current
    );
  }

  function scrollPeriodIntoCenter(
    periodNumber: number,
    behavior: ScrollBehavior = "smooth",
  ) {
    const picker = pickerRef.current;
    const period = picker?.querySelector<HTMLElement>(
      `[data-period="${periodNumber}"]`,
    );
    if (!picker || !period) return;

    picker.scrollTo({
      top: period.offsetTop - (picker.clientHeight - period.clientHeight) / 2,
      behavior,
    });
  }

  function animatePeriodIntoCenter(
    periodNumber: number,
    onComplete?: () => void,
  ) {
    const picker = pickerRef.current;
    if (!picker) return;
    const viewport: HTMLDivElement = picker;
    const period = viewport.querySelector<HTMLElement>(
      `[data-period="${periodNumber}"]`,
    );
    if (!period) return;

    cancelSnapAnimation();
    const startTop = viewport.scrollTop;
    const targetTop =
      period.offsetTop - (viewport.clientHeight - period.clientHeight) / 2;
    const distance = targetTop - startTop;
    if (Math.abs(distance) <= 1) {
      onComplete?.();
      return;
    }

    const startedAt = performance.now();
    function animate(now: number) {
      const progress = Math.min(1, (now - startedAt) / snapDuration);
      const eased = 1 - Math.pow(1 - progress, 3);
      viewport.scrollTop = startTop + distance * eased;
      if (progress < 1) {
        snapAnimationFrameRef.current = window.requestAnimationFrame(animate);
      } else {
        snapAnimationFrameRef.current = null;
        onComplete?.();
      }
    }
    snapAnimationFrameRef.current = window.requestAnimationFrame(animate);
  }

  function periodNeedsCentering(periodNumber: number) {
    const picker = pickerRef.current;
    const period = picker?.querySelector<HTMLElement>(
      `[data-period="${periodNumber}"]`,
    );
    if (!picker || !period) return false;
    const target =
      period.offsetTop - (picker.clientHeight - period.clientHeight) / 2;
    return Math.abs(picker.scrollTop - target) > 1;
  }

  function supportsNativeScrollEnd() {
    return pickerRef.current ? "onscrollend" in pickerRef.current : false;
  }

  function closePicker() {
    clearTimer(scrollSettleTimerRef);
    clearTimer(confirmTimerRef);
    clearTimer(optionClickReleaseTimerRef);
    cancelSnapAnimation();
    clearTriggerDragListeners();
    triggerDragRef.current = null;
    setOpen(false);
  }

  function confirmSelectionAfter(delay: number) {
    clearTimer(confirmTimerRef);
    confirmTimerRef.current = window.setTimeout(() => {
      setOpen(false);
    }, delay);
  }

  function settleScroll() {
    clearTimer(scrollSettleTimerRef);
    if (suppressScrollRef.current) return;
    const periodNumber = centeredPeriod();
    updatePendingValue(periodNumber);
    const action = interactionRef.current.scrollSettled();
    if (action === "stay-open") return;
    if (action === "close-now") {
      closePicker();
      return;
    }
    suppressScrollRef.current = true;
    animatePeriodIntoCenter(periodNumber, () =>
      confirmSelectionAfter(closeDelay),
    );
  }

  function scheduleScrollSettle() {
    clearTimer(scrollSettleTimerRef);
    scrollSettleTimerRef.current = window.setTimeout(
      settleScroll,
      wheelSettleDelay,
    );
  }

  function openPicker() {
    clearTimer(confirmTimerRef);
    updatePendingValue(value);
    setOpen(true);
  }

  useLayoutEffect(() => {
    if (!open) return;

    suppressScrollRef.current = true;
    scrollPeriodIntoCenter(pendingValueRef.current, "auto");
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function closeWhenOutside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        rootRef.current?.contains(event.target)
      )
        return;
      if (scrollSettleTimerRef.current !== null) {
        window.clearTimeout(scrollSettleTimerRef.current);
        scrollSettleTimerRef.current = null;
      }
      if (confirmTimerRef.current !== null) {
        window.clearTimeout(confirmTimerRef.current);
        confirmTimerRef.current = null;
      }
      clearTriggerDragListeners();
      clearTimer(optionClickReleaseTimerRef);
      cancelSnapAnimation();
      triggerDragRef.current = null;
      setOpen(false);
    }

    document.addEventListener("pointerdown", closeWhenOutside);
    return () => document.removeEventListener("pointerdown", closeWhenOutside);
  }, [open]);

  useEffect(
    () => () => {
      clearTimer(scrollSettleTimerRef);
      clearTimer(confirmTimerRef);
      clearTimer(optionClickReleaseTimerRef);
      cancelSnapAnimation();
      clearTriggerDragListeners();
    },
    [],
  );

  function dragFromTrigger(clientY: number) {
    const drag = triggerDragRef.current;
    const picker = pickerRef.current;
    if (!drag || !picker) return;
    if (drag.startScrollTop === null) drag.startScrollTop = picker.scrollTop;
    if (Math.abs(drag.startY - clientY) >= 1) drag.moved = true;
    suppressScrollRef.current = false;
    picker.scrollTop = drag.startScrollTop + drag.startY - clientY;
    updatePendingValue(centeredPeriod());
  }

  return (
    <div
      ref={rootRef}
      className={`period-picker${open ? " open" : ""}`}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          closePicker();
          return;
        }
        if (!open || (event.key !== "ArrowUp" && event.key !== "ArrowDown"))
          return;
        event.preventDefault();
        suppressScrollRef.current = false;
        const next = Math.min(
          7,
          Math.max(
            1,
            pendingValueRef.current + (event.key === "ArrowDown" ? 1 : -1),
          ),
        );
        updatePendingValue(next);
        scrollPeriodIntoCenter(next);
        confirmSelectionAfter(closeDelay);
      }}
    >
      <button
        type="button"
        className="period-picker-trigger"
        aria-label="時限"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? "period-wheel-options" : undefined}
        onPointerDown={(event) => {
          event.preventDefault();
          cancelSnapAnimation();
          interactionRef.current.beginTriggerContact();
          openPicker();
          triggerDragRef.current = {
            pointerId: event.pointerId,
            startY: event.clientY,
            startScrollTop: null,
            moved: false,
          };
          clearTriggerDragListeners();

          function moveFromTrigger(moveEvent: PointerEvent) {
            if (moveEvent.pointerId !== event.pointerId) return;
            moveEvent.preventDefault();
            dragFromTrigger(moveEvent.clientY);
          }

          function finishTriggerDrag(endEvent: PointerEvent) {
            const drag = triggerDragRef.current;
            if (endEvent.pointerId !== event.pointerId || !drag) return;
            clearTriggerDragListeners();
            triggerDragRef.current = null;
            const action = interactionRef.current.endContact(
              endEvent.type === "pointerup" && drag.moved,
            );
            if (action === "wait-for-scroll-settle") {
              scheduleScrollSettle();
            }
            clearTimer(optionClickReleaseTimerRef);
            optionClickReleaseTimerRef.current = window.setTimeout(() => {
              interactionRef.current.allowOptionSelection();
              optionClickReleaseTimerRef.current = null;
            }, 0);
          }

          document.addEventListener("pointermove", moveFromTrigger, {
            passive: false,
          });
          document.addEventListener("pointerup", finishTriggerDrag);
          document.addEventListener("pointercancel", finishTriggerDrag);
          triggerDragCleanupRef.current = () => {
            document.removeEventListener("pointermove", moveFromTrigger);
            document.removeEventListener("pointerup", finishTriggerDrag);
            document.removeEventListener("pointercancel", finishTriggerDrag);
          };
        }}
        onClick={openPicker}
      >
        {value}限
      </button>

      {open ? (
        <div className="period-wheel-popover">
          <div className="period-wheel-selection" aria-hidden="true" />
          <div
            ref={pickerRef}
            id="period-wheel-options"
            className="period-wheel-viewport"
            role="listbox"
            aria-label="時限"
            aria-activedescendant={`period-option-${pendingValue}`}
            onPointerDown={(event) => {
              cancelSnapAnimation();
              suppressScrollRef.current = false;
              clearTimer(confirmTimerRef);
              viewportMovedRef.current = false;
              if (event.pointerType !== "touch") {
                interactionRef.current.beginContact();
              }
            }}
            onTouchStart={() => {
              cancelSnapAnimation();
              interactionRef.current.beginContact();
              viewportMovedRef.current = false;
              clearTimer(confirmTimerRef);
            }}
            onTouchEnd={() => {
              const action = interactionRef.current.endContact(
                viewportMovedRef.current,
              );
              if (action === "wait-for-scroll-settle") {
                scheduleScrollSettle();
              }
            }}
            onTouchCancel={() => {
              interactionRef.current.endContact(false);
              clearTimer(scrollSettleTimerRef);
            }}
            onWheel={() => {
              cancelSnapAnimation();
              suppressScrollRef.current = false;
            }}
            onPointerUp={(event) => {
              if (event.pointerType === "touch") return;
              const action = interactionRef.current.endContact(
                viewportMovedRef.current,
              );
              if (action === "wait-for-scroll-settle") {
                scheduleScrollSettle();
              }
            }}
            onScroll={() => {
              if (suppressScrollRef.current) return;
              viewportMovedRef.current = true;
              clearTimer(confirmTimerRef);
              clearTimer(scrollSettleTimerRef);
              updatePendingValue(centeredPeriod());
              if (!supportsNativeScrollEnd()) scheduleScrollSettle();
            }}
            onScrollEnd={settleScroll}
          >
            {Array.from({ length: 7 }, (_, index) => {
              const periodNumber = index + 1;
              return (
                <button
                  id={`period-option-${periodNumber}`}
                  key={periodNumber}
                  type="button"
                  role="option"
                  aria-selected={periodNumber === pendingValue}
                  tabIndex={-1}
                  data-period={periodNumber}
                  className={
                    periodNumber === pendingValue ? "centered" : undefined
                  }
                  onClick={() => {
                    clearTimer(scrollSettleTimerRef);
                    clearTimer(confirmTimerRef);
                    updatePendingValue(periodNumber);
                    const animationNeeded = periodNeedsCentering(periodNumber);
                    const action = interactionRef.current.selectOption(
                      animationNeeded,
                    );
                    if (action === "stay-open") return;
                    if (action === "close-now") {
                      closePicker();
                      return;
                    }
                    suppressScrollRef.current = true;
                    animatePeriodIntoCenter(periodNumber, closePicker);
                  }}
                >
                  {periodNumber}限
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DirectChangeDetailView({
  detail,
  targetScopeContext,
  referenceSchoolDate,
}: {
  detail: DirectTimetableChangeDetail;
  targetScopeContext?: TargetScopeDisplayContext;
  referenceSchoolDate: string;
}) {
  return (
    <div className="direct-change-detail">
      <dl className="history-detail-grid">
        <div><dt>変更内容</dt><dd>{changeKindLabel(detail.changeKind)}</dd></div>
        <div><dt>反映方法</dt><dd>強制変更</dd></div>
        <div><dt>変更者</dt><dd>{detail.primaryActorDisplayName}</dd></div>
        <div>
          <dt>日時</dt>
          <dd><time dateTime={new Date(detail.changedAt).toISOString()}>
            {formatExactTimestamp(detail.changedAt)}
          </time></dd>
        </div>
        <div>
          <dt>変更対象</dt>
          <dd>{scopeLabel(detail.targetScope.type, targetScopeContext)}</dd>
        </div>
        <div><dt>変更対象日</dt><dd>{formatUiSchoolDate(
          detail.changeDate,
          { referenceSchoolDate },
        )}</dd></div>
        <div><dt>時限</dt><dd>{detail.periodNumber}限</dd></div>
      </dl>
      <div className="stored-transition-detail">
        {detail.before ? (
          <section>
            <span>{detail.changeKind === "remove" ? "削除前" : "変更前"}</span>
            <strong>{replacementLabel(detail.before)}</strong>
            {isStoredReference(detail.before) ? (
              <small>保存時の時間割参照</small>
            ) : null}
          </section>
        ) : null}
        {detail.before && detail.after ? (
          <span className="transition-arrow" aria-hidden="true">→</span>
        ) : null}
        {detail.after ? (
          <section>
            <span>{detail.changeKind === "add" ? "追加後" : "変更後"}</span>
            <strong>{replacementLabel(detail.after)}</strong>
            {isStoredReference(detail.after) ? (
              <small>保存時の時間割参照</small>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}

function storedTransitionLabel(entry: TimetableChangeHistoryEntry) {
  if (entry.changeKind === "add") {
    return `追加 → ${entry.after ? replacementLabel(entry.after) : "空欄"}`;
  }
  if (entry.changeKind === "remove") {
    return `${entry.before ? replacementLabel(entry.before) : "空欄"} → 削除`;
  }
  return `${entry.before ? replacementLabel(entry.before) : "空欄"} → ${
    entry.after ? replacementLabel(entry.after) : "空欄"
  }`;
}

function changeKindLabel(changeKind: TimetableChangeHistoryEntry["changeKind"]) {
  return { add: "追加", update: "更新", remove: "削除" }[changeKind];
}

function formatExactTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(timestamp));
}

function isStoredReference(replacement: TimetableReplacement) {
  return replacement.type === "period_reference" ||
    replacement.type === "floating_lesson_reference";
}

function formatRelativeTime(timestamp: number) {
  const elapsed = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  return `${Math.floor(hours / 24)}日前`;
}

function editableTask(task: DailyPlanTaskForCache) {
  return {
    taskId: task.taskId,
    latestChangeId: task.latestChangeId,
    title: task.title,
    dueDate: task.dueDate,
    relatedLessonName: task.relatedLessonName
      ? {
          lessonName: task.relatedLessonName,
          ...(task.registeredRelatedLessonNameId
            ? {
                registeredLessonNameId:
                  task.registeredRelatedLessonNameId,
              }
            : {}),
        }
      : null,
    targetScopeType: task.targetScopeType,
  };
}

function scopeLabel(
  scope: TargetScopeType,
  context?: TargetScopeDisplayContext,
) {
  return targetScopeLabel(scope, context);
}

function replacementLabel(replacement: TimetableReplacement) {
  if (replacement.type === "lesson_name") return replacement.lessonName;
  if (replacement.type === "period_reference") {
    return `${"月火水木金土"[replacement.weekday - 1]}${replacement.periodNumber}`;
  }
  if (replacement.type === "floating_lesson_reference") {
    return replacement.referenceLabel;
  }
  return "休講";
}

function resolveReplacementLessonName(
  replacement: TimetableReference,
  options: TimetableEditorOptions | null,
) {
  if (replacement.type === "period_reference") {
    return (
      options?.periodReferences.find(
        (reference) =>
          reference.weekday === replacement.weekday &&
          reference.periodNumber === replacement.periodNumber,
      )?.lessonName ?? null
    );
  }
  if (replacement.type === "floating_lesson_reference") {
    return (
      options?.floatingLessonReferenceLabels.find(
        (reference) =>
          reference.floatingLessonReferenceLabelId ===
          replacement.floatingLessonReferenceLabelId,
      )?.lessonName ?? null
    );
  }
  return null;
}

export default App;
