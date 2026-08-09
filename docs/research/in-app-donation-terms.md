# アプリ内の寄付導線と利用サービス規約

調査日: 2026-08-09

## 結論

**現状のまま寄付導線を公開するのは保留する。**

次の形なら、Cloudflare と Resend の現行規約に明示された禁止事項には
触れにくい。

- アプリ内には任意の寄付であることを明記したリンクだけを置く。
- カード番号等は Tsugi で取得せず、決済事業者がホストするページへ遷移する。
- 寄付の有無で機能、表示、承認権限等を変えない。
- 認証メールへ寄付案内を混ぜず、学校メール宛ての寄付勧誘をしない。

ただし、現在メール送信ドメインに使う **is-a.dev は要確認**。
規約が非商用プロジェクトに限定し、商用・営利目的を明示的に禁止する一方、
開発・維持費を補う任意寄付が該当するかを定義していない。寄付導線を公開する前に
is-a.dev から書面回答を得るか、所有する有料ドメインへ送信元を移す。

決済事業者は未選定なので、その事業者の本人確認、年齢、寄付・個人支援、禁止業種、
返金、税務上の表示に関する規約は最終判定できない。

## 前提

この判定は次を前提とする。

- 寄付は完全に任意で、学生への対価や特典を伴わない。
- 使途は Tsugi の開発、ドメイン、ホスティング等の維持費である。
- Tsugi は現在どおり Web/PWA として提供し、App Store や Google Play へ
  ネイティブアプリとして配布しない。
- 決済フォームは Tsugi 内に実装・埋め込みせず、決済事業者のドメインで提供する。

## 現在確認できるサービス

| サービス | 現在の用途 | 寄付導線の評価 |
| --- | --- | --- |
| is-a.dev | `no-reply@jikanwari.is-a.dev` の送信ドメイン | **要書面確認** |
| Cloudflare Workers / D1 | 本番 Portal と DB | 外部決済リンクなら概ね可。Free 上でカード情報を扱わない |
| Resend | 確認コード送信 | アプリ内表示だけなら影響小。寄付メールは別同意が必要 |
| Vercel | リポジトリにリバースプロキシ設定が残る | 現在は休眠。再利用時、Hobby の非商用条件を確認 |
| GitHub | 公開ソースリポジトリ | 通常の寄付リンクで問題を示す条項なし。GitHub Sponsors 利用時は追加条件あり |

## is-a.dev

