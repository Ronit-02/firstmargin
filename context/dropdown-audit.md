# Dropdown reuse and design audit — 2026-10-12

## Search filter dropdown clearance — 2026-10-15

The filter popover now keeps its header and Reset action fixed around a scrollable choices region, while the outer panel allows nested Select lists to extend beyond that region. ViewportPopover exposes an optional overflow setting for this existing use case; other callers retain auto scrolling. This prevents Time and Sort choices in Search filters from being clipped by the panel's scroll boundary without changing filter values, URLs, or API calls. Browser geometry remains unverified in the current sandbox; dated checks are in the progress tracker.

## Author-page filters — 2026-10-12

Added the requested Filters button beside the existing Articles heading, reusing FilterBar, FilterPopover, Pill, and Select. The existing public writer response already supplies released post/short formats, dates, and appreciation counts, so filtering/sorting is presentation-only and needs no backend, schema, or API change. PageFrame, profile header, DM Sans controls, Libre Baskerville headings, semantic themes, card layout, readers, and follow/support/request interactions remain preserved. No optional refactor or approval decision remains. Current URL, sorting, and empty-state rules belong to UI rules.

Changed files: `Frontend/src/features/user/pages/Author/index.jsx`, `Frontend/tests/filter-reset.spec.js`, `Frontend/README.md`, `context/ui-rules.md`, `context/ui-registry.md`, `context/project-overview.md`, this audit, and `context/progress-tracker.md`.

Verification on 2026-10-12: four distinct mocked-API Chromium checks passed: phone Light/desktop Dark format/sort/reset/reload/hash preservation, filtered-empty recovery, and existing public-writer short appreciation/save/rollback. Phone/desktop popover screenshots reviewed. Frontend lint, focused spec lint, production build, artifact validation (73 files without source maps), and scoped whitespace checks passed. The first URL assertions caught a dropped hash; filter navigation was corrected before the final passing run. Live persistence/providers, physical devices, assistive technology, and other engines were not exercised.

## Shared collection/post card action menus — 2026-10-12

The requested extraction adds typed ActionMenu/ActionMenuTrigger/ActionMenuItem in `Frontend/src/shared/components/ui/ActionMenu.tsx` and migrates `CollectionCard.jsx` and `DiscoveryPostCard.jsx`. Collections previously used a bordered text ellipsis and a 208 px text-only panel; both now use the existing post reference (transparent 44 px SVG trigger, 256 px panel, icon-led rows). Shared presentation and enabled-item keyboard/dismissal handling reuse ViewportPopover; commands, disclosure content, permissions, pending state, and modal handoffs remain feature-owned. Other action-menu families remain separate.

Audit: existing AppLayout/PageFrame/card compositions, DM Sans controls, Libre Baskerville titles, semantic Light/Dark colors, and post menu row/radius/shadow conventions are preserved. Collection hooks call existing collection reads/save/delete through authenticated Express controllers and existing Collection/Post/Profile records. Post bookmarks retain existing optimistic cache updates/rollback; share remains browser-only, report keeps its existing modal/API, and hiding stays list-local. Routes, APIs, schemas, data flow, surrounding card spacing/content/navigation, and unrelated working-tree changes remain unchanged. The explicitly requested component extraction contains no optional redesign, migration, or broad refactor; no approval decisions remain.

Verification changes: `Frontend/tests/collection-menu.spec.js` and the current Select semantics in the related report-handoff check in `Frontend/tests/trending-menu.spec.js`; existing discovery-card, collection-layout, share-menu, trending-menu, and button-loading coverage is reused. Documentation changes: this audit, UI rules/registry, and progress tracker. Current menu rules are owned by UI rules; dated verification belongs in the tracker.

## Completed alignment

The approved single-choice migration is complete. All 17 single-choice declarations under `Frontend/src` now reuse the Settings `Select`; no native `<select>` remains. These are declaration counts, not rendered instances. The original audit found 15 native declarations, but concurrent Library work removed its standalone collection Sort and reused FilterBar before this migration. This task replaced the 14 remaining native declarations in 10 consumer files; shared FilterBar also reaches Saved/History without changing those pages.

Select preserves the Settings presentation and adds generated IDs for reusable filters, caller-owned full-width layout, required form validation with trigger focus/error feedback, and safe active-option bounds for dynamic lists. Keyboard events are captured so Escape closes an open dropdown before an ancestor dialog handles it. ViewportPopover portals nested choices into their nearest native/ARIA dialog, keeping option clicks inside the filter panel's outside-dismiss boundary and retaining native modal top-layer access.

