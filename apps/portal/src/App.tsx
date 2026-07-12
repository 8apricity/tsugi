import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import "./App.css";
import { createDailyPlanClient } from "./dailyPlanClient";
import { buildDateHeader } from "./dailyPlanView";
import {
  createTimetableEditorClient,
  normalizeDirectLessonReplacement,
  type TargetScopeType,
  type TimetableChangeDraft,
  type TimetableLayerState,
  type TimetableLayerKey,
  type TimetableReplacement,
} from "./timetableEditorClient";

const DATE_PICKER_RADIUS = 180;
const DATE_SWIPE_THRESHOLD_PX = 48;
const DATE_PICKER_SCALE_DISTANCE_PX = 78;
const DAILY_PLAN_PREFETCH_RADIUS = 7;

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
};

type TimetableEditorForm = Pick<
  TimetableChangeDraft,
  "targetScopeType" | "changeDate" | "periodNumber" | "replacement"
> & {
  sourceId?: string;
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
  const [completedPlaceholderTaskIds, setCompletedPlaceholderTaskIds] =
    useState<Set<string>>(() => new Set());
  const [timetableEditorClient] = useState(() =>
    createTimetableEditorClient({ storage: window.localStorage }),
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
  const [timetableLayerDialog, setTimetableLayerDialog] =
    useState<TimetableLayerDialog | null>(null);
  const layerDialogSchoolDate = timetableLayerDialog?.schoolDate;
  const layerDialogPeriodNumber = timetableLayerDialog?.periodNumber;
  const layerDialogRequestId = timetableLayerDialog?.requestId;
  const [timetableEditorMessage, setTimetableEditorMessage] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!timetableEditorMessage) return;

    const timeoutId = window.setTimeout(() => {
      setTimetableEditorMessage(null);
    }, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [timetableEditorMessage]);

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
          "下書きと現在のTimetable Layerを照合できませんでした。",
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
      layerDialogPeriodNumber === undefined ||
      layerDialogRequestId === undefined
    )
      return;
    const schoolDate = layerDialogSchoolDate;
    const periodNumber = layerDialogPeriodNumber;
    const requestId = layerDialogRequestId;
    const controller = new AbortController();
    fetch(
      `/api/timetable-changes/layers?date=${encodeURIComponent(
        schoolDate,
      )}&period=${periodNumber}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("layers unavailable");
        return (await response.json()) as TimetableLayerState;
      })
      .then((state) =>
        setTimetableLayerDialog((current) => {
          if (
            current?.schoolDate !== schoolDate ||
            current.periodNumber !== periodNumber ||
            current.requestId !== requestId
          )
            return current;
          timetableEditorClient.reconcileLayerState(state);
          return { schoolDate, periodNumber, requestId, state };
        }),
      )
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setTimetableLayerDialog((current) =>
          current?.schoolDate === schoolDate &&
          current.periodNumber === periodNumber &&
          current.requestId === requestId
            ? {
                schoolDate,
                periodNumber,
                requestId,
                state: { status: "error" },
              }
            : current,
        );
      });
    return () => controller.abort();
  }, [
    layerDialogSchoolDate,
    layerDialogPeriodNumber,
    layerDialogRequestId,
    timetableEditorClient,
  ]);

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
      setMessage("認証コードを送信しました。メールを確認してください。");
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
        "認証コードを送信できませんでした。メール送信設定を確認してください。",
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
          "初回設定データを読み込めませんでした。時間をおいて再度お試しください。",
        );
        return;
      }

      setMessage(null);
      return;
    }

    setStatus("error");
    setMessage("認証コードを確認できませんでした。もう一度入力してください。");
  }

  async function logout() {
    await fetch("/api/auth/session", { method: "DELETE" });
    setStudentAccount(null);
    setSchoolEmail(null);
    setSetupSchoolEmail(null);
    setVerificationCode("");
    setSetupOptions(null);
    dailyPlanClient.reset();
    timetableEditorClient.discard();
    setTimetableEditorForm(null);
    setTimetableLayerDialog(null);
    setTimetableEditorOptions(null);
    setMenuOpen(false);
    setCompletedPlaceholderTaskIds(new Set());
    setStatus("idle");
    setMessage("ログアウトしました。");
  }

  function togglePlaceholderTask(taskId: string) {
    setCompletedPlaceholderTaskIds((current) => {
      const next = new Set(current);

      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }

      return next;
    });
  }

  function enterTimetableEditing() {
    setTimetableEditorMessage(null);
    timetableEditorClient.enterEditing();
  }

  function leaveTimetableEditing() {
    if (
      timetableEditorClient.shouldConfirmExit() &&
      !window.confirm(
        "変更の下書きは削除されます。本当に編集モードを終了しますか。",
      )
    ) {
      return;
    }
    timetableEditorClient.discard();
    setTimetableEditorForm(null);
    setTimetableEditorMessage(null);
  }

  function openTimetableEditor(periodNumber: number) {
    setTimetableEditorForm(null);
    setTimetableLayerDialog({
      schoolDate: selectedSchoolDate,
      periodNumber,
      requestId: 0,
      state: { status: "loading" },
    });
  }

  function openLayerReplacement(targetScopeType: TargetScopeType) {
    if (
      !timetableEditor.editing ||
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
    setTimetableEditorForm(
      existing ??
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

  function navigateLayerDialog(schoolDate: string, periodNumber: number) {
    setTimetableEditorForm(null);
    setTimetableLayerDialog((current) =>
      current
        ? {
            schoolDate,
            periodNumber,
            requestId: current.requestId + 1,
            state: { status: "loading" },
          }
        : current,
    );
  }

  function saveTimetableDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!timetableEditorForm) return;
    let replacement = timetableEditorForm.replacement;
    if (replacement.type === "lesson_name") {
      replacement = normalizeDirectLessonReplacement(replacement.lessonName);
      if (replacement.type === "lesson_name" && !replacement.lessonName) {
        setTimetableEditorMessage("Lesson Nameを入力してください。");
        return;
      }
    }
    if (
      replacement.type === "floating_lesson_reference" &&
      !replacement.floatingLessonReferenceLabelId
    ) {
      setTimetableEditorMessage(
        "Floating Lesson Referenceを選択してください。",
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

  async function commitTimetableDrafts() {
    if (timetableEditor.conflictCount > 0) {
      setTimetableEditorMessage(
        "競合する下書きを取り消すか、現在の状態から編集し直してください。",
      );
      return;
    }
    const payload = timetableEditorClient.toCommitPayload();
    if (payload.changes.length === 0) return;
    const summary = payload.changes
      .map(
        (draft) =>
          `${draft.changeDate} ${draft.periodNumber}限 / ${scopeLabel(draft.targetScopeType)} / ${replacementLabel(draft.replacement)}`,
      )
      .join("\n");
    if (
      !window.confirm(
        `${payload.changes.length}件をDirect Changeとして確定します。\n\n${summary}`,
      )
    )
      return;

    setTimetableEditorMessage("確定しています。");
    let response: Response;
    try {
      response = await fetch("/api/timetable-changes/direct", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      timetableEditorClient.commitFailed();
      setTimetableEditorMessage(
        "通信できませんでした。下書きは保存されています。",
      );
      return;
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | {
            status?: string;
            conflictingKeys?: TimetableLayerKey[];
          }
        | null;
      timetableEditorClient.commitFailed(
        body?.conflictingKeys ?? [],
        body?.status === "idempotency-conflict",
      );
      if (response.status === 409) {
        setTimetableLayerDialog((current) =>
          current
            ? {
                ...current,
                requestId: current.requestId + 1,
                state: { status: "loading" },
              }
            : current,
        );
      }
      setTimetableEditorMessage(
        response.status === 409
          ? "Active Timetable Changeが更新されています。競合する下書きを確認してください。"
          : "変更を確定できませんでした。",
      );
      return;
    }
    timetableEditorClient.commitSucceeded();
    setTimetableEditorMessage(null);
    setTimetableLayerDialog((current) =>
      current
        ? {
            ...current,
            requestId: current.requestId + 1,
            state: { status: "loading" },
          }
        : current,
    );
    await dailyPlanClient.reload();
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
          <p className="lead">セッションを確認しています。</p>
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
                      Student Affiliation 未読込
                    </p>
                  )}
                  <button className="menu-item" type="button" disabled>
                    Settings
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
                Daily Plan を読み込んでいます。
              </div>
            ) : null}

            {dailyPlanState.status === "affiliation-renewal-needed" ? (
              <div className="panel state-panel" role="status">
                <h2>Affiliation Renewal が必要です</h2>
                <p>
                  {dailyPlanState.schoolYear}
                  年度の Student Affiliation を設定すると Daily Plan
                  を表示できます。
                </p>
              </div>
            ) : null}

            {dailyPlanState.status === "error" ? (
              <div className="panel state-panel" role="alert">
                <h2>Daily Plan を読み込めませんでした</h2>
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
                  aria-label="Period list"
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
                  <h2 id="tasks-title">タスク</h2>
                  <div className="task-list">
                    {dailyPlanState.dailyPlan.tasks.map((task) => {
                      const completed = completedPlaceholderTaskIds.has(
                        task.taskId,
                      );

                      return (
                        <label className="task-item" key={task.taskId}>
                          <input
                            type="checkbox"
                            checked={completed}
                            onChange={() => togglePlaceholderTask(task.taskId)}
                          />
                          <span>
                            <strong>{task.title}</strong>
                            <small>
                              {task.dueDate ? `${task.dueDate}` : task.dueLabel}
                              {task.relatedLesson
                                ? ` · ${task.relatedLesson.periodNumber}限 ${task.relatedLesson.lessonName}`
                                : ""}
                              {!task.relatedLesson && task.relatedLessonName
                                ? ` · ${task.relatedLessonName}`
                                : ""}
                            </small>
                          </span>
                        </label>
                      );
                    })}
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
                          <small>{note.relatedContext.schoolDate}</small>
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
                aria-label="Date selection"
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
                      timetableEditor.drafts.length === 0 ||
                      timetableEditor.conflictCount > 0
                    }
                    onClick={() => void commitTimetableDrafts()}
                  >
                    変更を確定 ({timetableEditor.drafts.length})
                  </button>
                ) : null}
                <button
                  className={`icon-button edit-mode-button${timetableEditor.editing ? " active" : ""}`}
                  type="button"
                  aria-label={
                    timetableEditor.editing
                      ? "編集モードを終了"
                      : "時間割を編集"
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

          {timetableLayerDialog && !timetableEditorForm ? (
            <div className="editor-dialog-backdrop" role="presentation">
              <section
                className="timetable-editor-dialog timetable-layer-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="timetable-layer-title"
                onKeyDown={(event) => {
                  if (event.key === "Escape") setTimetableLayerDialog(null);
                }}
              >
                <header className="editor-dialog-header">
                  <div>
                    <h2 id="timetable-layer-title">時間割の適用状態</h2>
                    <p className="layer-dialog-selection">
                      {formatSchoolDateForDialog(timetableLayerDialog.schoolDate)}
                      ・{timetableLayerDialog.periodNumber}限
                    </p>
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="閉じる"
                    autoFocus
                    onClick={() => setTimetableLayerDialog(null)}
                  >
                    ×
                  </button>
                </header>

                <div className="layer-dialog-navigation" aria-label="日付と時限">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="前の時限"
                    disabled={timetableLayerDialog.periodNumber <= 1}
                    onClick={() =>
                      navigateLayerDialog(
                        timetableLayerDialog.schoolDate,
                        timetableLayerDialog.periodNumber - 1,
                      )
                    }
                  >
                    ‹
                  </button>
                  <input
                    type="date"
                    aria-label="Change Date"
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
                  <select
                    aria-label="period"
                    value={timetableLayerDialog.periodNumber}
                    onChange={(event) =>
                      navigateLayerDialog(
                        timetableLayerDialog.schoolDate,
                        Number(event.target.value),
                      )
                    }
                  >
                    {Array.from({ length: 7 }, (_, index) => (
                      <option value={index + 1} key={index + 1}>
                        {index + 1}限
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="次の時限"
                    disabled={timetableLayerDialog.periodNumber >= 7}
                    onClick={() =>
                      navigateLayerDialog(
                        timetableLayerDialog.schoolDate,
                        timetableLayerDialog.periodNumber + 1,
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
                        ? "前回の確定に失敗しました。下書きは保持されています。"
                        : "変更を適用するTarget Scopeを選択してください。"}
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
                      label="デフォルト"
                      value={
                        layerPreview.standardTimetable
                          ?.lessonName || "空欄"
                      }
                      detail={
                        layerPreview.standardTimetable
                          ? `${weekdayLabel(
                              layerPreview.standardTimetable
                                .periodReference.weekday,
                            )}${
                              layerPreview.standardTimetable
                                .periodReference.periodNumber
                            }のStandard Timetable`
                          : "Standard Timetableに設定なし"
                      }
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
                        (!!existingDraft ||
                          (!!serverLayer && !timetableEditor.atLimit));
                      return (
                      <LayerRow
                        key={layer.targetScopeType}
                        label={scopeLabel(layer.targetScopeType)}
                        value={
                          layer.state === "active"
                            ? replacementLabel(layer.replacement)
                            : "変更なし"
                        }
                        detail={
                          layer.desired
                            ? layer.conflicted
                              ? "競合・確認が必要"
                              : "保存前の希望状態"
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
                      />
                      );
                    })}
                    <div className="layer-result-row">
                      <span>最終結果</span>
                      <strong>
                        {finalDailyLessonLabel(
                          layerPreview.finalDailyLesson,
                        )}
                      </strong>
                    </div>
                    {timetableEditor.editing ? (
                      <div className="layer-dialog-actions">
                        <button
                          className="button-primary"
                          type="button"
                          disabled={
                            timetableEditor.draftCount === 0 ||
                            timetableEditor.conflictCount > 0
                          }
                          onClick={() => void commitTimetableDrafts()}
                        >
                          変更を確定 ({timetableEditor.draftCount})
                        </button>
                      </div>
                    ) : null}
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
                    <h2 id="timetable-editor-title">時間割変更</h2>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="閉じる"
                      autoFocus
                      onClick={() => setTimetableEditorForm(null)}
                    >
                      ×
                    </button>
                  </header>
                  <div className="editor-fields">
                    <label>
                      Change Date（固定）
                      <output>{timetableEditorForm.changeDate}</output>
                    </label>
                    <label>
                      時限（固定）
                      <output>{timetableEditorForm.periodNumber}限</output>
                    </label>
                    <label className="editor-field-wide">
                      Target Scope（固定）
                      <output>
                        {scopeLabel(timetableEditorForm.targetScopeType)}
                      </output>
                    </label>
                  </div>

                  <div className="replacement-options">
                    <div
                      className="period-reference-grid"
                      aria-label="Period References"
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
                          replacement: defaultReplacement("cancelled"),
                        })
                      }
                    >
                      休講
                    </button>

                    <input
                      className="direct-lesson-input"
                      aria-label="Lesson Name"
                      maxLength={80}
                      placeholder="または、この時間の名前を直接入力"
                      value={
                        timetableEditorForm.replacement.type === "lesson_name"
                          ? timetableEditorForm.replacement.lessonName
                          : ""
                      }
                      onChange={(event) =>
                        setTimetableEditorForm({
                          ...timetableEditorForm,
                          replacement: {
                            type: "lesson_name",
                            lessonName: event.target.value,
                          },
                        })
                      }
                    />
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
                    <button className="button-primary" type="submit">
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
            <h1 id="setup-title">プロフィール設定へ進む</h1>
            <p className="lead">
              認証済みです。次に表示名、実名、Student Affiliation を設定します。
            </p>
          </div>
          <form className="form-grid" onSubmit={submitInitialSetup}>
            <label className="field-label" htmlFor="display-name">
              Display Name
            </label>
            <input
              id="display-name"
              className="text-input"
              maxLength={24}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />

            <label className="field-label" htmlFor="real-name">
              Real Name
            </label>
            <input
              id="real-name"
              className="text-input"
              maxLength={40}
              value={realName}
              onChange={(event) => setRealName(event.target.value)}
            />

            <label className="field-label" htmlFor="grade">
              Grade
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
                  {gradeOption.grade}
                </option>
              ))}
            </select>

            <label className="field-label" htmlFor="class-id">
              Class
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
                  {classOption.classNumber}
                </option>
              ))}
            </select>

            <label className="field-label" htmlFor="track-id">
              Track
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
              選択内容を確認しました
            </label>

            <button className="button-primary" type="submit">
              初回設定を確認
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
                  認証済み: <strong>{setupSchoolEmail}</strong>
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
          <p className="eyebrow">アカウント認証</p>
          <h1 id="signup-title">メールで始める</h1>
          <p className="lead">
            メールアドレスの8桁の番号を入力して、認証コードを送信します。
          </p>
        </div>

        <form className="form-grid" onSubmit={requestVerificationCode}>
          <div className="input-group">
            <span aria-hidden="true">110-</span>
            <input
              id="school-email-number"
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
            {status === "sending" ? "送信中" : "認証コードを送信"}
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
              {status === "verifying" ? "確認中" : "認証して進む"}
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
}: {
  label: string;
  value: string;
  detail?: string;
  desired?: boolean;
  conflicted?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="timetable-layer-label">{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
      {desired ? (
        <span className={`layer-draft-badge${conflicted ? " conflict" : ""}`}>
          {conflicted ? "競合" : "下書き"}
        </span>
      ) : null}
    </>
  );
  return (
    <>
      {onClick ? (
        <button
          className={`timetable-layer-row editable${desired ? " desired" : ""}${conflicted ? " conflict" : ""}`}
          type="button"
          onClick={onClick}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onClick();
            }
          }}
          aria-label={`${label} Target Scopeを編集${desired ? "、下書きあり" : ""}`}
        >
          {content}
        </button>
      ) : (
        <div className={`timetable-layer-row${desired ? " desired" : ""}${conflicted ? " conflict" : ""}`}>
          {content}
        </div>
      )}
      <div className="layer-flow-arrow" aria-hidden="true">
        ↓
      </div>
    </>
  );
}

function formatSchoolDateForDialog(schoolDate: string) {
  const [, month, day] = schoolDate.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function weekdayLabel(weekday: number) {
  return "月火水木金土日"[weekday - 1] ?? "";
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

function finalDailyLessonLabel(
  lesson: TimetableLayerState["finalDailyLesson"],
) {
  if (lesson.timetableChangeState === "cancelled") return "休講";
  return lesson.lessonName || "空欄";
}

function scopeLabel(scope: TargetScopeType) {
  return { grade: "Grade", class: "Class", track: "Track", student: "Student" }[
    scope
  ];
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

function defaultReplacement(
  type: TimetableReplacement["type"],
): TimetableReplacement {
  if (type === "lesson_name") return { type, lessonName: "" };
  if (type === "period_reference") return { type, weekday: 1, periodNumber: 1 };
  if (type === "floating_lesson_reference") {
    return { type, floatingLessonReferenceLabelId: "", referenceLabel: "" };
  }
  return { type: "cancelled" };
}

function resolveReplacementLessonName(
  replacement: TimetableReplacement,
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
  return replacement.type === "lesson_name" ? replacement.lessonName : null;
}

export default App;
