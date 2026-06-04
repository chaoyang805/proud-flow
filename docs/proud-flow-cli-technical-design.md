# Proud Flow Local CLI / Daemon 技术设计

## 1. 设计目标

Proud Flow Local CLI / Daemon 是本地 Codex 执行环境的统一入口。它既承担任务派发 daemon 的职责，也承担初始化、token 管理、Skill 安装更新，以及 Skills 调用平台 API 的 helper 职责。

核心原则：

- 用户只安装和配置一个本地工具：`proud-flow`。
- 用户不配置 `backendUrl`，CLI 按 prod 或 dev 环境选择固定后端地址。
- daemon 负责连接后端 WebSocket、接收派发请求、启动 Codex 并回传 ACK。
- CLI helper 负责给 Skills 稳定调用后端 Skills API。
- CLI 管理本地 token，但不在日志和命令输出中泄露 token。
- Skill 安装和更新由 CLI 统一完成。
- 复杂 prompt、阶段说明和产物要求仍放在 Skill 中，不放在 daemon 派发逻辑里。

## 2. 推荐技术栈

第一版推荐：

- 运行方式：本地 Node.js CLI + daemon。
- 语言：TypeScript。
- CLI 框架：Commander 或 Clipanion。
- 通信：WebSocket 主动连接后端 `/api/dispatch/ws`。
- 后端 API：HTTP REST 调用 `/api/skills/*`、`/api/local/*`。
- Codex 调用：优先调用本地 Codex CLI 或 Codex 桌面可用入口。
- 本地配置：系统用户目录下的配置文件，权限限制为当前用户读写。
- 日志：结构化 stdout + 本地滚动日志。

选择原因：

- TypeScript 与前端、后端和 Skills helper 技术栈一致。
- 本地 CLI 便于访问本地仓库、Git 凭据、Codex 环境和 Codex Skill 目录。
- WebSocket 能让云端在用户点击派发后实时下发任务。
- 一个工具覆盖 daemon、helper、初始化和 Skill 管理，降低用户使用成本。

## 3. 后端环境选择

用户不需要也不应该配置 `backendUrl`。

环境选择规则：

- prod 构建默认访问生产后端固定地址。
- dev 构建默认访问开发后端固定地址。
- 本地开发调试可以通过开发者环境变量覆盖，例如 `PROUD_FLOW_API_BASE_URL`，但该能力不作为普通用户配置项暴露。
- `proud-flow status` 需要展示当前环境名和目标后端，但不允许普通用户在交互式初始化中修改。

示例：

```text
proud-flow status

Environment: prod
API: https://api.proud-flow.example
Daemon: connected
Skills: up to date
```

## 4. 模块边界

```text
local-cli
  commands
    daemon                 常驻派发进程
    init                   初始化和绑定平台
    auth                   token 状态、轮换、登出
    skill                  Skill 安装、更新、状态检查
    api-helper             Skills 调用平台 API 的命令
  config
    environment            prod / dev 固定后端地址选择
    local-store            本地配置和 token 存储
  dispatcher
    websocket              后端连接与重连
    protocol               消息 schema
    stage-router           stage 到 Skill 指令映射
    codex-runner           Codex 调用适配
  skills
    installer              安装 Skill 到 Codex Skill 目录
    updater                manifest 对比与下载校验
  logging
```

daemon 职责：

- 使用 dispatcher token 连接后端 WebSocket。
- 维持连接、心跳和自动重连。
- 接收 `dispatch.requested` 消息。
- 根据 `stage` 映射本地 Skill/slash command。
- 调用本地 Codex 执行极简指令。
- 回传 `dispatch.acked`。
- 记录本地派发日志。

CLI helper 职责：

- 使用 skill token 调用后端 Skills API。
- 给 Skills 提供稳定命令，例如 `get-task-context`、`attach-artifact`、`complete-stage`。
- 输出模型易读的 Markdown 或 JSON。

初始化和 token 管理职责：

- 执行本地环境检查。
- 绑定平台并领取 dispatcher token 和 skill token。
- 本地保存、检查、轮换和删除 token。
- 不管理前端 user token。

Skill 管理职责：

- 安装平台内置 Skills。
- 检查 Skill 版本。
- 从固定环境的 manifest 下载并更新 Skill。
- 校验 Skill 包 hash。

Local CLI / Daemon 不负责：

- 不判断人工 review 是否通过。
- 不直接推进需求状态，状态变更只能通过 Skills API 触发后端状态机。
- 不直接拼接复杂 prompt。
- 不直接创建 PR。
- 不保存完整 AI 任务历史。
- 不执行远端动态命令。

