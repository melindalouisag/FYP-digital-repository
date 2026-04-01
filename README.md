# Digital Repository Thesis Master

Spring Boot backend + React/Vite frontend for thesis/publication workflow, repository search, and controlled publishing.

## Local Quick Start

1. Copy env templates:

```bash
cp config/dev.env.example config/dev.env
cp config/postgres.env.example config/postgres.env
```

2. Fill placeholders in `config/*.env`:
- SSO vars: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`
- App vars: `APP_UI_BASE_URL`
- PostgreSQL vars: `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`
- Storage vars (required for non-test runtime):
  - `FILE_STORAGE_PROVIDER=azure`
  - `AZURE_STORAGE_CONTAINER`
  - authentication method:
    - `AZURE_STORAGE_ACCOUNT` + `AZURE_STORAGE_KEY`
    - or `AZURE_STORAGE_CONNECTION_STRING`
  - optional: `AZURE_STORAGE_PREFIX` (default: `documents`)
- SMTP vars are optional. If omitted, workflow emails are skipped.

3. Run backend:

```bash
# Loads config/dev.env and starts Spring with aad,dev profiles
bash run-dev.sh

# Loads config/postgres.env and starts Spring with PostgreSQL settings
bash run-postgres.sh
```

4. Run frontend (dev mode):

```bash
cd admin-ui
npm ci
npm run dev
```

## Auth Mode

- Runtime target is Microsoft SSO only (`APP_AUTH_MODE=SSO` or `AAD` for compatibility).
- Local/HYBRID auth mode is rejected at startup in non-test runtime.
- OTP/email verification endpoints and verify-email UI flow are disabled.
- SMTP is not required for login/authentication.

Backward compatibility: runtime still accepts legacy `AAD_*` variables as fallback for `AZURE_*`.

## Railway Deployment (Free)

Deployment target is a single Spring Boot service that serves the built SPA from `src/main/resources/static`.

- Docker build pipeline:
  1. builds `admin-ui` with `npm ci && npm run build`
  2. removes stale files from `src/main/resources/static`
  3. copies `admin-ui/dist` into `src/main/resources/static`
  4. packages the Spring Boot jar
- Health check path: `/actuator/health`
- Port: driven by `PORT`

### Required Railway env vars

- Database (Railway Postgres):
  - `PGHOST`
  - `PGPORT`
  - `PGDATABASE`
  - `PGUSER`
  - `PGPASSWORD`
- SSO:
  - `APP_AUTH_MODE=SSO`
  - `AZURE_TENANT_ID`
  - `AZURE_CLIENT_ID`
  - `AZURE_CLIENT_SECRET`
- Storage (Azure Blob only for deployment):
  - `FILE_STORAGE_PROVIDER=azure`
  - `AZURE_STORAGE_CONTAINER`
  - one of:
    - `AZURE_STORAGE_ACCOUNT` + `AZURE_STORAGE_KEY`
    - or
    - `AZURE_STORAGE_CONNECTION_STRING`
  - optional:
    - `AZURE_STORAGE_PREFIX`

Important:
- Railway deployment does not use local filesystem storage.
- Railway deployment does not use in-memory storage.
- The Azure Storage account is assumed to already exist; provide container name and credentials via Railway environment variables.
- The container is created automatically if it does not exist.

### Staff Allowlist (Railway Postgres)

- The `staff_registry` table is created by Flyway migration `V12__staff_registry.sql`.
- Lecturer/admin allowlist rows are not seeded by runtime in non-test environments.
- After deployment, insert your real staff rows directly in Railway Postgres.

Example SQL (placeholders only):

```sql
INSERT INTO staff_registry (email, role, full_name, department, study_program)
VALUES
  ('<LECTURER_EMAIL_PLACEHOLDER>', 'LECTURER', '<LECTURER_NAME_PLACEHOLDER>', '<DEPARTMENT_PLACEHOLDER>', '<STUDY_PROGRAM_PLACEHOLDER>'),
  ('<ADMIN_EMAIL_PLACEHOLDER>', 'ADMIN', '<ADMIN_NAME_PLACEHOLDER>', '<DEPARTMENT_PLACEHOLDER>', NULL);
```

### Optional Railway env vars

- SMTP (not required for runtime/auth):
  - `MAIL_HOST`
  - `MAIL_PORT`
  - `MAIL_USERNAME`
  - `MAIL_PASSWORD`
  - `MAIL_FROM`

If SMTP is not configured, workflow notification emails are treated as no-op and business flow continues.

## Datasource Resolution Notes

- Primary strategy: `PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD`.
- `DATABASE_URL` is also supported:
  - used directly if already `jdbc:postgresql://...`
  - converted automatically if `postgres://...` or `postgresql://...`

## Security

- CSP is strict and compatible with bundled local frontend assets.
- CSRF protection is enabled with cookie tokens for SPA requests.
- `/actuator/health` is public for platform health checks.
- Health includes `blobStorage` readiness when `FILE_STORAGE_PROVIDER=azure`.

## Build Checks

```bash
sh mvnw test
cd admin-ui && npm ci && npm run build
```

## Submission Packaging

Create a clean source-only submission zip from the repository root:

```bash
bash scripts/create-submission-zip.sh
```

The generated archive excludes local/editor/build artifacts such as `.git`, `.DS_Store`, `__MACOSX`, `target`, `node_modules`, `admin-ui/dist`, nested zip files, and the generated SPA output copied into `src/main/resources/static`.

Recommended pre-submission verification:

```bash
cd admin-ui && npm ci && npm run lint && npm test -- --run && npm run build
cd .. && ./mvnw -q -DskipTests package
```
