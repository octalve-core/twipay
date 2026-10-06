# Runbook — Event Ticket Check-in Issue

1. Verify the caller is the organizer owner permitted by V1 check-in policy.
2. Scan/provide the full TwiPay QR payload; never accept a public ticket code alone as proof.
3. The server locks the ticket, verifies the HMAC credential against its stored fingerprint/key version and requires `ACTIVE` status.
4. If already checked in, return the recorded timestamp; do not reset the ticket to active.
5. If a signing key version is unavailable, do not bypass signature verification. Restore the correct historical key from the protected secret store according to the key-rotation procedure.
6. Check-in records are immutable. Corrections require a future audited operations workflow, not direct database edits.