## 5. 命令设计

初始化和状态：

```text
proud-flow init
proud-flow status
proud-flow auth status
proud-flow auth rotate
proud-flow auth logout
```

daemon：

```text
proud-flow daemon
```

Skill 管理：

```text
proud-flow skill install
proud-flow skill update
proud-flow skill status
proud-flow skill uninstall
```

Skills API helper：

```text
proud-flow get-requirement REQ-000123
proud-flow get-task-context REQ-000123 --stage tech_design
proud-flow start-stage REQ-000123 --stage tech_design
proud-flow attach-artifact REQ-000123 --type tech_design_pr --title "技术方案 PR" --url https://...
proud-flow upload-artifact REQ-000123 --type screenshot --file ./screen.png --title "验收截图"
proud-flow complete-stage REQ-000123 --stage tech_design --summary "..."
proud-flow fail-stage REQ-000123 --stage development --message "..."
proud-flow append-note REQ-000123 --message "..."
```

## 6. 本地配置与 token 存储

本地配置只保存用户机器相关信息，不保存后端地址。

配置示例：

```json
{
  "environment": "prod",
  "workspacePath": "/Users/me/projects/app",
  "tokens": {
    "skill": "pf_skill_xxx",
    "dispatcher": "pf_dispatcher_xxx"
  },
  "stageCommands": {
    "tech_design": "/tech-design {{requirementId}}",
    "case_rundown": "/case-rundown {{requirementId}}",
    "development": "/develop {{requirementId}}"
  },
  "skills": {
    "installedVersion": "0.1.0"
  }
}
```

存储规则：

- macOS 优先使用 Keychain 保存 token；配置文件只保存非敏感设置。
- 如果暂不接入 Keychain，配置文件权限必须限制为当前用户读写。
- 日志和命令输出不打印 token 明文。
- token 轮换后旧 token 立即失效。

token 类型：

- `dispatcher token`：只允许连接 `/api/dispatch/ws` 并回传 ACK。
- `skill token`：只允许访问 `/api/skills/*`。

## 7. 初始化与 token 管理

`proud-flow init` 流程：

1. 检查当前 CLI 环境是 prod 还是 dev。
2. 检查 Codex 是否可用。
3. 检查 workspacePath 是否存在。
4. 与后端建立绑定流程。
5. 获取 dispatcher token 和 skill token。
6. 安装或更新内置 Skills。
7. 输出本地状态摘要。

token 生成建议：

- token 由后端生成，CLI 不自行生成权威 token。
- token 明文只在绑定响应中返回一次。
- 后端只保存 token hash。
- token 使用类型前缀，例如 `pf_skill_`、`pf_dispatcher_`。

后端绑定接口建议：

```text
POST /api/local/bootstrap
POST /api/local/tokens/rotate
POST /api/local/tokens/revoke
```

MVP 可以先用本地个人初始化密钥或一次性绑定码调用 `bootstrap`。团队版后续升级为网页登录授权或设备码授权。

## 8. WebSocket 派发协议

连接地址：

```text
GET /api/dispatch/ws
```

鉴权：

```text
Authorization: Bearer <dispatcher_token>
```

后端下发：

```json
{
  "type": "dispatch.requested",
  "requestId": "dispatch_req_123",
  "requirementId": "REQ-000123",
  "stage": "tech_design"
}
```

daemon ACK：

```json
{
  "type": "dispatch.acked",
  "requestId": "dispatch_req_123",
  "success": true
}
```

失败 ACK：

```json
{
  "type": "dispatch.acked",
  "requestId": "dispatch_req_123",
  "success": false,
  "errorMessage": "Codex 未连接"
}
```

心跳建议：

```json
{
  "type": "dispatcher.ping",
  "timestamp": "2026-06-04T10:00:00.000Z"
}
```

```json
{
  "type": "dispatcher.pong",
  "timestamp": "2026-06-04T10:00:00.000Z"
}
```

## 9. Stage 到命令映射

第一版建议固定映射：

| stage | Codex 指令 |
| --- | --- |
| `tech_design` | `/tech-design {{requirementId}}` |
| `case_rundown` | `/case-rundown {{requirementId}}` |
| `development` | `/develop {{requirementId}}` |

映射规则：

- 只允许白名单 stage。
- 未知 stage 返回失败 ACK。
- 指令中只包含 slash command 和需求编号。
- 复杂上下文由对应 Skill 通过 `proud-flow` CLI helper 读取。
- stage command 可以内置默认值；MVP 不提供远端动态命令下发。

