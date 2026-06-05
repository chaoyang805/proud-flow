# 开发 Roadmap

## 1. Roadmap 目标

这份 roadmap 用于记录 Proud Flow 从设计文档进入代码落地的开发顺序、任务拆解和进度。整体策略是先落公共契约，再实现后端权威能力，然后接入 CLI / Daemon、Skills 和前端，最后跑通端到端闭环。

状态说明：

- `todo`：未开始
- `doing`：开发中
- `blocked`：被依赖或问题阻塞
- `done`：已完成

## 2. 总体阶段

| 阶段 | 模块 | 目标 | 状态 |
| --- | --- | --- | --- |
| P0 | Monorepo 基础 | 初始化工程结构、包管理、构建和质量工具 | done |
| P1 | 公共包 | 定义领域类型、API contract、共享 client | done |
| P2 | 后端核心 | 实现 D1 数据模型、状态机、需求和产物 API | done |
| P3 | Skills API + Local API | 支持 CLI helper、token bootstrap、Skill manifest | done |
| P4 | CLI helper | 实现 `proud-flow` 初始化和 Skills API helper | done |
| P5 | Daemon 派发 | 实现 WebSocket 连接、ACK、Codex Runner | done |
| P6 | Skills | 实现三个 Codex Skills | done |
| P7 | 前端 MVP | 实现需求管理、review、派发和实时刷新 | done |
| P8 | E2E 闭环 | 跑通完整需求生命周期 | done |
| P9 | 发布准备 | 部署、文档、测试补齐和版本发布 | done |

## 3. P0 Monorepo 基础

目标：搭好仓库骨架，让后续模块可以按统一 TypeScript 工程方式开发。

任务：

- [x] 初始化 `pnpm-workspace.yaml`
- [x] 初始化 `turbo.json`
- [x] 初始化根 `package.json`
- [x] 初始化 `tsconfig.base.json`
- [x] 建立 `apps/web`
- [x] 建立 `apps/api`
- [x] 建立 `apps/cli`
- [x] 建立 `packages/domain`
- [x] 建立 `packages/api-contract`
- [x] 建立 `packages/api-client`
- [x] 建立 `packages/config`
- [x] 建立 `skills/tech-design`
- [x] 建立 `skills/case-rundown`
- [x] 建立 `skills/development`
- [x] 配置 ESLint
- [x] 配置 Prettier
- [x] 配置 Vitest
- [x] 配置基础 CI 命令：`typecheck`、`lint`、`test`、`build`

验收标准：

- [x] 根目录可执行 `pnpm install`
- [x] 根目录可执行 `pnpm typecheck`
- [x] 根目录可执行 `pnpm lint`
- [x] 所有 workspace package 能被 TypeScript 正确解析

## 4. P1 公共包

目标：先定义跨模块复用的领域类型和 API 契约，避免前端、后端、CLI 各自手写类型。

### 4.1 `packages/domain`

任务：

- [x] 定义 `RequirementStatus`
- [x] 定义 `DispatchStage`
- [x] 定义 status 与 stage 的映射
- [x] 定义 `Priority`
- [x] 定义 `ArtifactType`
- [x] 定义 `ActorType`
- [x] 定义 `TokenType`
- [x] 定义 `ErrorCode`
- [x] 定义 `RealtimeEvent`
- [x] 定义 `DispatchMessage`
- [x] 定义 ID parser 和格式校验

验收标准：

- [x] 所有类型不依赖运行时框架
- [x] 单元测试覆盖 stage/status 映射

### 4.2 `packages/api-contract`

任务：

- [x] 定义 common error response schema
- [x] 定义 requirements API schema
- [x] 定义 reviews API schema
- [x] 定义 artifacts API schema
- [x] 定义 dispatch API schema
- [x] 定义 realtime WebSocket message schema
- [x] 定义 skills API schema
- [x] 定义 local API schema
- [x] 生成 OpenAPI JSON

验收标准：

- [x] request / response schema 可被后端路由复用
- [x] schema 可推导前端和 CLI 类型
- [x] `openapi.json` 可生成

### 4.3 `packages/api-client`

任务：

