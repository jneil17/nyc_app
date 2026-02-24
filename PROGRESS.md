# PROGRESS.md — Development Log

> **Each agent logs what they actually did here.** This is the audit trail.
> Format: timestamp, agent name, what was done, what was verified, any issues found.
> Keep entries concise but specific enough that another agent (or the coordinator) can verify.

---

## Rules for Agents

1. **Log every significant action** — deployments, env var changes, infra changes, file deletions
2. **Include verification steps** — don't just say "done", show the command/output that proves it
3. **Flag surprises** — if you find something unexpected, log it here even if you fix it
4. **Never mark CLAUDE.md status as done unless you've verified it** — the coordinator will check

---

## Log

### 2026-02-22 — Claude 2 (Backend/Infra)

**Backend deployed to Amplify WEB_COMPUTE**
- App: `d1erxf8q87xlvj`, URL: `https://main.d1erxf8q87xlvj.amplifyapp.com`
- Buildspec set via AWS CLI (not in repo) — see CLAUDE.md for full spec
- Key gotchas discovered:
  - Amplify WEB_COMPUTE does NOT pass console env vars to compute runtime — must create `.env` file during build
  - `nodejs18.x` runtime not supported — use `nodejs20.x`
  - Don't use `applications:` with `appRoot:` format
- Env vars set: `DATABASE_URL`, `PORT`
- **NOT YET SET:** `DATABRICKS_WORKSPACE_URL`, `DATABRICKS_SP_CLIENT_ID`, `DATABRICKS_SP_CLIENT_SECRET` (see Task 7)
- Verified: `curl /health` returns `{"status":"ok","db":"connected"}`
- Verified: `curl /registrations` returns data after seeding

**Scripts created**
- `scripts/demo_reset.sh` — TRUNCATE with confirmation prompt, supports DATABASE_URL or OAuth
- `scripts/seed_data.sh` — 25 realistic registrations (7 Manhattan, 6 Brooklyn, 4 Queens, 2 Bronx, 1 Staten Island, 2 NY State, 3 other), idempotent via ON CONFLICT DO NOTHING
- Verified: Seed script ran successfully, 25 rows visible via API

**Cleanup**
- Deleted `backend/app.yaml` (contained plaintext secrets!)
- Deleted `backend/.databricks/` (wrong deployment path artifacts)
- Added both to `.gitignore`

**Task 10: --seed flag added to demo_reset.sh**
- `./scripts/demo_reset.sh --seed` — truncates and re-seeds in one command
- `./scripts/demo_reset.sh --seed -y` — skip confirmation prompt
- Calls `seed_data.sh` after truncate when `--seed` is passed

**Task 11: Databricks notebook demo reset created**
- `databricks/notebooks/demo_reset.py` — runs via UC catalog `nyc_demo_lakebase`
- `SEED_DATA = True` toggle at top of notebook
- Steps: check current state → truncate → optionally seed 25 rows → verify
- Uses `spark.sql()` for all operations (no direct PG connection needed)

**Task 12: NLP topic classification pipeline**
- Created `databricks/jobs/nlp_topic_classifier.py` — Databricks notebook
- Uses Foundation Model API (`databricks-claude-haiku-4-5`) for zero-shot classification
- 8 topic categories: AI/ML & GenAI, Data Engineering & ETL, Data Warehousing & Analytics, Platform Evaluation & Migration, Building Apps & Startups, Data Governance & Security, Learning & Education, Other
- Reads from `nyc_demo_lakebase.public.event_registrations` via UC
- Writes per-registration assignments to `registration_topics` (DELETE + INSERT via spark.sql)
- Writes aggregated counts + top_words to `topic_analysis`
- Created both tables in LakeBase with proper grants to `nyc_app` role
- Granted SP `4ae0de5c-dc08-49e8-9491-30ae1e81ecbd` SELECT on both new tables
- Uploaded notebook to workspace: `/Users/jwneil17@gmail.com/nyc_demo/nlp_topic_classifier`
- Also uploaded demo_reset notebook to same workspace folder
- Verified: `/topics` endpoint returns `[]` (no errors, table accessible but empty until notebook runs)

**Task 13: Genie API backend endpoint**
- Added `POST /genie/ask` endpoint to `backend/server.js`
- Flow: start-conversation → poll (1-3s backoff, max 60s) → fetch query-result → return combined response
- Response: `{answer, sql, columns, rows, suggested_questions, conversation_id, message_id}`
- SP permissions: granted `CAN_RUN` on Genie space `01f110512fd015ada6b59c70c0ef42a6`, `CAN_USE` on warehouse `e5f11d721479f35a`
- Deployed via Amplify build #28, verified on production

