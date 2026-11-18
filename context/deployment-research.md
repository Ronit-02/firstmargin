# firstmargin deployment planning

Last reviewed: 2026-09-08

## Purpose

Deployment choices must support the application’s reliability, privacy, security, accessibility, and operating-cost requirements. Provider plans, pricing, and regional availability are time-sensitive and must be researched again before a purchase or production commitment.

## General deployment expectations

- Production uses independently deployable web, API, background-processing, persistence, and media-delivery responsibilities as the current architecture requires.
- Production release verification covers client routing, HTTPS, authentication, public metadata, background work, backups/recovery, observability, and performance at representative load.
- Preview and low-cost environments are useful for validation but are not evidence of production readiness.
- Capacity estimates are hypotheses until verified with workload and recovery testing.

## Automated production availability checks — 2026-11-02

The separate Production health monitor workflow schedules an availability check every hour and supports manual dispatch. It independently checks the frontend application document, backend liveness, and a live database ping through the existing database-status endpoint. Each component gets a 60-second request deadline and up to two retries with five-second delays. All component outcomes appear in the workflow summary; any exhausted check fails the run. This does not replace browser journeys, worker/provider monitoring, or backup/recovery verification.

Activation requires both production-origin repository variables and the workflow on the default branch. The backend ping change must also be deployed before claiming live database verification. Schedules are best-effort rather than an exact uptime guarantee. Operational setup and endpoint details belong to the ignored local deployment companion. No production URL, database credential, notification destination, or provider secret is committed by this addition.

The existing UI, product routes, persistence schemas and readiness endpoint remain unchanged. The database-status endpoint retains its success/error response contract and now checks a bounded live operation instead of relying only on the connection flag. Verified local results and activation limits are recorded in the progress tracker.

## Release boundary

## Decision process

Before any deployment implementation, agree on provider, region, domain, budget, availability, recovery, and launch-scope expectations. Then validate the bounded application and infrastructure changes in the target environment. No research note is itself a deployment approval or production-readiness certification.
