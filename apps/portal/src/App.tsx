import { useState, type FormEvent } from "react";
import "./App.css";

type RequestStatus = "idle" | "sending" | "sent" | "error";

function App() {
  const [schoolEmailNumber, setSchoolEmailNumber] = useState("");
  const [schoolEmail, setSchoolEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<RequestStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const statusLabel =
    status === "sending"
      ? "送信中"
      : status === "sent"
        ? "送信済み"
        : status === "error"
          ? "確認が必要"
          : "未認証";

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

    setMessage(
      "認証コードを送信できませんでした。時間をおいて再度お試しください。",
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            J
          </span>
          <span>Jikanwari</span>
        </div>
        <span className="topbar-badge">学校時間割管理</span>
      </header>

      <section className="content-wrap" aria-labelledby="signup-title">
        <div className="page-heading">
          <p className="eyebrow">アカウント認証</p>
          <h1 id="signup-title">学校メールで始める</h1>
          <p className="lead">
            学校メールの8桁の番号を入力すると、認証コードを送信します。
          </p>
        </div>

        <div className="workspace-grid">
          <section className="content-panel" aria-label="認証コード送信">
            <div className="panel-title-row">
              <div>
                <h2>メール番号</h2>
                <p>学校から配布されたメールアドレスの番号部分を入力してください。</p>
              </div>
              <span className={`status-chip ${status}`}>{statusLabel}</span>
            </div>

            <form className="signup-form" onSubmit={requestVerificationCode}>
              <label htmlFor="school-email-number">学校メールの8桁番号</label>
              <div className="input-row">
                <span aria-hidden="true">110-</span>
                <input
                  id="school-email-number"
                  inputMode="numeric"
                  maxLength={8}
                  pattern="[0-9]{8}"
                  placeholder="12345678"
                  value={schoolEmailNumber}
                  onChange={(event) => setSchoolEmailNumber(event.target.value)}
                />
                <span aria-hidden="true">mkn@e.osakamanabi.jp</span>
              </div>

              <button type="submit" disabled={status === "sending"}>
                {status === "sending" ? "送信中" : "認証コードを送信"}
              </button>
            </form>

            {message ? (
              <div
                className={`notice ${status === "error" ? "error" : "success"}`}
              >
                <p>{message}</p>
                {schoolEmail ? (
                  <p>
                    送信先: <strong>{schoolEmail}</strong>
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>

          <aside className="content-panel side-panel" aria-label="認証状況">
            <h2>状況</h2>
            <dl className="status-list">
              <div>
                <dt>入力形式</dt>
                <dd>8桁の半角数字</dd>
              </div>
              <div>
                <dt>送信先</dt>
                <dd>{schoolEmail ?? "未送信"}</dd>
              </div>
              <div>
                <dt>処理状態</dt>
                <dd>
                  {statusLabel}
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>
    </main>
  );
}

export default App;