**Task 17: Security audit — CLEAN**
- Scanned full git history (`git log --all -p`) for: passwords, secrets, tokens, API keys, connection strings with embedded passwords, JWT tokens, AWS keys, GitHub tokens
- Scanned all tracked files for secret patterns
- Verified: `app.yaml` and `.databricks/` were **never committed** to git history
- Verified: `.env.example` contains only placeholders (no actual passwords)
- Verified: `CLAUDE.md` uses `<password>` and `<SP_SECRET_IN_BACKEND_ENV>` placeholders — no real values
- Verified: `scripts/demo_reset.sh` and `scripts/seed_data.sh` use OAuth token refresh — no hardcoded passwords
- Verified: `backend/db.js` reads all credentials from `process.env` — no hardcoded values
- `.gitignore` covers: `.env`, `.env.local`, `.env.production`, `.env.*.local`, `app.yaml`, `.databricks/`
- Added `*.png` exclusion to `.gitignore` (3 untracked screenshots were in repo root)
- **Result: No secrets found in tracked files or git history. No credential rotation needed.**

### 2026-02-22 — Claude 1 (Frontend/Dashboard)

**Task 13 frontend: Genie chat UI on dashboard page**
- Created `frontend/src/components/Dashboard/GenieChat.jsx` — self-contained chat component
- Added `askGenie()` function to `frontend/src/services/api.js`
- Integrated into `DashboardPage.jsx` between AI/BI Dashboard and Recent Responses sections
- Features:
  - Text input with Enter-to-submit + lava Ask button
  - 4 starter question chips (clickable)
  - Loading spinner ("Genie is thinking...")
  - Answer display in styled card
  - Data table with alternating rows (if query returns tabular data)
  - Collapsible SQL viewer (via `<details>`)
  - Suggested follow-up questions as clickable chips
  - Error handling for 400/502/504 responses
  - Responsive design (mobile-first, matches existing design system)
- Verified: `npm run build` succeeds with no errors (+1.5 kB gzip)
- Verified: Backend `POST /genie/ask` responds on production (tested "How many total registrations?" → "36")
- Design matches existing dashboard sections: white card, rounded-xl, shadow-md, lava accent icon

### 2026-02-22 — Claude 1 (Task 16: Enhanced Map)

**Task 16: Neighborhood boundaries + surrounding states**
- Rewrote `NYCMap.jsx` from 5 borough polygons to 3-layer architecture:
  1. **Layer 1 (bottom):** Surrounding states (NY, NJ, CT, PA, MA) — muted navy fill, 110KB GeoJSON from Census 500k
  2. **Layer 2 (middle):** 197 NTA neighborhood polygons — lava gradient by registration density
  3. **Layer 3 (top):** Borough boundary outlines — 2.5px navy, no fill, non-interactive
- Created `frontend/src/data/neighborhoodToNtaMap.js` — 60 curated neighborhood names mapped to NTA GeoJSON feature names
  - Handles one-to-many (e.g., "Upper East Side" → 3 NTA polygons) and many-to-one (e.g., "Red Hook" + "Cobble Hill" → same polygon)
- Created `frontend/public/surrounding_states.geojson` — 5 states, MultiPolygon geometry, 110KB
- Dynamic style updates via `ref.eachLayer().setStyle()` — no flicker on 10s poll refresh
- Two-row legend: Neighborhoods (lava gradient) + Tri-State (navy gradient) + borough line indicator
- `minZoom={7}` allows zooming out to see surrounding states
- Verified: build passes, dev server renders all 3 layers, no console errors, tooltips show borough + count

### 2026-02-22 — Claude 3 (UI Polish)

**Task 9: Mobile responsiveness**
- Responsive Tailwind classes on Header, LocationSelector, DashboardPage, RegistrationCharts, EmbeddedDashboard
- Tested at 375px viewport

**Task 14: Registration flow polish**
- Hover states, lava accents, smooth transitions on all steps
- Character count indicator on ReasonInput
- Consistent design system colors and spacing

**Task 15: Dashboard layout polish**
- Stats bar balanced with icons
- Consistent section gaps, clean table styling
- Live update indicator, professional layout

### 2026-02-22 — Claude 1 (Frontend — continued)

**Task 8: AIBI Dashboard embed fixed**
- Fixed 3 issues to get the embedded Databricks dashboard rendering:
  1. SP needed `CAN_RUN` permission (not just `CAN_READ`)
  2. Implemented 3-step scoped embed token flow (all-apis token → tokeninfo → scoped embed token)
  3. Added `dbxdemonyc.com` to workspace `aibi_dash_embed_ws_apprvd_domains` allowlist
- Dashboard now renders inline with all chart widgets
- Container height set to 800px (later reduced to 530px)

**Task 18: README written**
- Comprehensive README.md with: architecture diagram, tech stack table, features list, getting started guide, API reference, deployment guide with Amplify gotchas, Databricks setup, demo day playbook, troubleshooting table, project structure
- MIT license

