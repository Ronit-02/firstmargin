# Modal and overlay audit

## Desktop sign-out choice — 2026-10-18

The signed-in desktop Account menu uses one icon beside the user name to open a native `ModalLayer` choice dialog. It reuses `ModalHeader` and the existing logout actions for this session or all devices. Pending requests disable both choices; dismissal restores focus to the account trigger. The mobile Account sheet and logout endpoints remain unchanged. This adds a sign-out purpose to the historical modal inventory below.

## Dismiss controls — 2026-10-16

Active modals with a header Close icon no longer repeat a dismiss-only Cancel button in the footer. This covers collection and series creation/edit/deletion, question creation, competition entry, publishing, comment editing/deletion, draft/post deletion, and reporting. The header Close icon remains the dismissal control, with existing Escape/backdrop behavior and pending-write guards. Series creation keeps Back because it changes the modal step. Inline comment editor and page-level Edit profile retain Cancel because those controls do not dismiss a modal. Focused tests now target header Close; frontend lint and build passed, while browser interaction remains unverified.

## Ask-question tags — 2026-10-15

The Ask the community modal replaces its comma-separated tag field with the existing publishing TagPicker. It shows public suggestions and selected chips, supports explicit custom creation and removal, and applies the question API's optional five-tag/30-character limits. The modal's question, context, target-writer, submit, and dismissal flows are unchanged. The existing public tag lookup and question create endpoints need no backend or schema change; current behavior is recorded in UI rules and dated verification in the progress tracker.

## Outside-click dismissal consistency — 2026-10-13

All modal implementations with an exposed backdrop now close when the user clicks outside the panel. `ModalLayer` already provides this behavior by default; component-level opt-outs and dirty-form conditions were removed. Native Comments already dismissed this way, and the mobile Account sheet already closes from its backdrop. Full-screen mobile Search has no outside backdrop area. Existing pending-write guards still prevent dismissal during an active mutation, and focus restoration/Escape behavior remain unchanged. Outside dismissal discards local unsubmitted values, consistent with each modal's close behavior.

Changed implementation files: `Frontend/src/shared/components/ui/ModalLayer.tsx`, AddToCollectionDialog, LoginModal, CollectionCard, DeleteDraftButton, Author/index.jsx, DeletePostDialog, CommentActionDialog, ReportModal, and WriteDrafts. Verification updates: `Frontend/tests/add-to-collection.spec.js` and `Frontend/tests/modal-audit.spec.js`. UI rules, this audit, the collection items audit, and the progress tracker were updated. No routes, APIs, schemas, or data flow changed.

## Comment action modals — 2026-10-12

Owner Edit comment and Delete comment now use CommentActionDialog above article, compact Comments, and short-reader surfaces. Both reuse ModalLayer, ModalHeader, Button, and dialog focus, with Close/Escape, viewport-bounded internal scrolling, backdrop retention, pending dismissal/repeat guards, error/retry, and focus restoration. Edit preserves failed text; Delete retains only placeholders that connect to surviving replies. Behavior, exact changed files, and completed verification are owned by [comment actions audit](comment-actions-audit.md). These two purposes extend the dated shared-header inventory below.

## Shared modal/header inventory — 2026-10-10

Title alignment follow-up: ModalHeader now expands its title column and vertically centers subtitle-free headings beside Close. Subtitle-bearing headers retain their existing top alignment. This changes only ModalHeader.tsx, the shared browser assertion helper, UI rules, this audit, and the progress tracker; existing callers, title text alignment, panel padding, Close targets, and backend contracts are preserved. Verification is recorded below in the progress tracker.

Source inspection finds 14 product modal families, excluding dropdowns and non-modal popovers: Ask the community, Create a collection, Create a short series, Submit an article, Delete collection, Short read, mobile Account, mobile Search, Comments, Report, Share, Sign in, mobile Inbox, and Direct writer request. Report is one shared shell with post/short/question/answer subjects; counting those subjects separately gives 17 purpose-specific dialogs. ModalLayer is infrastructure and is not counted. Desktop Inbox and Filters remain non-modal popovers.

Before standardization, headers varied between sans-serif form titles, compact sans-serif report/request/share titles, serif Comments/delete titles, uppercase Short read/Inbox labels, hidden Account/sign-in titles, and the search-field-led mobile Search header. All these headers now reuse ModalHeader.tsx. This inventory supersedes the historical nine-type count for the current working tree, without superseding its dated behavioral evidence.