## 10. Codex Runner 设计

Codex Runner 是 daemon 内唯一与本地 Codex 交互的适配层。

职责：

- 检查 Codex 是否可用。
- 在指定 workspace 中启动 Codex 指令。
- 捕获启动失败。
- 返回同步派发结果。

第一版 ACK 语义：

- 成功：Codex 进程或会话已启动并接收指令。
- 失败：Codex CLI 不存在、workspace 不存在、权限错误、命令启动失败。
- 不等待 Codex 完成整个需求。

可选实现方式：

- 调用本地 Codex CLI。
- 调用 Codex 桌面暴露的本地控制接口。
- 后续封装成多 runner 适配器。

## 11. Skill 安装和更新

Skill 包由 CLI 从固定环境的 manifest 获取。

manifest 获取：

```text
GET /api/local/skills/manifest
```

manifest 示例：

```json
{
  "version": "0.1.0",
  "cliVersionRange": ">=0.1.0",
  "skills": [
    {
      "name": "tech-design",
      "version": "0.1.0",
      "downloadUrl": "https://static.proud-flow.example/skills/tech-design-0.1.0.tgz",
      "sha256": "..."
    }
  ]
}
```

安装规则：

- CLI 自动探测 Codex Skill 目录。
- 下载后校验 sha256。
- 安装前备份同名旧版本。
- 检测到本地修改时，提示用户确认覆盖或跳过。
- `skill status` 展示本地版本、远端版本和兼容性。

daemon 启动策略：

- daemon 启动时检查 Skill 是否安装。
- Skill 缺失时提示运行 `proud-flow skill install`。
- Skill 版本过旧时提示更新，但不强制更新。

## 12. Skill 设计

Skill 是 Codex 看到的阶段工作流说明，负责复杂 prompt、阶段目标、产物要求和执行自检。Skill 不直接持有 token，也不直接手写 HTTP；所有平台接口调用都通过本地 `proud-flow` CLI helper 完成。

### 12.1 通用执行约束

所有阶段 Skill 都遵守以下约束：

- 先运行 `proud-flow get-task-context` 读取需求、当前状态、需求版本、历史产物和回退原因。
- 再运行 `proud-flow start-stage` 请求进入对应 AI 工作状态。
- 产物完成后通过 `proud-flow attach-artifact` 或 `proud-flow upload-artifact` 登记。
- 阶段完成时运行 `proud-flow complete-stage`，由后端校验必需产物并推进状态。
- 执行失败时运行 `proud-flow fail-stage` 上报失败摘要。
- 完成前重新读取一次需求，确认状态和版本仍然匹配。

### 12.2 技术方案设计 Skill

入口示例：

```text
/tech-design REQ-000123
```

流程：

1. 运行 `proud-flow get-task-context REQ-000123 --stage tech_design`。
2. 运行 `proud-flow start-stage REQ-000123 --stage tech_design`。
3. 阅读目标代码仓库、已有设计文档和历史产物。
4. 产出技术方案文档或 PR。
5. 运行 `proud-flow attach-artifact REQ-000123 --type tech_design_pr ...` 或登记 `document`。
6. 运行 `proud-flow complete-stage REQ-000123 --stage tech_design --summary "..."`。

产物要求：

- 技术目标和非目标。
- 模块拆分。
- 数据模型或接口变化。
- 状态流转影响。
- 测试策略。
- 风险和回滚方案。

### 12.3 测试用例设计 Skill

入口示例：

```text
/case-rundown REQ-000123
```

流程：

1. 运行 `proud-flow get-task-context REQ-000123 --stage case_rundown`。
2. 运行 `proud-flow start-stage REQ-000123 --stage case_rundown`。
3. 读取需求、技术方案产物和 review 意见。
4. 设计测试范围、测试用例和验收标准。
5. 登记 `case_pr` 或 `document`。
6. 运行 `proud-flow complete-stage REQ-000123 --stage case_rundown --summary "..."`。

产物要求：

- 核心流程用例。
- 边界条件。
- 权限和异常用例。
- 回归风险点。
- 自动化测试建议。

### 12.4 开发交付 Skill

入口示例：

```text
/develop REQ-000123
```

流程：

1. 运行 `proud-flow get-task-context REQ-000123 --stage development`。
2. 运行 `proud-flow start-stage REQ-000123 --stage development`。
3. 读取需求、技术方案、用例设计和 review 意见。
4. 创建或切换工作分支。
5. 实现代码并运行必要测试。
6. 创建开发 PR。
7. 上传测试报告和必要截图。
8. 登记 `code_pr`、`test_report`、`screenshot` 等产物。
9. 运行 `proud-flow complete-stage REQ-000123 --stage development --summary "..."`。

