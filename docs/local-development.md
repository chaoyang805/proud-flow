# Local Development

This guide describes how to run proud-flow on a new development machine.

## Prerequisites

- Node.js compatible with the workspace TypeScript toolchain.
- `pnpm` matching the root `packageManager` field.
- Git checkout of this repository.
- For browser tests, Playwright Chromium must be installed through `pnpm exec playwright install chromium`.

Install dependencies:

```bash
pnpm install
```

Build and verify the workspace:

```bash
pnpm build
pnpm typecheck
pnpm test
```

## Running The API

The API is a Cloudflare Workers-style fetch app. During local feature work, tests call it in memory. For Cloudflare-style local development, use the API deploy configuration in `apps/api/wrangler.jsonc` after replacing placeholder D1 database IDs.

```bash
pnpm --filter @proud-flow/api build
pnpm --filter @proud-flow/api wrangler:check
```

Secrets such as `BOOTSTRAP_TOKEN_HASHES`, `TOKEN_HASH_SECRET`, `USER_TOKEN_HASHES`, `SKILL_TOKEN_HASHES`, `DISPATCHER_TOKEN_HASHES`, and `LOCAL_TOKEN_HASHES` must not be committed. Use Wrangler secrets or local `.dev.vars` while developing.

## Running The Web App

```bash
pnpm dev:web
```

The development environment points `NEXT_PUBLIC_PROUD_FLOW_API_URL` at `http://127.0.0.1:8787` through `apps/web/.env.development`.

## Running The CLI

The published CLI command is `proud-flow`. In the workspace, build it first:

```bash
pnpm --filter @proud-flow/cli build
node apps/cli/dist/bin.js status
```

For isolated local tests:

```bash
PROUD_FLOW_CONFIG_DIR=/tmp/proud-flow proud-flow init --env dev --bootstrap-token <token> --machine-name dev-mac
```

The CLI stores config and tokens in `~/.proud-flow` unless `PROUD_FLOW_CONFIG_DIR` is set.

## Skills

Build Skill packages with:

```bash
pnpm skills:package
```

The generated packages are consumed by the local CLI through the backend Skill manifest. During development the manifest can point at a custom static host by setting `SKILL_MANIFEST_BASE_URL` in the API environment.

