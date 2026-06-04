# 前端技术设计

## 1. 设计目标

前端是 AI 需求管理平台面向用户的工作台，负责承载需求创建、需求跟踪、人工 review、派发操作、产物查看和实时提醒。前端只负责呈现和发起业务操作，复杂状态流转、权限校验、派发结果和产物有效性都以后端返回为准。

前端核心原则：

- 所有业务状态以后端 API 返回为准。
- 前端不自行实现复杂状态机，只做轻量展示约束和按钮可用性提示。
- review、回退、验收、归档等人工操作必须通过后端业务接口完成。
- 派发操作只调用后端派发接口，不直接连接本地 Codex。
- 实时状态变化通过 WebSocket 感知，收到事件后重新拉取权威数据。
- 第一版优先实现 Web 工作台，移动端后续复用同一套 API。

## 2. 推荐技术栈

第一版推荐：

- 框架：Next.js + React + TypeScript
- 样式：Tailwind CSS
- UI 组件：shadcn/ui 或 Radix UI primitives
- 数据请求：TanStack Query
- 表单：React Hook Form + Zod
- 路由：Next.js App Router
- 实时事件：WebSocket 消费 `/api/realtime/ws`
- 部署：Cloudflare Pages 或 Workers Static Assets

选择原因：

- TypeScript 可与后端、本地 Proud Flow CLI / Daemon 和 Skills helper 共享类型约束。
- TanStack Query 适合处理需求列表、详情页缓存和 WebSocket 事件后的局部失效刷新。
- Cloudflare Pages 与后端 Workers 的部署目标一致，MVP 运维成本低。
- Web 端优先能覆盖需求管理和 review 的核心闭环。

## 3. 页面与信息架构

### 3.1 页面结构

```text
frontend
  app
    requirements
      page.tsx                  需求列表
      new/page.tsx              创建需求
      [id]/page.tsx             需求详情
  components
    requirements                需求相关组件
    artifacts                   产物展示组件
    review                      review 操作组件
    realtime                    WebSocket 和 toast 组件
  lib
    api                         API client
    query                       TanStack Query keys
    auth                        token 管理
    types                       前端领域类型
```

### 3.2 核心页面

需求列表页：

- 展示需求编号、标题、状态、优先级、当前负责人、更新时间。
- 支持按状态、优先级、关键词筛选。
- 支持创建需求入口。
- 收到 WebSocket 事件后刷新对应需求行或失效列表查询。

创建需求页：

- 输入标题、描述、优先级。
- 描述支持 Markdown。
- 创建成功后进入需求详情页。

需求详情页：

- 展示需求基础信息、当前状态、版本号和描述。
- 展示当前有效产物和历史参考产物。
- 展示与当前状态匹配的主操作区。
- 在 review 状态展示通过、回退和验收操作。
- 在 `planning`、`tech-review`、`case-review` 等可派发节点展示派发入口。

## 4. 状态与操作映射

前端展示可以根据状态做轻量映射，但最终操作合法性以后端为准。

| 状态 | 页面主提示 | 主要操作 |
| --- | --- | --- |
| `planning` | 需求规划中 | 编辑需求、派发技术方案设计 |
| `tech-design` | AI 正在设计技术方案 | 查看已有产物、等待更新 |
| `tech-review` | 技术方案待 review | 查看技术方案 PR、通过并派发用例设计、回退 |
| `case-rundown` | AI 正在设计测试用例 | 查看已有产物、等待更新 |
| `case-review` | 测试用例待 review | 查看用例产物、通过并派发开发、回退 |
| `developing` | AI 正在开发 | 查看开发产物、等待交付 |
| `delivery` | 开发交付待验收 | 查看代码 PR、测试报告、截图、验收归档、回退 |
| `archived` | 已归档 | 只读查看 |

按钮可用性规则：

- 前端可以根据状态隐藏明显不相关的操作。
- 提交操作时必须处理后端返回的 `INVALID_STATUS_TRANSITION`。
- 派发按钮点击后进入短暂 loading，避免用户重复点击。
- 派发成功只代表本地 `proud-flow daemon` 已 ACK，不代表需求状态已进入下一阶段。
- AI 后续通过 Skill 调用后端后，前端再通过 WebSocket 事件或短轮询兜底看到状态变化。

## 5. API 集成

前端 API client 建议按后端 REST 接口封装。

需求：

```text
POST   /api/requirements
GET    /api/requirements
GET    /api/requirements/:id
PATCH  /api/requirements/:id
POST   /api/requirements/:id/archive
```

Review：

```text
POST   /api/requirements/:id/reviews/approve
POST   /api/requirements/:id/reviews/rollback
```

派发：

```text
POST   /api/requirements/:id/dispatch
```

产物：

```text
GET    /api/requirements/:id/artifacts
POST   /api/requirements/:id/artifacts
POST   /api/artifacts/upload
```

实时事件：

```text
GET    /api/realtime/ws
```

实时事件第一版建议使用 WebSocket，而不是 SSE。原因是本地 `proud-flow daemon` 和后端已经通过 WebSocket 通信，前端状态变化也走 WebSocket 可以复用后端连接管理、鉴权、心跳和消息协议设计，降低实时通信技术栈分叉。

### 5.1 Query Key 设计

