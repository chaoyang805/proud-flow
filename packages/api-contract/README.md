# @proud-flow/api-contract

前后端共享的 API 契约（Schema + OpenAPI 路径清单）。

## 职责

- 定义请求/响应 Zod Schema（运行时校验 + 类型推导）
- 提供 OpenAPI 路径清单（用于文档和代码生成）
- 所有模块的 Schema 集中管理

## 模块

| 文件 | 内容 |
|------|------|
| `requirements.ts` | 需求 CRUD / 列表 / 归档 的请求与响应 Schema |
| `workflow.ts` | 状态流转的请求 Schema |
| `reviews.ts` | 审核操作（通过/驳回/回滚）Schema |
| `artifacts.ts` | 产物创建、上传、列表 Schema |
| `dispatch.ts` | 调度请求/确认 Schema |
| `skills.ts` | Skills API 的所有 Schema |
| `local.ts` | 本地 CLI 接口（bootstrap、token 管理）Schema |
| `realtime.ts` | WebSocket 消息 Schema |
| `common.ts` | 通用错误响应 Schema |
| `schema.ts` | 轻量 Zod-like Schema 类型（`Schema<T>`） |
| `openapi.ts` | OpenAPI 路径清单生成 |
| `index.ts` | 聚合导出 |
