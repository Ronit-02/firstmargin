# Account grouping audit — 2026-10-12

## Profile cover images — 2026-10-21

Audit: personal Profile had no cover surface; public Author had only a decorative gradient with no stored cover field. Edit profile already supports an independently saved avatar modal with upload/URL sources, local preview, removal, pending/error recovery, and guarded picker dismissal. Existing Profile storage, owner authentication, Multer/Sharp validation, Cloudinary utilities, public writer DTO, query invalidation, and native modal components cover the requested addition. The requested before/after is an optional persisted cover on both profiles plus an independently saved editor matching the avatar flow. Existing identity content, avatar behavior, typography, theme, navigation, and profile-text submission remain preserved.

Completed: personal Profile and public Author render a shared cover surface with the prior author dimensions, border/radius, and gradient fallback. Edit profile adds a clickable cover preview opening a Cover image modal. Upload or URL selection stays local until modal Save; removal is staged, dismissal discards changes, and failures retain the preview for retry. Saving invalidates personal/public profile reads without submitting staged biography, name, or interests. Existing accounts without a cover need no migration. No optional redesign or approval decision remains.

Changed implementation: `Backend/schemas/profile.schema.js`, `Backend/controllers/user.controller.js`, `Backend/controllers/writer.controller.js`, `Backend/routes/user.routes.js`, `Backend/utils/cloudinary.js`, `Backend/tests/foundation-contracts.test.js`, `Backend/tests/integration.test.js`, `Frontend/src/features/user/api/profile.js`, new `Frontend/src/features/user/components/ProfileCover.tsx` and `ProfileCoverEditor.tsx`, `Frontend/src/features/user/pages/Profile/index.jsx`, `Frontend/src/features/user/pages/Profile/EditProfilePage.tsx`, `Frontend/src/features/user/pages/Author/index.jsx`, and new `Frontend/tests/profile-cover.spec.js`. Documentation: Frontend README, architecture, UI rules/registry, this audit, progress tracker, and the ignored architecture companion.

Verification on 2026-10-21: all 121 backend contracts, backend lint, frontend production build, focused frontend/spec lint, 93-file artifact check, and scoped whitespace checks passed. Five mocked-API Chrome checks passed across phone/desktop cover preview/cancel/failure/retry/upload/URL/removal, reload and both profile views, invalid input, independent text edits, and existing avatar modal/save/picker-cancel behavior. Phone modal screenshot reviewed. Added opt-in persistence/recipient-isolation integration coverage; the integration command skipped its disabled database gate. TSX is compiled/browser-tested under the existing ESLint exclusion. Live provider/database persistence, other engines, and physical devices were not exercised.

## Public author Series category — 2026-10-21

Public Author now adds Series after Stories, Shorts, and Collections in Published work. The existing PublishedWritingTabs already supports this optional category, and personal Profile already combines the author's story and short series. Author reuses that pattern with SeriesCard, its existing responsive grid, section-local loading/error/retry/empty states, and independent cursor pagination for both formats. `authorFormat=series` preserves unrelated query/hash state and survives reload and browser history. No writing-sort controls are shown for this category.

Frontend/backend audit: the current profile header, avatar, identity/statistics, follow/request actions, PageFrame, DM Sans, Libre Baskerville, semantic themes, shared Pill tabs, and collection/story/short cards remain unchanged. The existing public `/api/series?authorId=...&type=...` query validates author IDs, scopes to the writer, and excludes private/unlisted series. No route, API, schema, controller, or stored-data change is needed. The existing author-series hook now waits for restored session state and partitions its cache by viewer, preserving viewer-relative card controls. No optional redesign/refactor or approval decision is included.

Changed files: `Frontend/src/features/user/pages/Author/index.jsx`, `Frontend/src/features/discovery/hooks/useShortSeries.js`, new `Frontend/tests/author-series.spec.js`, `Frontend/README.md`, `context/project-overview.md`, `context/ui-rules.md`, `context/ui-registry.md`, this audit, and `context/progress-tracker.md`.

Verification on 2026-10-21: frontend production build, focused Author/hook/spec lint, 92-file artifact check, and scoped whitespace checks passed. Four mocked-API Chrome checks passed across 320/1280 px: both series formats, correct author scoping without mine/saved, no preselection fetch, profile/detail links, category/reload/Back state with unrelated query/hash preservation, pagination, failure/retry/empty handling, retained profile identity, and no horizontal overflow. Existing backend filtering and legacy article/story normalization were inspected; live database persistence, other engines, and physical devices were not exercised.

## Profile controls and reader demand — 2026-10-15

