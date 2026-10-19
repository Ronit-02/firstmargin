# Picked stories in collections — 2026-10-12

## Story and short counts on collection cards — 2026-10-18

Collection list and detail responses now include `storiesCount` and `shortsCount`, derived from visible, populated posts. The existing `postsCount` remains the combined total for compatibility. List queries select post `format` to compute the split; missing legacy format is treated as a story. The shared CollectionCard names each format present in its footer, such as “2 stories · 1 short,” while retaining the existing combined-count fallback for older response data. Routes, stored models, grid layout, and collection actions are unchanged. Frontend build and targeted frontend/backend lint passed on 2026-10-18. Integration and browser checks require the local MongoDB-backed API, which was unavailable in this session.

## Responsive shared collection card — 2026-10-18

The user selected a photo-left editorial card layout. The existing shared CollectionCard now uses that composition when its own inner width reaches 360 px and stacks a 2:1 cover above the content on narrower tracks. It retains the app's Libre Baskerville title, DM Sans metadata and description, theme tokens, card-wide title link, 44 px action menu, ImageBox fallback, and existing collection actions. The footer now uses the existing Avatar component for the curator picture or initials. The surrounding collection grid, routes, APIs, and stored data are unchanged. Frontend build and focused ESLint passed on 2026-10-18; the focused browser suite could not start because the local API could not connect to MongoDB.

## Collection card menu placement — 2026-10-17

The shared CollectionCard moves its existing three-dot action trigger into a title row. The cover sits below that row on narrow cards and beside the description from 640 px; it is never covered by the trigger. Existing card link, menu commands, focus return, image fallback, footer, and API data flow remain unchanged. The layout spec now checks cover and trigger geometry at seven widths. Focused mocked-API Chrome verification passed 11 of 12 cases initially; the remaining 320 px case had an outdated fixed-height assertion, corrected to check the intended 2:1 cover ratio. Both 320 px checks then passed. Targeted lint and production build passed; 325 px and 1280 px screenshots were reviewed. Live persistence and other browser engines were not exercised.

## Existing collection membership in Save dialog — 2026-10-14

The shared Save story dialog now requests the optional current `postId` when loading the signed-in user's owned collections. Collection choices return `containsPost`, and the existing visibility badge is extended with “Already added” when the story or short already belongs to that collection. Articles and shorts use the same behavior. The existing duplicate-safe backend append, creation flow, modal structure, Select presentation, routes, schemas, and stored data remain unchanged.

The Add to a collection checkbox remains enabled for these posts. Once an already-containing collection is selected, the final action is disabled and reads “Already in collection,” preventing a redundant submission while leaving other collections available.

Changed `Backend/controllers/collection.controller.js`, `Frontend/src/features/collection/api/collections.js`, `Frontend/src/features/collection/hooks/useCollections.js`, `Frontend/src/features/collection/components/AddToCollectionDialog.tsx`, and `Frontend/tests/add-to-collection.spec.js`. No optional redesign or approval-dependent change was included.

Verification on 2026-10-14: frontend lint and production build passed; the focused Playwright spec was blocked before test execution because its configured backend could not connect to MongoDB in the local environment.

## Save entry point — 2026-10-13

The current story entry point is Save. Discovery post/short previews, article detail, and short readers open the shared dialog, with Save in your Library selected by default and Add to a collection optionally selected alone or together. The collection picker, creation form, validation, visibility badges, pagination, retry, owner scope, and duplicate-safe append remain the same. The dialog uses the existing bookmark mutation for Library state. Direct Add to collection controls were removed from these story surfaces. Collection detail now exposes direct Add to collection for owners beside Save order, using the existing eligible published-story read and append mutation. Library has Saved, History, and Collections top tabs, with owned and saved collections listed separately. No backend route, schema, migration, or stored-data change was needed. The older entry-point description below records the superseded 2026-10-12 flow.

Implementation touched `AddToCollectionDialog.tsx`, `useCollections.js`, `SavedPage.jsx`, `CollectionDetail.jsx`, `PostCardMenu.jsx`, `ShortReadModal.jsx`, and the article `pages/index.jsx`. Affected browser specs are `add-to-collection.spec.js`, `account-groups.spec.js`, `collection-detail.spec.js`, `post-components.spec.js`, `post-detail-layout.spec.js`, `trending-menu.spec.js`, `button-loading.spec.js`, and `critical-flow.spec.js`. Frontend README, project overview, UI rules/registry, this audit, and the progress tracker own the documentation changes.

