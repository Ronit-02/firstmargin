# Test-suite audit

Audit date: 2026-10-29. The initial review records the original baseline. Dated follow-ups distinguish test repairs, consolidation, CI selection and bounded application layout fixes.

## Writer appreciation request assertion race — 2026-10-30

GitHub's critical run reported 101 passes and one desktop writer-engagement failure: the counter had optimistically returned to 9 while the fixture had recorded only DELETE, before the subsequent PUT arrived. `usePostLike.onMutate` updates query caches before its asynchronous mutation request, so the visible count is not evidence that the request recorder has run.

`Frontend/tests/writer-post-engagement.spec.js` now polls for the exact `['DELETE', 'PUT']` sequence after the count assertion. The test still fails if the PUT never arrives, has the wrong method/order, or adds a duplicate write. No sleeps, test retries, skips, timeout increases, application code or CI selection changes were added.

Verification on 2026-10-30: all five writer-engagement cases repeated five times passed (25 executions, zero failures/skips/flaky results) in 64.2 seconds. The complete critical suite then passed all 102 cases, with zero failures/skips/flaky results, in 138.4 seconds. Both runs used CI settings, two Chromium workers, intercepted APIs and a task-owned local Vite server, without a database or live provider. Focused ESLint and whitespace validation passed. This is local verification; GitHub Linux CI must rerun the updated spec. Changed files: the writer-engagement spec, this audit and the progress tracker.

## Broad browser failure repairs — 2026-10-30

The reported failure population mixed stale fixtures/selectors with real layout defects. Tests now follow the current story labels, Save story/collection flow, Stories/Shorts series chooser, edit-modal reorder controls, Library format selection, nested short-reader Comments dismissal, profile APIs and moderation envelopes. Question voting is scoped to the intended question. Keyboard category navigation waits for the detail page and its route-focus handoff. Lazy Home sections are scrolled into view before assertions. Card geometry measures the visible clamped heading and actual metadata/footer rather than overflowing descendants or transparent wrappers.

Unrelated fixture requests return a feature-local 404 instead of simulating a network outage; intentional outage cases retain their explicit transport/503 failures. The shared API guard still blocks unmatched requests. Corrected fixtures include saved draft state, pagination metadata, series membership/owner flags and the next short's prefetched detail. Catch-all mocks remain a limitation: a generic successful envelope does not establish an endpoint contract. Playwright expectations allow ten seconds because ordinary query error states appear after the existing three retry delays (about seven seconds). No retries, new skips or expected failures were added.

Two application fixes preserve existing components and appearance: `Frontend/src/features/discovery/pages/Explore/index.jsx` constrains the scrolling tab row to its parent while preventing individual links from shrinking; `Frontend/src/features/notification/pages/NotificationsPage.jsx` limits the mobile inbox height after its existing 54 px top offset and 16 px bottom clearance. APIs, models, development data, fonts, colors, routes and navigation structure are preserved. An attempted card-breakpoint adjustment was reverted after inspecting generated CSS: Tailwind already makes `max-[540px]` exclusive. The 539/540 px boundary remains covered.

Changed repair files are those two application components, `Frontend/playwright.ui.config.js`, the mocked specifications under `Frontend/tests/`, and the owning context files (`test-suite-audit.md`, `test-fixtures.md`, `notifications-audit.md`, `ui-rules.md`, `progress-tracker.md`). Existing isolation/support and independently completed consolidation/CI edits were preserved. The original 865-row ledger remains historical; this repair does not remove cases or alter CI selection.

Verification on 2026-10-30 used local Chrome, task-owned Vite, intercepted API responses and no database or live providers:

| Execution | Passed | Failed | Skipped | Duration |
|---|---:|---:|---:|---:|
| Complete current mocked audit, four workers | 824 | 15 | 2 | 24.2 min |
| Eight affected files after repairs, two workers | 209 | 1 | 0 | 7.1 min |
| Question-search file after final navigation repair, two workers | 9 | 0 | 0 | 22.0 sec |

Latest complete results per file cover all **79 mocked files / 841 cases: 839 passed, two skipped, zero remaining failed cases**. This is combined verification across three runs, not a single final green full-suite command. Both skips require an unconfigured Google client ID. One first-run editor failure recorded `ERR_NO_BUFFER_SPACE` loading `src/main.jsx`; it passed with the normal two-worker setting without an application change. The backdrop wheel test dispatches a continuous gesture within one browser call so assertion round trips cannot split it across the gesture timeout. Separate native-wheel, momentum, touch, boundary and delayed-loading checks passed in the full audit.

Full frontend lint and production build passed after repairs. A 332-file source/test/config hash snapshot taken early in the final replay stayed stable except for the explicitly repaired question-search spec, whose complete file then passed separately. Ignored reports and the per-file verification ledger are under `.tooling/test-repairs-2026-10-30/`. Hosted Linux CI, other engines, physical devices and persisted/provider behavior were not rerun by this repair; separately dated verification remains separate. Local timings do not promise a GitHub duration.

## Critical push/PR gate and manual audit — 2026-10-30

The user approved the execution split after consolidation. Push/PR now runs `npm run test:ui:critical`: 102 deterministic mocked UI cases from the existing 17 smoke files. The optional Google-client-ID case remains in smoke/full audit through an explicit `manualOnlyPatterns` exclusion applied only to the critical scope. No test body, assertion, retry policy or application behavior was changed to create this gate.

The selection covers auth/session restoration and refresh, private-route read gating, editor draft creation/deletion/recovery and browser undo/selection, article reading/progress/metadata/safe rendering, save/collection and appreciation rollback, question submission, search/discovery, keyboard focus/menu access, profile/series discovery, staff scoring restrictions, destructive-post confirmation and workshop access. The existing three persisted publishing/isolation/notification journeys remain required. Backend contracts/integration, frontend unit, lint, dependency audits, build and artifact checks also remain automatic.

