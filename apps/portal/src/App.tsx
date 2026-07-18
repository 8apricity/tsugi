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
  createNewNoteDraftForm,
  createNewTaskDraftForm,
  createSharedInformationEditorClient,
  normalizeDirectLessonReplacement,
  type ActiveTaskForEditing,
  type NewTaskDraftForm,
  type NewNoteDraftForm,
  type NoteDraft,
  type TaskDraft,
  type TargetScopeType,
  type TimetableLayerState,
  type TimetableLayerKey,
  type TimetableReference,
  type TimetableReplacement,
} from "./sharedInformationEditorClient";
import { createSharedInformationDirectChangeTransport } from "./sharedInformationSubmissionTransport";
import type { RegisteredLessonNameOption } from "../shared/lessonNames";
import type {
  DailyPlanNoteForCache,
  DailyPlanTaskForCache,
} from "./dailyPlanCache";
import { NoteCard } from "./noteCard";
import {
  buildVisibleDailyLessonNoteList,
  buildVisibleNoteList,
  buildVisibleTaskNoteList,
} from "./noteListView";
import {
  buildVisibleTaskList,
  type VisibleTask,
  type VisibleTaskListItem,
} from "./taskListView";
import {
  buildChangeContentList,
  changeContentControlState,
  type ChangeContentItem,
  type ChangeContentNoteItem,
  type ChangeContentTaskItem,
  type ChangeContentTimetableItem,
} from "./changeContentList";
import {
  TaskNoteList,
  TaskRemovalConfirmationDialog,
} from "./taskNoteView";
import { DailyLessonNoteList } from "./dailyLessonNoteView";
import { ReferenceDailyPlanNotes } from "./referenceDailyPlanNoteView";
import type {
  ReferenceDailyPlanContent,
  ReferenceScopeOption,
  ReferenceScopeOptions,
} from "../shared/referenceDailyPlan";
import { createReferenceScopeEditingSession } from "./referenceScopeEditing";
import {
  TaskEditHistoryDialog,
  type TaskEditHistoryState,
} from "./taskEditHistoryView";
import { TaskDetailDialog } from "./taskDetailView";
import {
  NoteEditHistoryDialog,
  type NoteEditHistoryState,
} from "./noteEditHistoryView";
import {
  formatSchoolDate as formatUiSchoolDate,
  formatTaskDueLabel,
  targetScopeLabel,
  type TargetScopeDisplayContext,
} from "./uiCopy";
import {
  editorActionLabel,
  hasUnsavedEditorInput,
  lifecycleLabel,
  type EditorKind,
  type LifecycleKind,
} from "./editorLifecycle";
import {
  DiscardConfirmationDialog,
  ImmutableFieldNotice,
  LifecycleIcon,
} from "./editorLifecycleView";
import {
  DirectChangeReviewDialog,
  DraftLogoutConfirmationDialog,
  StaleDirectChangeRefreshAction,
} from "./directChangeReviewView";
import { buildDirectChangeReviewSummary } from "./directChangeReview";
import { DialogBody, DialogHeader, DialogSurface } from "./dialogFoundation";

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
  includeTimetableChange: boolean;
  noteBody: string;
};

