const { Pool } = require('pg');
const { execSync } = require('child_process');

let cachedToken = null;
let tokenExpiry = 0;

function getOAuthToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry - 300_000) {
    return cachedToken;
  }
  try {
    const profile = process.env.DATABRICKS_PROFILE || 'dbc-eca83c32-b44b';
    const raw = execSync(`databricks auth token -p ${profile}`, { encoding: 'utf8' });
    const parsed = JSON.parse(raw);
    cachedToken = parsed.access_token;
    tokenExpiry = now + 3600_000;
    return cachedToken;
  } catch (err) {
    console.error('Failed to get Databricks OAuth token:', err.message);
    return cachedToken;
  }
}

function createPoolFromUrl(connectionString) {
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
  pool.on('error', (err) => console.error('Pool error:', err));
  return pool;
}

function createPool() {
  if (process.env.DATABASE_URL) {
    return createPoolFromUrl(process.env.DATABASE_URL);
  }

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
  pool.on('error', (err) => console.error('Pool error:', err));
  return pool;
}

// Branch management
const pools = {
  production: createPool(),
};

// Create dev pool if DATABASE_URL_DEV is configured
if (process.env.DATABASE_URL_DEV) {
  pools.dev = createPoolFromUrl(process.env.DATABASE_URL_DEV);
}

let activeBranch = 'production';

function getPool() {
  return pools[activeBranch] || pools.production;
}

function switchBranch(branch) {
  if (!pools[branch]) {
    throw new Error(`No pool configured for branch: ${branch}. Available: ${Object.keys(pools).join(', ')}`);
  }
  const prev = activeBranch;
  activeBranch = branch;
  console.log(`Switched database branch: ${prev} -> ${branch}`);
  return { previous: prev, current: branch };
}

function getCurrentBranch() {
  return activeBranch;
}

function getAvailableBranches() {
  return Object.keys(pools);
}

module.exports = { getPool, switchBranch, getCurrentBranch, getAvailableBranches, getOAuthToken };
