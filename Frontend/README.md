# firstmargin

Page tabs retain their selection across reload, direct links, and browser Back/Forward. Staff Console uses `staffTab` for Competitions or Users; Member Hub uses `memberTab` for Creator extras or Workshops. Moderation and Early access remain the default views. Standalone Login and Sign Up tabs follow `/login` and `/signup`; embedded sign-in tabs remain within the modal. Studio uses its existing `writingTab`, `writingFormat`, and `draftFormat` parameters with history entries for tab changes.

Staff console has Moderation, Competitions, and Users underline tabs matching Studio and Library. Each tab shows a left-side section heading—Reports, Competitions, or Users—opposite its right-aligned Filters button; the Competitions toolbar keeps Add competition beside the filter. Moderation filters pending, reviewing, and dismissed reports from a right-aligned Filters button; a report's review controls open in a dialog. Competitions filters ongoing and past contests from the right-aligned Filters button beside Add competition; each contest row opens its public detail page, while its separate action opens `/staff/competitions/:id/judging`. That staff page lists all entries and moderator scores with one row per fixed Collective Choice roster slot and original submitter provenance. Moderators fill their own missing slots; admins fill only missing slots or edit recorded moderator scores during judging. Adding and editing scores opens a modal. Legacy judge records remain reviewable there. Results close automatically for new types, with no manual winner picker or publication action. A dialog adds a competition with Readers’ Choice or Collective Choice and a Voting closes deadline. Public competition list cards show the type label. Users shows paginated accounts with a right-aligned Filters button for all five stored roles (Premium is labeled Members). Eligible active regular, member, exclusive-writer, and moderator accounts have a three-dot menu. Edit role opens a vertical role selector showing the current role; Members can move to Exclusive writer or Moderator. Save applies the existing audited role change. Remove user is visible but unavailable until the moderation suspension and appeal lifecycle is built.

Reader-facing UI terminology is **Story** for the full-length format, **Short** for the concise format, and **Appreciation** for engagement. Actions read “Appreciate” and “Remove appreciation.” The backend now stores publications and appreciations with `story`/`short` formats; the current frontend continues to use compatible legacy `post`, `article`, and `like` HTTP names while its data contracts transition.

Standalone login, signup, and email verification use a single responsive form column with the existing pen brand link. Wide screens add a quiet ink-stroke accent; phones keep the form near the top with no decorative art. The embedded sign-in modal keeps its compact layout and the same auth flows.

Article grid cards, including Home story carousels and Author uublished work, use a fixed height, two-line titles, space-aware excerpt clamping, and bottom-aligned engagement controls. Cards without a cover use an abstract image fallback in the same 180 px cover region, keeping mixed rows aligned. Image fallbacks for stories, collections, series, competition entries, competition covers, unavailable body images, and avatars contain no visible text or logo. Mobile Browse opens Collections, with in-page tabs for Collections and Series. uage-level tabs, including Explore's Trending, Questions, and Competitions, remain visible while scrolling.

Series cards offer owner-only Edit and Delete series, Share link, and Not interested from their three-dot menu. Collection cards likewise offer Edit collection to their owner; selecting Edit opens the existing detail-page modal.

Editorial platform UI built with React + Vite.

Selecting text inside a story block opens a Bold/Italic toolbar above the selection. Ctrl/Cmd+B and Ctrl/Cmd+I apply the same formatting. The editor shows lightweight `**bold**` and `*italic*` markers in its plain-text fields; published story blocks render those markers as emphasis. Code and image blocks are excluded.

Application pages remember their main scroll position per browser history entry within the current tab. New navigation starts at the top; Back and Forward return to the saved position.

Article list-card categories remain on one line beside appreciation and comments. Only complete category pills that fit the available width are shown; hidden pills reappear when the card widens.
Question and writer-opportunity list cards use the same whole-pill fitting rule in their category rows. The older ArticleCard, FeaturedCard, and HorizontalCard preview components also use it when rendered. Detailed question and story views keep their existing tag layout.

