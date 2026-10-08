# TwiPay worker shutdown and recovery

Worker receives SIGTERM/SIGINT and stops initiating periodic recovery sweeps, waits for BullMQ worker closure and drains any in-progress sweep before closing the Nest application context. The drain intentionally waits for in-flight work; production orchestrators must allow a sufficient termination grace period. A hard kill can still interrupt work, so financial jobs must remain idempotent and reconcilable from persisted source state.

After restart check queue health, failed/stalled jobs, pending bills and notifications, reconciliation backlog and any UNKNOWN provider operations. Never retry an uncertain submission through a different provider. Do not mark the worker production-qualified until a real Redis/BullMQ and PostgreSQL test proves restart, shutdown, at-least-once delivery and no duplicate financial effects.
