# Deployment

This guide covers proud-flow release preparation for Cloudflare and package assets. It intentionally avoids committing account-specific Cloudflare IDs or secrets.

## Cloudflare Resources

Create these resources in both dev and production Cloudflare accounts or environments:

- Workers: `proud-flow-api-dev` and `proud-flow-api-prod`
- D1 databases: `proud-flow-dev` and `proud-flow-prod`
- R2 buckets: `proud-flow-dev-artifacts` and `proud-flow-prod-artifacts`
- Durable Objects: `DISPATCH_DO` and `REALTIME_DO`
- Static Skill asset host: `https://static-dev.proud-flow.example/skills` and `https://static.proud-flow.example/skills`

After creating D1 databases, replace the placeholder `database_id` values in `apps/api/wrangler.jsonc`. Do not replace secrets in source files; use Wrangler secrets.

## Backend Deploy

Set required secrets:

```bash
pnpm exec wrangler secret put TOKEN_HASH_SECRET --config apps/api/wrangler.jsonc --env production
pnpm exec wrangler secret put BOOTSTRAP_TOKEN_HASHES --config apps/api/wrangler.jsonc --env production
pnpm exec wrangler secret put USER_TOKEN_HASHES --config apps/api/wrangler.jsonc --env production
```

Apply migrations:

```bash
pnpm db:migrate:dev
pnpm db:migrate:prod
```

Deploy:

```bash
pnpm deploy:api:dev
pnpm deploy:api:prod
```

## Frontend Deploy

The production web build reads:

```text
NEXT_PUBLIC_PROUD_FLOW_API_URL=https://api.proud-flow.example
```

Deploy commands are wired as:

```bash
pnpm deploy:web:dev
pnpm deploy:web:prod
```

The Web app uses `@opennextjs/cloudflare` and `apps/web/wrangler.jsonc` so the Next.js app is built into `.open-next/worker.js` plus `.open-next/assets` and deployed to Cloudflare Workers. Keep `.open-next/` out of version control.

## CLI Package

Build and pack the CLI:

```bash
pnpm publish:cli
```

The package exposes the `proud-flow` bin from `apps/cli/dist/bin.js`. A new machine can run `proud-flow init` after the package is installed and a valid bootstrap token is available.

## Skill Packages

Skills ship with the CLI npm package (`apps/cli/skills/`). Publish the CLI with `pnpm publish:cli`; users upgrade Skills by upgrading the CLI and running `proud-flow skill install`.

## Release Gate

Before any deploy:

```bash
pnpm release:check
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm test:browser
pnpm test:coverage
```
