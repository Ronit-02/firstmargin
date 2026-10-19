# firstmargin UI registry

Staff console's outer tab row follows the Studio/Library underline button pattern; its three content toolbars reuse `SectionHeading` opposite the right-aligned `FilterBar`. Staff dialogs reuse `ModalLayer` and `ModalHeader` for report review, competition creation, and judging. Staff lists reuse `Button`; Moderation, Competitions, and Users use the shared right-aligned `FilterBar`/`FilterPopover` with `Pill` choices; the Users list also reuses `Avatar`, `ActionMenu`, and `ActionMenuTrigger`. Domain forms remain feature-owned.

Last reviewed: 2026-10-10

## Purpose

The UI registry is the source of truth for reusable components and patterns. It prevents duplicate card, button, modal, author, and loading implementations from drifting across features.

This file records component responsibility and maturity. It does not replace component examples or tests.

The [dropdown audit](dropdown-audit.md) records the completed Settings-reference migration of every single-choice dropdown and the separate action-menu/autocomplete inventory. Shared viewport placement alone does not establish common styling for those other semantics.

The [modal audit](modal-audit.md) inventories the current 14 modal families, the approved shared header, related overlays, and dated behavioral evidence. It also retains historical findings; the header update fixes the listed close-target sizes but does not claim to resolve unrelated draft-loss, contrast, or eligible-list recovery findings. Comment presentation has its own current audit. Candidate dialog status does not imply full acceptance.

## Component layers

### Primitives

Low-level, product-agnostic controls with accessibility behavior built in.

Examples: Button, IconButton, TextField, TextArea, Select, Checkbox, Avatar, Badge, Divider, Skeleton, VisuallyHidden.

`DisabledButtonTooltip` is mounted once at the application root. It gives disabled shared and native buttons hover feedback using `data-disabled-reason`, busy/form/boundary context, or a general unmet-requirements explanation. It also supplies browser-native hover titles to enabled buttons and navigation links from their accessible label or visible text, preserving explicit titles. It does not change control state or visual style.

### Patterns

Reusable product compositions with domain-light contracts.

Examples: WriterIdentity, ArticleCard, QuestionCard, EmptyState, ErrorState, FilterBar, MetricCard, ConfirmDialog.

### Feature components

Components with domain behavior or feature-specific data requirements.

Examples: CompetitionEntryForm, QuestionComposer, DraftPublishPanel, RecommendationReason.

### Layouts

Route-level structure and navigation shells.

Examples: AppShell, ReadingLayout, EditorLayout, SettingsLayout.

A feature component may use patterns and primitives. A primitive must never import a feature.

## Registry status

- **Stable:** reusable contract, documented states, tests, and accessibility review.
- **Candidate:** used or potentially useful, but requires contract/state cleanup.
- **Feature-only:** intentionally not shared.
- **Deprecated:** no new use; migration target identified.
- **Missing:** required by the build plan but not created.

## Current inventory

