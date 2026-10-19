# Article and short component audit

## Home carousel excerpt space — 2026-10-18

The covered grid card's excerpt flexes into the space above the engagement footer. The previous fixed three-line clamp could be clipped by a shorter flexible region, hiding the ellipsis. Grid cards with excerpts now measure that region after layout and clamp to the number of complete lines that fit, up to three, so the ellipsis is rendered on the last visible line; grid cards without excerpts keep the footer's automatic top margin. Card height, cover, typography, metadata, actions, routes, and response fields are unchanged.

## Narrow feed-card spacing — 2026-10-13

The image-bearing discovery list card shown in the supplied narrow-screen screenshot had excess space around the content. Below 540 px, comfortable feed cards now use 24 px vertical insets instead of 40 px, including the first card. A follow-up centers the author within the menu row and gives the menu wrapper 8 px negative vertical margins, so its 44 px touch target does not make the row appear taller. The title starts 8 px after the compact row and remains below the menu target. This changes only spacing in `DiscoveryPostCard` and `PostCardMenu`; cover ratio, metadata, footer, actions, links, typography, colors, API, and schemas stay as before. Focused lint and production build passed on 2026-10-13. The focused browser test could not start with its API server because MongoDB was unavailable; the frontend-only attempt found no local Playwright Chromium executable. Browser geometry remains unverified.

The author name in that compact row now uses the same muted text token as the date and reading time below 540 px. The link, hover behavior, and wider-screen name color remain unchanged.

## Responsive post-card covers — 2026-10-13

The active article and short card covers now use the existing `ImageBox` with an optional 16:9 aspect ratio wherever cover width changes: DiscoveryPostCard grid/narrow list, ShortCard, and CompetitionEntryCard. FeaturedPostCard uses the same ratio on narrow screens and continues filling its text-defined desktop row. WritingPostRow thumbnails retain their 5:4 shape while scaling from their existing 80 px and 112 px widths. Cards without media remain content-driven; the fixed ShortCard outer height and existing grid tracks are unchanged. No route, API, schema, typography, color, or interaction change was needed. Frontend lint and production build passed. The normal focused browser run could not start because its configured MongoDB service was unavailable; a frontend-only run was blocked from local loopback navigation by the sandbox. Browser geometry remains unverified.

## Competition entry grid spacing — 2026-10-13

The current responsive Entries layout uses one/two/three full-width tracks below 540 px/from 540 px/from 1024 px. Article cards fill each track; short entries keep their compact ShortCard dimensions and center inside the track. This supersedes the earlier capped-track state documented below. The card cover remains 16:9 and reader voting, links, winner/rank, and unavailable states are preserved. Frontend lint and build passed on 2026-10-13; browser geometry remains unverified.

The competition Entries section used the shared `.card-grid--post` auto-fit tracks. With two entries in a wide frame, those tracks expanded across the frame while each card remained capped at 360 px, leaving a large visual gap. The Entries grid now uses a scoped auto-fill rule with tracks capped at the card width, so the cards sit next to one another and extra room remains after the final card. Entry card layout, type, colors, voting, links, API, and schema are unchanged. Changed `Frontend/src/features/discovery/pages/Explore/CompetitionDetail.jsx`, `Frontend/src/styles/global.css`, and `Frontend/tests/competition-entries-layout.spec.js`. Focused lint, production build, and scoped whitespace check passed. The focused Chromium run could not start because the Playwright Chromium executable is missing locally, so browser geometry remains unverified.

## Question response choice — 2026-10-13

Question detail no longer presents an inline short-answer form. Its Add an answer control and question feed Add response controls open shared QuestionResponseModal for signed-in users; guests retain sign-in gating. The modal offers eligible already-published owner posts from the existing owner-post read and attaches one through the existing `PUT /api/question/:id/responses/:postId` route, or links to the editor with `?question=<id>` to write a new post. Loading, empty, retry, pending, error, and focus behavior use existing modal and control patterns. Existing short answers remain readable and votable; the old answer API remains backward compatible. No backend, schema, or route change was needed. Focused ESLint and frontend production build passed on 2026-10-13.

## Question responses, competition entries, and recent winner — 2026-10-13