Portal は Resend API へ
`Tsugi <no-reply@jikanwari.is-a.dev>` を渡している
（[`worker/index.ts`](../../apps/portal/worker/index.ts#L147)）。is-a.dev の公開 DNS 登録にも、
[Resend 用 MX/SPF](https://raw.githubusercontent.com/is-a-dev/register/main/domains/send.jikanwari.json) と
[DKIM](https://raw.githubusercontent.com/is-a-dev/register/main/domains/resend._domainkey.jikanwari.json)
が存在する。

[is-a.dev Terms of Service](https://github.com/is-a-dev/register/blob/main/TERMS_OF_SERVICE.md)
（2026-08-03 更新）は次を定める。

- 利用者は 13 歳以上の個人。個人本人、グループ、非商用プロジェクトの代表として使う。
- subdomain は個人、software developer group、software development に関係する
  non-commercial project 用。
- commercial、for-profit、political purposes を禁止。
- unsolicited communications を禁止。
- 運営者は理由を問わず subdomain を終了できる。

任意寄付を「commercial」「for-profit」と扱うかは規約に記載がない。
費用補填だけで利益や寄付者特典がなくても、こちらだけで適合と断定できない。
また、Tsugi が無料であっても「software development に関係する project」の範囲に
学校生活アプリが含まれるかは明確でない。

登録上、root の
[`jikanwari.is-a.dev`](https://raw.githubusercontent.com/is-a-dev/register/main/domains/jikanwari.json)
は Vercel を指す。ただし 2026-08-09 の実アクセスは Vercel `404 NOT_FOUND`、
本番 `tsugi.8-apricity.workers.dev` は Cloudflare から `200` を返した。
したがって現在の実用途はメール送信 DNS と判断した。確認コードは学生自身の要求への
返信なので unsolicited communication には通常当たらない。寄付勧誘メールは送らない。

### is-a.dev への確認文案

> We use `jikanwari.is-a.dev` only as the verified sender domain for transactional
> sign-in codes for Tsugi, a free, closed school-community PWA. We plan to add an
> optional link in the app to a third-party hosted donation page. Donations would
> only offset development, domain, and hosting costs; donors receive no features,
> access, influence, or other benefits. Transactional emails would not contain
> donation solicitations. Is this use permitted under sections 2–4 of your Terms,
> especially the non-commercial and commercial/for-profit restrictions?

回答が得られない場合、独自ドメインへの移行が安全。無料 subdomain は終了権と規約変更権も
大きく、本番認証メールの継続性にも向かない。

## Cloudflare Workers / D1

[Cloudflare Self-Serve Subscription Agreement](https://www.cloudflare.com/terms/)
は、Free Services を受ける web property 上で個人・事業者のカード情報を
process または collect することを禁止する（2.2.1(h)）。一方、合法で誤認を招かない
寄付リンク自体を禁止する条項は確認できなかった。
[Developer Platform Service-Specific Terms](https://www.cloudflare.com/service-specific-terms-developer-platform/)
にも、Workers/D1 上の寄付リンクを一律禁止する追加条項はない。

したがって次を守る。

- Tsugi にカード番号、有効期限、CVC 入力欄を置かない。
- payment element や iframe を埋め込まず、決済事業者の hosted page へ通常遷移する。
- 決済ページを Worker で reverse proxy しない。
- Tsugi/寄付ページが Cloudflare の後援を受けているように表示しない。
- 決済 webhook を将来受ける場合もカード情報を payload、log、D1 に保存しない。

## Resend

[Resend Terms of Service](https://resend.com/legal/terms-of-service)
は account 利用者を 18 歳以上に限定する。また送信者は recipient の同意を含む必要な権利を
得る責任を負う。
[Acceptable Use Policy](https://resend.com/legal/acceptable-use) は、全 recipient の
explicit opt-in、unsolicited message の禁止を定める。bulk mail には送信者住所・名称、
連絡理由、簡単な unsubscribe と 7 日以内の処理も必要。

現在の確認コードは、学生が送信操作をした直後の transactional mail なので寄付導線の影響は
ない。Student Account 作成や学校メール確認への同意を、寄付案内の受信同意へ流用しない。
寄付依頼を確認コード本文に追加しない。将来送るなら、独立した明示同意と配信停止を実装する。

Resend account の実所有者が 18 歳未満なら、寄付とは別に現行規約へ適合しない。
18 歳以上の責任者名義へ移す必要がある。

## Vercel

[`vercel.json`](../../vercel.json) には全 path を Cloudflare Worker へ転送する設定が残る。
しかし現在 `jikanwari.is-a.dev` は Vercel 404、本番は Cloudflare の `workers.dev` で稼働。
現時点の寄付導線は Vercel deployment を通らないと判断した。

再利用する場合は注意が必要。
[Vercel Terms](https://vercel.com/legal/terms) は Hobby を personal / non-commercial use
だけに限定する。[Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines)
は commercial usage を、制作関係者の financial gain を目的とする deployment と定義する。
費用補填の寄付を financial gain と扱うかは明文化されていない。Hobby を再利用するなら、
Vercel Support の書面確認を得るか Pro へ変更する。

## GitHub と決済候補

通常のリポジトリ保管や、外部寄付ページへのリンクが GitHub の一般規約に反する根拠は
確認できなかった。GitHub Sponsors を使う場合は別条件になる。
[GitHub Sponsors Additional Terms](https://docs.github.com/en/site-policy/github-terms/github-sponsors-additional-terms)
は、資金調達理由の虚偽、違法目的、raffle/gambling 等を禁止する。13 歳超 18 歳未満でも、
Stripe が legal guardian の本人確認情報を取得できれば受取可能としている。GitHub Sponsors は
open source contributor 支援制度なので、応募・審査・Stripe 条件への適合も必要。

直接決済の候補では、
[Stripe Services Agreement](https://stripe.com/en-jp/legal/ssa/id) は 13 歳以上を許容するが、
18 歳未満には成人 Representative の追加と、その者の責任負担を求める。
[PayPal 日本ユーザー規約](https://www.paypal.com/jp/legalhub/paypal/useragreement-full?locale.x=ja_JP)
は個人 account を日本居住の 18 歳以上に限定する。

どちらも「リンクを置ける」だけでは受取資格を満たさない。受取人、銀行口座、本人確認、
税務情報、返金責任を成人責任者と決めてから、選んだサービスの禁止業種・寄付条件を再審査する。

## 推奨順

1. is-a.dev へ上記文面で確認。回答がなければ独自ドメインへ移行。
2. 成人の受取責任者と資金管理方法を決定。
3. 決済事業者を選定し、その時点の日本向け規約を再確認。
4. Tsugi には説明と外部リンクだけを実装。カード情報、決済 SDK、寄付者一覧を持たない。
5. 表示文に「任意」「機能・権限への影響なし」「使途」「受取人」を明記。
6. 学校規則、学校名・メール利用許可、税務上の扱いをサービス規約とは別に確認。

最小リスク案は、**独自ドメイン + 成人名義の hosted payment page + アプリ内リンクのみ**。
is-a.dev と Resend を寄付勧誘には使わない。