产物要求：

- 开发 PR。
- 测试报告。
- 用户可验收的截图或说明。
- 已知限制和后续建议。

## 13. Skills API Helper 语义

CLI helper 是 Skill 调用平台接口的稳定入口。它读取本地 skill token，按固定环境选择后端地址，并调用后端 `/api/skills/*` 接口。

### 13.1 get-task-context

用途：读取 Skill 执行所需的完整上下文。

命令：

```text
proud-flow get-task-context REQ-000123 --stage tech_design
```

出参包含：

- 需求当前快照。
- 当前阶段目标。
- 可用历史产物。
- 当前版本产物。
- 回退原因或人工说明。
- 必需提交产物类型。
- 后端允许的下一步操作提示。

### 13.2 start-stage

用途：Skill 开始执行时请求后端进入对应 AI 工作状态。

命令：

```text
proud-flow start-stage REQ-000123 --stage tech_design
```

关键语义：

- `tech_design` 从 `planning` 进入 `tech-design`。
- `case_rundown` 从 review 通过后的状态进入 `case-rundown`。
- `development` 从 review 通过后的状态进入 `developing`。
- 状态不匹配时后端返回 `INVALID_STATUS_TRANSITION`。

### 13.3 attach-artifact / upload-artifact

用途：登记 PR、文档、测试报告、截图等产物。

命令：

```text
proud-flow attach-artifact REQ-000123 --type tech_design_pr --title "技术方案 PR" --url https://...
proud-flow upload-artifact REQ-000123 --type screenshot --file ./screen.png --title "验收截图"
```

关键语义：

- `attach-artifact` 登记已有 URL。
- `upload-artifact` 上传本地文件到对象存储后登记 artifact。
- artifact 自动绑定当前 `requirement.version`。

### 13.4 complete-stage

用途：AI 阶段完成后触发后端校验必需产物，并流转到 review 或 delivery。

命令：

```text
proud-flow complete-stage REQ-000123 --stage tech_design --summary "..."
```

关键语义：

- `tech_design` 完成后进入 `tech-review`。
- `case_rundown` 完成后进入 `case-review`。
- `development` 完成后进入 `delivery`。
- 后端会检查必需产物是否齐全。

### 13.5 fail-stage

用途：AI 阶段失败后上报失败摘要。

命令：

```text
proud-flow fail-stage REQ-000123 --stage development --message "测试命令失败"
```

关键语义：

- 失败不会自动回退需求状态。
- 后端通过 WebSocket 通知前端。
- 用户后续可调整需求、修复环境或重新派发。

## 14. 一致性与幂等

需要防止：

- Skill 重复提交同一阶段完成。
- 回退后旧 Skill 继续回写。
- 产物上传成功但阶段完成失败。
- 本地网络抖动导致重复登记产物。
- 重复派发导致同一 `requestId` 被处理多次。

建议策略：

- `start-stage` 和 `complete-stage` 都校验当前状态。
- `complete-stage` 校验当前需求 `version` 与 Skill 读取上下文时一致。
- `attach-artifact` 支持可选 `idempotencyKey`。
- 同一 `requirementId + version + type + url` 可视为重复产物。
- Skill 在完成前重新读取一次 `get-requirement`，确认状态仍匹配。
- 后端返回 `INVALID_STATUS_TRANSITION` 时，Skill 停止回写并输出原因。

## 15. 连接、并发与重复派发

连接策略：

- 启动后立即连接 `/api/dispatch/ws`。
- 连接断开后指数退避重连。
- 重连间隔建议从 1 秒开始，最大 30 秒。
- token 失效时停止重连并提示用户。
- 每 20 到 30 秒发送心跳，避免连接静默断开。

并发策略：

- MVP 推荐单执行器串行派发。
- 同一时间只启动一个 Codex 指令。
- 如果收到新派发请求时已有本地运行中任务，第一版返回失败 ACK，提示用户稍后重试。

重复派发处理：

- 以 `requestId` 做短时去重。
- 最近处理过的 `requestId` 保存在内存 LRU 中。
- 重复 request 返回上一次 ACK 结果。

## 16. 错误处理

错误码建议：

