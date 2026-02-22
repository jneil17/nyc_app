const { Pool } = require('pg');
const { execSync } = require('child_process');

let cachedToken = null;
let tokenExpiry = 0;

function getOAuthToken() {
  const now = Date.now();
  // Refresh if token is expired or within 5 min of expiry
  if (cachedToken && now < tokenExpiry - 300_000) {
    return cachedToken;
  }
  try {
    const profile = process.env.DATABRICKS_PROFILE || 'dbc-eca83c32-b44b';
    const raw = execSync(`databricks auth token -p ${profile}`, { encoding: 'utf8' });
    const parsed = JSON.parse(raw);
    cachedToken = parsed.access_token;
    // Databricks OAuth tokens typically last 1 hour
    tokenExpiry = now + 3600_000;
    return cachedToken;
  } catch (err) {
    console.error('Failed to get Databricks OAuth token:', err.message);
    return cachedToken; // return stale token as fallback
  }
}

function createPool() {
  const useOAuth = process.env.LAKEBASE_AUTH === 'oauth';

  const config = {
    host: process.env.LAKEBASE_HOST,
    port: parseInt(process.env.LAKEBASE_PORT || '5432', 10),
    database: process.env.LAKEBASE_DB || 'databricks_postgres',
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };

  if (useOAuth) {
    config.user = process.env.LAKEBASE_USER || 'jwneil17@gmail.com';
    config.password = getOAuthToken;
  } else {
    config.user = process.env.LAKEBASE_USER;
    config.password = process.env.LAKEBASE_PASSWORD;
  }

  const pool = new Pool(config);
  pool.on('error', (err) => {
    console.error('Unexpected pool error:', err);
  });
  return pool;
}

const pool = createPool();
pool.getOAuthToken = getOAuthToken;
module.exports = pool;
