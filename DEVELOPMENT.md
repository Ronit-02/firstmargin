# firstmargin development guide

## Purpose

This guide describes the tracked development workflow. Read `AGENTS.md`, all tracked `context/` files, and available local confidential companions before changing the application.

## Requirements

Use the supported Node.js version declared by each package manifest. Install dependencies independently in `Frontend/` and `Backend/` with the lockfile-respecting install command.

## Local workflow

1. Create ignored local environment files from the checked-in examples; never commit their values.
2. Start the application services required by the feature being developed.
3. Use development fixtures only in an isolated development environment.
4. Run the relevant lint, contract, integration, browser, build, accessibility, SEO, and artifact checks defined in package scripts.

## Isolated automated database tests

Mocked browser checks need no MongoDB: from `Frontend/`, run `npm run test:ui:critical` for the deterministic push/PR selection, or `npm run test:ui:audit` for the complete functional/responsive audit without an early failure cap. The original `test:ui` smoke, `test:ui:features`, `test:responsive`, and `test:browser:all` diagnostic commands remain available. `npm run test:unit` runs the pure cache contract. Backend `npm test` discovers all non-database contract files. See [test fixture ownership](context/test-fixtures.md) for exact suite counts, guards and current verification limitations.

Push and pull-request CI runs lint, dependency/artifact checks, build, backend contracts/integration, frontend unit contracts, the critical mocked UI selection and the three persisted journeys. To run all mocked browser checks and the SEO crawl, open Actions, choose the CI workflow, and use Run workflow on the desired branch. The full manual browser audit and SEO steps continue after an earlier test failure unless the run is cancelled, and the workflow still fails when any check fails. Scheduling changes take effect after committing/pushing the workflow; manual dispatch requires the workflow on the default branch.

Browser E2E runs use `npm run test:e2e` from `Frontend/`. The runner seeds a fresh temporary database on a local MongoDB test service and removes it after completion or failure. Do not seed the development database for browser tests. Inherited application database configuration is overridden, and attaching the browser suite to an existing app server is disabled.

The database integration suite remains opt-in through `RUN_DB_INTEGRATION=true` and `npm run test:integration` from `Backend/`; it also creates and removes its own unique temporary database. Both suites use a loopback MongoDB service by default. To select a test service on another local port, set `E2E_MONGO_SERVER` to a loopback MongoDB server URI without a database path, credentials, or options. The scripts do not start MongoDB and fail if the test service is unavailable; there is no development-database fallback. CI supplies its own temporary MongoDB service, and its separate SEO seed uses an explicitly named test database.

## Release discipline

Production and provider setup is environment-specific and must be verified in the target environment. Do not treat a local run, historical test result, or preview deployment as a production-readiness claim.

## Related documentation

- [Project overview](context/project-overview.md)
- [Architecture](context/architecture.md)
- [Build plan](context/build-plan.md)
- [Progress tracker](context/progress-tracker.md)
- Local operational detail: available confidential companions
