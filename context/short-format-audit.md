# Short format rendering audit

## Short loading states — 2026-10-19

Shorts grids and saved/search short results now use a portrait ShortCard skeleton with separate title, excerpt, and compact action areas. The compact reader uses a title-first ShortDetail skeleton and fixed footer placeholders. Story card and article detail skeletons remain unchanged. This is presentation-only; routes, queries, API responses, schemas, and loaded layouts are unchanged. Frontend lint and production build passed on 2026-10-19; the focused Playwright short-format suite could not start because its configured API server could not connect to MongoDB.

## Narrow short-card title clearance — 2026-10-18

The shared ShortCard title section previously used a percentage flex basis with `min-height: 0`. At narrow card widths, its tag/menu row and two-line title could exceed that allocated height and be hidden by the card's overflow boundary. The section now uses the same percentage as a minimum height and grows to fit its content. The excerpt takes the remaining card space above the fixed footer. This changes only the shared card's sizing rule; the responsive columns, title typography, two-line clamp, colors, menu, reader, routes, API, and data flow stay as they were.

The frontend lint and production build passed. A focused browser regression check covers 390 and 768 px, but execution remains unverified in this sandbox because local loopback requests to Vite are denied.

## Scroll reliability audit — 2026-10-18

Requested scope: fix the existing compact reader's internal scrolling and edge handoff for wheel, touchpad, and touch, retaining the upward replacement-card entrance. Existing documentation contradicts itself about holding versus releasing partial touchpad offsets; the completed scroll contract below will supersede those older descriptions.

Before-change findings: the native wheel listener attaches only to the first keyed reading pane; replacing that pane leaves subsequent cards without it. Navigation resets gesture state while the device may still send momentum. Handoff also combines device classification, scrollend timing, and different quiet intervals; partial transforms and wheel defaults can compete. Existing scroll tests assert obsolete inline `top` offsets despite the implementation using transforms.

Reuse: ModalLayer/useDialogFocus, the existing responsive 440 px reader frame, DM Sans/Libre Baskerville and semantic colors, PostBody, the fixed action footer, comments panel, save/share dialogs, and external desktop arrows. `/shorts` supplies the loaded filtered IDs; useFetchPost reads the existing viewer-specific post detail cache through `/api/post/:id`. The backend short feed/detail controllers, Post format/schema, interaction events, and engagement APIs need no changes. No page, navigation, API, schema, typography, or palette replacement is planned.

Implementation scope: `Frontend/src/features/discovery/components/ShortReadModal.jsx`; behavioral/visual coverage in `Frontend/tests/short-reader-scroll.spec.js` and affected reader checks in `Frontend/tests/discovery-post-card.spec.js`; adjacent category/selector corrections in `Frontend/tests/post-components.spec.js` and `Frontend/tests/add-to-collection.spec.js`; owning documentation in this audit, UI rules, Frontend README, and progress tracker. Existing unrelated working-tree changes are preserved. The required handler repair is confined to this reader; no optional refactor or approval-dependent structural change is included.

## Completed scroll contract — 2026-10-18

The reader now owns wheel scrolling through a native cancellable listener on the persistent dialog. It follows the current pane after keyed card replacement, keeps content-origin momentum with the same short, and preserves the once-per-gesture navigation lock across replacement. A 220 ms wheel-idle boundary re-arms input; no hardware classification or scrollend support is needed. Overlay wheel input also reads content before edge handoff. Partial pushes settle, unavailable boundaries stay centered, and touch moves are cancellable at the edge. Escape closes comments before the shared focus trap can dismiss the reader.

The complete card (surface, border, header, body, and footer) animates from below for Next and above for Previous using a mount/layout-time 800 ms transform/opacity entrance with gradual acceleration and deceleration (`cubic-bezier(0.4, 0, 0.2, 1)`) on the existing stable section; its focus trap and input target survive. Reduced motion omits entrance and edge transforms. This supersedes the earlier content-only entrance and contradictory held/released touchpad behavior. The complete current thresholds and interaction rules belong to [UI rules](ui-rules.md).

## Compact reader body typography — 2026-10-17

The short reader's body headings use 20 px H1, 18 px H2, and 16 px H3, with respective line heights of 1.35, 1.4, and 1.45. Paragraphs remain 14 px with 1.7 line height. The separate modal post title and full article body styles are unchanged.

## Short preview source length — 2026-10-17