The duplicate Account shortcut and sign-out section was removed from the signed-in Profile, including its phone presentation. The existing mobile Account sheet continues to own account navigation and sign-out. Profile's Edit profile button now uses the shared PenIcon inside a 44 px secondary button with the same accessible name and edit route. The Find reader demand action moved from the Profile header to the existing Writing studio Ideas heading, retaining `/opportunities`. No backend route, API, schema, or stored-data change was needed. Implementation is confined to `Frontend/src/features/user/pages/Profile/index.jsx`; the focused account test and owning documentation were updated. Verification on 2026-10-15: frontend lint and production build passed; four focused mocked-API Chrome checks passed at 320 and 1280 px across account navigation, Ideas content/link, icon-only Edit profile access, and the existing edit flow. Live persistence, physical devices, assistive technology, and other browser engines were not exercised.

## Writing studio Ideas tab — 2026-10-15

After user review, reader-question suggestions moved out of Analytics into a fourth, URL-backed Ideas tab after Drafts. The tab uses compact rows based on the existing writer opportunities presentation: fit reason, linked question, optional context, and reader interest, with a link to the full opportunities page. Analytics remains the default and contains only analytics. This supersedes the three-tab order and placement described in the dated entries below. Existing owner-post, draft, entitlement, question-opportunity, editor, and route APIs remain unchanged. Verification on 2026-10-15: frontend lint, production build, and scoped whitespace checks passed. Two focused mocked-API Chrome account-flow checks passed at 320/1280 px, covering Ideas tab content, URL persistence, existing tab behavior, and account navigation; Ideas screenshots at both widths were reviewed. Live persistence, physical devices, assistive technology, and other browser engines were not exercised.

## Writing studio published status controls — 2026-10-14

The Published tab no longer renders the All/Published/Scheduled/Unpublished status button group. It shows the selected Stories or Shorts category using the existing owner rows/cards and management actions; status labels and actions remain on each item. Existing post reads, routes, filters on other account surfaces, APIs, and stored data remain unchanged.

## Writing studio tab hierarchy — 2026-10-14

The requested Writing studio hierarchy is now Published (Stories/Shorts), Drafts (Stories/Shorts), and Analytics. Published retains its owner post cards and status filter, so scheduled and unpublished records remain manageable. Draft categories filter the existing draft list without changing draft actions. The shared Pill category control is reused with local labels; profile and public Author presentation remain unchanged. Existing owner-post, draft, analytics, and entitlement APIs and data models remain unchanged. Current URL and keyboard behavior belong to UI rules. This supersedes the earlier four-tab Writing studio layout described below.

Implementation: `Frontend/src/features/user/pages/Profile/index.jsx` and `Frontend/src/features/user/components/PublishedWritingTabs.tsx` (shared by Writing studio); verification: `Frontend/tests/account-groups.spec.js`; documentation: Frontend README, project overview, UI rules, UI registry, this audit, and progress tracker. No optional refactor or schema change is included.

Verification on 2026-10-14: two focused mocked-API Chrome account-flow checks passed at 320/1280 px, covering the new hierarchy, categories, URL persistence, draft filtering, status management, analytics, and existing Library navigation. A Writing studio short-card reader engagement check also passed. Frontend lint and production build passed. Tests used installed Chrome and a local Vite server; live persistence and other browser engines were not exercised.

## Published work and Profile editing link — 2026-10-12

Author's section is now Published work with Posts/Shorts/Collections pills. Collections reuses the existing author-scoped public read, collection cards, cursor pagination, and newest/most-saved sorting with separate URL state; loading/failure/retry/empty content stays inside the category panel. Personal Profile's Your published writing adds the same writing-sort Filters and a shared secondary Edit in Writing studio link to `/writing`. Current category/URL/filter rules belong to UI rules. This supersedes earlier Articles/Posts and shorts headings and Profile's unsorted published view.

Audit: existing Collection controller already accepts validated authorId with public visibility and cursor filtering. Frontend only adds authorId forwarding and an enabled, viewer-scoped author collection query. Existing PageFrame, Pill, FilterBar/Select, Button/ButtonLink, ListSkeleton, CollectionCard, writer/short cards, typography, themes, identity/statistics/preferences, follow/support/request behavior, reader controls, routes, APIs, and schemas are preserved. No backend implementation, migration, optional refactor, or approval decision remains.

