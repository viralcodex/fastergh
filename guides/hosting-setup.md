# QuickHub Hosting Setup Guide

This guide covers a production setup for QuickHub with:

- Convex for backend + webhooks
- Vercel (or any Node host) for `apps/main-site`
- GitHub OAuth App for user sign-in
- GitHub App for installation tokens + webhook delivery

## 1) Prerequisites

- Bun 1.3+
- Convex account + project
- GitHub org/user where you can create apps
- A deployed site URL (for example `https://quickhub.yourdomain.com`)

## 2) Create and configure environment variables

Use `.env.example` as the source of truth.

Required core values:

- `CONVEX_URL`
- `CONVEX_SITE_URL`
- `SITE_URL`
- `GITHUB_WEBHOOK_SECRET`
- `BETTER_AUTH_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_APP_SLUG`
- `GITHUB_APP_PRIVATE_KEY`

Generate secrets:

```bash
openssl rand -hex 32   # for GITHUB_WEBHOOK_SECRET
openssl rand -hex 32   # for BETTER_AUTH_SECRET
```

### Where each value must be set

- Convex environment (`packages/database` runtime):
  - `SITE_URL`
  - `CONVEX_SITE_URL`
  - `GITHUB_WEBHOOK_SECRET`
  - `GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET`
  - `GITHUB_APP_PRIVATE_KEY`
- Frontend host env (`apps/main-site` runtime):
  - `CONVEX_URL`
  - `CONVEX_SITE_URL`
  - `GITHUB_APP_SLUG`
  - `SITE_URL`
  - `GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET`
  - Optional observability envs (`SENTRY_*`, `AXIOM_*`)

Notes:

- `apps/main-site/next.config.ts` maps `CONVEX_URL`, `CONVEX_SITE_URL`, and `GITHUB_APP_SLUG` to `NEXT_PUBLIC_*` automatically.
- Keep `SITE_URL` set to your public app domain (not localhost) in production.

## 3) Create the GitHub OAuth App (sign in with GitHub)

QuickHub uses Better Auth social login with GitHub OAuth credentials.

1. Create a GitHub OAuth App.
2. Set homepage URL to `SITE_URL`.
3. Set authorization callback URL to:
   - `${SITE_URL}/api/auth/callback/github`
4. Copy client ID/secret into:
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`

## 4) Create the GitHub App (installations + webhook stream)

1. Create a GitHub App.
2. Set:
   - Homepage URL: `SITE_URL`
   - Setup URL: `${SITE_URL}/github/setup`
   - Webhook URL: `${CONVEX_SITE_URL}/api/github/webhook`
   - Webhook secret: `GITHUB_WEBHOOK_SECRET`
3. Grant repository permissions needed for QuickHub sync/write behavior (issues, pull requests, checks, contents/metadata, actions as needed by your workflow).
4. Subscribe to events:
   - `installation`
   - `installation_repositories`
   - `push`
   - `pull_request`
   - `pull_request_review`
   - `issues`
   - `issue_comment`
   - `check_run`
   - `create`
   - `delete`
   - `workflow_run`
   - `workflow_job`
5. Generate and store:
   - Client ID -> `GITHUB_CLIENT_ID`
   - App slug -> `GITHUB_APP_SLUG`
   - Private key PEM -> `GITHUB_APP_PRIVATE_KEY`
6. Install the app to your org/user and select repositories.

## 5) Deploy backend (Convex)

From repo root:

```bash
bun install
bun run lint
bun run typecheck
bun run test
```

Deploy Convex functions:

```bash
cd packages/database
bunx convex deploy
```

Set/verify Convex env vars:

```bash
bunx convex env set GITHUB_WEBHOOK_SECRET "<value>"
bunx convex env set CONVEX_SITE_URL "<value>"
bunx convex env set SITE_URL "<value>"
bunx convex env set GITHUB_CLIENT_ID "<value>"
bunx convex env set GITHUB_CLIENT_SECRET "<value>"
bunx convex env set GITHUB_APP_PRIVATE_KEY "<value>"
bunx convex env list
```

## 6) Deploy frontend (`apps/main-site`)

Recommended: Vercel with root directory `apps/main-site`.

Build command:

```bash
bun run build
```

Make sure Vercel project env contains at least:

- `CONVEX_URL`
- `CONVEX_SITE_URL`
- `GITHUB_APP_SLUG`
- `SITE_URL`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

## 7) Post-deploy validation checklist (what to check)

### Authentication

- Open the site and click "Sign in with GitHub".
- Confirm you return to the app authenticated.
- If sign-in fails, re-check `SITE_URL` and OAuth callback URL.

### GitHub App flow

- "Install GitHub App" button appears in the sidebar.
- Button links to `https://github.com/apps/<slug>/installations/new`.
- After install, GitHub redirects to `/github/setup` and then back to `/`.

### Webhook ingestion

- In GitHub App webhook deliveries, recent deliveries return HTTP `200`.
- In Convex, queue remains healthy:

```bash
cd packages/database
# BACKEND_ACCESS_TOKEN must be set locally and in Convex env
bunx convex run rpc/admin:queueHealth '{}'
bunx convex run rpc/admin:systemStatus '{"adminToken":"'$BACKEND_ACCESS_TOKEN'"}'
bunx convex run rpc/admin:tableCounts '{"adminToken":"'$BACKEND_ACCESS_TOKEN'"}'
```

What good looks like:

- `pending`/`retry` are not continuously growing
- `failed` and `deadLetters` stay low
- repository and event counts increase after install/activity

### Data sync and writes

- Repositories appear in sidebar after install/onboarding.
- New PRs/issues/comments in GitHub appear in QuickHub shortly.
- QuickHub write actions (create issue/comment/merge) succeed and mirror back.

## 8) Common misconfigurations

- `GITHUB_WEBHOOK_SECRET` mismatch between GitHub and Convex env -> signature failures
- Missing `GITHUB_APP_PRIVATE_KEY` or malformed PEM -> installation token errors
- `SITE_URL` still set to localhost in production -> auth redirect problems
- `GITHUB_APP_SLUG` missing in frontend env -> install button link missing
- Skipping `bun run typecheck` because Next build ignores TS errors in this app

## 9) Ongoing operations

- Watch queue health via `rpc/admin:systemStatus`.
- Track webhook failures in GitHub App delivery logs.
- Rotate OAuth/GitHub App secrets on a regular schedule.
- Re-run `bun run lint && bun run typecheck && bun run test` before each release.
