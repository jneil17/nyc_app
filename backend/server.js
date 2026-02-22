require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
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
    const result = await pool.query(
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
    const result = await pool.query(
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
    const boroughCounts = await pool.query(
      `SELECT borough, COUNT(*) as count
       FROM event_registrations
       WHERE borough IS NOT NULL
       GROUP BY borough
       ORDER BY count DESC`
    );

    const neighborhoodCounts = await pool.query(
      `SELECT borough, neighborhood, COUNT(*) as count
       FROM event_registrations
       WHERE neighborhood IS NOT NULL
       GROUP BY borough, neighborhood
       ORDER BY count DESC`
    );

    const totalCount = await pool.query(
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
    const result = await pool.query(
      `SELECT topic_label, topic_count, top_words, updated_at
       FROM topic_analysis
       ORDER BY topic_count DESC`
    );
    res.json(result.rows);
  } catch (err) {
    // Table may not exist yet if NLP pipeline hasn't run
    if (err.code === '42P01') {
      return res.json([]);
    }
    console.error('Topics query error:', err);
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

// GET /dashboard-token — mint a token for the embedded Databricks dashboard
app.get('/dashboard-token', (req, res) => {
  try {
    const token = pool.getOAuthToken();
    if (!token) {
      return res.status(503).json({ error: 'No token available' });
    }
    res.json({ token });
  } catch (err) {
    console.error('Token error:', err);
    res.status(500).json({ error: 'Failed to get dashboard token' });
  }
});

app.listen(PORT, () => {
  console.log(`NYC Demo API running on port ${PORT}`);
});
