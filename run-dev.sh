#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ROOT_DIR}/config/dev.env"
EXAMPLE_FILE="${ROOT_DIR}/config/dev.env.example"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing required env file: ${ENV_FILE}"
  echo "Create it from template:"
  echo "  cp ${EXAMPLE_FILE} ${ENV_FILE}"
  exit 1
fi

echo "Loading environment from ${ENV_FILE}"
set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

normalize_sso_env() {
  export AZURE_TENANT_ID="${AZURE_TENANT_ID:-${AAD_TENANT_ID:-}}"
  export AZURE_CLIENT_ID="${AZURE_CLIENT_ID:-${AAD_CLIENT_ID:-}}"
  export AZURE_CLIENT_SECRET="${AZURE_CLIENT_SECRET:-${AAD_CLIENT_SECRET:-}}"
}

require_azure_env() {
  local missing=()
  local placeholders=()
  local vars=(AZURE_TENANT_ID AZURE_CLIENT_ID AZURE_CLIENT_SECRET)

  for var_name in "${vars[@]}"; do
    local value="${!var_name:-}"
    if [[ -z "${value}" ]]; then
      missing+=("${var_name}")
    elif [[ "${value}" == "__FILL_ME__" ]]; then
      placeholders+=("${var_name}")
    fi
  done

  if (( ${#missing[@]} > 0 || ${#placeholders[@]} > 0 )); then
    echo "Azure SSO configuration is incomplete."
    if (( ${#missing[@]} > 0 )); then
      echo "Missing vars: ${missing[*]}"
    fi
    if (( ${#placeholders[@]} > 0 )); then
      echo "Placeholder vars (still __FILL_ME__): ${placeholders[*]}"
    fi
    echo "Update ${ENV_FILE} with real AZURE_* values before running."
    exit 1
  fi
}

require_storage_env() {
  if [[ "${FILE_STORAGE_PROVIDER:-}" != "azure" ]]; then
    echo "FILE_STORAGE_PROVIDER must be set to 'azure' for this runtime."
    exit 1
  fi

  if [[ -z "${AZURE_STORAGE_CONTAINER:-}" || "${AZURE_STORAGE_CONTAINER}" == "__FILL_ME__" ]]; then
    echo "AZURE_STORAGE_CONTAINER must be configured with a real value."
    exit 1
  fi

  local has_connection_string=false
  local has_account_and_key=false

  if [[ -n "${AZURE_STORAGE_CONNECTION_STRING:-}" && "${AZURE_STORAGE_CONNECTION_STRING}" != "__FILL_ME__" ]]; then
    has_connection_string=true
  fi
  if [[ -n "${AZURE_STORAGE_ACCOUNT:-}" && "${AZURE_STORAGE_ACCOUNT}" != "__FILL_ME__" \
    && -n "${AZURE_STORAGE_KEY:-}" && "${AZURE_STORAGE_KEY}" != "__FILL_ME__" ]]; then
    has_account_and_key=true
  fi

  if [[ "${has_connection_string}" == "false" && "${has_account_and_key}" == "false" ]]; then
    echo "Configure Azure Blob credentials using either:"
    echo "  - AZURE_STORAGE_ACCOUNT + AZURE_STORAGE_KEY"
    echo "  - AZURE_STORAGE_CONNECTION_STRING"
    exit 1
  fi
}

normalize_sso_env
require_azure_env
require_storage_env

BASE_PROFILES="${SPRING_PROFILES_ACTIVE:-aad}"
RUN_PROFILES="${BASE_PROFILES},dev"

cd "${ROOT_DIR}"
exec sh ./mvnw spring-boot:run -Dspring-boot.run.profiles="${RUN_PROFILES}"