QuestionDetail's title-only article response link is now QuestionResponseCard with shared AuthorMeta, serif title, optional excerpt, and a separate Read response link; short responses still use ShortCard. CompetitionDetail's inline entry article/short presentation is now CompetitionEntryCard, retaining author/story links, unavailable article state, winner/rank, comment count, and its separate reader-vote action. CompetitionsTab's recent article winner uses FeaturedPostCard with a configurable Recent winner label and separate reader-vote line. Recent winning shorts retain their existing ShortCard presentation. The question and competition hooks, routes, vote mutations, post appreciation, APIs, and schemas are unchanged. Focused ESLint and production build passed on 2026-10-13; browser behavior was not exercised.

## Writer grid, studio row, and early access — 2026-10-13

Public Author and personal Profile article grids now render the shared DiscoveryPostCard grid variant; the local WriterPostCard implementation was removed. Short posts still dispatch through DiscoveryPostCard to ShortCard. Writing studio's existing article management row was extracted to WritingPostRow, retaining its cover/story links, date and publication status, engagement counts, and WritingPostMenu actions. Member Hub early access articles now use DiscoveryPostCard grid and display a Member early access badge. The short early access presentation remains as before. Existing routes, API contracts, schemas, themes, and page layouts are unchanged. Frontend lint and production build passed on 2026-10-13; browser tests were not completed in this run.

## Compact post-detail author bio — 2026-10-13

The post-detail author bio card places View Profile alongside the biography, vertically centered against the stacked name/biography block, and uses 16 px padding to reduce its height. The name and biography remain tightly stacked. The avatar, colors, type, and profile destination are preserved; the biography/link row can wrap on narrow screens. No route, API, or schema change is needed.

Changed implementation: `Frontend/src/features/post/pages/AuthorBio.jsx`. Current presentation is recorded in UI rules and completion in the progress tracker.

Date: 2026-10-12. Scope: current working tree, every registered route and source reference to post presentation. Initial audit followed by the authorized six-gap correction below.

## Separate short-card presentation — 2026-10-13

ShortCard now owns short-card markup and interactions. DiscoveryPostCard retains article list/grid cards and dispatches stored short formats to ShortCard. PostCardMenu moved to its own shared module and remains reused by discovery article/short cards and FeaturedPostCard; shared PostEngagementControls and ShortReadModal behavior are preserved. Existing direct ShortCard imports and `menuOverride` callers continue to work.

## Short-card content grouping — 2026-10-13

The shared short card groups author metadata, title, and description at the top, then uses flexible space to keep the topic and engagement footer at the bottom of the existing fixed-height card. Article/list/grid variants retain their original structure via a display-contents wrapper. Styling, title/description clamps, width/height, responsive grid alignment, and actions are preserved.

## Short width follow-up — 2026-10-12

Short-card sizing now enforces the requested 250 px maximum at both the shared card and the parent short grid. Profile switches from its 360 px post grid to card-grid--short for the Shorts category, and the shared short-grid token is 250 px. This fixes the parent sizing as well as the card variant. Full width in narrower containers and existing card content, styling, interactions and backend contracts remain intact.

## Featured spacing follow-up — 2026-10-12

The screenshot showed empty bands around a vertically centered desktop cover. FeaturedPostCard now fills the text-defined row with the cover, top-aligns metadata and uses a 20 px engagement gap. Intrinsic image dimensions are excluded from row sizing. Existing columns, phone 280 px cover, fonts, themes, links/actions and backend data flow remain preserved. Changed FeaturedPostCard.tsx, article-of-day.spec.js and the owning UI/context records; final dated verification is in the progress tracker.

## Featured, short and history cards — 2026-10-12

Extracted the existing Article of the Day into FeaturedPostCard and article history row into ReadingHistoryCard. Trending still owns featured selection and feed/filter state; ReadingHistory still owns format/status/sort and short-row status. Shared AuthorMeta, PostEngagementControls and PostCardMenu retain writer links, engagement, menu commands and focus handling. The requested changes give featured content a 20 px gap before engagement and align desktop cover/metadata at the top with the cover filling the content row, stack history identity/date with an 8 px gap, and enforce 100% width/max-width 320 px inside the shared short variant. Short height remains content-driven; existing title/excerpt/footer styling and excerpt preview clamping are preserved.