| Component/pattern | Current location | Status | Required action |
|---|---|---:|---|
| `AddToCollectionDialog` | `Frontend/src/features/collection/components/`, public export from feature `index.ts` | Feature-only | Shared Save dialog for story previews and article/short reading. Library is selected by default; collection may be selected alone or with Library. Owner choices use shared Select with collection names/visibility badges, viewer-partitioned cursor cache, scroll pagination inside the option list, loading/empty/retry, and create-with-story form. Pending guards, retained failures, native focus/viewport behavior, and reader preservation reuse existing primitives and collection/bookmark hooks. The legacy `AddToCollectionButton` export is currently unmounted. |
| `AddToSeriesDialog` | `Frontend/src/features/discovery/components/AddToSeriesDialog.tsx` | Feature-only | Owner-only, format-aware picker shared by article/short list menus, Studio management menus, and both detailed readers. Reuses Select, ModalLayer, ModalHeader, Button, scroll-triggered cursor pagination within the options list, and focus restoration; covers loading/error/empty/full/already-assigned/pending states and appends through the existing series domain. Its empty state separates Browse series navigation from the shared creation modal. |
| `SeriesWritingPicker` | `Frontend/src/features/discovery/components/SeriesWritingPicker.tsx` | Feature-only | Create-series multi-select for eligible posts or shorts. Reuses ViewportPopover and established dropdown styling, offers individual selection plus Select all/Clear all without checkbox inputs, and displays removable selections in saved reading order. |
| `SeriesCard` | `Frontend/src/features/discovery/components/SeriesCard.jsx` | Feature-only | Reused on Series and owned Library. Combines a column-filling cover or shared ImageBox fallback, prominent serif title, separate author and description rows, and up to three ordered chapter titles. Container-width layout stacks or splits the identity and chapter preview inside the existing 420 px grid tracks. The title links to detail and the shared action menu remains separate. |
| `ActionMenu` / `ActionMenuTrigger` / `ActionMenuItem` | `Frontend/src/shared/components/ui/ActionMenu.tsx` | Candidate | Shared post-reference presentation for collection and discovery list/grid/short card menus: 44 px SVG trigger, viewport-bounded 256 px icon-led menu, semantic danger rows, enabled-item keyboard navigation, dismissal/focus return, and caller-owned actions/pending state. Reuses ViewportPopover; no feature data fetching. |
| `ModalHeader` | `Frontend/src/shared/components/ui/ModalHeader.tsx` | Candidate | Shared Comments-reference header for all 14 modal families and desktop Inbox: serif 20 px title, optional 12 px subtitle, divider, responsive gutters, borderless 44 px Close with caller-owned label/ref/action. Existing shells, focus, motion, and data contracts remain with callers. |
| `Button` | `Frontend/src/shared/components/ui/Button.jsx` | Candidate | Primary/secondary pills plus borderless action, full-width menu, and flat full-width disclosure variants, with leading/trailing icon slots. Disclosure supplies a borderless 44 px target, wrapping label, and an aria-expanded-driven chevron with reduced-motion support; callers own visibility/state. Icon-led pending states mute/fill only the icon; text-only actions retain their existing fill. aria-busy and explicit mutations/returned promises prevent repeats. Labels, geometry, and focus stay stable. Source inventory: [button loading audit](button-loading-audit.md). Named sm/md (44 px) and lg (48 px) sizes, forwarded refs, and shared buttonStyles are implemented; ButtonLink and IconButton consume the same styles. Candidate maturity and broader typed Button props remain. |
| `InfiniteScrollSentinel` | `Frontend/src/shared/components/ui/InfiniteScrollSentinel.tsx` | Shared | Observes the nearest scroll pane for cursor feeds across pages, modal bodies, comment threads, inbox, and open Select option lists. It prevents overlapping requests, stops automatic attempts after a next-page failure, and exposes a retry action and loading status. |
| `buttonStyles` / `ButtonLink` / `IconButton` | `Frontend/src/shared/components/ui/buttonStyles.ts`, `ButtonLink.tsx`, `IconButton.tsx` | Candidate | Typed named appearance/sizing API, semantic router/external CTA links, and labelled icon-only actions sharing Button styles; sm/md 44 px and lg 48 px. ButtonLink retains native navigation, IconButton reuses Button pending/disabled/ref behavior. Duplicate mapping: [button styles](button-style-duplicates.md). |
| `retainRetryView` | `Frontend/src/shared/utils/retainRetryView.js` | Utility | Keeps an existing query recovery view mounted during no-data refetch so its Retry button can show the shared pending fill. Preserves first-load skeletons, query data/cache, and request behavior. |
| `ViewportPopover` | `Frontend/src/shared/components/ui/ViewportPopover.tsx` | Candidate | Typed portal placement shared by card/featured/collection/share/account menus, search suggestions, filters, and editor insert choices; respects navigation and visual viewport, follows scrolling, flips and bounds height, observes content size, and supports pinned mobile filters. An optional visible-overflow mode lets FilterPopover scroll only its choices while nested Select lists extend beyond that region. Portals inside the nearest native/ARIA dialog when its trigger is there, keeping nested dropdown choices inside modal/filter dismissal boundaries; otherwise uses the existing body layer. Callers own semantics, focus, and actions. |
| `ReportForm` | `Frontend/src/shared/components/ui/ReportForm.tsx` | Candidate | Shared post-detail form for post and short reporting from detail/card entry points; reason, optional details, Cancel, pending/error/retry, and received confirmation. Reuses existing mutation hooks and API payloads. |
| `ReportModal` | `Frontend/src/shared/components/ui/ReportModal.tsx` | Candidate | Shared typed modal shell with Report this subject naming around post/card/question/answer forms; reuses ModalLayer and useDialogFocus for top-layer blocking, viewport bounds, scrolling, Close/Escape, and opener focus restoration. Backdrop does not dismiss. Inventory: [report audit](report-audit.md). |
| `ModalLayer` | `Frontend/src/shared/components/ui/ModalLayer.tsx` | Candidate | Typed native modal portal for existing form/confirmation/short-read panels; viewport bounds, background blocking, configurable backdrop dismissal, and opener-focus restoration. Feature content and existing focus hooks are preserved. |
| `NotificationsPage` | `Frontend/src/features/notification/pages/NotificationsPage.jsx` | Feature-only | Route-backed inbox aligned beneath the navbar notification button: desktop uses ViewportPopover, while mobile retains ModalLayer/useDialogFocus with a native modal panel positioned 8 px below and right-aligned to its trigger. Preserves the background route/scroll, desktop navbar and signed-in mobile navbar entry beside search, confirmed read and per-row delete actions/unread badge refresh, loading/error/empty states, and cursor scroll pagination. Direct `/notifications` opens over Home. Inventory: [notifications audit](notifications-audit.md). Existing filename retained. |
| `WritingPage` / `MemberProfile` | `Frontend/src/features/user/pages/WritingPage.tsx`, `pages/Profile/index.jsx` | Feature-only | Studio composes existing management panels with URL-backed Analytics/Published/Drafts/Ideas/Updates/Workshops/Requests tabs. Analytics defaults and shows basic released-post totals; detailed performance uses the existing membership entitlement and a shared-style upgrade modal. Ideas reuses the ranked writer opportunities read in compact question rows and owns the Find reader demand link to the full feed. Profile uses a 44 px labeled icon-only Edit profile button and omits its duplicate phone Account button section. Stories/Shorts categories remain in Published and Drafts (legacy posts/shorts URLs remain readable). Shorts use WritingStudioShortCard in the shared responsive short grid with WritingPostMenu replacing discovery actions. Story rows retain detail links, like/comment counts, and WritingPostMenu. Owner menus provide Edit, Unpublish/Republish, and Delete. Existing API/query/mutation contracts are reused. |
| `CreatorTools` | `Frontend/src/features/membership/components/CreatorTools.jsx` | Feature-only | Studio Updates and Workshops show owner lists and creation modals; Requests shows received requests and response actions. Existing form validation and mutation feedback remain. |
| `AuthorPage` filters | `Frontend/src/features/user/pages/Author/index.jsx` | Feature-only | Published work reuses sorting-only FilterBar/FilterPopover/Select beside Posts/Shorts/Collections PublishedWritingTabs. Writing uses Newest/Oldest/Most appreciated; public author collections reuse CollectionCard, cursor scroll pagination/retry, and separate Newest/Most saved sorting. Reset preserves category/query/hash and other-category sort. |
| `PublishedWritingTabs` | `Frontend/src/features/user/components/PublishedWritingTabs.tsx` | Feature-only | Personal/public profile Posts/Shorts and opt-in Author Collections categories using shared Pill, aria-selected/tabpanels, roving focus and arrow/Home/End selection. Posts defaults; category persists through URL/reload, with separate empty messages. |
| `DiscoveryPostCard` on writer profiles | `Frontend/src/features/discovery/components/DiscoveryPostCard.jsx` | Shared | Author and personal Profile use its grid variant for public articles; shorts dispatch to ShortCard. Member early access articles use the same grid with a Member early access badge. Viewer-aware public writer API excludes unpublished and scheduled writing. |
| `SavedPage` / `ReadingHistoryPage` | `Frontend/src/features/collection/pages/SavedPage.jsx`, `discovery/pages/ReadingHistory.jsx` | Feature-only | Library combines Saved, Collections, Series, and History top tabs in that order. Saved has Stories/Shorts Pill categories, format-specific bookmarks, and legacy savedFormat links. Collections uses My/Saved Pill tabs to show one set at a time with visibility/sort Filters, cursor scroll pagination, a rightmost Filters control, and a compact + Add button for the shared creation modal. URL/reset state preserves other tabs; legacy savedSection=collections opens the Collections tab. History reuses Pill for URL-backed Stories/Shorts, filtering continuation and recent records while retaining reading-status/sort controls and standalone /history. |
| `EditProfilePage` | `Frontend/src/features/user/pages/Profile/EditProfilePage.tsx` | Feature-only | Guarded `/profile/edit` page reusing existing fields/API, shared PageFrame/Back, retained failed-save drafts, pending protection, and a single Save return to Profile with its query. Writer member requests and profile picture selection are staged here; Profile shows their saved values. The shared Avatar previews the selected image. |
| `DeletePostDialog` | `Frontend/src/features/user/components/DeletePostDialog.tsx` | Feature-only | Studio Posts owner confirmation reusing Button, ModalHeader, ModalLayer, and dialog focus; explicit destructive confirmation, pending dismissal/repeat protection, inline failure/retry, and confirmed cache refresh. Behavior/evidence: [post deletion audit](post-deletion-audit.md). |
| `LoginModal` / `LoginPromptProvider` | `Frontend/src/features/auth/components/LoginModal.tsx`, `hooks/useLoginPrompt.tsx` | Feature-only | Reuses Login and ModalLayer for explicitly activated route prompts, gated actions, and session-expiry sign-in gates; preserves the full return URL and existing auth APIs. Dismissal and success close the modal in place. Contract: ui-rules.md, Sign-in access guards. |
| `useOverlayViewport` | `Frontend/src/shared/hooks/useOverlayViewport.ts` | Candidate | Visual-viewport size/offset styles shared by ModalLayer and existing Comments, mobile Search, and Account native dialogs; reacts to resize and visual viewport scroll. |
| `BackButton` | `Frontend/src/shared/components/ui/BackButton.tsx` | Candidate | Shared typed borderless arrow/label control with 44 px targets, subtle hover, one keyboard focus ring, history/parent fallback, and optional previous-step callback; AppLayout aligns detail/drill-down and writer-opportunity Back rows to the shared page frame with clear content separation; the opaque row stays sticky beneath the navbar inside the application scroll container. Authentication omits Back; onboarding retains its previous-step position. Contract: ui-rules.md; inventory/findings: [Back-button audit](back-button-audit.md). |
| `Avatar` | `Frontend/src/shared/components/ui/Avatar.jsx` | Candidate | Uses a name-derived abstract fallback without visible text, retaining sizes, loading behavior, and an accessible name. |
| `Pill` | `Frontend/src/shared/components/ui/Pill.jsx` | Candidate | Shared capsule selector with centered dynamic labels, active/inactive theme states, and 44px targets at every breakpoint; used by tabs and FilterBar topic/type choices. Preserves pressed/tab semantics; split static metadata into a separate contract before promotion |
| `Tag` | `Frontend/src/shared/components/ui/Tag.jsx` | Candidate | Clarify link, filter, and static variants |
| `Divider` | `Frontend/src/shared/components/ui/Divider.jsx` | Candidate | Ensure semantic/decorative behavior |
| `ImageBox` | `Frontend/src/shared/components/ui/ImageBox.jsx` | Candidate | Supports an optional aspect ratio alongside explicit height and distinct abstract fallback variants for missing or failed images; fallback names are accessible but not visible. Active post cards use the ratio for fluid covers. Promote after state and accessibility coverage mature |
| `SectionHeading` | `Frontend/src/shared/components/ui/SectionHeading.jsx` | Candidate | Support heading level and optional action without fixed styling assumptions |
| `AuthorMeta` | `Frontend/src/shared/components/ui/AuthorMeta.jsx` | Candidate | Compact card metadata plus an opt-in article variant with a 40 px avatar, emphasized writer name, and aligned plain-text date/read-time outside the avatar/name profile links. Future durable-link/normalized-DTO work remains separate. |
| `ArticleCard` | `Frontend/src/features/post/components/ArticleCard.jsx` | Candidate | Define one content contract and semantic stretched link |
| `FeaturedCard` | `Frontend/src/features/post/components/FeaturedCard.jsx` | Candidate | Confirm distinct editorial need; avoid duplicate card logic |
| `CompactCard` | `Frontend/src/features/post/components/CompactCard.jsx` | Candidate | Normalize interaction and metadata with ArticleCard |
| `HorizontalCard` | `Frontend/src/features/post/components/HorizontalCard.jsx` | Candidate | Normalize responsive media, writer link, actions, and state |
| `FeaturedPostCard` | `Frontend/src/features/discovery/components/FeaturedPostCard.tsx` | Feature-only | Shared Article of the Day and recent article winner cover/content composition; stacked 16:9 cover below 960 px and text-row-filling side cover from 960 px. Configurable label and separate reader-vote line for winners. Uses AuthorMeta, PostEngagementControls and PostCardMenu; Trending retains feed selection. |
| `QuestionResponseCard` | `Frontend/src/features/discovery/components/QuestionResponseCard.jsx` | Feature-only | Question detail article response with author/date/read time, serif title, optional excerpt, and Read response link; shorts retain ShortCard. |
| `QuestionResponseModal` | `Frontend/src/features/question/components/QuestionResponseModal.jsx` | Feature-only | Shared question feed/detail Add response choice: attach an eligible published owner post through the existing response-link endpoint, or write a new post through the existing question editor URL. Modal uses shared focus and header controls and retains loading, empty, retry, and mutation failure states. |
| `CompetitionEntryCard` | `Frontend/src/features/discovery/components/CompetitionEntryCard.jsx` | Feature-only | Competition detail article/short entry with a fluid 16:9 article cover, centered compact short presentation, winner/rank, unavailable article state, comment count, and a full-width reader-vote action below content, separate from story appreciation. |
| `ReadingHistoryCard` | `Frontend/src/features/discovery/components/ReadingHistoryCard.tsx` | Feature-only | Extracted article-history row with shared stacked metadata (8 px gap), serif headline, sibling writer/story targets and existing progress/status. Reused by Continue reading/recent History in Library and standalone History. |
| `ShortCardSkeleton` / `ShortDetailSkeleton` | `Frontend/src/shared/components/ui/Skeleton.jsx` | Shared | Format-specific loading placeholders for known short card grids and the compact short reader. They mirror the short title, excerpt, author, and action zones while retaining the shared pulse and theme tokens; article skeletons remain separate. |
| `ShortCard` | `Frontend/src/features/discovery/components/ShortCard.jsx` | Candidate | Independent short presentation and compact-reader opener, reusing shared PostCardMenu and compact PostEngagementControls. It retains the default 250 px maximum width and 380 px height, plus fluid responsive grids with 170 px minimum tracks, a four-column cap, and narrow-phone overrides. The portrait card uses a dark title zone with the first nonempty tag or a tagless accent line, a two-line title at all sizes, and a lighter excerpt zone that dynamically clamps to the space above the footer. The footer places avatar and truncated first name left of compact appreciation/comment controls. Existing optional 16:9 cover, menu actions, reader, routes, and APIs are retained. |
| `DiscoveryPostCard` | `Frontend/src/features/discovery/components/DiscoveryPostCard.jsx` | Candidate | Format dispatcher to the independent ShortCard; owns shared article list/grid cards. Article grids have a fixed 400 px height, 180 px cropped cover, two-line title, measured complete-line excerpt, and bottom engagement controls; the carousel prop remains distinct. Other shared behavior includes narrow-list covers, wrapping phone metadata and single-line list topics that show only complete pills beside engagement controls, direct icon-count appreciation and a comments modal, existing engagement hooks, and the shared icon-led overflow menu. |
| `QuestionCard` / `OpportunityCard` | `Frontend/src/features/discovery/pages/Explore/QuestionsTab.jsx`, `Frontend/src/features/question/pages/OpportunitiesPage.jsx` | Feature-only | Question and writer-opportunity preview rows keep category chips on one line, showing only whole chips that fit. Detailed question tags retain their wrapping layout. |
| `PostCardMenu` | `Frontend/src/features/discovery/components/PostCardMenu.jsx` | Candidate | Shared story overflow actions for discovery article/short cards and FeaturedPostCard. Save opens the Library/collection dialog; Share, Report, recommendation explanation, and hide remain menu commands where available. |
| `CommentsModal` | `Frontend/src/features/post/components/CommentsModal.tsx` | Feature-only | Native modal using the shared CommentsSection, paginated thread/composer, bounded internal scrolling, background blocking, keyboard focus containment, and Close/Escape/backdrop focus restoration |
| `CommentItem` | `Frontend/src/features/post/components/CommentItem.tsx` | Feature-only | Existing comment row extended with authenticated like/unlike/reply, owner edit/delete, modal edit/delete confirmation, inline replies with bottom clearance, failed-draft retention, pending protection, placeholders only for surviving reply branches, initially collapsed paginated replies, and a four-rendered-line Read more/Show less toggle. Reused by CommentsSection on articles, comment dialogs, and short readers. Inventory/evidence: [comment actions audit](comment-actions-audit.md). |
| `CommentActionDialog` | `Frontend/src/features/post/components/CommentActionDialog.tsx` | Feature-only | Owner edit/delete native modal reusing ModalLayer/ModalHeader/Button/dialog focus; pending dismissal/repeat protection, failed-text retention/retry, and deleted-row focus fallback. |
| `ShareMenu` | `Frontend/src/shared/components/ui/ShareMenu.tsx` | Candidate | Shared typed centered native share modal for all six entry points; content-specific title, Close, Copy Link / Share on X, canonical links, clipboard pending/recovery, focus containment/restoration, and Close/Escape/backdrop dismissal through ModalLayer. The existing filename is preserved. Inventory: [share audit](share-audit.md). |
| `AppreciationButton` | `Frontend/src/features/post/components/AppreciationButton.tsx` | Candidate | Shared presentational heart/count action for discovery cards, featured stories, articles, and short-read modals; the short reader shows only the icon and count. Selected filled-heart/action-text colors, 44 px target, icon-only muted pending state, and accessible pressed/label semantics remain. Callers retain existing authentication and mutations. |
| `PostEngagementControls` | `Frontend/src/features/discovery/components/PostEngagementControls.tsx` | Candidate | Shared appreciation/comment icon-count controls, with appreciation rendered by `AppreciationButton` for discovery cards, writer-profile article cards, and Explore Article of the Day; uses existing authentication, post-like cache updates/rollback (including writer articles), and CommentsModal with unique dialog IDs, 12 px counts, and 44 px targets |
| `MobileSearchDialog` | `Frontend/src/features/discovery/components/MobileSearchDialog.tsx` | Feature-only | Mobile full-screen native search dialog with animated opening/closing, visual-viewport-responsive search field, adjacent 44 px clear/submit targets, and shared empty-query topic/Popular-feed prompts that open Search directly. Debounced live Search suggestions/Authors groups remain capped independently at five; phrases run searches and authors open profiles. Inline arrow submission, keyboard selection/internal scrolling, recovery, and reduced motion are preserved. |
| `MobileProfileSheet` | `Frontend/src/features/user/components/MobileProfileSheet.tsx` | Feature-only | Mobile native Account bottom sheet with ordered signed-in Profile/Library/Studio links, Settings, Help, social links, focus containment/restoration, scrolling, and desktop-resize dismissal; no separate Write row. |
| `FormatChooser` | `Frontend/src/features/editor/components/FormatChooser.tsx` | Feature-only | Shared Post/Short modal opened by Studio’s Write a post button. Creates a typed draft with pending protection and retry, then opens `/studio?draft=<id>`. |
| `DeleteDraftButton` | `Frontend/src/features/editor/components/DeleteDraftButton.tsx` | Feature-only | Shared Write/Studio draft action and permanent-deletion confirmation, using Button, ModalHeader, ModalLayer, dialog focus, existing owner-scoped delete API and draft caches. Close/Escape, pending guards, retained failures/retry, and focus fallback after row removal. |
| `MobileBlockMenu` | `Frontend/src/features/editor/components/MobileBlockMenu.tsx` | Feature-only | Native viewport-bounded editor bottom sheet for phone insertion choices below 768 px from the active block's left-side + control (with × removal on the right), reusing ModalLayer/ModalHeader/dialog focus and safe-area padding. At 768 px and wider, + uses the anchored SlashMenu. The editor owns active-block actions and mutations. |
| `MobileEditorCommands` | `Frontend/src/features/editor/components/MobileEditorCommands.jsx` | Feature-only | Phone-only horizontal block-type toolbar visible on story-textarea focus. All eligible slash-menu choices are directly available by sideways scrolling; the strip follows the visual viewport above the keyboard or bottom navigation and converts the active block in place. |
| `TagPicker` | `Frontend/src/features/editor/components/TagPicker.tsx` | Feature-only | Searchable multi-tag combobox with public choices, custom creation, selected-count/group treatment and 44 px chip removal targets, duplicate protection, keyboard selection/dismissal, viewport placement, debounced queries, and inline retry that preserves custom entry. Publishing retains its required 20-tag/60-character limits; Ask a question uses optional five-tag/30-character limits and distinct control IDs. Reuses Button/ViewportPopover; shared Select remains single-choice. |
| `Select` | `Frontend/src/shared/components/ui/Select.tsx` | Candidate | Controlled typed single-choice dropdown used by Theme and Language in Settings and existing feature filter/form choices. Optional option badges render compact pill tags beside labels in both the menu and selected value. Reuses ViewportPopover for matching-width, zero-gap bounded placement, preferring below with internal scrolling; 120 ms edge reveal and chevron rotation respect reduced motion. 44 px trigger/options, selected checkmark, active option, arrows/Home/End/typeahead, Enter/Space, Escape/Tab/outside dismissal, and trigger focus. Uses existing theme tokens, generated/explicit IDs, caller layout bounds, dynamic-option bounds, and required native form validation with trigger focus/error feedback. Captured Escape closes the dropdown before its parent dialog. Values, URLs, gates, and payloads stay with callers. |
| `ProfileSettings` | `Frontend/src/features/user/components/ProfileSettings.tsx` | Feature-only | Shared Select controls for Light, Dark, Use system theme, and the openable English-only language list on Settings; guests and members use the existing shared theme hook |
| `ReadingInterestSettings` | `Frontend/src/features/user/components/ReadingInterestSettings.jsx` | Feature-only | Signed-in Edit profile sections for explicit topic choices and staging an inferred-interest reset; the parent page's single header Save applies their changes through existing onboarding and reset APIs. |
| `SignInPrompt` | `Frontend/src/shared/components/ui/SignInPrompt.tsx` | Candidate | Shared centered guest prompt with customizable message and one Sign In button opening LoginModal on explicit activation; reused by PrivateRoute, Profile, and private saved-story targets on Write. Routes wait for session restoration and keep private content unmounted until authenticated. |
| `FilterPopover` | `Frontend/src/shared/components/ui/FilterPopover.jsx` | Candidate | Shared filter panel capped at 360 px or 90vw with 16 px padding, a divided header, readable labels, bordered reset control, fixed viewport placement, pinned mobile position across result/filter changes, bounded internal scrolling, portal-aware outside dismissal, and keyboard focus containment; FilterBar separates choices from sort and uses 44 px targets |
| `Navbar` | `Frontend/src/shared/components/layout/Navbar.jsx` | Candidate | Global search has no type-selection buttons; the desktop/tablet empty-query popover reuses mobile Trending searches and suggested topics with direct search selection. Typed desktop autocomplete debounces by 250 ms and shows independent Search suggestions/Authors groups capped at five, with full phrase labels, keyboard selection/internal scrolling, exact-input submission, and stale-response isolation. Desktop Account groups identity and role with described destinations; a sign-out icon beside the name opens a native choice modal for this session or all devices, preserving keyboard/focus behavior; separate contracts from the top-bar layout before promotion. |
| `Sidebar` | `Frontend/src/shared/components/layout/Sidebar.jsx` | Candidate | Home precedes Browse (direct Trending, Questions, Competitions, Shorts links), Catalog (Collections, Series), and Your space (Studio, signed-in Member Hub). Help/Settings are in the desktop account menu. Group headings are independent disclosures, open by default, with accessible expanded state. The icon rail shows group dividers and every page link. Trending's arrow icon inherits link color via `currentColor`; retain existing routes, access rules, keyboard resizing, and expanded/collapsed behavior. |
| `BottomBar` / `BrowseTabs` | `Frontend/src/shared/components/layout/BottomBar.jsx`, `Frontend/src/shared/components/layout/BrowseTabs.jsx` | Candidate | Home, Explore, Shorts, Browse, and Account on every mobile application route. Browse links to Collections; the Collections and Series pages share mobile-only sticky underline navigation between their existing routes. Studio and signed-in Member Hub are available in the Account sheet. Explore, Browse, and Account retain normal accent color when inactive. |
| `SeriesIcon` | `Frontend/src/shared/icons/SeriesIcon.jsx` | Candidate | Shared 16 px ordered-reading glyph for the desktop Series navigation link; keep it distinct from the Collections grid icon while preserving the existing navigation-label and color behavior. |
| `Loader` variants | `Frontend/src/shared/components/layout/Loader.jsx` | Deprecated target | Replace oversized page loader with shared skeleton and progress patterns |
| `PageFrame` | `Frontend/src/shared/components/layout/PageFrame.jsx` | Candidate | Owns the shared application outer frame via app-page-frame (1120 px cap; 16/20/32 px gutters), reused by all content routes and shell Back rows. Article loading uses the same frame; standalone auth/onboarding and centered access/recovery surfaces retain their compositions. Regression inventory: [page alignment audit](page-alignment-audit.md). |
| `AppLayout` | `Frontend/src/shared/components/layout/AppLayout.jsx` | Candidate | Rename to AppShell and handle focus/skip link/scroll restoration |
| Question card | local to Questions page | Missing shared pattern | Extract after real question DTO and mutations exist |
| Competition card | local to Competitions page | Missing shared pattern | Extract after competition contract is stable |
| `CollectionCard` | `Frontend/src/features/collection/components/CollectionCard.jsx` | Candidate | Shared server-backed card in Collections, Saved, Home, and Author with a container-responsive cover-left layout that stacks the cover on narrow tracks, app serif title, divided story/short-count and curator-avatar footer, ImageBox and Avatar fallbacks, viewport-positioned action menu, and native delete confirmation. Preserve save/share/delete/hidden behavior, keyboard focus return, and the 44 px menu target; add typed props before promotion. Composition rules live in ui-rules.md. |
| Empty state | scattered text | Missing | Create composed reusable pattern |
| Error state | `Frontend/src/shared/components/layout/ServerUnavailable.jsx`, `Frontend/src/shared/components/ui/MissingResourceState.jsx`, plus feature-local states | Candidate | The shared server-unavailable variant replaces the application shell with a centered, chrome-free recovery page only when the API cannot be reached or a gateway reports it unavailable. The missing-resource variant gives dynamic content routes a specific unavailable message and parent-discovery link for invalid or missing route identifiers; other feature-level failures remain retryable and inline. |
| Skeleton | absent | Missing | Create text, card, list, and article primitives |
| Dialog | `ModalLayer` plus existing feature-native dialogs and `useDialogFocus` | Candidate | Shared viewport and top-layer behavior is available; keep feature-specific content, focus, and motion contracts while validating new modal uses. |
| Drawer | absent | Missing | Needed for mobile filters and article tools |
| Toast/status region | `Frontend/src/shared/hooks/useToast.jsx`, `Frontend/src/shared/components/ui/ToastViewport.jsx` | Candidate | Shared in-house action feedback with success, info, error, dismissal, reduced motion, and responsive placement |
| Form field | repeated inputs | Missing | Create label/help/error/input composition |
| Tabs | ad hoc pills | Missing | Create semantic tabs and route-tab guidance |
| Menu/popover | `ViewportPopover` plus existing caller keyboard/outside-dismiss handlers | Candidate | Shared viewport placement is available; keep semantic and action-specific keyboard behavior with callers and use portal-aware outside dismissal. |
| Save/reaction controls | feature-local | Feature-only initially | Promote only after API behavior stabilizes |
| Editor block | editor feature | Feature-only | Keep inside editor; share only primitive controls |