Completed approved presentation: the Comments reference's 20 px bold Libre Baskerville title, optional 12 px secondary subtitle, divided header, 16 px phone/24 px wider horizontal gutters, 12 px vertical padding, and borderless 44 px Close target. Existing content titles and useful subtitles are retained. Account and Sign in have visible titles; mobile Search has a title row above its existing animated search field and retains one Close control. The desktop Inbox is excluded from the modal count and uses the same approved header as mobile Inbox.

Changed implementation files: new `Frontend/src/shared/components/ui/ModalHeader.tsx`; existing `features/post/components/CommentsModal.tsx`, `shared/components/ui/ReportModal.tsx`, `shared/components/ui/ShareMenu.tsx`, `features/auth/components/LoginModal.tsx`, `features/discovery/pages/Explore/QuestionsTab.jsx`, `features/collection/pages/index.jsx`, `features/discovery/pages/Search/ShortsTab.jsx`, `features/discovery/pages/Explore/CompetitionDetail.jsx`, `features/collection/components/CollectionCard.jsx`, `features/discovery/components/ShortReadModal.jsx`, `features/user/components/MobileProfileSheet.tsx`, `features/discovery/components/MobileSearchDialog.tsx`, `features/notification/pages/NotificationsPage.jsx`, and `features/user/pages/Author/index.jsx` (all under `Frontend/src/`).

Changed verification files under `Frontend/tests/`: new `helpers/modal-header.js`; existing `modal-audit.spec.js`, `report-modal.spec.js`, `share-menu.spec.js`, `notifications-modal.spec.js`, `auth-access-modal.spec.js`, `profile-discovery.spec.js`, and `mobile-search-dialog.spec.js`. Documentation changes: this audit, `ui-rules.md`, `ui-registry.md`, `progress-tracker.md`, and the existing notifications/report/share audits. No temporary edit script remains.

Frontend retains React/Vite, existing feature panels, DM Sans body controls, semantic Light/Dark colors, placement, animation, forms, and native modal focus/dismissal contracts. Existing hooks connect these surfaces to Express controllers/services and Mongoose identity, post/comment, question, collection, series, competition, notification, and creator-request records. Share remains a browser-only action. No backend route, API contract, schema, service, or persistence change is required.

The user explicitly approved the structural before/after impact, including desktop Inbox, on 2026-10-10. No approval decision remains. Dated completed verification is recorded in progress-tracker.md; historical draft-loss and eligible-list recovery limitations remain outside this header change.

Audited: 2026-10-07. Scope: the current working tree, including its native-dialog and viewport-placement changes. This is an audit, not a claim that every modal is fixed. Application code was not changed by this task.

## Inventory and verification boundary

Notifications was converted to a native ModalLayer inbox on 2026-10-09. Its entry points, preserved background route/scroll, read actions, cursor pagination, and focused browser evidence are owned by the [notifications audit](notifications-audit.md). It is an addition to this report's original dated modal inventory. The 2026-10-10 change uses an anchored ViewportPopover on desktop; mobile retains the native modal.

The original 2026-10-07 audit covered nine user-facing modal types. Reporting became a tenth type on 2026-10-08; its separate inventory and verification are owned by the [report-button audit](report-audit.md). `ModalLayer` is a wrapper, not a tenth product dialog. The first six feature forms/reading surfaces below use that wrapper; Account, mobile search, and comments have their own native-dialog implementations. All nine enter the browser's modal top layer.

| Modal | Owning implementation | Entry point | Observed issues |
|---|---|---|---|
| Ask the community | `Frontend/src/features/discovery/pages/Explore/QuestionsTab.jsx` | Questions → Ask a question | Draft loss; light secondary-text contrast; eligible writer/similar-question lookup lacks explicit failure feedback in source |
| Create a collection | `Frontend/src/features/collection/pages/index.jsx` | Collections → Create collection | Draft loss; small Close target; light secondary-text contrast; eligible-list failure feedback |
| Create a short series | `Frontend/src/features/discovery/pages/Search/ShortsTab.jsx` | Shorts → Create a series | Draft loss; small Close target; light secondary-text contrast; eligible-list failure feedback |
| Submit an article | `Frontend/src/features/discovery/pages/Explore/CompetitionDetail.jsx` | Open competition → Add your entry | Draft loss; light secondary-text contrast; eligible-list failure feedback |
| Delete collection? | `Frontend/src/features/collection/components/CollectionCard.jsx` | Owned collection options → Delete collection | Small Cancel delete target; light close-icon contrast |
| Short read | `Frontend/src/features/discovery/components/ShortReadModal.jsx` | Short card / series entry / related short | Comment draft loss; secondary-text contrast; shared comment metadata wrapping |
| Account | `Frontend/src/features/user/components/MobileProfileSheet.tsx` | Mobile Account | Core audited behavior passes; see physical-device limitations |
| Search firstmargin | `Frontend/src/features/discovery/components/MobileSearchDialog.tsx` | Mobile navbar search | Core audited behavior passes; full-screen search intentionally has no outside backdrop target |
| Comments | `Frontend/src/features/post/components/CommentsModal.tsx` | Post comment-count control | Comment draft loss; secondary-text contrast; long comment-author wrapping |

