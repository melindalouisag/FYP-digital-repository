#!/usr/bin/env bash
set -euo pipefail

CONNECTION_URL="${DATABASE_URL:-}"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql command not found. Install PostgreSQL client tools first."
  exit 1
fi

if [[ -z "${CONNECTION_URL}" ]]; then
  echo "DATABASE_URL is not set."
  exit 1
fi

echo "Checking PostgreSQL connectivity using DATABASE_URL..."
if psql "${CONNECTION_URL}" -c "select 1;" >/dev/null 2>&1; then
  echo "Connection OK."
  exit 0
fi

echo "Connection failed."
echo "Troubleshooting:"
echo "1) Check environment values: DATABASE_URL, PGUSER, PGPASSWORD"
echo "2) Check service status: ./scripts/postgres-status.sh"
echo "3) If needed, run Flyway repair: ./scripts/flyway-repair.sh"
exit 1
