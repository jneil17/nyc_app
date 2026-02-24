import { Hono } from 'hono'
import { cors } from 'hono/cors'
import postgres, { type Sql } from 'postgres'

type Bindings = {
  DATABASE_URL?: string
  LAKEBASE_HOST?: string
  LAKEBASE_PORT?: string
  LAKEBASE_DB?: string
  LAKEBASE_USER?: string
  LAKEBASE_PASSWORD?: string
  DATABRICKS_WORKSPACE_URL?: string
  DATABRICKS_SP_CLIENT_ID?: string
  DATABRICKS_SP_CLIENT_SECRET?: string
  DATABRICKS_DASHBOARD_ID?: string
  DATABRICKS_GENIE_SPACE_ID?: string
  CORS_ORIGINS?: string
}

type RegistrationRow = {
  user_id: string
  location_type: string
  borough: string | null
  neighborhood: string | null
  state: string | null
  reason: string
  created_at: string
}

type TopicRow = {
  topic_label: string
  topic_count: number | string
  top_words: string | null
  updated_at: string
}

const DEFAULT_DASHBOARD_ID = '01f1103d19bc175083fbb5392f987e10'
const DEFAULT_GENIE_SPACE_ID = '01f110512fd015ada6b59c70c0ef42a6'

const defaultAllowedOrigins = [
  'https://dbxdemonyc.com',
  'https://www.dbxdemonyc.com',
  'https://dx7u5ga7qr7e7.amplifyapp.com',
  'https://main.dx7u5ga7qr7e7.amplifyapp.com',
  'https://main.d1erxf8q87xlvj.amplifyapp.com',
  'http://localhost:3000',
  'http://localhost:5173',
]

let sqlClient: Sql | null = null
let sqlConnectionKey = ''

let spToken: string | null = null
let spTokenExpiry = 0
let embedToken: string | null = null
let embedTokenExpiry = 0

const app = new Hono<{ Bindings: Bindings }>()

app.use('/*', async (c, next) => {
  const allowed = getAllowedOrigins(c.env)
  return cors({
    origin: (origin) => {
      if (!origin) return undefined
      return allowed.has(origin) ? origin : undefined
    },
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })(c, next)
})

app.get('/health', async (c) => {
  try {
    const sql = getSql(c.env)
    await sql`SELECT 1`
    return c.json({ status: 'ok', db: 'connected' })
  } catch (error) {
    return c.json({ status: 'error', db: 'disconnected', message: errorMessage(error) }, 503)
  }
})

app.post('/registrations', async (c) => {
  const payload = await c.req.json<Partial<RegistrationRow>>().catch(() => null)
  if (!payload?.user_id || !payload?.location_type || !payload?.reason) {
    return c.json({ error: 'user_id, location_type, and reason are required' }, 400)
  }

  try {
    const sql = getSql(c.env)
    const [created] = await sql<RegistrationRow[]>`
      INSERT INTO event_registrations (user_id, location_type, borough, neighborhood, state, reason)
      VALUES (
        ${payload.user_id},
        ${payload.location_type},
        ${payload.borough ?? null},
        ${payload.neighborhood ?? null},
        ${payload.state ?? null},
        ${payload.reason}
      )
      RETURNING user_id, location_type, borough, neighborhood, state, reason, created_at
    `

    return c.json(created, 201)
  } catch (error) {
    console.error('Insert error:', error)
    return c.json({ error: 'Failed to save registration' }, 500)
  }
})

app.get('/registrations', async (c) => {
  try {
    const sql = getSql(c.env)
    const rows = await sql<RegistrationRow[]>`
      SELECT user_id, location_type, borough, neighborhood, state, reason, created_at
      FROM event_registrations
      ORDER BY created_at DESC
    `
    return c.json(rows)
  } catch (error) {
    console.error('Query error:', error)
    return c.json({ error: 'Failed to fetch registrations' }, 500)
  }
})

app.get('/registrations/stats', async (c) => {
  try {
    const sql = getSql(c.env)

    const [boroughCounts, neighborhoodCounts, totalCountRows] = await Promise.all([
      sql<{ borough: string; count: string }[]>`
        SELECT borough, COUNT(*)::text AS count
        FROM event_registrations
        WHERE borough IS NOT NULL
        GROUP BY borough
        ORDER BY COUNT(*) DESC
      `,
      sql<{ borough: string; neighborhood: string; count: string }[]>`
        SELECT borough, neighborhood, COUNT(*)::text AS count
        FROM event_registrations
        WHERE neighborhood IS NOT NULL
        GROUP BY borough, neighborhood
        ORDER BY COUNT(*) DESC
      `,
      sql<{ count: string }[]>`
        SELECT COUNT(*)::text AS count
        FROM event_registrations
      `,
    ])

    return c.json({
      total: Number.parseInt(totalCountRows[0]?.count ?? '0', 10),
      by_borough: boroughCounts,
      by_neighborhood: neighborhoodCounts,
    })
  } catch (error) {
    console.error('Stats query error:', error)
    return c.json({ error: 'Failed to fetch stats' }, 500)
  }
})