Changed files: `Frontend/src/features/user/pages/Author/index.jsx`, `Frontend/src/features/user/pages/Profile/index.jsx`, `Frontend/src/features/user/components/PublishedWritingTabs.tsx`, `Frontend/src/features/collection/api/collections.js`, `Frontend/src/features/collection/hooks/useCollections.js`, `Frontend/tests/account-groups.spec.js`, `Frontend/tests/filter-reset.spec.js`, `Frontend/README.md`, `context/ui-rules.md`, `context/ui-registry.md`, `context/project-overview.md`, this audit, and `context/progress-tracker.md`.

Verification on 2026-10-12: 13 focused mocked-API Chromium checks passed across phone Light/desktop Dark collection author scoping (without mine/saved), keyboard categories, cursor Load more, independent sorting/reset/reload/hash retention, collection loading/error/retry/empty states, Profile sorting and Writing studio navigation, and existing post/short reader engagement/save/rollback. Phone Profile/desktop Collections screenshots reviewed. Frontend lint, focused spec lint, production build, artifact validation (73 files without source maps), and scoped whitespace checks passed. Existing backend public/private/unlisted filtering was inspected; no live database visibility or provider run is claimed. TSX remains compiled/browser-tested under the existing lint exclusion. Physical devices, assistive technology, and other browser engines remain unverified.

## Published-writing pill categories — 2026-10-12

The requested separation replaces mixed published-writing grids on personal Profile and public Author with Posts/Shorts pill tabs using shared Pill through PublishedWritingTabs. Posts defaults (including legacy formatless articles); Shorts persists in the existing page URL. Keyboard arrows/Home/End select/focus categories, each linked to its content panel, with category-specific empty messages. Author's existing Filters popover now sorts only and Reset preserves the category. Current behavior and URL details belong to UI rules. This supersedes earlier mixed-profile/author-format-popover behavior.

Audit: reused existing Saved/History pill presentation, PageFrame, card grid, writer/short cards, reader, and public viewer-aware released-writing API. No backend/schema/API changes are required. Existing profile headers/statistics, DM Sans/Libre Baskerville, themes, card structure, navigation, Writing studio management, follow/support/request actions, query caches, and unrelated work are preserved. This is the requested category change without optional refactoring or approval decisions.

Changed files: `Frontend/src/features/user/pages/Profile/index.jsx`, `Frontend/src/features/user/pages/Author/index.jsx`, new `Frontend/src/features/user/components/PublishedWritingTabs.tsx`, `Frontend/tests/account-groups.spec.js`, `Frontend/tests/filter-reset.spec.js`, `Frontend/tests/post-components.spec.js`, `Frontend/README.md`, `context/ui-rules.md`, `context/ui-registry.md`, `context/project-overview.md`, this audit, and `context/progress-tracker.md`.

Verification on 2026-10-12: eight focused mocked-API Chromium checks passed across phone Light/desktop Dark profile/author categories, selection/reload, legacy article format, keyboard/focus, sorting/reset/hash retention, empty/loading/retry recovery, and personal/public short reader appreciation/save/rollback. Phone author and desktop profile screenshots reviewed. Frontend lint, focused spec lint, build, artifact validation (73 files without source maps), and scoped whitespace checks passed. TSX remains compiled/browser-tested under the existing lint exclusion. Live persistence/providers, physical devices, assistive technology, and other engines were not exercised.

## Personal profile published writing — 2026-10-12

The requested additive Posts and shorts section now appears below the existing personal profile content. It reads the current profile handle, then reuses the public writer API and its viewer-scoped useWriter cache. Existing backend publication/release filtering excludes unpublished and future-release writing. Article presentation was extracted unchanged from Author into WriterPostCard; both pages reuse it, and shorts retain existing ShortCard/compact reader behavior. Identity, statistics, request preferences, guest gating, account navigation, Writing studio management, typography, theme, routes, APIs, schemas, and unrelated working-tree changes are preserved. No optional redesign or approval decision remains.

Audit: PageFrame, Avatar, Button, ListSkeleton, public writer article cards, ShortCard, engagement controls, and retry conventions already cover this addition. The existing writer controller provides released article/short summaries and viewer appreciation/save state from current Post/Profile/Like/Save records; no backend implementation or data migration is needed. Loading/error/retry/empty states are section-local so identity remains usable.

Changed files: `Frontend/src/features/user/pages/Profile/index.jsx`, `Frontend/src/features/user/pages/Author/index.jsx`, new `Frontend/src/features/user/components/WriterPostCard.tsx`, `Frontend/tests/account-groups.spec.js`, `Frontend/tests/post-components.spec.js`, `Frontend/README.md`, `context/ui-rules.md`, `context/ui-registry.md`, `context/project-overview.md`, this audit, and `context/progress-tracker.md`. Current UI behavior belongs to UI rules; this section supersedes earlier identity-only profile scope.

