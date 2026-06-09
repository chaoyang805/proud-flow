# AGENTS.md

## Learned User Preferences

- Always respond with Chinese Simplified.
- Keep project memory files concise and link to the authoritative rule or design document instead of duplicating long content.

## Learned Workspace Facts

- Proud Flow is an AI-assisted requirements management platform for managing requirement lifecycle, human review, AI dispatch, artifact collection, notifications, and archive.
- The first-version architecture has three major modules: Web frontend, Cloudflare-native backend, and Proud Flow Local CLI / Daemon.
- TypeScript is the shared language across frontend, backend, CLI / daemon, shared packages, and Skills helper code.
- The backend is the source of truth for workflow state transitions and permissions.
- The local `proud-flow` CLI / daemon handles dispatch WebSocket, Codex startup, bundled Skill install to `workspacePath/.codex/skills/` (on init and via `skill install`), token management, and Skills API helper commands.

## Rule Index

- [Project Context](.cursor/rules/project-context.mdc) — Proud Flow 概述、架构决策、共享类型策略、设计文档索引、Agent 约定
- [Development Standards](.cursor/rules/development-standards.mdc) — 测试准出条件（覆盖率 ≥ 80%）、代码风格、提交前检查清单、目录约定

## Module README Index

每个 `apps/*` 和 `packages/*` 模块都有独立的 README，描述职责、技术栈、目录结构：

- [apps/api](apps/api/README.md) — Cloudflare Workers 后端，需求管理、审核、调度、产物 API
- [apps/cli](apps/cli/README.md) — 本地 CLI 与 Daemon，命令参考、配置说明
- [apps/web](apps/web/README.md) — Next.js 前端工作台，组件、路由、状态管理
- [packages/domain](packages/domain/README.md) — 共享领域类型与校验函数
- [packages/api-contract](packages/api-contract/README.md) — API 契约 Schema + OpenAPI 路径
- [packages/api-client](packages/api-client/README.md) — 类型安全 API 客户端
- [packages/config](packages/config/README.md) — 工作区配置常量

### 子模块 README

- [apps/api/src/modules/requirements](apps/api/src/modules/requirements/README.md)
- [apps/api/src/modules/workflow](apps/api/src/modules/workflow/README.md)
- [apps/api/src/modules/artifacts](apps/api/src/modules/artifacts/README.md)
- [apps/api/src/modules/realtime](apps/api/src/modules/realtime/README.md)
- [apps/cli/src/daemon](apps/cli/src/daemon/README.md)

## Documentation Index

- [Product Design](docs/product-design.md) — 产品定位、生命周期、模块边界、协作流程
- [Backend Technical Design](docs/backend-technical-design.md) — Cloudflare Workers 后端、D1/R2/Durable Objects、API、认证、工作流
- [Frontend Technical Design](docs/frontend-technical-design.md) — Next.js 前端、页面结构、REST 集成、WebSocket 实时事件
- [Proud Flow CLI Technical Design](docs/proud-flow-cli-technical-design.md) — 本地 CLI/Daemon、调度、Token 管理、Skill 安装
- [Repository Structure And Engineering](docs/repository-structure-and-engineering.md) — TypeScript monorepo、共享包、API 契约、测试、部署
- [Development Roadmap](docs/development-roadmap.md) — 实施阶段、任务清单、验收标准
- [Local Development](docs/local-development.md) — 本地开发环境搭建
- [Deployment](docs/deployment.md) — 部署配置
- [Troubleshooting](docs/troubleshooting.md) — 常见问题排查
