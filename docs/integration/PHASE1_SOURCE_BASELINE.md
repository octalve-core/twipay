# TwiPay — Phase 1.1 Source Protection Baseline

This record is intentionally separated from the subsequent code reconciliation commit.

## Read-only source snapshots (outside deployable source tree)

| Role | Archive | SHA-256 |
|---|---|---|
| Git-backed master, latest Batch F | `TWIPAY_PROVISIONAL_MASTER_CURRENT.zip` | `619c488c470cc4868f1e186a976994dd50512fb9b093aff47a29b36d62f15c5a` |
| Developer GitHub source export (no `.git`) | `twipay-master.zip` | `f535852ba8717f5a96a2260d9f8299593365b2f2f880c27930a4a8cdcaf6c7ae` |
| Original ErhaPay frontend | `erhapay-source(2).zip` | `aec7912e7d67e1d0db481f79544a048263dffae456198fa7adc6f2b19b0c84c6` |

- Master starting HEAD: `7868046893addc4bfa9384b19f474eb3428350ad`.
- Working integration branch: `integration/phase1-developer-runtime-20261008`.
- Snapshot checksums were verified before extraction.
- Zip path traversal checks: no unsafe archive entry paths.
- Original archive bytes retained at `/mnt/data/twipay-phase1/sources/` within the current working environment. Original uploaded files also remain available through the project context/Library.
- Developer Git ZIP has no Git ancestry. Do not misrepresent this as a genuine three-way merge.
- Source comparison (excluding .git and generated dirs): 300 identical, 48 modified shared paths, 11 developer-only paths, 523 master-only paths.
- Do not overwrite the master with the developer ZIP or the original ErhaPay ZIP.
- Do not include the original archives or unsanitized developer task journals in deployable images.