app.get('/topics', async (c) => {
  try {
    const sql = getSql(c.env)
    const rows = await sql<TopicRow[]>`
      SELECT topic_label, topic_count, top_words, updated_at
      FROM topic_analysis
      ORDER BY topic_count DESC
    `
    return c.json(rows)
  } catch (error) {
    if (isTableMissing(error)) {
      return c.json([])
    }
    console.error('Topics query error:', error)
    return c.json({ error: 'Failed to fetch topics' }, 500)
  }
})

app.get('/dashboard-token', async (c) => {
  try {
    const token = await getEmbedToken(c.env)
    return c.json({ token })
  } catch (error) {
    console.error('Dashboard token error:', error)
    return c.json({ error: 'Dashboard token unavailable' }, 503)
  }
})

app.post('/genie/ask', async (c) => {
  const payload = await c.req.json<{ question?: string }>().catch(() => null)
  const question = payload?.question?.trim()

  if (!question || question.length < 3) {
    return c.json({ error: 'question is required (min 3 chars)' }, 400)
  }

  try {
    const token = await getSpToken(c.env)
    const workspaceUrl = getWorkspaceUrl(c.env)
    const spaceId = c.env.DATABRICKS_GENIE_SPACE_ID ?? DEFAULT_GENIE_SPACE_ID

    const startResponse = await fetch(`${workspaceUrl}/api/2.0/genie/spaces/${spaceId}/start-conversation`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: question }),
    })

    if (!startResponse.ok) {
      console.error('Genie start-conversation failed:', await safeText(startResponse))
      return c.json({ error: 'Failed to start Genie conversation' }, 502)
    }

    const startData = (await startResponse.json()) as { conversation_id: string; message_id: string }
    const conversationId = startData.conversation_id
    const messageId = startData.message_id

    let delay = 1000
    const maxPolls = 30
    let message: Record<string, any> | null = null

    for (let i = 0; i < maxPolls; i++) {
      await sleep(delay)
      if (delay < 3000) delay += 500

      const pollResponse = await fetch(
        `${workspaceUrl}/api/2.0/genie/spaces/${spaceId}/conversations/${conversationId}/messages/${messageId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )

      if (!pollResponse.ok) continue

      message = (await pollResponse.json()) as Record<string, any>
      if (message.status === 'COMPLETED' || message.status === 'FAILED') break
    }

    if (!message || (message.status !== 'COMPLETED' && message.status !== 'FAILED')) {
      return c.json({ error: 'Genie query timed out' }, 504)
    }

    if (message.status === 'FAILED') {
      return c.json({ error: 'Genie query failed' }, 502)
    }

    const attachments = Array.isArray(message.attachments) ? message.attachments : []
    let answer: string | null = null
    let sqlQuery: string | null = null
    let queryResultAttachmentId: string | null = null
    let suggestedQuestions: string[] = []

    for (const attachment of attachments) {
      if (attachment?.text?.content) {
        answer = attachment.text.content
      }
      if (attachment?.query?.query) {
        sqlQuery = attachment.query.query
        queryResultAttachmentId = attachment.attachment_id
      }
      if (attachment?.suggested_questions?.questions) {
        suggestedQuestions = attachment.suggested_questions.questions
      }
    }

    let columns: string[] = []
    let rows: unknown[] = []

    if (queryResultAttachmentId) {
      try {
        const resultResponse = await fetch(
          `${workspaceUrl}/api/2.0/genie/spaces/${spaceId}/conversations/${conversationId}/messages/${messageId}/query-result/${queryResultAttachmentId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        )

        if (resultResponse.ok) {
          const resultData = (await resultResponse.json()) as Record<string, any>
          const statementResponse = resultData.statement_response ?? {}
          columns = (statementResponse.manifest?.schema?.columns ?? []).map((item: { name: string }) => item.name)
          rows = statementResponse.result?.data_array ?? []
        }
      } catch (error) {
        console.error('Genie query-result fetch error:', error)
      }
    }

    return c.json({
      answer,
      sql: sqlQuery,
      columns,
      rows,
      suggested_questions: suggestedQuestions.slice(0, 3),
      conversation_id: conversationId,
      message_id: messageId,
    })
  } catch (error) {
    console.error('Genie ask error:', error)
    return c.json({ error: 'Genie query failed' }, 500)
  }
})

