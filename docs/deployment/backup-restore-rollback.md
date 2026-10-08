# Backup, restore and rollback

A backup is not qualified until it is restored and integrity-checked.

## Database protection

Use managed PostgreSQL encrypted backups/PITR as the primary mechanism. Set retention/RPO/RTO through the production provider according to business/regulatory approval. The repository scripts provide a portable secondary encrypted logical backup using `pg_dump | age`; no plaintext dump is written to disk.

- `scripts/operations/backup-postgres.sh` requires `DATABASE_URL` and an Age recipient.
- `scripts/operations/restore-postgres.sh` requires a dedicated clean `RESTORE_DATABASE_URL`, Age identity, mandatory backup `.sha256` sidecar, and explicit `ALLOW_DESTRUCTIVE_RESTORE=yes`. The restore script additionally rejects the exact source connection string when `DATABASE_URL` is present. Use a separate, isolated restore DB with distinct credentials; a different URL string by itself does not prove a different database.
- `scripts/operations/verify-restored-db.sh` checks core schema/migrations and balanced posted journals.

Never test restoration over production. Record backup checksum, source timestamp, restore target, duration and integrity result in release evidence.

## Application rollback

Keep the previous immutable image/tag deployable. Roll application traffic back only when the prior version is schema-compatible. Workers must be considered separately: pause/drain if a rollback could cause an older worker to process a newer job shape. Financial migrations generally use expand/contract and forward-fix; do not destructively downgrade money/audit tables.
