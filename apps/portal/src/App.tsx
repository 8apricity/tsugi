import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent as ReactFocusEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import "./App.css";
import { DailyPlanSwipeFrame } from "./DailyPlanSwipeFrame";
import { DailyPlanSwipePreview } from "./DailyPlanSwipePreview";
import { createDailyPlanClient } from "./dailyPlanClient";
import { buildDateHeader, shiftSchoolDate } from "./dailyPlanView";
import { lockPageScroll } from "./pageScrollLock";
import {
  EditorDialog,
  ReadOnlyDialog,
} from "./dialogFoundation";
import { useDialogBrowserBack } from "./dialogNavigation";
import {
  createDialogFlowClient,
  type DialogFlowResult,
  type DialogFocusTarget,
  type DialogRoute,
  type DialogRouteEntry,
} from "./dialogFlow";
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
  createTaskNoteContextSnapshot,
  createSharedInformationEditorClient,
  normalizeDirectLessonReplacement,
  type ActiveTaskForEditing,
  type DraftCancellationTarget,
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
  DailyPlanForCache,
  DailyPlanNoteForCache,
  DailyPlanTaskForCache,
} from "./dailyPlanCache";
import { NoteCard, RemovalMark } from "./noteCard";
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
  type ChangeContentDailyLessonItem,
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
  ReferenceScopeOption,
} from "../shared/referenceDailyPlan";
import { useReferenceDailyPlanResource } from "./referenceDailyPlanResource";
import { useReferenceScopeOptionsResource } from "./referenceScopeOptionsResource";
import { NoteBodyFields, TaskDetailDialog } from "./taskDetailView";
import {
  useNoteEditHistoryResource,
  useSharedInformationChangeDetailResource,
  useTaskEditHistoryResource,
  useTimetableEditHistoryResource,
} from "./editHistoryResource";
import {
  NoteEditHistoryDialog,
  SharedInformationChangeDetailDialog,
  TaskEditHistoryDialog,
  TimetableEditHistoryDialog,
} from "./sharedInformationChangeView";
import { NoteDetailDialog } from "./noteDetailView";
import {
  formatSchoolDate as formatUiSchoolDate,
  formatRelativeTime,
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
  DraftExitConfirmationDialog,
  DraftLogoutConfirmationDialog,
  StaleDirectChangeRefreshAction,
} from "./directChangeReviewView";
import {
  DraftCancellationRow,
  type DraftCancellationRowHandle,
} from "./draftCancellationRow";

function editorKindForDialogRoute(
  route: DialogRoute | undefined,
): EditorKind | null {
  if (route?.kind === "task-editor") return "task";
  if (route?.kind === "note-editor" || route?.kind === "note-detail") {
    return "note";
  }
  if (route?.kind === "timetable-editor") return "timetable";
  return null;
}

const DATE_PICKER_RADIUS = 180;
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
  removalPlanned: boolean;
  noteBodies: string[];
};

type TaskEditorForm = Omit<NewTaskDraftForm, "relatedLessonName"> & {
  relatedLessonInput: string;
  noteBodies: string[];
  removalPlanned: boolean;
  editingTask: ActiveTaskForEditing | null;
  editingDraft: TaskDraft | null;
};

type TimetableLayerDialog = {
  routeInstanceId: string;
  schoolDate: string;
  periodNumber: number;
  requestId: number;
  state:
    | { status: "loading" }
    | { status: "error" }
    | TimetableLayerState;
};

type TimetableHistoryDialog = {
  routeInstanceId: string;
  targetScopeType: TargetScopeType;
  changeDate: string;
  periodNumber: number;
};

type TaskHistoryDialog = {
  routeInstanceId: string;
  task: DailyPlanTaskForCache;
};

type TaskRemovalConfirmation = {
  task: ActiveTaskForEditing;
};

type NoteEditorForm = NewNoteDraftForm & {
  editingNote: DailyPlanNoteForCache | null;
  editingDraft: NoteDraft | null;
  removalPlanned: boolean;
  relatedTask: {
    taskId: string;
    title: string;
    dueDate: string | null;
    relatedLessonName?: string;
    targetScopeType: TargetScopeType;
  } | null;
};

type NoteHistoryDialog = {
  routeInstanceId: string;
  note: DailyPlanNoteForCache;
};

type NoteDialogParent = "task-detail" | "daily-lesson-detail";

const NOTE_DIALOG_PARENT = {
  "task-detail": {
    backLabel: "タスクの詳細に戻る",
  },
  "daily-lesson-detail": {
    backLabel: "時間割の変更状況に戻る",
  },
} as const satisfies Record<NoteDialogParent, {
  backLabel: string;
}>;

type NoteDraftBasis =
  | { activeNote: DailyPlanNoteForCache }
  | { beforeBody: string | null };

type EditorInitialForms = {
  timetable: TimetableEditorForm | null;
  task: TaskEditorForm | null;
  note: NoteEditorForm | null;
};

type PendingChangeContentTimetable = Pick<
  ChangeContentTimetableItem,
  "changeDate" | "periodNumber" | "targetScopeType"
>;

type PendingDraftCancellationFocus = {
  cancelledIndex: number;
  dialog: HTMLDialogElement | null;
};

type DraftCancellationRowRegistration = {
  handle: DraftCancellationRowHandle;
  index: number;
};

function lessonNameOptionId(prefix: string, index: number) {
  return `${prefix}-${index}`;
}

function referenceScopeKey(scope: ReferenceScopeOption) {
  return `${scope.type}:${scope.value}`;
}

function replaceNoteBody(
  noteBodies: readonly string[],
  index: number,
  body: string,
) {
  return noteBodies.map((value, noteIndex) =>
    noteIndex === index ? body : value
  );
}