```text
requirements.list(filters)
requirements.detail(requirementId)
requirements.artifacts(requirementId)
events.connection
```

刷新策略：

- 创建、编辑、review、回退、归档成功后失效详情和列表。
- 收到 `requirement.updated` 后失效对应详情、产物和列表。
- 收到派发 ACK 成功事件后展示 toast，不强制改变本地状态。
- 收到派发失败或 AI 失败事件后展示错误 toast，并刷新详情。
- WebSocket 短暂断开时保留页面缓存，并在重连后主动刷新当前列表或详情。

### 5.2 WebSocket 事件协议

前端 WebSocket 只用于接收实时事件，不用于提交业务操作。创建、编辑、review、回退、归档和派发仍通过 REST API 完成。

连接：

```text
GET /api/realtime/ws
```

鉴权：

```text
Authorization: Bearer <user_token>
```

需求状态更新事件：

```json
{
  "type": "requirement.updated",
  "eventId": "evt_123",
  "requirementId": "REQ-000123",
  "status": "tech-review",
  "message": "技术方案已完成，待 review"
}
```

派发结果事件：

```json
{
  "type": "dispatch.acked",
  "eventId": "evt_124",
  "requirementId": "REQ-000123",
  "success": true,
  "message": "Codex 已收到派发指令"
}
```

AI 失败事件：

```json
{
  "type": "ai_stage.failed",
  "eventId": "evt_125",
  "requirementId": "REQ-000123",
  "stage": "development",
  "message": "开发阶段执行失败，请查看详情"
}
```

连接策略：

- 前端启动后建立一个全局 WebSocket 连接。
- 连接断开后指数退避重连。
- 重连成功后刷新当前打开的需求详情或需求列表。
- 事件用 `eventId` 做短时去重，避免重连或重放导致重复 toast。
- WebSocket 只承载事件通知，事件内容不作为需求详情的最终数据源。

## 6. 组件设计

建议组件拆分：

```text
RequirementListTable
RequirementStatusBadge
RequirementPriorityBadge
RequirementDetailHeader
RequirementDescriptionPanel
RequirementActionPanel
DispatchButton
ReviewApproveDialog
RollbackDialog
ArtifactList
ArtifactCard
RealtimeToastBridge
```

关键组件语义：

- `RequirementActionPanel`：根据当前状态选择展示派发、review、验收或只读信息。
- `DispatchButton`：只负责调用后端派发接口并处理 ACK 结果。
- `RollbackDialog`：必须要求填写回退目标和回退原因。
- `ArtifactList`：按 `requirement_version` 区分当前有效产物和历史参考产物。
- `RealtimeToastBridge`：维护 WebSocket 连接，将事件转换为 toast 和 query invalidation。

## 7. 鉴权设计

第一版可以采用简单 Bearer Token：

- token 保存在本地安全程度可接受的位置，例如开发期 `.env` 或浏览器 localStorage。
- API client 统一注入 `Authorization: Bearer <token>`。
- 401 时跳转到简化登录或 token 配置页面。

团队版后续扩展：

- 用户登录。
- 项目级权限。
- RBAC 控制按钮可见性。
- 操作人头像、关注人和审批人。

## 8. 错误处理与空状态

统一处理后端错误格式：

```json
{
  "error": {
    "code": "INVALID_STATUS_TRANSITION",
    "message": "当前状态不允许进入 delivery",
    "details": {}
  }
}
```

前端策略：

- `VALIDATION_ERROR`：表单字段内展示。
- `PERMISSION_DENIED`：toast 提示权限不足。
- `DISPATCHER_OFFLINE`：提示本地 `proud-flow daemon` 未连接。
- `CODEX_NOT_CONNECTED`：提示检查本地 Codex。
- `MISSING_REQUIRED_ARTIFACT`：提示缺少必需产物，并刷新产物列表。
- 未知错误：toast 提示并保留用户输入。

空状态：

- 没有需求时展示创建入口。
- 没有产物时按当前阶段展示等待说明。
- WebSocket 断开时在页面顶部展示轻量连接状态，并自动重连。

## 9. 测试策略

单元测试：

- 状态到操作区的映射。
- artifact 当前版本与历史版本分组。
- API 错误码到用户提示的映射。
- 表单校验。

组件测试：

- 需求列表筛选和空状态。
- review 通过弹窗。
- 回退弹窗必填校验。
- 派发按钮 loading 和错误态。

端到端测试：

- 创建需求并进入详情页。
- 从 `planning` 派发技术方案设计并展示 ACK。
- 技术方案进入 review 后展示 PR 产物。
- review 通过后派发下一阶段。
- 从 `delivery` 回退到 `planning`。
- WebSocket 事件触发列表和详情刷新。

## 10. 第一版落地范围

第一版建议实现：

- Web 端需求列表、创建和详情页。
- 需求编辑。
- 派发按钮和派发 ACK 提示。
- 技术方案、用例、开发交付三个 review 工作区。
- 回退、验收归档。
- 产物列表和当前版本 / 历史版本区分。
- WebSocket 实时 toast 和数据刷新。
- 简单 Bearer Token 鉴权。

第一版暂不实现：

- 移动端。
- 多项目切换。
- 复杂 RBAC。
- 站内通知中心。
- PR diff 内嵌 review。
- 可视化 timeline 持久历史。
- 离线模式。