| Execution | Browser selection | Other scheduling |
|---|---|---|
| Push or pull request | 102 critical mocked cases plus 3 persisted journeys | Existing core checks retained; full matrix and SEO omitted. |
| Manual CI workflow dispatch | Full 841 mocked cases plus 3 persisted journeys | Includes core checks and SEO. Full mocked audit and SEO continue after earlier failures unless cancelled. |
| Local `test:ui:critical` | 102 mocked cases | Requires only its runner-owned Vite server. |
| Local `test:ui:audit` | All 841 mocked cases | Explicit `--max-failures=0` runs the whole matrix despite individual failures. |

Discovery verified that critical is a subset of the unchanged full population: 102 critical, 739 additional manual-only cases, 841 in the full audit. Full audit intentionally includes critical cases as well. Original smoke/features/responsive/all commands are retained for focused diagnostics. The five-failure critical CI cap still fails an incomplete run; manual full audit overrides it rather than treating unexecuted cases as passes. Reports and temporary-database isolation remain unchanged. This scheduling takes effect when pushed; GitHub manual dispatch requires the workflow on the default branch.

Verification on 2026-10-30:

- All **102 critical mocked cases passed**, with **zero skipped, failed or flaky cases**, in 269.6 seconds using CI settings, two Playwright Chromium workers and task-owned local Vite port. No test retries were added. Test-source hashes confirmed the 17 selected files did not change during the run; concurrent repairs changed only three noncritical spec files and were preserved.
- All **three persisted journeys passed** in 46.8 seconds of browser-reported time, excluding preceding seed/cleanup. They used an independently started loopback MongoDB instance and runner-owned API/frontend ports. The generated database was dropped; inspection found zero remaining run-owned databases. The verification-only service shut down and its data directory was removed after checking its resolved workspace path.
- Frontend lint and its pure-cache unit contract passed. YAML parsing/condition checks confirmed automatic critical versus dispatch-only full/SEO selection. Discovery through the actual audit command confirmed 841 cases and an unlimited failure count; no broader test was deleted. Whitespace validation passed.
- The full 841-case audit and SEO were not replayed for this scheduling-only change; their earlier failure evidence remains below. Local verification does not certify hosted Linux CI, physical devices, other engines or live provider behavior. Browser timings are local observations, not a promised CI runtime.

Changed files for this split: `.github/workflows/ci.yml`, `Frontend/package.json`, `Frontend/scripts/run-ui.js`, `Frontend/playwright.ui.config.js`, `Frontend/tests/support/browser-suites.js`, `Frontend/README.md`, `DEVELOPMENT.md`, `context/test-fixtures.md`, this audit and `context/progress-tracker.md`. Existing concurrent application/test repairs were preserved. No approval decision remains for the authorized split; nothing was pushed from this task.

## Broader mocked UI consolidation — 2026-10-30

This follow-up reviews the functional/responsive population before adopting a smaller push/PR gate. CI triggers and required selection are unchanged. Earlier tables and diagnostic results below remain historical baseline evidence.

### Audit boundary

Reviewed current selectors, runner, isolation/header helpers, the per-case inventory and prior diagnostics; parsed all 82 browser sources and inspected consolidation candidates against their components. The application retains React/Router, AppLayout/PageFrame, Sidebar/Navbar/BottomBar, semantic theme colors, DM Sans UI, Libre Baskerville headings and Source Serif 4 reading text. Query hooks/services call the compatible Express/controller/service/Mongoose backend; mocked checks intercept those HTTP requests and the three persisted journeys stay separate. No application source, routes, APIs, models, dependencies, runner, suite-selector or CI files changed in this follow-up.

Context discrepancy: older README/UI narrative describes Library labels/order superseded by current source and `account-groups.spec.js`: Saved, History, My collections, My series. This test-only cleanup does not alter that UI or restore the removed Discover/My collections tabs on `/collections`.

### Consolidation and coverage owners

| Repeated work | Action and preserved coverage |
|---|---|
| Two existing-membership save-picker cases | One `add-to-collection` case checks the option label, disabled duplicate submission and zero collection writes. |
| Explore activation and separate route-focus case | One phone `route-focus` journey retains links, targets, overflow, active route, focus and scroll reset. Skip-link activation stays separate. |
| Sidebar resizing and separate persistence case | One `responsive-controls` sequence checks ArrowRight/Home/End and reload of the final width. Rail toggling, collapsed persistence and reduced motion stay separate. |
| Extra Browse journey | Both guest/member `mobile-navigation` journeys now include initial Collections active state and absence of a Browse dialog. |
| Two short-series external-entry cases | One `series` case visits first/final records in named steps with one mock setup. Both boundary visits still execute. |
| Final-story overview in article reading | The existing external-series scenario in `series` now checks the final overview and absent next link; selected-series completion/reload/history stays separate. |
| Short-grid interior widths | Keep 359/360 and 407/408 px for both variants and 16/24 px gaps; remove 375/398/400 repeats of the same branch. Representative 390/768/1200 px grid checks remain. |
| Full page-frame sweeps repeated by theme | Keep every surface at 320/768/1280/1920 px with one theme each. These assertions inspect geometry, not colors. Theme/button/modal and sticky-Back checks retain both themes. |
| Full static Back sweeps repeated by theme | Keep every surface at 320/1280 px with one theme each. Sticky Back retains both widths and both themes because it asserts background colors. Loading/recovery, intermediate widths, hit testing and onboarding remain. |
| Removed Discover/My collections tablist on `/collections` | Retire obsolete-control coverage. Current Library keyboard, URL, selection and panel semantics remain in `account-groups`. |
| Three eligible-list observations | Remove cases that only attached alert/retry counts after four failed requests, without asserting recovery. This exposes an existing coverage gap, not replacement coverage. |
| Long-name modal observation | Remove visibility/overflow attachment case. `comment-actions` retains actual long-name geometry assertions for compact/article, phone/desktop and both themes. |

The original 865-row CSV remains a historical migration ledger. Added `current_status`, `coverage_owner` and `consolidation_reason` columns identify each replacement or explicit gap while preserving original locations/titles/results. The previously moved pure-cache case is marked separately.

Repeated setup alone is not duplicate coverage. Keep caller-specific payloads, URLs, permission gates, rollback, loading, focus return, native-dialog versus desktop-popover behavior, intermediate-frame scroll, wheel momentum, caret/selection and exact breakpoint regressions. Report/share matrices remain because they also assert caller-specific endpoints, URLs, stacking and focus restoration. Their shared internals should only be reduced after separating those integration contracts.

