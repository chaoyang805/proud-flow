# CLAUDE.md

## Project Guide

- Proud Flow is an AI-assisted requirements management platform. It manages requirement state, human review, AI dispatch, AI artifacts, notifications, and archive; Codex performs the actual design and development work through Skills. See `.cursor/rules/project-context.mdc`.
- First-version architecture: Web frontend, Cloudflare-native backend, and Proud Flow Local CLI / Daemon. See `.cursor/rules/project-context.mdc`.
- Use Simplified Chinese when responding in this repository. See `.cursor/rules/project-context.mdc`.

## Key Engineering Notes

- Backend owns workflow transitions, permission checks, data storage, artifact records, dispatch entrypoints, and API validation.
- Frontend should call backend APIs and refresh from authoritative backend data; realtime WebSocket events are notifications, not the source of truth.
- Proud Flow CLI / Daemon handles local dispatch, Codex startup, token management, Skill install/update, and Skills API helper commands.
- Shared TypeScript types live in `@proud-flow/domain`, `@proud-flow/api-contract`, and `@proud-flow/api-client`.

## Development Standards

- 单元测试行覆盖率 ≥ 80%（Statements / Lines），CI 阻塞不达标合入
- `pnpm typecheck && pnpm lint && pnpm test` 通过方可提交
- 新增模块必须有测试文件和 README
- 详见 `.cursor/rules/development-standards.mdc`

## Rule Index

- [Project Context](.cursor/rules/project-context.mdc) — Proud Flow 概述、架构决策、共享类型策略、设计文档索引、Agent 约定
- [Development Standards](.cursor/rules/development-standards.mdc) — 测试准出条件（覆盖率 ≥ 80%）、代码风格、提交前检查清单、目录约定

## Module Index

- [apps/api](apps/api/README.md) — Cloudflare Workers 后端
- [apps/cli](apps/cli/README.md) — 本地 CLI 与 Daemon
- [apps/web](apps/web/README.md) — Next.js 前端工作台
- [packages/domain](packages/domain/README.md) — 共享领域类型
- [packages/api-contract](packages/api-contract/README.md) — API 契约 Schema
- [packages/api-client](packages/api-client/README.md) — 类型安全 API 客户端
- [packages/config](packages/config/README.md) — 工作区配置

## Documentation Index

- [Product Design](docs/product-design.md)
- [Backend Technical Design](docs/backend-technical-design.md)
- [Frontend Technical Design](docs/frontend-technical-design.md)
- [Proud Flow CLI Technical Design](docs/proud-flow-cli-technical-design.md)
- [Repository Structure And Engineering](docs/repository-structure-and-engineering.md)
- [Development Roadmap](docs/development-roadmap.md)
- [Local Development](docs/local-development.md)
- [Deployment](docs/deployment.md)
- [Troubleshooting](docs/troubleshooting.md)
