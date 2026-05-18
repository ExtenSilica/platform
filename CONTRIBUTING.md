# Contributing to ExtenSilica (platform)

Thank you for helping improve the registry API, website, and operational tooling in this repository.

The public **`.xsil` format and `xsil` CLI** live in [github.com/ExtenSilica/xsil](https://github.com/ExtenSilica/xsil). Follow that repository's contribution process for spec and CLI changes.

## Before you start

1. Read [docs/implementation-plan-rvi-2026.md](docs/implementation-plan-rvi-2026.md) — we do **not** add payment, wallet, escrow, or marketplace schema to the platform.
2. Read [Governance](https://extensilica.com/governance) on the public site for stewardship boundaries.
3. For registry packages (`.xsil` publishes), see [Contributing on the site](https://extensilica.com/contributing) — that path is separate from platform code here.

## Contributor License Agreement (CLA)

Contributions to **this repository** require accepting the [Individual Contributor License Agreement](docs/CLA.md).

By opening a pull request you confirm that:

- You have the right to submit the work.
- You grant the project the licenses described in the CLA.
- Your contribution is your original work or you have permission to submit it.

## Code standards

- Match existing patterns in `store-backend/` and `store-frontend/`.
- Add or update tests in `store-backend/test/` for API and validator changes.
- Run `npm test` in `store-backend` and `npx tsc --noEmit` in `store-frontend` before requesting review.
- CI must pass, including `scripts/check-no-financial-drift.sh` (no financial schema drift).

## Pull requests

- Keep PRs focused; one logical change per PR when possible.
- Describe **why** in the PR body, not only what changed.
- Do not commit secrets (`.env`, API keys, tokens).
- Migrations: add Prisma migrations under `store-backend/prisma/migrations/`; document deploy steps if operators must run `prisma migrate deploy`.

## Security

Do not open public issues for undisclosed vulnerabilities. Use the contact path in the [Terms of Service](https://extensilica.com/legal/terms).

## License

Platform code in this repository is licensed under the [Apache License, Version 2.0](LICENSE).