Audit: AppLayout/PageFrame, DM Sans metadata/controls, Libre Baskerville headlines, semantic Light/Dark colors, featured cover/content grid, history progress/status and sibling writer/story targets remain authoritative. Discovery uses the existing viewer-scoped feed query and /api/post/feed; history uses authenticated /api/v1/reading-history with 50 recent available posts and six continuation records from interaction events. Existing Express controllers/post presenter and Post/Profile/Like/Save/InteractionEvent records require no change. Routes, filters, APIs, schemas, cache/mutation behavior, other card families and unrelated working-tree changes are preserved. No optional refactor, dependency or approval decision remains.

Changed source: new Frontend/src/features/discovery/components/FeaturedPostCard.tsx and ReadingHistoryCard.tsx; existing components/DiscoveryPostCard.jsx, pages/Explore/TrendingTab.jsx and pages/ReadingHistory.jsx. Verification: Frontend/tests/article-of-day.spec.js, discovery-post-card.spec.js and post-components.spec.js; existing trending-menu coverage is reused. Documentation: this audit, UI rules, UI registry and progress tracker. UI rules owns current presentation; dated completed results belong to the tracker.

## Result and reference

Reuse is partial. Shorts have one shared card implementation and reader; owner-post and question-response summaries now supply compatible public author data. Articles use shared discovery list/grid cards in the main feeds and library, while featured and history presentations have extracted feature components; writer, competition, early-access, response, and management presentations retain their distinct compositions.

The reference is the current [UI rules](ui-rules.md), [UI registry](ui-registry.md), and [short format audit](short-format-audit.md). Different agreed layouts are legitimate; identical outer geometry is not an acceptance requirement. The correction preserves page layouts, routes, models, sizes and existing controls. It restores the agreed serif for three editorial headlines, uses existing theme tokens for reading-body code/dividers, and consolidates the explicitly requested featured-menu logic. Optional article-layout consolidation and legacy-card removal remain outside scope.

## Completed correction — 2026-10-12

The six requested gaps are fixed:

- Owner posts use the existing discovery presenter with populated public author data, retain management fields/legacy IDs, and omit bodies from the response. Question list/detail/search response posts use the same populated, viewer-aware presentation while retaining `_id` and `coverImage`. QuestionDetail accepts either ID/image shape. AuthorMeta safely renders Unknown writer without a fabricated profile link; separators require available metadata.

- History, early-access article and competition-entry headlines consume `--font-display` at their existing sizes.

- History keeps its progress layout and stretched story target with a sibling writer link; no anchor contains another anchor.

- Discovery and Article of the Day use the same exported PostCardMenu, ActionMenu trigger/rows, save/share/collection/report commands, pending/error behavior and focus handling. Featured appreciation stays in the existing engagement control; discovery-specific reason/hide commands appear where a hide callback exists. Menu/share IDs use a component-instance ID. Featured cover/headline composition remains intact.

- Collection/history/early-access presenters receive viewer identity; owner, saved, writer, question-response and competition summaries include current save/appreciation flags. Shared cache updates traverse history/continueReading, question responses, series entries and nested competition posts, leaving competition vote counts separate. Series ordering displays current query records in the selected order. Saved adapters respect explicit false save state. Story reads wait for restored auth where public reads could race restoration; caches are partitioned by viewer, including writer-follow and reader query compatibility.

- Full and compact PostBody code surfaces/text/dividers use existing theme tokens.

Initial findings 1–6 and 8–9 are corrected; item 10's missing-author and duplicate-menu-ID issues are also corrected. Item 7's optional local article metadata/layout consolidation and broader normalized-boundary/registry work remain outside this request. Existing article layouts, navigation, schemas, API paths, stored records, dependencies and unrelated working-tree changes are preserved. No approval-dependent decision remains.

### Changed files

Paths are repository-relative. Files with pre-existing changes were extended in place.

Backend: `controllers/user.controller.js`, `question.controller.js`, `search.controller.js`, `collection.controller.js`, `event.controller.js`, `post.controller.js`, `writer.controller.js`, `competition.controller.js`; `tests/foundation-contracts.test.js`.

Frontend:

- `src/shared/components/ui/AuthorMeta.jsx`

- `src/features/discovery/components/DiscoveryPostCard.jsx`

- `src/features/discovery/pages/Explore/TrendingTab.jsx`, `QuestionDetail.jsx`, `CompetitionDetail.jsx`

- `src/features/discovery/pages/ReadingHistory.jsx`, `ShortSeriesDetail.jsx`

- `src/features/discovery/hooks/useDiscoveryFeed.js`, `useDiscoverySearch.js`, `useShorts.js`, `useReadingHistory.js`, `useShortSeries.js`

