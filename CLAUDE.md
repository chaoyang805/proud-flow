# CLAUDE.md

## Project Guide

- Proud Flow is an AI-assisted requirements management platform. It manages requirement state, human review, AI dispatch, AI artifacts, notifications, and archive; Codex performs the actual design and development work through Skills. See `.cursor/rules/project-context.mdc`.
- First-version architecture: Web frontend, Cloudflare-native backend, and Proud Flow Local CLI / Daemon. See `.cursor/rules/project-context.mdc`.
- Use Simplified Chinese when responding in this repository. See `.cursor/rules/project-context.mdc`.

## Key Engineering Notes

- Backend owns workflow transitions, permission checks, data storage, artifact records, dispatch entrypoints, and API validation.
- Frontend should call backend APIs and refresh from authoritative backend data; realtime WebSocket events are notifications, not the source of truth.
- Proud Flow CLI / Daemon handles local dispatch, Codex startup, token management, Skill install/update, and Skills API helper commands.
- Shared TypeScript types should live in planned packages such as `@proud-flow/domain`, `@proud-flow/api-contract`, and `@proud-flow/api-client`.

## Rule Index

- [Project Context](.cursor/rules/project-context.mdc) - Proud Flow overview, architecture decisions, shared type strategy, design document index, and agent conventions.

## Documentation Index

- [Product Design](docs/product-design.md)
- [Backend Technical Design](docs/backend-technical-design.md)
- [Frontend Technical Design](docs/frontend-technical-design.md)
- [Proud Flow CLI Technical Design](docs/proud-flow-cli-technical-design.md)
- [Repository Structure And Engineering](docs/repository-structure-and-engineering.md)
- [Development Roadmap](docs/development-roadmap.md)