### Remaining limits before a smaller required suite

- Current series/competition eligible-writing read failure/retry needs asserted feature-owned coverage; the removed observations never supplied it. Collection creation no longer performs the old eligible-writing read.
- Broad failures require individual fixture/selector or product-regression diagnosis and verification. Unique failing cases remain enabled; no blanket skips, expected failures, retries, tolerance relaxation or CI exclusions were added.
- Successful catch-all fixtures can conceal unexpected API contracts. Shared isolation blocks unmatched requests reaching it but cannot make those catch-alls strict.
- Local Chromium results do not certify other engines, physical devices, providers, persistence or hosted CI. Fewer discovered cases do not measure runtime savings; combined series steps still visit both boundaries.

### Discovery and verification

Verified on 2026-10-30 against the local working tree:

| Selection | Before | After |
|---|---:|---:|
| Mocked functional | 602 | 595 |
| Broader responsive | 259 | 246 |
| Mocked union | 861 | 841 |
| Existing smoke subset, included in functional | 105 | 103 |

Twenty expanded cases were removed through six scenario consolidations, nine redundant matrix rows, four observation-only cases and one obsolete-control case. All 82 browser files remain. Static parsing found 417 current source sites including the three persisted cases, no test without an inline assertion, and discovery found no duplicate file/title pairs. Those checks do not establish semantic uniqueness or runtime correctness of every case.

| Executed mocked selection | Passed | Failed | Skipped |
|---|---:|---:|---:|
| add-to-collection, article-reading, route-focus, mobile-navigation, series, card-grid-columns | 40 | 10 | 0 |
| page-alignment, back-layout-audit, responsive-controls | 32 | 19 | 0 |
| Total affected-file replay | 72 | 29 | 0 |

All seven combined scenarios passed: save membership; Explore/focus; sidebar bounds/reload; guest Browse; member Browse; first/final external short entry; final-story overview with invalid/unavailable series fallbacks. All seven retained grid cases and both reduced static Back sweeps passed. The page-frame sweeps passed at 768/1280/1920 px; the retained 320 px sweep still fails its Trending overflow assertion. It remains enabled with the same assertion.

Final focused recheck: all seven combined scenarios passed again in 53.7 seconds. Hashes of their five source files were unchanged from immediately before to immediately after this run. This verifies the replacements on a stable source snapshot despite the concurrent broader repair work; it does not certify the full suite. Output is ignored under `.tooling/test-audit/consolidation-final-output`.

Failures in those replay snapshots by file: `mobile-navigation` 1 (Clear versus Close search); `series` 9 (old labels/actions, `postIds` versus current payload, membership fixture and ambiguous links); `back-layout-audit` 4 (in-flight route teardown/state assumptions and short-form timeout); `page-alignment` 10 (overflow, recovery fixtures, origin/centering assumptions, route inventory missing staff judging, and obsolete/stacked header expectations); `responsive-controls` 5 (recovery fixtures, removed inline series reorder target and skip-link timing/focus). These are triage findings, not a claim that every failure is a product defect or harmless test defect. No failing case was removed because it failed. In particular, the inline series reorder expectation needs its own current edit-modal coverage mapping before retirement.

Full frontend lint and scoped whitespace validation passed. Initial sandbox runs could not reach loopback HTTP (`EACCES`) and were stopped; the two completed replays used task-owned local Vite ports, mocked HTTP, two workers each, no database and no providers. Another independent repair/diagnostic run was active and changed some of these same test files during the replays (including the series payload expectation). Its changes were preserved. Therefore the 29 failures describe the sources loaded by these replays, not a fixed final revision or the latest repair status, and durations are not a controlled performance comparison. The entire 841-case union, remaining modal matrix, persistence, build, other engines and hosted CI were not rerun for this test-only cleanup. A green historical smoke run does not certify the new revision.

Changed files in this follow-up: ten specs under `Frontend/tests/` (`add-to-collection`, `article-reading`, `back-layout-audit`, `card-grid-columns`, `mobile-navigation`, `modal-audit`, `page-alignment`, `responsive-controls`, `route-focus`, `series`), `Frontend/README.md`, `context/test-fixtures.md`, this audit, `context/test-case-review.csv`, and `context/progress-tracker.md`. No approval-dependent application change is proposed. Adopting a smaller critical push/PR suite remains a subsequent step after its coverage selection and passing verification.

## Implemented follow-up

- Backend contracts now discover all non-integration test files. The five omitted files add 27 runnable cases; stale avatar request bodies were repaired. All 163 non-database contracts passed, and all 16 enabled integration cases passed against a separately owned temporary database.
- Persisted Playwright selects only three real-backend journeys. Their repaired publishing, compact-reader, comments and reload assertions passed; the run-owned database was dropped. Dedicated test ports avoid development servers.
- The remaining browser population is 861 mocked cases: 602 functional cases and 259 broad responsive audits. A 105-case functional smoke subset is independently executable. Their API origin is an unused loopback port, API requests are intercepted, and MongoDB is never started or contacted by this runner. The pure cache case moved to node:test and passed.
- Tests and supporting fixtures stay under each package's `tests/` directory. Component fixtures import components directly rather than scraping optimized Vite source. Shared helpers handle custom checkbox keyboard interaction and current modal-header rules.
- CI currently retains every browser case and its original triggers, with separate unit/mocked/persisted steps, two mocked workers, no video, and a five-failure cap. A failed cap means incomplete execution, never a green full-suite claim.

The full diagnostic replay covered all 861 mocked cases in **35.8 minutes**: **633 passed, 226 failed, two skipped**, with four workers and a 20-second diagnostic case timeout. There were 71 test-timeout failures. Summed case execution was 53.7 minutes for passing cases and 51.4 minutes for failing cases; these are overlapping worker durations, not additive wall-clock phases. The full run therefore confirms substantial browser/test cost without MongoDB, and nearly half of active case time was spent in failures. It does not measure the user's GitHub host or establish a precise CI speedup. Repairs continued while this diagnostic ran, so its results describe the diagnostic baseline, not a final green revision.

