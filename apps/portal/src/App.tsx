import { useEffect, useState, type FormEvent } from "react";
import "./App.css";
import {
  buildDateHeader,
  buildDateStrip,
  formatCurrentJstSchoolDate,
} from "./dailyPlanView";

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

type DailyPlanTask = {
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

type DailyPlanNote = {
  noteId: string;
  body: string;
  relatedContext:
    | {
        type: "lesson-slot";
        schoolDate: string;
        periodNumber: number;
      }
    | {
        type: "school-date";
        schoolDate: string;
      }
    | null;
};

type DailyPlan = {
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
    notes: DailyPlanNote[];
  }>;
  tasks: DailyPlanTask[];
  notes: DailyPlanNote[];
};

type DailyPlanState =
  | { status: "loading" }
  | { status: "ready"; dailyPlan: DailyPlan }
  | { status: "affiliation-renewal-needed"; schoolYear: number }
  | { status: "error" };

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
  const [selectedSchoolDate, setSelectedSchoolDate] = useState(
    formatCurrentJstSchoolDate(),
  );
  const [currentSchoolDate, setCurrentSchoolDate] = useState(
    formatCurrentJstSchoolDate(),
  );
  const [dailyPlanReloadToken, setDailyPlanReloadToken] = useState(0);
  const [dailyPlanState, setDailyPlanState] = useState<DailyPlanState>({
    status: "loading",
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [completedPlaceholderTaskIds, setCompletedPlaceholderTaskIds] =
    useState<Set<string>>(() => new Set());

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
    if (status !== "authenticated" || !studentAccount) {
      return;
    }

    let cancelled = false;

    async function loadDailyPlan() {
      setDailyPlanState({ status: "loading" });

      const response = await fetch(
        `/api/daily-plan?date=${encodeURIComponent(selectedSchoolDate)}`,
      );
      const body = (await response.json()) as
        | DailyPlan
        | { status: "affiliation-renewal-needed"; schoolYear: number }
        | { status: "unauthenticated" | "invalid-date" | "daily-plan-unavailable" };

      if (cancelled) {
        return;
      }

      if (response.status === 401 || body.status === "unauthenticated") {
        setStudentAccount(null);
        setStatus("idle");
        return;
      }

      if (body.status === "affiliation-renewal-needed") {
        setDailyPlanState({
          status: "affiliation-renewal-needed",
          schoolYear: body.schoolYear,
        });
        return;
      }

      if (!response.ok || body.status !== "ready") {
        setDailyPlanState({ status: "error" });
        return;
      }

      setDailyPlanState({ status: "ready", dailyPlan: body });
    }

    loadDailyPlan().catch(() => {
      if (!cancelled) {
        setDailyPlanState({ status: "error" });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedSchoolDate, status, studentAccount, dailyPlanReloadToken]);

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
    setDailyPlanState({ status: "loading" });
    setMenuOpen(false);
    setCurrentSchoolDate(formatCurrentJstSchoolDate());
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

      setMessage("初回設定を完了できませんでした。時間をおいて再度お試しください。");
      return;
    }

    if (response.status === 400) {
      setMessage("入力内容を確認してください。");
      return;
    }

    setMessage("初回設定を保存できませんでした。時間をおいて再度お試しください。");
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
    const dateStrip = buildDateStrip(selectedSchoolDate);
    const dateHeader = buildDateHeader(selectedSchoolDate, currentSchoolDate);

    return (
      <main className="app-page daily-plan-page">
        <section
          className="daily-plan-shell"
          aria-labelledby="daily-plan-title"
        >
          <header className="daily-plan-topbar">
            <div className="menu-area">
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
                      {dailyPlanState.dailyPlan.studentAffiliation.schoolYear}年度{" "}
                      {dailyPlanState.dailyPlan.studentAffiliation.grade}年
                      {dailyPlanState.dailyPlan.studentAffiliation.classNumber}組{" "}
                      {dailyPlanState.dailyPlan.studentAffiliation.trackName}
                    </p>
                  ) : (
                    <p className="menu-affiliation">Student Affiliation 未読込</p>
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
            <div className="topbar-spacer" aria-hidden="true" />
          </header>

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
                年度の Student Affiliation を設定すると Daily Plan を表示できます。
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
                onClick={() => setDailyPlanReloadToken((token) => token + 1)}
              >
                再読み込み
              </button>
            </div>
          ) : null}

          {dailyPlanState.status === "ready" ? (
            <>
              <section className="panel timetable-panel" aria-label="Period list">
                <div className="period-list">
                  {dailyPlanState.dailyPlan.periods.map((period) => (
                    <article className="period-row" key={period.periodNumber}>
                      <div className="period-number">{period.periodNumber}</div>
                      <div className="period-main">
                        <div className="lesson-line">
                          <span className="lesson-name">{period.lessonName}</span>
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

              <section className="panel daily-section" aria-labelledby="tasks-title">
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

              <section className="panel daily-section" aria-labelledby="notes-title">
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

          <nav className="date-strip" aria-label="Date selection">
            {dateStrip.map((date) => (
              <button
                className={`date-cell ${
                  date.schoolDate === selectedSchoolDate ? "selected" : ""
                }`}
                key={date.schoolDate}
                type="button"
                onClick={() => {
                  setSelectedSchoolDate(date.schoolDate);
                  setCurrentSchoolDate(formatCurrentJstSchoolDate());
                }}
              >
                <span className="date-cell-day">{date.day}</span>
                <span className="date-cell-weekday">{date.weekdayLabel}</span>
              </button>
            ))}
          </nav>
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

export default App;