- `src/features/collection/pages/SavedPage.jsx`, `hooks/useCollections.js`

- `src/features/competition/hooks/useCompetitions.js`

- `src/features/question/hooks/useQuestions.js`

- `src/features/membership/pages/MemberHub.jsx`

- `src/features/user/pages/Profile/index.jsx`, `hooks/useWriter.js`, `hooks/useWriterFollow.js`

- `src/features/post/pages/PostBody.jsx`, `hooks/postCache.js`, `hooks/useFetchPost.js`

- New `tests/post-components.spec.js`; updated `tests/trending-menu.spec.js`

Documentation: this audit, `context/ui-rules.md`, `ui-registry.md`, `architecture.md`, `button-style-duplicates.md`, and `progress-tracker.md`.

### Correction verification

On 2026-10-12, 48 distinct focused Chrome checks passed: 20 new post-component cases, 14 writer-profile regressions, six existing short-format cases and eight featured/discovery-menu cases. Coverage includes all seven affected short-summary surfaces, optimistic failure rollback and confirmed save/appreciation sync, reordered series, absent author rendering, full/compact body tokens in real Light/Dark modes, serif article titles and sibling History navigation at 320/1280 px, and menu keyboard/focus behavior. Final sparse-author and screenshot follow-ups passed; screenshots for phone Light/desktop Dark History, early access and competition were reviewed.

All 106 backend contracts passed, including owner/question public-summary regressions and batched writer save/appreciation state. Frontend/backend lint, focused spec lint, production build, artifact validation (72 files without source maps) and scoped whitespace checks passed. Initial sandbox localhost failures required a permitted task-owned Vite/Chrome run; test selector/theme assertions and screenshot timing were corrected before the successful checks. Database integration skipped because its opt-in service is disabled. Mocked HTTP and model-contract evidence does not verify live persistence/providers, physical devices, assistive technology or other engines.

## Route and surface inventory

| Route/surface | Article presentation | Short presentation | Assessment |

|---|---|---|---|

| `/`: all feed modes | DiscoveryPostCard list, comfortable spacing | Shared format dispatch to ShortCard | Shared |

| Home Writer's picks / Browse categories | DiscoveryPostCard grid | Shared dispatch overrides grid with short layout | Shared; different surrounding grid widths remain |

| `/explore/trending`: story feed | DiscoveryPostCard list | Shared dispatch | Shared |

| Trending Article of the Day | FeaturedPostCard and shared PostCardMenu | Slot deliberately selects an article | Extracted existing featured layout |

| `/search`: Posts / Shorts results | DiscoveryPostCard list | ShortCard with page-owned ShortReadModal | Shared |

| `/shorts`: latest shorts | Not applicable | ShortCard with page-owned ShortReadModal | Shared; series overview cards are series entities |

| `/collections/:id`: reading order | DiscoveryPostCard list | ShortCard | Shared, separate format sections and format-local ordering |

| `/saved`: Saved stories | DiscoveryPostCard through toStoryPost adapter | Shared dispatch | Shared |

| `/saved?libraryTab=history` and `/history`: Continue reading / history | ReadingHistoryCard with progress | ShortCard plus status text | Extracted article row; stacked metadata and separate article/profile links |

| `/author/:handle`: published writing | Local WriterPostCard | ShortCard | Partial; documented writer-specific grid retained |

| `/writing`: Posts / status filters | Local PostRows management layout | ShortCard plus status/management controls | Partial; short author contract repaired |

| `/writing`: Drafts and Analytics | Local draft links / performance rows | Type labels or canonical title links | Management records, not discovery cards |

| `/write`: saved drafts and composition | WriteDrafts rows / editor | Same typed draft/editor flow | Draft/editing surface, not reading cards |

| `/members`: Early access | Inline article anchor/card | ShortCard plus public-release label | Partial; article heading serif, identity plain text, viewer state repaired |

| `/explore/questions/:id`: Published responses | Inline title-only article link | ShortCard | Partial; article lacks card metadata, short author contract repaired |

| `/explore/competitions/:id`: Entries | Inline entry card with voting/rank | ShortCard with separate voting/rank | Partial; article headline serif, comments static, viewer state repaired; feature metadata legitimate |

| `/explore/competitions`: Recent winner | Inline winner feature link | ShortCard with winner label | Partial; article writer identity plain text |