The slowest files by summed case time were page-alignment (438 seconds), back-layout (378), post-detail-layout (374), modal-audit (357), report-modal (253), and discovery-post-card (225). Several cases loop over many pages or actions internally, so reducing the discovered case count alone does not measure reduced work. Current smoke reruns and remaining limitations are recorded separately below. Broad audits must not be described as a repaired green baseline merely because persisted journeys and backend contracts pass.

Final smoke verification on 2026-10-29: **104 passed, one optional Google identity-provider case skipped, zero failures, 4.2 minutes with two workers**. This is one complete 105-case run after draft autosave, custom checkbox, reader, role/tab, exact-link and fixture-envelope repairs. The three persisted cases passed in 23.3 seconds of Playwright-reported duration; that number excludes the runner's preceding seed and following cleanup. No full-workflow CI speedup is claimed. The full mocked suite has not been rerun to green after these repairs; its additional audit failures are still required by the currently retained CI selection.

Additional focused verification: all 49 account/editor cases passed together in 2.0 minutes after Library tab, proportional-font caret and saved-draft fixture repairs. Dropdown creation/judging and filter-reset cases passed in the preceding focused replay. Frontend lint and whitespace checks passed after the final test-source changes. The task-owned MongoDB service reported zero remaining E2E/integration databases, shut down with exit code zero, and its verified task-owned data directory was removed. Existing development services and data were not used.

## Duplicate and necessity review

[Case review](test-case-review.csv) maps all 865 originally discovered cases to their execution layer; the prior description of 862 database-independent cases includes the pure cache case now moved out of Playwright. An AST comparison of test callback bodies (ignoring source locations) found **zero identical bodies across separate test definitions**. Expanded titles are also unique. These checks do not prove absence of semantic duplication.

The 438 additional matrix rows beyond 427 source sites are primarily viewport/theme/role/route expansion. Retain persistence/isolation and real layout/focus/caret/gesture boundaries. Broad shell, modal and card geometry assertions overlap; consolidating them requires replacing their distinct boundary assertions, not deleting files based on repeated names. Obsolete assertions against removed controls need replacement or explicit retirement: for example, collection-detail direct addition, manual competition winner selection, old Library subtabs and the former short-card DOM. The present review does not claim every one of the original 865 cases is necessary, and does not silently discard the unresolved audit cases.

## Initial baseline evidence

## Scope and inventory

Reviewed all 82 Playwright spec files, all eight backend test files, both test helpers, package scripts, browser configurations, runner, CI workflow, and the existing fixture/verification context. Static parsing read each test source; Playwright discovery enumerated every expanded case. Targeted execution supplements that review; the full 865-case browser suite was not executed.

| Original suite | Count | Interpretation |
|---|---:|---|
| Chromium-discovered cases | 865 in 82 files | 427 distinct source locations expand through viewport, theme, role, route, and content matrices. |
| Backend-dependent Playwright cases | 3 | Critical publishing journey, database isolation API check, and notification recovery using real login with one mocked endpoint. |
| Mocked application UI cases | 851 | Browser interaction/rendering checks with API fixtures; these do not establish backend persistence or authorization. |
| Isolated HTML/CSS cases | 10 | `card-grid-columns.spec.js`; useful real-browser layout checks without an application backend. |
| Pure function case in Playwright | 1 | Post-cache traversal in `post-components.spec.js`; it does not request a browser fixture. |
| Normal backend command | 136 | Only foundation contracts and temporary-database regressions. |
| Backend cases omitted from that command | 27 in 5 files | Includes expanded role-transition cases. These are not picked up elsewhere in CI. |
| Opt-in MongoDB integration cases | 16 | Separate from the 136 normal cases; CI enables this suite. |

The classifications total 865; they describe the current source, not a measurement of execution time. There are 79 files containing API mock registration, but one is the partly real notification test and one also includes the pure cache test. Counting mock-containing files alone overstates the fully mocked population. There are no duplicate expanded test titles; semantic overlap and repeated matrix dimensions are separate issues.

## Findings and actions, in priority order

### 1. P1 — Important backend tests are absent from CI

`Backend/package.json` explicitly lists only `foundation-contracts.test.js` and `temporary-database.test.js`. The integration command explicitly lists its own file. Consequently, five files are not run by either command:

| File | Runnable cases | Current audit execution |
|---|---:|---|
| `admin-entitlements.test.js` | 1 | Passed |
| `competition-choice.test.js` | 10 | Passed |
| `competition-edit.test.js` | 2 | Passed |
| `profile-avatar.test.js` | 4 | 1 passed, 3 failed |
| `staff-users.test.js` | 10 | Passed |

The three avatar upload tests construct requests without `body` (`profile-avatar.test.js`, lines 46, 71, and 92), while the current controller reads `req.body.avatarUrl` at `Backend/controllers/user.controller.js:141`. The observed 500 responses and missing upload cleanup are consistent with stale request fixtures failing before their intended assertions. Repair those fixtures and then include every intended backend contract file in the command, keeping the opt-in database suite explicit. Do not blindly enable all files and accept a newly red CI baseline.

### 2. P1 — The real publishing journey has stale expectations

The replay of `Frontend/tests/critical-flow.spec.js` passed login but timed out at line 19 looking for `Write a post`; the current Studio button is `Write a story` (`Frontend/src/features/user/pages/Profile/index.jsx:251`), also present in the failure snapshot. Later source expectations are stale too: line 32 expects `Save this article`, then `Manage saved article`; the test publishes a short, whose canonical route dispatches to the compact reader. Current short actions are `Save this short` / `Manage saved short` (`Frontend/src/features/discovery/components/ShortReadModal.jsx:330`). The same scenario tries to fill comments without opening the current comments interaction. This case is the only intended complete real browser publishing/persistence journey, so repair it before treating a smaller smoke suite as sufficient. Keep its reload/persistence assertions rather than replacing it entirely with mocked actions.

