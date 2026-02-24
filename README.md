# DBX Demo NYC

**A live event registration app showcasing Databricks as a complete platform for building production applications.**

Built for a NYC Founders event, this project demonstrates how [LakeBase](https://docs.databricks.com/aws/en/oltp/) (Databricks' managed Postgres), [Unity Catalog](https://docs.databricks.com/aws/en/data-governance/unity-catalog/), [AI/BI Dashboards](https://docs.databricks.com/aws/en/dashboards/), and [Foundation Model APIs](https://docs.databricks.com/aws/en/machine-learning/model-serving/score-foundation-models.html) work together in a real application.

**Live:** [dbxdemonyc.com](https://dbxdemonyc.com)

---

## What It Does

1. **Attendees register** via a 4-step wizard (location + what brought them here)
2. **Data writes to LakeBase** (Databricks' managed Postgres) in real time
3. **A live dashboard** shows registration data on an interactive NYC map, charts, and an embedded Databricks AI/BI Dashboard
4. **An NLP pipeline** on Databricks classifies free-text responses into topics using Foundation Model APIs (Claude Haiku)
5. **Genie Q&A** lets users ask natural language questions about the data (backend ready, UI coming soon)

---

## Architecture

```
                         dbxdemonyc.com
                              |
                    +---------+---------+
                    |                   |
              React Frontend      Hono API Worker
           (Cloudflare SSR)      (Cloudflare Workers)
                    |                   |
                    |     +-------------+-------------+
                    |     |             |             |
                    |   LakeBase    SP Token      Genie API
                    |  (Postgres)   (3-step)     (NL Q&A)
                    |     |             |
                    |     |      AIBI Dashboard
                    |     |       (embedded)
                    |     |
                    +-----+
                          |
              +-----------+-----------+
              |                       |
     Unity Catalog             NLP Pipeline
   (nyc_demo_lakebase)    (Foundation Model API)
              |                       |
     Federated Queries      Topic Classification
     for AI/BI Dashboard    (Claude Haiku)
```

**Data flow:** User submits registration -> Hono API Worker -> LakeBase (Postgres) -> Unity Catalog (federated) -> AI/BI Dashboard + NLP Pipeline

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | TanStack Start (SSR) + React + Tailwind CSS | Fast SPA with utility-first styling |
| Mapping | react-leaflet + CARTO tiles | Lightweight choropleth, no API key needed |
| Charts | recharts | Borough bar chart, location pie, responses table |
| Dashboard Embed | @databricks/aibi-client SDK | Native Lakeview dashboard embed via scoped SP token |
| Frontend Hosting | Cloudflare Workers (SSR) | SSR delivery at edge + wrangler deploy |
| Backend | Hono (Cloudflare Workers) | Edge API + Databricks token broker + Genie proxy |
| Backend Hosting | Cloudflare Workers | Low-latency global edge runtime |
| Database | LakeBase (Managed Postgres) | Databricks-native OLTP with UC integration |
| Data Platform | Databricks (Unity Catalog, SQL Warehouse) | Analytics + embedded dashboard |
| NLP | Foundation Model API (Claude Haiku) | Zero-shot topic classification |
| NL Q&A | Databricks Genie | Natural language queries on event data |

---

## Features

- **4-step registration wizard** — Location selection (NYC borough/neighborhood, NY State, or other US state) + free-text reason
- **Real-time NYC choropleth map** — Borough-level heatmap colored by registration density, auto-refreshes every 10s
- **Live charts** — Registrations by borough (bar), attendee origin breakdown (donut), recent responses table
- **Embedded Databricks AI/BI Dashboard** — Native Lakeview dashboard with counter, pie, area, bar, and table widgets
- **NLP topic classification** — Foundation Model API classifies free-text responses into topics like "AI/ML", "Data Engineering", etc.
- **Genie Q&A** (backend ready) — Natural language questions answered by Databricks Genie
- **Mobile responsive** — Usable on phone-sized screens (375px+)
- **Demo reset scripts** — Shell script and Databricks notebook to truncate + re-seed data

---

## Getting Started

### Prerequisites

- **Node.js** 18+ and **pnpm** (`npm install -g pnpm`)
- **Databricks CLI** (`databricks auth login`)
- **A Databricks workspace** with LakeBase enabled
- **psql** (PostgreSQL client) for database setup
- **AWS CLI** (optional, for deployment)

### 1. Clone and Install

```bash
git clone https://github.com/jneil17/nyc_app.git
cd nyc_app

# Install all workspace dependencies
pnpm install
```

### 2. Set Up LakeBase

Create a LakeBase instance in your Databricks workspace, then create the table:

```sql
CREATE TABLE IF NOT EXISTS public.event_registrations (
    user_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_type   VARCHAR(20) NOT NULL,
    borough         VARCHAR(50),
    neighborhood    VARCHAR(100),
    state           VARCHAR(50),
    reason          TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_registrations_borough ON public.event_registrations(borough);
CREATE INDEX idx_registrations_created ON public.event_registrations(created_at);
```

### 3. Register LakeBase in Unity Catalog

```bash
# Use the setup script or register manually via the Databricks UI
# This creates a UC catalog that federates queries to LakeBase
python databricks/setup/02_register_uc_catalog.py
```

### 4. Configure Environment

Copy the example env file and fill in your values:

```bash
# Use .env.example values as Wrangler vars
# backend: copy into backend/.dev.vars for local wrangler dev
# frontend: export VITE_API_URL in your shell
```

**For local development:**
```env
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/databricks_postgres?sslmode=require
DATABRICKS_WORKSPACE_URL=https://<your-workspace>.cloud.databricks.com
DATABRICKS_SP_CLIENT_ID=<service-principal-app-id>
DATABRICKS_SP_CLIENT_SECRET=<service-principal-secret>
VITE_API_URL=http://localhost:3001
```

**For production with a native PG role:**
```env
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/databricks_postgres?sslmode=require
DATABRICKS_WORKSPACE_URL=https://<your-workspace>.cloud.databricks.com
DATABRICKS_SP_CLIENT_ID=<service-principal-app-id>
DATABRICKS_SP_CLIENT_SECRET=<service-principal-secret>
```

### 5. Run Locally

```bash
# Terminal 1: Start backend
pnpm dev:backend

# Terminal 2: Start frontend
VITE_API_URL=http://localhost:3001 pnpm dev:frontend
```

Or run them individually from their directories:

```bash
cd backend && pnpm dev
cd frontend && pnpm dev
```

Visit `http://localhost:3000` — register, then check the dashboard.

### 6. Seed Test Data (Optional)

```bash
# Using DATABASE_URL
DATABASE_URL="postgresql://..." ./scripts/seed_data.sh

# Or build from existing env and run
./scripts/seed_data.sh
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | DB connectivity check |
| `POST` | `/registrations` | Submit a new registration |
| `GET` | `/registrations` | Fetch all registrations (dashboard polling) |
| `GET` | `/registrations/stats` | Aggregated borough/neighborhood counts |
| `GET` | `/topics` | NLP topic analysis results |
| `GET` | `/dashboard-token` | Scoped embed token for AIBI dashboard |
| `POST` | `/genie/ask` | Natural language Q&A via Databricks Genie |

### POST /registrations

```json
// Request
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "location_type": "nyc",
  "borough": "Manhattan",
  "neighborhood": "SoHo",
  "state": null,
  "reason": "I want to learn about building AI apps on Databricks"
}

// Response (201)
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "location_type": "nyc",
  "borough": "Manhattan",
  "neighborhood": "SoHo",
  "state": null,
  "reason": "I want to learn about building AI apps on Databricks",
  "created_at": "2026-02-22T20:00:00.000Z"
}
```

### POST /genie/ask

```json
// Request
{ "question": "How many people registered from Brooklyn?" }

// Response
{
  "answer": "There are 8 registrations from Brooklyn.",
  "sql": "SELECT COUNT(*) FROM event_registrations WHERE borough = 'Brooklyn'",
  "columns": ["count"],
  "rows": [["8"]],
  "suggested_questions": ["What neighborhoods are most popular?", "..."],
  "conversation_id": "...",
  "message_id": "..."
}
```

---

## Databricks Setup

### AI/BI Dashboard

The embedded dashboard is a Lakeview dashboard that queries LakeBase via the Unity Catalog federated catalog. To create your own:

1. Register your LakeBase instance as a UC catalog
2. Create a Lakeview dashboard with queries against the UC catalog
3. Publish the dashboard with `embed_credentials: true`
4. Create a Service Principal and grant it `CAN_RUN` on the dashboard + `CAN_USE` on the SQL warehouse + `SELECT` on the data

### Service Principal (for dashboard embedding)

The dashboard uses a 3-step token flow for external embedding:

1. **SP all-apis token** — standard OAuth client credentials grant
2. **tokeninfo** — `GET /api/2.0/lakeview/dashboards/{id}/published/tokeninfo` returns authorization details
3. **Scoped embed token** — exchange authorization details for a dashboard-specific token

You also need to add your domain to the workspace embed allowlist:
```
Settings > Security > External access > Embed dashboards > Add domain
```

### NLP Topic Classifier

The NLP pipeline (`databricks/jobs/nlp_topic_classifier.py`) uses the Foundation Model API to classify registration reasons into topics. It:

1. Reads unclassified registrations from `event_registrations` via UC
2. Sends each reason to Claude Haiku with a zero-shot classification prompt
3. Writes results to `topic_analysis` and `registration_topics` tables in LakeBase

### Genie Room

A Databricks Genie space is configured with the `event_registrations` table as a data source. The backend proxies natural language questions to the Genie Conversation API and returns structured results.

---

## Deployment

### Frontend (Cloudflare Workers + TanStack Start SSR)

The frontend is server-rendered with TanStack Start and deployed via Wrangler.

- **App Root:** `frontend`
- **Build:** `pnpm --filter frontend build`
- **Deploy:** `pnpm --filter frontend deploy`
- **Env var:** `VITE_API_URL=https://<your-backend-url>`

### Backend (Cloudflare Workers + Hono)

The backend is a Hono worker (no always-on server process) deployed via Wrangler.

- **App Root:** `backend`
- **Deploy:** `pnpm --filter nyc-demo-backend deploy`
- **Worker vars:** `DATABASE_URL`, `DATABRICKS_WORKSPACE_URL`, `DATABRICKS_SP_CLIENT_ID`, `DATABRICKS_SP_CLIENT_SECRET`

---

## Demo Day Playbook

### Before the Presentation

```bash
# Reset all data and re-seed with 25 fake registrations
./scripts/demo_reset.sh --seed -y
```

Or use the Databricks notebook: `databricks/notebooks/demo_reset.py`

### During the Presentation

1. **Show the registration flow** — Walk through the 4-step wizard on your phone
2. **Show the dashboard** — Point out the map, charts, and live counters updating in real time
3. **Show the Databricks dashboard** — Scroll to the embedded AIBI dashboard section
4. **Show the data in LakeBase** — Open psql or the Databricks UI to show the data flowing through
5. **Show the UC catalog** — Demonstrate federated queries from the Lakehouse to LakeBase

### Troubleshooting

| Issue | Fix |
|-------|-----|
| Dashboard shows "not available on this domain" | Add your domain to workspace embed allowlist |
| Dashboard shows placeholder | Check `/dashboard-token` endpoint returns a token |
| Map is blank | Check `/registrations` returns data |
| Registration fails | Check backend `/health` returns `{"status":"ok","db":"connected"}` |
| Backend 404 | Use branch-specific URL (`main.<app-id>.amplifyapp.com`) |

---

## Project Structure

```
nyc_app/
├── frontend/                  # TanStack Start SSR app
│   ├── src/
│   │   ├── components/
│   │   │   ├── Registration/  # 4-step wizard (LocationSelector, BoroughSelector, etc.)
│   │   │   ├── Dashboard/     # DashboardPage, NYCMap, RegistrationCharts, EmbeddedDashboard
│   │   │   └── common/        # Header
│   │   ├── data/              # neighborhoods.json, us-states.json
│   │   └── services/          # api.js (fetch client)
│   └── public/                # GeoJSON + static assets
├── backend/                   # Hono API (Cloudflare Worker)
│   └── src/index.ts           # All endpoints
├── databricks/
│   ├── setup/                 # UC catalog registration script
│   ├── jobs/                  # NLP topic classifier (Foundation Model API)
│   └── notebooks/             # Demo reset notebook
├── scripts/
│   ├── demo_reset.sh          # Truncate + optional re-seed
│   └── seed_data.sh           # Insert 25 realistic fake registrations
├── package.json               # pnpm workspace root
├── pnpm-workspace.yaml        # Workspace package definitions
├── CLAUDE.md                  # Full architecture docs + infrastructure details
├── TASKS.md                   # Task tracking board
└── .env.example               # Environment variable template
```

---

## License

MIT

---

Built with [Databricks](https://databricks.com) + [Claude Code](https://claude.ai/code)
