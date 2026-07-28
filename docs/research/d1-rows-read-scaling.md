# D1 Rows Read と 320 人規模への拡張

調査日: 2026-07-28

## 結論

320 人への提供は D1 の能力上は十分現実的である。第一候補は、データベース製品を移行せず、次の順で進めること。

1. 本番サービスは Workers Paid（月額最低 $5）へ移す。
2. 各主要クエリの `meta.rows_read` と `EXPLAIN QUERY PLAN` を計測する。
3. 現在の履歴中心スキーマは維持しつつ、学生向け日常表示のための索引または再構築可能な Active Shared Information 読み取りモデルを追加する。
4. Grade/Class/Track 共通結果だけを短時間またはバージョン付きでキャッシュする。
5. 外部 PostgreSQL などへの移行は、D1 の Rows Read ではなく、10 GB 単一 DB 制限、分析要件、外部ツール連携など別の要件が発生した時に再検討する。

Free の 500 万 Rows Read/日は「予算」ではなく、到達すると D1 クエリが失敗するハード上限である。学校生活で毎日使うサービスの可用性をこの上限に依存させるべきではない。一方 Paid は月 250 億 Rows Read を含むため、320 人規模では大きな余裕がある。

## 現行の料金と上限

Cloudflare の [D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/) と [Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/) による現在値:

| 項目 | Workers Free | Workers Paid |
| --- | ---: | ---: |
| Rows Read | 500 万/日 | 最初の 250 億/月を含む。超過は $0.001/100 万行 |
| Rows Written | 10 万/日 | 最初の 5,000 万/月を含む。超過は $1.00/100 万行 |
| D1 storage | アカウント合計 5 GB | 最初の 5 GB を含む。超過は $0.75/GB-month |
| Workers plan | 無料 | アカウント当たり最低 $5/月 |

