# Infrastructure

Batch 1 keeps infrastructure portable: Docker locally; Railway/Neon/Upstash are economical initial deployment targets; AWS migration is intentionally possible without rewriting core business code. Production secrets must be injected by the deployment environment, not stored here.