`article-reading.spec.js:58`, `:62`, `:68`, `:74`, and `:119` still target `Article body`; the current reader uses `Story body` (`Frontend/src/features/post/pages/index.jsx:350`). Other cases in that file have additional failures and must be diagnosed individually rather than assuming one label replacement fixes the entire file.

`button-design.spec.js:93` also expects `Article overview`, while `AIPanel.jsx:28` names the control `Story overview`; two replayed cases timed out waiting for that old name. Its notification target case expects a 44 px bounding box and observes 36 px. Navbar deliberately uses a 36 px visual control plus a pseudo-element inset hit area, so the bounding-box failure alone does not establish a product touch-target defect. Reconcile the asserted visual/hit-area contract before changing either the test or the UI.

### 3. P2 — Most browser cases unnecessarily require a database

862 of 865 cases are database-independent by source classification. Nevertheless, `Frontend/scripts/run-e2e.js` connects, seeds the complete community dataset, and starts the API for every invocation, including a single CSS fixture or pure function case. The isolation protection is valuable, but its lifecycle currently applies to tests that do not use the database.

Introduce separate supported configurations/commands for mocked UI and real E2E. The mocked configuration must block unexpected real API requests and must not attach to a development API. Keep fresh run-owned databases and ownership-checked cleanup for the three backend-dependent cases. A smaller dedicated seed may further help those cases, but needs an explicit fixture contract before replacing the current maintained catalog.

### 4. P2 — Browser/component/unit boundaries are mixed

Move the pure cache traversal case (`post-components.spec.js:9`) to a frontend unit-test command. Keep its immutability and nested-shape assertions. Do not move CSS grid, focus trapping, scroll, selection/caret, reduced-motion, gesture, or viewport-dependent behavior to a non-rendering test environment merely to reduce the browser count.

`button-design.spec.js:10–25` mounts controls by parsing Vite-transformed source and importing optimized dependency URLs. That is component coverage coupled to dev-server internals. Prefer a stable component/browser fixture when reorganizing the suite. `card-grid-columns.spec.js` is already a useful isolated real-browser fixture; it needs neither the large seed nor a live API.

### 5. P2 — Matrix expansion and broad audits dominate the count

865 cases originate at 427 source locations. Examples: `modal-audit.spec.js` expands seven source sites to 58 cases; editor layout has 39 cases; discovery cards 35; auth access and button loading have 29 each. The ten largest files contain 309 cases. This multiplication is often intentional, not evidence of 438 deletable tests.

For interaction logic that does not change by theme, retain one representative theme and relevant phone/desktop behavior in the frequent suite; run the full theme/viewport matrix in the broader suite. Preserve boundary-specific cases such as 359/360/407/408 px grid transitions and phone versus desktop modal interactions. Extract common shell invariants only after mapping which assertion each specialized test uniquely protects.

Candidate consolidation clusters:

- Shell size/overflow/target geometry across `responsive-controls`, `page-alignment`, `back-layout-audit`, and dedicated layout specs.
- Focus containment, dismissal, and focus return across `modal-audit`, `overlay-position`, account/search/notification specs, and shared modal-header checks. Retain distinct desktop popover and native mobile-dialog behavior.
- Short-reader dimensions/navigation across discovery cards, short layout/format, and the specialized scroll suite. Keep momentum, replacement-pane, touch, and edge-handoff regressions in the specialized suite.
- Global notification-outage recovery appears in both the full notification suite and the partly real recovery case. The latter additionally covers real session establishment, so these are not interchangeable without deciding which boundary to retain.

### 6. P2 — Some checks observe defects without failing

`modal-audit.spec.js:126–128` adds annotations for small targets, low contrast, and lost draft text. These observations do not make a test fail. Keep exploratory observations separate from assertions for approved requirements; a green result does not mean those properties passed. There are zero `toHaveScreenshot` or `toMatchSnapshot` assertions across the browser specs; saved PNGs are manual evidence, not automated visual regression comparisons.

The accessibility audit provides useful shell/name/reference/overflow checks but uses a hand-written name heuristic and mocked guest/error routes. It is not a complete accessibility assessment and does not cover every authenticated modal state. Preserve keyboard/focus checks and consider targeted accessibility-engine checks separately; do not count a route smoke check as WCAG assurance.

### 7. P2 — Mock permissiveness and skipped providers limit assurance

Many API fixtures return generic successful empty data for unrecognized routes (for example `modal-audit.spec.js:22`). This can conceal an unexpected request or a contract mismatch. Use explicit fixture contracts and fail unexpected requests in the future mocked-only harness. Maintain a small set of actual API contract/persistence journeys.

Two tests can call `test.skip(true, ...)` at runtime when Google sign-in is unavailable (`auth-access-modal.spec.js:238`, `profile-settings-auth.spec.js:28`). Playwright list discovery does not execute those branches, so listing 865 cases is not evidence that all 865 will execute. The seed runner clears provider credentials; these tests cannot certify live identity-provider behavior. Give deterministic mocked provider UI checks and separately authorized provider verification distinct names and reporting.

### 8. P2 — CI scheduling amplifies the cost

The one workflow runs on both unrestricted push and pull-request events. It has no concurrency cancellation or path filtering. The browser step runs the entire test directory, despite being named “authenticated browser critical flow.” The configuration uses one Chromium project, one worker, and `fullyParallel: false` for every case. Many mock-only cases could eventually use bounded concurrency after checking fixture isolation; the current seeded cases should retain intentional serialization.

Use a clear split before changing worker counts: fast backend checks; a repaired representative PR browser suite; relevant feature/layout suites for changed areas; and the complete responsive/audit matrix on a scheduled or explicit broader run. Avoid duplicate push/PR runs for the same branch and cancel superseded runs. Configuration changes are proposals only in this audit.

### 9. P3 — Timing and coverage reporting need tighter boundaries

There are 14 `waitForTimeout` call sites in eight files. Several short-reader waits deliberately test cooldown/gesture behavior; retain those or inject a deterministic clock. Replace unnecessary animation/transition sleeps with state/animation completion checks where practical. Page-alignment cases permit 120–180 seconds and loop through many routes inside one case, so the number of cases is a poor proxy for suite cost.

