# firstmargin security assurance

## Automated database test boundary — 2026-10-29

Browser E2E and opt-in integration tests now use unique temporary databases and refuse inherited application database targets or existing-app attachment. Preflight and cleanup enforce run ownership; unavailable local test services fail without fallback. CI uses a disposable MongoDB service and an explicitly named test database for its separate SEO seed. Commands, lifecycle, and remaining hard-termination limits are owned by [test fixtures](test-fixtures.md#automated-test-isolation--2026-10-29); protected mechanics are in the local fixture companion.

## Backend dependency remediation — 2026-10-29

Applied `npm audit fix --ignore-scripts` within the existing backend dependency ranges. Only `Backend/package-lock.json` changed in the application; no manifest, override, major upgrade, runtime source, API, schema, stored-data, or frontend change was required.

| Dependency | Previous locked version | Updated locked version |
|---|---|---|
| body-parser | 2.3.0 | 2.4.0 |
| multer | 2.4.0 | 2.5.0 |
| nodemailer | 10.1.0 | 10.3.1 |
| qs | 6.16.0 | 6.17.1 |
| iconv-lite (required by body-parser) | 0.7.2 | 0.7.3 |

Express continues to supply body-parser and qs; the existing upload middleware and email adapter retain their public interfaces. Reviewed upstream release notes and installed changelogs for compatibility. The updates address the reported [body-parser](https://github.com/advisories/GHSA-27r3-jxmh-p828), [Multer](https://github.com/advisories/GHSA-q7qp-rjg7-q26m), [Nodemailer nested-comment](https://github.com/advisories/GHSA-8c8m-p3m8-cjg8), [Nodemailer group](https://github.com/advisories/GHSA-m943-m63m-w62w), [Nodemailer angle-address](https://github.com/advisories/GHSA-85x2-q946-cp5h), and [qs](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw) advisories.

Verification on 2026-10-29: backend `npm audit --audit-level=low` and `npm audit --omit=dev --audit-level=low` each reported zero vulnerabilities; `npm test` passed all 129 contracts; `npm run lint` passed. Initial sandbox runs failed registry DNS and localhost HTTP access; successful audit/test runs used approved access outside the sandbox. `npm run test:integration` skipped its disabled opt-in gate. Live database, email delivery, deployed behavior, and frontend/browser checks were not exercised for this backend lockfile-only update. The earlier development-only nodemon findings below are historical and were absent from this full audit.

## Staff role changes — 2026-10-18

The staff-only account directory exposes a bounded set of account fields. Role changes accept regular or member promotion to exclusive writer or moderator, plus the existing exclusive-writer/moderator demotions, and retain an audit record. Focused controller tests and a mocked-API browser check passed for the earlier transitions; a live database promotion was not exercised. Protected authorization and transaction details are in the local security and architecture companions.

Last reviewed: 2026-10-13

## Purpose

Security is a continuous release requirement, not a one-time certification. firstmargin protects accounts, private activity, authored work, and community participation through server-side authorization, input validation, safe handling of untrusted content, privacy-aware observability, and proportionate abuse controls.

## Tracked assurance commitments

- Every mutable capability requires server-side authentication and authorization.
- Public responses expose only information appropriate to the audience and never rely on client visibility as an access-control boundary.
- Untrusted text, URLs, and media are validated before use; content rendering must remain safe by default.
- Authentication, reporting, voting, search, and other abuse-prone flows receive proportionate rate and misuse controls.
- Logs, tests, documentation, build artifacts, and repositories must not disclose secrets or private content.
- Dependencies, production headers, transport configuration, and deployment behavior require review before release.

The frontend page CSP and hosting header allow the existing Google Fonts stylesheet origin (`fonts.googleapis.com`) under `style-src` and its font-file origin (`fonts.gstatic.com`) under `font-src`; the remaining directives stay scoped as before.

## Verification boundary

Source-level tests and build checks provide useful but incomplete evidence.

On 2026-10-13, the backend production dependency lockfile was refreshed with `npm audit fix`. `npm audit --omit=dev --audit-level=low` then reported zero vulnerabilities. The backend contract suite passed (106/106). A separate full dependency audit still reports three high findings through the development-only `nodemon` → `chokidar` → `braces` chain; npm's suggested forced fix would downgrade nodemon and was not applied.

On 2026-10-13, the frontend lockfile was refreshed for `brace-expansion` and `source-map-js`. `npm audit --audit-level=low` then reported zero vulnerabilities, and the frontend production build passed.

## Console and diagnostic privacy audit — 2026-10-18

A source review of frontend console calls, backend request/error logging, tracked secret-shaped files and values, and production artifacts found three privacy/feedback issues. Failed sign-out and denied clipboard access printed full browser error objects; those failures now use the existing user-facing toast. Development HTTP logging used a format that included query strings; it now uses the same metadata-only JSON request log as production. A route sweep under reduced-motion settings also found repeated Motion development warnings. The four affected components now use a shared browser-preference hook while keeping their existing animation durations and transitions. The central API error response and error monitor already omit error messages, stacks, bodies, and credentials; those contracts were retained. No tracked credential or private-key file, high-confidence credential pattern, or production source map was found in the scoped checks.

Verification on 2026-10-18: final frontend/backend lint, frontend production build, the 85-file artifact check, and 111 backend contracts passed. Four focused mocked-API Chrome checks for sign-in and editor rendering passed. After the hook change, the desktop route sweep and three focused reduced-motion interactions passed without the Motion warning. The 320 px route sweep still fails on Trending horizontal overflow, separate from this console/privacy correction. The browser runner emitted a conflicting `NO_COLOR`/`FORCE_COLOR` environment warning; this was not an application console warning. Live provider responses, deployed headers/log sinks, and a complete route-wide browser console sweep remain unverified.
