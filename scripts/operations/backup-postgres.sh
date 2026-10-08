#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${TWIPAY_BACKUP_AGE_RECIPIENT:?TWIPAY_BACKUP_AGE_RECIPIENT is required}"
command -v pg_dump >/dev/null || { echo 'pg_dump is required' >&2; exit 1; }
command -v age >/dev/null || { echo 'age is required for encrypted backup output' >&2; exit 1; }
out_dir="${TWIPAY_BACKUP_DIR:-./backups}"
mkdir -p "$out_dir"
chmod 700 "$out_dir"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="$out_dir/twipay-${stamp}.dump.age"
pg_dump --dbname="$DATABASE_URL" --format=custom --no-owner --no-privileges \
  | age --recipient "$TWIPAY_BACKUP_AGE_RECIPIENT" --output "$out"
sha256sum "$out" > "$out.sha256"
chmod 600 "$out" "$out.sha256"
printf 'Encrypted PostgreSQL backup: %s\nChecksum: %s\n' "$out" "$out.sha256"
