require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getPool, switchBranch, getCurrentBranch, getAvailableBranches } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: [
    'https://dbxdemonyc.com',
    'https://www.dbxdemonyc.com',
    'https://dx7u5ga7qr7e7.amplifyapp.com',
    'https://main.dx7u5ga7qr7e7.amplifyapp.com',
    'https://main.d1erxf8q87xlvj.amplifyapp.com',
    'http://localhost:3000',
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
}));
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
  try {
    await getPool().query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected', message: err.message });
  }
});

// POST /registrations — insert a new registration
app.post('/registrations', async (req, res) => {
  const { user_id, location_type, borough, neighborhood, state, reason } = req.body;

  if (!user_id || !location_type || !reason) {
    return res.status(400).json({ error: 'user_id, location_type, and reason are required' });
  }

  try {
    const result = await getPool().query(
      `INSERT INTO event_registrations (user_id, location_type, borough, neighborhood, state, reason)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [user_id, location_type, borough || null, neighborhood || null, state || null, reason]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Insert error:', err);
    res.status(500).json({ error: 'Failed to save registration' });
  }
});

// GET /registrations — fetch all registrations (for dashboard polling)
app.get('/registrations', async (req, res) => {
  try {
    const result = await getPool().query(
      `SELECT user_id, location_type, borough, neighborhood, state, reason, created_at
       FROM event_registrations
       ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// GET /registrations/stats — aggregated counts for the map
app.get('/registrations/stats', async (req, res) => {
  try {
    const boroughCounts = await getPool().query(
      `SELECT borough, COUNT(*) as count
       FROM event_registrations
       WHERE borough IS NOT NULL
       GROUP BY borough
       ORDER BY count DESC`
    );

    const neighborhoodCounts = await getPool().query(
      `SELECT borough, neighborhood, COUNT(*) as count
       FROM event_registrations
       WHERE neighborhood IS NOT NULL
       GROUP BY borough, neighborhood
       ORDER BY count DESC`
    );

    const totalCount = await getPool().query(
      `SELECT COUNT(*) as count FROM event_registrations`
    );

    res.json({
      total: parseInt(totalCount.rows[0].count, 10),
      by_borough: boroughCounts.rows,
      by_neighborhood: neighborhoodCounts.rows,
    });
  } catch (err) {
    console.error('Stats query error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /topics — fetch topic analysis (from NLP pipeline, synced back to LakeBase)
app.get('/topics', async (req, res) => {
  try {
    const result = await getPool().query(
      `SELECT topic_label, topic_count, top_words, updated_at
       FROM topic_analysis
       ORDER BY topic_count DESC`
    );
    res.json(result.rows);
  } catch (err) {
    if (err.code === '42P01') {
      return res.json([]);
    }
    console.error('Topics query error:', err);
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

// ── Branch switching (for demo) ──────────────────────────────────────
// GET /admin/branch — show current branch info
app.get('/admin/branch', (req, res) => {
  res.json({
    current: getCurrentBranch(),
    available: getAvailableBranches(),
  });
});

// POST /admin/switch-branch — switch active database branch
app.post('/admin/switch-branch', (req, res) => {
  const { branch } = req.body;
  if (!branch) {
    return res.status(400).json({ error: 'branch is required' });
  }
  try {
    const result = switchBranch(branch);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Dashboard embed token (3-step flow for external embedding)
const DASHBOARD_ID = '01f1103d19bc175083fbb5392f987e10';

// Cache for the SP all-apis token (used in step 1 & 2)
let spToken = null;
let spTokenExpiry = 0;

// Cache for the scoped embed token (used by frontend)
let embedToken = null;
let embedTokenExpiry = 0;

async function getSpToken() {
  const now = Date.now();
  if (spToken && now < spTokenExpiry - 60_000) return spToken;

  const clientId = process.env.DATABRICKS_SP_CLIENT_ID;
  const clientSecret = process.env.DATABRICKS_SP_CLIENT_SECRET;
  const workspaceUrl = process.env.DATABRICKS_WORKSPACE_URL;
  if (!clientId || !clientSecret || !workspaceUrl) {
    throw new Error('Service principal credentials not configured');
  }

  const res = await fetch(`${workspaceUrl.replace(/\/$/, '')}/oidc/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'all-apis',
    }),
  });
  if (!res.ok) throw new Error(`SP token failed (${res.status}): ${await res.text()}`);

  const data = await res.json();
  spToken = data.access_token;
  spTokenExpiry = now + (data.expires_in || 3600) * 1000;
  return spToken;
}

async function getEmbedToken() {
  const now = Date.now();
  if (embedToken && now < embedTokenExpiry - 120_000) return embedToken;

  const clientId = process.env.DATABRICKS_SP_CLIENT_ID;
  const clientSecret = process.env.DATABRICKS_SP_CLIENT_SECRET;
  const workspaceUrl = process.env.DATABRICKS_WORKSPACE_URL.replace(/\/$/, '');

  // Step 1: Get SP all-apis token
  const allApisToken = await getSpToken();

  // Step 2: Get tokeninfo (authorization_details + scope for embed)
  const infoRes = await fetch(
    `${workspaceUrl}/api/2.0/lakeview/dashboards/${DASHBOARD_ID}/published/tokeninfo?external_viewer_id=demo_viewer`,
    { headers: { Authorization: `Bearer ${allApisToken}` } }
  );
  if (!infoRes.ok) throw new Error(`tokeninfo failed (${infoRes.status}): ${await infoRes.text()}`);
  const tokenInfo = await infoRes.json();

  // Step 3: Exchange for scoped embed token
  const scopedRes = await fetch(`${workspaceUrl}/oidc/v1/token`, {
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
  });
  if (!scopedRes.ok) throw new Error(`Scoped token failed (${scopedRes.status}): ${await scopedRes.text()}`);

  const scopedData = await scopedRes.json();
  embedToken = scopedData.access_token;
  embedTokenExpiry = now + (scopedData.expires_in || 3600) * 1000;
  return embedToken;
}

// GET /dashboard-token — mint a scoped embed token for the Databricks dashboard
app.get('/dashboard-token', async (req, res) => {
  try {
    const token = await getEmbedToken();
    res.json({ token });
  } catch (err) {
    console.error('Dashboard token error:', err);
    res.status(503).json({ error: 'Dashboard token unavailable' });
  }
});

// ── Genie API (natural language Q&A on event data) ──────────────────
const GENIE_SPACE_ID = '01f110512fd015ada6b59c70c0ef42a6';

// POST /genie/ask — start a Genie conversation and poll until complete
app.post('/genie/ask', async (req, res) => {
  const { question } = req.body;
  if (!question || typeof question !== 'string' || question.trim().length < 3) {
    return res.status(400).json({ error: 'question is required (min 3 chars)' });
  }

  try {
    const token = await getSpToken();
    const workspaceUrl = process.env.DATABRICKS_WORKSPACE_URL.replace(/\/$/, '');

    // Step 1: Start conversation
    const startRes = await fetch(
      `${workspaceUrl}/api/2.0/genie/spaces/${GENIE_SPACE_ID}/start-conversation`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: question.trim() }),
      }
    );
    if (!startRes.ok) {
      const body = await startRes.text();
      console.error(`Genie start-conversation failed (${startRes.status}):`, body);
      return res.status(502).json({ error: 'Failed to start Genie conversation' });
    }

    const startData = await startRes.json();
    const conversationId = startData.conversation_id;
    const messageId = startData.message_id;

    // Step 2: Poll for completion (max 60s, backoff from 1s to 3s)
    let delay = 1000;
    const maxPolls = 30;
    let message = null;

    for (let i = 0; i < maxPolls; i++) {
      await new Promise((r) => setTimeout(r, delay));
      if (delay < 3000) delay += 500;

      const pollRes = await fetch(
        `${workspaceUrl}/api/2.0/genie/spaces/${GENIE_SPACE_ID}/conversations/${conversationId}/messages/${messageId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!pollRes.ok) continue;

      message = await pollRes.json();
      if (message.status === 'COMPLETED' || message.status === 'FAILED') break;
    }

    if (!message || (message.status !== 'COMPLETED' && message.status !== 'FAILED')) {
      return res.status(504).json({ error: 'Genie query timed out' });
    }

    if (message.status === 'FAILED') {
      return res.status(502).json({ error: 'Genie query failed' });
    }

    // Step 3: Extract results from attachments
    const attachments = message.attachments || [];
    let answer = null;
    let sql = null;
    let queryResultAttachmentId = null;
    let suggestedQuestions = [];

    for (const a of attachments) {
      if (a.text) answer = a.text.content;
      if (a.query) {
        sql = a.query.query;
        queryResultAttachmentId = a.attachment_id;
      }
      if (a.suggested_questions) {
        suggestedQuestions = a.suggested_questions.questions || [];
      }
    }

    // Step 4: Fetch query result data if available
    let columns = [];
    let rows = [];
    if (queryResultAttachmentId) {
      try {
        const resultRes = await fetch(
          `${workspaceUrl}/api/2.0/genie/spaces/${GENIE_SPACE_ID}/conversations/${conversationId}/messages/${messageId}/query-result/${queryResultAttachmentId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (resultRes.ok) {
          const resultData = await resultRes.json();
          const sr = resultData.statement_response || {};
          columns = (sr.manifest?.schema?.columns || []).map((c) => c.name);
          rows = sr.result?.data_array || [];
        }
      } catch (e) {
        console.error('Genie query-result fetch error:', e.message);
      }
    }

    res.json({
      answer,
      sql,
      columns,
      rows,
      suggested_questions: suggestedQuestions.slice(0, 3),
      conversation_id: conversationId,
      message_id: messageId,
    });
  } catch (err) {
    console.error('Genie ask error:', err);
    res.status(500).json({ error: 'Genie query failed' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`NYC Demo API running on port ${PORT}`);
});