### 2026-02-22/23 — Coordinator Review & Wrap-up

**Initial status check findings (early session):**
- Backend reads and writes confirmed working via curl
- Frontend had NO `REACT_APP_API_URL` set — fixed by Claude 1
- Backend was missing 3 SP env vars — fixed by Claude 2
- Both agent branches (claude-1, claude-2) were stale/behind main — rebased

**Multi-agent workflow improvements implemented:**
- Created TASKS.md as single source of truth for task assignments
- Created PROGRESS.md as audit trail with verification proof
- Added agent workflow rules to CLAUDE.md
- Added Claude 3 role (UI polish only) with strict boundaries

**Infrastructure cost analysis (end of session):**
- Databricks: ~$2-4/day active, near-zero idle (SQL Warehouse auto-stops)
  - Feb 22: $3.65 (SQL Warehouse $2.37, Jobs $1.04, LakeBase $0.18)
  - Feb total (all-time): ~82 DBUs ≈ $50-55
- AWS: <$7/mo total (Amplify Static + WEB_COMPUTE + Route 53)
- No overnight cost risk — SQL Warehouse auto-stops after 10min, LakeBase autoscaling idles

**Final state — all P0/P1/P2/P3 tasks complete:**
- 18 tasks completed across 3 agents in a single session
- Live at dbxdemonyc.com with full end-to-end flow
- No secrets in repo (security audit clean)
- README ready for open-source sharing

### 2026-02-22 — Coordinator (Session 2: Architecture Docs + Wrap-up)

**Task 19: Architecture diagrams created**
- `docs/architecture.html` — Presentable reference architecture (slide-style)
  - Horizontal columnar layout: Serve > Process > Store > Govern & Query > Analyse & AI
  - Color-coded component boxes (Databricks=lava, LakeBase=green, App Code=blue, AWS=navy)
  - External users on left with SVG arrows, "Databricks Data Intelligence Platform + AWS" banner
  - Data flow strip, legend with color key
  - Designed to match Databricks reference architecture style
- `docs/architecture_detailed.html` — Deep technical reference
  - Vertical stacked layout with full API endpoints, auth flows, cost breakdown, SP permissions
  - Complete infrastructure details for any engineer to understand the system

**Task 20: Databricks branding (by Claude 3)**
- Header logo replaced with official Databricks lockup from CDN
- Dashboard "Powered by" section uses logo instead of Font Awesome icon
- Logo CDN URL added to CLAUDE.md design system section

**End-of-day state:**
- 20 tasks completed total (18 from session 1 + 2 from session 2)
- All changes committed and pushed to main
- Backlog remaining: topic-colored choropleth, teardown script

### 2026-02-24 — Codex (Stack Migration)

**Backend migrated: Express -> Hono on Cloudflare Workers**
- Replaced `backend/server.js` + `backend/db.js` with worker entry: `backend/src/index.ts`
- Implemented same API surface in Hono:
  - `GET /health`
  - `POST /registrations`
  - `GET /registrations`
  - `GET /registrations/stats`
  - `GET /topics`
  - `GET /dashboard-token`
  - `POST /genie/ask`
- Preserved Databricks 3-step dashboard token flow + Genie conversation polling flow
- Added worker runtime config:
  - `backend/wrangler.jsonc`
  - `backend/tsconfig.json`
  - `backend/.dev.vars.example`
- Verified: `pnpm --filter nyc-demo-backend typecheck` passes

**Frontend migrated: CRA -> TanStack Start SSR (Cloudflare adapter)**
- Replaced CRA app shell/router with TanStack Start:
  - `frontend/src/routes/__root.tsx`
  - `frontend/src/routes/index.tsx`
  - `frontend/src/routes/dashboard.tsx`
  - `frontend/src/router.tsx`
  - `frontend/vite.config.ts`
  - `frontend/wrangler.jsonc`
- Removed old CRA entry points:
  - `frontend/src/index.js`
  - `frontend/src/index.css`
  - `frontend/src/App.js`
- Kept existing UI/features (registration flow, dashboard, map, charts, embed, Genie chat)
- Updated navigation and in-app links to TanStack Router (`@tanstack/react-router`)
- Updated API env usage from `REACT_APP_API_URL` -> `VITE_API_URL`
- Added Tailwind v4 theme tokens for existing lava/navy/oat utility classes in `frontend/src/styles.css`
- Verified:
  - `pnpm --filter frontend lint` passes
  - `pnpm --filter frontend build` passes (client + SSR)

**Workspace updates**
- Updated root scripts + package metadata for new runtime model
- Updated `.env.example` for Worker vars + `VITE_API_URL`
- Updated README sections for Cloudflare + TanStack Start + Hono stack