function appendEmptyNoteBody(noteBodies: readonly string[]) {
  return [...noteBodies, ""];
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
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedTrackId, setSelectedTrackId] = useState("");
  const [confirmedSetup, setConfirmedSetup] = useState(false);
  const [status, setStatus] = useState<RequestStatus>("checking");
  const [message, setMessage] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [referencePickerScopeKey, setReferencePickerScopeKey] = useState("");
  const [referenceScope, setReferenceScope] =
    useState<ReferenceScopeOption | null>(null);
  const referenceScopeOptionsCacheOwnerKey = useMemo(
    () => studentAccount ? crypto.randomUUID() : null,
    [studentAccount],
  );
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
  const referenceDailyPlanResource = useReferenceDailyPlanResource(
    referenceScope
      ? {
          schoolDate: selectedSchoolDate,
          referenceScope,
        }
      : null,
  );
  const datePickerRef = useRef<HTMLElement | null>(null);
  const dateButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const datePickerScrollFrameRef = useRef<number | null>(null);
  const datePickerScrollEndTimerRef = useRef<number | null>(null);
  const shouldCenterDatePickerRef = useRef(true);
  const centeredDateStripBoundsRef = useRef<[string, string] | null>(null);
  const suppressDatePickerScrollRef = useRef(false);
  const pendingDailyPlanReturnDateRef = useRef<string | null>(null);
  const [timetableEditorClient] = useState(() =>
    createSharedInformationEditorClient({
      storage: window.localStorage,
      draftStorageScope: null,
      submitDirectChanges:
        createSharedInformationDirectChangeTransport(),
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
  const [dialogFlow] = useState(createDialogFlowClient);
  const dialogFlowSnapshot = useSyncExternalStore(
    dialogFlow.subscribe,
    dialogFlow.getSnapshot,
    dialogFlow.getSnapshot,
  );
  const topDialogRoute = dialogFlowSnapshot.routes.at(-1);
  const topDialogRouteIs = (kind: DialogRoute["kind"]) =>
    topDialogRoute?.kind === kind;
  const dialogRouteExists = (kind: DialogRoute["kind"]) =>
    dialogFlowSnapshot.routes.some((route) => route.kind === kind);
  const referencePickerOpen = dialogRouteExists("reference-picker");
  const referenceScopeOptionsResource = useReferenceScopeOptionsResource({
    cacheOwnerKey:
      status === "authenticated" ? referenceScopeOptionsCacheOwnerKey : null,
    requested: referencePickerOpen,
  });
  const readyReferenceScopeOptions =
    referenceScopeOptionsResource.state.status === "ready"
      ? referenceScopeOptionsResource.state.value
      : null;
  const effectiveReferencePickerScopeKey =
    readyReferenceScopeOptions?.options.some(
      (option) => referenceScopeKey(option) === referencePickerScopeKey,
    )
      ? referencePickerScopeKey
      : readyReferenceScopeOptions?.options[0]
        ? referenceScopeKey(readyReferenceScopeOptions.options[0])
        : "";
  const [timetableEditorOptions, setTimetableEditorOptions] =
    useState<TimetableEditorOptions | null>(null);
  const [timetableEditorForm, setTimetableEditorForm] =
    useState<TimetableEditorForm | null>(null);
  const [taskEditorForm, setTaskEditorForm] =
    useState<TaskEditorForm | null>(null);
  const [noteEditorForm, setNoteEditorForm] =
    useState<NoteEditorForm | null>(null);
  const [taskRemovalConfirmation, setTaskRemovalConfirmation] =
    useState<TaskRemovalConfirmation | null>(null);
  const [taskRemovalCheckboxFocusRequested, setTaskRemovalCheckboxFocusRequested] =
    useState(false);
  const [dailyPlanTaskFocusRequestId, setDailyPlanTaskFocusRequestId] =
    useState<string | null>(null);
  const editorInitialFormsRef = useRef<EditorInitialForms>({
    timetable: null,
    task: null,
    note: null,
  });
  const changeContentOpen = dialogRouteExists("change-content");
  const [revealedDraftCancellationId, setRevealedDraftCancellationId] =
    useState<string | null>(null);
  const [timetableEditorRefreshNeeded, setTimetableEditorRefreshNeeded] =
    useState(false);
  const draftCancellationRowHandlesRef =
    useRef(new Map<string, DraftCancellationRowRegistration>());
  const pendingDraftCancellationFocusRef =
    useRef<PendingDraftCancellationFocus | null>(null);
  const pendingChangeContentTimetableRef =
    useRef<PendingChangeContentTimetable | null>(null);
  const dialogScrollPositionsRef = useRef(new Map<string, number>());
  const pendingNoteDialogScrollTopRef = useRef<number | null>(null);
  const applyDialogFlowResultRef = useRef(applyDialogFlowResult);
  const editorFormIsDirtyRef = useRef(editorFormIsDirty);
  const dialogRoutePayloadIsValidRef = useRef(dialogRoutePayloadIsValid);
  applyDialogFlowResultRef.current = applyDialogFlowResult;
  editorFormIsDirtyRef.current = editorFormIsDirty;
  dialogRoutePayloadIsValidRef.current = dialogRoutePayloadIsValid;
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
  const sharedInformationChangeDetailRoute =
    dialogFlowSnapshot.routes.findLast(
    (route) => route.kind === "shared-information-change-detail",
  );
  const taskEditHistoryResource = useTaskEditHistoryResource(
    taskHistoryDialog
      ? {
          routeInstanceId: taskHistoryDialog.routeInstanceId,
          taskId: taskHistoryDialog.task.taskId,
        }
      : null,
  );
  const noteEditHistoryResource = useNoteEditHistoryResource(
    noteHistoryDialog
      ? {
          routeInstanceId: noteHistoryDialog.routeInstanceId,
          noteId: noteHistoryDialog.note.noteId,
        }
      : null,
  );
  const timetableEditHistoryResource = useTimetableEditHistoryResource(
    timetableHistoryDialog
      ? {
          routeInstanceId: timetableHistoryDialog.routeInstanceId,
          targetScopeType: timetableHistoryDialog.targetScopeType,
          changeDate: timetableHistoryDialog.changeDate,
          periodNumber: timetableHistoryDialog.periodNumber,
        }
      : null,
  );
  const sharedInformationChangeDetailResource =
    useSharedInformationChangeDetailResource(
      sharedInformationChangeDetailRoute?.kind ===
          "shared-information-change-detail"
      ? {
          routeInstanceId: sharedInformationChangeDetailRoute.instanceId,
          sharedInformationChangeId:
            sharedInformationChangeDetailRoute.sharedInformationChangeId,
        }
      : null,
    );
  const layerDialogSchoolDate = timetableLayerDialog?.schoolDate;
  const layerDialogRequestId = timetableLayerDialog?.requestId;
  const layerDialogRouteInstanceId = timetableLayerDialog?.routeInstanceId;
  const [timetableEditorMessage, setTimetableEditorMessage] = useState<
    string | null
  >(null);
  const dialogFlowActive = dialogFlowSnapshot.active;

  useEffect(() => {
    const invalidRoute = dialogFlowSnapshot.routes.find(
      (route) => !dialogRoutePayloadIsValidRef.current(route),
    );
    if (!invalidRoute) return;

    const frameId = window.requestAnimationFrame(() => {
      if (!dialogFlow.hasInstance(invalidRoute.instanceId)) return;
      const editorKind = editorKindForDialogRoute(invalidRoute);
      const dirty = editorKind
        ? editorFormIsDirtyRef.current(editorKind)
        : false;
      applyDialogFlowResultRef.current(dialogFlow.invalidate(
        invalidRoute.instanceId,
        {
          dirty,
          cancelFocus: { kind: "active-dialog-control", control: "back" },
        },
      ));
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [
    dialogFlow,
    dialogFlowSnapshot.routes,
    noteEditorForm,
    noteHistoryDialog,
    taskDetail,
    taskEditorForm,
    taskHistoryDialog,
    timetableEditorForm,
    timetableHistoryDialog,
    timetableLayerDialog,
  ]);

  useEffect(() => {
    if (!dialogFlowActive) return;

    return lockPageScroll(document);
  }, [dialogFlowActive]);

  useEffect(() => {
    if (!dailyPlanTaskFocusRequestId) return;
    const frameId = window.requestAnimationFrame(() => {
      const taskButton = document.querySelector<HTMLButtonElement>(
        `.task-item[data-task-id="${dailyPlanTaskFocusRequestId}"]`,
      );
      taskButton?.focus();
      setDailyPlanTaskFocusRequestId(null);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [dailyPlanTaskFocusRequestId, timetableEditor.taskDrafts]);

  useDialogBrowserBack(dialogFlowSnapshot.active, requestDialogBack);

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
      .then((states) => {
        timetableLayerCacheRef.current.store(states);
        timetableEditorClient.reconcileLayerStates(states);
      })
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
      layerDialogRouteInstanceId === undefined ||
      !schoolYearRange
    )
      return;
    const schoolDate = layerDialogSchoolDate;
    const requestId = layerDialogRequestId;
    const routeInstanceId = layerDialogRouteInstanceId;
    const cache = timetableLayerCacheRef.current;
    const { missingRanges } = cache.selectWindow(
      schoolDate,
      schoolYearRange.startsOn,
      schoolYearRange.endsOn,
      timetableEditor.draftDates,
    );
    setTimetableLayerDialog((current) => {
      if (
        !dialogFlow.hasInstance(routeInstanceId) ||
        !current ||
        current.routeInstanceId !== routeInstanceId ||
        current.schoolDate !== schoolDate
      ) return current;
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
            !dialogFlow.hasInstance(routeInstanceId) ||
            current?.routeInstanceId !== routeInstanceId ||
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
            !dialogFlow.hasInstance(routeInstanceId) ||
            current?.routeInstanceId !== routeInstanceId ||
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
    dialogFlow,
    layerDialogSchoolDate,
    layerDialogRequestId,
    layerDialogRouteInstanceId,
    schoolYearRange,
    timetableEditor.draftDates,
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
    if (dailyPlanState.status !== "ready") return;
    timetableEditorClient.reconcileActiveNotes(
      [
        ...dailyPlanState.dailyPlan.notes,
        ...dailyPlanState.dailyPlan.tasks.flatMap((task) => task.notes),
        ...dailyPlanState.dailyPlan.periods.flatMap((period) => period.notes),
      ].map((note) => {
        const relatedContext = note.relatedContext;
        const contextSnapshot = noteContextSnapshotFromPlans(
          note,
          [dailyPlanState.dailyPlan],
        );
        return {
          noteId: note.noteId,
          latestChangeId: note.latestChangeId,
          body: note.body,
          schoolDate: noteSchoolDate(note),
          periodNumber: notePeriodNumber(note),
          targetScopeType: note.targetScopeType,
          ...(relatedContext?.type === "task"
            ? { relatedTaskItemId: relatedContext.taskId }
            : {}),
          ...(contextSnapshot ? { contextSnapshot } : {}),
        };
      }),
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
      dialogFlow.openLogoutConfirmation();
      return;
    }
    void logout();
  }

  async function logout() {
    dialogFlow.cancelOverlay();
    applyDialogFlowResult(dialogFlow.closeAll());
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
    clearNoteDialogState();
    setTaskRemovalConfirmation(null);
    clearEditorInitialForms();
    setTaskDetail(null);
    setTaskHistoryDialog(null);
    setTimetableLayerDialog(null);
    setTimetableEditorOptions(null);
    setReferencePickerScopeKey("");
    setReferenceScope(null);
    setMenuOpen(false);
    setTimetableEditorRefreshNeeded(false);
    pendingChangeContentTimetableRef.current = null;
    setStatus("idle");
    setMessage("ログアウトしました。");
  }

  function enterTimetableEditing() {
    setTimetableEditorMessage(null);
    timetableEditorClient.enterEditing();
  }

  function finishLeavingTimetableEditing() {
    dialogFlow.cancelOverlay();
    applyDialogFlowResult(dialogFlow.closeAll());
    timetableEditorClient.exitEditing();
    setTimetableEditorForm(null);
    setTaskEditorForm(null);
    clearNoteDialogState();
    setTaskRemovalConfirmation(null);
    clearEditorInitialForms();
    pendingChangeContentTimetableRef.current = null;
    setTimetableEditorMessage(null);
  }

  function requestDraftWorkspaceExit() {
    if (timetableEditorClient.shouldConfirmExit()) {
      setTimetableEditorForm(null);
      setTaskEditorForm(null);
      clearNoteDialogState();
      setTaskRemovalConfirmation(null);
      clearEditorInitialForms();
      dialogFlow.openDraftExitConfirmation();
      return;
    }
    finishLeavingTimetableEditing();
  }

  function leaveTimetableEditing() {
    const openEditor = timetableEditorForm
      ? "timetable"
      : taskEditorForm
        ? "task"
        : noteEditorForm
          ? "note"
          : null;
    const dirty = openEditor ? editorFormIsDirty(openEditor) : false;
    applyDialogFlowResult(dialogFlow.requestExitEditing({
      dirty,
      cancelFocus: { kind: "active-dialog-control", control: "back" },
    }));
  }

  function currentRouteInstanceId(kind: DialogRoute["kind"]) {
    const route = dialogFlow.getSnapshot().routes.at(-1);
    return route?.kind === kind ? route.instanceId : null;
  }

  function openTaskEditorForm(
    form: TaskEditorForm,
    returnFocus?: DialogFocusTarget,
  ) {
    const rootReturnFocus: DialogFocusTarget | undefined =
      dialogFlow.getSnapshot().routes.length === 0
        ? form.editingTask
          ? { kind: "task-item", taskId: form.editingTask.taskId }
          : form.editingDraft
            ? { kind: "task-item", taskId: form.editingDraft.sourceId }
          : { kind: "flow-trigger", control: "task" }
        : returnFocus;
    const transition = dialogFlow.openTaskEditor({
      ...(form.editingTask ? { taskId: form.editingTask.taskId } : {}),
      ...(form.editingDraft ? { draftId: form.editingDraft.sourceId } : {}),
      returnFocus: rootReturnFocus,
    });
    if (transition.status === "rejected") return;
    editorInitialFormsRef.current.task = form;
    setTaskEditorForm(form);
  }

  function openNoteEditorForm(
    form: NoteEditorForm,
    returnFocus?: DialogFocusTarget,
  ) {
    if (
      topDialogRoute?.kind === "task-editor" &&
      editorFormIsDirty("task")
    ) {
      setTimetableEditorMessage(
        "先にタスクの入力内容を保存するか、元に戻してください。",
      );
      return;
    }
    const resolvedReturnFocus = returnFocus ??
      (dialogFlow.getSnapshot().routes.length === 0
        ? form.editingDraft || form.editingNote
          ? {
              kind: "note-item" as const,
              noteId: form.editingDraft?.sourceId ?? form.editingNote!.noteId,
            }
          : { kind: "flow-trigger" as const, control: "note" as const }
        : undefined);
    const reflectedDetail = Boolean(
      form.editingNote ||
      (form.editingDraft && form.editingDraft.changeKind !== "add"),
    );
    const transition = reflectedDetail
      ? dialogFlow.openNoteDetail({
          noteId: form.editingDraft?.sourceId ?? form.editingNote!.noteId,
          returnFocus: resolvedReturnFocus,
        })
      : dialogFlow.openNoteEditor({
          ...(form.editingDraft ? { draftId: form.editingDraft.sourceId } : {}),
          returnFocus: resolvedReturnFocus,
        });
    if (transition?.status === "rejected") {
      pendingNoteDialogScrollTopRef.current = null;
      return;
    }
    const noteRoute = dialogFlow.getSnapshot().routes.at(-1);
    if (
      pendingNoteDialogScrollTopRef.current !== null &&
      (noteRoute?.kind === "note-detail" || noteRoute?.kind === "note-editor")
    ) {
      dialogScrollPositionsRef.current.set(
        noteRoute.instanceId,
        pendingNoteDialogScrollTopRef.current,
      );
    }
    pendingNoteDialogScrollTopRef.current = null;
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

  function clearNoteDialogState() {
    setNoteEditorForm(null);
    setNoteHistoryDialog(null);
    editorInitialFormsRef.current.note = null;
  }

  function dialogRoutePayloadIsValid(route: DialogRouteEntry) {
    switch (route.kind) {
      case "task-detail":
        return taskDetail?.task.taskId === route.taskId;
      case "task-editor":
        return Boolean(taskEditorForm);
      case "note-detail":
      case "note-editor":
        return Boolean(noteEditorForm);
      case "task-history":
        return taskHistoryDialog?.routeInstanceId === route.instanceId &&
          taskHistoryDialog.task.taskId === route.taskId;
      case "note-history":
        return noteHistoryDialog?.routeInstanceId === route.instanceId &&
          noteHistoryDialog.note.noteId === route.noteId;
      case "timetable-layer":
        return timetableLayerDialog?.routeInstanceId === route.instanceId &&
          timetableLayerDialog.schoolDate === route.schoolDate &&
          timetableLayerDialog.periodNumber === route.periodNumber;
      case "timetable-editor":
        return Boolean(
          timetableEditorForm &&
          timetableEditorForm.changeDate === route.schoolDate &&
          timetableEditorForm.periodNumber === route.periodNumber &&
          timetableEditorForm.targetScopeType === route.targetScopeType,
        );
      case "timetable-history":
        return timetableHistoryDialog?.routeInstanceId === route.instanceId &&
          timetableHistoryDialog.changeDate === route.schoolDate &&
          timetableHistoryDialog.periodNumber === route.periodNumber &&
          timetableHistoryDialog.targetScopeType === route.targetScopeType;
      case "shared-information-change-detail":
        return Boolean(
          timetableHistoryDialog || taskHistoryDialog || noteHistoryDialog,
        );
      case "reference-picker":
      case "change-content":
        return true;
    }
  }

  function clearRemovedDialogRoute(route: DialogRouteEntry) {
    dialogScrollPositionsRef.current.delete(route.instanceId);
    if (route.kind === "note-history") {
      setNoteHistoryDialog(null);
    } else if (route.kind === "note-detail" || route.kind === "note-editor") {
      clearNoteDialogState();
      setLessonNameListOpen(false);
      setActiveLessonNameOption(-1);
    } else if (route.kind === "task-history") {
      setTaskHistoryDialog(null);
    } else if (route.kind === "task-editor") {
      setTaskEditorForm(null);
      editorInitialFormsRef.current.task = null;
      setTaskLessonNameListOpen(false);
      setActiveTaskLessonNameOption(-1);
      if (
        !dialogFlow.getSnapshot().routes.some(
          (candidate) => candidate.kind === "task-detail",
        )
      ) {
        setTaskDetail(null);
      }
    } else if (route.kind === "task-detail") {
      setTaskDetail(null);
    } else if (route.kind === "timetable-history") {
      setTimetableHistoryDialog(null);
    } else if (route.kind === "timetable-editor") {
      setTimetableEditorForm(null);
      editorInitialFormsRef.current.timetable = null;
    } else if (route.kind === "timetable-layer") {
      setTimetableLayerDialog(null);
      pendingChangeContentTimetableRef.current = null;
    } else if (route.kind === "change-content") {
      setRevealedDraftCancellationId(null);
    }
  }

  function restoreDialogFocus(
    target: DialogFocusTarget | undefined,
    scrollTop?: number,
  ) {
    if (!target) return;
    window.requestAnimationFrame(() => {
      if (target.kind === "task-note" || target.kind === "daily-lesson-note") {
        const { dialog, scrollContainer } = activeDialogElements();
        const note = Array.from(
          dialog?.querySelectorAll<HTMLElement>("[data-note-id]") ?? [],
        ).find((candidate) => candidate.dataset.noteId === target.noteId);
        note?.focus({ preventScroll: true });
        if (scrollContainer && scrollTop !== undefined) {
          scrollContainer.scrollTop = scrollTop;
        }
        return;
      }
      if (target.kind === "task-history-trigger") {
        document.querySelector<HTMLButtonElement>(
          "dialog[open]:not([aria-hidden='true']) .task-detail-actions button",
        )?.focus();
        return;
      }
      if (target.kind === "note-history-trigger") {
        document.querySelector<HTMLButtonElement>(
          "dialog[open]:not([aria-hidden='true']) .note-detail-actions button",
        )?.focus();
        return;
      }
      if (target.kind === "shared-information-history-entry") {
        document.querySelector<HTMLElement>(
          `[data-change-id="${target.sharedInformationChangeId}"]`,
        )?.focus();
        return;
      }
      if (target.kind === "task-item") {
        document.querySelector<HTMLElement>(
          `.task-item[data-task-id="${target.taskId}"]`,
        )?.focus();
        return;
      }
      if (target.kind === "note-item") {
        Array.from(
          document.querySelectorAll<HTMLElement>("[data-note-id]"),
        ).find((candidate) => candidate.dataset.noteId === target.noteId)
          ?.focus();
        return;
      }
      if (target.kind === "daily-lesson") {
        document.querySelector<HTMLElement>(
          `.period-inspect-button[data-school-date="${target.schoolDate}"][data-period="${target.periodNumber}"]`,
        )?.focus();
        return;
      }
      if (target.kind === "change-content-item") {
        const container = Array.from(
          document.querySelectorAll<HTMLElement>("[data-change-content-id]"),
        ).find(
          (candidate) =>
            candidate.dataset.changeContentId === target.itemId,
        );
        const control = container?.matches("button, [role='button']")
          ? container
          : container?.querySelector<HTMLElement>("button, [role='button']");
        control?.focus();
        return;
      }
      if (target.kind === "timetable-layer-action") {
        const row = document.querySelector<HTMLElement>(
          `.layer-row-shell[data-target-scope-type="${target.targetScopeType}"]`,
        );
        row?.querySelector<HTMLElement>(
          target.action === "edit"
            ? ".timetable-layer-row.editable"
            : ".layer-kebab-button",
        )?.focus();
        return;
      }
      if (target.kind === "active-dialog-control") {
        const dialogs = Array.from(
          document.querySelectorAll<HTMLElement>(
            "[role='dialog'], [role='alertdialog']",
          ),
        );
        const activeDialog = dialogs.reverse().find(
          (dialog) =>
            !dialog.closest("[inert]") &&
            dialog.getAttribute("aria-hidden") !== "true",
        );
        activeDialog?.querySelector<HTMLButtonElement>(
          `button[aria-label="${target.control === "back" ? "戻る" : "閉じる"}"]`,
        )?.focus();
        return;
      }
      const selector = {
        "change-content": ".change-content-button",
        "reference-picker": ".menu-area > button",
        task: ".task-add-button:not(.note-add-button)",
        note: ".note-add-button",
        "timetable-layer": ".daily-lesson-button",
      }[target.control];
      document.querySelector<HTMLElement>(selector)?.focus();
    });
  }

  function applyDialogFlowResult(result: DialogFlowResult) {
    if (result.status !== "changed") return;
    const returnsToDailyPlan =
      result.removedRoutes.length > 0 &&
      dialogFlow.getSnapshot().routes.length === 0;
    const timetableReturnDate = returnsToDailyPlan
      ? [...result.removedRoutes].reverse().find(
          (route) => route.kind === "timetable-layer",
        )?.schoolDate
      : undefined;
    const dailyPlanReturnDate = returnsToDailyPlan
      ? timetableReturnDate ?? pendingDailyPlanReturnDateRef.current
      : null;
    const scrollTop = result.removedRoutes
      .map((route) => dialogScrollPositionsRef.current.get(route.instanceId))
      .find((position) => position !== undefined);
    [...result.removedRoutes].reverse().forEach(clearRemovedDialogRoute);
    if (returnsToDailyPlan) {
      pendingDailyPlanReturnDateRef.current = null;
      if (
        dailyPlanReturnDate &&
        dailyPlanReturnDate !== selectedSchoolDate
      ) {
        selectSchoolDate(dailyPlanReturnDate, true);
      }
    }
    restoreDialogFocus(result.focusTarget, scrollTop);
    if (result.completedAction === "exit-editing") {
      requestDraftWorkspaceExit();
    }
  }

  function topDialogIsDirty() {
    const editorKind = editorKindForDialogRoute(topDialogRoute);
    return editorKind ? editorFormIsDirty(editorKind) : false;
  }

  function flowContainsDirtyEditor() {
    return dialogFlowSnapshot.routes.some((route) => {
      const editorKind = editorKindForDialogRoute(route);
      return editorKind ? editorFormIsDirty(editorKind) : false;
    });
  }

  function clearCancelledDialogOverlay(
    overlay: typeof dialogFlowSnapshot.overlay,
  ) {
    if (overlay?.kind === "task-removal-confirmation") {
      cancelTaskRemovalConfirmation();
    }
  }

  function requestDialogBack() {
    const overlay = dialogFlowSnapshot.overlay;
    const result = dialogFlow.back({
      dirty: topDialogIsDirty(),
      cancelFocus: { kind: "active-dialog-control", control: "back" },
    });
    if (overlay && result.status === "changed") {
      clearCancelledDialogOverlay(overlay);
    }
    applyDialogFlowResult(result);
  }

  function requestDialogCloseAll() {
    applyDialogFlowResult(
      dialogFlow.closeAll({
        dirty: flowContainsDirtyEditor(),
        cancelFocus: { kind: "active-dialog-control", control: "close" },
      }),
    );
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

  function closeTaskEditorFlow() {
    applyDialogFlowResult(dialogFlow.completeCurrent());
  }

  function closeNoteEditorFlow() {
    applyDialogFlowResult(dialogFlow.completeCurrent());
  }

  function rememberEditedDailyPlanReturnDate(
    initialDate: string | null,
    savedDate: string | null,
  ) {
    const openedFromChangeContent = dialogFlow.getSnapshot().routes.some(
      (route) => route.kind === "change-content",
    );
    pendingDailyPlanReturnDateRef.current =
      !openedFromChangeContent && savedDate && savedDate !== initialDate
        ? savedDate
        : null;
  }

  function requestTaskEditorClose() {
    requestDialogBack();
  }

  function requestNoteEditorClose() {
    requestDialogBack();
  }

  function goBackFromNoteHistory() {
    requestDialogBack();
  }

  function closeAllNoteDialogs() {
    requestDialogCloseAll();
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

  function visibleTaskFromChangeItem(
    item: ChangeContentTaskItem,
    activeTask?: DailyPlanTaskForCache,
  ): VisibleTask {
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
      notes: activeTask?.notes ?? baseTask?.notes ?? [],
    };
  }

  function openChangeContentNote(item: ChangeContentNoteItem) {
    if (item.source !== "draft") return;
    if (item.relatedTask) {
      openTaskNoteEditor(
        item.relatedTask,
        reflectedNoteFromDraft(item.draft, item.beforeBody),
        item.draft,
        { kind: "change-content-item", itemId: item.id },
      );
      return;
    }
    openNoteDraftEditor(
      item.draft,
      { beforeBody: item.beforeBody },
      { kind: "change-content-item", itemId: item.id },
    );
  }

  function openChangeContentTask(item: ChangeContentTaskItem) {
    if (!item.draft) return;
    if (item.draft.changeKind === "add") {
      openTaskDraftEditor(item.draft, {
        kind: "change-content-item",
        itemId: item.id,
      });
      return;
    }
    const activeTask = dailyPlanClient
      .getCachedDailyPlans()
      .flatMap((plan) => plan.tasks)
      .find((task) => task.taskId === item.task.taskId);
    const editingTask = activeTask
      ? editableTask(activeTask)
      : taskEditingSnapshotFromChangeItem(item);
    if (!editingTask) return;
    const visibleTask = visibleTaskFromChangeItem(item, activeTask);
    setTaskDetail({
      type: "draft",
      task: visibleTask,
      draft: item.draft,
      ...(activeTask ? { activeTask } : {}),
      editingTask,
    });
    openTaskUpdateEditor(editingTask, visibleTask, {
      kind: "change-content-item",
      itemId: item.id,
    });
  }

  function openTimetableEditorAt(
    schoolDate: string,
    periodNumber: number,
    returnFocus?: DialogFocusTarget,
  ) {
    const transition = dialogFlow.openTimetableLayer({
      schoolDate,
      periodNumber,
      returnFocus: returnFocus ??
        (dialogFlow.getSnapshot().routes.length === 0
          ? { kind: "daily-lesson", schoolDate, periodNumber }
          : undefined),
    });
    if (transition.status === "rejected") return;
    const routeInstanceId = currentRouteInstanceId("timetable-layer");
    if (!routeInstanceId) return;
    setTimetableEditorForm(null);
    editorInitialFormsRef.current.timetable = null;
    const cached = timetableLayerCacheRef.current.get(schoolDate, periodNumber);
    setTimetableLayerDialog({
      routeInstanceId,
      schoolDate,
      periodNumber,
      requestId: 0,
      state: cached ?? { status: "loading" },
    });
  }

  function openChangeContentTimetable(item: ChangeContentTimetableItem) {
    pendingChangeContentTimetableRef.current = {
      changeDate: item.changeDate,
      periodNumber: item.periodNumber,
      targetScopeType: item.targetScopeType,
    };
    selectSchoolDate(item.changeDate, false);
    openTimetableEditorAt(
      item.changeDate,
      item.periodNumber,
      { kind: "change-content-item", itemId: item.id },
    );
  }

  function changeContentDateLabel(schoolDate: string | null) {
    return schoolDate
      ? formatUiSchoolDate(schoolDate, { referenceSchoolDate: selectedSchoolDate })
      : "日付なし";
  }

  function changeContentScopeContext() {
    const state = dailyPlanClient.getSnapshot().dailyPlanState;
    return state.status === "ready" ? state.dailyPlan.studentAffiliation : undefined;
  }

  function cachedDailyLessonName(
    schoolDate: string,
    periodNumber: number,
  ) {
    return dailyPlanClient.getCachedDailyPlans()
      .find((plan) => plan.schoolDate === schoolDate)
      ?.periods.find((period) => period.periodNumber === periodNumber)
      ?.lessonName;
  }

  function noteContextSnapshot(note: DailyPlanNoteForCache) {
    return noteContextSnapshotFromPlans(
      note,
      dailyPlanClient.getCachedDailyPlans(),
    );
  }

  function changeContentLifecycle(
    changeKind: "add" | "update" | "remove",
    conflicted: boolean,
  ) {
    if (changeKind === "remove") return null;
    return (
      <span className="lifecycle-summary">
        <LifecycleIcon kind={changeKind} conflicted={conflicted} />
        <small>{lifecycleLabel(changeKind, conflicted)}</small>
      </span>
    );
  }

  let draftCancellationRenderIndex = 0;

  function draftCancellationRowsForSurface(
    dialog: HTMLDialogElement | null,
  ) {
    return [...draftCancellationRowHandlesRef.current.values()]
      .filter((row) => {
        const element = row.handle.getElement();
        return dialog
          ? Boolean(element && dialog.contains(element))
          : !element?.closest("dialog");
      })
      .sort((left, right) => left.index - right.index);
  }

  useLayoutEffect(() => {
    const pendingFocus = pendingDraftCancellationFocusRef.current;
    pendingDraftCancellationFocusRef.current = null;
    if (pendingFocus === null) return;
    const rows = draftCancellationRowsForSurface(pendingFocus.dialog);
    const focusRow =
      rows[pendingFocus.cancelledIndex] ?? rows.at(-1);
    if (!focusRow) {
      restoreDialogFocus({
        kind: "active-dialog-control",
        control: "back",
      });
      return;
    }
    focusRow.handle.focusEditControl();
  });

  function draftCancellationTarget(
    item:
      | ChangeContentTimetableItem
      | ChangeContentTaskItem
      | Extract<ChangeContentNoteItem, { source: "draft" }>,
  ): DraftCancellationTarget {
    if (item.kind === "timetable") {
      return {
        kind: "timetable",
        targetScopeType: item.targetScopeType,
        changeDate: item.changeDate,
        periodNumber: item.periodNumber,
      };
    }
    return {
      kind: item.kind,
      sourceId: item.sourceId!,
    };
  }

  function cancelSharedInformationDraft(
    target: DraftCancellationTarget,
    onCancelled?: () => void,
  ) {
    const result = timetableEditorClient.cancelDraft(target);
    if (result.status === "submission-in-progress") return false;
    if (result.status === "already-cancelled") {
      resynchronizeCancelledDraftView(target);
      setTimetableEditorMessage("この下書きは既に取り消されています。");
      return false;
    }
    const relatedCancelled = result.cancelledDraftCount - 1;
    setTimetableEditorMessage(
      relatedCancelled > 0
        ? `下書きと関連するノート${relatedCancelled}件を取り消しました。`
        : "下書きを取り消しました。",
    );
    onCancelled?.();
    return true;
  }

  function resynchronizeCancelledDraftView(
    target: DraftCancellationTarget,
  ) {
    if (target.kind === "timetable") {
      setTimetableEditorForm((current) => {
        if (
          !current ||
          current.targetScopeType !== target.targetScopeType ||
          current.changeDate !== target.changeDate ||
          current.periodNumber !== target.periodNumber
        ) {
          return current;
        }
        const serverLayer = timetableLayerDialog?.state.status === "ready"
          ? timetableLayerDialog.state.layers.find(
              (layer) => layer.targetScopeType === target.targetScopeType,
            )
          : undefined;
        return serverLayer?.state === "active"
          ? {
              ...current,
              sourceId: undefined,
              includeTimetableChange: true,
              removalPlanned: false,
              noteBodies: [],
              replacement: serverLayer.replacement,
            }
          : {
              ...current,
              sourceId: undefined,
              includeTimetableChange: false,
              removalPlanned: false,
              noteBodies: [],
              replacement: { type: "lesson_name", lessonName: "" },
            };
      });
      return;
    }
    if (target.kind === "note") {
      setNoteEditorForm((current) => {
        if (current?.editingDraft?.sourceId !== target.sourceId) return current;
        if (!current.editingNote) {
          return {
            ...current,
            body: "",
            editingDraft: null,
            removalPlanned: false,
          };
        }
        return {
          ...current,
          body: current.editingNote.body,
          schoolDate: noteSchoolDate(current.editingNote),
          periodNumber: notePeriodNumber(current.editingNote),
          targetScopeType: current.editingNote.targetScopeType,
          editingDraft: null,
          removalPlanned: false,
        };
      });
      return;
    }
    const matchingDetail = taskDetail?.type === "draft" &&
      taskDetail.draft.sourceId === target.sourceId
      ? taskDetail
      : null;
    setTaskEditorForm((current) => {
      if (current?.editingDraft?.sourceId === target.sourceId) {
        const initial = createNewTaskDraftForm(selectedSchoolDate);
        return {
          title: initial.title,
          dueDate: initial.dueDate,
          targetScopeType: initial.targetScopeType,
          relatedLessonInput: "",
          noteBodies: [],
          removalPlanned: false,
          editingTask: null,
          editingDraft: null,
        };
      }
      if (!current?.editingTask || !matchingDetail) return current;
      const activeTask = current.editingTask;
      const noteBodies = timetableEditorClient.getSnapshot().noteDrafts
        .filter(
          (draft) =>
            draft.changeKind === "add" &&
            draft.relatedTaskItemId === activeTask.taskId,
        )
        .map((draft) => draft.body);
      return {
        ...current,
        title: activeTask.title,
        dueDate: activeTask.dueDate,
        targetScopeType: activeTask.targetScopeType,
        relatedLessonInput: activeTask.relatedLessonName?.lessonName ?? "",
        noteBodies,
        removalPlanned: false,
        editingDraft: null,
      };
    });
    resynchronizeTaskDetail(target.sourceId);
  }

  function resynchronizeTaskDetail(sourceId: string) {
    setTaskDetail((current) => {
      if (
        !current ||
        current.type !== "draft" ||
        current.draft.sourceId !== sourceId
      ) {
        return current;
      }
      if (current.activeTask) {
        return { type: "active", task: current.activeTask };
      }
      if (!current.editingTask) return current;
      const task = current.editingTask;
      return {
        type: "active",
        task: {
          taskId: task.taskId,
          latestChangeId: task.latestChangeId,
          title: task.title,
          dueDate: task.dueDate,
          ...(task.relatedLessonName
            ? {
                relatedLessonName: task.relatedLessonName.lessonName,
                ...(task.relatedLessonName.registeredLessonNameId
                  ? {
                      registeredRelatedLessonNameId:
                        task.relatedLessonName.registeredLessonNameId,
                    }
                  : {}),
              }
            : {}),
          targetScopeType: task.targetScopeType,
          createdAt: 0,
          notes: task.notes ?? [],
        },
      };
    });
  }

  function finishTaskDraftCancellation(sourceId: string) {
    resynchronizeTaskDetail(sourceId);
    applyDialogFlowResult(dialogFlow.completeCurrent());
  }

  function cancelListDraft(target: DraftCancellationTarget) {
    if (!cancelSharedInformationDraft(target)) {
      pendingDraftCancellationFocusRef.current = null;
      return;
    }
    setRevealedDraftCancellationId(null);
  }

  function cancellationRow(
    draftId: string,
    onCancel: () => void,
    content: ReactNode,
    accessibleLabel?: string,
    showMenuButton = false,
  ) {
    const rowIndex = draftCancellationRenderIndex++;
    const registrationKey = `${rowIndex}:${draftId}`;
    return (
      <DraftCancellationRow
        key={draftId}
        ref={(handle) => {
          if (handle) {
            draftCancellationRowHandlesRef.current.set(registrationKey, {
              handle,
              index: rowIndex,
            });
          } else {
            draftCancellationRowHandlesRef.current.delete(registrationKey);
          }
        }}
        draftId={draftId}
        accessibleLabel={accessibleLabel}
        showMenuButton={showMenuButton}
        open={revealedDraftCancellationId === registrationKey}
        disabled={timetableEditor.submitting}
        anotherRowOpen={
          revealedDraftCancellationId !== null &&
          revealedDraftCancellationId !== registrationKey
        }
        onInteractionStart={() => {
          setRevealedDraftCancellationId((current) =>
            current === registrationKey ? current : null
          );
        }}
        onOpenChange={(open) =>
          setRevealedDraftCancellationId(open ? registrationKey : null)
        }
        onCancel={() => {
          const registration =
            draftCancellationRowHandlesRef.current.get(registrationKey);
          const element = registration?.handle.getElement() ?? null;
          const dialog = element?.closest("dialog") ?? null;
          const surfaceRows = draftCancellationRowsForSurface(dialog);
          pendingDraftCancellationFocusRef.current = {
            cancelledIndex: Math.max(
              0,
              surfaceRows.findIndex((row) => row === registration),
            ),
            dialog,
          };
          onCancel();
        }}
      >
        {content}
      </DraftCancellationRow>
    );
  }

  function changeContentNoteCard(item: ChangeContentNoteItem) {
    const draft = item.source === "draft";
    const card = (
      <div
        className={item.conflicted ? "change-content-conflicted-note" : undefined}
        data-change-content-id={item.id}
        data-change-content-kind="note"
        data-change-kind={item.changeKind}
        data-change-content-projection={
          item.source === "task-cascade" ? "task-cascade" : undefined
        }
        key={item.id}
      >
        <NoteCard
          noteId={item.sourceId}
          body={
            item.changeKind === "remove"
              ? item.beforeBody ?? item.body
              : item.afterBody ?? item.body
          }
          schoolDateLabel={item.schoolDate && item.periodNumber == null
            ? changeContentDateLabel(item.schoolDate)
            : undefined}
          targetScopeLabel={scopeLabel(
            item.targetScopeType,
            changeContentScopeContext(),
          )}
          draft
          changeKind={item.changeKind}
          conflicted={item.conflicted}
          removalReason={
            item.source === "task-cascade" ? "task-cascade" : undefined
          }
          showChevron={draft}
          onOpen={draft ? () => openChangeContentNote(item) : undefined}
        />
      </div>
    );
    return draft
      ? cancellationRow(
          item.sourceId,
          () => cancelListDraft(draftCancellationTarget(item)),
          card,
        )
      : card;
  }

  function changeContentTimetableCard(item: ChangeContentTimetableItem) {
    const replacement = item.replacement ?? item.serverReplacement;
    const removed = item.changeKind === "remove";
    return cancellationRow(
      item.sourceId,
      () => cancelListDraft(draftCancellationTarget(item)),
      <article
        aria-label={removed ? "時間割変更の削除予定" : undefined}
        className={`task-entry task-draft change-content-preview-card${
          removed ? " task-removal-draft" : ""
        }${item.conflicted ? " change-content-conflicted" : ""}`}
        data-change-content-id={item.id}
      >
        <button
          className="task-item"
          type="button"
          data-change-content-kind="timetable"
          data-change-kind={item.changeKind}
          onClick={() => openChangeContentTimetable(item)}
        >
          <span>
            <strong>
              {replacement ? replacementLabel(replacement) : "変更内容"}
            </strong>
            <small>
              {changeContentDateLabel(item.changeDate)}・
              {item.periodNumber}限
            </small>
            <span className="task-scope-badge">
              {scopeLabel(
                item.targetScopeType,
                changeContentScopeContext(),
              )}
            </span>
            {changeContentLifecycle(item.changeKind, item.conflicted)}
          </span>
          <span aria-hidden="true">›</span>
        </button>
        {removed ? (
          <RemovalMark
            className="task-removal-mark"
            label="時間割変更の削除予定"
          />
        ) : null}
      </article>,
    );
  }

  function changeContentDailyLessonView(
    item: ChangeContentDailyLessonItem,
  ) {
    const contextScopes = [...new Set(
      item.children.map((child) => child.targetScopeType),
    )];
    return (
      <li
        className="change-content-group-stack"
        data-change-content-kind="daily-lesson"
        key={item.id}
      >
        {item.timetableChanges.length > 0 ? (
          item.timetableChanges.map(changeContentTimetableCard)
        ) : (
          <article className="task-entry change-content-context-card">
            <div className="task-item">
              <span>
                <strong>{item.resolvedLessonName || "授業なし"}</strong>
                <small>
                  {changeContentDateLabel(item.schoolDate)}・
                  {item.periodNumber}限
                </small>
                <span className="change-content-scope-list">
                  {contextScopes.map((scope) => (
                    <span className="task-scope-badge" key={scope}>
                      {scopeLabel(scope, changeContentScopeContext())}
                    </span>
                  ))}
                </span>
              </span>
            </div>
          </article>
        )}
        {item.children.length > 0 ? (
          <div
            className="change-content-related-notes"
            aria-label={`${item.periodNumber}限のノート`}
          >
            {item.children.map(changeContentNoteCard)}
          </div>
        ) : null}
      </li>
    );
  }

  function changeContentTaskView(item: ChangeContentTaskItem) {
    const taskRemoved = item.draft?.changeKind === "remove";
    const taskRemovalLabel = taskRemoved
      ? item.children.length === 0
        ? "削除予定のタスク"
        : `削除予定のタスク。関連するノート${item.children.length}件も削除予定です`
      : undefined;
    const taskContent = (
      <>
        <span>
          <strong>{item.task.title}</strong>
          <small>
            {formatTaskDueLabel(item.task.dueDate, selectedSchoolDate)}
            {item.task.relatedLessonName
              ? ` · ${item.task.relatedLessonName}`
              : ""}
          </small>
          <span className="task-scope-badge">
            {scopeLabel(
              item.task.targetScopeType,
              changeContentScopeContext(),
            )}
          </span>
          {item.draft
            ? changeContentLifecycle(
                item.draft.changeKind,
                item.conflicted,
              )
            : null}
        </span>
        {item.draft ? <span aria-hidden="true">›</span> : null}
      </>
    );
    return (
      <li key={item.id}>
        <article
          aria-label={taskRemovalLabel}
          className={`task-entry${
            item.draft ? " task-draft change-content-preview-card" : " change-content-context-card"
          }${taskRemoved ? " task-removal-draft" : ""}${
            item.conflicted ? " change-content-conflicted" : ""
          }`}
          data-change-content-kind="task"
          data-change-content-id={item.id}
          data-change-kind={item.draft?.changeKind}
        >
          {item.draft ? (
            cancellationRow(
              item.sourceId!,
              () => cancelListDraft(draftCancellationTarget(item)),
              <button
                className="task-item"
                type="button"
                onClick={() => openChangeContentTask(item)}
              >
                {taskContent}
              </button>,
            )
          ) : (
            <div className="task-item">{taskContent}</div>
          )}
          {item.children.length > 0 ? (
            <div
              className="task-note-list change-content-related-notes"
              aria-label={`${item.task.title}のノート`}
            >
              {item.children.map(changeContentNoteCard)}
            </div>
          ) : null}
          {taskRemoved ? (
            <RemovalMark
              className="task-removal-mark"
              label={taskRemovalLabel!}
            />
          ) : null}
        </article>
      </li>
    );
  }

  function changeContentItemView(item: ChangeContentItem) {
    if (item.kind === "daily-lesson") {
      return changeContentDailyLessonView(item);
    }
    if (item.kind === "task") return changeContentTaskView(item);
    return <li key={item.id}>{changeContentNoteCard(item)}</li>;
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
      noteBodies: [],
      removalPlanned: false,
      editingTask: null,
      editingDraft: null,
    });
  }

  function openNoteEditor() {
    openNoteEditorForm({
      ...createNewNoteDraftForm(selectedSchoolDate),
      editingNote: null,
      editingDraft: null,
      removalPlanned: false,
      relatedTask: null,
    });
  }

  function noteSchoolDate(note: DailyPlanNoteForCache) {
    return note.relatedContext?.type === "school-date" ||
      note.relatedContext?.type === "daily-lesson"
      ? note.relatedContext.schoolDate
      : null;
  }

  function captureNoteDialogFocusTarget(
    parent: NoteDialogParent,
    noteId: string,
  ): DialogFocusTarget {
    const { scrollContainer } = activeDialogElements();
    pendingNoteDialogScrollTopRef.current = scrollContainer?.scrollTop ?? 0;
    if (parent === "task-detail") {
      return {
        kind: "task-note",
        taskId: taskDetail!.task.taskId,
        noteId,
      };
    }
    return {
      kind: "daily-lesson-note",
      schoolDate: timetableLayerDialog!.schoolDate,
      periodNumber: timetableLayerDialog!.periodNumber,
      noteId,
    };
  }

  function openChangeContentDialog() {
    const transition = dialogFlow.openChangeContent({
      returnFocus: {
        kind: "flow-trigger",
        control: "change-content",
      },
    });
    if (transition.status === "rejected") return;
  }

  function activeDialogElements() {
    const dialog = Array.from(
      document.querySelectorAll<HTMLDialogElement>(
        "dialog[open]:not([aria-hidden='true'])",
      ),
    ).at(-1);
    const scrollContainer =
      dialog?.querySelector<HTMLElement>(".editor-dialog-body") ?? dialog;
    return { dialog, scrollContainer };
  }

  function openReferencePicker() {
    setMenuOpen(false);
    const transition = dialogFlow.openReferencePicker({
      returnFocus: {
        kind: "flow-trigger",
        control: "reference-picker",
      },
    });
    if (transition.status === "rejected") return;
    if (referenceScopeOptionsResource.state.status === "error") {
      referenceScopeOptionsResource.retry();
    }
    if (referenceScope) {
      setReferencePickerScopeKey(referenceScopeKey(referenceScope));
    }
  }

  function selectReferenceScope(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (referenceScopeOptionsResource.state.status !== "ready") return;
    const option = referenceScopeOptionsResource.state.value.options.find(
      (candidate) =>
        referenceScopeKey(candidate) === effectiveReferencePickerScopeKey,
    );
    if (!option) return;
    if (
      referenceScope?.type === option.type &&
      referenceScope.value === option.value
    ) {
      if (referenceDailyPlanResource.state.status === "error") {
        referenceDailyPlanResource.retry();
      }
      applyDialogFlowResult(dialogFlow.completeCurrent());
      return;
    }
    setReferenceScope(option);
    applyDialogFlowResult(dialogFlow.completeCurrent());
  }

  function leaveReferenceScope() {
    setReferenceScope(null);
    setMenuOpen(false);
  }

  function notePeriodNumber(note: DailyPlanNoteForCache) {
    return note.relatedContext?.type === "daily-lesson"
      ? note.relatedContext.periodNumber
      : null;
  }

  function openNoteUpdateEditor(
    note: DailyPlanNoteForCache,
    returnFocus?: DialogFocusTarget,
  ) {
    openNoteEditorForm(
      {
        body: note.body,
        schoolDate: noteSchoolDate(note),
        periodNumber: notePeriodNumber(note),
        targetScopeType: note.targetScopeType,
        editingNote: note,
        editingDraft: null,
        removalPlanned: false,
        relatedTask: null,
      },
      returnFocus,
    );
  }

  function openNoteDraftEditor(
    draft: NoteDraft,
    basis?: NoteDraftBasis,
    returnFocus?: DialogFocusTarget,
  ) {
    const editingNote = draft.changeKind === "add"
      ? null
      : basis && "activeNote" in basis
        ? basis.activeNote
        : reflectedNoteFromDraft(draft, basis?.beforeBody) ?? null;
    openNoteEditorForm(
      {
        body: draft.body,
        schoolDate: draft.schoolDate,
        periodNumber: draft.periodNumber,
        targetScopeType: draft.targetScopeType,
        editingNote,
        editingDraft: draft,
        removalPlanned: draft.changeKind === "remove",
        relatedTask: null,
      },
      returnFocus,
    );
  }

  function openTaskNoteEditor(
    task: {
      taskId: string;
      title: string;
      dueDate: string | null;
      relatedLessonName?: string;
      targetScopeType: TargetScopeType;
    },
    note?: DailyPlanNoteForCache,
    draft?: NoteDraft,
    returnFocus?: DialogFocusTarget,
  ) {
    openNoteEditorForm(
      {
        body: draft?.body ?? note?.body ?? "",
        schoolDate: null,
        periodNumber: null,
        targetScopeType: task.targetScopeType,
        editingNote: note ?? null,
        editingDraft: draft ?? null,
        removalPlanned: draft?.changeKind === "remove",
        relatedTask: task,
      },
      returnFocus,
    );
  }

  function reflectedNoteFromDraft(
    draft: NoteDraft,
    beforeBody?: string | null,
  ): DailyPlanNoteForCache | undefined {
    if (draft.changeKind === "add") return undefined;
    return {
      noteId: draft.sharedInformationItemId,
      latestChangeId: draft.expectedLatestChangeId,
      body: beforeBody ?? draft.body,
      targetScopeType: draft.targetScopeType,
      relatedContext: draft.relatedTaskItemId
        ? { type: "task", taskId: draft.relatedTaskItemId }
        : draft.periodNumber != null && draft.schoolDate
          ? {
              type: "daily-lesson",
              schoolDate: draft.schoolDate,
              periodNumber: draft.periodNumber,
            }
          : draft.schoolDate
            ? { type: "school-date", schoolDate: draft.schoolDate }
            : null,
    };
  }

  function activeNoteForEditing(note: DailyPlanNoteForCache) {
    const contextSnapshot = noteContextSnapshot(note);
    return {
      noteId: note.noteId,
      latestChangeId: note.latestChangeId,
      body: note.body,
      schoolDate: noteSchoolDate(note),
      periodNumber: notePeriodNumber(note),
      targetScopeType: note.targetScopeType,
      ...(note.relatedContext?.type === "task"
        ? { relatedTaskItemId: note.relatedContext.taskId }
        : {}),
      ...(contextSnapshot ? { contextSnapshot } : {}),
    };
  }

  function openNoteHistory(note: DailyPlanNoteForCache) {
    const transition = dialogFlow.openNoteHistory({
      noteId: note.noteId,
      returnFocus: {
        kind: "note-history-trigger",
        noteId: note.noteId,
      },
    });
    if (transition.status === "rejected") return;
    const routeInstanceId = currentRouteInstanceId("note-history");
    if (!routeInstanceId) return;
    setNoteHistoryDialog({
      routeInstanceId,
      note,
    });
  }

  function saveNoteDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveCurrentNoteDraft();
  }

  function saveCurrentNoteDraft() {
    if (!noteEditorForm || timetableEditor.submitting) return;
    const reflectedDetail = noteEditorForm.editingNote &&
      noteEditorForm.editingDraft?.changeKind !== "add";
    const result = reflectedDetail
      ? timetableEditorClient.saveNoteDetailDraft(
          activeNoteForEditing(noteEditorForm.editingNote!),
          noteEditorForm.body,
          noteEditorForm.removalPlanned,
        )
      : noteEditorForm.editingDraft
      ? timetableEditorClient.updateNoteDraft(
          noteEditorForm.editingDraft.sourceId,
          noteEditorForm,
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
    rememberEditedDailyPlanReturnDate(
      editorInitialFormsRef.current.note?.schoolDate ?? null,
      noteEditorForm.schoolDate,
    );
    closeNoteEditorFlow();
    setTimetableEditorMessage(null);
  }

  function openTaskUpdateEditor(
    task: ActiveTaskForEditing,
    projectedTask?: VisibleTask,
    returnFocus?: DialogFocusTarget,
  ) {
    setTaskLessonNamesExpanded(false);
    setTaskLessonNameListOpen(false);
    setActiveTaskLessonNameOption(-1);
    const existingDraft = timetableEditor.taskDrafts.find(
      (draft) =>
        draft.changeKind !== "add" &&
        draft.sharedInformationItemId === task.taskId,
    );
    const removalPlanned = existingDraft?.changeKind === "remove";
    const noteDrafts = removalPlanned
      ? existingDraft.suspendedDependentNoteDrafts ?? []
      : timetableEditor.noteDrafts;
    openTaskEditorForm({
      title: projectedTask?.title ?? task.title,
      dueDate: projectedTask?.dueDate ?? task.dueDate,
      targetScopeType: task.targetScopeType,
      relatedLessonInput: projectedTask?.relatedLessonName ??
        task.relatedLessonName?.lessonName ?? "",
      noteBodies: noteDrafts
        .filter(
          (note) =>
            note.changeKind === "add" &&
            note.relatedTaskItemId === task.taskId,
        )
        .map((note) => note.body),
      removalPlanned,
      editingTask: task,
      editingDraft: null,
    }, returnFocus);
  }

  function openTaskDraftEditor(
    draft: TaskDraft,
    returnFocus?: DialogFocusTarget,
  ) {
    if (draft.changeKind !== "add") return;
    setTaskLessonNamesExpanded(false);
    setTaskLessonNameListOpen(false);
    setActiveTaskLessonNameOption(-1);
    openTaskEditorForm({
      title: draft.title,
      dueDate: draft.dueDate,
      targetScopeType: draft.targetScopeType,
      relatedLessonInput: draft.relatedLessonName?.lessonName ?? "",
      noteBodies: timetableEditor.noteDrafts
        .filter(
          (note) =>
            note.changeKind === "add" &&
            note.relatedTaskItemId === draft.sourceId,
        )
        .map((note) => note.body),
      removalPlanned: false,
      editingTask: null,
      editingDraft: draft,
    }, returnFocus);
    setTaskDetail(null);
  }

  function saveTaskDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!taskEditorForm || timetableEditor.submitting) return;
    const taskRemovalRequested = Boolean(
      taskEditorForm.editingTask && taskEditorForm.removalPlanned,
    );
    const existingTaskRemoval = taskEditorForm.editingTask
      ? timetableEditor.taskDrafts.some(
          (draft) =>
            draft.changeKind === "remove" &&
            draft.sharedInformationItemId === taskEditorForm.editingTask!.taskId,
        )
      : false;
    if (
      taskRemovalRequested &&
      !existingTaskRemoval &&
      (taskEditorForm.editingTask?.notes?.length ?? 0) > 0
    ) {
      setTaskRemovalCheckboxFocusRequested(false);
      dialogFlow.openTaskRemovalConfirmation();
      setTaskRemovalConfirmation({
        task: taskEditorForm.editingTask!,
      });
      return;
    }
    if (taskRemovalRequested) {
      saveTaskRemovalTransition(taskEditorForm.editingTask!, false);
      return;
    }
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
      ? timetableEditorClient.updateTaskDraftWithNotes(
          taskEditorForm.editingDraft.sourceId,
          {
            title: taskEditorForm.title,
            dueDate: taskEditorForm.dueDate,
            targetScopeType: taskEditorForm.targetScopeType,
            relatedLessonName,
          },
          taskEditorForm.noteBodies,
        )
      : taskEditorForm.editingTask
      ? timetableEditorClient.saveTaskUpdateDraftWithNotes(
          taskEditorForm.editingTask,
          {
            title: taskEditorForm.title,
            dueDate: taskEditorForm.dueDate,
            relatedLessonName,
          },
          taskEditorForm.noteBodies,
        )
      : timetableEditorClient.saveTaskDraftWithNotes({
          title: taskEditorForm.title,
          dueDate: taskEditorForm.dueDate,
          targetScopeType: taskEditorForm.targetScopeType,
          relatedLessonName,
        }, taskEditorForm.noteBodies);
    if (result.status === "invalid-task" || result.status === "invalid-note") {
      setTimetableEditorMessage(
        "タイトル、期限、関連する授業、変更適用範囲を確認してください。",
      );
      return;
    }
    if (result.status === "limit-reached") {
      setTimetableEditorMessage("下書きは合計50件までです。");
      return;
    }
    rememberEditedDailyPlanReturnDate(
      editorInitialFormsRef.current.task?.dueDate ?? null,
      taskEditorForm.dueDate,
    );
    closeTaskEditorFlow();
    setTimetableEditorMessage(null);
  }

  function taskNoteList(
    task: {
      taskId: string;
      title: string;
      dueDate: string | null;
      relatedLessonName?: string;
      targetScopeType: TargetScopeType;
    },
    activeNotes: DailyPlanNoteForCache[],
    {
      taskRemovalPlanned = false,
      notesOpenDetail = false,
      presentation = "daily-plan",
      hideAddedDrafts = false,
      onOpenRelatedNote,
    }: {
      taskRemovalPlanned?: boolean;
      notesOpenDetail?: boolean;
      presentation?: "daily-plan" | "detail";
      hideAddedDrafts?: boolean;
      onOpenRelatedNote?: () => void;
    } = {},
  ) {
    const items = buildVisibleTaskNoteList(
      activeNotes,
      timetableEditor.noteDrafts,
      task.taskId,
      { taskRemovalPlanned },
    ).filter((item) =>
      !hideAddedDrafts || item.type !== "draft" ||
      item.draft.changeKind !== "add"
    ).map((item) => {
      if (item.type === "draft") {
        const note = item.draft;
        return {
          noteId: note.sourceId,
          body: note.body,
          draft: true,
          changeKind: note.changeKind,
          conflicted: note.conflicted,
          onCancelDraft: notesOpenDetail
            ? () => cancelListDraft({
                kind: "note",
                sourceId: note.sourceId,
              })
            : undefined,
          onOpen: notesOpenDetail
            ? () => item.activeNote
              ? openTaskNoteEditor(
                  task,
                  item.activeNote,
                  note,
                  captureNoteDialogFocusTarget("task-detail", note.sourceId),
                )
              : openTaskNoteEditor(
                  task,
                  undefined,
                  note,
                  captureNoteDialogFocusTarget("task-detail", note.sourceId),
                )
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
          onOpen: undefined,
        };
      }
      const note = item.note;
      return {
        noteId: note.noteId,
        body: note.body,
        onOpen: notesOpenDetail
          ? () => openTaskNoteEditor(
              task,
              note,
              undefined,
              captureNoteDialogFocusTarget("task-detail", note.noteId),
            )
          : undefined,
      };
    });
    return (
      <TaskNoteList
        notes={items}
        presentation={presentation}
        onOpenRelatedNote={onOpenRelatedNote}
        wrapDraftCancellation={presentation === "detail"
          ? (note, content) =>
              cancellationRow(
                note.noteId,
                note.onCancelDraft!,
                content,
                undefined,
                true,
              )
          : undefined}
      />
    );
  }

  function updateTaskNoteBody(index: number, body: string) {
    setTaskEditorForm((current) =>
      current
        ? {
            ...current,
            noteBodies: replaceNoteBody(current.noteBodies, index, body),
          }
        : current
    );
  }

  function addTaskNoteBody() {
    setTaskEditorForm((current) =>
      current
        ? { ...current, noteBodies: appendEmptyNoteBody(current.noteBodies) }
        : current
    );
  }

  function updateTimetableNoteBody(index: number, body: string) {
    setTimetableEditorForm((current) =>
      current
        ? {
            ...current,
            noteBodies: replaceNoteBody(current.noteBodies, index, body),
          }
        : current
    );
  }

  function addTimetableNoteBody() {
    setTimetableEditorForm((current) =>
      current
        ? { ...current, noteBodies: appendEmptyNoteBody(current.noteBodies) }
        : current
    );
  }

  function openTaskDetail(item: VisibleTaskListItem) {
    if (!timetableEditor.editing) {
      const transition = dialogFlow.openTaskDetail({
        taskId: item.task.taskId,
        returnFocus: { kind: "task-item", taskId: item.task.taskId },
      });
      if (transition.status === "rejected") return;
      setTaskDetail(item);
      return;
    }
    if (item.type === "active") {
      setTaskDetail(item);
      openTaskUpdateEditor(editableTask(item.task), item.task);
      return;
    }
    if (item.draft.changeKind === "add") {
      openTaskDraftEditor(item.draft);
      return;
    }
    if (item.editingTask) {
      setTaskDetail(item);
      openTaskUpdateEditor(item.editingTask, item.task);
      return;
    }
    const transition = dialogFlow.openTaskDetail({
      taskId: item.task.taskId,
      returnFocus: { kind: "task-item", taskId: item.task.taskId },
    });
    if (transition.status === "rejected") return;
    setTaskDetail(item);
  }

  function dailyLessonNoteList(
    activeNotes: DailyPlanNoteForCache[],
    schoolDate: string,
    periodNumber: number,
    scopeContext: TargetScopeDisplayContext | undefined,
    {
      targetScopeType,
      className,
      notesOpenDetail = false,
      onOpenRelatedNote,
    }: {
      targetScopeType?: TargetScopeType;
      className?: string;
      notesOpenDetail?: boolean;
      onOpenRelatedNote?: () => void;
    } = {},
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
          targetScopeLabel: targetScopeType
            ? undefined
            : scopeLabel(note.targetScopeType, scopeContext),
          draft: true,
          changeKind: note.changeKind,
          conflicted: note.conflicted,
          onCancelDraft: notesOpenDetail
            ? () => cancelListDraft({
                kind: "note",
                sourceId: note.sourceId,
              })
            : undefined,
          onOpen: notesOpenDetail
            ? () => openNoteDraftEditor(
                note,
                item.activeNote ? { activeNote: item.activeNote } : undefined,
                captureNoteDialogFocusTarget(
                  "daily-lesson-detail",
                  note.sourceId,
                ),
              )
            : undefined,
        };
      }
      const note = item.note;
      return {
        noteId: note.noteId,
        body: note.body,
        targetScopeLabel: targetScopeType
          ? undefined
          : scopeLabel(note.targetScopeType, scopeContext),
        onOpen: notesOpenDetail
          ? () => openNoteUpdateEditor(
              note,
              captureNoteDialogFocusTarget(
                "daily-lesson-detail",
                note.noteId,
              ),
            )
          : undefined,
      };
    });
    return (
      <DailyLessonNoteList
        notes={items}
        className={className}
        presentation={notesOpenDetail ? "detail" : "related"}
        onOpenRelatedNote={onOpenRelatedNote}
        wrapDraftCancellation={notesOpenDetail
          ? (note, content) =>
              cancellationRow(
                note.noteId,
                note.onCancelDraft!,
                content,
                undefined,
                true,
              )
          : undefined}
      />
    );
  }

  function cancelTaskRemovalConfirmation() {
    dialogFlow.cancelOverlay();
    setTaskRemovalConfirmation(null);
    if (taskDetail) {
      setTaskRemovalCheckboxFocusRequested(true);
    }
  }

  function confirmTaskRemoval() {
    if (!taskRemovalConfirmation) return;
    saveTaskRemovalTransition(taskRemovalConfirmation.task, true);
  }

  function saveTaskRemovalTransition(
    task: ActiveTaskForEditing,
    fromConfirmation: boolean,
  ) {
    const result = timetableEditorClient.saveTaskRemoveDraft(task);
    if (result.status === "limit-reached") {
      setTimetableEditorMessage("下書きは合計50件までです。");
      if (fromConfirmation) cancelTaskRemovalConfirmation();
      return;
    }
    if (result.status === "submission-in-progress") {
      if (fromConfirmation) cancelTaskRemovalConfirmation();
      return;
    }
    if (fromConfirmation) {
      dialogFlow.cancelOverlay();
      setTaskRemovalConfirmation(null);
    }
    closeTaskEditorFlow();
    const parent = dialogFlow.getSnapshot().routes.at(-1);
    if (parent?.kind === "task-detail" && parent.taskId === task.taskId) {
      applyDialogFlowResult(dialogFlow.completeCurrent());
    }
    setTimetableEditorMessage(null);
    if (dialogFlow.getSnapshot().routes.at(-1)?.kind !== "change-content") {
      setDailyPlanTaskFocusRequestId(task.taskId);
    }
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
            removalPlanned: existing.changeKind === "remove",
            noteBodies: [],
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
              removalPlanned: false,
              noteBodies: [],
              replacement: serverLayer.replacement,
            }
          : {
              targetScopeType,
              changeDate: timetableLayerDialog.schoolDate,
              periodNumber: timetableLayerDialog.periodNumber,
              includeTimetableChange: false,
              removalPlanned: false,
              noteBodies: [],
              replacement: { type: "lesson_name", lessonName: "" },
            });
    const transition = dialogFlow.openTimetableEditor({
      schoolDate: form.changeDate,
      periodNumber: form.periodNumber,
      targetScopeType: form.targetScopeType,
      returnFocus: {
        kind: "timetable-layer-action",
        targetScopeType: form.targetScopeType,
        action: "edit",
      },
    });
    if (transition.status === "rejected") return;
    editorInitialFormsRef.current.timetable = form;
    setTimetableEditorForm(form);
  }

  openLayerReplacementRef.current = openLayerReplacement;

  function openLayerHistory(targetScopeType: TargetScopeType) {
    if (!timetableLayerDialog) return;
    const transition = dialogFlow.openTimetableHistory({
      targetScopeType,
      schoolDate: timetableLayerDialog.schoolDate,
      periodNumber: timetableLayerDialog.periodNumber,
      returnFocus: {
        kind: "timetable-layer-action",
        targetScopeType,
        action: "history",
      },
    });
    if (transition.status === "rejected") return;
    const routeInstanceId = currentRouteInstanceId("timetable-history");
    if (!routeInstanceId) return;
    setTimetableHistoryDialog({
      routeInstanceId,
      targetScopeType,
      changeDate: timetableLayerDialog.schoolDate,
      periodNumber: timetableLayerDialog.periodNumber,
    });
  }

  function openTaskHistory(task: DailyPlanTaskForCache) {
    const transition = dialogFlow.openTaskHistory({
      taskId: task.taskId,
      returnFocus: {
        kind: "task-history-trigger",
        taskId: task.taskId,
      },
    });
    if (transition.status === "rejected") return;
    const routeInstanceId = currentRouteInstanceId("task-history");
    if (!routeInstanceId) return;
    setTaskHistoryDialog({
      routeInstanceId,
      task,
    });
  }

  function openSharedInformationChangeDetail(
    sharedInformationChangeId: string,
  ) {
    if (
      topDialogRoute?.kind !== "shared-information-change-detail" ||
      topDialogRoute.sharedInformationChangeId !== sharedInformationChangeId
    ) {
      const transition = dialogFlow.openSharedInformationChangeDetail({
        sharedInformationChangeId,
        returnFocus: {
          kind: "shared-information-history-entry",
          sharedInformationChangeId,
        },
      });
      if (transition.status === "rejected") return;
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

  function closeTimetableFormAfterDraftSave() {
    applyDialogFlowResult(dialogFlow.completeCurrent());
    const remainingRoutes = dialogFlow.getSnapshot().routes;
    if (
      remainingRoutes.at(-1)?.kind === "timetable-layer" &&
      remainingRoutes.at(-2)?.kind === "change-content"
    ) {
      applyDialogFlowResult(dialogFlow.completeCurrent());
    }
  }

  function requestTimetableEditorClose(destination: "close" | "back") {
    if (destination === "close") {
      requestDialogCloseAll();
    } else {
      requestDialogBack();
    }
  }

  function discardUnsavedEditorInput() {
    applyDialogFlowResult(dialogFlow.confirmPending());
  }

  function goBackInTimetableHistoryDialog() {
    requestDialogBack();
  }

  function goBackFromTaskHistory() {
    requestDialogBack();
  }

  function navigateLayerDialog(schoolDate: string, periodNumber: number) {
    const transition = dialogFlow.navigateTimetableLayer({
      schoolDate,
      periodNumber,
    });
    if (transition.status === "rejected") return;
    setTimetableEditorForm(null);
    editorInitialFormsRef.current.timetable = null;
    setTimetableLayerDialog((current) =>
      current
        ? {
            ...current,
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
      !timetableEditorForm.removalPlanned &&
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
      !timetableEditorForm.removalPlanned &&
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
      replacement: timetableEditorForm.includeTimetableChange &&
          !timetableEditorForm.removalPlanned
        ? replacement
        : null,
      removeTimetableChange: timetableEditorForm.removalPlanned,
      noteBodies: timetableEditorForm.noteBodies,
      resolvedLessonName: cachedDailyLessonName(
        timetableEditorForm.changeDate,
        timetableEditorForm.periodNumber,
      ),
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
    if (result.status === "not-active") {
      setTimetableEditorMessage(NO_ACTIVE_TIMETABLE_CHANGE_MESSAGE);
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

  async function commitTimetableDrafts() {
    applyDialogFlowResult(dialogFlow.completeCurrent());
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
        "ネットワークに接続できません。下書きはこの端末に保存されています。変更を反映からもう一度お試しください。",
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
    const cachedDailyPlans = dailyPlanClient.getCachedDailyPlans();
    const visibleTasks = dailyPlanState.status === "ready"
      ? buildVisibleTaskList(
          dailyPlanState.dailyPlan.tasks,
          timetableEditor.taskDrafts,
          selectedSchoolDate,
          cachedDailyPlans.flatMap((plan) => plan.tasks),
        )
      : [];
    const changeContentItems = buildChangeContentList({
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
      dailyLessons: dailyPlanClient.getCachedDailyPlans().flatMap((plan) =>
        plan.periods.map((period) => ({
          schoolDate: plan.schoolDate,
          periodNumber: period.periodNumber,
          lessonName: period.lessonName,
        }))),
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
          timetableReferenceCatalog(timetableEditorOptions),
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
      listOpen: taskLessonNameListOpen && !taskEditorForm?.removalPlanned,
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
    const noteDetailOpen = Boolean(
      noteEditorForm?.editingNote ||
      (noteEditorForm?.editingDraft &&
        noteEditorForm.editingDraft.changeKind !== "add"),
    );
    const noteDialogRoute = [...dialogFlowSnapshot.routes].reverse().find(
      (route) =>
        route.kind === "note-detail" || route.kind === "note-editor",
    );
    const noteDialogHasParent = noteDialogRoute
      ? dialogFlowSnapshot.routes.findIndex(
          (route) => route.instanceId === noteDialogRoute.instanceId,
        ) > 0
      : false;
    const noteReturnFocus = noteDialogRoute?.returnFocus;
    const noteDetailValues = noteEditorForm && noteDetailOpen
      ? [
          {
            label: "変更適用範囲",
            value: scopeLabel(
              noteEditorForm.targetScopeType!,
              targetScopeContext,
            ),
          },
          {
            label: "関連先",
            value: noteEditorForm.relatedTask
              ? `タスク「${noteEditorForm.relatedTask.title}」`
              : noteEditorForm.periodNumber != null && noteEditorForm.schoolDate
                ? `${formatUiSchoolDate(noteEditorForm.schoolDate, {
                    referenceSchoolDate: selectedSchoolDate,
                  })}・${noteEditorForm.periodNumber}限`
                : noteEditorForm.schoolDate
                  ? formatUiSchoolDate(noteEditorForm.schoolDate, {
                      referenceSchoolDate: selectedSchoolDate,
                    })
                  : "なし",
          },
        ]
      : [];
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
    const referenceDailyPlan =
      referenceDailyPlanResource.state.status === "ready"
        ? referenceDailyPlanResource.state.value
        : null;
    const referencePlanReady =
      referenceScope !== null &&
      referenceDailyPlan !== null &&
      referenceBasePeriods !== null;
    const referencePlanError =
      referenceScope !== null &&
      referenceDailyPlanResource.state.status === "error";
    const previousSchoolDate = shiftSchoolDate(selectedSchoolDate, -1);
    const nextSchoolDate = shiftSchoolDate(selectedSchoolDate, 1);
    const canGoPrevious = Boolean(
      schoolYearRange && selectedSchoolDate > schoolYearRange.startsOn,
    );
    const canGoNext = Boolean(
      schoolYearRange && selectedSchoolDate < schoolYearRange.endsOn,
    );
    const previousDailyPlan = referenceScope
      ? null
      : cachedDailyPlans.find(
          (plan) => plan.schoolDate === previousSchoolDate,
        ) ?? null;
    const nextDailyPlan = referenceScope
      ? null
      : cachedDailyPlans.find(
          (plan) => plan.schoolDate === nextSchoolDate,
        ) ?? null;

    const taskEditorFields = taskEditorForm ? (
      <>
        <label>
          <span>タイトル</span>
          <input
            autoFocus
            required
            maxLength={120}
            disabled={taskEditorForm.removalPlanned}
            value={taskEditorForm.title}
            onChange={(event) =>
              setTaskEditorForm((current) =>
                current ? { ...current, title: event.target.value } : current
              )}
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
              disabled={taskEditorForm.removalPlanned}
              value={taskEditorForm.dueDate ?? ""}
              onChange={(event) =>
                setTaskEditorForm((current) =>
                  current
                    ? { ...current, dueDate: event.target.value || null }
                    : current
                )}
            />
            <button
              className="optional-date-clear"
              type="button"
              aria-label="期限をクリア"
              title="期限をクリア"
              disabled={
                taskEditorForm.removalPlanned || !taskEditorForm.dueDate
              }
              onClick={() =>
                setTaskEditorForm((current) =>
                  current ? { ...current, dueDate: null } : current
                )}
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
              })}
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
              disabled={taskEditorForm.removalPlanned}
              value={taskEditorForm.relatedLessonInput}
              onFocus={() => setTaskLessonNameListOpen(true)}
              onChange={(event) => {
                setTaskLessonNameListOpen(true);
                setActiveTaskLessonNameOption(-1);
                setTaskEditorForm((current) =>
                  current
                    ? { ...current, relatedLessonInput: event.target.value }
                    : current
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
                  const option =
                    taskLessonNameSnapshot.options[
                      taskLessonNameSnapshot.activeIndex
                    ];
                  if (!option) return;
                  setTaskEditorForm((current) =>
                    current
                      ? {
                          ...current,
                          relatedLessonInput: option.fullLessonName,
                        }
                      : current
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
                      : current
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
        {!taskEditorForm.removalPlanned && taskLessonResolution?.custom &&
        !(
          taskEditorForm.editingTask?.relatedLessonName
            ?.registeredLessonNameId &&
          taskEditorForm.relatedLessonInput.trim() ===
            taskEditorForm.editingTask.relatedLessonName.lessonName
        ) ? (
          <p className="field-warning" role="status">
            候補にない授業名として保存されます。
          </p>
        ) : null}
        {taskEditorForm.editingTask ? (
          <dl className="detail-list task-edit-context">
            <div>
              <dt>変更適用範囲</dt>
              <dd>
                {scopeLabel(
                  taskEditorForm.editingTask.targetScopeType,
                  targetScopeContext,
                )}
              </dd>
            </div>
          </dl>
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
                        targetScopeType: (event.target.value || null) as
                          | TargetScopeType
                          | null,
                      }
                    : current
                )}
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
      </>
    ) : null;

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

          <DailyPlanSwipeFrame
            previous={<DailyPlanSwipePreview plan={previousDailyPlan} />}
            next={<DailyPlanSwipePreview plan={nextDailyPlan} />}
            canGoPrevious={canGoPrevious}
            canGoNext={canGoNext}
            disabled={dialogFlowSnapshot.active}
            onNavigate={(direction) => {
              shouldCenterDatePickerRef.current = true;
              void dailyPlanClient.shiftSelectedSchoolDate(direction);
            }}
          >
          <div className="daily-plan-main">
            {referenceScope && !referencePlanReady && !referencePlanError ? (
              <div className="panel state-panel" aria-live="polite">
                {referenceScope.label}の予定を読み込んでいます…
              </div>
            ) : null}

            {referenceScope && referencePlanError ? (
              <div className="panel state-panel" role="alert">
                <h2>参照する予定を読み込めませんでした</h2>
                <p>再読み込みするか、参照する範囲を選び直してください。</p>
                <div className="state-panel-actions">
                  <button
                    className="button-primary"
                    type="button"
                    onClick={referenceDailyPlanResource.retry}
                  >
                    再読み込み
                  </button>
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={openReferencePicker}
                  >
                    範囲を選び直す
                  </button>
                </div>
              </div>
            ) : null}

            {referenceScope && referencePlanReady && referenceDailyPlan ? (
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
                      const layerState = timetableLayerCacheRef.current.get(
                        selectedSchoolDate,
                        period.periodNumber,
                      );
                      const projectedLesson = lifecycleDrafts.length > 0 && layerState
                        ? timetableEditorClient.previewLayerState(
                            layerState,
                            timetableReferenceCatalog(timetableEditorOptions),
                          ).finalDailyLesson
                        : period;
                      const removalPlanned = lifecycleDrafts.some(
                        (draft) => draft.changeKind === "remove",
                      );
                      const replacementPlanned = lifecycleDrafts.some(
                        (draft) => draft.changeKind !== "remove",
                      );
                      const timetableDraftPresentation = lifecycleDrafts.some(
                          (draft) => draft.conflicted,
                        )
                        ? "draft-conflicted"
                        : removalPlanned && replacementPlanned
                        ? "draft-mixed"
                        : removalPlanned
                        ? "draft-removal"
                        : lifecycleDrafts.length > 0
                        ? "draft-edited"
                        : "";
                      const accessibleLessonLabel = timetableEditor.editing
                        ? lifecycleDrafts.length > 0
                          ? dailyLessonTransitionAccessibleLabel(
                              period,
                              projectedLesson,
                              removalPlanned,
                            )
                          : effectiveDailyLessonAccessibleLabel(period)
                        : period.lessonName || "空欄";
                      return (
                        <article
                        className={`period-row inspectable ${
                          timetableDraftPresentation
                        } ${timetableEditor.editing ? "editable" : ""}`}
                        key={period.periodNumber}
                      >
                        <span className="period-number" aria-hidden="true">
                          {period.periodNumber}
                        </span>
                        <div className="period-content">
                          <button
                            className="period-inspect-button"
                            type="button"
                            data-school-date={selectedSchoolDate}
                            data-period={period.periodNumber}
                            aria-label={`${period.periodNumber}限 ${accessibleLessonLabel}${
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
                            <span className="period-main">
                              <span className="lesson-line">
                                <span
                                  className="lesson-name"
                                  {...(timetableEditor.editing
                                    ? { "aria-label": accessibleLessonLabel }
                                    : {})}
                                >
                                  <span aria-hidden={timetableEditor.editing || undefined}>
                                    {timetableEditor.editing
                                      ? lifecycleDrafts.length > 0
                                        ? (
                                          <span className="lesson-transition">
                                            <EffectiveDailyLesson
                                              className="lesson-transition-before"
                                              lesson={period}
                                            />
                                            <span className="lesson-transition-destination">
                                              <span
                                                className="lesson-transition-arrow"
                                                aria-hidden="true"
                                              >
                                                ▶
                                              </span>
                                              <EffectiveDailyLesson lesson={projectedLesson} />
                                            </span>
                                          </span>
                                        )
                                        : <EffectiveDailyLesson lesson={period} />
                                      : period.lessonName}
                                  </span>
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
                                        preserveKindGlyphOnConflict={
                                          draft.changeKind === "remove"
                                        }
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
                            {
                              onOpenRelatedNote: () =>
                                openTimetableEditor(period.periodNumber),
                            },
                          )}
                        </div>
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
                      const taskRemovalPlanned = item.type === "draft" &&
                        item.draft.changeKind === "remove";
                      const taskRemovalLabel = taskRemovalPlanned
                        ? task.notes.length === 0
                          ? "削除予定のタスク"
                          : `削除予定のタスク。関連するノート${task.notes.length}件も削除予定です`
                        : undefined;
                      return (
                      <article
                        aria-label={taskRemovalLabel}
                        className={`task-entry ${
                          item.type === "draft" ? "task-draft" : ""
                        }${taskRemovalPlanned ? " task-removal-draft" : ""}`}
                        key={item.type === "draft"
                          ? item.draft.sourceId
                          : task.taskId}
                      >
                        <button
                          className="task-item"
                          type="button"
                          data-task-id={task.taskId}
                          onClick={() => openTaskDetail(item)}
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
                            {item.type === "draft" && !taskRemovalPlanned ? (
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
                          {
                            taskRemovalPlanned,
                            onOpenRelatedNote: () => openTaskDetail(item),
                          },
                        )}
                        {taskRemovalPlanned ? (
                          <RemovalMark
                            className="task-removal-mark"
                            label={taskRemovalLabel!}
                          />
                        ) : null}
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
                        className="task-add-button note-add-button"
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
                              showChevron
                              onOpen={() => openNoteDraftEditor(
                                note,
                                item.activeNote
                                  ? { activeNote: item.activeNote }
                                  : undefined,
                              )}
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
                            showChevron
                            onOpen={() => openNoteUpdateEditor(note)}
                          />
                        );
                      });
                    })()}
                  </div>
                </section>
              </>
            ) : null}
          </div>
          </DailyPlanSwipeFrame>

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
                    {!referenceScope &&
                    timetableEditor.draftDates.includes(date.schoolDate) ? (
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
                      onClick={openChangeContentDialog}
                    >
                      変更を反映（{timetableEditor.draftCount}）
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
            <EditorDialog
              active={
                topDialogRouteIs("change-content") &&
                dialogFlowSnapshot.overlay === null
              }
              title="変更を反映"
              subtitle={`下書き ${timetableEditor.draftCount}件`}
              size="standard"
              formId="change-content-form"
              submitLabel="確定"
              submitAriaLabel="変更を確定"
              submitDisabled={
                timetableEditor.submitting ||
                timetableEditor.draftCount === 0 ||
                timetableEditor.conflictCount > 0
              }
              onBack={requestDialogBack}
            >
              <form
                id="change-content-form"
                className="change-content-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void commitTimetableDrafts();
                }}
              >
                <div
                  className="change-content-body"
                  onScroll={() => setRevealedDraftCancellationId(null)}
                >
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
                </div>
              </form>
            </EditorDialog>
          ) : null}

          {dialogFlowSnapshot.overlay?.kind === "logout-confirmation" ? (
            <DraftLogoutConfirmationDialog
              draftCount={timetableEditor.draftCount}
              onBack={() => {
                dialogFlow.cancelOverlay();
              }}
              onLogout={() => void logout()}
            />
          ) : null}

          {dialogFlowSnapshot.overlay?.kind === "draft-exit-confirmation" ? (
            <DraftExitConfirmationDialog
              draftCount={timetableEditor.draftCount}
              onContinue={() => {
                dialogFlow.cancelOverlay();
              }}
              onExit={finishLeavingTimetableEditing}
            />
          ) : null}

          {referencePickerOpen && dialogRouteExists("reference-picker") ? (
            <ReadOnlyDialog
              active={
                topDialogRouteIs("reference-picker") &&
                dialogFlowSnapshot.overlay === null
              }
              title="ほかの範囲を参照"
              size="compact"
              onClose={requestDialogCloseAll}
            >
                {referenceScopeOptionsResource.state.status === "idle" ||
                referenceScopeOptionsResource.state.status === "loading" ? (
                  <p className="reference-scope-dialog-status" role="status">
                    選べる範囲を読み込んでいます…
                  </p>
                ) : referenceScopeOptionsResource.state.status === "error" ? (
                  <div className="reference-scope-dialog-status" role="alert">
                    <p>選べる範囲を読み込めませんでした。</p>
                    <button
                      className="button-secondary"
                      type="button"
                      onClick={referenceScopeOptionsResource.retry}
                    >
                      再読み込み
                    </button>
                  </div>
                ) : (
                  <form
                    className="reference-scope-form"
                    onSubmit={selectReferenceScope}
                  >
                    <label>
                      <span>参照する変更適用範囲</span>
                      <select
                        value={effectiveReferencePickerScopeKey}
                        onChange={(event) =>
                          setReferencePickerScopeKey(event.target.value)}
                        disabled={
                          referenceScopeOptionsResource.state.value.options
                            .length === 0
                        }
                      >
                        {referenceScopeOptionsResource.state.value.options.map(
                          (option) => (
                          <option
                            key={referenceScopeKey(option)}
                            value={referenceScopeKey(option)}
                          >
                            {option.label}
                          </option>
                          )
                        )}
                      </select>
                    </label>
                    {referenceScopeOptionsResource.state.value.options.length ===
                    0 ? (
                      <p className="empty-state">参照できる範囲はありません。</p>
                    ) : null}
                    <div className="editor-dialog-actions">
                      <button
                        className="button-primary"
                        type="submit"
                        disabled={
                          referenceScopeOptionsResource.state.value.options
                            .length === 0
                        }
                      >
                        参照する
                      </button>
                    </div>
                  </form>
                )}
            </ReadOnlyDialog>
          ) : null}

          {noteEditorForm && noteDetailOpen &&
            dialogRouteExists("note-detail") ? (
            <NoteDetailDialog
              body={noteEditorForm.body}
              details={noteDetailValues}
              editing={timetableEditor.editing}
              active={
                topDialogRouteIs("note-detail") &&
                dialogFlowSnapshot.overlay === null
              }
              removalPlanned={noteEditorForm.removalPlanned}
              onBodyChange={(body) => setNoteEditorForm((current) =>
                current ? { ...current, body } : current)}
              onRemovalPlannedChange={(removalPlanned) =>
                setNoteEditorForm((current) => current
                  ? { ...current, removalPlanned }
                  : current)}
              onBack={timetableEditor.editing || noteDialogHasParent
                ? requestNoteEditorClose
                : undefined}
              backLabel={noteReturnFocus?.kind === "task-note"
                ? NOTE_DIALOG_PARENT["task-detail"].backLabel
                : noteReturnFocus?.kind === "daily-lesson-note"
                  ? NOTE_DIALOG_PARENT["daily-lesson-detail"].backLabel
                  : "戻る"}
              onClose={closeAllNoteDialogs}
              onSave={saveCurrentNoteDraft}
              onOpenHistory={noteEditorForm.editingNote
                ? () => openNoteHistory(noteEditorForm.editingNote!)
                : undefined}
              onCancelDraft={noteEditorForm.editingDraft
                ? () => cancelSharedInformationDraft(
                    {
                      kind: "note",
                      sourceId: noteEditorForm.editingDraft!.sourceId,
                    },
                    closeNoteEditorFlow,
                  )
                : undefined}
              cancelDraftDisabled={timetableEditor.submitting}
            />
          ) : noteEditorForm && dialogRouteExists("note-editor") ? (
            <EditorDialog
              active={
                topDialogRouteIs("note-editor") &&
                dialogFlowSnapshot.overlay === null
              }
              title={noteEditorForm.relatedTask
                ? "ノートを書く"
                : noteEditorForm.editingNote || noteEditorForm.editingDraft
                  ? "ノートを編集"
                  : "ノートを追加"}
              size="compact"
              formId="note-editor-form"
              submitDisabled={noteEditorForm.editingDraft?.changeKind === "remove"}
              onBack={requestNoteEditorClose}
            >
                <form id="note-editor-form" onSubmit={saveNoteDraft}>
                  <label>
                    <span>本文</span>
                    <textarea
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
                  {noteEditorForm.editingDraft ? (
                    <div className="editor-dialog-actions">
                      <button
                        className="button-danger"
                        type="button"
                        disabled={timetableEditor.submitting}
                        onClick={() => cancelSharedInformationDraft(
                          {
                            kind: "note",
                            sourceId: noteEditorForm.editingDraft!.sourceId,
                          },
                          closeNoteEditorFlow,
                        )}
                      >
                        下書きを取り消す
                      </button>
                    </div>
                  ) : null}
                </form>
            </EditorDialog>
          ) : null}

          {taskEditorForm && !taskDetail &&
            dialogRouteExists("task-editor") ? (
            <EditorDialog
              active={
                topDialogRouteIs("task-editor") &&
                dialogFlowSnapshot.overlay === null
              }
              title={taskEditorForm.editingTask ? "タスクを編集" : "タスクを追加"}
              size="compact"
              formId="task-editor-form"
              onBack={requestTaskEditorClose}
            >
                <form id="task-editor-form" onSubmit={saveTaskDraft}>
                  {taskEditorFields}
                  <NoteBodyFields
                    noteBodies={taskEditorForm.noteBodies}
                    disabled={timetableEditor.submitting}
                    addDisabled={timetableEditor.atLimit}
                    onBodyChange={updateTaskNoteBody}
                    onAddNote={addTaskNoteBody}
                  />
                  {taskEditorForm.editingDraft ? (
                    <div className="editor-dialog-actions">
                      <button
                        className="button-danger"
                        type="button"
                        disabled={timetableEditor.submitting}
                        onClick={() => cancelSharedInformationDraft(
                          {
                            kind: "task",
                            sourceId: taskEditorForm.editingDraft!.sourceId,
                          },
                          closeTaskEditorFlow,
                        )}
                      >
                        下書きを取り消す
                      </button>
                    </div>
                  ) : null}
                </form>
            </EditorDialog>
          ) : null}

          {taskDetail &&
            (
              dialogRouteExists("task-detail") ||
              dialogRouteExists("task-editor")
            ) ? (
            <TaskDetailDialog
              task={taskDetail.task}
              taskScopeLabel={scopeLabel(
                taskDetail.task.targetScopeType,
                targetScopeContext,
              )}
              referenceSchoolDate={selectedSchoolDate}
              mode={taskEditorForm?.editingTask ? "edit" : "view"}
              editForm={taskEditorForm?.editingTask
                ? taskEditorForm
                : undefined}
              editorFields={taskEditorFields}
              draftLifecycle={taskDetail.type === "draft"
                ? {
                    kind: taskDetail.draft.changeKind,
                    conflicted: Boolean(taskDetail.draft.conflicted),
                  }
                : undefined}
              notes={taskNoteList(
                taskDetail.task,
                taskDetail.task.notes,
                {
                  taskRemovalPlanned: taskDetail.type === "draft" &&
                    taskDetail.draft.changeKind === "remove",
                  notesOpenDetail: true,
                  presentation: "detail",
                  hideAddedDrafts: Boolean(taskEditorForm?.editingTask),
                },
              )}
              addNoteDisabled={
                timetableEditor.atLimit || timetableEditor.submitting
              }
              removalCheckboxAutoFocus={taskRemovalCheckboxFocusRequested}
              active={
                (
                  topDialogRouteIs("task-detail") ||
                  topDialogRouteIs("task-editor")
                ) &&
                dialogFlowSnapshot.overlay === null
              }
              onClose={taskEditorForm?.editingTask
                ? requestTaskEditorClose
                : requestDialogCloseAll}
              onSave={taskEditorForm?.editingTask ? saveTaskDraft : undefined}
              onNoteBodyChange={updateTaskNoteBody}
              onRemovalPlannedChange={(removalPlanned) => {
                setTaskLessonNameListOpen(false);
                setActiveTaskLessonNameOption(-1);
                setTaskEditorForm((current) =>
                  current ? { ...current, removalPlanned } : current
                );
              }}
              onRemovalCheckboxFocus={() => {
                setTaskRemovalCheckboxFocusRequested(false);
              }}
              onOpenHistory={taskDetail.type === "active"
                ? () => openTaskHistory(taskDetail.task)
                : taskDetail.activeTask
                  ? () => openTaskHistory(taskDetail.activeTask!)
                  : undefined}
              onAddNote={taskEditorForm?.editingTask
                ? addTaskNoteBody
                : timetableEditor.editing &&
                    (taskDetail.type === "active" ||
                      taskDetail.draft.changeKind === "add")
                  ? () => openTaskNoteEditor(taskDetail.task)
                  : undefined}
              onEdit={taskEditorForm ? undefined : timetableEditor.editing
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
                ? () => cancelSharedInformationDraft(
                    {
                      kind: "task",
                      sourceId: taskDetail.draft.sourceId,
                    },
                    () => finishTaskDraftCancellation(
                      taskDetail.draft.sourceId,
                    ),
                  )
                : undefined}
              cancelDraftDisabled={timetableEditor.submitting}
            />
          ) : null}

          {taskRemovalConfirmation &&
            dialogFlowSnapshot.overlay?.kind ===
              "task-removal-confirmation" ? (
            <TaskRemovalConfirmationDialog
              taskTitle={taskRemovalConfirmation.task.title}
              notes={taskRemovalConfirmation.task.notes ?? []}
              onCancel={cancelTaskRemovalConfirmation}
              onConfirm={confirmTaskRemoval}
            />
          ) : null}

          {taskHistoryDialog && dialogRouteExists("task-history") ? (
            <TaskEditHistoryDialog
              taskTitle={taskHistoryDialog.task.title}
              targetScopeContext={targetScopeContext}
              state={taskEditHistoryResource.state}
              active={
                topDialogRouteIs("task-history") &&
                dialogFlowSnapshot.overlay === null
              }
              onBack={goBackFromTaskHistory}
              onClose={requestDialogCloseAll}
              onRetry={taskEditHistoryResource.retry}
              onOpenChange={openSharedInformationChangeDetail}
            />
          ) : null}

          {noteHistoryDialog && dialogRouteExists("note-history") ? (
            <NoteEditHistoryDialog
              targetScopeContext={targetScopeContext}
              state={noteEditHistoryResource.state}
              active={
                topDialogRouteIs("note-history") &&
                dialogFlowSnapshot.overlay === null
              }
              onBack={goBackFromNoteHistory}
              onClose={requestDialogCloseAll}
              onRetry={noteEditHistoryResource.retry}
              onOpenChange={openSharedInformationChangeDetail}
            />
          ) : null}

          {timetableHistoryDialog &&
            dialogRouteExists("timetable-history") ? (
            <TimetableEditHistoryDialog
              active={
                topDialogRouteIs("timetable-history") &&
                dialogFlowSnapshot.overlay === null
              }
              subtitle={`${formatUiSchoolDate(
                timetableHistoryDialog.changeDate,
                { referenceSchoolDate: selectedSchoolDate },
              )}・${timetableHistoryDialog.periodNumber}限・${scopeLabel(
                timetableHistoryDialog.targetScopeType,
                targetScopeContext,
              )}`}
              targetScopeContext={targetScopeContext}
              state={timetableEditHistoryResource.state}
              onBack={goBackInTimetableHistoryDialog}
              onClose={requestDialogCloseAll}
              onRetry={timetableEditHistoryResource.retry}
              onOpenChange={openSharedInformationChangeDetail}
            />
          ) : null}

          {sharedInformationChangeDetailRoute?.kind ===
              "shared-information-change-detail" &&
            dialogRouteExists("shared-information-change-detail") ? (
            <SharedInformationChangeDetailDialog
              active={
                topDialogRouteIs("shared-information-change-detail") &&
                dialogFlowSnapshot.overlay === null
              }
              state={sharedInformationChangeDetailResource.state}
              targetScopeContext={targetScopeContext}
              onBack={requestDialogBack}
              onClose={requestDialogCloseAll}
              onRetry={sharedInformationChangeDetailResource.retry}
            />
          ) : null}

          {timetableLayerDialog && dialogRouteExists("timetable-layer") ? (
            <ReadOnlyDialog
              active={
                topDialogRouteIs("timetable-layer") &&
                dialogFlowSnapshot.overlay === null
              }
              title="時間割の変更状況"
              size="standard"
              bodyLayout="compact"
              backLabel="変更内容に戻る"
              onBack={
                dialogFlowSnapshot.routes.findIndex(
                  (route) => route.kind === "timetable-layer",
                ) > 0
                  ? requestDialogBack
                  : undefined
              }
              onClose={requestDialogCloseAll}
            >

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
                          ...timetableLayerDialog,
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
                    <LayerFlowArrow />
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
                        targetScopeType={layer.targetScopeType}
                        label={scopeLabel(
                          layer.targetScopeType,
                          targetScopeContext,
                        )}
                        value={
                          "removalPlanned" in layer && layer.removalPlanned
                            ? existingDraft?.changeKind === "remove"
                              ? replacementLabel(existingDraft.serverReplacement)
                              : "変更内容"
                            : layer.state === "active"
                            ? replacementLabel(layer.replacement)
                            : "変更無し"
                        }
                        detail={
                          layer.desired
                            ? layer.conflicted
                              ? "ほかの変更と重なっています"
                              : "removalPlanned" in layer && layer.removalPlanned
                                ? undefined
                                : "下書きの内容"
                            : layer.state === "active" && "changedAt" in layer
                            ? `最終更新 ${formatRelativeTime(layer.changedAt)}`
                            : undefined
                        }
                        desired={layer.desired}
                        conflicted={layer.conflicted}
                        lifecycleKind={existingDraft?.changeKind}
                        removalPlanned={
                          "removalPlanned" in layer && layer.removalPlanned
                        }
                        onClick={
                          editable
                            ? () => openLayerReplacement(layer.targetScopeType)
                            : undefined
                        }
                        menuActions={[
                          ...(existingDraft ? [{
                            label: "下書きを取り消す",
                            danger: true,
                            onClick: () => cancelSharedInformationDraft({
                              kind: "timetable",
                              targetScopeType: layer.targetScopeType,
                              changeDate: timetableLayerDialog.schoolDate,
                              periodNumber: timetableLayerDialog.periodNumber,
                            }),
                            disabled: timetableEditor.submitting,
                          }] : []),
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
                        {
                          targetScopeType: layer.targetScopeType,
                          className: "layer-note-list",
                          notesOpenDetail: true,
                        },
                      )}
                      <LayerFlowArrow />
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
            </ReadOnlyDialog>
          ) : null}

          {timetableEditorForm && schoolYearRange &&
            dialogRouteExists("timetable-editor") ? (
            <EditorDialog
              active={
                topDialogRouteIs("timetable-editor") &&
                dialogFlowSnapshot.overlay === null
              }
              title="時間割変更"
              size="wide"
              formId="timetable-editor-form"
              submitDisabled={
                timetableEditor.submitting ||
                (timetableEditorForm.includeTimetableChange &&
                  !timetableEditorForm.removalPlanned &&
                  timetableEditorForm.replacement.type === "lesson_name" &&
                  !timetableEditorForm.replacement.registeredLessonNameId &&
                  !timetableEditorOptions)
              }
              onBack={() => requestTimetableEditorClose("back")}
            >
                <form id="timetable-editor-form" onSubmit={saveTimetableDraft}>
                  <dl className="detail-list timetable-editor-context">
                    <div>
                      <dt>変更対象日</dt>
                      <dd>
                        {formatUiSchoolDate(timetableEditorForm.changeDate, {
                          referenceSchoolDate: selectedSchoolDate,
                        })}
                      </dd>
                    </div>
                    <div>
                      <dt>時限</dt>
                      <dd>{timetableEditorForm.periodNumber}限</dd>
                    </div>
                    <div>
                      <dt>変更適用範囲</dt>
                      <dd>
                        {scopeLabel(
                          timetableEditorForm.targetScopeType,
                          targetScopeContext,
                        )}
                      </dd>
                    </div>
                  </dl>

                  <label className="timetable-change-toggle">
                    <input
                      type="checkbox"
                      checked={timetableEditorForm.includeTimetableChange}
                      onChange={(event) =>
                        setTimetableEditorForm({
                          ...timetableEditorForm,
                          includeTimetableChange: event.target.checked,
                          removalPlanned: event.target.checked
                            ? timetableEditorForm.removalPlanned
                            : false,
                        })
                      }
                    />
                    時間割も変更する
                  </label>

                  <fieldset
                    className="replacement-options"
                    disabled={
                      !timetableEditorForm.includeTimetableChange ||
                      timetableEditorForm.removalPlanned
                    }
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

                  {timetableEditorForm.includeTimetableChange &&
                  loadedLayerState?.layers.some(
                    (layer) =>
                      layer.targetScopeType ===
                        timetableEditorForm.targetScopeType &&
                      layer.state === "active",
                  ) ? (
                    <label className="task-removal-checkbox timetable-removal-checkbox">
                      <input
                        type="checkbox"
                        checked={timetableEditorForm.removalPlanned}
                        onChange={(event) =>
                          setTimetableEditorForm({
                            ...timetableEditorForm,
                            removalPlanned: event.target.checked,
                          })
                        }
                      />
                      <span>削除予定にする</span>
                    </label>
                  ) : null}

                  <NoteBodyFields
                    noteBodies={timetableEditorForm.noteBodies}
                    onBodyChange={updateTimetableNoteBody}
                    onAddNote={addTimetableNoteBody}
                    addDisabled={timetableEditor.atLimit}
                  />

                  <footer className="editor-dialog-actions">
                    {timetableEditorClient.findDraft(
                      timetableEditorForm.targetScopeType,
                      timetableEditorForm.changeDate,
                      timetableEditorForm.periodNumber,
                    ) ? (
                      <button
                        className="button-danger"
                        type="button"
                        disabled={timetableEditor.submitting}
                        onClick={() => cancelSharedInformationDraft(
                          {
                            kind: "timetable",
                            targetScopeType:
                              timetableEditorForm.targetScopeType,
                            changeDate: timetableEditorForm.changeDate,
                            periodNumber: timetableEditorForm.periodNumber,
                          },
                          closeTimetableFormAfterDraftSave,
                        )}
                      >
                        下書きを取り消す
                      </button>
                    ) : null}
                  </footer>
                </form>
            </EditorDialog>
          ) : null}

          {dialogFlowSnapshot.overlay?.kind === "discard-unsaved" ? (
            <DiscardConfirmationDialog
              onContinue={() => {
                applyDialogFlowResult(dialogFlow.cancelOverlay());
              }}
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
              認証できました。次に表示名・所属情報を入力してください。
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
  targetScopeType,
  label,
  value,
  detail,
  desired = false,
  conflicted = false,
  lifecycleKind,
  removalPlanned = false,
  onClick,
  menuActions = [],
}: {
  targetScopeType?: TargetScopeType;
  label: string;
  value: string;
  detail?: string;
  desired?: boolean;
  conflicted?: boolean;
  lifecycleKind?: LifecycleKind;
  removalPlanned?: boolean;
  onClick?: () => void;
  menuActions?: Array<{
    label: string;
    onClick: () => void;
    disabled?: boolean;
    danger?: boolean;
  }>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const content = (
    <>
      <span className="timetable-layer-label">{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
      {desired && lifecycleKind && !removalPlanned ? (
        <span className="layer-lifecycle-state">
          <LifecycleIcon kind={lifecycleKind} conflicted={conflicted} />
          <small>{lifecycleLabel(lifecycleKind, conflicted)}</small>
        </span>
      ) : null}
    </>
  );
  return (
      <div
        className={`layer-row-shell${menuActions.length ? " has-menu" : ""}${desired ? " desired" : ""}${removalPlanned ? " removal-draft" : ""}${conflicted ? " conflict" : ""}`}
        data-target-scope-type={targetScopeType}
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
                    className={action.danger ? "danger" : undefined}
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
        {removalPlanned ? (
          <RemovalMark
            className="layer-removal-mark"
            label="時間割変更の削除予定"
          />
        ) : null}
      </div>
  );
}

function LayerFlowArrow() {
  return <div className="layer-flow-arrow" aria-hidden="true" />;
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

function noteContextSnapshotFromPlans(
  note: DailyPlanNoteForCache,
  plans: readonly DailyPlanForCache[],
) {
  const relatedContext = note.relatedContext;
  if (relatedContext?.type === "daily-lesson") {
    const plan = plans.find(
      (candidate) => candidate.schoolDate === relatedContext.schoolDate,
    );
    const lessonName = plan?.periods.find(
      (period) => period.periodNumber === relatedContext.periodNumber,
    )?.lessonName;
    return lessonName === undefined
      ? undefined
      : { type: "daily-lesson" as const, lessonName };
  }
  if (relatedContext?.type !== "task") return undefined;
  const task = plans.flatMap((plan) => plan.tasks)
    .find((candidate) => candidate.taskId === relatedContext.taskId);
  return task ? createTaskNoteContextSnapshot(task) : undefined;
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

type EffectiveDailyLesson = {
  lessonName: string;
  lessonReference?: TimetableReference;
};

function EffectiveDailyLesson({
  className,
  lesson,
}: {
  className?: string;
  lesson: EffectiveDailyLesson;
}) {
  return (
    <span className={`effective-daily-lesson${className ? ` ${className}` : ""}`}>
      <span>{lesson.lessonName || "授業なし"}</span>
      {lesson.lessonReference ? (
        <span className="lesson-reference">
          （{lessonReferenceLabel(lesson.lessonReference)}）
        </span>
      ) : null}
    </span>
  );
}

function lessonReferenceLabel(reference: TimetableReference) {
  if (reference.type === "period_reference") {
    return `${"月火水木金土日"[reference.weekday - 1]}${reference.periodNumber}`;
  }
  return reference.referenceLabel ?? "不明な参照";
}

function effectiveDailyLessonAccessibleLabel(lesson: EffectiveDailyLesson) {
  const lessonName = lesson.lessonName || "授業なし";
  return lesson.lessonReference
    ? `${lessonName}、参照元 ${lessonReferenceLabel(lesson.lessonReference)}`
    : lessonName;
}

function dailyLessonTransitionAccessibleLabel(
  before: EffectiveDailyLesson,
  after: EffectiveDailyLesson,
  removalPlanned: boolean,
) {
  return [
    `現在 ${effectiveDailyLessonAccessibleLabel(before)}。`,
    `変更後 ${effectiveDailyLessonAccessibleLabel(after)}。`,
    ...(removalPlanned ? ["時間割変更の削除予定。"] : []),
  ].join("");
}

function timetableReferenceCatalog(
  options: TimetableEditorOptions | null,
) {
  return {
    periodReferences: options?.periodReferences ?? [],
    floatingLessonReferences: options?.floatingLessonReferenceLabels ?? [],
  };
}

export default App;
