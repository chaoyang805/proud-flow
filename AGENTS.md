# AGENTS.md

## Learned User Preferences

- Always respond with Chinese Simplified.
- Keep project memory files concise and link to the authoritative rule or design document instead of duplicating long content.

## Learned Workspace Facts

- Proud Flow is an AI-assisted requirements management platform for managing requirement lifecycle, human review, AI dispatch, artifact collection, notifications, and archive.
- The first-version architecture has three major modules: Web frontend, Cloudflare-native backend, and Proud Flow Local CLI / Daemon.
- TypeScript is the shared language across frontend, backend, CLI / daemon, shared packages, and Skills helper code.
- The backend is the source of truth for workflow state transitions and permissions.
- The local `proud-flow` CLI / daemon handles dispatch WebSocket, Codex startup, Skill install/update, token management, and Skills API helper commands.
- Current implementation planning is document-first; code has not been scaffolded yet.

## Rule Index

- [Project Context](.cursor/rules/project-context.mdc) - Proud Flow overview, architecture decisions, shared type strategy, design document index, and agent conventions.

## Documentation Index

- [Product Design](docs/product-design.md) - product positioning, lifecycle, module boundaries, and collaboration flow.
- [Backend Technical Design](docs/backend-technical-design.md) - Cloudflare Workers backend, D1/R2/Durable Objects, APIs, auth, workflow, and realtime events.
- [Frontend Technical Design](docs/frontend-technical-design.md) - Next.js frontend, page structure, REST integration, WebSocket realtime events, and review UI.
- [Proud Flow CLI Technical Design](docs/proud-flow-cli-technical-design.md) - local CLI / daemon, dispatch, token management, Skill install/update, and CLI helper commands.
- [Repository Structure And Engineering](docs/repository-structure-and-engineering.md) - TypeScript monorepo, shared packages, API contracts, testing, and deployment.
- [Development Roadmap](docs/development-roadmap.md) - implementation phases, task checklist, acceptance criteria, and current progress.

