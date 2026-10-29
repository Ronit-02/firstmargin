# Development test fixtures

Last reviewed: 2026-10-30

Broad mocked-browser repairs are verified across all 841 current cases using the latest complete result per file: 839 passed and two Google-client-ID cases skipped. The complete run and affected-file repair replays are documented separately in [the suite audit](test-suite-audit.md#broad-browser-failure-repairs--2026-10-30); this is not a single final green full-suite invocation. Mock fixtures follow current UI/API contracts, preserve explicit outage scenarios, and return ordinary 404s for unrelated unconfigured endpoints instead of triggering global transport-outage recovery. Expectation timeout is ten seconds to accommodate existing query retries. The UI runner remains database-free.

## Automated test isolation — 2026-10-29

The inventory, duplicate review, baseline repairs and verification limitations are owned by [test-suite audit](test-suite-audit.md). The original expanded cases are mapped in [test-case review](test-case-review.csv).

Only three persisted journeys use the maintained catalog in a newly generated temporary database: publishing/reload, authenticated write isolation, and real-login notification recovery. `Frontend/scripts/run-e2e.js` owns connection preflight, seeding, execution and cleanup using `Backend/tests/support/temporary-database.js`. It overrides inherited application database configuration and supplies matching ephemeral seed/login credentials. The persisted configuration requires this ownership and managed API/Vite servers. Dedicated ports default to 8096/3096, with validated `E2E_API_PORT`/`E2E_FRONTEND_PORT` overrides.

Mocked UI tests use `scripts/run-ui.js`, `playwright.ui.config.js`, and `tests/support/ui-test.js`. They start only a strict-port Vite server (3095 by default, configurable with `UI_TEST_PORT`), target a dead loopback API origin, and intercept API traffic. Unhandled API requests reaching the shared fixture fail the test. Existing per-spec catch-all fixtures still require contract review: isolation alone does not make those mocks strict. No MongoDB connection or seed runs. `tests/support/browser-suites.js` owns selection: `test:ui` is a 103-case smoke subset; `test:ui:features` runs 595 feature cases; `test:responsive` runs 246 broad audit cases; `test:browser:all` runs their 841-case union. These counts follow the 2026-10-30 consolidation in [the test-suite audit](test-suite-audit.md#broader-mocked-ui-consolidation--2026-10-30); discovery counts do not imply a passing run. Smoke is a subset of features, not additional coverage. One pure cache contract moved to `tests/unit/` and runs through `test:unit` without Playwright.

As of 2026-10-30, push/PR CI uses `test:ui:critical`: the 102 deterministic cases from the existing smoke files, excluding its optional Google-client-ID scenario through the explicit manual-only pattern in `tests/support/browser-suites.js`. The 103-case `test:ui` smoke command is retained for diagnostics. `test:ui:audit` runs the complete 841-case mocked union without an early failure cap, including all 739 cases outside the critical selection. The full manual union includes the critical cases too; it is not a disjoint replacement suite.

The CI workflow now supports manual dispatch: push/PR runs critical mocked UI plus the existing core lint/security/build/unit/backend integration and three persisted journeys; a manual run instead executes the full mocked audit and also the SEO crawl. Full audit/SEO steps run after earlier failures unless cancelled; failures remain failures. No test was deleted or blanket-skipped to implement the split. Workflow changes take effect after committing/pushing; manual dispatch requires the workflow on the default branch.

Mocked tests use two workers, no video and a five-failure CI cap for the critical selection. The explicit full audit command overrides that cap with zero (unlimited failures). A failure cap never turns unexecuted cases into passes. HTML/trace output stays separated for UI and E2E. Latest verification and remaining full-suite failures are recorded in [the suite audit](test-suite-audit.md).

Backend `npm test` discovers every top-level `.test.js` file except the explicit integration suite through `tests/run-contracts.js`; this includes five previously omitted files. Avatar upload request fixtures include the empty body created by real multipart middleware.

One E2E command creates one database and seeds it once for all selected test files/cases, which run with the existing single worker. Cleanup happens after the complete command finishes, including a failed run; there is no database per test case. Separate invocations get separate databases. Backend helpers live under `Backend/tests/support/` alongside the owning test suites rather than in a separate top-level test-support folder.

The Playwright configuration checks isolation before dynamically loading frontend tooling. Backend isolation regressions run against a temporary config/helper copy without frontend packages, matching CI's backend-first installation order. Backend verification therefore does not require installing Playwright; valid browser runs load it after the guard passes.

Opt-in database integration tests independently create and remove a unique temporary database using the same ownership rules. Both suites require a loopback MongoDB test service, reject named/remote/credential-bearing server overrides, and stop without fallback when it is unavailable. Cleanup verifies the exact run-owned database; startup or test failures cannot authorize dropping another database. Hard termination can leave an isolated database behind; subsequent runs never reuse it. CI provides a disposable MongoDB service, uses an explicitly named test database for its separate SEO seed, and no longer seeds the browser database in a separate workflow step. See the development guide for commands and the local companion for protected implementation detail. Production routes, schemas, UI, and manual development seeds are unchanged.

## Ten-story reading path (2026-10-21)

The maintained seed includes the public story series “A Curious Life: Ten Ways of Seeing”: ten existing Maya Sen stories ordered from familiar rooms and neighborhood walks through questions, libraries, research, curation, patient technology, clear writing, street memory, and field notes. It adds a series without duplicating publications. The maintained catalog now defines 24 series; unrelated fixtures may increase persisted totals.

On an already seeded isolated development database, run `node scripts/seed-development.js --add-story-series` from `Backend/`. The command requires the exact ten released stories from their original author, inserts only the named series with positions 0–9 and an unused catalog cover, and verifies persisted membership/order. Reruns verify without rewriting the series or its saves; a conflicting existing order fails verification rather than being replaced. Run the targeted command serially. Production and database names without development/test/sandbox/local markers (or containing prod/live) are rejected. No account, publication, existing series, or engagement refresh runs. The full seed includes the same reading path; `--check` validates its ten distinct fixture keys and matching author/format without database access.

Verification on 2026-10-21: the targeted insert persisted exactly ten same-author, released story references at positions 0–9; a repeat run reported `created: false`. Existing guest list/detail controllers returned ten visible entries in matching order and the full ten-title preview. Catalog preflight, focused seed lint, all 120 backend contracts, and scoped whitespace checks passed. Sandbox database/localhost restrictions required outside-sandbox verification. No browser or provider actions were exercised.

## Purpose and safety

The development seed creates a connected, repeatable dataset that exercises the same application paths as user-created data without adding fallback mock logic. Fixtures are strictly non-production: use them only in isolated development or test environments, and never document or commit fixture credentials, account identifiers, tokens, or provider values.

Fixtures support product verification without creating real charges or fabricating provider success. Extend the set when a feature needs representative persisted state.

## Feature coverage map

| Area | Seeded scenarios |
|---|---|
| Discovery and search | Feeds, topics, varied authors, interaction signals, searchable writing, questions, and public profiles. |
| Reading and engagement | Structured content, accessible media alternatives, saves, reactions, comments, follows, sharing, progress, and reports. |
| Publishing | Drafts, revisions, publication states, short reads, source-question linkage, and writer-facing management. |
| Questions and opportunities | Open and answered questions, duplicate-aware states, votes, tags, linked responses, and reader demand. |
| Competitions | Multiple lifecycle states, entries, votes, judging, results, and review history. |
| Collections, shorts, and history | Ordered collections, saved items, short series, depth links, and varied reading progress. |
| Membership experiences | Member states, early access, summaries, browser speech, workshops, creator updates, requests, support, and analytics. |
| Notifications and moderation review | Read/unread activity, report lifecycle states, and non-destructive staff review scenarios. |
| Provider-independent lifecycle states | Billing, AI-use, media, email, and delivery-adjacent UI states without requiring live provider calls. |

## Clean community catalog (2026-10-20)

### Rich story and short bodies (2026-10-20)

`Backend/data/development-rich-content.json` owns 117 keyed editorial expansions; `Backend/data/development-writing.js` composes them with the existing openings/endings using supported structured blocks. There are 111 expanded maintained publications (79 stories and 32 shorts) plus six older sample shorts. The complete micro-fiction “Wait.” and “Oh! 👀” and the near-limit short remain intentionally brief or near the existing limit. Expanded maintained stories contain 268–479 words and shorts 154–189 words, counting headings, quotes, and code but excluding image URLs. Shorts remain under 500 words.

Subject-specific sections, original pull quotes, illustrative HTTPS images with alt text, practical code or text examples, dividers, bold, and italic vary across the catalog. Technical examples appear only where relevant. The 114 maintained bodies contain 21 H1, 91 H2, 17 H3, 55 quote, eight code, eighteen image, and 27 divider blocks. Images illustrate the subject rather than document the fictional narrated events; pull quotes are original prose, not attributed interviews. Generic repeated section headings were removed when composing the richer bodies. Frontend reader components and styles are unchanged.

For an existing isolated development database, run `node scripts/seed-development.js --refresh-content` from `Backend/`. It resolves the maintained author/title set before writing, updates only body/current revision with conflict checks, and appends immutable revision snapshots. Optional older shorts are matched to their specific sample author/title. It verifies exact persisted bodies, matching current revisions, and preservation of all other publication fields except the normal update timestamp. It does not reset account passwords, release dates, covers, engagement, collections, series, or unrelated publications. The full seed includes the expanded catalog; `--check` validates block payloads through the existing publication parser without database access.

Verification on 2026-10-20: 120 persisted bodies and current revisions passed, including the three preserved literary/length examples. The repeat refresh made zero updates. Data checks found 117 distinct expansion keys and 313 unique long passages; composition is deterministic and preserves its inputs. Backend lint and all 116 existing contracts passed. Six live API/Chrome reading checks passed across three persisted examples at 390/1280 px, covering semantic block counts, emphasis, media alternatives, overflow, and compact-reader scrolling. The initial sandbox run could not reach the database/local HTTP; outside-sandbox verification succeeded. A broader full-seed counter check found aggregate drift in the active development environment; the scoped refresh leaves that unrelated state untouched and verifies field preservation instead. Physical devices, other browsers, and live provider actions were not tested.

The catalog now contains 91 fictional people and 114 keyed publications: 77 released stories, 33 released shorts, three future releases, and one unpublished owner example. Eight additional writers contribute 24 original stories and 16 shorts about travel, fiction, design, technology, nature, family, public space, and everyday life. Each has a subject-specific biography, stable public handle, collection, story series, and short series. There are 27 collections, 23 series, 26 questions, 16 drafts, six competitions, eight workshops, and eleven creator updates in the maintained catalog. Unrelated records from older or independent fixtures may increase database totals.

`Backend/data/development-community.js` owns the new editorial content, personas, curation, subject-cover mapping, and reproducible reader selection. Existing discovery subjects and covers now match their stories. Publication, collection, series, and competition records receive HTTPS cover URLs. Drafts, workshops, and creator updates retain their existing schemas without a cover field. Images are remote references; no media upload is required.

### Distinct cover photos (2026-10-20)

`Backend/data/development-covers.json` contains 460 distinct public Unsplash photo IDs with topic labels and source descriptions. `Backend/data/development-cover-selection.js` chooses by title/subject, uses deterministic tie-breaking, reserves each photo once across different records, and returns the same image for repeated uses of the same item. It never treats query-string/crop changes as different photos and fails if the pool is exhausted.

The full seed and editorial refresh finish with a shared cover allocation across publications, collections, series, and competitions. For an existing development database, `node scripts/seed-development.js --refresh-covers` runs only the cover update and verifies persisted uniqueness. This changes image fields without rewriting content, interactions, routes, APIs, or schemas. Historical publication revisions and repeated appearances of one item are the same logical item, rather than separate cover assignments.

Verification on 2026-10-20: all 460 source photo URLs returned image content. The development database has 189 distinct underlying cover photos across 127 publications, 30 collections, 25 series, and seven competitions. A rerun verified the same assignments with zero updates. Pure allocation checks covered uniqueness, repeatability, same-item reuse, crop normalization, and pool exhaustion. Backend lint and the publication catalog preflight passed.

`Backend/data/development-writing.js` retains the original reading copy, and `Backend/data/development-edge-cases.js` owns the smaller reading examples. `Backend/scripts/seed-development.js` creates and links the persistent records through `npm run seed:dev`. Re-running refreshes records selected by their natural keys; use only an isolated development environment. Existing feed sections, routes, schemas, and presentation components remain in use.

Earlier deliberately broken media, artificial unbroken words, and public prose describing tests were replaced with readable editorial content. Existing seed keys remain stable; renamed publications and drafts reconcile their previous titles before upserting. The catalog retains naturally short pieces, Unicode, multi-block writing, varied tag counts including twenty, an empty collection, and a near-limit short. Request-validation and browser fixtures remain the home for malformed input and intentional rendering failures.

The editorial refresh also converts six specifically identified older browser-created shorts into distinct reading pieces, fills blank covers on older publications/collections/series and the existing ongoing sample contest, and reconciles one obsolete draft created during this refresh. Other writers' existing titles and bodies are preserved. `node scripts/seed-development.js --refresh-editorial` applies only that bounded repair to an already seeded development database; the full seed includes the same repair.

Appreciations, saves, follows, question votes, collection followers, competition votes, threaded comments, reading checkpoints, and reading events are connected records. Counts vary by stable keyed selection and are reconciled to their source relationships or events. Competition voters occur in at most one entry per contest; closed reader results preserve ties. Counts do not change randomly on refresh or multiply on a rerun. No sample activity is claimed as real user activity.

Run `node scripts/seed-development.js --check` from `Backend/` for a database-free catalog check. The seed also rejects production execution and database names without a development, test, sandbox, or local marker. Post-seed verification checks the exact keyed publication set, covers, absence of em dashes in publication titles/bodies, and agreement of appreciation/comment/view counters with stored relationships/events. Provider-dependent actions remain separate.

Verification on 2026-10-20: the catalog was applied to the configured development database and the 114 keyed publications passed the persisted content and counter checks. A database-wide cover check found zero blank publication, collection, series, or competition covers; competition vote checks found no duplicate readers across entries. The public cover URLs returned image content. Backend lint and all 113 backend contract tests passed. These are data/source checks; browser rendering and live provider actions were not exercised.

## Intentional boundaries

Fixtures do not activate provider behavior. Live payment, AI, email, and media actions require separate authorized configuration and fresh verification. Staff fixtures exercise review and recommendations only; destructive moderation enforcement remains unavailable until its verified lifecycle is active.

For a small Member Hub preview on an already seeded development database, run `npm run seed:member-preview` from `Backend/`. It adds two future-release posts and two upcoming workshops through the existing schemas without refreshing unrelated fixtures. It requires the demo authors and an explicitly named development database. Workshop joining URLs are example-only fixture values.

For one current competition without refreshing the full fixture set, run `npm run seed:ongoing-competition` from `Backend/`. It creates or refreshes the demo-owned “The Places That Shape Us” contest, closing in two weeks, with reader voting and no prefilled entries. It requires the seeded demo administrator and an explicitly named development database; reruns preserve any entries while refreshing the demo dates.
