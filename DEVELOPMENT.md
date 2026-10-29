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
