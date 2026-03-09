#!/usr/bin/env bash
set -euo pipefail

DB_URL="${DB_URL:-${DATABASE_URL:-}}"
DB_USER="${DB_USER:-${PGUSER:-}}"
DB_PASS="${DB_PASS:-${PGPASSWORD:-}}"

if [[ -z "${DB_URL}" || -z "${DB_USER}" || -z "${DB_PASS}" ]]; then
  echo "Missing DB credentials. Set DATABASE_URL, PGUSER, and PGPASSWORD (or DB_URL, DB_USER, DB_PASS)."
  exit 1
fi

echo "Running Flyway repair against: ${DB_URL} (user: ${DB_USER})"
./mvnw -Dflyway.url="${DB_URL}" -Dflyway.user="${DB_USER}" -Dflyway.password="${DB_PASS}" flyway:repair
