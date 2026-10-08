# Task 10 — supply-chain, backup and restore preparation

Existing CI workflows: `.github/workflows/security.yml` contains audit, SBOM, CodeQL, Trivy filesystem and Docker image scan jobs; `.github/workflows/staging-dast.yml` contains a manually triggered ZAP baseline. These workflows **exist**, but no CI execution result is claimed here. Real dependency audit/SBOM/CodeQL/container scans and DAST are **BLOCKED** until appropriate toolchain, CI and staging are available.

Existing encrypted backup and restore scripts use pg_dump/age and pg_restore. Task 10 added mandatory SHA-256 sidecar verification and an exact source/restore URL safety check. Shell syntax passed; actual encrypted backup, clean restore and data-integrity proof are **BLOCKED** without PostgreSQL and Age tooling. Production restore must use an independently isolated target; URL-string comparison alone is not sufficient.

No live secrets were added. The repo and reachable-history scanners passed; those are not an exhaustive scan of inaccessible remotes or every orphaned Git object. Do not claim staging, restore, rollback or supply-chain qualification completed.