Only desktop-Chromium settings are configured; resizing to a phone width is not an independent mobile browser engine run. No code-coverage report/threshold or historical per-case timing budget is configured in the inspected scripts. This audit did not retrieve GitHub execution history, so it cannot establish a long-term flake rate or promise a runtime reduction percentage.

## Proposed execution split

| Layer | Proposed cadence | Content |
|---|---|---|
| Fast contracts/unit | Local changes and every PR | All intended backend contract files after fixture repair; frontend pure cache logic and similar future pure utilities. |
| Database integration | Backend changes and required PR verification | Existing 16 integration cases, on a fresh test database. |
| Browser smoke | Every PR | Repair the real publishing/reload path; retain the isolation check; representative sign-in, discovery/search, save/comment, keyboard/modal, and role-gated action checks. Select by distinct risk, not entire large files. |
| Feature UI/layout | Relevant frontend changes | Affected feature specs plus shared shell regressions when their components/styles change. Mocked suites do not need MongoDB. |
| Full responsive/audit matrix | Scheduled, explicit pre-release, or major shared-UI changes | Wider themes, viewport combinations, cross-surface geometry and exploratory audit observations. Establish a green baseline before moving failures to this cadence. |

Do not delete tests in bulk, silently skip failures, add retries to hide stale assertions, or weaken database isolation. Implementation priorities are: repair excluded/stale tests; wire backend discovery; separate mocked and persisted harnesses; tag/select the frequent suite; then consolidate truly redundant matrix dimensions with explicit coverage mapping. No numeric smoke target is treated as an approved scope or a verified saving.

## Execution evidence and limitations

Playwright discovery succeeded with 865 cases in 82 files, without connecting to a database. All eight backend files were executed together with sanitized test settings and the integration opt-in disabled: 164 reported cases, 160 passed, three avatar failures, one integration-gate skip. The normal command's 136 tests are included in those results. The five omitted files expand to 27 runnable cases; their outcomes are listed above. This audit did not rerun the 16 enabled database-integration cases, which have separate historical evidence in the progress tracker.

Two browser samples executed 38 distinct cases: 27 passed and 11 failed. The first selected 50 cases but stopped after ten failures: seven article-reading failures, one notification visual-size mismatch, and two button-design stale-label timeouts; 40 selected cases did not execute. Its reported browser phase lasted 183.9 seconds. The follow-up executed all 28 selected cases in 82.5 seconds: ten grid cases, three judging cases, ten editor-history cases, three writer-search cases, and real-login notification recovery passed; the critical publishing case failed on the old Studio button name. These are bounded diagnostic samples, not a random estimate of full-suite pass rate or long-term flakiness. The samples' reported durations exclude seed setup; no full-suite runtime saving is claimed.

The initial replay correctly refused an occupied default API port and removed its temporary database. Audit-only configuration used separate API/frontend ports and installed Chrome, preserving run-owned database guards and `reuseExistingServer: false`. Existing app processes and development data were not used. The runner reported removal of each sample database after failure. Execution JSON evidence remains ignored under `.tooling/test-audit/`; no credentials, tokens, fixture account values, or private environment settings are copied into this report. The task-owned MongoDB service is stopped after verification and its audit data directory is removed. CI Linux, Firefox/WebKit, physical devices, live providers, and enabled database integration were not executed in this audit.

## Per-file review inventory

The following inventory covers every discovered browser spec and every backend test file. Recommendations describe the next review/placement action, not permission to remove coverage. “Mocked” denotes test-owned API responses; the special real-login recovery case and pure function exception are called out explicitly.

### Browser files