| `/shorts/series/:id`: ordered parts | Not applicable | ShortCard with part number/order controls | Shared, but engagement cache synchronized, including reordered entries |

| `/post/:id`: canonical reader | ArticlePage, AuthorMeta article variant, PostBody, CommentsSection | PostPage dispatches to ShortReadModal | Shared reading body/comments/actions; distinct reading layouts intentional |

| Article quick/deeper links; short previous/next/deeper links | Canonical full-article link | Existing modal/progression | Same reader dispatch |

| `/staff`: competition judging entries | Local title/author/vote/score record | Same staff record | Operational entry form, not a reader card |

| `/notifications` | Notification destination links | Canonical destination dispatch when opened | Notification records, not embedded story cards |

| `/collections` and Home collection sections | CollectionCard | CollectionCard represents a collection | No individual story card; chooser lists are form options |

| `/explore/questions`, Search Questions, `/opportunities`, Home TopQuestionsSection | QuestionCard / opportunity records | Short answers are question answers, not Post shorts | Separate entity contracts |

| `/profile`, `/profile/edit`, `/settings`, `/help`, `/membership`, auth/onboarding/recovery routes | No individual article/short reading cards | No individual article/short reading cards | Not applicable; old profile writing/history URLs redirect to their owning routes |

## Reusable components actually in use

| Component | Source under `Frontend/src/` | Responsibility |

|---|---|---|

| DiscoveryPostCard | features/discovery/components/DiscoveryPostCard.jsx | Format dispatcher to independent ShortCard; owns article list/grid presentation and optional comfortable spacing |

| ShortCard | features/discovery/components/ShortCard.jsx | Independent short presentation; shared PostCardMenu and PostEngagementControls |

| ShortReadModal | features/discovery/components/ShortReadModal.jsx | Compact reader, series/deeper navigation, engagement, inline comments, modal focus |

| PostBody | features/post/pages/PostBody.jsx | Full/compact structured body renderer |

| AuthorMeta | shared/components/ui/AuthorMeta.jsx | Linked writer identity, date/read time; default/stacked/article variants |

| Avatar / ImageBox / Tag | shared/components/ui/ | Writer image/fallback, cover/fallback, topic links |

| PostEngagementControls | features/discovery/components/PostEngagementControls.tsx | Shared appreciation and comment-modal controls |

| AppreciationButton | features/post/components/AppreciationButton.tsx | Common heart/count/pending/pressed presentation |

| CommentsModal / CommentsSection / CommentItem / CommentActionDialog | features/post/components/ and features/post/pages/ | Shared comment reading, composition, thread and owner actions |

| ActionMenu / ActionMenuTrigger / ActionMenuItem | shared/components/ui/ActionMenu.tsx | Discovery article/short overflow presentation and keyboard behavior |

| ShareMenu | shared/components/ui/ShareMenu.tsx | Shared share modal and canonical links |

| ReportModal / ReportForm | shared/components/ui/ | Shared post/short reporting |

| AddToCollectionButton / AddToCollectionDialog | features/collection/components/ | Shared picked-story collection flow |

| ModalLayer / ModalHeader / ViewportPopover | shared/components/ui/ | Shared overlay shells, headings, placement |

| PageFrame / PageHeader / SectionHeading / Skeleton variants | shared/components/layout/ and shared/components/ui/ | Outer page alignment, headings and loading patterns |

ArticleCard, FeaturedCard, CompactCard and HorizontalCard under `features/post/components/` are exported by their barrel but have no consumers in `Frontend/src`. They are legacy candidates, not the active aligned card system. ArticleCard/FeaturedCard/HorizontalCard keep local-only save state; CompactCard links writer actions to bare `/author`. Do not reactivate them without bringing their contracts into alignment. Removing or replacing them is optional work, not part of this audit.

## Initial findings

1. **High: Writing studio shorts can throw during rendering.** `PostRows` passes the owner post response straight to ShortCard with only ID/image normalization. Backend `user.controller.js#getMyPosts` selects no author field. DiscoveryCard passes `post.author` to AuthorMeta; AuthorMeta immediately reads `author.username`. A returned short therefore supplies undefined. This is a source-confirmed incompatible contract, not a completed live-database reproduction. The owner identity must be supplied through an adapter, and shared metadata should tolerate absent identities.