Verification on 2026-10-12: six focused mocked-API Chromium checks passed: phone Light/desktop Dark account flows with article links, compact shorts and focus return, no owner-management reads/controls; loading/failure/retry/empty recovery; profile guest prompt; personal/public-writer short appreciation/save/rollback synchronization. Phone and desktop profile screenshots were reviewed. Frontend lint, production build, artifact validation (73 files without source maps), focused spec lint, and scoped whitespace checks passed. Initial browser-cache and sandbox localhost restrictions preceded completed runs. TSX remains compiled/browser-tested under the existing lint exclusion. Live database/provider persistence, physical devices, assistive technology, and other browser engines were not exercised.

## Scope and existing contracts

### Account naming follow-up — 2026-10-12

The user requested conventional destination names without ampersands. Current desktop/mobile account links, profile shortcuts, and page headings now use Profile, Library, and Writing studio. Existing descriptions explain saved/history and post/draft/analytics contents. This supersedes the paired names in the earlier dated entry below. Changed the existing Navbar, MobileProfileSheet, SavedPage, Profile page, corresponding name expectations in the six previously listed specs, Frontend README, UI rules/registry, project overview, and progress tracker. Copy only; routes, filters, layout, typography, colors, APIs, and schemas remain unchanged. Production build and artifact validation passed; source search confirms no paired labels remain in application code. No new browser run was needed for this wording-only correction; no approval decision remains.

### Account labels and library filters — 2026-10-12