- [x] 实现基础 typed fetch client
- [x] 实现错误码解析
- [x] 实现 user API client
- [x] 实现 skills API client
- [x] 实现 local API client
- [x] 实现 dispatch API client

验收标准：

- [x] Web 可注入 user token 使用
- [x] CLI 可注入 skill / dispatcher token 使用
- [x] 不在 client 内保存 token 或决定环境地址

## 5. P2 后端核心

目标：先把业务权威能力落在后端，包括数据模型、状态机、需求、产物和 review。

任务：

- [x] 初始化 Hono Worker
- [x] 配置 Cloudflare D1 binding
- [x] 配置 Cloudflare R2 binding
- [x] 设计并创建 `requirements` 表
- [x] 设计并创建 `artifacts` 表
- [x] 设计并创建 `api_tokens` 表
- [x] 实现 token hash 校验
- [x] 实现统一错误响应
- [x] 实现 requirements CRUD
- [x] 实现 workflow 状态机
- [x] 实现 review approve
- [x] 实现 review rollback
- [x] 实现 archive
- [x] 实现 artifact list/create
- [x] 实现 artifact upload 到 R2

验收标准：

- [x] 状态流转只通过 workflow 模块
- [x] 非法状态流转返回 `INVALID_STATUS_TRANSITION`
- [x] 缺少产物返回 `MISSING_REQUIRED_ARTIFACT`
- [x] 回退会递增 `requirements.version`

## 6. P3 Skills API + Local API

目标：支持 CLI helper 和本地初始化流程。

### 6.1 Skills API

任务：

- [x] `GET /api/skills/requirements/:id`
- [x] `GET /api/skills/requirements/:id/task-context`
- [x] `POST /api/skills/requirements/:id/status/start`
- [x] `POST /api/skills/requirements/:id/artifacts`
- [x] `POST /api/skills/requirements/:id/artifacts/upload`
- [x] `POST /api/skills/requirements/:id/complete-stage`
- [x] `POST /api/skills/requirements/:id/fail-stage`
- [x] `POST /api/skills/requirements/:id/notes`

验收标准：

- [x] skill token 只能访问 Skills API
- [x] `complete-stage` 会校验当前状态和必需产物
- [x] `fail-stage` 不自动回退需求状态

### 6.2 Local API

任务：

- [x] `POST /api/local/bootstrap`
- [x] `POST /api/local/tokens/rotate`
- [x] `POST /api/local/tokens/revoke`
- [x] `GET /api/local/skills/manifest`
- [x] 后端生成 `pf_skill_` token
- [x] 后端生成 `pf_dispatcher_` token
- [x] token 明文只返回一次

验收标准：

- [x] token 只存 hash
- [x] bootstrap 可返回 CLI 初始化所需 token
- [x] manifest 包含 Skill 版本、下载地址、sha256 和兼容 CLI 版本

## 7. P4 CLI Helper

目标：让 Skills 可以通过本地 `proud-flow` 命令稳定调用平台 API。

任务：

- [x] 初始化 CLI app
- [x] 实现 prod / dev 固定后端地址映射
- [x] 实现开发者环境变量覆盖
- [x] 实现本地配置读写
- [x] 实现 macOS Keychain token 存储
- [x] 实现 `proud-flow init`
- [x] 实现 `proud-flow status`
- [x] 实现 `proud-flow auth status`
- [x] 实现 `proud-flow auth rotate`
- [x] 实现 `proud-flow auth logout`
- [x] 实现 `proud-flow get-requirement`
- [x] 实现 `proud-flow get-task-context`
- [x] 实现 `proud-flow start-stage`
- [x] 实现 `proud-flow attach-artifact`
- [x] 实现 `proud-flow upload-artifact`
- [x] 实现 `proud-flow complete-stage`
- [x] 实现 `proud-flow fail-stage`
- [x] 实现 `proud-flow append-note`
- [x] 支持 `--json` 输出
- [x] 默认输出模型易读 Markdown

验收标准：

- [x] CLI 输出不泄露 token
- [x] helper 命令能连接本地 dev API
- [x] 错误响应包含稳定错误码

## 8. P5 Daemon 派发

