# Zephyr Cloud Migration — NYC Demo App (dbxdemonyc.com)

> **Live migration document** — tracking the journey from AWS Amplify to Zephyr Cloud + Cloudflare Workers for a Databricks demo app.

---

## Background

The NYC Demo App ([dbxdemonyc.com](https://dbxdemonyc.com)) is an interactive event registration + analytics app built for a NYC Founders event. It showcases Databricks LakeBase (managed Postgres), AI/BI dashboards, and NLP topic classification — all powered by a React frontend and Express.js backend.

**The problem:** Deployments on AWS Amplify take ~2 minutes per push. For a demo app that gets iterated on quickly, this is painful. We wanted sub-second deploys.

**The solution:** Zack Chapple (Zephyr Cloud) forked the repo and migrated the stack to Cloudflare Workers with Zephyr Cloud as the deployment orchestration layer.

---

## Original Stack (AWS Amplify)

| Layer | Technology | Deploy Target |
|-------|-----------|---------------|
| Frontend | React (CRA) + Tailwind CDN | AWS Amplify Static (`dx7u5ga7qr7e7`) |
| Backend | Express.js + node-postgres | AWS Amplify WEB_COMPUTE (`d1erxf8q87xlvj`) |
| Database | LakeBase (Managed Postgres) | Databricks |
| DNS | Route 53 | `dbxdemonyc.com` |
| Deploy time | ~2 minutes per push | Git-triggered auto-build |

---

## New Stack (Zephyr Cloud + Cloudflare Workers)

| Layer | Technology | Deploy Target |
|-------|-----------|---------------|
| Frontend | React (TanStack Start SSR) + Vite 7 + Tailwind CSS v4 | Cloudflare Workers (`nyc-demo-web`) |
| Backend | Hono (TypeScript) + postgres.js | Cloudflare Workers (`nyc-demo-api`) |
| Database | LakeBase (Managed Postgres) | Databricks (unchanged) |
| DNS | TBD (Cloudflare or Route 53) | TBD |
| Deploy time | Target: sub-second (via Zephyr) | Zephyr Cloud orchestration |

---

## What Changed (Technical Details)

### Backend: Express.js → Hono on Cloudflare Workers

- **Framework:** Express.js → [Hono](https://hono.dev/) v4.9.7 (lightweight, edge-first web framework)
- **Language:** JavaScript → TypeScript
- **Runtime:** Node.js on Amplify → Cloudflare Workers (V8 isolates at the edge)
- **DB driver:** `pg` (node-postgres) → `postgres` v3.4.7 (postgres.js — edge-compatible)
- **Auth change:** Removed Databricks CLI OAuth token refresh (not available on edge). Backend now uses `DATABASE_URL` with password auth only.
- **CORS:** Hono's built-in `cors()` middleware, configurable via `CORS_ORIGINS` env var
- **Config:** `backend/wrangler.jsonc` (worker name: `nyc-demo-api`, `nodejs_compat` flag)
- **All API endpoints preserved:** `/health`, `POST /registrations`, `GET /registrations`, `GET /registrations/stats`, `GET /topics`, `GET /dashboard-token`, `POST /genie/ask`

### Frontend: CRA → TanStack Start SSR on Cloudflare Workers

- **Build tool:** Create React App → [Vite 7](https://vite.dev/) (`v7.1.7`)
- **Router:** React Router v6 → [TanStack Router](https://tanstack.com/router) v1.132.0 (file-based routing)
- **Rendering:** Client-side SPA → Server-side rendered (SSR) at the edge via [TanStack Start](https://tanstack.com/start)
- **CSS:** Tailwind CDN → Tailwind CSS v4 as a build dependency with `@theme` directive
- **Env vars:** `REACT_APP_API_URL` → `VITE_API_URL` (Vite convention)
- **Config:** `frontend/wrangler.jsonc` (worker name: `nyc-demo-web`)
- **All React components preserved** — Registration flow, Dashboard, Map, Charts, Embedded Dashboard

### Monorepo: npm → pnpm workspace

- Root `pnpm-workspace.yaml` with `frontend` and `backend` packages
- `pnpm@9.15.4` as package manager
- Single lockfile (`pnpm-lock.yaml`)

### What Zephyr Cloud Adds

Zephyr Cloud is a deployment orchestration layer on top of Cloudflare Workers:
- **Sub-second deploys** via smart diffing (only uploads changed chunks)
- **Preview deploys per branch/PR** — every push gets its own URL
- **Module Federation** support — independently deploy app segments
- **Version management + instant rollback**
- **Dynamic worker loaders** — update workers without full redeploy

```
Without Zephyr:  code → wrangler deploy → Cloudflare Workers (~15-20s)
With Zephyr:     code → zephyr deploy  → Zephyr orchestration → Cloudflare Workers (sub-second)
```

---

## Migration Timeline

### Step 1: Fork + Rewrite (Zack Chapple — Feb 24, 2026)

Zack forked `jneil17/nyc_app` to `zackarychapple/nyc_app` and opened [PR #1](https://github.com/zackarychapple/nyc_app/pull/1) (`chore/zephyr` → `main`):
- Converted backend from Express to Hono
- Converted frontend from CRA to TanStack Start
- Switched from npm to pnpm workspace
- 37 files changed, +5,111 / -11,113 lines

PR was authored by Nestor (`Nsttt`) and merged into Zack's fork.

### Step 2: Cherry-pick into our repo (Mar 4, 2026)

- Added Zack's fork as git remote (`zack`)
- Created `zephyr` branch from `main`
- Cherry-picked 2 commits: pnpm migration + Hono/TanStack rewrite
- Resolved merge conflicts (deleted old `backend/db.js` and `backend/server.js`)
- Pushed `zephyr` branch to `jneil17/nyc_app`
- Branch: https://github.com/jneil17/nyc_app/tree/zephyr

### Step 3: Direct Cloudflare Workers deploy (Mar 4, 2026)

Deployed both workers directly via `wrangler deploy` (without Zephyr, as baseline):

**Backend (`nyc-demo-api`):**
- Set secrets via `wrangler secret put`: `DATABASE_URL`, `DATABRICKS_WORKSPACE_URL`, `DATABRICKS_SP_CLIENT_ID`, `DATABRICKS_SP_CLIENT_SECRET`
- Deployed: `https://nyc-demo-api.jwneil17.workers.dev`
- Upload size: 167.35 KiB / gzip: 41.47 KiB
- Deploy time: ~16 seconds (upload + triggers)

**Frontend (`nyc-demo-web`):**
- Built via `pnpm build:frontend` (Vite, ~3.2s)
- Deployed: `https://nyc-demo-web.jwneil17.workers.dev`
- Upload size: 2070.79 KiB / gzip: 415.69 KiB (14 static assets + 7 server modules)
- Deploy time: ~28 seconds (upload + triggers)

**Status:** Workers deployed, SSL certificates provisioning on new `*.workers.dev` subdomains.

### Step 4: Cloudflare account setup (Mar 4, 2026)

- Authenticated via `npx wrangler login` (email: `jwneil17@gmail.com`)
- Account ID: `ccc050cc099a5c87047a652169617a76`
- Shared with Zack for Zephyr private beta access

### Step 5: Zephyr Cloud integration (PENDING)

- Waiting for Zack to add account to Zephyr private beta
- Will add Zephyr config to project
- Will compare deploy times: Amplify (~2 min) vs raw Wrangler (~30s) vs Zephyr (target: sub-second)

---

## Deploy Time Comparison (to be filled in)

| Method | Build Time | Deploy Time | Total | Notes |
|--------|-----------|-------------|-------|-------|
| AWS Amplify (CRA + Express) | ~60-90s | ~30s | ~2 min | Current production |
| Wrangler direct (Vite + Hono) | ~3.2s | ~28s | ~31s | Baseline without Zephyr |
| Zephyr Cloud | TBD | TBD | TBD | Target: sub-second |

---

## Files Changed (reference)

Key files in the `zephyr` branch vs `main`:

```
ADDED:
  backend/.dev.vars.example        # Cloudflare Workers local secrets template
  backend/README.md                # Backend-specific docs
  backend/src/index.ts             # Hono server (replaces server.js)
  backend/tsconfig.json            # TypeScript config
  backend/wrangler.jsonc           # Cloudflare Workers config
  frontend/eslint.config.js        # ESLint flat config
  frontend/prettier.config.js      # Prettier config
  frontend/src/routeTree.gen.ts    # Auto-generated route tree
  frontend/src/router.tsx          # TanStack Router factory
  frontend/src/routes/__root.tsx   # Root layout (replaces index.html + App.js)
  frontend/src/routes/index.tsx    # Home route (/)
  frontend/src/routes/dashboard.tsx # Dashboard route (/dashboard)
  frontend/src/styles.css          # Tailwind CSS v4 theme
  frontend/tsconfig.json           # TypeScript config
  frontend/vite.config.ts          # Vite + TanStack Start + Cloudflare plugin
  frontend/wrangler.jsonc          # Cloudflare Workers config
  package.json                     # Root workspace orchestrator
  pnpm-workspace.yaml              # Workspace declaration
  pnpm-lock.yaml                   # Unified lockfile

REMOVED:
  backend/db.js                    # Old Postgres pool with OAuth refresh
  backend/server.js                # Old Express server
  frontend/public/index.html       # Old CRA HTML template
  frontend/src/App.js              # Old React Router setup
  frontend/src/index.js            # Old CRA entry point
  frontend/src/index.css           # Old styles

UNCHANGED:
  All React components (Registration/*, Dashboard/*, common/*)
  frontend/src/data/ (neighborhoods.json, us-states.json)
  frontend/src/services/api.js (minor env var change)
  databricks/ (NLP job, notebooks)
  scripts/ (demo_reset, seed_data)
```

---

## Next Steps

- [ ] Get Zephyr private beta access (Zack adding account ID)
- [ ] Add Zephyr config to project
- [ ] Deploy via Zephyr and measure times
- [ ] Set up Cloudflare DNS or keep Route 53
- [ ] Configure `VITE_API_URL` on frontend worker to point to backend worker URL
- [ ] Add CORS origin for frontend worker URL on backend
- [ ] Verify end-to-end: registration → LakeBase → dashboard
- [ ] Write up comparison article
