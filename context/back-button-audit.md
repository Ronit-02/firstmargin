# Back-button visual audit

## Prevent loading-state scroll bounce — 2026-10-22

The Series Stories/Shorts query replaces its grid with a shorter loading state. The earlier same-path offset fix could restore the final position while still allowing the browser to clamp it briefly as content collapsed. This affected other query-backed filters too; final-position assertions did not detect the intervening frames.

AppLayout now reserves enough page-frame height to keep the retained offset reachable before the browser paints a same-path transition. It sets an inherited height floor and disables native scroll anchoring while that reservation is active. Existing PageFrame roots consume the floor through one scoped CSS rule; no wrapper, page, card, control, API, or query-data change is introduced. The floor shrinks with upward scrolling and clears at the top or on a different page path. Empty/error results may retain blank space below their content while scrolled down so they cannot force an unsolicited jump; scrolling upward releases it. Existing cross-page asynchronous history restoration remains in place.

Changed implementation: `Frontend/src/shared/components/layout/AppLayout.jsx` and `Frontend/src/styles/global.css`. New `Frontend/tests/filter-loading-scroll.spec.js` samples scrollTop on every animation frame throughout delayed requests and response rendering, covering Series success/empty/error at 390/1280 px and desktop delayed sorts on Trending, Questions, Shorts, Collections, and Search. It also checks Series focus, upward release, and category history. Verification belongs to the progress tracker. This supersedes the earlier final-position-only assurance for loading transitions.

## Filter/category scroll preservation — 2026-10-22

Audit: AppLayout reset every new query entry to zero and focused the main pane. `Routes location={background}` also overrides the navigation type exposed inside its descendants, so reading that hook in AppLayout misidentified pushes as history traversal. App now passes the BrowserRouter navigation type from above that override. AppLayout retains the departing offset for same-path pushes/replacements, preserves the current control's focus, and continues to restore the destination entry on Back/Forward. A separate entry offset survives a briefly shorter loading/list view while the existing bounded restoration observers wait for content. Different-path navigation still starts at zero. Filter history, routes, layout, typography, colors, backend APIs, and stored data remain unchanged.

Implementation: `Frontend/src/App.jsx`, `Frontend/src/shared/components/layout/AppLayout.jsx`. Regression coverage: `Frontend/tests/filter-history.spec.js` adds real Home category pointer/keyboard scroll and focus checks at phone/desktop widths, including history entries scrolled to different offsets and new-page navigation. The existing `Frontend/tests/back-navigation.spec.js` scroll test invokes its offscreen fixture link without Playwright auto-scrolling it first, isolating route restoration from automation's click preparation. Verification is recorded in the progress tracker. No optional redesign/refactor or approval decision is included.

## Scroll restoration — 2026-10-16

AppLayout records the independent `#main-content` scroll offset under each React Router history-entry key in tab-scoped session storage (most recent 50 entries). New page paths start at the top; same-path filter/category entries retain their offset as corrected above. Browser Back/Forward and the shared Back button restore the destination entry's offset; the departing entry remains available for Forward. Restoration waits briefly for asynchronously rendered content to become tall enough and stops when the reader starts scrolling. The existing Back destinations, page layout, and backend contracts are unchanged. Focused browser checks were added at phone and desktop widths. Frontend lint, build, and scoped whitespace checks passed on 2026-10-16; browser execution was blocked by sandbox loopback access after Playwright's bundled Chromium and ffmpeg were found missing. No browser pass is claimed for that dated run.

The 2026-10-15 Series detail route `/series/:id` uses the existing shell Back row. A fresh direct entry returns to `/series`; the legacy `/shorts/series/:id` fallback remains `/shorts`. The Series index is a primary page without Back. The shared styling and history behavior remain unchanged.

## Sticky Back row — 2026-10-10

The existing AppLayout Back row now uses `position: sticky; top: 0` inside the independent application scroll container. That container starts below the fixed 56 px navbar, so Back stays visible beneath it throughout scrolling without a second control, scroll listener, or route/component restructuring. The row uses the existing opaque page-background token and layer 20, below navigation and overlays. The arrow/label styling, focus treatment, initial spacing, eligible routes, guest History exclusion, history navigation, and direct-entry parent fallbacks are preserved. Onboarding keeps its feature-owned previous-step control.

