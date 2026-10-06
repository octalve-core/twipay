# Local Development

1. Install Node 24 LTS and enable Corepack.
2. Run `pnpm install`.
3. Copy `.env.example` to `.env` and create local-only secrets. Never commit `.env`.
4. Run `docker compose up -d postgres redis`.
5. Run Prisma generation and migrations.
6. Run `pnpm dev`.

If a package-manager operation fails, do not hand-edit a lockfile. Resolve network/registry access, regenerate it with the pinned package manager, then commit the generated lockfile.
