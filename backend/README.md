# Backend (Hono + Cloudflare Workers)

## Scripts

```bash
pnpm dev        # wrangler dev on :3001
pnpm typecheck
pnpm deploy
```

## Local env

Create `backend/.dev.vars` (or copy from `.dev.vars.example`) and set:

- `DATABASE_URL` (preferred) or `LAKEBASE_HOST/USER/PASSWORD`
- `DATABRICKS_WORKSPACE_URL`
- `DATABRICKS_SP_CLIENT_ID`
- `DATABRICKS_SP_CLIENT_SECRET`

## API

- `GET /health`
- `POST /registrations`
- `GET /registrations`
- `GET /registrations/stats`
- `GET /topics`
- `GET /dashboard-token`
- `POST /genie/ask`
