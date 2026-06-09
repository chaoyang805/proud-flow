# proud-flow

proud-flow is an AI-assisted requirements workflow platform. It connects a Web requirements workspace, a Cloudflare-native API, a local CLI/daemon, and Codex Skills so a requirement can move from planning to technical design, case rundown, development, delivery, and archive with human review gates.

## What Is Included

- `apps/web`: Next.js requirements workspace.
- `apps/api`: Cloudflare Workers API for requirements, workflow, artifacts, local bootstrap, dispatch, Skills API, and realtime events.
- `apps/cli`: local `proud-flow` CLI and daemon helpers.
- `packages/domain`: shared workflow, artifact, dispatch, and token domain types.
- `packages/api-contract`: shared request/response schemas and OpenAPI path inventory.
- `packages/api-client`: typed Proud Flow API client.
- `apps/cli/skills/`: Codex Skills bundled with the CLI for technical design, case rundown, and development delivery.

## Local Quick Start

```bash
pnpm install
pnpm build
pnpm test:e2e
```

Run the web app:

```bash
pnpm dev:web
```

Run the API locally:

```bash
pnpm dev:api
```

The local API dev server listens on `http://127.0.0.1:8787` and uses an in-memory repository. It is intended for local product-flow acceptance; Cloudflare D1/R2 persistence is validated later in the Cloudflare environment.

Initialize a local CLI against the local API:

```bash
PROUD_FLOW_API_URL=http://127.0.0.1:8787 proud-flow init --env dev --bootstrap-token <token> --machine-name <name>
```

The CLI stores config and local tokens under `~/.proud-flow` by default. For tests or isolated machines, set `PROUD_FLOW_CONFIG_DIR`.

## Release Readiness

Before deployment or packaging, run:

```bash
pnpm release:check
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm test:browser
pnpm test:coverage
```

The release configuration includes Cloudflare Workers, D1, R2, Durable Object bindings, Web production API env, CLI package metadata, Skill packages, and deployment documentation. Real Cloudflare resource IDs and secrets are intentionally not committed.

More details:

- [Local Development](docs/local-development.md)
- [Deployment](docs/deployment.md)
- [Troubleshooting](docs/troubleshooting.md)
