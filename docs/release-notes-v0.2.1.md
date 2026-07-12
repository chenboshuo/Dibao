# Dibao v0.2.1 Release Notes

Dibao v0.2.1 is a patch release for the 0.2 line. It focuses on release reliability, Docker background jobs, plugin stability, mobile reader correctness, feed-management polish, and several provider/runtime fixes merged from the 0.1 maintenance line.

Release date: 2026-07-12

## 简体中文

v0.2.1 是 0.2 插件版本线的补丁发布。重点是让 Docker / 群晖这类长期运行实例更稳：后台 worker 会更可靠地处理 HTTP 进程入队的推荐与 Embedding 任务，官方插件遇到瞬时 runtime 错误时不再被误禁用，移动端返回列表也避免了不必要的列表重载。

### 主要变化

- 修复 Docker split-process 模式下后台 worker 可能看不到新入队 `embedding_generate` 任务的问题。Docker Compose 默认使用 `DIBAO_SQLITE_JOURNAL_MODE=DELETE`，避开 bind mount + SQLite WAL 在多进程场景下的可见性风险。
- worker 增加后台任务兜底心跳，job runner 启动后会立即处理 due jobs，并在单轮达到上限时自动补跑下一轮，避免启动期维护任务挤占后续任务。
- 增加跨进程 job wake signal，HTTP 进程入队后台任务后可以唤醒 worker。
- 官方插件遇到瞬时 hook/runtime 错误时保持 enabled，并通过 runtime 状态暴露 degraded 信息，避免自动 Disable。
- 移动端文章详情返回未读列表时，忽略 `limit=1` 未读计数探测，不再把它误判为完整列表 refetch。
- 文章详情和订阅源管理界面的 0.2.1 UI 收口：Feed 来源说明与操作按钮对齐，添加订阅源按钮行垂直居中。
- 合入 v0.1.3 维护线修复：Gemini OpenAI-compatible provider 会请求配置的 embedding dimensions，Ollama 长上下文处理更稳，文章发布日期显示年份，源过滤状态更清晰。

### 升级影响

从 v0.2.0 升级到 v0.2.1 没有新增 core SQLite schema migration。保留同一个 `/data` volume 并替换镜像即可。升级前仍建议备份 `/data/dibao.sqlite` 或整个 Docker volume。

如果你使用自定义 Compose 文件，建议加入：

```yaml
environment:
  DIBAO_SQLITE_JOURNAL_MODE: DELETE
```

官方 `compose.yaml` 已包含这个默认值。升级后检查：

```text
GET /api/system/health
```

返回 `ok: true` 和 `version: "0.2.1"` 即表示基础健康检查通过。

### Docker 安装与升级

推荐镜像：

```yaml
image: ghcr.io/pls-1q43/dibao:v0.2.1
```

默认 Docker 入口会启动 HTTP 进程和独立 worker 进程。若需要关闭后台 worker，可设置：

```yaml
environment:
  DIBAO_BACKGROUND_JOBS: "false"
```

如需回滚，请先停止 v0.2.1 容器，用升级前备份恢复 SQLite 数据库和 `/data` volume，再启动上一版镜像。

### Migration List

从 v0.2.0 到 v0.2.1：无新增 core SQLite migrations。应用启动时仍会正常检查已发布 migration 是否完整且 checksum 未漂移。

### Sentry 发布校验

正式 Docker 镜像使用 BuildKit secret `dibao_sentry_config` 注入私有 Sentry 配置。发布验证只报告 `hasDsn`、`hasOrg`、`hasProject` 等布尔结果，不公开 DSN、org、project 或 token。

### 已知限制

- 第三方服务端插件仍是可信本地代码，不是任意恶意代码沙箱。
- v0.2.x 的部分插件 Host API 仍处于 Beta；长期插件应优先使用 Stable API。

## English

v0.2.1 is a patch release for the 0.2 plugin line. It improves long-running Docker and NAS deployments by making background job processing more reliable, keeping official plugins enabled through transient runtime failures, and tightening mobile reader behavior.

### Highlights

- Fixed Docker split-process deployments where the worker could miss newly queued `embedding_generate` jobs from the HTTP process. Docker Compose now defaults to `DIBAO_SQLITE_JOURNAL_MODE=DELETE` to avoid bind-mount SQLite WAL visibility issues across processes.
- Added worker-side background-job heartbeat, immediate due-job draining on runner startup, and follow-up drains when a pass hits its job limit.
- Added a cross-process job wake signal so HTTP enqueue paths can wake the worker.
- Official plugins now remain enabled during transient hook/runtime failures and expose degraded runtime state instead of being automatically disabled.
- Mobile article-detail back navigation no longer treats the `limit=1` unread-count probe as a full list refetch.
- Polished the article-detail source/action row and vertical alignment in the feed-management add-feed controls.
- Merged v0.1.3 maintenance fixes, including Gemini OpenAI-compatible embedding dimensions, stronger Ollama context handling, publication years in article metadata, and clearer active source-filter state.