Free の上限は 00:00 UTC、すなわち日本時間 09:00 にリセットされる。上限到達後は、リセットまたは Paid への変更まで D1 API がエラーを返す。Paid の含有量は購読更新日単位の月次で、含有量超過後も従量課金で継続する。[D1 Billing](https://developers.cloudflare.com/d1/observability/billing/) は、請求メトリクスがアカウント内の全 D1 データベースを横断して集計されることを明記している。

したがって、D1 を学年別・用途別に分割しても Free の Rows Read 枠は増えない。分割は障害分離や単一 DB の同時実行性能には使えるが、請求枠回避策にはならない。

### 320 人に割り当てた場合

Free の理論上限を均等に割ると:

| 利用仮定 | 学生 1 人当たり |
| --- | ---: |
| 1 日 | 15,625 Rows Read |
| 1 日 20 回の API 更新 | 1 回当たり約 781 Rows Read |
| 1 日 30 回の API 更新 | 1 回当たり約 521 Rows Read |
| 1 日 50 回の API 更新 | 1 回当たり約 313 Rows Read |

これはログイン、編集、Reference Scope、運用クエリ、同じ Cloudflare アカウント内の他 DB を含まない理論値である。日付が変わる直前ではなく日本時間 09:00 にリセットされる点も、学校の朝のピークに対して不都合である。

例えば毎回 320 行を全走査すると、全体で 15,625 request/日、学生 1 人平均約 48.8 request/日で上限に達する。各学生が 100 回更新すると 1,024 万 Rows Read/日となり Free は停止する。一方、索引で 1 request 当たりの走査を 10 行に抑えられれば、同じ 100 回更新でも 32 万 Rows Read/日である。これは単純化した比較で、実際には JOIN と index entry の読み取りを `meta.rows_read` に含める。

Paid の月 250 億 Rows Read は、30 日平均で約 8.33 億/日、320 人均等なら約 260 万/人/日である。最適化は必要だが、320 人を理由に直ちに別 DB 製品へ移る必要はない。

### Tsugi production と現行実装の実測

2026-07-28 に production D1 を read-only で確認した。主要行数は
`shared_information_items=55`、`shared_information_changes=102`、
`target_scopes=48`、`target_scope_parts=48` だった。

現行 SQL と同じ JOIN/条件を使い、本文や学生識別子を返さない
`COUNT` wrapper で 1 School Date を計測した結果:

| Query | Result count | `meta.rows_read` |
| --- | ---: | ---: |
| Active Tasks | 0 | 105 |
| Active Notes | 0 | 256 |

`EXPLAIN QUERY PLAN` は両方で `SCAN i`
（`shared_information_items` 全走査）を示した。さらに
`target_scope_parts` の「1 part だけ」を確認する相関 subquery も
`SCAN scope_part_count` だった。結果が 0 件でも合計 361 Rows Read を
消費している。

Portal の初回 Multi-Day Plan は既定で前後 7 日、計 15 日を取得する。
現在の `readDailyPlansRange` は日付ごとに Active Tasks と Active Notes を
再 query するため、この 2 系統だけで概算:

```text
361 rows/date × 15 dates = 5,415 rows/student/load
5,415 × 320 students = 1,732,800 rows/load
1,732,800 × 3 loads/day = 5,198,400 rows/day
```

3 回/人/日で Free 上限を超える。他の認証、School Year、Student
Affiliation、Standard Timetable、Timetable Change、Reference Scope、
編集系 query はこの試算に入っていない。`COUNT` wrapper による計測なので、
これは本番 endpoint 全体の上限値ではなく、危険性を示す保守的な基準値である。

Rows Read 以外にも、Free は Worker invocation 当たり D1 query が 50 件まで。
15 日読取の固定部分は、Student Session/Account/School Year/Affiliation 4 件、
Class/Track 2 件、最大 7 曜日の Standard Timetable 7 件、
Timetable Change 1 件、日付別 Task/Note 30 件で計 44 件になる。
Lesson Reference 解決などに残る余裕は 6 件しかない。Paid は同上限が
1,000 件になるが、Paid 化後も日付別 N+1 は統合すべきである。

## Rows Read の数え方

[D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/) は、返却行数ではなく、クエリが読み取った（scan した）行数を数えるとしている。行のバイト数や選択列数は Rows Read の数に影響しない。

- 5,000 行のテーブルを全走査する `SELECT *` は 5,000 Rows Read。
- 非索引列で絞り込み、1 行だけ返っても、判定のために走査した行が数えられる。
- D1 API の [`rows_read` 定義](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/) は、索引内の行も数えるとしている。索引検索は無料ではないが、全表走査より大幅に少なくなる。
- `SELECT` の列を減らすことはレスポンス量と CPU には有効だが、それだけで Rows Read が減るとは限らない。
- `COUNT(*)`、`LIMIT`、JOIN、相関サブクエリの実コストを返却行数から推測してはいけない。実際の `meta.rows_read` で確認する。
- インデックス対象列への書き込みは、テーブル行に加えて少なくとも 1 行の index write を発生させる。索引の追加は Rows Written と storage のトレードオフを持つ。
- DDL、Dashboard、Wrangler からのクエリも使用量に含まれる。
- `db.batch()` は往復回数と transaction 管理には有効だが、各 statement が走査した行の課金を消さない。N+1 query は結果集合をまとめる query または projection で減らす。

複数テーブル JOIN では、索引エントリとテーブル行の双方を読む可能性があるため、「1 件返るから 1 Row Read」とは限らない。Cloudflare は正確な算出式を固定仕様として公開していない。クエリプランと `meta.rows_read` の組み合わせを基準にする。

## 索引とクエリ設計

Cloudflare の [Use indexes](https://developers.cloudflare.com/d1/best-practices/use-indexes/) に従う。

- 高頻度の `WHERE`、JOIN key、日付範囲、並び順に合わせる。
- 複合索引は左端列から一致するクエリでのみ有効。実クエリの述語順ではなく、利用する列集合と先頭列が重要。
- `removed_at is null` のように Active Shared Information だけを読む用途では partial index を検討する。履歴が増えても active index を小さく保てる。
- 索引作成後は `PRAGMA optimize` を実行し、統計情報を更新する。
- `EXPLAIN QUERY PLAN ...` で `SEARCH ... USING INDEX ...` を確認する。`SCAN` が出た箇所を優先する。
- 各変更前後で本物の D1 の `meta.rows_read` を比較する。SQLite のローカル実行計画だけでは D1 の請求行数を保証できない。

現在の Tsugi は immutable snapshots と履歴を保持し、学生向け表示では `shared_information_items`、`target_scopes`、`target_scope_parts`、snapshot、latest change を JOIN する。このモデルは履歴説明には適するが、履歴の増加に伴って Active Shared Information 読み取りが全履歴を走査しないことを保証する必要がある。

具体的な索引名を先に決めるのではなく、代表データを十分に入れて以下のクエリ群を計測する。

- Student の Daily Plan / Multi-Day Plan
- Grade/Class/Track/Student の各 scope branch
- Active Task、Timetable Change、Note
- `target_scope_parts` の件数確認を含む相関サブクエリ
- Edit History と Change Detail
- Student Session と Student Affiliation

特に次は計画確認対象である。

- `target_scope_parts(target_scope_id)` を条件とする count/JOIN
- scope value から対象を探す query と、現行 unique partial index の列順
- `shared_information_items` の `kind`、`removed_at is null`、`target_scope_id`
- current snapshot ID から active item へ逆引きする JOIN
- school year/date/scope を同時に使う複合条件

これらは索引追加候補であり、`EXPLAIN QUERY PLAN` 前の確定提案ではない。

Tsugi では次の順に試す。

1. `target_scope_parts(target_scope_id)` を追加し、相関 count の全走査を止める。
2. Grade/Class/Track/Student の値から `target_scope_id` を探せる、列順を逆にした
   partial index を追加する。
3. `shared_information_items(target_scope_id, kind)` に
   `where removed_at is null` を付けた active partial index を追加する。
4. 15 日分を日付ごとに読む処理を、Task 1 query、Note 1 query、
   Timetable Change 1 query にまとめ、Worker 内で School Date ごとに配る。
5. production 相当 synthetic data で `EXPLAIN QUERY PLAN` と
   `meta.rows_read` を変更前後比較する。

初期仕様では Portal が作る Target Scope は常に 1 part である。一方 schema は
将来の union scope を表現できるため、全 read で相関 count を実行している。
初期リリース仕様を「Target Scope は Grade/Class/Track/Student の正確に 1 つ」
へ固定できるなら、`unique(target_scope_id)` を保証して count を削除する方が単純。
将来 union が必要になった時は、Group など別の明示的概念として再設計する。

## 推奨する読み取りモデル

canonical な履歴テーブルは維持し、日常画面用に再構築可能な projection を追加する構成が適する。

### 案 A: 正規化した Active projection

Active Shared Information に必要な scope、school date、period、表示値、source item/change ID を、学生向け検索に合わせたテーブルへ投影する。変更適用と同じトランザクションで projection を更新する。

利点:

- 履歴テーブルを日常表示のたびに走査しない。
- school year + scope type/value + date の複合/partial index を直接使える。
- canonical history、Edit History、stale 判定の意味を壊さない。
- Student 単位に 320 倍複製せず、Grade/Class/Track/Student の各 Target Scope 単位で保持できる。

欠点:

- write path が増える。
- projection の整合性検査と再構築手段が必要。
- index write が増えるため Rows Written も計測が必要。

### 案 B: scope/date ごとの JSON snapshot

再構築可能な `daily_plan_projection` を `(school_year, scope_type, scope_key, school_date, version)` 単位で 1 行にまとめる。D1 は行サイズや列数ではなく行数で Rows Read を数えるため、頻繁な読み取りを少数行へ圧縮できる。[D1 Limits](https://developers.cloudflare.com/d1/platform/limits/) では 1 string/BLOB/table row は最大 2 MB。

利点:

- lookup が単純で、直接索引検索しやすい。
- Grade 共通データを 320 人分複製しない。
- HTTP/edge cache と同じ version key を使いやすい。

欠点:

- 部分更新でも snapshot 行全体を再生成する。
- SQL での個別検索、集計、関係整合性には使いにくい。
- 2 MB 上限、serialization CPU、レスポンス量は別途考慮が必要。

この案では JSON snapshot を唯一の正とせず、canonical history から再構築可能にする。

### 推奨

まず案 A と必要索引だけで計測する。依然として日常表示の Rows Read が大きい場合、Grade/Class/Track 共通部分に限定して案 B を追加する。Student 固有部分は小さい indexed query のまま分離する。

## キャッシュと Read Replication

### Read Replication

[D1 Global read replication](https://developers.cloudflare.com/d1/best-practices/read-replication/) は read latency と read throughput を改善する。利用には Workers Binding の Sessions API が必要で、bookmark により session 内の sequential consistency を保つ。書き込みは primary に送られる。

ただし、replica の追加料金はない一方、`rows_read` と `rows_written` の請求は同じである。Read Replication は Free の 500 万 Rows Read 対策ではない。320 人が主に日本から利用する構成では、まずクエリ効率と Paid 枠を優先し、同時実行や地理的 latency が実測上の問題になった時に有効化する。

### Workers Cache API

[Workers Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/) は Worker が生成した response を edge cache に置ける。cache hit 時は D1 query を発行しないため、その hit は Rows Read を生まない。

注意:

- Cache API の内容はデータセンター間で複製されない。
- `cache.put` は Tiered Cache と互換性がない。
- `Set-Cookie` を持つ response は通常 cache されない。
- Grade/Class/Track/Student、school year/date、projection version を cache key に含める。
- Student 固有値や Named Attribution を共通 key に混ぜない。
- 変更後の purge 依存より、immutable/versioned key と短い pointer TTL を優先する。

最初の対象は Standard Timetable、Grade/Class/Track 共通 Daily Plan projection、登録 Lesson Name のような、多数の学生が同じ値を読むデータである。Student Session、Student 固有 Target Scope、編集権限判定、Named Attribution は共有 cache の対象外にする。

## DB 分割・別製品への移行評価

### 学年別 D1

Rows Read 枠はアカウント横断なので、費用/Free 上限は改善しない。単一 DB は single-threaded で、D1 は per-tenant/per-entity の水平分割を想定しているため、将来多数校を扱うなら School Community 単位の DB 分割は合理的である。[D1 Limits](https://developers.cloudflare.com/d1/platform/limits/) も水平分割を案内している。

現状は単一 School Community、320 人、単一学年である。別 DB への分割は cross-DB transaction/JOIN 不可、binding/cutover、運用増加の方が大きい。Rows Read 対策としては推奨しない。

### PostgreSQL/MySQL + Hyperdrive

Cloudflare の [Choose a data or storage product](https://developers.cloudflare.com/workers/platform/storage-options/) は、既存 PostgreSQL/MySQL、1 TB 以上の単一 DB、既存 DB tooling が必要な場合に Hyperdrive を案内し、D1 は lightweight/read-heavy な serverless app に適するとしている。

320 人と Rows Read だけを理由に外部 RDBMS へ移るのは過剰である。次の条件が成立した場合に再評価する。

- 1 DB 10 GB を超える見込み。
- 複雑な分析、外部 BI、運用 tooling が必須。
- D1 の SQLite/D1 SQL 制約が具体的機能を阻害。
- 学校全体または複数校で、D1 の単一 DB throughput が実測上不足。

### 無料運用を絶対条件にする場合

外部候補の第一候補は SQLite/libSQL 系の Turso。公式
[Pricing](https://turso.tech/pricing) は Free に 5 GB、月 5 億 Rows Read、
月 1,000 万 Rows Written を含む。日次 hard limit ではなく月次枠なので、
学校の朝に集中する Tsugi と相性は D1 Free よりよい。
公式 TypeScript SDK は
[Cloudflare Workers を含む edge runtime](https://docs.turso.tech/sdk/ts/reference)
をサポートし、D1 の SQLite schema も比較的移しやすい。

ただし binding API を Turso client へ置き換え、transaction/batch/error semantics、
local/staging migration、secret 管理、監視、backup/cutover を再構築する必要がある。
Turso Free の枠も hard ceiling になり得る。学生データの vendor/DPA/data location
確認も増える。月 $5 を許容できるなら、D1 Paid の方が移行リスクと運用工数が小さい。

PostgreSQL が将来要件なら Neon は次点。公式
[Pricing](https://neon.com/pricing) の Free は project 当たり 100 CU-hours/月と
0.5 GB、公式
[serverless driver](https://neon.com/docs/serverless/serverless-driver) は
Cloudflare Workers をサポートする。ただし SQLite から PostgreSQL への型、
DDL、transaction、test harness の変更が Turso より大きい。Rows Read 回避だけを
理由に選ばない。

外部移行を選ぶ場合の cutover:

1. D1 の write を一時停止できる短い maintenance window を決める。
2. `wrangler d1 export ... --remote` で SQL export。export 中は D1 request が
   block されるため、利用の少ない時間に行う。
3. staging の移行先へ import。全 table count、FK、代表 read/write、
   edit history chain を照合。
4. Worker に DB adapter を追加し、staging で負荷試験。
5. 最終 export/import 後に binding/secret を切替。
6. D1 は即削除せず read-only rollback source として保持する。

### Workers KV

同じ storage guide は、高頻度で読み、変更頻度が低く、即時整合性が不要な session/configuration を KV の候補としている。ただし Tsugi の Student Session 無効化や affiliation/authorization は整合性と安全性が重要である。認証データを一括移行せず、公開可能な projection/cache のみを候補にする。

## D1 内での schema migration 手順

Cloudflare の [D1 Migrations](https://developers.cloudflare.com/d1/reference/migrations/) は番号付き SQL migration を順次適用し、`d1_migrations` に記録する。Tsugi の既存 `apps/portal/db/migrations` 方針と一致する。

1. 現在の production `meta.rows_read`、Dashboard/GraphQL metrics、代表 query plan を基準値として保存。
2. staging に production 相当件数の synthetic data を用意。
3. index/projection migration を追加。
4. `PRAGMA optimize` を実行。
5. representative reads/writes の query plan、Rows Read/Rows Written、latency、結果同一性を比較。
6. projection の backfill は小さな batch に分ける。D1 は巨大な `UPDATE`/`DELETE` を一度に行わず、例として 1,000 行ずつ処理するよう案内している。
7. read path を旧/新で比較可能にしてから切替。
8. 安定後も canonical history は残し、projection を検証・再構築できるようにする。

外部 DB への cutover や新 D1 作成が必要な場合、[Import and export data](https://developers.cloudflare.com/d1/best-practices/import-export-data/) に従う。D1 は SQL export/import を使い、raw `.sqlite3` は直接 import できない。export 実行中は他の DB request が block されるため、メンテナンス時間または別 DB への段階移行が必要。

Foreign key は常時有効であり、migration 中に一時的な違反が必要なら `PRAGMA defer_foreign_keys = on` を使う。[D1 foreign keys](https://developers.cloudflare.com/d1/sql-api/foreign-keys/) によると、未解決の違反がトランザクション終了時に残れば失敗する。

[D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) は常時有効で、Free は 7 日、Paid は 30 日の point-in-time recovery を持つ。schema change 前の bookmark/timestamp と rollback 手順を記録する。ただし restore は in-place overwrite で、実行中 query/transaction を cancel する。

## 受入基準の提案

320 人対応を「推測」ではなく次で判定する。

- Daily Plan 1 回の p50/p95 `rows_read` を記録。
- Student 1 人の通常日/高頻度日の API 回数を記録。
- `320 × requests/student/day × p95 rows/request` にログイン、編集、運用余裕を加算。
- Free を続ける場合は 500 万/日の 50% を通常運用目標、80% を alert とし、hard stop 前に退避できるようにする。
- Paid では月 250 億の含有量と Workers request/CPU を別々に監視する。
- すべての主要 Active read で、成長する履歴テーブルに対する意図しない `SCAN` がない。
- cache hit ratio と stale duration を計測し、安全境界を越えた共有 cache key がない。

Free の 50%/80% は Cloudflare 仕様ではなく、学校利用の可用性を守るための運用提案である。

## 参照した一次資料

- [Cloudflare D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare D1 Billing](https://developers.cloudflare.com/d1/observability/billing/)
- [Cloudflare D1 Metrics and analytics](https://developers.cloudflare.com/d1/observability/metrics-analytics/)
- [Cloudflare D1 Limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Cloudflare D1 Use indexes](https://developers.cloudflare.com/d1/best-practices/use-indexes/)
- [Cloudflare D1 Global read replication](https://developers.cloudflare.com/d1/best-practices/read-replication/)
- [Cloudflare Workers Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)
- [Cloudflare D1 Migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Cloudflare D1 Import and export data](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- [Cloudflare D1 Define foreign keys](https://developers.cloudflare.com/d1/sql-api/foreign-keys/)
- [Cloudflare D1 Time Travel and backups](https://developers.cloudflare.com/d1/reference/time-travel/)
- [Cloudflare Workers storage options](https://developers.cloudflare.com/workers/platform/storage-options/)
- [Cloudflare D1 Query API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/)
