# Runbook — Bill Provider Outage

1. Check provider capability health and recent transient-failure rate.
2. Confirm whether the circuit is `OPEN`, `HALF_OPEN` or `CLOSED`.
3. New purchases that have **not** been submitted may route to another healthy offer/provider.
4. Purchases already submitted or possibly submitted stay pinned to their original provider and enter reconciliation.
5. Do not release holds for `UNKNOWN` purchases without verified terminal evidence.
6. If the provider remains unavailable after bounded automated requery, mark reconciliation cases for operations review.
7. After cooldown, allow controlled half-open probes; deterministic customer failures should not count as infrastructure/provider outages.
