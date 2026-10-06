# Resend Email Adapter

Resend is the initial email rail behind the TwiPay notification port and is replaceable later by SES or another provider.

Required server-side configuration:

- `RESEND_API_KEY`
- `RESEND_FROM`
- optional `RESEND_BASE_URL`

TwiPay supplies a stable idempotency key to the provider and retains its own encrypted notification record. A provider `ACCEPTED` response is not upgraded to end-user delivery unless future provider delivery evidence supports that transition.
