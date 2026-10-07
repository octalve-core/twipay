# ADR 013 — White-label/Licensing Is Local Configuration, Not Runtime Dependency

## Status
Accepted in Batch 4.

## Context
Octalve will operate TwiPay and may license, white-label or sell the platform. A saleable product must not be scattered with hard-coded TwiPay assumptions or depend on Octalve/OpenAI to remain operational.

## Decision
Use audited local configuration for brand, feature flags and deployment profile. Supported editions begin with `TWIPAY_OWNED`, `WHITE_LABEL` and `ENTERPRISE_SOURCE`.

No remote phone-home licensing service is required for normal runtime. Provider integrations remain adapters and deployment infrastructure remains replaceable.

## Consequences
Commercial licence enforcement, activation files or managed-support controls can be added later without redesigning the financial/business domains. A future buyer can maintain the software from repository documentation and tests.