CollectionCard navigation uses the existing semantic title link stretched across the full card surface; its options trigger and actions remain independent above the link. Collections, Saved, and Home share this behavior without a layout change.

## Required primitive contracts


### Button

Current variants: `primary`, `secondary`, `ghost`, `action`, `menu`, `disclosure`, `danger`, `selector`. Primary/secondary retain existing pill styling; action is borderless icon/text; menu is a full-width icon/text row.

Sizes: `sm` (44 px minimum, 12 px label, 12 px horizontal padding), `md` (default; 44 px minimum, 13 px label, 18 px horizontal padding), `lg` (48 px minimum, 15 px label, 24 px horizontal padding). Small does not shrink the hit target. `buttonStyles.ts` owns shared appearance; Button owns promise/busy behavior, ButtonLink preserves router/anchor navigation, and IconButton requires label/icon props and matching minimum width.

Contract requirements:

- Native button attributes
- `aria-busy`, pending repeat protection, and stable label/icon content
- Leading/trailing icon slots
- No arbitrary colors through props
- Disabled and `aria-disabled` distinction documented
- Button renders a native button; implemented ButtonLink renders a router Link for to or anchor for href, sharing named styles and sizes

### IconButton

- Requires accessible label
- Sizes correspond to target dimensions
- Tooltip is supplementary, never the accessible name
- Supports pressed state when it is a toggle