### Upgrade Impact

There are no new core SQLite schema migrations from v0.2.0 to v0.2.1. Keep the same `/data` volume and replace the image. Back up `/data/dibao.sqlite` or the whole Docker volume before upgrading.

If you maintain a custom Compose file, add:

```yaml
environment:
  DIBAO_SQLITE_JOURNAL_MODE: DELETE
```

The repository `compose.yaml` already includes this default. After upgrading, verify:

```text
GET /api/system/health
```

The response should include `ok: true` and `version: "0.2.1"`.

### Docker Install And Upgrade

Recommended image:

```yaml
image: ghcr.io/pls-1q43/dibao:v0.2.1
```

The default Docker entrypoint starts both HTTP and a separate worker process. To disable the worker:

```yaml
environment:
  DIBAO_BACKGROUND_JOBS: "false"
```

To roll back, stop the v0.2.1 container, restore the pre-upgrade SQLite database and `/data` volume backup, then start the previous image.

### Migration List

From v0.2.0 to v0.2.1: no new core SQLite migrations. Startup still checks that all shipped migrations are complete and unchanged.

### Sentry Release Verification

The formal Docker image is built with the private Sentry config injected through the BuildKit secret `dibao_sentry_config`. Verification reports only booleans such as `hasDsn`, `hasOrg`, and `hasProject`; it does not expose DSN, org, project, or tokens.

### Known Limitations

- Third-party server plugins are trusted local code, not an arbitrary malicious-code sandbox.
- Some v0.2.x Host APIs remain Beta; long-lived plugins should prefer Stable APIs.

## 日本語

v0.2.1 は 0.2 プラグインラインのパッチリリースです。Docker や NAS で長時間動かす環境で、バックグラウンドジョブ、公式プラグイン、モバイルリーダーの安定性を高めました。

### 主な変更

- Docker の split-process 構成で、HTTP プロセスが追加した `embedding_generate` ジョブを worker が見逃すことがある問題を修正しました。Docker Compose では `DIBAO_SQLITE_JOURNAL_MODE=DELETE` を既定にし、bind mount と SQLite WAL の多プロセス可視性リスクを避けます。
- worker にバックグラウンドジョブ用の heartbeat を追加しました。job runner は起動直後に due jobs を処理し、1 回の処理上限に達した場合は続けて次の drain を行います。
- HTTP プロセスから worker を起こす cross-process job wake signal を追加しました。
- 公式プラグインは一時的な hook/runtime エラーで自動 Disable されず、degraded 状態として表示されます。
- モバイルで記事詳細から未読リストへ戻るとき、`limit=1` の未読件数 probe を完全なリスト再取得として扱わないようにしました。
- 記事詳細の Feed 由来表示と操作ボタン、購読源管理の追加ボタン行の見た目を整えました。
- v0.1.3 メンテナンス修正を取り込みました。Gemini OpenAI-compatible provider の dimensions 指定、Ollama 長文コンテキスト処理、記事メタデータの年表示、ソースフィルター表示が含まれます。

### アップグレード影響

v0.2.0 から v0.2.1 への追加 core SQLite schema migration はありません。同じ `/data` volume を使い、image tag を差し替えてください。アップグレード前に `/data/dibao.sqlite` または Docker volume 全体をバックアップすることを推奨します。

独自の Compose ファイルを使っている場合は、次を追加してください。

```yaml
environment:
  DIBAO_SQLITE_JOURNAL_MODE: DELETE
```

リポジトリの `compose.yaml` には既に含まれています。アップグレード後、次を確認してください。

```text
GET /api/system/health
```

レスポンスに `ok: true` と `version: "0.2.1"` が含まれていれば基本確認は通っています。

### Docker インストール / アップグレード

推奨 image:

```yaml
image: ghcr.io/pls-1q43/dibao:v0.2.1
```

既定の Docker entrypoint は HTTP プロセスと独立 worker プロセスを起動します。worker を無効化する場合:

```yaml
environment:
  DIBAO_BACKGROUND_JOBS: "false"
```

ロールバックする場合は v0.2.1 コンテナを停止し、アップグレード前の SQLite データベースと `/data` volume バックアップを復元してから、前の image を起動してください。

### Migration List

v0.2.0 から v0.2.1: 新しい core SQLite migrations はありません。起動時には、既存 migrations が適用済みで checksum が変わっていないことを引き続き確認します。

### Sentry リリース検証

正式 Docker image は BuildKit secret `dibao_sentry_config` で private Sentry 設定を注入してビルドします。検証結果は `hasDsn`、`hasOrg`、`hasProject` などの boolean のみを報告し、DSN、org、project、token は公開しません。

### 既知の制限

- サードパーティのサーバープラグインは信頼済みローカルコードであり、任意の悪意あるコードを隔離する sandbox ではありません。
- v0.2.x の一部 Host API は Beta です。長期運用するプラグインでは Stable API を優先してください。
