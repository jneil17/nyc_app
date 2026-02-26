#!/usr/bin/env bash
# demo_reset.sh — Clear all registrations from LakeBase before a demo
#
# Usage:
#   ./scripts/demo_reset.sh              # Truncate only (with confirmation)
#   ./scripts/demo_reset.sh --seed       # Truncate + re-seed 25 fake registrations
#   ./scripts/demo_reset.sh --seed -y    # Skip confirmation prompt
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

SEED=false
YES=false
for arg in "$@"; do
  case "$arg" in
    --seed) SEED=true ;;
    -y|--yes) YES=true ;;
  esac
done

echo "=== NYC Demo Reset ==="

# Determine connection method
if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "Using DATABASE_URL connection string"
  CONN="$DATABASE_URL"
else
  echo "Using Databricks OAuth token..."
  PROFILE="${DATABRICKS_PROFILE:-dbc-eca83c32-b44b}"
  HOST="ep-ancient-bread-d15lax3a.database.us-west-2.cloud.databricks.com"
  DB="databricks_postgres"
  USER="${LAKEBASE_USER:-jwneil17@gmail.com}"

  TOKEN=$(databricks auth token -p "$PROFILE" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
  export PGPASSWORD="$TOKEN"
  CONN="host=$HOST port=5432 dbname=$DB user=$USER sslmode=require"
fi

echo ""
echo "Current row count:"
psql "$CONN" -t -c "SELECT COUNT(*) FROM event_registrations;"

if [[ "$YES" == false ]]; then
  echo ""
  if [[ "$SEED" == true ]]; then
    read -p "DELETE ALL registrations and re-seed with 25 fake rows? (y/N) " -n 1 -r
  else
    read -p "Are you sure you want to DELETE ALL registrations? (y/N) " -n 1 -r
  fi
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
fi

psql "$CONN" -c "TRUNCATE TABLE event_registrations CASCADE;"
echo "All registrations deleted."

if [[ "$SEED" == true ]]; then
  echo ""
  echo "Re-seeding with 25 registrations..."
  bash "$SCRIPT_DIR/seed_data.sh"
else
  echo ""
  echo "Table is empty. Run with --seed to insert fake data, or use:"
  echo "  ./scripts/seed_data.sh"
fi