2. **High: Published short responses to questions have the same failure.** `question.controller.js` populates relatedArticles with `author` as an unpopulated reference and returns the documents as responsePosts. QuestionDetail explicitly converts an author without username to undefined before passing ShortCard. The same AuthorMeta dereference fails. Populate/present the existing public writer identity and normalize the response; preserve current route/model.

3. **Medium: Shared interaction presentation does not guarantee shared state.** `postCache.js` does not include reading-history, early-access, short-series or competition roots, nor does its updater traverse responsePosts or nested competition entries. History, early-access and collection presenters omit viewerId; writer/competition summaries omit saved state, and competition summaries omit isLiked. Short cards on those surfaces can start with false selected state or keep stale counts after the reader confirms an action. Use viewer-aware existing presenters and extend updates to owning query shapes. Do not conflate story appreciation with competition votes.

4. **Medium: History nests writer profile anchors inside the article anchor.** HistoryRow's outer Link contains AuthorMeta, which renders its own Link. This violates the separate identity/story-link rule and can produce invalid markup or ambiguous navigation. Retain progress layout while separating link targets.

5. **Medium: Several active article headlines bypass the display serif.** HistoryRow h2 (17 px), MemberHub early-access h2 (18 px), and CompetitionDetail entry h3 (17/18 px) inherit DM Sans. The reference requires editorial article titles in Libre Baskerville. WriterPostCard, discovery variants and winner/featured layouts already explicitly use the display font. Management/draft/analytics labels are a different context and are not classified as headline defects.

6. **Medium: Featured overflow is still independent.** ArticleDayMenu uses a text ellipsis, 208 px text-only ViewportPopover menu and its own keyboard handling, unlike the shared 256 px SVG/icon-led ActionMenu. It duplicates appreciation already present on the card and lacks Add to collection/Report. This is a reuse/action-availability difference; the featured cover/headline layout itself is explicitly documented and must be preserved.

7. **Medium: Some local reader cards omit the common story contract.** Question published-article responses show only a title; early-access articles omit reading-time metadata and linked writer identity; recent article winners show plain writer text. These are candidates for shared variants/adapters that retain their existing approved placement and competition/release context. WriterPostCard intentionally omits redundant writer identity on a writer page and already reuses Tag and PostEngagementControls; that is not automatically a defect.

8. **Medium: Shared body renderer contains raw light-theme styles.** PostBody's code background is `#f4f4f4` and divider uses `border-gray-300`. Both full articles and shorts inherit these exceptions. Dark-theme contrast requires browser verification; the raw-color deviation is confirmed from source.

9. **Low: Default metadata can render orphan separator dots.** AuthorMeta prints a dot after any date in its default variant even when readTime is missing, and another in nonstacked mode without checking available values. Sparse short payloads and history rows expose this. Article variant already guards the date/read-time separator.

10. **Low: Card contract and registry maturity remain incomplete.** Shared cards accept several DTO shapes through scattered adapters; absent author is not guarded, menu IDs use only post ID despite repeated Home/history appearances, and the registry calls active/legacy card families Candidate. Unique IDs and a normalized summary boundary are appropriate follow-up, without making every layout identical. Repeated-ID risk is source-observed; no assistive-technology failure was reproduced.

## Initial follow-up file scope

The initial audit changed no application files. Its proposed fixes involved AuthorMeta.jsx, Profile/index.jsx, QuestionDetail.jsx, Backend/controllers/question.controller.js, existing owner identity normalization and targeted regression coverage. Interaction fixes additionally touch postCache.js and the existing collection/event/post/writer/competition presenters and their consumers. History link separation touches ReadingHistory.jsx; headline corrections touch it, MemberHub.jsx and CompetitionDetail.jsx; body theme correction touches PostBody.jsx. Featured-menu reuse touches TrendingTab.jsx. These are separate from optional extraction of the existing page-local article layouts or removal of unused legacy components. Any proposal that changes an existing approved layout must first show its before/after impact under AGENTS.md.

## Initial audit verification

Source references, route registration, card imports, global CSS overrides and backend response projections were inspected on 2026-10-12. Global `data-button-style="action"` CSS makes engagement buttons borderless/transparent despite conflicting local utility classes; those local classes alone are not evidence of a visual mismatch.

Browser verification status is recorded in the progress tracker. Existing short-format coverage targets Home, Search, collections, canonical reading and progression, not the owner-post/question-response API gaps above. No live database, production, physical-device or assistive-technology verification is claimed. This audit does not certify every rendered pixel or repair any findings.

