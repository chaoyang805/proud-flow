# Project Context

This file mirrors the project context rule for non-Cursor agent stacks.

Authoritative rule: `.cursor/rules/project-context.mdc`

## Summary

Proud Flow is an AI-assisted requirements management platform. The first version has three major modules:

1. Web frontend
2. Cloudflare-native backend
3. Proud Flow Local CLI / Daemon

The backend is the source of truth for workflow state transitions and permissions. The local `proud-flow` CLI / daemon handles dispatch WebSocket, Codex startup, Skill install/update, token management, and Skills API helper commands. Skills contain prompts and stage workflows, but should not contain tokens or raw HTTP details.

## Documentation Index

- `docs/product-design.md`
- `docs/backend-technical-design.md`
- `docs/frontend-technical-design.md`
- `docs/proud-flow-cli-technical-design.md`
- `docs/repository-structure-and-engineering.md`
- `docs/development-roadmap.md`

## Agent Convention

Always respond in Simplified Chinese for this project.