The shared post presenter previously cut every excerpt at 220 characters, so long short-card previews could end before the card's dynamic line clamp used its available space. Short summaries now provide up to 800 characters to the existing clamp; article and legacy-format summaries retain the 220-character limit. The response field, stored body, card dimensions, and reader behavior are unchanged. The presenter contract test checks both bounds.

## Fluid short-card title and excerpt balance — 2026-10-17

For the shared fluid ShortCard shown in short grids, the two-line title grows from 16 to 18 px with 1.25 line height. Cover-free fluid cards reserve 35% of the card for the title section instead of 42%, making more fixed-height room for the dynamically clamped excerpt. The compact two-column 360–407 px layout retains 42% title space so its wider title lines fit; standalone cards and covered-card sizing remain unchanged. The existing tag/menu, footer, reader, routes, APIs, and data are preserved.

## Compact series item list — 2026-10-16

Series detail presents posts and shorts as numbered compact rows rather than embedding discovery cards in full-width rows. Each row uses the existing display font and theme colors for a linked title, at most two preview lines, reading time, and the shared item action menu. A short title opens the existing short reader in place; an article title opens its canonical post route. The number, text, and action occupy separate responsive columns, including at 320 px. Series data and other card surfaces are unchanged.

Post-series rows with a cover use the existing `ImageBox` at a 16:9 ratio. The cover sits beside the text on wider screens and above it within the content column on narrow screens. Posts without covers and short-series rows keep the compact text layout.

## Series reader progression — 2026-10-16

The short series detail page opens its ordered short cards in one shared reader. The reader receives the published series item IDs, so its existing wheel, touch, and external Up/Down controls advance through those list items. The series strip identifies the current short as part of its named series and links to the series page. Full posts show the same series destination after their body. Both reuse the existing post detail `seriesContext` title and ID; no route, API, or schema change is needed.

## Add to series entry points — 2026-10-15

Released owner shorts now expose the same format-aware Add to series flow as articles in shared card overflow menus, Writing studio management menus, and the detailed short-reader footer. The shared dialog lists only matching short series and preserves current membership, capacity, pending, failure, and focus behavior. Article cards and the full article reader use the same dialog with story-series choices. The backend append operation retains ownership, release, format, order, 50-part, and single-series rules without changing the schema or existing creation/update routes. Focused verification and the complete changed behavior are recorded in the progress tracker.

## Scope and findings — 2026-10-12

Request: display and open shorts with the existing short components everywhere, and separate full articles and shorts in mixed collections.

The stored Post format already distinguishes `article` and `short`. Discovery summaries omitted that field, search/writer/competition/response queries omitted it in some projections, and collection detail rendered every item through the article card. Several independent history, profile, member, question, competition, and series rows also assumed an article. Canonical `/post/:id` links always mounted the full article page. No schema migration is needed.

## Required implementation inventory

- Backend summary/data flow: `services/post-presenter.service.js`, `controllers/search.controller.js`, `controllers/writer.controller.js`, `controllers/competition.controller.js`, `controllers/question.controller.js`, and `controllers/short-series.controller.js`. Preserve format in existing responses and enrich series entries using the existing presenter.
- Shared frontend presentation: `features/discovery/components/DiscoveryPostCard.jsx`, `ShortCard.jsx`, and `ShortReadModal.jsx`. Dispatch short formats through the existing short card, open the compact reader by default, and retain series/deeper links and opener focus across progression.
- The `/shorts` page passes its currently loaded and topic-filtered card IDs to `ShortReadModal`. It preserves the responsive reader geometry, full-card vertical entrance, fixed actions, isolated bounded comments panel, external desktop navigation, backdrop blur, series/deeper links, and focus return. The authoritative current input contract is in [UI rules](ui-rules.md); list navigation neither changes the page nor fetches additional feed pages.
- Canonical reading: `features/post/pages/index.jsx`. Select the reader by fetched format while retaining `/post/:id` and existing article rendering. Series progression replaces the current short URL so dismissing returns to the originating page.
- Collections: `features/collection/pages/CollectionDetail.jsx` and `SavedPage.jsx`. Preserve format in saved normalization; render nonempty Full articles and Short reads sections, with order controls operating within each format and the existing combined `postIds` write contract.
- Independent frontend rows: `features/user/pages/Author/index.jsx`, `features/user/pages/Profile/index.jsx`, `features/discovery/pages/ReadingHistory.jsx`, `features/membership/pages/MemberHub.jsx`, `features/discovery/pages/Explore/QuestionDetail.jsx`, `CompetitionDetail.jsx`, `CompetitionsTab.jsx`, `TrendingTab.jsx`, and `features/discovery/pages/ShortSeriesDetail.jsx`. Reuse ShortCard for short entries; the featured article slot selects an article.
- Regression coverage: `Frontend/tests/short-format.spec.js`, `Frontend/tests/collection-detail.spec.js`, and `Backend/tests/foundation-contracts.test.js`.