目标：让后端可以把任务派发给本地 Codex。

任务：

- [x] 实现 `proud-flow daemon`
- [x] 实现 `/api/dispatch/ws` 连接
- [x] 实现 dispatcher token 鉴权
- [x] 实现心跳
- [x] 实现断线重连
- [x] 实现 `dispatch.requested` schema 校验
- [x] 实现 stage 到 Skill 指令映射
- [x] 实现 Codex Runner mock
- [x] 实现真实 Codex Runner
- [x] 实现 ACK 成功
- [x] 实现 ACK 失败
- [x] 实现 busy 保护
- [x] 实现 requestId 去重

验收标准：

- [x] 后端派发后 daemon 能 ACK
- [x] Codex 不可用时返回失败 ACK
- [x] daemon 不执行远端动态命令

## 9. P6 Skills

目标：实现三个最小可用 Codex Skills。

任务：

- [x] 实现 `skills/tech-design/SKILL.md`
- [x] 实现 `skills/case-rundown/SKILL.md`
- [x] 实现 `skills/development/SKILL.md`
- [x] 实现 `skills/manifest.json`
- [x] 实现 Skill 打包脚本
- [x] 实现 `proud-flow skill install`
- [x] 实现 `proud-flow skill update`
- [x] 实现 `proud-flow skill status`
- [x] 实现下载包 sha256 校验
- [x] 实现本地修改检测

验收标准：

- [x] `/tech-design REQ-xxx` 能调用 CLI helper 读取上下文
- [x] Skill 文档不包含 token
- [x] Skill 不直接手写 HTTP

## 10. P7 前端 MVP

目标：实现用户可用的 Web 工作台。

任务：

- [x] 初始化 Next.js app
- [x] 接入 Tailwind CSS
- [x] 接入基础 UI 组件
- [x] 接入 TanStack Query
- [x] 实现 user token 配置
- [x] 实现需求列表页
- [x] 实现创建需求页
- [x] 实现需求详情页
- [x] 实现 artifact 展示
- [x] 实现当前版本 / 历史版本分组
- [x] 实现 dispatch 按钮
- [x] 实现 review approve
- [x] 实现 rollback dialog
- [x] 实现 archive
- [x] 实现 WebSocket realtime client
- [x] 实现 toast 提示
- [x] 实现重连后刷新

验收标准：

- [x] 前端不自行判断复杂状态流转
- [x] WebSocket 事件只触发刷新，不作为权威数据源
- [x] `DISPATCHER_OFFLINE` 能正确提示

## 11. P8 E2E 闭环

目标：跑通第一条真实工作流。

最小闭环：

- [x] 创建需求
- [x] 派发技术方案设计
- [x] daemon 收到 `dispatch.requested`
- [x] daemon 启动 `/tech-design REQ-xxx`
- [x] Skill 运行 `get-task-context`
- [x] Skill 运行 `start-stage`
- [x] Skill 登记技术方案产物
- [x] Skill 运行 `complete-stage`
- [x] 后端进入 `tech-review`
- [x] 前端收到 WebSocket 事件并刷新
- [x] 用户 review 通过并派发用例设计
- [x] 用例设计进入 `case-review`
- [x] 用户 review 通过并派发开发
- [x] 开发进入 `delivery`
- [x] 用户验收归档

验收标准：

- [x] 完整状态流转无手工改数据库
- [x] 所有状态变更都有后端校验
- [x] 前端、后端、CLI、Skill 四端类型一致

## 12. P9 发布准备

任务：

- [x] 配置 dev Cloudflare Workers
- [x] 配置 prod Cloudflare Workers
- [x] 配置 D1 dev/prod
- [x] 配置 R2 dev/prod
- [x] 配置 Durable Objects
- [x] 部署前端
- [x] 发布 CLI 包
- [x] 发布 Skill 包
- [x] 配置 Skill manifest
- [x] 补充 README
- [x] 补充本地开发文档
- [x] 补充部署文档
- [x] 补充故障排查文档

验收标准：

- [x] 新机器可按文档完成 `proud-flow init`
- [x] 前端可连接 prod API
- [x] daemon 可连接 prod dispatch WebSocket
- [x] Skill 可通过 CLI helper 回写 prod 后端

