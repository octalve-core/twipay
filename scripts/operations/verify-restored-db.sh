#!/usr/bin/env bash
set -euo pipefail
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"
command -v psql >/dev/null || { echo 'psql is required' >&2; exit 1; }
counts="$(psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -At -F '|' <<'SQL'
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NULL THEN RAISE EXCEPTION 'Prisma migrations table missing'; END IF;
  IF to_regclass('public.journal_transactions') IS NULL THEN RAISE EXCEPTION 'journal_transactions table missing'; END IF;
  IF to_regclass('public.journal_entries') IS NULL THEN RAISE EXCEPTION 'journal_entries table missing'; END IF;
END $$;
SELECT
  (SELECT COUNT(*) FROM (
    SELECT j.id FROM journal_transactions j
    JOIN journal_entries e ON e."journalTransactionId"=j.id
    WHERE j."postedAt" IS NOT NULL
    GROUP BY j.id
    HAVING SUM(CASE WHEN e.side='DEBIT' THEN e."amountMinor" ELSE 0 END)
        <> SUM(CASE WHEN e.side='CREDIT' THEN e."amountMinor" ELSE 0 END)
  ) bad),
  (SELECT COUNT(*) FROM _prisma_migrations WHERE "finished_at" IS NULL AND "rolled_back_at" IS NULL);
SQL
)"
IFS='|' read -r unbalanced incomplete <<<"$counts"
[[ "$unbalanced" == "0" ]] || { echo "Restore integrity FAIL: $unbalanced unbalanced posted journals" >&2; exit 1; }
[[ "$incomplete" == "0" ]] || { echo "Restore integrity FAIL: $incomplete incomplete migrations" >&2; exit 1; }
echo 'Restore integrity PASS: schema present, migrations complete, posted journals balanced.'
