# Load and failure qualification

The committed k6 smoke (`tests/load/staging.js`) deliberately targets only an explicitly supplied HTTPS staging API and contains no credentials. Production qualification additionally needs controlled authenticated fixtures to measure login concurrency, transaction-history reads, wallet contention and event checkout contention, plus provider timeout/5xx, webhook bursts, queue backlog/restart, database pressure, Redis outage/recovery and provider-circuit behavior.

Do not run destructive/financial load scenarios against production or provider live money rails. Record VU/rate, p50/p95/p99, error/429 rates, DB/Redis saturation, queue lag and reconciliation outcomes. A test that overloads a safety control is evidence to tune capacity/rates, not a reason to remove the control.
