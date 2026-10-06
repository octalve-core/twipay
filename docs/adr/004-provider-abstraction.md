# ADR 004 — Provider Abstraction

**Status:** Accepted

Business modules depend on TwiPay ports, never directly on Paystack, Monnify, VTpass, Mono, Termii or another vendor. Vendor SDKs and payload mappings stay inside adapter packages. This is essential for routing, failover, white-label licensing and future provider replacement.