### FormField

- Stable input ID and visible label
- Optional description
- Error message and invalid state
- Required/optional indication
- Character count slot when relevant
- Does not own business validation

### Dialog

- Accessible title and optional description
- Initial focus and restored trigger focus
- Focus containment
- Escape and explicit close behavior
- Prevents background interaction
- Does not close on backdrop when doing so risks losing work unless explicitly configured

### Skeleton

- Mirrors the approximate target layout
- Hidden from assistive technology when redundant with a loading status
- No continuous high-contrast shimmer under reduced motion

## Reuse decision tree

Before creating a component:

1. Is this a semantic HTML element with token styling? Use the native element.
2. Does a Stable registry component meet the contract? Reuse it.
3. Can a Candidate be safely extended without feature-specific props? Improve it.
4. Is the pattern repeated in at least two real contexts with the same behavior? Propose a shared pattern.
5. Does it contain domain logic or rapidly changing product behavior? Keep it feature-local.

Do not abstract based only on visual similarity. Two cards that look alike but have different interaction and information priorities may remain separate compositions over shared primitives.

## Component API rules

- Props describe meaning, not CSS implementation.
- Prefer `tone="danger"` over `red` and `size="sm"` over raw dimensions.
- Avoid more than two boolean presentation props; use a variant union when states are exclusive.
- Do not accept unrestricted `style` to bypass the design system on Stable components.
- Accept `className` only where compositional layout requires it; internal visual tokens remain owned by the component.
- Expose event callbacks with domain-relevant arguments.
- Controlled and uncontrolled behavior must be deliberate and documented.
- Reusable components do not fetch product data.
- All public props and emitted states are typed.