The shared modal implementations were exercised in saved Light/Dark mode at 320×360 and 1280×720. Account and mobile search were exercised at the mobile size only because they intentionally dismiss at the desktop breakpoint. Every type was also exercised with live system Light→Dark→Light changes while open, without a saved override. Guest checks cover Account, mobile search, comments, and short reading; creation/entry actions retain member gating.

Checks cover accessible dialog names, native modality, viewport bounds, horizontal overflow with ordinary content, forward/reverse keyboard focus containment, blocked programmatic background focus, Close/Escape and applicable backdrop dismissal, opener focus restoration, reachable close controls, internal scroll movement, and unchanged application scroll position during internal scrolling. Mutation failures keep entered work and the dialog open. Short-detail and comment-list failures have visible retry controls. Eligible-list failures were inspected after the original request and three automatic retries failed.

Computed text contrast and target dimensions are observational audit results. Passing the audit test means its core assertions completed; it does **not** mean recorded contrast, target, or draft-preservation defects passed acceptance. The contrast scan covers rendered leaf text with opaque ancestor backgrounds; it is not a complete accessibility certification.

## Confirmed findings

### 1. Unsaved work disappears on dismissal

Priority: P2. In Ask, Create collection, Create series, Submit article, Comments, and Short read, entering text, pressing Escape, and reopening produces an empty field. Form state is owned by the unmounted component. Source inspection also shows unguarded backdrop dismissal in these implementations (`ModalLayer` defaults to `dismissOnBackdrop=true`; Comments handles backdrop clicks directly).

This conflicts with the registry requirement to avoid backdrop dismissal when it risks losing work. Failed submissions themselves preserve work; the loss occurs on dismissal. A bounded follow-up should preserve drafts across reopening or guard dismissal only when dirty. Existing clean-state Escape/Close behavior should remain available.

This 2026-10-07 recommendation is superseded by the 2026-10-13 user request for consistent outside-click dismissal. All modal backdrops now dismiss while idle; local unsubmitted values follow the existing Close/Escape behavior and are not persisted across reopening.

Files relevant to a fix: the four form owners in the inventory, `ShortReadModal.jsx`, `CommentsModal.tsx`, shared `CommentsSection.jsx`, and potentially `ModalLayer.tsx` for a narrowly configured dismissal contract. Changing shared dismissal policy needs a concrete before/after review under `AGENTS.md`; the audit did not apply such a change.

### 2. Several secondary text colors miss the 4.5:1 small-text target

Priority: P2. Light muted text (`#8A837C`) measured 3.74:1 on the white modal surface and 3.34:1 on the subtle comment-composer surface. Affected examples include comment dates/counters, short-reading guidance/read time, form character counts, optional-field guidance, competition selection help, and the delete close glyph. The dark comment counter measured 4.37:1 on `#232324`, also below 4.5:1. Primary text and the audited Account/search content did not produce these failures.

A follow-up can reuse the existing secondary-text token in the affected essential labels rather than alter the global palette. Files relevant to a fix: `CommentsSection.jsx`, `ShortReadModal.jsx`, the four form owners, and `CollectionCard.jsx`. Broader token changes would affect unrelated pages and require separate review.

### 3. Collection, series, and delete close controls are too small

Priority: P2. Create collection and Create series Close buttons measured approximately 9.34×28.5 CSS px. Delete's Cancel delete control measured approximately 28.86×22 px. These fall below the repository's 40 px minimum for icon-only controls and 44 px preferred target. Ask, Submit article, and Short read use 40×40 close controls; Comments, Account, and mobile search use 44×44.

An earlier audit found desktop form Cancel buttons and delete actions measuring 37.5 px. Dismissing Cancel buttons were removed from modal footers on 2026-10-16; remaining action targets follow their existing Button styles.

### 4. Failed eligible-story reads provide no recovery control

Priority: P2. Create collection, Create series, and Submit article show zero error alerts and zero Retry/Try again buttons when their eligible-list request fails with an ordinary 500, even after query retries. The result looks like an empty picker. Source inspection also shows no loading status for these lists. A failed eligibility read is not evidence that there are no eligible stories.

