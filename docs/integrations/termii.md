# Termii Notification Adapter

Termii is a replaceable SMS delivery rail behind TwiPay's notification port. TwiPay owns the notification record, encrypted destination/body, idempotency and retry policy.

Required server-side configuration:

- `TERMII_API_KEY`
- `TERMII_SENDER_ID`
- `TERMII_CHANNEL`
- optional `TERMII_BASE_URL`

Do not place these values in frontend code. Delivery acceptance is provider evidence, not proof that the end user read the message.
