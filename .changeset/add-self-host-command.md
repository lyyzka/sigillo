---
'sigillo': minor
---

Add `npx sigillo self-host` — deploy Sigillo to your own Cloudflare account with one command.

```bash
npx sigillo self-host
```

The command provisions everything needed to run Sigillo on your own Cloudflare account using raw Cloudflare API calls (no wrangler, no build step, no git clone):

- **Worker + D1 database** created and wired automatically from a prebuilt release bundle
- **D1 migrations** applied using wrangler-compatible `d1_migrations` bookkeeping
- **workers.dev URL** enabled and printed at the end
- **Custom domain** optionally attached (`--domain secrets.acme.com`)
- **Auth just works** — the instance registers with the hosted Sigillo auth provider on first load, no OAuth keys to configure

Cloudflare authentication tries, in order: `CLOUDFLARE_API_TOKEN`, your existing `wrangler login` (refreshed and written back if expired), a previous self-host login, then an interactive choice between an OAuth browser login and a pre-filled API-token creation link that works from any device (useful over SSH — Cloudflare has no device-code flow).

Re-running the command is **idempotent** and deploys the latest release: only new migrations are applied, unchanged assets are skipped, and `BETTER_AUTH_SECRET` is never rotated (rotating it would invalidate the encryption key protecting stored secrets).

```bash
# non-interactive (CI/agents)
CLOUDFLARE_API_TOKEN=xxx npx sigillo self-host --yes

# custom worker name and domain
npx sigillo self-host --name sigillo --domain secrets.acme.com
```

The command is TypeScript-only and ships in the npm package; the standalone binary prints a pointer to `npx sigillo self-host`.
