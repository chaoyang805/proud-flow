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

The API is a Cloudflare Workers-style fetch app. During local acceptance, run it with the local Node dev server. The dev server uses the same Worker fetch app and an `InMemoryRequirementRepository`, so it is suitable for validating product flow but does not persist data after restart.

```bash
pnpm dev:api
```

The default address is:

```text
http://127.0.0.1:8787
```

Local acceptance intentionally does not require D1 or R2. If `BOOTSTRAP_TOKEN_HASHES` is not set, `proud-flow init` accepts any bootstrap token and stores generated local tokens in memory on the API side. Restarting `pnpm dev:api` clears requirements, artifacts, dispatch requests, and generated token records.

For Cloudflare-style development, use the API deploy configuration in `apps/api/wrangler.jsonc` after replacing placeholder D1 database IDs.

```bash
pnpm --filter @proud-flow/api wrangler:check
```

Secrets such as `BOOTSTRAP_TOKEN_HASHES`, `TOKEN_HASH_SECRET`, `USER_TOKEN_HASHES`, `SKILL_TOKEN_HASHES`, `DISPATCHER_TOKEN_HASHES`, and `LOCAL_TOKEN_HASHES` must not be committed. Use Wrangler secrets or local environment variables while developing.

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
PROUD_FLOW_CONFIG_DIR=/tmp/proud-flow \
PROUD_FLOW_API_URL=http://127.0.0.1:8787 \
node apps/cli/dist/bin.js init --env dev --bootstrap-token local-acceptance --machine-name dev-mac
```

The CLI stores config and tokens in `~/.proud-flow` unless `PROUD_FLOW_CONFIG_DIR` is set.

## Skills

Build Skill packages with:

```bash
pnpm skills:package
```

The generated packages are consumed by the local CLI through the backend Skill manifest. During development the manifest can point at a custom static host by setting `SKILL_MANIFEST_BASE_URL` in the API environment.

## Local Acceptance Checklist

Run quality checks before manual acceptance:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm test:browser
pnpm test:coverage
```

Start services in separate terminals:

```bash
pnpm dev:api
pnpm dev:web
```

Build the CLI once before using helper commands:

```bash
pnpm --filter @proud-flow/cli build
```

Initialize an isolated CLI profile:

```bash
PROUD_FLOW_CONFIG_DIR=/tmp/proud-flow-local-acceptance \
PROUD_FLOW_API_URL=http://127.0.0.1:8787 \
node apps/cli/dist/bin.js init --env dev --bootstrap-token local-acceptance --machine-name dev-mac
```

Open `http://localhost:3000` and validate:

- Create a requirement.
- Open requirement detail.
- Dispatch technical design from the Web detail page.
- Consume the pending dispatch request once:

```bash
PROUD_FLOW_CONFIG_DIR=/tmp/proud-flow-local-acceptance \
PROUD_FLOW_API_URL=http://127.0.0.1:8787 \
node apps/cli/dist/bin.js daemon --once --json
```

- Use CLI helper commands to start a stage, attach the required artifact, and complete the stage:

```bash
PROUD_FLOW_CONFIG_DIR=/tmp/proud-flow-local-acceptance \
PROUD_FLOW_API_URL=http://127.0.0.1:8787 \
node apps/cli/dist/bin.js start-stage REQ-000001 --stage tech_design --json

PROUD_FLOW_CONFIG_DIR=/tmp/proud-flow-local-acceptance \
PROUD_FLOW_API_URL=http://127.0.0.1:8787 \
node apps/cli/dist/bin.js attach-artifact REQ-000001 --type tech_design_pr --title "技术方案" --content "本地验收技术方案"

PROUD_FLOW_CONFIG_DIR=/tmp/proud-flow-local-acceptance \
PROUD_FLOW_API_URL=http://127.0.0.1:8787 \
node apps/cli/dist/bin.js complete-stage REQ-000001 --stage tech_design --json
```

- Refresh the Web detail page and confirm the status and artifact changed.
- Continue review, case design, development, delivery, and archive flow. The required artifact types are:
  - `case_rundown`: `case_rundown_pr` or `case_rundown_doc`
  - `development`: `development_pr` or `test_report`
  - archive from `delivery`: add `acceptance_record` before clicking archive

Local acceptance scope:

- In scope: product interaction, API behavior, workflow validation, CLI helper behavior, daemon command readiness, Skill package install/update/status, realtime refresh behavior where available.
- Out of scope: D1 persistence, R2 persistence, real Cloudflare Durable Object lifecycle, production secrets, production package publishing.