The current working tree uses the shared 1120 px `.app-page-frame` and responsive 16/20/32 px gutters for page Back rows. This supersedes the separate Search/History/writer widths in the historical October 8 audit below; sticky positioning retains the current shared alignment. The old widths and findings describe that earlier run, not the current frame contract.

Frontend audit: BackButton owns the existing transparent 13 px DM Sans arrow/label and navigation callback; AppLayout owns route opt-in and the row; global.css owns frame/scroll/spacing rules. Libre Baskerville headings, semantic Light/Dark colors, existing content/cards, fixed navbar/sidebar/mobile navigation, and article tools remain unchanged. Backend audit: Express routes/controllers/services and Mongoose records remain authoritative for existing data reads/mutations; scroll presentation adds no API call, contract, schema, or persistence change.

Change scope: `Frontend/src/styles/global.css`, `Frontend/tests/back-layout-audit.spec.js`, this audit, `context/ui-rules.md`, `context/ui-registry.md`, and `context/progress-tracker.md`. No optional redesign, refactor, or approval-dependent decision is included. The added browser cases use long mocked article bodies at 320/1280 px in Light/Dark to verify position, hit-area access, opaque background, focus, and keyboard Back after multiple scroll distances. Dated completed verification belongs in the progress tracker.

The earlier sticky-Back run reproduced an existing writer-profile `!pt-0` override that removed initial content clearance. The subsequent 2026-10-10 [page alignment audit](page-alignment-audit.md) removed that override. All four Back surface matrices now pass at 320/1280 px in Light/Dark, including writer-cover clearance, and all 13 navigation checks pass. The earlier temporary non-sticky baseline and five failures describe the historical run; physical-device, screen-reader, and other-engine verification remain unclaimed.

Audited and corrected: 2026-10-08. Scope: every BackButton caller and every route opted in by AppLayout in the existing working tree.

## Profile editing — 2026-10-10

The requested separate `/profile/edit` route opts into the existing shell Back row. History navigation returns to the previous route; a direct entry falls back to `/profile`. The existing sticky control, styling, frame, and all other route destinations are preserved. Profile editing verification is recorded in the progress tracker.

## Inventory

The 2026-10-14 Reader demand correction opts `/opportunities` into the shared AppLayout Back row. History returns to the preceding page; a fresh entry falls back to Profile. The Find reader demand link now lives in Writing studio Ideas. Its existing PageFrame, typography, question actions, APIs, and data remain unchanged. This supersedes the earlier primary-route exclusion below.

| Surface | Placement owner | Completed placement |
|---|---|---|
| Article `/post/:id` | AppLayout | Dedicated row aligned with article content, before tags/cover and reading tools |
| Writer `/author/:handle` | AppLayout | Matches the shared 1120 px PageFrame and 16/20/32 px gutters (2026-10-10); leaves space above the cover |
| Question `/explore/questions/:id` | AppLayout | Dedicated row before question identity/title |
| Competition `/explore/competitions/:id` | AppLayout | Dedicated row before competition cover |
| Collection `/collections/:id` | AppLayout | Dedicated row before collection cover |
| Series `/shorts/series/:id` | AppLayout | Dedicated row before series label/title |
| Search `/search` | AppLayout | Matches the shared 1120 px PageFrame and 16/20/32 px gutters (2026-10-10) |
| History `/history` | AppLayout | Signed-in view matches shared PageFrame and its gutters (2026-10-10); guest access prompt omits Back (2026-10-10) |
| Membership `/membership` | AppLayout | Dedicated row before page heading |
| Edit profile `/profile/edit` | AppLayout | Existing shared Back row; direct-entry Profile fallback |
| Writer opportunities `/opportunities` | AppLayout | Shared Back row; direct-entry Profile fallback |
| Settings `/settings` | AppLayout | No Back control, per the 2026-10-09 settings request |
| Help `/help` | AppLayout | No Back control, per the 2026-10-09 settings request |
| Login `/login` | Login form | Removed on 2026-10-09; brand link returns home |
| Signup `/signup` | Login form | Removed on 2026-10-09; brand link returns home |
| Email verification | Verification form | Removed on 2026-10-09; brand link returns home |
| Onboarding steps 2 and 3 | Onboarding | Existing previous-step position beside Skip and Next/Get Started; step 1 has no Back |

