# Release security gates

The repository defines independent gates for repository/history secret scanning, dependency audit, CodeQL, filesystem/container vulnerability scanning, CycloneDX SBOM generation, browser attack regression and staging ZAP DAST. High/critical exploitable findings are release blockers unless a documented security review proves non-exploitability and records compensating controls.

`security.yml` is source/supply-chain qualification. `browser-e2e.yml` is application/browser qualification against PostgreSQL/Redis. `staging-dast.yml` is deliberately manual/environment-protected because DAST must target the approved staging host, never an inferred production URL.
