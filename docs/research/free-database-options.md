# 320 人を無料で支えるデータベース選定

調査日: 2026-07-28

## 結論

現時点の推奨順は次の通り。

1. **D1 Free のまま読み取りを最適化する。**
2. 最適化後も余裕がなければ、**Turso Free を技術上の第一移行候補**にする。
3. Supabase は Rows Read 対策ではなく、**PostgreSQL・Auth・Storage・Realtime を今後使う意思がある場合**に選ぶ。
4. Neon は PostgreSQL だけが必要な場合の補欠候補。

ただし、Turso を 320 人向け本番に使う前に、規約とデータ保護について
Turso から書面回答を得る必要がある。Free は DPA、監査ログ、IP allow list、
チーム管理を含まない。さらに現行利用規約には、第三者の利益のためではない
利用という文言があり、学年全体への無償提供が許容されるかは明瞭でない。

無料プランには SLA がなく、仕様や無料枠も変更され得る。したがって
「無料枠が大きい製品へ即移行」ではなく、移行可能性、バックアップ、
管理者の引き継ぎまで含めて設計する。

## 比較

| 項目 | D1 Free | Turso Free | Supabase Free | Neon Free |
| --- | --- | --- | --- | --- |
| 主な制限 | 500 万 Rows Read/日 | 5 億 Rows Read/月、1,000 万 Rows Written/月 | API 回数無制限、DB 500 MB/project、DB egress 5 GB/org/月 | 100 CU-hours/project/月、0.5 GB/project、egress 5 GB |
| 上限時 | その日の D1 query が失敗 | `BLOCKED`。月次枠回復まで失敗し得る | 通知・猶予後に read-only、pause、HTTP 402 等 | Free allowance に依存 |
| バックアップ | Time Travel 7 日 | PITR 24 時間 | 自動 backup/PITR なし | restore window 6 時間 |
| 東京 region | 現行構成 | あり | あり | なし。近隣は Singapore |
| カード | Free は不要 | 不要と明記 | Free は $0。有料化はカードのみ | 不要と明記 |
| 現行 SQLite との近さ | 同一 | 高い。現行 Cloud は libSQL/SQLite-compatible | 低い。PostgreSQL へ変換 | 低い。PostgreSQL へ変換 |
| 移行量 | 小 | 小〜中 | 中〜大 | 中〜大 |
| Free の共同管理 | Cloudflare account 側 | Pricing 上、Teams なし | Dashboard member は複数可 | Organization member は複数可 |
| Tsugi への評価 | 最初に試す | 条件付き第一移行候補 | PostgreSQL を選ぶ時だけ | PostgreSQL の補欠 |

Supabase の cached egress 5 GB は主に CDN/Storage 用であり、
Worker と Database 間の結果取得に使える通常 egress は 5 GB として評価する。

## 現行 Tsugi の基準値

production D1 の代表 query を 2026-07-28 に計測した。

- Active Task: 105 Rows Read
- Active Note: 256 Rows Read
- 合計: 361 Rows Read/school date
- Portal の初回取得: 前後 7 日を含む 15 日

したがって Task/Note だけで次の概算になる。

```text
361 rows/date × 15 dates = 5,415 rows/student/load
5,415 × 320 students = 1,732,800 rows/load
3 loads/day = 5,198,400 rows/day
```

D1 Free の 500 万/日を 3 load/student/day で超える。他の認証、
時間割、時間割変更、編集、運用 query は未算入である。

一方、問題の中心は利用者数そのものではなく、次の実装である。

- Active item query が結果 0 件でも履歴系 table を `SCAN` する。
- 15 日について Task/Note を日付別に 30 query 発行する。
- Target Scope の 1 part 確認を相関 subquery で繰り返す。

別 DB へ移っても、この N+1 と全走査は latency、外部 subrequest、
compute、egress の問題として残る。移行前に直す。

現行コードの移行面は次の規模。

- SQLite/D1 migration: 20 files
- `persistence.ts` の `.prepare()`: 122 箇所
- `.batch()`: 7 箇所
- SQLite `rowid` 参照: 4 箇所
- D1 adapter の実装部: 約 2,400 行

