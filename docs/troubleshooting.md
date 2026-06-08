# Troubleshooting

This guide lists common proud-flow setup, deployment, and runtime issues.

## `proud-flow init` Fails

Check that the CLI points to the intended backend:

```bash
PROUD_FLOW_API_URL=https://api.proud-flow.example proud-flow status
```

For local isolation, set `PROUD_FLOW_CONFIG_DIR` and retry. If the API returns `FORBIDDEN` or `UNAUTHORIZED`, confirm `BOOTSTRAP_TOKEN_HASHES` and `TOKEN_HASH_SECRET` were configured as Wrangler secrets in the same environment.

## Daemon Cannot Connect

Run:

```bash
proud-flow daemon --json
```

Confirm the returned WebSocket URL uses the expected environment. Production should resolve from `https://api.proud-flow.example` to `wss://api.proud-flow.example/api/dispatch/ws`. If the backend returns `FORBIDDEN`, rotate the dispatcher token with the local auth command or re-run `proud-flow init`.

If dispatch returns `DISPATCHER_OFFLINE`, confirm `proud-flow daemon` is running and connected. If it returns `DISPATCH_TIMEOUT`, the daemon received the task too slowly or did not send `dispatch.acked` within 5 seconds. Check daemon logs for `dispatch.requested` handling.

After clearing D1 or re-running `proud-flow init`, restart the API and daemon so token hashes and WebSocket sessions stay in sync.

## Skill Install Fails

Run:

```bash
proud-flow skill status --json
```

If a download fails, verify `SKILL_MANIFEST_BASE_URL`, the static host, and the package sha256 values in `skills/manifest.json`. A sha mismatch means the package was rebuilt but the manifest was not updated.

## Web Cannot Reach API

Check `apps/web/.env.production` and the deployed environment variable:

```text
NEXT_PUBLIC_PROUD_FLOW_API_URL=https://api.proud-flow.example
```

Browser requests should use the production API origin. Token-related errors usually mean the user token is missing or invalid in the Web token settings.

If the Cloudflare Web deploy fails before upload, run:

```bash
pnpm --filter @proud-flow/web preview:cloudflare
```

The Web adapter writes `.open-next/worker.js` and `.open-next/assets`. If those files are missing, the OpenNext build did not finish.

## Cloudflare Deploy Fails

Run the release checks locally:

```bash
pnpm release:check
pnpm --filter @proud-flow/api wrangler:check
```

If Wrangler reports invalid D1 database IDs, replace the placeholder values in `apps/api/wrangler.jsonc` with the IDs created in the Cloudflare dashboard. If it reports missing secrets, add them with `wrangler secret put` for the same `--env`.

## Coverage Gate Fails

Run the narrower workspace coverage command first, then the root command:

```bash
pnpm --filter @proud-flow/api test:coverage
pnpm test:coverage
```

Proud Flow release readiness requires each touched workspace to stay above the 80% coverage threshold.