Files relevant to a fix: collection `pages/index.jsx`, Search `ShortsTab.jsx`, Explore `CompetitionDetail.jsx`. Reuse the existing query state and Button/error conventions; backend contracts and schemas need no change.

### 5. Long comment-author names overflow compact rows

Priority: P2. The shared compact comment header places the author and date in one flex row without a wrapping/minimum-width rule on the name. A valid 30-character username caused all 20 fixture comment rows to overflow at 320 px; the browser measurement and screenshot confirmed clipped names/dates. This also affects the comments embedded in short reading.

File relevant to a fix: `Frontend/src/features/post/pages/CommentsSection.jsx`. Preserve the avatar/name/date design, but allow the name/date to wrap within the available column.

## Related overlays and excluded surfaces

The 2026-10-09 authentication change adds `LoginModal` for protected routes, gated actions, and expired sessions. It reuses Login/ModalLayer and retains direct login/signup pages. Its current behavior is owned by the Sign-in access guards section in UI rules; verification is separate from the historical nine-type audit above.

| Surface | Classification | Existing coverage used in this audit |
|---|---|---|
| Filters | Non-modal `role=dialog` popover; page remains interactive | Shared filter reset, focus return, outside dismissal, pinned position, short-height scrolling |
| Discovery story and Article of the Day options | Menus, including inline recommendation sections; discovery Report now opens a separate modal | Keyboard actions/focus return, portal placement, resize/scroll bounds |
| Collection options | Menu leading to the separate delete modal | Arrow-key navigation, focus return, card-clipping avoidance |
| Desktop Account | Menu | Keyboard navigation, Escape/Tab handling, opener focus |
| Desktop search suggestions | Combobox/listbox | Keyboard suggestion selection and existing navbar behavior |
| Article share | Menu | Initial item focus, keyboard navigation, Escape/focus restoration |
| Editor insert choices | Listbox, not a modal | Keyboard insertion and bottom-edge viewport positioning |

Summary/audio tools, collection editing, member studio forms, and authentication/verification are inline/page surfaces. Article, discovery-card, question, and answer reporting now use the separate report modal (2026-10-08). Toasts are live feedback, and Loader components are route/loading surfaces. None should be represented as audited product modals. Search in the current source found no application `window.alert`, `window.confirm`, or `window.prompt` dialogs.

## Architecture and change scope

The frontend retains React/Vite, Router routes, Redux session restoration, TanStack Query reads/mutations, feature-local form state, DM Sans/Libre Baskerville, semantic CSS colors, existing rounded panels, and existing motion/focus hooks. `ModalLayer`, `useOverlayViewport`, and `ViewportPopover` own the current top-layer/viewport behavior.

The API remains Express with authenticated/optional-auth routes, controllers/services, and Mongoose schemas for posts/comments, questions, collections, short series, competitions, identity, and sessions. These overlays call existing eligible-list, creation, engagement, search, and session hooks. No API, model, migration, or persistence change is required for the confirmed UI findings. Mocked HTTP responses isolate UI verification; no live data was mutated.

Audit-owned changes: new `Frontend/tests/modal-audit.spec.js`, this report, the registry's audit pointer, and progress records. Existing implementation, routes, typography, colors, layouts, navigation, and unrelated working-tree changes are preserved. Optional shared-component migration/redesign was not performed.

## Verification and remaining limits

On 2026-10-07, 58 distinct new mocked-API audit checks and 71 existing related browser checks completed successfully in Chromium/Chrome (129 distinct checks, zero unexpected failures). The final 32-case theme/layout matrix and valid-username check were rerun for screenshots and confirmation. Phone/desktop Light/Dark screenshots were visually reviewed. These totals describe completed behavioral assertions and observations, not resolution of the five findings.

Frontend `npm run lint`, `npm run build`, `npm run security:artifacts` (74 files, no source maps), focused lint/syntax checks for the new spec, and whitespace validation passed. The spec is `Frontend/tests/modal-audit.spec.js`; the existing suites cover article reading, collection menus, discovery cards, editor overlays, filter reset, Account sheets, mobile search, navbar search, overlay placement, and question submission. Use the existing `npm run test:e2e -- tests/modal-audit.spec.js` command with the repository's normal browser/server prerequisites. Local launch/runtime details and ignored evidence locations are recorded in the progress companion.

Remaining verification: physical phone keyboard/safe-area behavior, real 200% browser zoom, Firefox/WebKit, screen-reader announcements, and live authenticated persistence/provider flows. The short phone viewport exercises tight layout and scrolling, but does not substitute for those checks. Automatic contrast scanning and screenshots also do not prove all dynamic loading/pending/localization combinations.
