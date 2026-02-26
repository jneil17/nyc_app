# TASKS.md — Active Task Board

> **This is the single source of truth for what needs to be done.**
> Agents: Pick up tasks from here. Update status when you start/finish.
> Coordinator: Add new tasks here. Agents should check this file at the start of every session.

## How to Use
- **Claiming a task:** Change status to `IN PROGRESS` and add your agent name (e.g., `Claude 1`)
- **Completing a task:** Change status to `DONE`, add completion notes, and log details in PROGRESS.md
- **Blocked?** Mark as `BLOCKED`, note why, and move on to something else
- **New work discovered?** Add it to the Backlog section and tag the coordinator

---

## Active Tasks

### 21. Demo presentation deck — theming/formatting
- **Status:** DONE
- **Owner:** Coordinator
- **Details:** Apply Databricks brand theme from source pitch deck to target demo presentation. Navy backgrounds, lava accents, DM Sans fonts, logo placement. 5 slide templates created: title, content, section break, two-column, closing.
- **Deck:** https://docs.google.com/presentation/d/1w2fmKMqEUsjTvRO8Tj7BnqFw5C9BX-6UiLMO1I-CCJA/edit

### 22. Demo presentation deck — content
- **Status:** IN PROGRESS (separate agent)
- **Details:** Fill in slide content for tonight's NYC Founders demo presentation.

---

## Backlog (Future / Post-Demo)

### Topic-colored choropleth on map
- **Status:** ROADMAP
- **Details:** Color the NYC map by dominant topic per borough instead of just registration density. Depends on NLP pipeline (Task 12, done) populating `registration_topics`.

### Teardown script
- Clean up all infrastructure after the event

---

## Completed Tasks

| # | Task | Owner | Completed | Notes |
|---|------|-------|-----------|-------|
| 1 | Set REACT_APP_API_URL on frontend + rebuild | Claude 1 | 2026-02-22 | Frontend now hits backend API |
| 2 | End-to-end smoke test | Claude 1 | 2026-02-22 | Phone test confirmed working |
| 3 | Clean up secrets + Databricks App artifacts | Claude 2 | 2026-02-22 | Deleted app.yaml, .databricks/, updated .gitignore |
| 4 | Create demo reset script | Claude 2 | 2026-02-22 | `scripts/demo_reset.sh` |
| 5 | Create seed data script | Claude 2 | 2026-02-22 | `scripts/seed_data.sh` — 25 records, idempotent |
| 6 | Rebase claude-2 onto main | Claude 2 | 2026-02-22 | Branch up to date |
| 7 | Add SP env vars to backend Amplify | Claude 2 | 2026-02-22 | All 5 env vars set, /dashboard-token works |
| 8 | Verify AIBI dashboard embed on production | Claude 1 | 2026-02-22 | Fixed 3 issues: SP `CAN_RUN` permission, 3-step scoped embed token flow, domain allowlist (`dbxdemonyc.com` added to `aibi_dash_embed_ws_apprvd_domains`). Dashboard renders inline with all charts. Container height increased to 800px. |
| 9 | Mobile responsiveness polish | Claude 1/3 | 2026-02-22 | Responsive Tailwind classes on Header, LocationSelector, DashboardPage, RegistrationCharts, EmbeddedDashboard. Tested at 375px. |
| 10 | Add --seed flag to demo_reset.sh | Claude 2 | 2026-02-22 | `--seed` re-seeds after truncate, `-y` skips confirmation |
| 11 | Create Databricks notebook demo reset | Claude 2 | 2026-02-22 | `databricks/notebooks/demo_reset.py` — uses UC catalog, SEED_DATA toggle |
| 12 | Build NLP topic classification pipeline | Claude 2 | 2026-02-22 | `databricks/jobs/nlp_topic_classifier.py` — Claude Haiku via FMAPI, writes to topic_analysis + registration_topics |
| 13 | Genie API backend endpoint | Claude 2 | 2026-02-22 | `POST /genie/ask` — proxies to Databricks Genie, returns answer + SQL + data |
| 14 | Polish registration flow visual design | Claude 3 | 2026-02-22 | Hover states, lava accents, transitions, character count, design system consistency |
| 15 | Polish dashboard page layout and spacing | Claude 3 | 2026-02-22 | Stats bar balanced, consistent section gaps, clean table styling, professional layout |
| 16 | Enhanced map: neighborhood boundaries + surrounding states | Claude 1 | 2026-02-22 | 3-layer map: 197 NTA neighborhoods + borough outlines + tri-state. `neighborhoodToNtaMap.js`, `surrounding_states.geojson` |
| 17 | Security audit: scan repo for secrets | Claude 1 | 2026-02-22 | Clean — no secrets in tracked files or git history. `.gitignore` covers `.env`, `app.yaml`, `.databricks/`, `*.png`. |
| 18 | Write comprehensive README | Claude 1 | 2026-02-22 | Architecture diagram, tech stack, getting started, deployment, API reference, demo playbook |
| 13f | Genie chat UI on dashboard | Claude 1 | 2026-02-22 | `GenieChat.jsx` — input, starter questions, data table, SQL viewer, follow-ups |
| 19 | Architecture diagrams (presentable + detailed) | Coordinator | 2026-02-22 | `docs/architecture.html` (slide-style reference arch) + `docs/architecture_detailed.html` (deep technical) |
| 20 | Databricks logo branding | Claude 3 | 2026-02-22 | Header + Dashboard "Powered by" use official Databricks logo from CDN |
| 21 | Demo deck — Databricks theme formatting | Coordinator | 2026-02-26 | 5 themed slides: title, content, section break, two-column, closing. Navy/lava/oat palette, DM Sans, logos. |
