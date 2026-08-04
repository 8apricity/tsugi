export function renderVerificationCodeEmail(code: string) {
  const text = `Tsugi

確認コード

学校のメールを確認するため、次のコードを入力してください。

${code}

このコードは10分間有効です。
誰にも共有しないでください。

心当たりがなければ、このメールを無視してください。`;

  const html = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light only">
    <meta name="supported-color-schemes" content="light only">
    <title>Tsugi 認証コード</title>
    <style>
      @media only screen and (max-width: 600px) {
        .email-shell { padding: 16px 12px !important; }
        .email-content { padding: 32px 24px !important; }
        .verification-code { font-size: 36px !important; letter-spacing: 0.24em !important; }
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f5f6f7; color: #1f2933; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent;">学校のメールを確認するためのコードをお送りします。</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width: 100%; background-color: #f5f6f7;">
      <tr>
        <td class="email-shell" align="center" style="padding: 40px 16px;">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="width: 100%; max-width: 560px; border-collapse: separate; background-color: #ffffff; border: 1px solid #d9dee3; border-radius: 16px;">
            <tr>
              <td class="email-content" style="padding: 44px 48px;">
                <div style="margin: 0 0 40px; color: #23324d; font-size: 30px; line-height: 1; font-weight: 750; letter-spacing: -0.02em;">Tsugi</div>
                <h1 style="margin: 0 0 16px; color: #1f2933; font-size: 24px; line-height: 1.4; font-weight: 700;">確認コード</h1>
                <p style="margin: 0 0 28px; color: #1f2933; font-size: 16px; line-height: 1.75;">学校のメールを確認するため、<br>次のコードを入力してください。</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width: 100%; border-collapse: separate; background-color: #e8f5f6; border: 1px solid #cde5e7; border-radius: 12px;">
                  <tr>
                    <td align="center" style="padding: 28px 16px;">
                      <span class="verification-code" style="display: inline-block; padding-left: 0.32em; color: #23324d; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace; font-size: 42px; line-height: 1.2; font-weight: 700; letter-spacing: 0.32em; white-space: nowrap;">${code}</span>
                    </td>
                  </tr>
                </table>
                <p style="margin: 28px 0 0; color: #6b7280; font-size: 15px; line-height: 1.7;">このコードは10分間有効です。<br><strong style="color: #1f2933; font-weight: 700;">誰にも共有しないでください。</strong></p>
                <p style="margin: 24px 0 0; padding-top: 24px; border-top: 1px solid #d9dee3; color: #6b7280; font-size: 13px; line-height: 1.7;">心当たりがなければ、このメールを無視してください。</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { html, text };
}