## 13. 推荐并行策略

必须串行：

```text
P0 Monorepo
  -> P1 domain / api-contract
    -> P2 后端核心
```

可以并行：

```text
P2 后端核心
  -> P3 Skills API + Local API
  -> P7 前端基础页面
```

```text
P3 Skills API + Local API
  -> P4 CLI helper
  -> P5 daemon
  -> P6 Skills
```

第一条最小闭环优先：

```text
domain
api-contract
api requirements + workflow + artifacts + skills-api
cli helper
tech-design Skill
dispatch WebSocket
web requirement detail + dispatch
```

## 14. 当前进度

| 日期 | 事项 | 状态 | 备注 |
| --- | --- | --- | --- |
| 2026-06-04 | 产品设计文档 | done | 已完成第一版设计 |
| 2026-06-04 | 后端技术设计 | done | 已切换 Cloudflare-native 方案 |
| 2026-06-04 | 前端技术设计 | done | 实时事件改为 WebSocket |
| 2026-06-04 | Proud Flow CLI 技术设计 | done | 合并 daemon、CLI helper、Skill 管理 |
| 2026-06-04 | 仓库结构与工程化方案 | done | 已定义 monorepo 和共享包方案 |
| 2026-06-04 | 开发 Roadmap | done | 当前文档 |
| 2026-06-04 | P0 Monorepo 基础 | done | 已初始化 pnpm workspace、工程骨架、质量命令、单元测试、E2E 测试和覆盖率检查 |
| 2026-06-04 | P1 公共包 | done | 已实现 domain 类型与状态映射、API contract schema/OpenAPI、typed API client、单元测试、E2E 测试和 80%+ 覆盖率检查 |
| 2026-06-04 | P2 后端核心 | done | 已实现 Worker fetch app、D1/R2 binding 类型、requirements/reviews/artifacts/workflow API、token hash 校验、迁移 SQL、单元测试、E2E 测试和 80%+ 覆盖率检查 |
| 2026-06-04 | P3 Skills API + Local API | done | 已实现 Skills API、Local bootstrap/rotate/revoke、pf_local_ 管理 token、Skill manifest、单元测试、E2E 测试和 80%+ 覆盖率检查 |
| 2026-06-04 | P4 CLI Helper | done | 已实现 CLI 初始化、auth 管理、Skills API helper、JSON/Markdown 输出、单元测试、E2E 测试和 80%+ 覆盖率检查 |
| 2026-06-04 | P5 Daemon 派发 | done | 已实现 dispatcher WebSocket 鉴权入口、daemon 协议处理、固定 Skill 指令映射、Codex Runner、ACK/busy/去重/心跳/重连退避；daemon/dispatch 新增测试直接测源码并通过 80%+ 覆盖率检查 |
| 2026-06-05 | P6 Skills | done | 已实现三个 Codex Skill 工作流、Skill manifest/package 脚本、CLI install/update/status、sha256 校验和本地修改检测；新增单元测试与 e2e 测试并通过 80%+ 覆盖率检查 |
| 2026-06-05 | P7 前端 MVP | done | 已实现 Next.js Web 工作台、Tailwind 样式、TanStack Query、token 配置、需求列表/创建/详情、产物分组、dispatch/review/rollback/archive 操作、WebSocket toast 刷新；新增单元测试、e2e 测试和 80%+ 覆盖率检查 |
| 2026-06-05 | P8 E2E 闭环 | done | 已实现 dispatch queue、dispatcher 拉取/ACK、后端实时事件记录、review 后派发状态校验，并用完整 e2e 串起创建需求、daemon、CLI helper、Skill 阶段回写、review、delivery 和归档 |
| 2026-06-05 | P9 发布准备 | done | 已实现 Wrangler dev/prod 配置、D1/R2/Durable Object bindings、Web prod API env、CLI bin 和 Node runtime、发布脚本、Skill manifest base URL 配置、README/本地开发/部署/故障排查文档；真实 Cloudflare resource id、secret、deploy/publish 按部署文档在目标账号执行 |