## Writing studio management cards — 2026-10-13

Writing studio Shorts now use the existing centered/left-aligned responsive short grid and a dedicated `WritingStudioShortCard` that reuses shared ShortCard presentation while replacing its discovery menu with the same owner `WritingPostMenu` used by article rows. Edit, Unpublish/Republish, and Delete continue through existing APIs and dialogs. Public Profile/Author and discovery ShortCard menus are unchanged.

## Short tags — 2026-10-13

Short-card previews omit tag chips in every layout. The detailed `ShortReadModal` shows only complete tag pills that fit one row below author metadata; when none fit, that row collapses. Heart and comment controls occupy their own footer row in previews. Tag values and search destinations reuse the existing post data and tag links; APIs, storage, routes, card geometry, and the rest of the reader layout are unchanged.

## Short header — 2026-10-13

Short cards across every caller now place writer identity beside the overflow action and date/reading time on a separate full-width row. The author avatar/name sits lower to align with the center of the 44 px overflow target; the target itself stays in its normal position. When both date and reading time are present, their separator dot stays attached between them and cannot wrap by itself. Article card metadata and the shared AuthorMeta contract remain unchanged.

## Separate short-card presentation — 2026-10-13

`ShortCard.jsx` now owns short-card markup and interactions. `DiscoveryPostCard.jsx` dispatches short formats to that component and retains article list/grid presentation. Shared discovery actions live in `PostCardMenu.jsx`, reused by both card components and FeaturedPostCard. Short callers and owner menu overrides keep their existing props and behavior.

## Preservation and behavior

Reuse existing short card typography, theme variables, borders, metadata/actions and compact ModalLayer reader; existing full article cards/pages, page frames, navigation, editor, ownership/voting/publication controls and APIs remain intact. These changes correct format selection and add the requested collection sections; they introduce no optional redesign, route replacement, or database model change. Missing format on legacy posts defaults to article.

Ordinary short card clicks open the reader in place. Modified clicks retain canonical links; direct links open the same compact reader. Series previous/next remain compact, Go deeper opens its full article, and short opens use the existing interaction event endpoint. Collection grouping preserves relative order within each format; moving a short never moves an article.

Verification results are recorded in the dated progress tracker entry. Browser coverage uses mocked APIs; it does not validate a live database or deployment.

## Short series reader navigation — 2026-10-16

The short reader's series row now names the series and links to its overview for every part. It identifies the current part number when available. Reader list navigation remains available through wheel, touch, and external Up/Down controls.

### Compact short series strip — 2026-10-16

When a short belongs to a series, its reader shows a compact series section immediately after the short body inside the scrollable story pane. It uses a small membership label, one-line series title, and View series cue. The action footer stays fixed below the reading pane.

## Short reader footer actions — 2026-10-16

The compact short reader footer presents appreciation, comments, Save, and Share in that order. Appreciation and comments show an icon with the current count; Save and Share show only their icons. All four controls omit visible action text at every width and retain accessible names. The comment control opens the comments panel; the separate Comments disclosure row is removed. The Series action is removed from this footer. The in-content series link appears whenever the short has series context. Other Add to series entry points are unchanged.

### Series completion context — 2026-10-16

The short reader shows its series link whenever the short has series context, including standalone cards, feeds, search, collections, and canonical post routes. It opens the series overview from every part.

## Scroll verification — 2026-10-18

The final full-card implementation passed 20 focused mocked-API Chrome checks and seven distinct adjacent save/engagement/series checks. Coverage includes native wheel content scrolling, simulated touchpad momentum beyond one animation, replacement-pane cancellation, forward/backward handoff without scrollend, partial release/reversal, boundaries, delta modes, horizontal/pinch input, comments/share isolation and Escape, delayed loading, touch cancellation, reduced motion, and responsive geometry/focus at 320/390/768/1280 px. Phone Light and desktop Dark reader/entrance screenshots were inspected. Detailed dated verification and limitations are in the progress tracker. Physical input hardware, other engines, assistive technology, and live persistence remain unverified.
