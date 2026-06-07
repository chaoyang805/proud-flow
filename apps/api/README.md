# @proud-flow/api

Cloudflare Workers API 后端，Proud Flow 平台的权威数据源。

## 职责

- 需求生命周期管理（CRUD、状态流转、归档）
- 人工审核（通过/驳回/回滚）
- AI 调度（dispatch 入口、WebSocket 实时推送）
- 产物管理（上传、列表、存储）
- 本地 CLI 引导（bootstrap、token 管理）
- Skills API（需求上下文、阶段控制、产物附加）
- 实时事件推送（WebSocket 广播）

## 技术栈

- **运行时**：Cloudflare Workers
- **存储**：D1（SQLite）、R2（对象存储）、Durable Objects（WebSocket 会话）
- **路由**：`itty-router`
- **认证**：Bearer Token（按 token 类型区分权限）

## 目录结构

```
src/
├── index.ts              # Worker 入口，路由注册
├── env.ts                # 环境变量类型定义
├── test-utils.ts         # 测试辅助工具
├── db/
│   └── schema.ts         # D1 数据库 Schema
├── middleware/
│   ├── auth.ts           # Token 认证中间件
│   ├── error.ts          # 错误处理中间件
│   └── request-id.ts     # 请求 ID 追踪
└── modules/
    ├── requirements/     # 需求管理（[README](src/modules/requirements/README.md)）
    ├── workflow/         # 工作流状态机（[README](src/modules/workflow/README.md)）
    ├── reviews/          # 审核管理
    ├── artifacts/        # 产物管理（[README](src/modules/artifacts/README.md)）
    ├── dispatch/         # AI 调度
    ├── skills/           # Skills API
    ├── local/            # 本地 CLI 接口
    ├── realtime/         # WebSocket 实时推送（[README](src/modules/realtime/README.md)）
    └── auth/             # Token 服务
```

## 本地开发

```bash
pnpm dev:api    # 启动 http://127.0.0.1:8787
pnpm test       # 运行单元测试
```

## 设计文档

详见 [Backend Technical Design](../../docs/backend-technical-design.md)