## Turso の詳細

### 無料枠

[Turso Pricing](https://turso.tech/pricing?frequency=monthly) の Free:

- $0、カード不要
- 100 databases
- 5 GB storage
- 5 億 Rows Read/月
- 1,000 万 Rows Written/月
- 3 GB sync/月
- PITR 24 時間
- Community support

[Usage & Billing](https://docs.turso.tech/help/usage-and-billing) によれば、
Rows Read は返却行ではなく scan 行。JOIN、subquery、集計、索引作成も
対象になる。上限を超える query は `BLOCKED` で失敗する。
利用量は organization 単位で集計されるため、DB を分割しても枠は増えない。

### 320 人での概算

D1 の実測 5,415 rows/student/load をそのまま当てた保守的な概算:

| 利用日/loads | 月 Rows Read | 5 億に対する割合 |
| --- | ---: | ---: |
| 20 日、1 load/日 | 34,656,000 | 6.9% |
| 20 日、3 loads/日 | 103,968,000 | 20.8% |
| 20 日、10 loads/日 | 346,560,000 | 69.3% |
| 30 日、1 load/日 | 51,984,000 | 10.4% |
| 30 日、3 loads/日 | 155,952,000 | 31.2% |
| 30 日、9 loads/日 | 467,856,000 | 93.6% |
| 30 日、10 loads/日 | 519,840,000 | 104.0% |

3 loads/日なら、未最適化でも Task/Note は枠の約 21〜31%。
索引と range query 後はさらに下がる見込み。ただし他 query を含めた
Turso staging 実測なしに安全とは断定しない。

日次 D1 枠と違い月次なので、学校の朝の集中に強い。一方で月半ばに
枠を使い切ると長期間停止し得る。50%を通常運用目標、70%を警告、
85%を新機能停止・緊急対応の目安にする。

### Cloudflare Workers との接続

[Turso TypeScript SDK](https://docs.turso.tech/sdk/ts/reference) は
Cloudflare Workers をサポートする。現行 Turso Cloud は
[libSQL ベースの SQLite-compatible service](https://docs.turso.tech/turso-cloud)
なので、移行初期は production-ready とされる
`@libsql/client/web` を使うのが保守的。

Worker の `TURSO_DATABASE_URL` と `TURSO_AUTH_TOKEN` から client を作る。
token は Wrangler secret にし、browser へ渡さない。

ただし Turso 呼び出しは外部 `fetch` になる。
[Workers Free は外部 subrequest が 50/request](https://developers.cloudflare.com/workers/platform/limits/)。
現行初回 path は固定部分だけで約 44 DB query なので、そのまま移すと危険。

移行前に次へ変更する。

1. 15 日分 Task を 1 range query にする。
2. 15 日分 Note を 1 range query にする。
3. Standard Timetable は曜日別 N+1 ではなく 1 query にする。
4. Reference 解決をまとめる。
5. 1 Daily Plan request の DB network round-trip を通常 10 未満にする。

### 推奨 adapter

既存の domain-level `PersistenceAdapters` は残す。その下に小さな
SQLite driver port を設ける。

```text
Domain/use cases
      |
PersistenceAdapters
      |
SqlitePersistenceAdapters
      |
+--------------------+
| D1SqliteDriver     |
| LibSqliteDriver    |
+--------------------+
```

port は現行利用分だけを持つ。

- `prepare(sql).bind(...args).all()`
- `prepare(sql).bind(...args).first()`
- `prepare(sql).bind(...args).run()`
- `batch(statements)`

libSQL の `rows` を D1 の `results` 相当へ、`rowsAffected` を write result
へ変換する。`batch(..., "write")` は複数 statement を暗黙 transaction で
順次実行し、失敗時に全 rollback するため、D1 batch に近い。

`D1Database` を偽装する大きな互換 layer ではなく、Tsugi が実際に使う
最小 interface として定義する。これにより既存 122 個の SQL を最初から
全面改稿せずに済む。

### schema 上の注意

- D1 は foreign key enforcement が常時有効。
- Turso の SQL documentation は foreign key が既定 off とする。
- remote HTTP connection で `PRAGMA foreign_keys = ON` がどの範囲に
  有効か、現行 libSQL Cloud で必ず実機確認する。
- orphan insert/delete の integration test を acceptance test に含める。
- `PRAGMA user_version` は Turso Cloud で read-only。migration version は
  `_schema_migrations` table で管理する。
- `rowid` に依存する履歴順は、将来の PostgreSQL 移行も考え、
  明示的な sequence/order column へ置き換える。

### 規約・管理上の blocker

[Turso Terms of Use](https://turso.tech/terms-of-use) は次を規定する。

- 16 歳未満は登録・利用しないこと。
- 契約年齢に達していない場合、親または guardian の許可と、
  その者による Terms 同意が必要。
- organization を代表して同意する場合、その権限が必要。
- own internal business/personal/non-commercial use かつ、
  third party の利益のためではない、という利用範囲の文言がある。

320 人への提供がこの範囲に入るかは、この調査では法的に断定できない。
本番移行前に、用途、利用者数、無料提供、保存データの種類を説明し、
Turso support から許容されるとの書面回答を得る。

Pricing 上、Free は DPA、audit logs、IP allow lists、Teams を含まない。
学校メール、所属、活動履歴を扱う場合、技術的余裕より重要な判断材料になる。

また公式 homepage/blog の「no sleeping databases」と、CLI documentation の
「Free は 10 日 inactivity で archive」という記述が一致しない。
夏休みの挙動も support に確認する。

### backup

PITR 24 時間だけでは、金曜に起きた破損を月曜に見つけた時に戻せない。

- 毎日 encrypted export
- 日次 7 世代、週次 4 世代
- 暗号鍵は DB/token と別管理
- backup に学校メールを含むため、公開 repository artifact へ平文保存しない
- 月 1 回 restore drill

## Supabase の詳細

### 無料枠

[Supabase Pricing](https://supabase.com/pricing) の Free:

- $0
- API requests unlimited
- DB 500 MB/project
- shared CPU、500 MB RAM
- uncached egress 5 GB/organization/月
- cached egress 5 GB/organization/月
- 2 active projects
- Tokyo region
- 7 日の低活動で pause 対象
- automatic backup/PITR なし

上限超過で自動課金はされない。
[Billing FAQ](https://supabase.com/docs/guides/platform/billing-faq) では、
通知と grace period の後、read-only、pause、launch 制限、API 402 などの
service restriction があり得る。有料 plan の支払いは credit card only。
JCB は対応ブランドに含まれる。

[Free Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
によれば、通常は毎日数回の user DB request で pause を避けられる。
利用中の学期は問題になりにくいが、長期休暇では停止し得る。
pause 後 1 年以内は Dashboard から再開できる。

[Database Backups](https://supabase.com/docs/guides/platform/backups) は、
Free user に定期的な `supabase db dump` と off-site backup を推奨する。

### 320 人での egress

Supabase は scan 行数では課金しない。主な無料枠リスクは、DB から Worker
へ返る byte 数。5 GB を Daily Plan だけに全て使えると仮定した上限:

| 仮定 | 1 load 当たりの平均上限 |
| --- | ---: |
| 320 人 × 3 loads × 20 日 | 約 254 KiB |
| 320 人 × 10 loads × 20 日 | 約 76 KiB |
| 320 人 × 3 loads × 30 日 | 約 170 KiB |
| 320 人 × 10 loads × 30 日 | 約 51 KiB |

実際は login、edit history、backup、管理処理も egress を使う。
特に `pg_dump` も DB から出る通信。Daily Plan query ごとに返却 byte 数を
計測し、通常 50%、警告 70%、緊急 85%を目安にする。

500 MB は現在の 320 人では直ちに問題になりにくいが、Tsugi は immutable
snapshot/history を蓄積する。毎月 table/index size と増加率を記録する。
500 MB 超過時は read-only になり得る。

### 接続構成

既存の Worker-side authorization を保つなら、候補は次。

```text
Browser
  -> Cloudflare Worker
      -> Hyperdrive
          -> Supabase Postgres (Tokyo)
```

[Hyperdrive Free](https://developers.cloudflare.com/hyperdrive/platform/pricing/)
は 10 万 SQL statements/日。現行の約 44 query/load のままだと
320 人 × 7 loads 付近で危険になる。range query 化後に利用する。

Hyperdrive query cache は session、authorization、write 直後の read には
使わない。cache-disabled binding を基本にし、共有可能な時間割や
Grade/Class/Track projection のみ、別 binding または明示的 cache にする。

別案は Supabase Data API。HTTP で扱いやすいが、現行の複数 statement
transaction をそのまま表現しにくい。Direct Change の atomicity を保つには
Postgres function/RPC 化が必要になる。移行初期は Hyperdrive と
Postgres driver の方が現行 SQL adapter に近い。

### SQLite から PostgreSQL への変更

少なくとも次を変える。

- `?` placeholder を `$1`, `$2`, ... へ変更
- `rowid` 順序を明示 column へ変更
- `instr(x, char(10))` 等を PostgreSQL expression へ変更
- SQLite/D1 migration 20 files を PostgreSQL DDL に変換
- D1 `batch()` を PostgreSQL transaction に変換
- D1 result shape を PostgreSQL row/result shape へ変換
- `better-sqlite3` test harness に加えて PostgreSQL integration test を用意
- Wrangler D1 migration から別 migration runner へ変更
- `nodejs_compat`、driver bundle、Workers Free 10 ms CPU を実測

現行 122 `prepare()` の SQL dialect を確認する必要がある。
Turso より工数と regression risk が大きい。

### Supabase Auth は今すぐ移さない

Tsugi は学校 email verification と session を Worker 側で既に持つ。
Rows Read 対策のために Auth まで同時移行すると、障害点が増える。

最初は DB のみ移し、Worker が database credential を保持する。
Supabase secret/service key を browser に出さない。Auth 移行は、
school domain 制約、session invalidation、Resend、自動 test login を
別 spec として扱う。

### Supabase を選ぶ条件

次の複数が必要なら選ぶ価値がある。

- PostgreSQL tooling/analytics
- Row Level Security
- Supabase Auth
- Storage
- Realtime
- teacher を含む複数 Dashboard member

Rows Read だけが理由なら、これらの変更コストを正当化しにくい。

## Neon

[Neon Pricing](https://neon.com/pricing) の Free は、カード不要、
100 CU-hours/project/月、0.5 GB/project、5 GB egress、
6 時間 restore window。公式 serverless driver は Cloudflare Workers を
サポートする。

最小 compute は 0.25 CU。理論上 100 CU-hours は最小状態で
400 active hours だが、朝の同時利用で autoscale すれば消費は増える。
320 人の load test なしに余裕を推定しにくい。

PostgreSQL 変換量は Supabase とほぼ同じ。東京 region がなく、
近隣は Singapore。Auth/Storage/Realtime が不要で PostgreSQL だけ欲しい場合は
Supabase より簡潔だが、今回の第一候補ではない。

## 推奨する実施順

### Phase 0: 規約と所有者

1. DB/Cloudflare account の正式 owner を先生、学校、または保護者を含めて決める。
2. 一人の生徒個人 account と recovery email に依存しない。
3. 学校メール、所属、学習・活動情報の保存許可と retention を決める。
4. Turso を候補に残すなら support へ利用可否、未成年契約、DPA、
   inactivity archive、foreign key を質問する。

### Phase 1: provider-independent な最適化

1. `target_scope_parts(target_scope_id)` の query plan を改善。
2. Active item 用 partial/composite index を追加。
3. Task/Note を 15 日 range query 各 1 本へ統合。
4. Target Scope を初期仕様どおり 1 part に固定できるなら相関 count を削除。
5. canonical history は残し、Active projection を追加。
6. 共有可能な Grade/Class/Track projection だけ versioned cache。

ここで D1 production 相当 synthetic data と実 D1 `meta.rows_read` を再計測する。

### Phase 2: D1 Free 継続判定

次を満たせば、無理に移行しない。

- 320 人の p95 日次予測が 250 万 Rows Read 以下
- 400 万/日で alert
- 主要 Active read に意図しない履歴 table `SCAN` がない
- 1 Daily Plan request の DB query が通常 10 未満
- Workers request/CPU limit に余裕

250 万は Cloudflare の仕様値ではなく、hard stop から距離を取る運用目標。

### Phase 3: Turso staging

規約確認が取れた場合だけ進める。

1. provider-neutral SQLite interface を追加。
2. `@libsql/client/web` driver を追加。
3. D1 export SQL から local SQLite file を作成。
4. WAL mode/checkpoint 後、Turso staging へ import。
5. table count、FK、unique/check constraint、代表 read/write、履歴 chain を照合。
6. 320 人相当 concurrency、Rows Read、latency、external subrequest を測定。
7. encrypted backup/restore drill。

### Phase 4: pilot と cutover

1. 個人情報を含まない synthetic data で先に試す。
2. 許可を得た少人数 pilot は別 staging URL で行う。
3. cutover 時は D1 write を短時間停止。
4. 最終 export/import と件数・checksum 照合。
5. Worker secret/config を Turso へ切り替え。
6. D1 はすぐ削除せず read-only rollback source として保持。
7. Turso への新規 write 後に rollback する手順も事前に決める。

## 決済手段について

無料維持を優先する判断は合理的。ただし、有料化しか復旧手段がない状況を
作らない。

- Turso Free と Neon Free はカード不要を明記。
- Supabase Free は超過を自動課金せず制限する。有料 plan はカードのみ。
- Cloudflare は現在、card に加え PayPal、Apple Pay、Google Pay、
  Stripe Link、UnionPay 等を案内している。

したがって、もし月 $5 を支払える時期が来た場合、D1 Paid は
最小変更かつ Supabase より決済選択肢が多い可能性がある。
それでも、支払い不能時に突然止まらないよう Free 上限内の設計と
export 可能性は維持する。

## 最終判断

**今すぐ Supabase へ全面移行しない。**

まず D1 の構造的な無駄を直す。320 人に対して D1 Free の 50%目標へ
収まれば、そのままが最も安全で保守も軽い。

収まらない場合、技術面では Turso が最も合う。月次 5 億行は現行の
3 loads/日概算に十分な余裕があり、SQLite schema と SQL を多く残せる。
ただし規約、未成年 account、DPA、共同管理、inactivity、FK の回答が
取れない限り、本番の第一候補には昇格させない。

Supabase は Free でも 320 人に成立する可能性があるが、5 GB egress、
pause、自動 backup なし、PostgreSQL rewrite という別のリスクへ移る。
将来機能として PostgreSQL/Supabase を欲しい時に選ぶ。

## 主な一次資料

- [Turso Pricing](https://turso.tech/pricing?frequency=monthly)
- [Turso Usage & Billing](https://docs.turso.tech/help/usage-and-billing)
- [Turso Cloud](https://docs.turso.tech/turso-cloud)
- [Turso TypeScript SDK](https://docs.turso.tech/sdk/ts/reference)
- [Turso Migrate](https://docs.turso.tech/cloud/migrate-to-turso)
- [Turso PITR](https://docs.turso.tech/features/point-in-time-recovery)
- [Turso Locations](https://docs.turso.tech/api-reference/locations/list)
- [Turso Limitations](https://docs.turso.tech/cloud/limitations)
- [Turso Terms of Use](https://turso.tech/terms-of-use)
- [Supabase Pricing](https://supabase.com/pricing)
- [Supabase Billing FAQ](https://supabase.com/docs/guides/platform/billing-faq)
- [Supabase Free Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase Egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress)
- [Supabase Database Size](https://supabase.com/docs/guides/platform/database-size)
- [Supabase Connections](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase Regions](https://supabase.com/docs/guides/platform/regions)
- [Supabase Terms](https://supabase.com/terms)
- [Neon Pricing](https://neon.com/pricing)
- [Neon Serverless Driver](https://neon.com/docs/serverless/serverless-driver)
- [Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Hyperdrive Pricing](https://developers.cloudflare.com/hyperdrive/platform/pricing/)
- [Cloudflare Billing](https://developers.cloudflare.com/billing/)
