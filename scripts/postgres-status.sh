#!/usr/bin/env bash
set -euo pipefail

PG_HOST="${PGHOST:-}"
PG_PORT="${PGPORT:-5432}"

echo
echo "== pg_isready check =="
if command -v pg_isready >/dev/null 2>&1; then
  if [[ -z "${PG_HOST}" ]]; then
    echo "PGHOST is not set."
    exit 1
  fi
  if pg_isready -h "${PG_HOST}" -p "${PG_PORT}"; then
    :
  else
    echo "Postgres is not accepting connections on ${PG_HOST}:${PG_PORT}."
  fi
else
  echo "pg_isready command not found. Install PostgreSQL client tools."
fi