The requested follow-up renames account destinations to Profile & followers, Saved & history, and Posts & drafts, removes the redundant library/writing eyebrow, and gives the existing headers concrete descriptions. Saved now uses the shared FilterBar for story format/sorting and collection visibility/sorting; the standalone saved-collection Sort control moves into Filters. History uses the same component for reading status and recency sorting, both embedded and standalone. Current URL/reset/record-bound behavior is owned by [UI rules](ui-rules.md#account-groups).

Audit: existing PageFrame/PageHeader, Explore-reference underline tabs, inner Pill tabs, DM Sans/Libre Baskerville, semantic theme colors, account rows, story/collection cards, reading rows, focus/dismissal, and loading/error/retry are reused. Bookmark reads already return save order and post format/likes; collection reads already accept latest/popular with cursor pages and public/unlisted visibility; history already returns lastReadAt/progress/completed in a bounded recent response. Existing Express controllers/services and Mongoose saves/posts/collections/events remain authoritative. No API/schema/service/dependency changes or optional redesign/refactor are required. Changes are confined to the explicitly requested copy and filter controls; routes, page structure, navigation order, cards, typography, palette, and backward-compatible parameters remain preserved.

Implementation files: `Frontend/src/features/collection/pages/SavedPage.jsx`, `Frontend/src/features/discovery/pages/ReadingHistory.jsx`, `Frontend/src/features/user/pages/Profile/index.jsx`, `Frontend/src/shared/components/layout/Navbar.jsx`, and `Frontend/src/features/user/components/MobileProfileSheet.tsx`. Verification files: `Frontend/tests/account-groups.spec.js` plus account-name expectations in `auth-access-modal.spec.js`, `mobile-navigation.spec.js`, `mobile-profile-sheet.spec.js`, `navbar-search.spec.js`, and `page-alignment.spec.js`. Documentation: Frontend README, project overview, UI rules/registry, this audit, and progress tracker. Existing unrelated working-tree changes are preserved. No approval-dependent decisions remain.

Verification on 2026-10-12: 21 distinct mocked-API Chrome checks passed across the final account/filter/sign-in run and affected navigation/focus checks. Frontend lint, focused spec lint, production build, artifact validation (79 files without source maps), and scoped whitespace checks passed. Phone Library/desktop Writing screenshots were reviewed. Initial sandbox network failures and incorrect test selectors/API fixtures were corrected before passing. Tests follow the shared Sort control updated by concurrent dropdown work. History filtering/sorting covers existing recent records; collection visibility covers loaded pages with Load more retained even when the current page has no matches. Live persistence/providers, physical devices, assistive technology, and other engines were not exercised.

### Reference control correction — 2026-10-12

Library Saved/History and Writing Posts/Drafts/Analytics now reuse the existing Explore underline presentation instead of Pill. Write a post retains link semantics and `/write` with Ask a question's primary Button appearance. Status replaces the native select with existing shared Select. The surrounding PageFrame/PageHeader, DM Sans/Libre Baskerville, theme palette, content/owner controls, saved filters, keyboard tabs, URLs, backend routes/services/schemas, and data flow are preserved. Only the requested controls change; no optional refactor or approval decision remains.

Changed `Frontend/src/features/collection/pages/SavedPage.jsx`, `Frontend/src/features/user/pages/Profile/index.jsx`, `Frontend/tests/account-groups.spec.js`, UI rules/registry, this audit, and the progress tracker. All three focused mocked-API Chrome checks passed at 320 px Light/1280 px Dark, covering underline geometry, primary link appearance/destination, status pointer/keyboard selection, selected checkmark state, Escape/focus return, reload persistence, tab keys, saved-filter retention, analytics, and guest gating. Phone Writing/open Status and desktop Library screenshots were reviewed. Frontend lint/build/artifact validation (79 files without source maps) and scoped whitespace checks passed. Local-server sandbox access failures preceded the completed run; an ambiguous new library-tab selector was corrected. Live persistence, physical devices, assistive technology, and other engines were not exercised.

The requested grouping reuses the existing Profile and Saved routes and adds `/writing`. Before this change, Profile coordinated identity, posts, drafts, bookmarks, reading history, membership, and analytics. Saved already owned saved-story/collection filters, and ReadingHistory owned standalone reading content. Navbar and the mobile Account sheet supplied account entry points.

Existing PageFrame, PageHeader, Pill, Button, Avatar, post/draft rows, metric cards, DeletePostDialog, and reading-history content are reused. DM Sans, Libre Baskerville, semantic Light/Dark tokens, page gutters, card styles, focus handling, and mobile closing animation remain intact. The requested grouping is the only page/navigation restructuring; no optional redesign or architecture migration is included.

Backend inspection confirmed existing authenticated profile, owner-post, draft, bookmark, history, analytics, and entitlement reads. Owner-post DTOs already include publicationStatus/publicAt. Express controllers/services and Mongoose account/profile/post/draft/save/event records remain authoritative. No backend, API, schema, dependency, or stored-data change is required. Current group behavior and URL rules are owned by [UI rules](ui-rules.md#account-groups).

## Changed files

Implementation:

- `Frontend/src/App.jsx`
- `Frontend/src/shared/components/layout/Navbar.jsx`
- `Frontend/src/features/user/components/MobileProfileSheet.tsx`
- `Frontend/src/features/user/pages/Profile/index.jsx`
- New `Frontend/src/features/user/pages/WritingPage.tsx`
- `Frontend/src/features/collection/pages/SavedPage.jsx`
- `Frontend/src/features/discovery/pages/ReadingHistory.jsx`

Verification:

- New `Frontend/tests/account-groups.spec.js`
- `Frontend/tests/navbar-search.spec.js`
- `Frontend/tests/mobile-profile-sheet.spec.js`
- `Frontend/tests/mobile-navigation.spec.js`
- `Frontend/tests/profile-edit.spec.js`
- `Frontend/tests/post-deletion.spec.js`
- `Frontend/tests/page-alignment.spec.js`
- `Frontend/tests/profile-discovery.spec.js`
- `Frontend/tests/auth-access-modal.spec.js`

Documentation: `Frontend/README.md`, `context/project-overview.md`, `context/ui-rules.md`, `context/ui-registry.md`, `context/post-deletion-audit.md`, this audit, and `context/progress-tracker.md`. Existing and concurrent unrelated working-tree changes are preserved. No approval-dependent decisions remain.

## Verification

On 2026-10-12, 43 distinct mocked-API Chrome checks passed across the broad run and focused follow-ups. Coverage includes phone Light/desktop Dark account links, identity without private writing/history reads, post-status filtering/reload, scheduled labels, draft continuation, keyboard tabs, analytics, retained Saved filters across History, single main landmark, old profile-tab forwarding, shared-frame/route inventory, failure/loading recovery, owner deletion, edit Save/Cancel, Account motion/focus/resize, and library sign-in/URL preservation. Phone writing and desktop library screenshots were visually reviewed.

The initial new filter test used an exact implicit-label selector that included select-option text; switching to its accessible combobox name resolved both cases. The old History fixture initially omitted the newly mounted Saved APIs; completing the fixture resolved that check. Initial sandbox localhost restrictions preceded completed runs. Frontend lint, focused spec lint, production build, artifact validation (78 files, no source maps), and whitespace checks passed.

One unrelated mobile-search assertion failed: it expects the first field action to be Close search, while concurrent search work supplies Clear search. This grouping did not change that search implementation or assertion. The full page-width matrix, live persistence/providers, physical devices, assistive technology, and other browser engines were not rerun or verified. Scheduled filtering uses existing future-publicAt semantics and introduces no publication worker.
