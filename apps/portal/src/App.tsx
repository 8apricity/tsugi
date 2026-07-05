import { useState, type FormEvent } from "react";
import "./App.css";

type RequestStatus = "idle" | "sending" | "sent" | "error";

function App() {
  const [schoolEmailNumber, setSchoolEmailNumber] = useState("");
  const [schoolEmail, setSchoolEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<RequestStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

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
      </section>
    </main>
  );
}

export default App;
