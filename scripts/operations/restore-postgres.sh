#!/usr/bin/env bash
set -euo pipefail
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"
: "${TWIPAY_BACKUP_AGE_IDENTITY_FILE:?TWIPAY_BACKUP_AGE_IDENTITY_FILE is required}"
: "${1:?usage: restore-postgres.sh <backup.dump.age>}"
[[ "${ALLOW_DESTRUCTIVE_RESTORE:-}" == "yes" ]] || { echo 'Set ALLOW_DESTRUCTIVE_RESTORE=yes only for the intended clean restore target' >&2; exit 1; }
backup="$1"
[[ -f "$backup" ]] || { echo "Backup not found: $backup" >&2; exit 1; }
command -v age >/dev/null || { echo 'age is required' >&2; exit 1; }
command -v pg_restore >/dev/null || { echo 'pg_restore is required' >&2; exit 1; }
[[ -f "$backup.sha256" ]] || { echo 'Refusing restore: backup SHA-256 sidecar is required' >&2; exit 1; }
(cd "$(dirname "$backup")" && sha256sum -c "$(basename "$backup").sha256")
# This catches accidental reuse of the backup source when both connection strings
# are supplied. An independent, isolated restore target is still mandatory.
if [[ -n "${DATABASE_URL:-}" && "$DATABASE_URL" == "$RESTORE_DATABASE_URL" ]]; then
  echo 'Refusing restore into backup source database' >&2
  exit 1
fi
age --decrypt --identity "$TWIPAY_BACKUP_AGE_IDENTITY_FILE" "$backup" \
  | pg_restore --dbname="$RESTORE_DATABASE_URL" --clean --if-exists --no-owner --no-privileges --exit-on-error
printf 'Restore completed. Run scripts/operations/verify-restored-db.sh before accepting this restore.\n'