type TaskEditorForm = Omit<NewTaskDraftForm, "relatedLessonName"> & {
  relatedLessonInput: string;
  editingTask: ActiveTaskForEditing | null;
  editingDraft: TaskDraft | null;
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

type NoteEditorForm = NewNoteDraftForm & {
  editingNote: DailyPlanNoteForCache | null;
  editingDraft: NoteDraft | null;
  relatedTask: {
    taskId: string;
    title: string;
    targetScopeType: TargetScopeType;
  } | null;
};

type NoteHistoryDialog = {
  note: DailyPlanNoteForCache;
  requestId: number;
  state: NoteEditHistoryState;
};

type PendingEditorDismissal = {
  editor: EditorKind;
  destination: "close" | "back" | "exit-editing";
};

type EditorInitialForms = {
  timetable: TimetableEditorForm | null;
  task: TaskEditorForm | null;
  note: NoteEditorForm | null;
};

type ReferenceScopeOptionsState =
  | { status: "loading" }
  | { status: "error" }
  | ReferenceScopeOptions;

type ReferenceDailyPlanState =
  | { status: "error"; schoolDate: string; referenceScopeValue: string }
  | ({
      status: "ready";
      referenceScopeValue: string;
    } & ReferenceDailyPlanContent);

type PendingChangeContentTimetable = Pick<
  ChangeContentTimetableItem,
  "changeDate" | "periodNumber" | "targetScopeType"
>;

function lessonNameOptionId(prefix: string, index: number) {
  return `${prefix}-${index}`;
}

function referenceScopeKey(scope: ReferenceScopeOption) {
  return `${scope.type}:${scope.value}`;
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

function ClearDateIcon() {
  return (
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
  );
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
  const [referencePickerOpen, setReferencePickerOpen] = useState(false);
  const [referenceScopeOptions, setReferenceScopeOptions] =
    useState<ReferenceScopeOptionsState | null>(null);
  const [referencePickerScopeKey, setReferencePickerScopeKey] = useState("");
  const [referenceScope, setReferenceScope] =
    useState<ReferenceScopeOption | null>(null);
  const [referenceDailyPlan, setReferenceDailyPlan] =
    useState<ReferenceDailyPlanState | null>(null);
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
    createSharedInformationEditorClient({
      storage: window.localStorage,
      draftStorageScope: null,
      submitDirectChanges:
        createSharedInformationDirectChangeTransport(),
    }),
  );
  const [referenceScopeEditingSession] = useState(() =>
    createReferenceScopeEditingSession({
      isEditing: () => timetableEditorClient.getSnapshot().editing,
      pauseEditing: () => timetableEditorClient.exitEditing(),
      resumeEditing: () => timetableEditorClient.enterEditing(),
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
  const [noteEditorForm, setNoteEditorForm] =
    useState<NoteEditorForm | null>(null);
  const [taskRemovalConfirmation, setTaskRemovalConfirmation] =
    useState<DailyPlanTaskForCache | null>(null);
  const editorInitialFormsRef = useRef<EditorInitialForms>({
    timetable: null,
    task: null,
    note: null,
  });
  const [pendingEditorDismissal, setPendingEditorDismissal] =
    useState<PendingEditorDismissal | null>(null);
  const [changeContentOpen, setChangeContentOpen] = useState(false);
  const [directChangeReviewOpen, setDirectChangeReviewOpen] = useState(false);
  const [logoutConfirmationOpen, setLogoutConfirmationOpen] = useState(false);
  const [timetableEditorRefreshNeeded, setTimetableEditorRefreshNeeded] =
    useState(false);
  const changeContentReturnRef = useRef(false);
  const pendingChangeContentTimetableRef =
    useRef<PendingChangeContentTimetable | null>(null);
  const openLayerReplacementRef = useRef<
    (targetScopeType: TargetScopeType) => void
  >(() => undefined);
  const [taskDetail, setTaskDetail] =
    useState<VisibleTaskListItem | null>(null);
  const [taskHistoryDialog, setTaskHistoryDialog] =
    useState<TaskHistoryDialog | null>(null);
  const [noteHistoryDialog, setNoteHistoryDialog] =
    useState<NoteHistoryDialog | null>(null);
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
      taskEditorForm || noteEditorForm || taskRemovalConfirmation || taskDetail || taskHistoryDialog ||
      noteHistoryDialog || referencePickerOpen || changeContentOpen ||
      directChangeReviewOpen || logoutConfirmationOpen,
  );
  const dialogOpenRef = useRef(timetableDialogOpen);
  const dialogHistoryActiveRef = useRef(false);
  const ignoreDialogPopStateRef = useRef(false);
  const browserBackHandlerRef = useRef<() => boolean>(() => false);
  const [dialogHistoryRevision, setDialogHistoryRevision] = useState(0);

  useEffect(() => {
    if (!timetableDialogOpen) return;

    return lockPageScroll(document);
  }, [timetableDialogOpen]);

  useEffect(() => {
    dialogOpenRef.current = timetableDialogOpen;
  }, [timetableDialogOpen]);

  useEffect(() => {
    if (!timetableDialogOpen) {
      const shouldRemoveHistoryEntry =
        dialogHistoryActiveRef.current && window.history.state?.tsugiDialog;
      dialogHistoryActiveRef.current = false;
      if (shouldRemoveHistoryEntry) {
        ignoreDialogPopStateRef.current = true;
        window.history.back();
      }
      return;
    }
    if (dialogHistoryActiveRef.current) return;
    window.history.pushState(
      {
        ...(window.history.state && typeof window.history.state === "object"
          ? window.history.state
          : {}),
        tsugiDialog: true,
      },
      "",
      window.location.href,
    );
    dialogHistoryActiveRef.current = true;
  }, [dialogHistoryRevision, timetableDialogOpen]);

  useEffect(() => {
    const handlePopState = () => {
      if (ignoreDialogPopStateRef.current) {
        ignoreDialogPopStateRef.current = false;
        return;
      }
      if (!dialogOpenRef.current) return;
      dialogHistoryActiveRef.current = false;
      browserBackHandlerRef.current();
      setDialogHistoryRevision((revision) => revision + 1);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!timetableDialogOpen) return;

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      browserBackHandlerRef.current();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [timetableDialogOpen]);

  useEffect(() => {
    if (!timetableEditorMessage || timetableEditorRefreshNeeded) return;

    const timeoutId = window.setTimeout(() => {
      setTimetableEditorMessage(null);
    }, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [timetableEditorMessage, timetableEditorRefreshNeeded]);

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
    timetableEditorClient.setDraftStorageScope(studentAccount?.schoolEmail ?? null);
  }, [studentAccount, timetableEditorClient]);

  useEffect(() => {
    if (status !== "authenticated" || !studentAccount) {
      return;
    }

    shouldCenterDatePickerRef.current = true;
    dailyPlanClient.reset();
    void dailyPlanClient.loadSelectedDailyPlan();
  }, [dailyPlanClient, status, studentAccount]);

  useEffect(() => {
    if (!referenceScope) return;
    const controller = new AbortController();
    const url = new URL("/api/daily-plans/reference", window.location.origin);
    url.searchParams.set("date", selectedSchoolDate);
    url.searchParams.set("scope", referenceScope.type);
    url.searchParams.set("value", referenceScope.value);
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Reference Daily Plan unavailable");
        return response.json() as Promise<ReferenceDailyPlanContent & { status: "ready" }>;
      })
      .then((dailyPlan) => setReferenceDailyPlan({
        ...dailyPlan,
        referenceScopeValue: referenceScope.value,
      }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setReferenceDailyPlan({
          status: "error",
          schoolDate: selectedSchoolDate,
          referenceScopeValue: referenceScope.value,
        });
      });
    return () => controller.abort();
  }, [referenceScope, selectedSchoolDate]);

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
    const pending = pendingChangeContentTimetableRef.current;
    if (
      !pending ||
      !timetableLayerDialog ||
      timetableLayerDialog.schoolDate !== pending.changeDate ||
      timetableLayerDialog.periodNumber !== pending.periodNumber ||
      timetableLayerDialog.state.status !== "ready" ||
      timetableEditorForm
    ) {
      return;
    }
    pendingChangeContentTimetableRef.current = null;
    openLayerReplacementRef.current(pending.targetScopeType);
  }, [timetableEditorForm, timetableLayerDialog]);

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
    if (!noteHistoryDialog || noteHistoryDialog.state.status !== "loading") {
      return;
    }
    const { note, requestId } = noteHistoryDialog;
    const controller = new AbortController();
    fetch(`/api/notes/${encodeURIComponent(note.noteId)}/history`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Note Edit History unavailable");
        return response.json() as Promise<
          Extract<NoteEditHistoryState, { status: "ready" }>
        >;
      })
      .then((history) => {
        setNoteHistoryDialog((current) =>
          current?.note.noteId === note.noteId && current.requestId === requestId
            ? { ...current, state: history }
            : current,
        );
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setNoteHistoryDialog((current) =>
          current?.note.noteId === note.noteId && current.requestId === requestId
            ? { ...current, state: { status: "error" } }
            : current,
        );
      });
    return () => controller.abort();
  }, [noteHistoryDialog]);

  useEffect(() => {
    if (dailyPlanState.status !== "ready") return;
    timetableEditorClient.reconcileActiveNotes(
      [
        ...dailyPlanState.dailyPlan.notes,
        ...dailyPlanState.dailyPlan.tasks.flatMap((task) => task.notes),
        ...dailyPlanState.dailyPlan.periods.flatMap((period) => period.notes),
      ].map((note) => ({
        noteId: note.noteId,
        latestChangeId: note.latestChangeId,
        body: note.body,
        schoolDate: noteSchoolDate(note),
        periodNumber: notePeriodNumber(note),
        targetScopeType: note.targetScopeType,
        ...(note.relatedContext?.type === "task"
          ? { relatedTaskItemId: note.relatedContext.taskId }
          : {}),
      })),
      dailyPlanState.dailyPlan.schoolDate,
    );
  }, [dailyPlanState, timetableEditorClient]);

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

  function requestLogout() {
    setMenuOpen(false);
    if (timetableEditor.draftCount > 0) {
      setLogoutConfirmationOpen(true);
      return;
    }
    void logout();
  }

  async function logout() {
    setLogoutConfirmationOpen(false);
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => undefined);
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
    setNoteEditorForm(null);
    setTaskRemovalConfirmation(null);
    clearEditorInitialForms();
    setPendingEditorDismissal(null);
    setTaskDetail(null);
    setTaskHistoryDialog(null);
    setNoteHistoryDialog(null);
    setTimetableLayerDialog(null);
    setTimetableEditorOptions(null);
    setReferencePickerOpen(false);
    setReferenceScopeOptions(null);
    setReferencePickerScopeKey("");
    setReferenceScope(null);
    referenceScopeEditingSession.reset();
    setMenuOpen(false);
    setChangeContentOpen(false);
    setDirectChangeReviewOpen(false);
    setTimetableEditorRefreshNeeded(false);
    changeContentReturnRef.current = false;
    pendingChangeContentTimetableRef.current = null;
    setStatus("idle");
    setMessage("ログアウトしました。");
  }

  function enterTimetableEditing() {
    setTimetableEditorMessage(null);
    timetableEditorClient.enterEditing();
  }

  function finishLeavingTimetableEditing() {
    timetableEditorClient.exitEditing();
    setTimetableEditorForm(null);
    setTaskEditorForm(null);
    setNoteEditorForm(null);
    setTaskRemovalConfirmation(null);
    clearEditorInitialForms();
    setPendingEditorDismissal(null);
    setChangeContentOpen(false);
    setDirectChangeReviewOpen(false);
    changeContentReturnRef.current = false;
    pendingChangeContentTimetableRef.current = null;
    setTimetableEditorMessage(null);
  }

  function leaveTimetableEditing() {
    const openEditor = timetableEditorForm
      ? "timetable"
      : taskEditorForm
        ? "task"
        : noteEditorForm
          ? "note"
          : null;
    if (
      openEditor &&
      requestEditorDismissal(openEditor, "exit-editing")
    ) return;
    finishLeavingTimetableEditing();
  }

  function returnToChangeContentIfNeeded() {
    if (!changeContentReturnRef.current) return;
    changeContentReturnRef.current = false;
    setChangeContentOpen(true);
  }

  function openTaskEditorForm(form: TaskEditorForm) {
    editorInitialFormsRef.current.task = form;
    setTaskEditorForm(form);
  }

  function openNoteEditorForm(form: NoteEditorForm) {
    editorInitialFormsRef.current.note = form;
    setNoteEditorForm(form);
  }

  function clearEditorInitialForms() {
    editorInitialFormsRef.current = {
      timetable: null,
      task: null,
      note: null,
    };
  }

  function editorFormIsDirty(editor: EditorKind) {
    if (editor === "timetable") {
      return Boolean(
        timetableEditorForm &&
        editorInitialFormsRef.current.timetable &&
        hasUnsavedEditorInput(
          editorInitialFormsRef.current.timetable,
          timetableEditorForm,
        ),
      );
    }
    if (editor === "task") {
      return Boolean(
        taskEditorForm &&
        editorInitialFormsRef.current.task &&
        hasUnsavedEditorInput(editorInitialFormsRef.current.task, taskEditorForm),
      );
    }
    return Boolean(
      noteEditorForm &&
      editorInitialFormsRef.current.note &&
      hasUnsavedEditorInput(editorInitialFormsRef.current.note, noteEditorForm),
    );
  }

  function requestEditorDismissal(
    editor: EditorKind,
    destination: PendingEditorDismissal["destination"] = "close",
  ) {
    if (editorFormIsDirty(editor)) {
      setPendingEditorDismissal({ editor, destination });
      return true;
    }
    return false;
  }

  function closeTaskEditorFlow() {
    setTaskEditorForm(null);
    editorInitialFormsRef.current.task = null;
    setTaskLessonNameListOpen(false);
    setActiveTaskLessonNameOption(-1);
    returnToChangeContentIfNeeded();
  }

  function closeNoteEditorFlow() {
    setNoteEditorForm(null);
    editorInitialFormsRef.current.note = null;
    setLessonNameListOpen(false);
    setActiveLessonNameOption(-1);
    returnToChangeContentIfNeeded();
  }

  function requestTaskEditorClose() {
    if (!requestEditorDismissal("task")) closeTaskEditorFlow();
  }

  function requestNoteEditorClose() {
    if (!requestEditorDismissal("note")) closeNoteEditorFlow();
  }

  function taskEditingSnapshotFromChangeItem(item: ChangeContentTaskItem) {
    if (!item.draft || item.draft.changeKind === "add") return null;
    const baseTask = item.draft.baseTask;
    return baseTask ?? {
      taskId: item.task.taskId,
      latestChangeId: item.draft.expectedLatestChangeId,
      title: item.task.title,
      dueDate: item.task.dueDate,
      relatedLessonName: item.draft.relatedLessonName,
      targetScopeType: item.task.targetScopeType,
      notes: [],
    };
  }

  function visibleTaskFromChangeItem(item: ChangeContentTaskItem): VisibleTask {
    const baseTask = item.draft && item.draft.changeKind !== "add"
      ? item.draft.baseTask
      : undefined;
    return {
      taskId: item.task.taskId,
      title: item.task.title,
      dueDate: item.task.dueDate,
      ...(item.task.relatedLessonName
        ? { relatedLessonName: item.task.relatedLessonName }
        : {}),
      targetScopeType: item.task.targetScopeType,
      notes: baseTask?.notes ?? [],
    };
  }

  function openChangeContentNote(item: ChangeContentNoteItem) {
    if (item.source !== "draft") return;
    setChangeContentOpen(false);
    changeContentReturnRef.current = true;
    if (item.relatedTask) {
      openTaskNoteEditor(
        item.relatedTask,
        undefined,
        item.draft,
      );
      return;
    }
    openNoteDraftEditor(item.draft);
  }

  function openChangeContentTask(item: ChangeContentTaskItem) {
    if (!item.draft) return;
    setChangeContentOpen(false);
    changeContentReturnRef.current = true;
    if (item.draft.changeKind === "add") {
      openTaskDraftEditor(item.draft);
      return;
    }
    const editingTask = taskEditingSnapshotFromChangeItem(item);
    if (!editingTask) return;
    openTaskUpdateEditor(editingTask, visibleTaskFromChangeItem(item));
  }

  function openTimetableEditorAt(schoolDate: string, periodNumber: number) {
    setTimetableEditorForm(null);
    editorInitialFormsRef.current.timetable = null;
    const cached = timetableLayerCacheRef.current.get(schoolDate, periodNumber);
    setTimetableLayerDialog({
      schoolDate,
      periodNumber,
      requestId: 0,
      state: cached ?? { status: "loading" },
    });
  }

  function openChangeContentTimetable(item: ChangeContentTimetableItem) {
    setChangeContentOpen(false);
    changeContentReturnRef.current = true;
    pendingChangeContentTimetableRef.current = {
      changeDate: item.changeDate,
      periodNumber: item.periodNumber,
      targetScopeType: item.targetScopeType,
    };
    selectSchoolDate(item.changeDate, false);
    openTimetableEditorAt(item.changeDate, item.periodNumber);
  }

  function openChangeContentItem(item: ChangeContentItem) {
    if (item.kind === "timetable") {
      openChangeContentTimetable(item);
    } else if (item.kind === "task") {
      openChangeContentTask(item);
    } else {
      openChangeContentNote(item);
    }
  }

  function changeContentDateLabel(schoolDate: string | null) {
    return schoolDate
      ? formatUiSchoolDate(schoolDate, { referenceSchoolDate: selectedSchoolDate })
      : "日付なし";
  }

  function changeContentStatus(
    changeKind: "add" | "update" | "remove" | null,
    conflicted: boolean,
  ) {
    if (changeKind === null) return "関連タスク";
    return lifecycleLabel(changeKind, conflicted);
  }

  function changeContentScopeContext() {
    const state = dailyPlanClient.getSnapshot().dailyPlanState;
    return state.status === "ready" ? state.dailyPlan.studentAffiliation : undefined;
  }

  function changeContentItemView(item: ChangeContentItem) {
    if (item.kind === "timetable") {
      const replacement = item.replacement ?? item.serverReplacement;
      const value = item.changeKind === "remove"
        ? "削除予定"
        : replacement
          ? replacementLabel(replacement)
          : "変更内容";
      return (
        <li key={item.id}>
          <button
            className={`change-content-item change-content-${item.kind} change-content-${item.changeKind}${item.conflicted ? " conflicted" : ""}`}
            type="button"
            data-change-content-kind={item.kind}
            data-change-kind={item.changeKind}
            onClick={() => openChangeContentItem(item)}
          >
            <LifecycleIcon
              className="change-content-icon"
              kind={item.changeKind}
              conflicted={item.conflicted}
            />
            <span className="change-content-main">
              <strong>{item.periodNumber}限の時間割</strong>
              <small>
                {changeContentDateLabel(item.changeDate)}・
                {scopeLabel(item.targetScopeType, changeContentScopeContext())}
              </small>
              {item.changeKind === "update" ? (
                <span className="change-content-diff">
                  <small>変更前: {item.beforeReplacement ? replacementLabel(item.beforeReplacement) : "なし"}</small>
                  <small>変更後: {item.afterReplacement ? replacementLabel(item.afterReplacement) : "なし"}</small>
                </span>
              ) : (
                <span>{value}</span>
              )}
            </span>
            <span className="change-content-status">
              {changeContentStatus(item.changeKind, item.conflicted)}
            </span>
            <span aria-hidden="true">›</span>
          </button>
        </li>
      );
    }

    if (item.kind === "task") {
      const taskRow = item.draft ? (
        <button
          className={`change-content-item change-content-${item.kind} change-content-${item.changeKind}${item.conflicted ? " conflicted" : ""}`}
          type="button"
          data-change-content-kind={item.kind}
          data-change-kind={item.draft.changeKind}
          onClick={() => openChangeContentItem(item)}
        >
          <LifecycleIcon
            className="change-content-icon"
            kind={item.draft.changeKind}
            conflicted={item.conflicted}
          />
          <span className="change-content-main">
            <strong>{item.task.title}</strong>
            <small>
              {changeContentDateLabel(item.task.dueDate)}・
              {scopeLabel(item.task.targetScopeType, changeContentScopeContext())}
              {item.task.relatedLessonName ? `・${item.task.relatedLessonName}` : ""}
            </small>
            {item.draft.changeKind === "update" ? (
              <span className="change-content-diff">
                <small>変更前: {item.beforeTask ? `${item.beforeTask.title}・${formatTaskDueLabel(item.beforeTask.dueDate, selectedSchoolDate)}` : "確認できません"}</small>
                <small>変更後: {item.task.title}・{formatTaskDueLabel(item.task.dueDate, selectedSchoolDate)}</small>
              </span>
            ) : item.draft.changeKind === "remove" ? (
              <span className="change-content-diff">
                <small>変更前: {item.task.title}・{formatTaskDueLabel(item.task.dueDate, selectedSchoolDate)}</small>
                <small>変更後: 削除予定</small>
              </span>
            ) : null}
          </span>
          <span className="change-content-status">
            {changeContentStatus(item.changeKind, item.conflicted)}
          </span>
          <span aria-hidden="true">›</span>
        </button>
      ) : (
        <div className="change-content-item change-content-task related-task-group">
          <span className="related-task-icon" aria-hidden="true">↳</span>
          <span className="change-content-main">
            <strong>{item.task.title}</strong>
            <small>{changeContentDateLabel(item.task.dueDate)}・関連するタスク</small>
          </span>
          <span className="change-content-status">ノートの変更</span>
        </div>
      );
      return (
        <li key={item.id}>
          {taskRow}
          {item.children.length > 0 ? (
            <ul className="change-content-children" aria-label={`${item.task.title}のノート`}>
              {item.children.map((child) => (
                <li key={child.id}>
                  {child.source === "task-cascade" ? (
                    <div
                      className="change-content-item change-content-note change-content-remove nested cascade-projection"
                      data-change-content-kind="note"
                      data-change-kind="remove"
                      data-change-content-projection="task-cascade"
                    >
                      <LifecycleIcon
                        className="change-content-icon"
                        kind="remove"
                        conflicted={false}
                      />
                      <span className="change-content-main">
                        <strong>ノート</strong>
                        <span className="change-content-diff">
                          <small>変更前: {child.beforeBody ?? child.body}</small>
                          <small>変更後: 削除予定</small>
                        </span>
                      </span>
                      <span className="change-content-status">
                        タスクに伴い削除予定
                      </span>
                    </div>
                  ) : (
                  <button
                    className={`change-content-item change-content-note change-content-${child.changeKind} nested${child.conflicted ? " conflicted" : ""}`}
                    type="button"
                    data-change-content-kind="note"
                    data-change-kind={child.changeKind}
                    onClick={() => openChangeContentItem(child)}
                  >
                    <LifecycleIcon
                      className="change-content-icon"
                      kind={child.changeKind}
                      conflicted={child.conflicted}
                    />
                    <span className="change-content-main">
                      <strong>ノート</strong>
                      {child.changeKind === "update" ? (
                        <span className="change-content-diff">
                          <small>変更前: {child.beforeBody ?? "確認できません"}</small>
                          <small>変更後: {child.afterBody ?? "なし"}</small>
                        </span>
                      ) : child.changeKind === "remove" ? (
                        <span className="change-content-diff">
                          <small>変更前: {child.beforeBody ?? child.body}</small>
                          <small>変更後: 削除予定</small>
                        </span>
                      ) : (
                        <small>{child.body}</small>
                      )}
                    </span>
                    <span className="change-content-status">
                      {changeContentStatus(child.changeKind, child.conflicted)}
                    </span>
                    <span aria-hidden="true">›</span>
                  </button>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      );
    }

    return (
      <li key={item.id}>
        <button
          className={`change-content-item change-content-note change-content-${item.changeKind}${item.conflicted ? " conflicted" : ""}`}
          type="button"
          data-change-content-kind={item.kind}
          data-change-kind={item.changeKind}
          onClick={() => openChangeContentItem(item)}
        >
          <LifecycleIcon
            className="change-content-icon"
            kind={item.changeKind}
            conflicted={item.conflicted}
          />
          <span className="change-content-main">
            <strong>ノート</strong>
            <small>
              {changeContentDateLabel(item.schoolDate)}・
              {scopeLabel(item.targetScopeType, changeContentScopeContext())}
            </small>
            {item.changeKind === "update" ? (
              <span className="change-content-diff">
                <small>変更前: {item.beforeBody ?? "確認できません"}</small>
                <small>変更後: {item.afterBody ?? "なし"}</small>
              </span>
            ) : item.changeKind === "remove" ? (
              <span className="change-content-diff">
                <small>変更前: {item.beforeBody ?? item.body}</small>
                <small>変更後: 削除予定</small>
              </span>
            ) : (
              <span>{item.body}</span>
            )}
          </span>
          <span className="change-content-status">
            {changeContentStatus(item.changeKind, item.conflicted)}
          </span>
          <span aria-hidden="true">›</span>
        </button>
      </li>
    );
  }

  function openTaskEditor() {
    const initial = createNewTaskDraftForm(selectedSchoolDate);
    setTaskLessonNamesExpanded(false);
    setTaskLessonNameListOpen(false);
    setActiveTaskLessonNameOption(-1);
    openTaskEditorForm({
      title: initial.title,
      dueDate: initial.dueDate,
      targetScopeType: initial.targetScopeType,
      relatedLessonInput: "",
      editingTask: null,
      editingDraft: null,
    });
  }

  function openNoteEditor() {
    openNoteEditorForm({
      ...createNewNoteDraftForm(selectedSchoolDate),
      editingNote: null,
      editingDraft: null,
      relatedTask: null,
    });
  }

  function noteSchoolDate(note: DailyPlanNoteForCache) {
    return note.relatedContext?.type === "school-date" ||
      note.relatedContext?.type === "daily-lesson"
      ? note.relatedContext.schoolDate
      : null;
  }

  async function loadReferenceScopeOptions() {
    setReferenceScopeOptions({ status: "loading" });
    try {
      const response = await fetch("/api/daily-plans/reference/options");
      if (!response.ok) throw new Error("Reference Scope options unavailable");
      const options = (await response.json()) as ReferenceScopeOptions;
      setReferenceScopeOptions(options);
      setReferencePickerScopeKey(
        options.options.length > 0
          ? referenceScopeKey(options.options[0])
          : "",
      );
    } catch {
      setReferenceScopeOptions({ status: "error" });
    }
  }

  function openReferencePicker() {
    setMenuOpen(false);
    setReferencePickerOpen(true);
    if (referenceScope) {
      setReferencePickerScopeKey(referenceScopeKey(referenceScope));
    }
    if (referenceScopeOptions === null) {
      void loadReferenceScopeOptions();
    }
  }

  function selectReferenceScope(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (referenceScopeOptions?.status !== "ready") return;
    const option = referenceScopeOptions.options.find(
      (candidate) => referenceScopeKey(candidate) === referencePickerScopeKey,
    );
    if (!option) return;
    if (
      referenceScope?.type === option.type &&
      referenceScope.value === option.value
    ) {
      setReferencePickerOpen(false);
      return;
    }
    setReferenceDailyPlan(null);
    referenceScopeEditingSession.enterReferenceScope();
    setReferenceScope(option);
    setReferencePickerOpen(false);
  }

  function leaveReferenceScope() {
    setReferenceScope(null);
    referenceScopeEditingSession.leaveReferenceScope();
    setMenuOpen(false);
  }

  function notePeriodNumber(note: DailyPlanNoteForCache) {
    return note.relatedContext?.type === "daily-lesson"
      ? note.relatedContext.periodNumber
      : null;
  }

  function openNoteUpdateEditor(note: DailyPlanNoteForCache) {
    openNoteEditorForm({
      body: note.body,
      schoolDate: noteSchoolDate(note),
      periodNumber: notePeriodNumber(note),
      targetScopeType: note.targetScopeType,
      editingNote: note,
      editingDraft: null,
      relatedTask: null,
    });
  }

  function openNoteDraftEditor(draft: NoteDraft) {
    openNoteEditorForm({
      body: draft.body,
      schoolDate: draft.schoolDate,
      periodNumber: draft.periodNumber,
      targetScopeType: draft.targetScopeType,
      editingNote: null,
      editingDraft: draft,
      relatedTask: null,
    });
  }

  function openTaskNoteEditor(
    task: { taskId: string; title: string; targetScopeType: TargetScopeType },
    note?: DailyPlanNoteForCache,
    draft?: NoteDraft,
  ) {
    if (taskDetail?.task.taskId === task.taskId) setTaskDetail(null);
    openNoteEditorForm({
      body: note?.body ?? draft?.body ?? "",
      schoolDate: null,
      periodNumber: null,
      targetScopeType: task.targetScopeType,
      editingNote: note ?? null,
      editingDraft: draft ?? null,
      relatedTask: task,
    });
  }

  function saveNoteRemoveDraft(note: DailyPlanNoteForCache) {
    const result = timetableEditorClient.saveNoteRemoveDraft({
      noteId: note.noteId,
      latestChangeId: note.latestChangeId,
      body: note.body,
      schoolDate: noteSchoolDate(note),
      periodNumber: notePeriodNumber(note),
      targetScopeType: note.targetScopeType,
      ...(note.relatedContext?.type === "task"
        ? { relatedTaskItemId: note.relatedContext.taskId }
        : {}),
    });
    if (result.status === "limit-reached") {
      setTimetableEditorMessage("下書きは合計50件までです。");
    }
  }

  function openNoteHistory(note: DailyPlanNoteForCache) {
    setNoteHistoryDialog({
      note,
      requestId: Date.now(),
      state: { status: "loading" },
    });
  }

  function saveNoteDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!noteEditorForm || timetableEditor.submitting) return;
    const result = noteEditorForm.editingDraft
      ? timetableEditorClient.updateNoteDraft(
          noteEditorForm.editingDraft.sourceId,
          noteEditorForm,
        )
      : noteEditorForm.editingNote
      ? timetableEditorClient.saveNoteUpdateDraft(
          {
            noteId: noteEditorForm.editingNote.noteId,
            latestChangeId: noteEditorForm.editingNote.latestChangeId,
            body: noteEditorForm.editingNote.body,
            schoolDate: noteSchoolDate(noteEditorForm.editingNote),
            periodNumber: notePeriodNumber(noteEditorForm.editingNote),
            targetScopeType: noteEditorForm.editingNote.targetScopeType,
            ...(noteEditorForm.editingNote.relatedContext?.type === "task"
              ? {
                  relatedTaskItemId:
                    noteEditorForm.editingNote.relatedContext.taskId,
                }
              : {}),
          },
          noteEditorForm.body,
        )
      : noteEditorForm.relatedTask
      ? timetableEditorClient.saveTaskNoteDraft(
          noteEditorForm.relatedTask,
          noteEditorForm.body,
        )
      : timetableEditorClient.saveNoteDraft(noteEditorForm);
    if (result.status === "invalid-note") {
      setTimetableEditorMessage(
        "本文、日付、変更適用範囲を確認してください。",
      );
      return;
    }
    if (result.status === "limit-reached") {
      setTimetableEditorMessage("下書きは合計50件までです。");
      return;
    }
    closeNoteEditorFlow();
    setTimetableEditorMessage(null);
  }

  function openTaskUpdateEditor(
    task: ActiveTaskForEditing,
    projectedTask?: VisibleTask,
  ) {
    setTaskLessonNamesExpanded(false);
    setTaskLessonNameListOpen(false);
    setActiveTaskLessonNameOption(-1);
    openTaskEditorForm({
      title: projectedTask?.title ?? task.title,
      dueDate: projectedTask?.dueDate ?? task.dueDate,
      targetScopeType: task.targetScopeType,
      relatedLessonInput: projectedTask?.relatedLessonName ??
        task.relatedLessonName?.lessonName ?? "",
      editingTask: task,
      editingDraft: null,
    });
    setTaskDetail(null);
  }

  function openTaskDraftEditor(draft: TaskDraft) {
    if (draft.changeKind !== "add") return;
    setTaskLessonNamesExpanded(false);
    setTaskLessonNameListOpen(false);
    setActiveTaskLessonNameOption(-1);
    openTaskEditorForm({
      title: draft.title,
      dueDate: draft.dueDate,
      targetScopeType: draft.targetScopeType,
      relatedLessonInput: draft.relatedLessonName?.lessonName ?? "",
      editingTask: null,
      editingDraft: draft,
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
      taskEditorForm.editingTask?.relatedLessonName?.registeredLessonNameId &&
        lessonInput === taskEditorForm.editingTask.relatedLessonName.lessonName
        ? {
            lessonName: lessonInput,
            registeredLessonNameId:
              taskEditorForm.editingTask.relatedLessonName.registeredLessonNameId,
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
    const result = taskEditorForm.editingDraft
      ? timetableEditorClient.updateTaskDraft(
          taskEditorForm.editingDraft.sourceId,
          {
            title: taskEditorForm.title,
            dueDate: taskEditorForm.dueDate,
            targetScopeType: taskEditorForm.targetScopeType,
            relatedLessonName,
          },
        )
      : taskEditorForm.editingTask
      ? timetableEditorClient.saveTaskUpdateDraft(
          taskEditorForm.editingTask,
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
    closeTaskEditorFlow();
    setTimetableEditorMessage(null);
  }

  function taskNoteList(
    task: {
      taskId: string;
      title: string;
      targetScopeType: TargetScopeType;
    },
    activeNotes: DailyPlanNoteForCache[],
    taskRemovalPlanned = false,
  ) {
    const items = buildVisibleTaskNoteList(
      activeNotes,
      timetableEditor.noteDrafts,
      task.taskId,
      { taskRemovalPlanned },
    ).map((item) => {
      if (item.type === "draft") {
        const note = item.draft;
        return {
          noteId: note.sourceId,
          body: note.body,
          draft: true,
          changeKind: note.changeKind,
          conflicted: note.conflicted,
          onCancelDraft: () =>
            timetableEditorClient.removeNoteDraft(note.sourceId),
          onEdit: note.changeKind === "remove"
            ? undefined
            : () => openTaskNoteEditor(task, undefined, note),
          onOpenHistory: item.activeNote
            ? () => openNoteHistory(item.activeNote!)
          : undefined,
        };
      }
      if (item.type === "cascade-removal") {
        const note = item.note;
        return {
          noteId: note.noteId,
          body: note.body,
          draft: true,
          changeKind: "remove" as const,
          removalReason: "task-cascade" as const,
          onOpenHistory: () => openNoteHistory(note),
        };
      }
      const note = item.note;
      return {
        noteId: note.noteId,
        body: note.body,
        onEdit: timetableEditor.editing
          ? () => openTaskNoteEditor(task, note)
          : undefined,
        onRemove: timetableEditor.editing
          ? () => saveNoteRemoveDraft(note)
          : undefined,
        onOpenHistory: () => openNoteHistory(note),
      };
    });
    return <TaskNoteList notes={items} />;
  }

  function dailyLessonNoteList(
    activeNotes: DailyPlanNoteForCache[],
    schoolDate: string,
    periodNumber: number,
    scopeContext: TargetScopeDisplayContext | undefined,
    targetScopeType?: TargetScopeType,
    className?: string,
  ) {
    const items = buildVisibleDailyLessonNoteList(
      activeNotes,
      timetableEditor.noteDrafts,
      schoolDate,
      periodNumber,
      targetScopeType,
    ).map((item) => {
      if (item.type === "draft") {
        const note = item.draft;
        return {
          noteId: note.sourceId,
          body: note.body,
          targetScopeLabel: scopeLabel(note.targetScopeType, scopeContext),
          draft: true,
          changeKind: note.changeKind,
          conflicted: note.conflicted,
          onCancelDraft: () =>
            timetableEditorClient.removeNoteDraft(note.sourceId),
          onEdit: note.changeKind === "remove"
            ? undefined
            : () => openNoteDraftEditor(note),
          onOpenHistory: item.activeNote
            ? () => openNoteHistory(item.activeNote!)
            : undefined,
        };
      }
      const note = item.note;
      return {
        noteId: note.noteId,
        body: note.body,
        targetScopeLabel: scopeLabel(note.targetScopeType, scopeContext),
        onEdit: timetableEditor.editing
          ? () => openNoteUpdateEditor(note)
          : undefined,
        onRemove: timetableEditor.editing
          ? () => saveNoteRemoveDraft(note)
          : undefined,
        onOpenHistory: () => openNoteHistory(note),
      };
    });
    return <DailyLessonNoteList notes={items} className={className} />;
  }

  function planTaskRemoval(task: DailyPlanTaskForCache) {
    if (timetableEditor.submitting) return;
    setTaskRemovalConfirmation(task);
    setTaskDetail(null);
  }

  function cancelTaskRemovalConfirmation() {
    const task = taskRemovalConfirmation;
    setTaskRemovalConfirmation(null);
    if (task) setTaskDetail({ type: "active", task });
  }

  function confirmTaskRemoval() {
    if (!taskRemovalConfirmation) return;
    const result = timetableEditorClient.saveTaskRemoveDraft(
      editableTask(taskRemovalConfirmation),
    );
    if (result.status === "limit-reached") {
      setTimetableEditorMessage("下書きは合計50件までです。");
      return;
    }
    if (result.status === "submission-in-progress") return;
    setTaskRemovalConfirmation(null);
  }

  function openTimetableEditor(periodNumber: number) {
    openTimetableEditorAt(selectedSchoolDate, periodNumber);
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
    const form: TimetableEditorForm = existing
        ? {
            targetScopeType: existing.targetScopeType,
            changeDate: existing.changeDate,
            periodNumber: existing.periodNumber,
            sourceId: existing.sourceId,
            includeTimetableChange: true,
            noteBody: "",
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
              includeTimetableChange: true,
              noteBody: "",
              replacement: serverLayer.replacement,
            }
          : {
              targetScopeType,
              changeDate: timetableLayerDialog.schoolDate,
              periodNumber: timetableLayerDialog.periodNumber,
              includeTimetableChange: false,
              noteBody: "",
              replacement: { type: "lesson_name", lessonName: "" },
            });
    editorInitialFormsRef.current.timetable = form;
    setTimetableEditorForm(form);
  }

  openLayerReplacementRef.current = openLayerReplacement;

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
    closeTimetableFormAfterDraftSave();
    setTimetableEditorMessage(null);
  }

  function closeTimetableDialogFlow() {
    setTimetableEditorForm(null);
    editorInitialFormsRef.current.timetable = null;
    setTimetableHistoryDialog(null);
    setTimetableLayerDialog(null);
    pendingChangeContentTimetableRef.current = null;
    returnToChangeContentIfNeeded();
  }

  function closeTimetableFormAfterDraftSave() {
    setTimetableEditorForm(null);
    editorInitialFormsRef.current.timetable = null;
    if (!changeContentReturnRef.current) return;
    setTimetableLayerDialog(null);
    pendingChangeContentTimetableRef.current = null;
    returnToChangeContentIfNeeded();
  }

  function closeTimetableEditorBack() {
    if (changeContentReturnRef.current) {
      closeTimetableDialogFlow();
      return;
    }
    setTimetableEditorForm(null);
    editorInitialFormsRef.current.timetable = null;
  }

  function requestTimetableEditorClose(destination: "close" | "back") {
    if (requestEditorDismissal("timetable", destination)) return;
    if (destination === "close") closeTimetableDialogFlow();
    else closeTimetableEditorBack();
  }

  function handleBrowserBack() {
    if (pendingEditorDismissal) return true;

    if (noteEditorForm) {
      const returnsToChangeContent = changeContentReturnRef.current;
      if (requestEditorDismissal("note", "back")) return true;
      closeNoteEditorFlow();
      return returnsToChangeContent;
    }

    if (taskEditorForm) {
      const returnsToChangeContent = changeContentReturnRef.current;
      if (requestEditorDismissal("task", "back")) return true;
      closeTaskEditorFlow();
      return returnsToChangeContent;
    }

    if (timetableEditorForm) {
      const hadParentDialog = Boolean(timetableLayerDialog || timetableHistoryDialog);
      if (requestEditorDismissal("timetable", "back")) return true;
      closeTimetableEditorBack();
      return hadParentDialog || changeContentReturnRef.current;
    }

    if (taskRemovalConfirmation) {
      setTaskRemovalConfirmation(null);
      return Boolean(taskDetail);
    }

    if (taskHistoryDialog) {
      setTaskDetail({ type: "active", task: taskHistoryDialog.task });
      setTaskHistoryDialog(null);
      return true;
    }

    if (noteHistoryDialog) {
      setNoteHistoryDialog(null);
      return false;
    }

    if (timetableHistoryDialog) {
      if (timetableHistoryDialog.detail) {
        setTimetableHistoryDialog((current) =>
          current ? { ...current, detail: null } : current,
        );
        return true;
      }
      setTimetableHistoryDialog(null);
      return Boolean(timetableLayerDialog);
    }

    if (timetableLayerDialog) {
      const returnsToChangeContent = changeContentReturnRef.current;
      closeTimetableDialogFlow();
      return returnsToChangeContent;
    }

    if (taskDetail) {
      setTaskDetail(null);
      return false;
    }

    if (referencePickerOpen) {
      setReferencePickerOpen(false);
      return false;
    }

    if (directChangeReviewOpen) {
      setDirectChangeReviewOpen(false);
      setChangeContentOpen(true);
      return true;
    }

    if (changeContentOpen) {
      setChangeContentOpen(false);
      return false;
    }

    if (logoutConfirmationOpen) {
      setLogoutConfirmationOpen(false);
      return false;
    }

    return false;
  }

  browserBackHandlerRef.current = handleBrowserBack;

  function discardUnsavedEditorInput() {
    const pending = pendingEditorDismissal;
    if (!pending) return;
    setPendingEditorDismissal(null);
    if (pending.destination === "exit-editing") {
      finishLeavingTimetableEditing();
    } else if (pending.editor === "task") {
      closeTaskEditorFlow();
    } else if (pending.editor === "note") {
      closeNoteEditorFlow();
    } else if (pending.destination === "close") {
      closeTimetableDialogFlow();
    } else {
      closeTimetableEditorBack();
    }
  }

  function goBackInTimetableHistoryDialog() {
    setTimetableHistoryDialog((current) =>
      current?.detail ? { ...current, detail: null } : null,
    );
  }

  function navigateLayerDialog(schoolDate: string, periodNumber: number) {
    setTimetableEditorForm(null);
    editorInitialFormsRef.current.timetable = null;
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
    if (timetableEditorForm.includeTimetableChange &&
      replacement.type === "lesson_name") {
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
      timetableEditorForm.includeTimetableChange &&
      replacement.type === "floating_lesson_reference" &&
      !replacement.floatingLessonReferenceLabelId
    ) {
      setTimetableEditorMessage(
        "時間割記号を選択してください。",
      );
      return;
    }
    const result = timetableEditorClient.saveDailyLessonDialogDraft({
      targetScopeType: timetableEditorForm.targetScopeType,
      schoolDate: timetableEditorForm.changeDate,
      periodNumber: timetableEditorForm.periodNumber,
      replacement: timetableEditorForm.includeTimetableChange
        ? replacement
        : null,
      noteBody: timetableEditorForm.noteBody,
    });
    if (result.status === "empty") {
      setTimetableEditorMessage(
        "時間割の変更内容またはノートを入力してください。",
      );
      return;
    }
    if (result.status === "invalid-note") {
      setTimetableEditorMessage("ノートの本文を確認してください。");
      return;
    }
    if (result.status === "limit-reached") {
      setTimetableEditorMessage(
        "下書きは50件までです。既存の下書きを変更または取り消してください。",
      );
      return;
    }
    closeTimetableFormAfterDraftSave();
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

  function openDirectChangeReview() {
    if (
      timetableEditor.submitting ||
      timetableEditor.draftCount === 0 ||
      timetableEditor.conflictCount > 0
    ) return;
    setChangeContentOpen(false);
    setDirectChangeReviewOpen(true);
  }

  async function commitTimetableDrafts() {
    setDirectChangeReviewOpen(false);
    setTimetableEditorRefreshNeeded(false);
    setTimetableEditorMessage("変更を反映しています…");
    const result = await timetableEditorClient.submitCurrentBatch({
      confirmSubmission: () => true,
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
        "ネットワークに接続できません。下書きはこの端末に保存されています。変更内容からもう一度お試しください。",
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
      setTimetableEditorRefreshNeeded(result.freshness === "stale");
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
    const visibleTasks = dailyPlanState.status === "ready"
      ? buildVisibleTaskList(
          dailyPlanState.dailyPlan.tasks,
          timetableEditor.taskDrafts,
          selectedSchoolDate,
          dailyPlanClient.getCachedDailyPlans().flatMap((plan) => plan.tasks),
        )
      : [];
    const changeContentItems = buildChangeContentList({
      selectedSchoolDate,
      timetableDrafts: timetableEditor.drafts,
      taskDrafts: timetableEditor.taskDrafts,
      noteDrafts: timetableEditor.noteDrafts,
      activeTasks: dailyPlanClient.getCachedDailyPlans().flatMap(
        (plan) => plan.tasks,
      ),
      activeNotes: dailyPlanClient.getCachedDailyPlans().flatMap((plan) => [
        ...plan.notes,
        ...plan.periods.flatMap((period) => period.notes),
        ...plan.tasks.flatMap((task) => task.notes),
      ]),
    });
    const changeContentControls = changeContentControlState({
      editing: timetableEditor.editing,
      draftCount: timetableEditor.draftCount,
      referenceScopeActive: referenceScope !== null,
    });
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
    const noteContextImmutable = Boolean(
      noteEditorForm?.editingNote ||
      noteEditorForm?.editingDraft?.changeKind === "update",
    );
    const referenceBasePeriods =
      dailyPlanState.status === "ready" &&
      dailyPlanState.dailyPlan.schoolDate === selectedSchoolDate
        ? dailyPlanState.dailyPlan.periods.map((period) => ({
            periodNumber: period.periodNumber,
            lessonName: period.lessonName,
          }))
        : null;
    const referencePlanMatchesSelection = Boolean(
      referenceScope &&
      referenceDailyPlan &&
      referenceDailyPlan.schoolDate === selectedSchoolDate &&
      referenceDailyPlan.referenceScopeValue === referenceScope.value,
    );
    const referencePlanReady =
      referencePlanMatchesSelection &&
      referenceDailyPlan?.status === "ready" &&
      referenceBasePeriods !== null;
    const referencePlanError =
      referencePlanMatchesSelection && referenceDailyPlan?.status === "error";

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
                  <button
                    className="menu-item"
                    type="button"
                    onClick={openReferencePicker}
                  >
                    ほかの範囲を参照
                  </button>
                  {referenceScope ? (
                    <button
                      className="menu-item"
                      type="button"
                      onClick={leaveReferenceScope}
                    >
                      自分の予定に戻る
                    </button>
                  ) : null}
                  <button className="menu-item" type="button" onClick={requestLogout}>
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
            {referenceScope ? (
              <span className="reference-mode-indicator" role="status">
                参照中
              </span>
            ) : timetableEditor.editing ? (
              <span className="edit-mode-indicator" role="status">
                編集中
              </span>
            ) : (
              <div className="topbar-spacer" aria-hidden="true" />
            )}
          </header>

          {timetableEditorMessage ? (
            <div className="timetable-editor-toast" role="status">
              <span>{timetableEditorMessage}</span>
              {timetableEditorRefreshNeeded ? (
                <StaleDirectChangeRefreshAction
                  onReload={() => window.location.reload()}
                />
              ) : null}
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
            {referenceScope && !referencePlanReady && !referencePlanError ? (
              <div className="panel state-panel" aria-live="polite">
                {referenceScope.label}の予定を読み込んでいます…
              </div>
            ) : null}

            {referenceScope && referencePlanError ? (
              <div className="panel state-panel" role="alert">
                <h2>参照する予定を読み込めませんでした</h2>
                <p>範囲を選び直すか、時間をおいて再度お試しください。</p>
                <button
                  className="button-secondary"
                  type="button"
                  onClick={openReferencePicker}
                >
                  範囲を選び直す
                </button>
              </div>
            ) : null}

            {referenceScope && referencePlanReady ? (
              <>
                <div className="reference-scope-banner" role="status">
                  自分の時間割で<strong>{referenceScope.label}</strong>を参照中
                </div>
                <ReferenceDailyPlanNotes
                  {...referenceDailyPlan}
                  basePeriods={referenceBasePeriods}
                  targetScopeLabel={referenceScope.label}
                />
              </>
            ) : null}

            {!referenceScope && dailyPlanState.status === "loading" ? (
              <div className="panel state-panel" aria-live="polite">
                この日の予定を読み込んでいます…
              </div>
            ) : null}

            {!referenceScope && dailyPlanState.status === "affiliation-renewal-needed" ? (
              <div className="panel state-panel" role="status">
                <h2>所属の更新が必要です</h2>
                <p>
                  {dailyPlanState.schoolYear}
                  年度の所属情報を入力すると、この日の予定を確認できます。
                </p>
              </div>
            ) : null}

            {!referenceScope && dailyPlanState.status === "error" ? (
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

            {!referenceScope && dailyPlanState.status === "ready" ? (
              <>
                <section
                  className="panel timetable-panel"
                  aria-label="時間割"
                >
                  <div className="period-list">
                    {dailyPlanState.dailyPlan.periods.map((period) => {
                      const lifecycleDrafts = timetableEditor.drafts.filter(
                        (draft) =>
                          draft.changeDate === selectedSchoolDate &&
                          draft.periodNumber === period.periodNumber,
                      );
                      return (
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
                      >
                        <button
                          className="period-inspect-button"
                          type="button"
                          aria-label={`${period.periodNumber}限 ${period.lessonName || "空欄"}${
                            lifecycleDrafts.length > 0
                              ? ` ${lifecycleDrafts.map((draft) =>
                                  lifecycleLabel(
                                    draft.changeKind,
                                    Boolean(draft.conflicted),
                                  )
                                ).join("、")}`
                              : ""
                          }`}
                          onClick={() => openTimetableEditor(period.periodNumber)}
                        >
                          <span className="period-number">
                            {period.periodNumber}
                          </span>
                          <span className="period-main">
                            <span className="lesson-line">
                              <span className="lesson-name">
                                {period.lessonName}
                              </span>
                              {period.hasTasks ? (
                                <span className="task-pill">タスク</span>
                              ) : null}
                              {lifecycleDrafts.length > 0 ? (
                                <span className="period-lifecycle-icons">
                                  {lifecycleDrafts.map((draft) => (
                                    <LifecycleIcon
                                      key={draft.sourceId}
                                      kind={draft.changeKind}
                                      conflicted={draft.conflicted}
                                    />
                                  ))}
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </button>
                        {dailyLessonNoteList(
                          period.notes,
                          selectedSchoolDate,
                          period.periodNumber,
                          targetScopeContext,
                        )}
                      </article>
                      );
                    })}
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
                    {visibleTasks.map((item) => {
                      const task = item.task;
                      return (
                      <article
                        className={`task-entry ${
                          item.type === "draft" ? "task-draft" : ""
                        }`}
                        key={item.type === "draft"
                          ? item.draft.sourceId
                          : task.taskId}
                      >
                        <button
                          className="task-item"
                          type="button"
                          onClick={() => setTaskDetail(item)}
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
                            {item.type === "draft" ? (
                              <span className="lifecycle-summary">
                                <LifecycleIcon
                                  kind={item.draft.changeKind}
                                  conflicted={item.draft.conflicted}
                                />
                                <small>
                                  {lifecycleLabel(
                                    item.draft.changeKind,
                                    Boolean(item.draft.conflicted),
                                  )}
                                </small>
                              </span>
                            ) : null}
                          </span>
                          <span aria-hidden="true">›</span>
                        </button>
                        {taskNoteList(
                          task,
                          task.notes,
                          item.type === "draft" &&
                            item.draft.changeKind === "remove",
                        )}
                      </article>
                      );
                    })}
                    {visibleTasks.length === 0 ? (
                      <p className="empty-state">タスクはありません。</p>
                    ) : null}
                  </div>
                </section>

                <section
                  className="panel daily-section"
                  aria-labelledby="notes-title"
                >
                  <div className="daily-section-heading">
                    <h2 id="notes-title">ノート</h2>
                    {timetableEditor.editing ? (
                      <button
                        className="task-add-button"
                        type="button"
                        aria-label="ノートを追加"
                        disabled={timetableEditor.atLimit || timetableEditor.submitting}
                        onClick={openNoteEditor}
                      >
                        <span className="task-add-icon" aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                  <div className="note-list">
                    {(() => {
                      const visibleNotes = buildVisibleNoteList(
                        dailyPlanState.dailyPlan.notes,
                        timetableEditor.noteDrafts.filter(
                          (draft) => draft.relatedTaskItemId === undefined,
                        ),
                        selectedSchoolDate,
                      );
                      if (visibleNotes.length === 0) {
                        return <p className="empty-state">ノートはありません。</p>;
                      }
                      return visibleNotes.map((item) => {
                        if (item.type === "draft") {
                          const note = item.draft;
                          return (
                        <NoteCard
                          key={note.sourceId}
                          noteId={note.sourceId}
                          body={note.body}
                          targetScopeLabel={scopeLabel(
                            note.targetScopeType,
                            targetScopeContext,
                          )}
                          draft
                          changeKind={note.changeKind}
                          conflicted={note.conflicted}
                          onCancelDraft={() =>
                            timetableEditorClient.removeNoteDraft(note.sourceId)
                          }
                          onEdit={note.changeKind === "remove"
                            ? undefined
                            : () => openNoteDraftEditor(note)}
                          onOpenHistory={item.activeNote
                            ? () => openNoteHistory(item.activeNote!)
                            : undefined}
                        />
                          );
                        }
                        const note = item.note;
                        return (
                          <NoteCard
                            key={note.noteId}
                            noteId={note.noteId}
                            body={note.body}
                            targetScopeLabel={scopeLabel(
                              note.targetScopeType,
                              targetScopeContext,
                            )}
                            onEdit={timetableEditor.editing
                              ? () => openNoteUpdateEditor(note)
                              : undefined}
                            onRemove={timetableEditor.editing
                              ? () => saveNoteRemoveDraft(note)
                              : undefined}
                            onOpenHistory={() => openNoteHistory(note)}
                          />
                        );
                      });
                    })()}
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
              {changeContentControls.editModeVisible ? (
              <div className="timetable-edit-controls">
                {changeContentControls.reviewVisible ? (
                  <>
                    <button
                      className="button-secondary change-content-button"
                      type="button"
                      disabled={timetableEditor.submitting}
                      onClick={() => setChangeContentOpen(true)}
                    >
                      変更内容（{timetableEditor.draftCount}）
                    </button>
                  </>
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
                  {changeContentControls.badgeVisible ? (
                    <span
                      className="draft-count-badge"
                      aria-label={changeContentControls.badgeLabel!}
                    >
                      {timetableEditor.draftCount}
                    </span>
                  ) : null}
                </button>
              </div>
              ) : null}
            </footer>
          ) : null}

          {changeContentOpen && changeContentControls.reviewVisible ? (
            <div className="editor-dialog-backdrop" role="presentation">
              <section
                className="timetable-editor-dialog change-content-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="change-content-title"
              >
                <header className="editor-dialog-header">
                  <div>
                    <h2 id="change-content-title">変更内容</h2>
                    <p className="change-content-subtitle">
                      下書き {timetableEditor.draftCount}件
                    </p>
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="変更内容を閉じる"
                    onClick={() => {
                      setChangeContentOpen(false);
                      changeContentReturnRef.current = false;
                    }}
                  >
                    ×
                  </button>
                </header>
                <DialogBody>
                  {changeContentItems.length === 0 ? (
                    <p className="change-content-empty">
                      変更内容はありません。
                    </p>
                  ) : (
                    <ol className="change-content-list" aria-label="変更内容一覧">
                      {changeContentItems.map(changeContentItemView)}
                    </ol>
                  )}
                  {timetableEditor.conflictCount > 0 ? (
                    <p className="change-content-conflict-notice" role="alert">
                      ほかの変更と重なっている下書きがあります。確認してから編集し直してください。
                    </p>
                  ) : null}
                  <footer className="editor-dialog-actions change-content-actions">
                    <button
                      className="button-secondary"
                      type="button"
                      disabled={
                        timetableEditor.submitting ||
                        timetableEditor.draftCount === 0 ||
                        timetableEditor.conflictCount > 0
                      }
                      onClick={openDirectChangeReview}
                    >
                      反映を確認
                    </button>
                  </footer>
                </DialogBody>
              </section>
            </div>
          ) : null}

          {directChangeReviewOpen ? (
            <div className="editor-dialog-backdrop" role="presentation">
              <DirectChangeReviewDialog
                summary={buildDirectChangeReviewSummary({
                  timetableDraftCount: timetableEditor.drafts.length,
                  taskDraftCount: timetableEditor.taskDrafts.length,
                  noteDraftCount: timetableEditor.noteDrafts.length,
                })}
                submitting={timetableEditor.submitting}
                conflictCount={timetableEditor.conflictCount}
                onBack={() => {
                  setDirectChangeReviewOpen(false);
                  setChangeContentOpen(true);
                }}
                onApply={() => void commitTimetableDrafts()}
              />
            </div>
          ) : null}

          {logoutConfirmationOpen ? (
            <div className="editor-dialog-backdrop" role="presentation">
              <DraftLogoutConfirmationDialog
                draftCount={timetableEditor.draftCount}
                onBack={() => setLogoutConfirmationOpen(false)}
                onLogout={() => void logout()}
              />
            </div>
          ) : null}

          {referencePickerOpen ? (
            <div className="editor-dialog-backdrop" role="presentation">
              <section
                className="timetable-editor-dialog reference-scope-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="reference-scope-title"
              >
                <header className="editor-dialog-header">
                  <h2 id="reference-scope-title">ほかの範囲を参照</h2>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="閉じる"
                    onClick={() => setReferencePickerOpen(false)}
                  >
                    ×
                  </button>
                </header>
                <DialogBody>
                  {referenceScopeOptions?.status === "loading" ||
                  referenceScopeOptions === null ? (
                    <p className="reference-scope-dialog-status" role="status">
                      選べる範囲を読み込んでいます…
                    </p>
                  ) : referenceScopeOptions.status === "error" ? (
                    <div className="reference-scope-dialog-status" role="alert">
                      <p>選べる範囲を読み込めませんでした。</p>
                      <button
                        className="button-secondary"
                        type="button"
                        onClick={() => void loadReferenceScopeOptions()}
                      >
                        再読み込み
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={selectReferenceScope}>
                      <label>
                        <span>参照する変更適用範囲</span>
                        <select
                          value={referencePickerScopeKey}
                          onChange={(event) =>
                            setReferencePickerScopeKey(event.target.value)}
                          disabled={referenceScopeOptions.options.length === 0}
                        >
                          {referenceScopeOptions.options.map((option) => (
                            <option
                              key={referenceScopeKey(option)}
                              value={referenceScopeKey(option)}
                            >
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {referenceScopeOptions.options.length === 0 ? (
                        <p className="empty-state">参照できる範囲はありません。</p>
                      ) : null}
                      <div className="editor-dialog-actions">
                        <button
                          className="button-primary"
                          type="submit"
                          disabled={referenceScopeOptions.options.length === 0}
                        >
                          参照する
                        </button>
                      </div>
                    </form>
                  )}
                </DialogBody>
              </section>
            </div>
          ) : null}

          {noteEditorForm ? (
            <DialogSurface
              className={`editor-dialog-form-surface note-editor-dialog${
                noteEditorForm.relatedTask ? " task-note-editor-dialog" : ""
              }`}
              labelledBy="note-editor-title"
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                event.preventDefault();
                requestNoteEditorClose();
              }}
            >
              <form className="editor-dialog-form" onSubmit={saveNoteDraft}>
                <DialogHeader
                  title={
                    noteEditorForm.relatedTask
                      ? "ノートを書く"
                      : noteEditorForm.editingNote || noteEditorForm.editingDraft
                        ? "ノートを編集"
                        : "ノートを追加"
                  }
                  titleId="note-editor-title"
                  onBack={requestNoteEditorClose}
                  actionLabel={noteEditorForm.editingDraft?.changeKind === "remove"
                    ? "削除予定を取り消す"
                    : editorActionLabel(
                        noteEditorForm.editingNote || noteEditorForm.editingDraft
                          ? "update"
                          : "add",
                      )}
                  actionType={noteEditorForm.editingDraft?.changeKind === "remove"
                    ? "button"
                    : "submit"}
                  onAction={noteEditorForm.editingDraft?.changeKind === "remove"
                    ? () => {
                        timetableEditorClient.removeNoteDraft(
                          noteEditorForm.editingDraft!.sourceId,
                        );
                        closeNoteEditorFlow();
                      }
                    : undefined}
                />
                <div className="editor-dialog-body">
                  <label>
                    <span>本文</span>
                    <textarea
                      autoFocus
                      required
                      maxLength={1000}
                      rows={8}
                      disabled={noteEditorForm.editingDraft?.changeKind === "remove"}
                      value={noteEditorForm.body}
                      onChange={(event) =>
                        setNoteEditorForm((current) =>
                          current
                            ? { ...current, body: event.target.value }
                            : current,
                        )
                      }
                    />
                    <small className="note-character-count">
                      {noteEditorForm.body.length} / 1000
                    </small>
                  </label>
                  {noteEditorForm.relatedTask ? (
                    <ImmutableFieldNotice
                      kind="note"
                      notePlacement="task"
                      active={noteContextImmutable}
                      onNotify={setTimetableEditorMessage}
                    >
                    <p className="task-note-target">
                      {noteEditorForm.relatedTask.title}
                    </p>
                    </ImmutableFieldNotice>
                  ) : noteEditorForm.periodNumber != null ? (
                    <ImmutableFieldNotice
                      kind="note"
                      notePlacement="daily-lesson"
                      active={noteContextImmutable}
                      onNotify={setTimetableEditorMessage}
                    >
                    <div className="note-fixed-context">
                      <label className="immutable-field">
                        <span>日付</span>
                        <input
                          type="date"
                          value={noteEditorForm.schoolDate!}
                          disabled
                        />
                      </label>
                      <label className="immutable-field">
                        <span>時限</span>
                        <input
                          type="text"
                          value={`${noteEditorForm.periodNumber}限`}
                          disabled
                        />
                      </label>
                      <label className="immutable-field">
                        <span>変更適用範囲</span>
                        <select value={noteEditorForm.targetScopeType!} disabled>
                          <option value={noteEditorForm.targetScopeType!}>
                            {scopeLabel(
                              noteEditorForm.targetScopeType!,
                              targetScopeContext,
                            )}
                          </option>
                        </select>
                      </label>
                    </div>
                    </ImmutableFieldNotice>
                  ) : (
                    <ImmutableFieldNotice
                      kind="note"
                      active={noteContextImmutable}
                      className="note-placement-fields"
                      onNotify={setTimetableEditorMessage}
                    >
                      <label
                        className={
                          noteContextImmutable ? "immutable-field" : undefined
                        }
                      >
                        <span>日付</span>
                        <div className="optional-date-row">
                          <input
                            type="date"
                            required={noteEditorForm.schoolDate !== null}
                            disabled={noteContextImmutable}
                            min={schoolYearRange?.startsOn}
                            max={schoolYearRange?.endsOn}
                            value={noteEditorForm.schoolDate ?? ""}
                            onChange={(event) =>
                              setNoteEditorForm((current) =>
                                current
                                  ? {
                                      ...current,
                                      schoolDate: event.target.value,
                                    }
                                  : current,
                              )
                            }
                          />
                          {!noteContextImmutable ? (
                            <button
                              className="optional-date-clear"
                              type="button"
                              aria-label="日付をクリア"
                              title="日付をクリア"
                              disabled={!noteEditorForm.schoolDate}
                              onClick={() =>
                                setNoteEditorForm((current) =>
                                  current
                                    ? { ...current, schoolDate: null }
                                    : current,
                                )
                              }
                            >
                              <ClearDateIcon />
                            </button>
                          ) : null}
                        </div>
                      </label>
                      <label
                        className={
                          noteContextImmutable ? "immutable-field" : undefined
                        }
                      >
                        <span>変更適用範囲</span>
                        <select
                          required
                          disabled={noteContextImmutable}
                          value={noteEditorForm.targetScopeType ?? ""}
                          onChange={(event) =>
                            setNoteEditorForm((current) =>
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
                          {noteContextImmutable ? (
                            <option value={noteEditorForm.targetScopeType!}>
                              {scopeLabel(
                                noteEditorForm.targetScopeType!,
                                targetScopeContext,
                              )}
                            </option>
                          ) : (
                            <>
                              <option value="" disabled hidden>
                                選択してください
                              </option>
                              {(
                                [
                                  "grade",
                                  "class",
                                  "track",
                                  "student",
                                ] as const
                              ).map((scope) => (
                                <option key={scope} value={scope}>
                                  {scopeLabel(scope, targetScopeContext)}
                                </option>
                              ))}
                            </>
                          )}
                        </select>
                      </label>
                    </ImmutableFieldNotice>
                  )}
                </div>
              </form>
            </DialogSurface>
          ) : null}

          {taskEditorForm ? (
            <DialogSurface
              className="editor-dialog-form-surface task-editor-dialog"
              labelledBy="task-editor-title"
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                event.preventDefault();
                requestTaskEditorClose();
              }}
            >
              <form className="editor-dialog-form" onSubmit={saveTaskDraft}>
                <DialogHeader
                  title={taskEditorForm.editingTask ? "タスクを編集" : "タスクを追加"}
                  titleId="task-editor-title"
                  onBack={requestTaskEditorClose}
                  actionLabel={editorActionLabel(
                    taskEditorForm.editingTask || taskEditorForm.editingDraft
                      ? "update"
                      : "add",
                  )}
                />
                <div className="editor-dialog-body">
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
                    <div className="optional-date-row">
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
                        className="optional-date-clear"
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
                        <ClearDateIcon />
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
                          event.stopPropagation();
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
                      ?.relatedLessonName?.registeredLessonNameId &&
                    taskEditorForm.relatedLessonInput.trim() ===
                      taskEditorForm.editingTask.relatedLessonName.lessonName
                  ) ? (
                    <p className="field-warning" role="status">
                      候補にない授業名として保存されます。
                    </p>
                  ) : null}
                  {taskEditorForm.editingTask ? (
                    <ImmutableFieldNotice
                      kind="task"
                      onNotify={setTimetableEditorMessage}
                    >
                    <label className="immutable-field">
                      <span>変更適用範囲</span>
                      <select
                        value={taskEditorForm.editingTask.targetScopeType}
                        disabled
                      >
                        <option value={taskEditorForm.editingTask.targetScopeType}>
                          {scopeLabel(
                            taskEditorForm.editingTask.targetScopeType,
                            targetScopeContext,
                          )}
                        </option>
                      </select>
                    </label>
                    </ImmutableFieldNotice>
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
                </div>
              </form>
            </DialogSurface>
          ) : null}

          {taskDetail ? (
            <TaskDetailDialog
              task={taskDetail.task}
              taskScopeLabel={scopeLabel(
                taskDetail.task.targetScopeType,
                targetScopeContext,
              )}
              referenceSchoolDate={selectedSchoolDate}
              draftLifecycle={taskDetail.type === "draft"
                ? {
                    kind: taskDetail.draft.changeKind,
                    conflicted: Boolean(taskDetail.draft.conflicted),
                  }
                : undefined}
              notes={taskNoteList(
                taskDetail.task,
                taskDetail.task.notes,
                taskDetail.type === "draft" &&
                  taskDetail.draft.changeKind === "remove",
              )}
              addNoteDisabled={
                timetableEditor.atLimit || timetableEditor.submitting
              }
              onClose={() => setTaskDetail(null)}
              onOpenHistory={taskDetail.type === "active"
                ? () => openTaskHistory(taskDetail.task)
                : taskDetail.activeTask
                  ? () => openTaskHistory(taskDetail.activeTask!)
                  : undefined}
              onAddNote={timetableEditor.editing &&
                (taskDetail.type === "active" ||
                  taskDetail.draft.changeKind === "add")
                ? () => openTaskNoteEditor(taskDetail.task)
                : undefined}
              onEdit={timetableEditor.editing
                ? taskDetail.type === "active"
                  ? () => openTaskUpdateEditor(editableTask(taskDetail.task))
                  : taskDetail.draft.changeKind === "add"
                    ? () => openTaskDraftEditor(taskDetail.draft)
                    : taskDetail.draft.changeKind === "update" &&
                        taskDetail.editingTask
                      ? () => openTaskUpdateEditor(
                        taskDetail.editingTask!,
                        taskDetail.task,
                      )
                      : undefined
                : undefined}
              onCancelDraft={timetableEditor.editing &&
                taskDetail.type === "draft"
                ? () => {
                  timetableEditorClient.removeTaskDraft(taskDetail.draft.sourceId);
                  setTaskDetail(null);
                }
                : undefined}
              onRemove={timetableEditor.editing && taskDetail.type === "active"
                ? () => planTaskRemoval(taskDetail.task)
                : undefined}
            />
          ) : null}

          {taskRemovalConfirmation ? (
            <TaskRemovalConfirmationDialog
              taskTitle={taskRemovalConfirmation.title}
              notes={taskRemovalConfirmation.notes}
              onCancel={cancelTaskRemovalConfirmation}
              onConfirm={confirmTaskRemoval}
            />
          ) : null}

          {taskHistoryDialog ? (
            <TaskEditHistoryDialog
              taskTitle={taskHistoryDialog.task.title}
              targetScopeContext={targetScopeContext}
              referenceSchoolDate={selectedSchoolDate}
              state={taskHistoryDialog.state}
              onBack={() => {
                setTaskDetail(
                  visibleTasks.find(
                    (item) => item.task.taskId === taskHistoryDialog.task.taskId,
                  ) ?? { type: "active", task: taskHistoryDialog.task },
                );
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

          {noteHistoryDialog ? (
            <NoteEditHistoryDialog
              targetScopeContext={targetScopeContext}
              state={noteHistoryDialog.state}
              onClose={() => setNoteHistoryDialog(null)}
              onRetry={() => setNoteHistoryDialog((current) =>
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
                <DialogBody>
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
                </DialogBody>
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
                <DialogBody>
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
                      <div
                        className="layer-with-notes"
                        key={layer.targetScopeType}
                      >
                      <LayerRow
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
                        lifecycleKind={existingDraft?.changeKind}
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
                              label: editorActionLabel("remove"),
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
                      {dailyLessonNoteList(
                        layer.notes ?? [],
                        timetableLayerDialog.schoolDate,
                        timetableLayerDialog.periodNumber,
                        targetScopeContext,
                        layer.targetScopeType,
                        "layer-note-list",
                      )}
                      </div>
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
                </DialogBody>
              </section>
            </div>
          ) : null}

          {timetableEditorForm && schoolYearRange ? (
            <DialogSurface
              className="editor-dialog-form-surface timetable-editor-form-dialog"
              labelledBy="timetable-editor-title"
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                event.preventDefault();
                requestTimetableEditorClose("back");
              }}
            >
              <form className="editor-dialog-form" onSubmit={saveTimetableDraft}>
                <DialogHeader
                  title="時間割変更"
                  titleId="timetable-editor-title"
                  onBack={() => requestTimetableEditorClose("back")}
                  actionLabel={editorActionLabel(
                    timetableEditorForm.sourceId ||
                      loadedLayerState?.layers.some(
                        (layer) =>
                          layer.targetScopeType ===
                            timetableEditorForm.targetScopeType &&
                          layer.state === "active",
                      )
                      ? "update"
                      : "add",
                  )}
                  actionDisabled={
                    timetableEditor.submitting ||
                    (timetableEditorForm.includeTimetableChange &&
                      timetableEditorForm.replacement.type === "lesson_name" &&
                      !timetableEditorForm.replacement.registeredLessonNameId &&
                      !timetableEditorOptions)
                  }
                />
                <div className="editor-dialog-body">
                  <ImmutableFieldNotice
                    kind="timetable"
                    active={Boolean(
                      timetableEditorForm.sourceId ||
                      loadedLayerState?.layers.some(
                        (layer) =>
                          layer.targetScopeType ===
                            timetableEditorForm.targetScopeType &&
                          layer.state === "active",
                      ),
                    )}
                    onNotify={setTimetableEditorMessage}
                  >
                  <div className="editor-fields">
                    <label className="immutable-field">
                      変更対象日
                      <input
                        type="date"
                        value={timetableEditorForm.changeDate}
                        disabled
                      />
                    </label>
                    <label className="immutable-field">
                      時限
                      <input
                        type="text"
                        value={`${timetableEditorForm.periodNumber}限`}
                        disabled
                      />
                    </label>
                    <label className="editor-field-wide immutable-field">
                      変更適用範囲
                      <select
                        value={timetableEditorForm.targetScopeType}
                        disabled
                      >
                        <option value={timetableEditorForm.targetScopeType}>
                          {scopeLabel(
                            timetableEditorForm.targetScopeType,
                            targetScopeContext,
                          )}
                        </option>
                      </select>
                    </label>
                  </div>
                  </ImmutableFieldNotice>

                  <label className="timetable-change-toggle">
                    <input
                      type="checkbox"
                      checked={timetableEditorForm.includeTimetableChange}
                      onChange={(event) =>
                        setTimetableEditorForm({
                          ...timetableEditorForm,
                          includeTimetableChange: event.target.checked,
                        })
                      }
                    />
                    時間割も変更する
                  </label>

                  <fieldset
                    className="replacement-options"
                    disabled={!timetableEditorForm.includeTimetableChange}
                  >
                    <legend className="replacement-section-label">
                      時間割変更
                    </legend>
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
                  </fieldset>

                  <label className="daily-lesson-note-field">
                    <span>ノートを書く</span>
                    <textarea
                      maxLength={1000}
                      rows={5}
                      placeholder="この日・時限・変更適用範囲に残す内容"
                      value={timetableEditorForm.noteBody}
                      onChange={(event) =>
                        setTimetableEditorForm({
                          ...timetableEditorForm,
                          noteBody: event.target.value,
                        })
                      }
                    />
                    <small className="note-character-count">
                      {timetableEditorForm.noteBody.length} / 1000
                    </small>
                  </label>

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
                          editorInitialFormsRef.current.timetable = null;
                        }}
                      >
                        下書きを取り消す
                      </button>
                    ) : null}
                    {timetableEditorForm.includeTimetableChange &&
                    timetableLayerDialog?.state.status === "ready" &&
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
                        {editorActionLabel("remove")}
                      </button>
                    ) : null}
                  </footer>
                  </div>
              </form>
            </DialogSurface>
          ) : null}

          {pendingEditorDismissal ? (
            <DiscardConfirmationDialog
              onContinue={() => setPendingEditorDismissal(null)}
              onDiscard={discardUnsavedEditorInput}
            />
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
  lifecycleKind,
  onClick,
  menuActions = [],
}: {
  label: string;
  value: string;
  detail?: string;
  desired?: boolean;
  conflicted?: boolean;
  lifecycleKind?: LifecycleKind;
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
      {desired && lifecycleKind ? (
        <span className="layer-lifecycle-state">
          <LifecycleIcon kind={lifecycleKind} conflicted={conflicted} />
          <small>{lifecycleLabel(lifecycleKind, conflicted)}</small>
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
            aria-label={`${label}の時間割を編集${
              desired && lifecycleKind
                ? `、${lifecycleLabel(lifecycleKind, conflicted)}`
                : ""
            }`}
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
    notes: task.notes,
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