- `LOCAL_CONFIG_INVALID`：本地配置错误。
- `UNKNOWN_STAGE`：未知 stage。
- `WORKSPACE_NOT_FOUND`：本地 workspace 不存在。
- `CODEX_NOT_CONNECTED`：Codex 不可用。
- `CODEX_START_FAILED`：Codex 启动失败。
- `DISPATCHER_BUSY`：本地执行器忙。
- `AUTH_FAILED`：token 无效。
- `SKILL_NOT_INSTALLED`：Skill 未安装。
- `SKILL_UPDATE_FAILED`：Skill 更新失败。

处理策略：

- 可恢复连接错误自动重连。
- 配置错误直接退出并输出修复提示。
- 单次派发错误返回失败 ACK。
- Skills API helper 失败时返回结构化错误给 Codex。
- 本地日志必须包含 `requestId`、`requirementId`、`stage` 和错误码。

CLI helper 对 Codex 返回结构化错误：

```json
{
  "ok": false,
  "code": "INVALID_STATUS_TRANSITION",
  "message": "当前状态不允许完成 development 阶段",
  "recoverable": false
}
```

处理建议：

- `INVALID_STATUS_TRANSITION`：停止执行，提示需求状态已变化。
- `MISSING_REQUIRED_ARTIFACT`：补交缺失产物后重试完成。
- `PERMISSION_DENIED`：检查本地 `skill token`。
- `VALIDATION_ERROR`：修正命令参数。
- 网络错误：短暂重试，仍失败则运行 `fail-stage` 或在最终说明中报告。

## 17. 安全设计

安全约束：

- dispatcher token 只允许访问 `/api/dispatch/ws`。
- skill token 只允许访问 `/api/skills/*`。
- 后端地址由环境固定，不接受远端消息或普通用户配置覆盖。
- stage command 必须来自白名单配置，不能直接执行后端传来的任意命令。
- requirementId 只作为参数传入 Skill，必须做格式校验。
- 本地 workspacePath 必须显式配置，不从远端消息动态指定。
- Skill 包下载后必须校验 hash。
- 日志中不打印 token。

## 18. 测试策略

单元测试：

- 环境到固定后端地址映射。
- 本地 token 读取和权限错误处理。
- WebSocket 消息 schema 校验。
- stage 到命令映射。
- requestId 去重。
- Codex Runner 成功和失败结果映射。
- Skill manifest 版本比较和 hash 校验。
- artifact 类型与阶段必需产物映射。
- Skill prompt 模板变量渲染。

集成测试：

- `proud-flow init` 完成绑定并保存 token。
- 连接后端 WebSocket 成功。
- 收到 `dispatch.requested` 后启动 Codex Runner。
- 成功 ACK 返回后端。
- Codex 不可用时返回失败 ACK。
- `proud-flow get-task-context` 能调用后端 Skills API。
- `proud-flow skill install/update` 能安装和更新 Skill。
- 技术方案阶段 start、attach artifact、complete。
- 缺少必需产物时 complete 失败。
- 回退后旧 version complete 被拒绝。
- fail stage 推送失败摘要。

端到端测试：

- 前端点击派发技术方案设计。
- 后端通过 Durable Object 下发请求。
- daemon ACK 成功。
- Codex 启动 `/tech-design REQ-xxx`。
- Skill 通过 `proud-flow` CLI helper 更新需求状态。
- 使用 `/case-rundown REQ-xxx` 能读取技术方案并产出用例。
- 使用 `/develop REQ-xxx` 能读取前序产物并提交开发 PR、测试报告、截图。

## 19. 第一版落地范围

第一版建议实现：

- 本地 TypeScript CLI / daemon。
- 固定 prod / dev 后端地址选择。
- `proud-flow init/status/auth`。
- dispatcher token 鉴权连接。
- skill token 调用 Skills API。
- WebSocket 连接、心跳和自动重连。
- `tech_design`、`case_rundown`、`development` 三个 stage 映射。
- Codex Runner 适配层。
- 成功 / 失败 ACK。
- 串行执行和忙碌保护。
- Skill 安装、更新和状态检查。
- 三个核心 Skill：技术方案设计、测试用例设计、开发交付。
- `get-requirement`、`get-task-context`、`start-stage`、`attach-artifact`、`complete-stage`、`fail-stage`。
- artifact 上传和登记。
- 基础幂等 key。
- 本地结构化日志。

第一版暂不实现：

- 用户自定义 backendUrl。
- 独立远程工具协议服务。
- 持久化 dispatch job。
- 多执行器注册。
- 多 workspace 自动路由。
- 断线恢复未 ACK 任务。
- 任务完成状态监听。
- 复杂 prompt 拼接。
- 远端动态命令执行。
