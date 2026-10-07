# Runbook — Event Refund

## Activation gate

`events.refunds` is seeded disabled. Before enabling it, prove the real MFA enrollment/challenge path, recent step-up signal, finance permissions, maker/checker separation, PostgreSQL migration/integration suite, compensating-ledger flow and operational audit path in staging.


1. Confirm the request is linked to the customer's own successful `EVENT_PURCHASE` and paid event order.
2. Confirm no ticket in the order has been checked in.
3. Finance/operations maker prepares the refund and records a review note.
4. A different authorized user with a **recent** MFA step-up reviews and approves.
5. The application locks organizer settlement state and verifies sufficient organizer liability for the ticket subtotal.
6. TwiPay creates a new `REFUND` financial transaction and compensating journal linked to the original event journal.
7. Only after the refund journal is sealed does the refund/order/tickets move to terminal refunded state.
8. Verify audit evidence and financial references.
9. Never edit/delete the original purchase journal.

If the accounting transaction fails, do not manually set the order to `REFUNDED`; investigate and retry through the controlled workflow.
