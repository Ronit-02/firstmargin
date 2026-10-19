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

## Release discipline

Production and provider setup is environment-specific and must be verified in the target environment. Do not treat a local run, historical test result, or preview deployment as a production-readiness claim.

## Related documentation

- [Project overview](context/project-overview.md)
- [Architecture](context/architecture.md)
- [Build plan](context/build-plan.md)
- [Progress tracker](context/progress-tracker.md)
- Local operational detail: available confidential companions
