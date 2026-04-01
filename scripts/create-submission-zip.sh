#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${ROOT_DIR}/submission"
OUTPUT_FILE="${OUTPUT_DIR}/${1:-digital-repository-submission.zip}"

mkdir -p "${OUTPUT_DIR}"
rm -f "${OUTPUT_FILE}"

files=()
while IFS= read -r -d '' file; do
  case "${file}" in
    .DS_Store|*/.DS_Store)
      continue
      ;;
    __MACOSX|__MACOSX/*|*/__MACOSX/*)
      continue
      ;;
    .sixth|.sixth/*|*/.sixth/*)
      continue
      ;;
    *.zip|submission|submission/*)
      continue
      ;;
    target|target/*|*/target/*)
      continue
      ;;
    node_modules|node_modules/*|*/node_modules/*)
      continue
      ;;
    dist|dist/*|*/dist/*)
      continue
      ;;
    src/main/resources/static|src/main/resources/static/*)
      if [ "${file}" = "src/main/resources/static/.gitkeep" ]; then
        files+=("${file}")
      fi
      continue
      ;;
  esac
  files+=("${file}")
done < <(git -C "${ROOT_DIR}" ls-files -co --exclude-standard -z)

if [ "${#files[@]}" -eq 0 ]; then
  echo "No files selected for packaging."
  exit 1
fi

(
  cd "${ROOT_DIR}"
  zip -q -r "${OUTPUT_FILE}" -- "${files[@]}"
)

echo "Created ${OUTPUT_FILE}"
