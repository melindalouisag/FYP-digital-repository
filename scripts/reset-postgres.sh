#!/usr/bin/env bash
set -euo pipefail

DB_NAME="${PGDATABASE:-}"
DB_USER="${PGUSER:-}"
DB_PASS="${PGPASSWORD:-}"
PG_HOST="${PGHOST:-}"
PG_PORT="${PGPORT:-5432}"

ensure_command() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "Missing required command: ${cmd}"
    exit 1
  fi
}

check_postgres_connectivity() {
  if [[ -z "${DB_NAME}" || -z "${DB_USER}" || -z "${DB_PASS}" || -z "${PG_HOST}" ]]; then
    echo "Missing required env vars."
    echo "Required: PGDATABASE, PGUSER, PGPASSWORD, PGHOST (optional PGPORT)."
    exit 1
  fi

  if pg_isready -h "${PG_HOST}" -p "${PG_PORT}" >/dev/null 2>&1; then
    echo "Postgres is already reachable at ${PG_HOST}:${PG_PORT}."
    return
  fi

  echo "Postgres is not reachable at ${PG_HOST}:${PG_PORT}."
  echo "Verify Railway/Postgres environment variables and service availability."
  exit 1
}

run_reset_sql() {
  local admin_url="postgresql://${DB_USER}:${DB_PASS}@${PG_HOST}:${PG_PORT}/postgres"
  if ! psql -v ON_ERROR_STOP=1 "${admin_url}" <<SQL
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();

DROP DATABASE IF EXISTS ${DB_NAME};
DROP ROLE IF EXISTS ${DB_USER};
CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS}';
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
SQL
  then
    echo "Failed to run reset SQL."
    echo "Use an account with sufficient privileges to drop/create DB and roles."
    exit 1
  fi
}

ensure_command psql
ensure_command pg_isready

check_postgres_connectivity
run_reset_sql

echo "Done. Flyway migrations will run automatically on next app startup."