| Spec file | Cases | Current boundary | Recommended action |
|---|---:|---|---|
| `accessibility-audit.spec.js` | 25 | Mocked app UI | Keep shell semantics/overflow smoke; consolidate alias routes and label the hand-written scan accurately. |
| `account-groups.spec.js` | 10 | Mocked app UI | Keep URL/tab and private-access behavior; use representative phone/desktop cases in the frequent suite. |
| `add-to-collection.spec.js` | 14 | Mocked app UI | Keep save/collection mutations, pending, retry, and keyboard behavior; consolidate repeated theme-only checks. |
| `appreciation-style.spec.js` | 6 | Mocked app UI | Run the full cross-surface/theme style matrix with shared-action visual changes; retain representative action behavior elsewhere. |
| `article-not-found.spec.js` | 1 | Mocked app UI | Keep missing-resource recovery; share fixtures/contracts with other missing-resource specs. |
| `article-of-day.spec.js` | 12 | Mocked app UI | Keep independent author/card destinations and rollback; reduce repeated geometry where shared card coverage owns it. |
| `article-reading.spec.js` | 7 | Mocked app UI | Repair stale Story-body/series selectors and diagnose other fixture/rendering failures; preserve security and progress coverage. |
| `auth-access-modal.spec.js` | 29 | Mocked app UI | Keep auth return paths, guest/private gating, refresh races; distinguish provider skips and limit redundant viewport combinations. |
| `author-series.spec.js` | 4 | Mocked app UI | Keep author-scoped pagination, URL restoration, and recovery. |
| `back-layout-audit.spec.js` | 13 | Mocked app UI | Broader shared-shell layout audit; consolidate repeated geometry with page alignment while retaining distinct Back behavior. |
| `back-navigation.spec.js` | 16 | Mocked app UI | Keep history, scroll restoration, parent fallbacks, and route exceptions; select phone/desktop smoke cases. |
| `button-design.spec.js` | 8 | Mocked app UI | Repair stale control labels/target expectations; migrate Vite-internal component mounting to a stable component fixture. |
| `button-loading.spec.js` | 29 | Mocked app UI | Keep pending, duplicate-write prevention, and retry semantics; make theme-only surface matrices a broader run. |
| `card-grid-columns.spec.js` | 10 | Isolated HTML/CSS | Keep real-browser CSS breakpoint boundaries; remove backend/seed requirement for this isolated HTML fixture. |
| `collection-detail.spec.js` | 12 | Mocked app UI | Keep owner append, pending writes, cancel/retry and order semantics; feature-run full header geometry. |
| `collection-menu.spec.js` | 1 | Mocked app UI | Keep keyboard menu traversal and focus return; reuse shared-menu fixture after mapping unique owner actions. |
| `collections-layout.spec.js` | 17 | Mocked app UI | Keep pagination and mixed-format behavior; reserve full cover/width matrix for responsive regressions. |
| `comment-actions.spec.js` | 24 | Mocked app UI | Keep thread mutations, soft-delete rendering, pending recovery and keyboard flow; consolidate repeated compact/article geometry. |
| `competition-entries-layout.spec.js` | 5 | Mocked app UI | Keep variable-title alignment and independent voting/navigation targets; run full viewport matrix for competition/card changes. |
| `competition-remove-entry.spec.js` | 9 | Mocked app UI | Keep role gating, owner confirmation, duplicate-write protection, lifecycle visibility and retry; backend tests must enforce the real rules. |
| `competition-scoring.spec.js` | 3 | Mocked app UI | Keep all three role/legacy-slot interactions; useful small PR candidate once backend contract files are wired. |
| `competitions-layout.spec.js` | 5 | Mocked app UI | Feature responsive layout/filter coverage; retain distinct small-width transitions. |
| `critical-flow.spec.js` | 1 | Real browser/API/database | Repair as highest-priority real browser smoke; align short-reader save/comment controls and retain persistence/reload checks. |
| `discovery-post-card.spec.js` | 35 | Mocked app UI | Keep independent targets, engagement rollback and modal navigation; relocate duplicate short-scroll mechanics to the owning scroll suite. |
| `dropdown-alignment.spec.js` | 10 | Mocked app UI | Keep payload/required-field contracts and keyboard choices; split geometry from behavior when selecting smoke. |
| `e2e-isolation.spec.js` | 1 | Real API/database; no page | Keep run-owned API-write verification; classify as API/database integration, not a rendered browser journey. |
| `editor-history.spec.js` | 10 | Mocked app UI | Keep caret/focus and browser editing/undo behavior; pure history transforms could gain separate unit coverage later. |
| `editor-layout.spec.js` | 39 | Mocked app UI | Keep mobile/desktop insertion and caret regressions; place repeated width/theme geometry in the responsive layer. |
| `editor-overlay.spec.js` | 16 | Mocked app UI | Keep dismissal, menu bounds, autosave/update ownership and release clearing; replace nonessential transition sleeps. |
| `editor-publish-modal.spec.js` | 3 | Mocked app UI | Keep publication validation/submission and tooltip accessibility; useful feature/smoke candidate. |
| `editor-selection-toolbar.spec.js` | 3 | Mocked app UI | Keep real selection/focus/formatting checks; do not replace these with string-only unit tests. |
| `editor-tags.spec.js` | 3 | Mocked app UI | Keep tag limits, literal creation, keyboard reopening and failed-request recovery. |
| `filter-history.spec.js` | 13 | Mocked app UI | Keep URL/reload/Back and focus/scroll state; designate it as the owner of filter-history invariants. |
| `filter-loading-scroll.spec.js` | 11 | Mocked app UI | Keep intermediate-frame scroll-clamp regressions; final-offset-only checks are not equivalent. |
| `filter-reset.spec.js` | 11 | Mocked app UI | Repair popover lifecycle expectations after query changes; consolidate shared reset semantics without losing URL checks. |
| `find-writers.spec.js` | 3 | Mocked app UI | Keep the small search/navigation/recovery set; useful representative PR checks. |
| `help-page.spec.js` | 6 | Mocked app UI | Keep public recovery/navigation; move repeated member/guest shell placement to the broader shell run. |
| `home-sections.spec.js` | 4 | Mocked app UI | Keep deferred-loading failure, retry, and carousel behavior; feature-run excerpt geometry. |
| `hover-titles.spec.js` | 1 | Mocked app UI | Keep a narrow browser/native-title check if it remains an approved UI contract; consolidate shell enumeration. |
| `list-category-fitting.spec.js` | 2 | Mocked app UI | Keep whole-pill fitting on resize; distinct CSS/layout behavior warrants a browser. |
| `membership-page.spec.js` | 20 | Mocked app UI | Keep entitlement/error gating and provider-outage UI; these mocks do not verify billing provider behavior. |
| `mobile-navigation.spec.js` | 4 | Mocked app UI | Keep mobile navigation/account activation and selected destinations; good smoke candidates. |
| `mobile-profile-sheet.spec.js` | 15 | Mocked app UI | Keep focus containment, resize exit and reduced motion; feature-run full viewport/animation matrix. |
| `mobile-search-dialog.spec.js` | 6 | Mocked app UI | Keep keyboard-sized viewport, focus restoration, debounce/error state and navigation; avoid duplicating desktop autocomplete logic. |
| `modal-audit.spec.js` | 58 | Mocked app UI | Separate observational findings from enforced regressions; broader matrix after fixture/trigger refresh, representative focus/dismissal smoke. |
| `navbar-search.spec.js` | 10 | Mocked app UI | Keep combobox keyboard access, stale-response handling and capped groups; use representative viewport combinations. |
| `notifications-modal.spec.js` | 16 | Mocked app UI | Keep per-item/read/delete/pagination failures and desktop/mobile differences; consolidate duplicated global-outage smoke. |
| `notifications-recovery.spec.js` | 1 | Real login + mocked failure | Partly mocked, real-login recovery case; retain only with explicit integration ownership and overlap mapping. |
| `opportunities.spec.js` | 1 | Mocked app UI | Keep ranked-opportunity rendering as a small feature check; rank correctness belongs in backend tests. |
| `overlay-position.spec.js` | 14 | Mocked app UI | Keep clipping/scroll attachment and stacking behavior in the browser; broader shared-overlay matrix. |
| `page-alignment.spec.js` | 20 | Mocked app UI | Broader shell/layout audit with long internal route loops; keep explicit route inventory but avoid treating its case count as runtime cost. |
| `post-components.spec.js` | 22 | 21 mocked UI + 1 pure function | Move the pure cache case to unit tests; keep cross-container cache/UI synchronization and format rendering as browser feature coverage. |
| `post-deletion.spec.js` | 2 | Mocked app UI | Keep destructive-action confirmation, failed-write retention, and list refresh; real backend cleanup is separately covered by integration tests. |
| `post-detail-layout.spec.js` | 20 | Mocked app UI | Keep action gating and tool-dialog behavior; feature-run full metadata/layout/theme matrix. |
| `post-list-spacing.spec.js` | 4 | Mocked app UI | Broader card typography/layout contract; retain a representative long-metadata boundary. |
| `profile-cover.spec.js` | 3 | Mocked app UI | Keep preview/cancel/retry/remove and independent saving; provider persistence still needs backend coverage. |
| `profile-discovery.spec.js` | 14 | Mocked app UI | Keep follow rollback, writer identity, request eligibility and state restoration; mocks are not a real membership check. |
| `profile-edit.spec.js` | 8 | Mocked app UI | Keep staged saves, private access, independent avatar updates and cancel; repair backend avatar fixtures separately. |
| `profile-settings-auth.spec.js` | 10 | Mocked app UI | Separate conditional Google checks from deterministic auth/form/viewport coverage; document runtime skips. |
| `question-card-layout.spec.js` | 3 | Mocked app UI | Keep preview/link/action separation; broader card layout coverage. |
| `question-detail.spec.js` | 4 | Mocked app UI | Keep response paths, follow, and loading states; consolidate shared page-frame geometry. |
| `question-dialog.spec.js` | 1 | Mocked app UI | Keep required semantic form, payload and retry; useful small feature/smoke candidate. |
| `report-modal.spec.js` | 18 | Mocked app UI | Keep guest gating, reason validation and failed-write retention; reduce width-by-subject repetition only after coverage mapping. |
| `resource-not-found.spec.js` | 3 | Mocked app UI | Keep resource-specific recovery destinations; centralize common error fixtures with article-not-found. |
| `responsive-controls.spec.js` | 27 | Mocked app UI | Keep unique semantic/keyboard/target contracts; split shared component checks from repeated page sweeps. |
| `route-focus.spec.js` | 1 | Mocked app UI | Keep client navigation focus reset; small browser-specific PR candidate. |
| `search-filter-position.spec.js` | 9 | Mocked app UI | Keep query/tab/vote recovery and anchored filter behavior; split layout cases from data/URL cases. |
| `search-popular.spec.js` | 7 | Mocked app UI | Keep empty/whitespace query routing and tab-specific recovery; ranking correctness remains backend responsibility. |
| `series.spec.js` | 21 | Mocked app UI | Keep selected-series order, owner mutations and format boundaries; broader chapter fitting matrix and replace nonessential sleeps. |
| `share-menu.spec.js` | 12 | Mocked app UI | Keep per-format URL and focus behavior; collapse redundant shared-dialog internals after verifying unique source formats. |
| `short-format.spec.js` | 7 | Mocked app UI | Keep canonical short dispatch and mixed-format ordering; retain real browser navigation rather than only DTO assertions. |
| `short-layout.spec.js` | 10 | Mocked app UI | Keep title/footer overflow and pagination; retain exact responsive boundaries and minimize redundant generic card assertions. |
| `short-reader-scroll.spec.js` | 15 | Mocked app UI | Keep specialized native wheel, momentum, replacement-pane, touch-edge and reduced-motion regressions; timing-sensitive waits need deliberate review. |
| `staff-fraud.spec.js` | 2 | Mocked app UI | Keep moderation/recovery UI; file does not exercise actual fraud-analysis service, which has backend coverage. |
| `staff-navigation.spec.js` | 10 | Mocked app UI | Keep role visibility, URL tabs and filter defaults; broader responsive placement checks and remove nonessential transition sleep. |
| `staff-users.spec.js` | 1 | Mocked app UI | Keep permitted role-edit UI and unavailable removal controls; actual authorization belongs in the currently omitted backend staff suite. |
| `studio-creator-tools.spec.js` | 1 | Mocked app UI | Keep workshop/update/request payload and workspace ownership paths. |
| `theme-preference.spec.js` | 7 | Mocked app UI | Keep system/explicit preference persistence and reduced motion; broader dropdown geometry matrix. |
| `trending-menu.spec.js` | 9 | Mocked app UI | Keep pagination, keyboard menu and report focus return; centralize shared-menu mechanics after mapping featured-card differences. |
| `workshop-reservation.spec.js` | 3 | Mocked app UI | Keep organizer links, retry/access recovery and inbox joining flow; actual attendee persistence stays backend-owned. |
| `write-drafts.spec.js` | 9 | Mocked app UI | Keep private access, draft creation/deletion pending/failure and legacy URL behavior; select representative phone/desktop smoke. |
| `writer-post-engagement.spec.js` | 5 | Mocked app UI | Keep viewer-specific appreciation/save rollback and guest access; preserve real backend batching/authorization coverage separately. |