Source search found no other Back controls or independent history-back handlers. Primary routes, Settings, and Help retain no Back. Authentication verification is a state inside the existing login/signup component, not a new route.

The 2026-10-10 [page alignment audit](page-alignment-audit.md) supersedes the earlier independent page-width contract: every application content page and shell Back row now share PageFrame geometry. The findings below retain their original dated evidence.

## Findings and corrections

- The filled rounded pill carried excessive visual weight. Back now uses a borderless, transparent arrow-and-label presentation with 13 px medium body text, an 18 px rounded-stroke arrow, an 8 px gap/radius, subtle theme-based hover feedback, and a 44 px minimum hit height. Disabled behavior remains available.
- Keyboard focus previously combined the global outline with a component ring. The shared control now explicitly opts out of the global outline and retains one visible focus ring.
- The writer cover began at the Back control's bottom edge (zero clearance), so its focus treatment touched the cover. Content now starts at least 16 px after Back, or 24 px at desktop widths.
- Search and History reused the wider shell Back row despite narrower page wrappers. At 1280 px, Back was respectively 80 and 115 px left of the content. Their row width/gutters now match those existing pages; the arrow aligns with the content edge. Writer gutters also match its existing wrapper.
- Scoped spacing after the shell's Back row replaces inconsistent 32–48 px gaps with 16 px on narrow screens and 24 px at 768 px and above. Primary-page spacing and auth/onboarding composition are unchanged.

No covering element was found over the actual Back hit area on the audited populated pages. The concrete collision was writer-cover/focus clearance, alongside the alignment and duplicate-focus defects. Rounded corners were excluded from hit sampling because they are intentionally outside the rounded target.

## Architecture and change boundary

React Router still owns browser-history Back and fresh-entry parent fallbacks. AppLayout owns application Back rows; onboarding reuses the same component for previous-step navigation. Authentication Back was removed on 2026-10-09. The existing DM Sans/Libre Baskerville typography, semantic theme palette, global navigation, feature content, and page widths remain intact. The backend's Express routes, controllers/services, Mongoose records, API DTOs, authentication, and entitlement flow require no change for this presentation correction. Mocked HTTP responses supply populated UI for repeatable verification without live data mutations.

Implementation files: `Frontend/src/shared/components/ui/BackButton.tsx`, `Frontend/src/shared/components/layout/AppLayout.jsx`, and `Frontend/src/styles/global.css`. Verification files: new `Frontend/tests/back-layout-audit.spec.js` and updated `Frontend/tests/back-navigation.spec.js`. This report owns detailed audit findings; UI rules and registry own the reusable contract.

The 2026-10-09 settings change removes only Settings and Help from the shell Back opt-in list. Other history/parent and auth/onboarding controls retain their existing behavior; the current browser matrix omits these two surfaces from Back measurements and checks their absence instead.

## Verification boundary

The visual matrix captures all 15 route/state variants at 320 and 1280 px in saved Light/Dark themes, with four additional captures of onboarding step 3 beside Skip/Get Started. Automated checks cover loaded content alignment, at least 16 px clearance, unobstructed hit areas, 44 px targets, keyboard focus, horizontal overflow, detail loading/missing/ordinary-error recovery, intermediate responsive widths, short authentication/onboarding forms, and existing history/parent behavior. All 23 distinct browser checks passed across completed runs and the focused timeout rerun. Screenshots and measurements are local generated evidence under `Frontend/node_modules/.cache/back-layout-audit/`.

Final dated command results are recorded in the progress tracker after completion. Physical phone safe areas/keyboards, real browser zoom, screen-reader announcements, Firefox/WebKit, and live persistence are outside these Chromium/mock-API checks. The repository lint configuration excludes TSX; Vite compilation and browser checks cover BackButton. No optional redesign or backend migration is part of this task.