Option values/order, defaults/reset, URL keys, descriptions, dynamic choices, existing mutation/pending/error behavior, and access gates are preserved. Staff Window still converts strings to numbers; changing the judging competition still clears winners. Short depth selection continues through the existing multipart publication payload; its pre-existing absence from draft autosave is not changed by this presentation task. Page structure, AppLayout/PageFrame, Libre Baskerville headings, surrounding typography/spacing/cards/navigation, backend routes/services/schemas, APIs, and stored data remain unchanged. Existing unrelated working-tree changes are preserved. No optional redesign, dependency, or approval-dependent decision remains.

## Reference

`Frontend/src/shared/components/ui/Select.tsx` owns the Settings reference; its contract is documented in [UI rules](ui-rules.md#settings-dropdowns). It uses DM Sans, semantic Light/Dark colors, 14 px option/value text, 13 px labels, 44 px trigger/options, an 8 px field radius, selected checkmarks, and an active-option surface. The matching-width popup meets the field with zero gap, prefers below, flips/bounds/scrolls through ViewportPopover, and reveals from the attached edge over 120 ms. The chevron rotates; reduced motion is immediate. Arrows/Home/End/typeahead, Enter/Space, Escape/Tab/outside dismissal, and trigger focus are handled centrally.

The surrounding application retains AppLayout/PageFrame, Libre Baskerville headings, existing cards, and the shared 1120 px frame. Detailed tokens and layout rules remain owned by their existing context files.

## Current single-choice inventory

Paths are relative to `Frontend/src`. Every row uses shared Select.

| Surface/control | Source | Declarations |
|---|---|---:|
| Settings Theme and Language | `features/user/components/ProfileSettings.tsx` | 2 |
| Writing Status | `features/user/pages/Profile/index.jsx` | 1 |
| Shared Sort: Trending, Questions, Collections, Shorts, Saved and History | `shared/components/ui/FilterBar.jsx` | 1 |
| Search Time and Sort | `features/discovery/pages/Search/index.jsx` | 2 |
| Create collection Visibility | `features/collection/pages/index.jsx` | 1 |
| Competition submission Article | `features/discovery/pages/Explore/CompetitionDetail.jsx` | 1 |
| Short Deeper article | `features/editor/pages/index.jsx` | 1 |
| Post/short report Reason | `shared/components/ui/ReportForm.tsx` | 1 |
| Answer/question report Reason | `features/discovery/pages/Explore/QuestionDetail.jsx` | 2 |
| Member Hub creator-update Audience | `features/membership/pages/MemberHub.jsx` | 1 |
| Staff competition Type/Voting mode | `features/staff/pages/StaffConsole.jsx` | 2 |
| Staff judging Competition | `features/staff/components/CompetitionOperations.jsx` | 1 |

The former standalone Saved collection Sort is superseded by its shared Filters control; the owning Library behavior is documented in UI rules.

## Other dropdown-like surfaces

| Family | Source | Reuse and design assessment |
|---|---|---|
| Desktop Account action menu | `shared/components/layout/Navbar.jsx:221` | ViewportPopover with local links/buttons/keyboard handling; 170 px minimum width, 10 px radius, 13 px rows, local shadow; no explicit 44 px row minimum |
| Discovery story options (list/grid/short and reused reading lists) | `features/discovery/components/DiscoveryPostCard.jsx` | Shared ActionMenu/Trigger/Item over ViewportPopover; 256 px width, 12 px radius/text, icon-led rows and central keyboard/dismissal handling |
| Article of the Day options | `features/discovery/pages/Explore/TrendingTab.jsx:71` | Separate ViewportPopover menu; 208 px width, 12 px radius, 12 px text-only rows; 40 px minimum removed on desktop |
| Collection-card options (Collections/Saved/Home) | `features/collection/components/CollectionCard.jsx` | Shared ActionMenu/Trigger/Item matching discovery post cards; feature-owned save/share/delete/hide commands |
| Desktop search autocomplete | `shared/components/layout/Navbar.jsx:194` | ViewportPopover and local combobox behavior; grouped phrases/authors, icons/avatars, 14 px panel radius, 8 px default gap, 44 px rows |
| Mobile search suggestions | `features/discovery/components/MobileSearchDialog.tsx:166` | Feature-local listbox inside the native Search dialog, not an anchored field dropdown; retains its documented mobile composition |
| Editor tag suggestions/custom creation | `features/editor/components/TagPicker.tsx:78` | ViewportPopover and local multi-tag behavior; 13 px text, 10 px radius, 8 px default gap, 8 px panel padding, 44 px choices; no Select reveal/checkmark presentation |
| Editor Add content and slash choices | `features/editor/components/SlashMenu.jsx:87` | One reused editor listbox, local keyboard behavior; 220 px minimum width, 10 px radius, 8 px default gap/padding, local shadow, 44 px icon-led choices |

These surfaces do not reuse Select. Action menus execute commands/navigate; autocomplete accepts input; tags create multiple values; insert choices change editor blocks. Their semantics should remain appropriate to their job. Reuse of ViewportPopover alone is partial infrastructure reuse, not proof of the common visual component.

Desktop Inbox and Filters are structured dialog/popover panels, not single-choice dropdowns. Filter controls inside them are included above. ShareMenu is now a centered modal despite its filename. Mobile Account is a bottom sheet. Publishing options, Sidebar Explore, and mobile Help are disclosures. `HoveringMenu.jsx` is a formatting toolbar with its only page usage commented out; it is not an active dropdown. No datalist-based picker was found.

## Changed files and remaining scope

Implementation: the 10 migrated consumer files above, `shared/components/ui/Select.tsx`, and `shared/components/ui/ViewportPopover.tsx`. Existing Settings/Writing consumers and Saved/History pages require no changes in this task.

Verification: new `Frontend/tests/dropdown-alignment.spec.js`; updated `account-groups.spec.js`, `filter-reset.spec.js`, `search-filter-position.spec.js`, `report-modal.spec.js`, and `modal-audit.spec.js` to select visible options rather than call native select APIs. Existing theme-preference and staff-fraud suites are reused. Documentation: this audit, `context/ui-rules.md`, `context/ui-registry.md`, and `context/progress-tracker.md`.

Action menus/autocomplete/tag/insert controls retain their separate semantics and styles, as agreed in the approved scope. A later action-menu alignment should keep menu/menuitem commands and existing focus/pending behavior. Search accepts input, tags create multiple values, and insert choices modify editor blocks; these require a separate bounded proposal rather than conversion into single-choice Select. Structured Inbox/Filters panels and mobile sheets/disclosures also retain their existing compositions.

No backend change is needed. Existing URL/local state and TanStack Query feed the current APIs; Express routes/controllers/services and Mongoose records remain authoritative for search, collections/eligible posts, competition submissions/judging, reporting, creator updates, staff review, tags, and owner/draft reads. Existing visibility/type/voting/audience values remain compatible.

## Migration verification — 2026-10-12

All 53 distinct mocked-API Chrome checks passed: 43 existing Settings/theme, filter-reset, Search/filter-position, report-modal, account-group, and Staff fraud checks, plus 10 new dropdown-alignment checks at 320 px Light and 1280 px Dark. Four screenshot checks passed again after waiting for the 120 ms reveal animation to settle; phone collection and desktop Staff screenshots were visually reviewed.

Coverage includes reference geometry/checkmarks, pointer and keyboard selection, Escape/Tab and trigger focus, dropdowns remaining inside native report/creation dialogs and ARIA filter panels, immediate filters/reset/URL persistence, report failure/retry/guest gates, required competition validity and article payload, collection visibility, multipart short depth publication/failure retention, creator audience, Staff type/voting payload, judging winner reset, and numeric window reads. Existing reference tests cover short-screen bounds and reduced motion.

Frontend lint, focused spec lint, production build, artifact validation (79 files without source maps), source inventory, and scoped whitespace checks passed. Initial browser attempts were blocked by sandbox localhost access; the completed runs used a task-owned Vite server and installed Chrome outside that restriction. New test fixtures were corrected to use an open submission competition, publication rather than unsupported depth autosave, and Member Hub's existing button semantics. No production domain behavior was changed to satisfy fixtures.

No live database/provider writes, physical devices, assistive technology, or other engines were exercised. Dynamic options use existing data/loading behavior; unbounded production-list performance is not claimed. The earlier audit-only run passed 11 representative reference/menu/tag checks and changed no implementation; its original finding of 15 native controls is superseded by the current inventory.