## State coverage

Every promoted component is reviewed for:

- Default
- Hover
- Focus-visible
- Pressed/selected
- Disabled
- Loading
- Empty content
- Long content and localization expansion
- Error/invalid when applicable
- Light and dark themes
- Narrow width and 200% zoom
- Reduced motion
- Keyboard and screen-reader behavior

## Promotion process

A component becomes Stable when:

1. It has at least two validated use cases or is a foundational accessibility primitive.
2. Its responsibility and non-goals are documented.
3. Props are typed and do not expose incidental styling.
4. Visual examples cover states and themes.
5. Interaction tests cover keyboard and accessible names.
6. It uses only registered tokens.
7. Existing duplicate implementations have a migration plan.
8. This registry is updated.

## Deprecation process

- Mark the component Deprecated in this registry.
- Identify the replacement and affected call sites.
- Prevent new imports through linting when practical.
- Migrate in bounded changes.
- Remove the old component after all consumers and tests move.

## Planned registry sequence

1. Button, ButtonLink, IconButton
2. FormField and input primitives
3. Skeleton, EmptyState, ErrorState
4. Dialog, Drawer, Menu, Popover
5. WriterIdentity and normalized ArticleCard family
6. Tabs and FilterBar
7. QuestionCard, CompetitionCard, CollectionCard after server contracts stabilize
8. MetricCard and accessible chart wrappers during analytics work