Verification: on 2026-10-13, nine focused mocked-API Chrome Save/collection checks, a pending-bookmark guard check, ten account/Library checks, and all nine collection-detail checks passed, as did frontend lint and production build. Four Library checks passed again after viewer-scoped collection queries. A wider reader/menu run initially passed 44 of 49 cases; all five failures passed in focused reruns after correcting outdated category/owner-menu fixtures and an ambiguous dialog button selector. Live persistence and other browser engines were not exercised.

## Audit and scope

Collections already creates ordered reading sets from an authenticated user's own posts. The collection controller validates creation/update input and stores existing ordered item references, with a legacy posts-array fallback. It does not restrict referenced posts to the curator's authorship. Collection detail presents available posts, supports owner ordering, and omits missing/unreleased content. Collection listing supports owner-only private/public/unlisted lists and cursor pagination.

Shared DiscoveryPostCard serves list/grid/short discovery, search, saved, and reused reading lists. Articles and ShortReadModal provide engagement actions; Writing studio provides owner post actions. These surfaces lacked an action to put the current story in a collection. Existing AppLayout/PageFrame, DM Sans controls, Libre Baskerville headings, theme tokens, shared ActionMenu, Button, ModalHeader, ModalLayer, Select, and dialog focus are reused. TanStack Query owns reads/mutations through the existing API client. Express authentication, controllers/services, Mongoose Collection/Post records, and existing creation contracts remain authoritative.

The requested change adds an action and feature-owned dialog; it preserves pages, card composition, typography, colors, navigation, routes/contracts, saved-story behavior, collection schemas, and existing own-post creation. No optional redesign, file move, architecture migration, dependency, or schema replacement is included. No approval decisions remain.

## Completed behavior

Add to collection appears in shared post/short card menus, article actions, and the short-reader footer. Guests open existing sign-in without reading private collections. Authenticated users choose an owned collection from a dropdown whose options show the collection title and Public, Unlisted, or Private visibility, or create a new collection in place with the selected story as its first item. Successful creation from this picker confirms that the story was added to the new collection. New creation uses the existing title/description/visibility fields and API, allowing both articles and shorts by other writers as well as the user's own work. This dropdown follow-up is dated 2026-10-13 and verified in the focused browser suite.

The picker uses the shared accessible Select dropdown. Each option shows the collection title and its Public, Unlisted, or Private visibility as a compact pill tag; the selected value keeps the same presentation. It paginates owned collections, separates loading/empty/error states, and provides retry. Its cache is partitioned by restored signed-in user. Failed addition retains the selection and picker; failed creation retains all fields. Pending writes block dismissal and repeated activation. Outside click, Close, and Escape dismiss idle work. Local unsubmitted collection fields are discarded after dismissal. Shared native modal behavior contains focus, bounds internal scrolling, restores the opener, and preserves an underlying short reader.

The additive authenticated append operation accepts only publicly released, available posts/shorts and only mutates the caller's collection. A conditional single-document update prevents duplicate entries and concurrent append overwrites, respects the existing 100-story limit, and appends after existing positions. Repeated additions succeed with already-present feedback. Legacy posts arrays convert to existing ordered items only when that collection receives an append. Existing creation, reordering, schemas, stored records, and read filtering are preserved.

## Changed files

Backend:
- New `Backend/controllers/collection-items.controller.js`
- New `Backend/services/collection-items.service.js`
- `Backend/routes/v1.routes.js`
- `Backend/tests/foundation-contracts.test.js`
- `Backend/tests/integration.test.js`

Frontend:
- New `Frontend/src/features/collection/components/AddToCollectionDialog.tsx`
- New `Frontend/src/features/collection/components/AddToCollectionButton.tsx`
- New `Frontend/src/features/collection/index.ts` (public action/dialog exports)
- `Frontend/src/features/collection/api/collections.js`
- `Frontend/src/features/collection/hooks/useCollections.js`
- `Frontend/src/features/discovery/components/PostCardMenu.jsx`
- `Frontend/src/features/discovery/components/ShortCard.jsx`
- `Frontend/src/features/discovery/components/ShortReadModal.jsx`
- `Frontend/src/features/post/pages/index.jsx`
- New `Frontend/tests/add-to-collection.spec.js`

ShortReadModal concurrently gained short navigation. Verification exposed a missing `onNavigateAway` parameter in its inner reader; this task passed through that already-supplied prop to restore rendering. Other concurrent short/navigation/button changes are preserved and remain outside this feature's scope.

Documentation: this audit, UI rules/registry, architecture, project overview, frontend README, progress tracker, and the ignored local architecture companion. Dated final verification is recorded in the progress tracker.