### Backend files

| Test file | Enabled cases | Current CI selection | Recommended action |
|---|---:|---|---|
| `admin-entitlements.test.js` | 1 | Omitted | Keep and include in contract discovery; the audit run passed. |
| `competition-choice.test.js` | 10 | Omitted | Keep and include in contract discovery; the audit run passed. |
| `competition-edit.test.js` | 2 | Omitted | Keep and include in contract discovery; the audit run passed. |
| `foundation-contracts.test.js` | 129 | Normal npm test | Keep domain/HTTP security checks; split the large file by owning domain only as separate approved maintenance. |
| `integration.test.js` | 16 | Opt-in integration command | Keep isolated real persistence/authorization tests; no live-provider calls. |
| `profile-avatar.test.js` | 4 | Omitted | Repair three stale request fixtures, then include. |
| `staff-users.test.js` | 10 | Omitted | Keep and include in contract discovery; the audit run passed. |
| `temporary-database.test.js` | 7 | Normal npm test | Keep ownership, configuration and no-fallback guards; avoid weakening cleanup checks for speed. |

Helpers reviewed: `Backend/tests/support/temporary-database.js` owns generated targets, sanitized environment, preflight and ownership-checked drop. `Frontend/tests/helpers/modal-header.js` owns shared modal header geometry/style assertions; use it as a single contract rather than duplicating its checks in more route tests. The runner and both supported Playwright configurations were also inspected.