export default app

function getAllowedOrigins(env: Bindings) {
  const configured = (env.CORS_ORIGINS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  return new Set(configured.length > 0 ? configured : defaultAllowedOrigins)
}

function getWorkspaceUrl(env: Bindings) {
  const url = env.DATABRICKS_WORKSPACE_URL?.trim()
  if (!url) throw new Error('DATABRICKS_WORKSPACE_URL is required')
  return url.replace(/\/$/, '')
}

function getDatabaseUrl(env: Bindings) {
  if (env.DATABASE_URL?.trim()) return env.DATABASE_URL.trim()

  const host = env.LAKEBASE_HOST?.trim()
  const user = env.LAKEBASE_USER?.trim()
  const password = env.LAKEBASE_PASSWORD?.trim()
  const database = env.LAKEBASE_DB?.trim() || 'databricks_postgres'
  const port = env.LAKEBASE_PORT?.trim() || '5432'

  if (!host || !user || !password) {
    throw new Error('DATABASE_URL or LAKEBASE_HOST/LAKEBASE_USER/LAKEBASE_PASSWORD is required')
  }

  const encodedUser = encodeURIComponent(user)
  const encodedPassword = encodeURIComponent(password)
  return `postgresql://${encodedUser}:${encodedPassword}@${host}:${port}/${database}?sslmode=require`
}

function getSql(env: Bindings) {
  const connectionString = getDatabaseUrl(env)

  if (!sqlClient || sqlConnectionKey !== connectionString) {
    sqlClient = postgres(connectionString, {
      ssl: 'require',
      max: 10,
      idle_timeout: 30,
      connect_timeout: 10,
      prepare: false,
    })
    sqlConnectionKey = connectionString
  }

  return sqlClient
}

async function getSpToken(env: Bindings) {
  const now = Date.now()
  if (spToken && now < spTokenExpiry - 60_000) return spToken

  const clientId = env.DATABRICKS_SP_CLIENT_ID
  const clientSecret = env.DATABRICKS_SP_CLIENT_SECRET
  const workspaceUrl = getWorkspaceUrl(env)

  if (!clientId || !clientSecret) {
    throw new Error('Service principal credentials not configured')
  }

  const response = await fetch(`${workspaceUrl}/oidc/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'all-apis',
    }),
  })

  if (!response.ok) {
    throw new Error(`SP token failed (${response.status}): ${await safeText(response)}`)
  }

  const data = (await response.json()) as { access_token: string; expires_in?: number }
  spToken = data.access_token
  spTokenExpiry = now + (data.expires_in ?? 3600) * 1000

  return spToken
}

async function getEmbedToken(env: Bindings) {
  const now = Date.now()
  if (embedToken && now < embedTokenExpiry - 120_000) return embedToken

  const allApisToken = await getSpToken(env)
  const workspaceUrl = getWorkspaceUrl(env)
  const dashboardId = env.DATABRICKS_DASHBOARD_ID ?? DEFAULT_DASHBOARD_ID
  const clientId = env.DATABRICKS_SP_CLIENT_ID
  const clientSecret = env.DATABRICKS_SP_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Service principal credentials not configured')
  }

  const tokenInfoResponse = await fetch(
    `${workspaceUrl}/api/2.0/lakeview/dashboards/${dashboardId}/published/tokeninfo?external_viewer_id=demo_viewer`,
    {
      headers: { Authorization: `Bearer ${allApisToken}` },
    },
  )

  if (!tokenInfoResponse.ok) {
    throw new Error(`tokeninfo failed (${tokenInfoResponse.status}): ${await safeText(tokenInfoResponse)}`)
  }

  const tokenInfo = (await tokenInfoResponse.json()) as {
    scope: string
    custom_claim: string
    authorization_details: unknown
  }

  const scopedResponse = await fetch(`${workspaceUrl}/oidc/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: tokenInfo.scope,
      custom_claim: tokenInfo.custom_claim,
      authorization_details: JSON.stringify(tokenInfo.authorization_details),
    }),
  })

  if (!scopedResponse.ok) {
    throw new Error(`Scoped token failed (${scopedResponse.status}): ${await safeText(scopedResponse)}`)
  }

  const scopedData = (await scopedResponse.json()) as { access_token: string; expires_in?: number }
  embedToken = scopedData.access_token
  embedTokenExpiry = now + (scopedData.expires_in ?? 3600) * 1000

  return embedToken
}

function isTableMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const maybeError = error as { code?: string }
  return maybeError.code === '42P01'
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return 'unknown error'
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function safeText(response: Response) {
  try {
    return await response.text()
  } catch {
    return ''
  }
}