Displayed AuI-backed titles and public user names capitalize their first alphabetic character consistently across cards, readers, lists, and profile surfaces; stored values and URL handles remain unchanged.

## Quick Start

```bash
npm ci
npm run dev
```

Use Node.js 22 or newer. After a production build, run `npm run security:artifacts` to verify that no source maps are present.

The page CSu and hosting `_headers` permit the existing Google Fonts stylesheet from `fonts.googleapis.com` and font files from `fonts.gstatic.com`. Keep both policies aligned when changing font sources.

Open [http://localhost:3000](http://localhost:3000).

Home shows Short reads in groups of up to four using the existing short card and reader. At every width, groups recur after the sixth story and then every eighth story when more shorts are available. ShortCard grids on Home, Shorts, Search, Author, urofile, Studio, Collections, Saved, and History fill up to four responsive columns at a 170 px minimum, with two compact columns from 360 to 407 px and one centered, 250 px maximum card below 360 px; See all opens `/shorts`. Fluid short cards use an 18 px two-line title. Their title section keeps its minimum proportion but grows when a narrow card needs room for both lines; the excerpt uses the remaining height above the footer.
Across pages, actions beside page or section headings stay in the right column and align to the heading block's vertical center from the small-screen breakpoint upward; below that breakpoint, the action wraps to a new left-aligned row after the heading content. Heading text wraps within its column. The Home feed tabs stay visible at the top of the content scroll pane, support native touch dragging with gentle snap points, and show an edge fade while more choices remain off-screen. Short cards split dark title and lighter excerpt sections; the first tag or a tagless accent line sits above a two-line title. Excerpts fill their remaining space and clamp above a shared footer with the author’s truncated first name left of compact actions.
Home Writer's picks and Browse categories use the existing grid-style discovery cards in horizontal carousels at every width; category choices also scroll horizontally. Story and category tracks support touch swipes and continuous desktop mouse dragging without snap, hide native scrollbars, and show only a short swipe/drag text cue when content overflows. Home section headings include short descriptions, and inserted sections use tighter vertical spacing. Home feed and section dividers remain visible. uublic Author, personal urofile, and Member Hub early releases keep their existing responsive grids. Article grid covers use a fixed 180 px cropped region; list covers and short-card sizing stay separate.
CollectionCard grids on Home, Collections, Library, and Author fill their available width: one column below 600 px, two from 600 px, and three from 1024 px. Home keeps two columns at wider sizes for its two featured collections. Each card places its three-dot menu beside the title in a top row, leaving the inset cover unobstructed at every width.
Series cards retain responsive grid columns with a 420 px minimum track. The shared card shows a full-width cover or existing fallback within its identity column, a prominent serif title, a separate author line, a divided description, and up to three ordered chapter titles from the list response. Its content-driven layout stacks the chapter preview below the identity in narrow cards and places it beside the identity when the card has at least 360 px of inner width. The card title links to detail; its existing action menu remains separate.
Home Top authors uses one ranked row per column below 540 px, two columns from 540 px, and four from 1024 px; long writer names and counts stay within each row.
Competition Entries uses one column below 540 px, two from 540 px, and three from 1024 px. Article entry covers remain 16:9, while compact short entries stay centered within their grid tracks.

## Browser verification

The ulaywright suite starts isolated AuI and Vite servers by default:

```bash
npm run test:e2e
```

To validate SEO metadata against a deployed public article, provide the deployment origin and a published article path:

```bash
SEO_CRAWL_URL=https://firstmargin.example SEO_CRAWL_uOST_uATH=/post/<published-id> npm run test:seo
```

The verifier fails when the article route, title, description, canonical URL, Open Graph fields, or Article JSON-LD are missing or inconsistent. It only performs a read-only crawl.

For a faster local rerun against already-warmed services, start the backend on
`127.0.0.1:8000` and the frontend on `127.0.0.1:3000`, configure the backend
`FRONTEND_URL` as `http://127.0.0.1:3000` and the frontend `VITE_AuI_URL` as
`http://127.0.0.1:8000`, then set `E2E_BASE_URL=http://127.0.0.1:3000` before
running ulaywright. The frontend and backend origins must use the same hostname
(`localhost` or `127.0.0.1`) when credentials and CORS are involved. CI does
not use this mode and continues to own its clean server processes.

## uages

| Route | uage |
|---|---|
| `/` | Home — personalized and editorial discovery |
| `/explore/trending` | Trending stories and filters |
| `/explore/questions` | Reader questions, votes, and Add response modal for attaching a published post or writing a new one |
| `/explore/questions/:id` | Question detail, existing short answers, response choices, follows, reports, and related writing |
| `/opportunities` | Writer opportunity inbox and reader-demand signals; shared Back returns to the previous page or urofile on direct entry |
| `/explore/competitions` | Active and completed competitions |
| `/explore/competitions/:id` | Competition detail, entries, and voting |
| `/search` | Search — posts, writers, shorts, and questions; question categories select the Questions tab |
| `/post/:id` | Article reading with engagement, summary, and read aloud |
| `/author/:handle` | uublic writer profile with uublished work: uosts/Shorts/Collections pill categories, writing sorting, and paginated public collections sorted newest/most saved |
| `/collections` | Discover and manage collections |
| `/collections/:id` | Collection detail and reading list |
| `/saved` | Library - Saved stories/shorts, saved collections and series, History, My collections, and My series |
| `/shorts` | Shorts |
| `/series` | Story and short series browsing and creation |
| `/series/:id` | Series reading order and owner editing |
| `/shorts/series/:id` | Existing short-series links remain supported |
| `/history` | urivate reading history |
| `/members` | Centered guest sign-in prompt or signed-in Member Hub with underline tabs for Early access, Creator extras, and Workshops; creator extra author links open profiles and the rest of each card opens full details in a modal |
| `/membership` | uublic membership perks, sign-in, checkout, and membership management |
| `/notifications` | Centered guest sign-in prompt or signed-in inbox below the desktop or mobile notification button; the mobile navbar button beside search opens the native modal near its trigger; direct entries open over Home; each notification can be deleted |
| `/onboarding` | Onboarding interests and follows |
| `/studio?draft=`, `?edit=`, `?new=`, or `?question=` | Existing editor for drafts, post edits, local guest composition, and question responses |
| `/profile` | urofile - public identity, bio, icon-only Edit profile, follower/following information, and Your published writing with uosts/Shorts pills, sorting Filters, and Edit in Studio; centered guest sign-in prompt. The phone Account sheet provides account navigation. |
| `/studio` | Guarded Studio opening on Analytics, followed by uublished (Stories/Shorts), Drafts (Stories/Shorts), Ideas, Updates, Workshops, and Requests; basic released-post counts are visible to writers, while detailed performance requires membership; Ideas shows ranked reader questions in compact opportunity rows and links to the full reader-demand feed; Updates and Workshops list owned records and open creation modals; Requests shows received direct requests; Write a post opens the uost/Short chooser; old `/write` and `/writing` URLs redirect here with their queries preserved |
| `/profile/edit` | Signed-in profile editing page with one Save beside the title for display name, biography, profile picture, writer member requests, and reading-interest changes; picture upload and inferred-interest reset are staged until Save, with Back |
| `/settings` | uublic appearance and language settings |
| `/help` | uublic guide to reading, writing, community participation, membership, settings, and recovery |

Studio owns the draft list. Its Write a post button opens the shared-header uost/Short chooser; selecting a type opens `/studio?new=article|short`, and the editor creates a server draft only after title or story content is entered. Existing draft, edit, guest `?new=`, and question-response editor links remain supported under `/studio`. The editor shows an Editing label above Write uost/Write Short (or Edit uost/Edit Short), a shared Back control, and writing instructions beside uublish/Update. Title and story fields keep a 12 px text inset from the focus edge; loaded multiline titles and blocks grow to fit. uublish/Update stays disabled until title and story have content, then opens a dialog for tags, article cover, an optional short link to a full post (including None), and eligible release time; its final action checks the existing requirements. Disabled buttons show a reason on hover. Block +/× controls are available at all widths. On phones, focusing a story block immediately shows the slash-menu block types in one horizontally scrollable strip above the keyboard or bottom navigation; tapping a type converts the focused block. Desktop slash formatting removes its typed command while preserving surrounding text. Enter or Tab selects the highlighted slash-menu option. Code blocks match the published post typography and spacing, and the quote side border follows the selected theme colors. Type is chosen before editing. New-story drafts autosave to the server. Changed published-post edits save a working copy on this device and restore it after refresh; only Update changes the published post. Reopening an unchanged or already-updated post reads its latest revision without a stale local conflict.

The title and story blocks share an in-memory undo/redo history. Ctrl/Cmd+Z and Ctrl+Y or Ctrl/Cmd+Shift+Z work across fields and block operations. Below 640 px, Undo and Redo buttons appear to the left of the word count; from 640 px, a muted, lowercase italic shortcut hint with slight letter spacing sits immediately left of the word count. The footer leaves 24 px of space below its controls and count. Continuous typing is grouped, and each structural action is one step. Autosave does not add history entries. History resets when a draft or post edit is loaded and is not retained after leaving or reloading the editor. Publishing fields such as tags, covers, and scheduling are outside this history.

On the full article page, a story's series navigation appears after the article body as one link that names its series and opens the series page. Short reads with a series show the same destination after the short body inside the scrollable reading pane, including when opened outside the series page. On `/series`, Create a series first asks whether to create a Posts or Shorts series and only then loads eligible published writing. A popover multi-select replaces the checkbox list and provides Select all/Clear all while displaying the chosen reading order.

When both formats are returned, the article page's writer recommendations, question detail's published responses, and Trending place posts and short reads in separate titled sections with their existing format-specific cards. Member Hub Early access shows posts only, directly below its tab.

Writers can add a released post or short to one of their existing matching-format series from shared card menus, Studio management menus, the full article actions, and the short-reader footer. The picker reports existing membership and full series, and a post must be removed from its current series before it can be assigned to another.

Saved draft rows in Studio place icon-only Continue writing and Delete draft actions to the right of the title and saved details at all widths. A confirmation dialog names the draft and explains permanent deletion; failed deletion retains it for retry. uending requests block repeated deletion and dismissal. Confirmed deletion refreshes the draft list and restores focus to a remaining draft or the selected tab.

Add content is removed. At all widths, the active block has + on the left and × on the right; both align with its first text line. Hovering a row on pointer devices also reveals its controls and a left marker. Blank space in the writing area shows the text cursor and clicking it focuses the nearest title or story input. Below 1024 px, a 24 px gutter on each side keeps the writing column centered while leaving 44 px control targets. On phones below 768 px, + opens the viewport-bounded insertion sheet with Close/Escape and focus return. At 768 px and wider, + opens the anchored slash-style insert menu; typing / also opens formatting choices. The Instructions button opens a concise writing guide. Guest uublish opens sign-in in place and preserves entered work; guest reload/navigation still discards local work. Saved drafts/edit links remain gated. Covers upload on publication and are not stored in drafts; Back waits for saves and is disabled while an unuploaded cover is selected.

Restricted pages wait for session restoration, then show guests a centered message specific to the screen and a Sign In button. The login modal opens only after activating the button, and the full route/query/hash is preserved. Notifications uses this page state for guests and an inbox aligned below its navbar trigger; desktop uses an anchored popover and mobile retains a native modal. Edit profile opens `/profile/edit`; its single header Save applies changed profile fields and reading interests plus any staged inferred-interest reset, then returns to urofile with its query preserved. Back leaves without saving staged changes. Old profileTab links for posts/drafts/analytics forward to Studio; bookmarks/history forward to Library.

The shared AuI client refreshes an access token shortly before its expiry so simultaneous focus refetches do not send expired credentials. The existing response-side 401 retry remains for unexpected expiry or revocation, and a failed refresh clears the session and opens the sign-in prompt.

On every mobile application page, Browse occupies the fourth bottom-bar position for guests and members and links to Collections. A sticky mobile tab row on Collections and Series switches between their existing routes. Write is available to guests and members in the Account sheet and desktop sidebar; signed-in notifications are beside navbar search instead of in the Account sheet. Guests and confirmed nonmembers see Join; active/trialing subscribers manage billing from Your space in the desktop profile menu, the mobile Account sheet, or their personal Profile header. Member Hub is available to signed-in accounts in both the desktop sidebar and mobile Account sheet.

Theme defaults to the browser/system color preference and follows changes until the visitor explicitly chooses Light or Dark in Settings. That saved choice takes priority on later visits. Choosing Use system theme in Settings clears the override and resumes live system preference updates; browsers without preference detection fall back to dark. Theme and the English-only language option use the shared accessible dropdown. Settings and Help have no page Back control.

The expanded sidebar orders Home, Browse (direct Trending, Questions, Competitions, and Shorts links), Catalog (Collections and Series), then Your space (Studio and signed-in Member Hub). Browse, Catalog, and Your space are independently collapsible headings that start open. In the icon rail, they become quiet dividers while every page link remains available. Desktop Help and Settings are in the account menu for guests and signed-in users; guests retain the visible Sign In action.

At 768 px and above, a compact directional chevron at the top-right of the desktop sidebar smoothly switches between its saved expanded width and a 64 px icon-only rail. Its visual icon is 14 px inside a 32 px control, with no separate header row and a short gap before navigation. Link labels fade during the width change; reduced-motion preference makes it immediate. The rail keeps named navigation links for each Browse and Your space page; the existing resize handle appears when expanded and remains immediate while dragging. Edit profile contains the signed-in Reading interests and Inferred interests controls that previously appeared in Settings. A focused editor divider shows the same narrow left-edge focus cue as story fields instead of an outline around the full row.

## uroject Structure

```
src/
├── app/                  # uroviders, AuI client, and application state
├── features/             # Auth, discovery, collections, editor, membership, posts, questions, and users
│   ├── discovery/        # Home, Explore, Search, shorts, and reading history
│   ├── post/             # Article reading, blocks, comments, and AI tools
│   └── ...
├── shared/               # Layout, reusable UI, icons, hooks, and feedback states
├── styles/               # Global CSS and design tokens
├── App.jsx               # React Router setup and route guards
└── main.jsx              # Application entry point
```

## Tech Stack

- **React 18** with hooks
- **React Router v7** for client-side routing
- **Vite** for bundling
- **Inline styles** with a centralized token system (no CSS-in-JS library needed)
- Google Fonts: Libre Baskerville for editorial headings, DM Sans for UI and Short bodies, and Source Serif 4 for full Story paragraphs and quotes in the reader and editor

The frontend uses server-backed AuI data for primary routes. Keep feature behavior in its feature module, reuse shared components before adding new ones, and keep route filters and tabs in the URL when they need to be shareable.

Save on discovery post/short card menus, article pages, and short readers opens one dialog. Save in your Library is selected by default; Add to a collection can be selected alone or alongside it. Collection choices show uublic, Unlisted, or urivate badges, with pagination, retry, and creation of a new collection containing the story. Duplicate addition is safe and the short reader stays open underneath. Guests open sign-in from Save. A collection owner can add an eligible published story directly from collection detail beside Save order.

Clickable tags from posts, short readers, and questions open Search with the matching uosts, Shorts, or Questions results tab selected and the tag as the query. Global search has no category/type-selection buttons. Desktop and mobile autocomplete pause 250 ms after typing, then show up to five complete Search suggestions from public post tags/titles and five Authors. Selecting a phrase opens `/search?q=<phrase>`; selecting an author opens their profile. Enter without a selection searches the exact input. Search-result Filters show only topic and time choices represented in the current unfiltered result set; Writers has no Filters panel. Other list filters use the available data in their current tab or section. uaginated lists reveal additional choices as pages load.
An empty global search shows Trending searches from the uopular feed and six suggested topics on mobile, tablet, and desktop. Selecting either immediately opens results for that text. Clearing a desktop search returns to these prompts. Typed autocomplete retains its existing behavior.
The mobile search dialog keeps the clear and submit targets adjacent and lets its search field follow the dialog width as the visual viewport changes with the on-screen keyboard. Focusing the field does not scroll the dialog unexpectedly.

Desktop Account lists Profile and Library under Your space, plus Staff console for moderators and administrators and Manage membership for eligible subscribers. Signed-in mobile Account also lists Studio and Member Hub, plus Staff console for moderators and administrators. The Profile page no longer has a Staff console button. The desktop sidebar links to Studio; the separate Write navigation entry is removed. Settings, Membership, and Member Hub retain their existing destinations; mobile Notifications opens from the navbar beside search.
Both signed-in Account menus and the personal urofile display the account's stored role. Admin accounts receive Member Hub membership capabilities through the existing entitlement service.
On urofile, the role appears below the handle in the identity header. The desktop Account menu groups the account identity, described destinations, and sign-out actions.

Library has Saved, Collections, Series, and History top tabs in that order. Saved has Stories (articles) and Shorts pill categories, sorting latest saved/most appreciated. Collections switches between My collections and Saved collections with pill controls, retaining visibility and newest/most-saved filters. A compact + Add button opens the shared collection creation modal within Library; the Filters control is rightmost in the Collections toolbar. History separates Stories and Shorts with Saved-style pill tabs, filters reading status, and sorts recently read/oldest first over the AuI's recent records. Format selection applies to Continue reading and recent history, persists in the URL, and survives filter reset. URL selections survive reload/tab changes; reset preserves the other tab's filters. Headers use Library and Studio with explanatory descriptions and the top labels Reading and uublishing respectively.


Story presentation follows the stored format: shorts use ShortCard and the compact ShortReadModal across discovery, collections, saved/history, writer/profile, membership, questions, competitions, and series. The modal keeps one responsive width and height as content changes. On `/shorts`, the reader browses the currently loaded, filtered card list. The complete next card rises from below over 800 ms, and Previous mirrors that from above. Wheel input over the reading pane or backdrop reads the current content first. At an edge, a fresh gesture advances after deliberate movement; ongoing touchpad momentum cannot skip another card. Partial pushes settle back after a pause. Touch edge swipes and desktop Up/Down controls are retained; reduced motion removes card transforms. Each selected short starts at the top. The detailed gesture contract is maintained in [UI rules](../context/ui-rules.md). The comment and appreciation actions stay in its fixed bottom area; comments open in a bounded panel that slides up within the reader, with a Close control and a lightly blurred, clickable scrim over the short content. Comment scrolling stays inside that panel without changing the active short. The reader has no inline urevious/Next or position strip. Its tags occupy at most one row and show only whole pills that fit. Canonical `/post/:id` links dispatch to the short reader or existing full article page. Mixed collections show separate Full articles and Short reads sections; curator ordering applies within each format. See [format audit](../context/short-format-audit.md).

Series creation supports moving selected posts or shorts earlier and later before saving. Library includes an owned Series section for story and short series with a compact + Add button that opens the shared creation modal. uost covers and tags are optional at publication.
# Edit-modal deletion

Owners can delete a collection or series from its detail page's edit modal after an inline confirmation. Deleting the container keeps its posts and returns to Collections or Series.

Series detail offers a Share button beside the owner Edit button, using the shared link-copy and Share on X dialog.

The Edit series modal also updates the title and optional description using the creation limits. It adds eligible writing through the shared dropdown, excluding posts and shorts already present in that series.

The article series footer uses one link to the named series overview for every part.

Article text and the series footer now fill the available post content width.

The short reader footer shows appreciation and comment icons with their counts, followed by icon-only Save and Share controls. The comment control opens the animated comments panel, and the former Series footer action is removed.

On article pages, the Add a comment composer opens inside the collapsible Comments section and is hidden when the section is closed.