## Story format dispatch

DiscoveryPostCard chooses the independent ShortCard presentation for `format: short`; ShortCard supplies its compact reader when no page-level opener is given. Both cards reuse PostCardMenu. ShortReadModal owns a stable responsive frame, an 800 ms vertical transition, overlay/outside and reading-pane edge navigation, medium/large external Up/Down controls, a fixed icon-only action footer with appreciation/comment counts and bounded comment scrolling isolated from short navigation, series progression, deeper links, and focus restoration across successive shorts. It has no inline list pager or position label. The Shorts page optionally supplies its currently displayed short IDs for this modal-only navigation. PostPage dispatches canonical `/post/:id` reads by format. CollectionDetail owns Full articles/Short reads grouping, format-local ordering, and the owner-only direct Add to collection chooser. See [short format audit](short-format-audit.md).

`CreateCollectionModal` in `Frontend/src/features/collection/components/CreateCollectionModal.jsx` is shared by Collections and Library, preserving the same fields, validation, and creation mutation. SeriesPage reuses PageFrame, PageHeader, Button, the shared `CreateSeriesModal` (`Frontend/src/features/discovery/components/CreateSeriesModal.jsx`), and the existing series cards for format-separated browsing and creation. Library and the empty Add to series dialog use the same creation modal. Series detail dispatches ShortCard or DiscoveryPostCard from its stored type and provides owner add, remove, and order controls. The existing short reader and article page retain progression links.

The article page uses one end-of-body series Link styled as the existing pill action. It points to the next post or the series index for the final part; the earlier bordered series panel is removed.

The 2026-10-12 [post components audit](post-components-audit.md) records actual consumers across every route. ArticleCard, FeaturedCard, CompactCard and HorizontalCard have no application consumers; active discovery short cards use ShortCard, article list/grid cards use DiscoveryPostCard, and several article layouts remain page-local. The authorized correction repairs owner/question-response author contracts, viewer-aware appreciation/save propagation, History link semantics, affected serif headlines and body theme tokens. PostCardMenu is the shared story/featured-menu command owner, consuming ActionMenu and instance-specific IDs. Remaining local article metadata/layout consolidation and legacy-card removal are optional; the audit records the completed fixes and verification limits.
