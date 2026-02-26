#!/usr/bin/env bash
# Switch the backend between LakeBase branches (production/dev)
# Usage: ./scripts/switch_branch.sh dev
#        ./scripts/switch_branch.sh production

set -euo pipefail

BACKEND_URL="${BACKEND_URL:-https://main.d1erxf8q87xlvj.amplifyapp.com}"
BRANCH="${1:-}"

if [ -z "$BRANCH" ]; then
  echo "Current branch:"
  curl -s "$BACKEND_URL/admin/branch" | python3 -m json.tool
  echo ""
  echo "Usage: $0 <branch>"
  echo "  $0 dev          # Switch to dev branch (1000+ registrations)"
  echo "  $0 production   # Switch back to production (live audience data)"
  exit 0
fi

echo "Switching to branch: $BRANCH"
RESULT=$(curl -s -X POST "$BACKEND_URL/admin/switch-branch" \
  -H "Content-Type: application/json" \
  -d "{\"branch\": \"$BRANCH\"}")

echo "$RESULT" | python3 -m json.tool
echo ""
echo "Done! Dashboard will update on next poll (within 10 seconds)."
