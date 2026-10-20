# Write page improvement audit — 2026-10-12

## Caret placement beside empty rich-text hints — 2026-10-20

After deleting a following quote, an empty quote's CSS-generated placeholder could make the caret appear after “A thought worth quoting…”. Paragraph, heading, and quote hints now render beside their editable fields, keeping generated text out of the caret surface. Paragraph hints still appear only on focus; heading and quote hints retain their existing empty-field visibility and typography. Code and image URL remain native textarea placeholders. Focused mocked-API Chrome checks passed at 320 and 1280 px for delete focus and caret placement across all seven field types, plus the slash hint; the empty quote screenshot was reviewed. Frontend lint and production build passed.

## Focus after block deletion — 2026-10-20

Deleting a block now focuses the preceding block with the caret at its end. Deleting the first block focuses the next block at its start; replacing the only block focuses the replacement. The writing-history hook recorded the intended destination but did not apply focus after an ordinary deletion, leaving focus on the removed button. Block content, deletion rules, history, autosave, and APIs remain unchanged. Focused mocked-API Chrome checks passed at 320 and 1280 px; frontend lint and production build passed.

## Empty final-block slash hint — 2026-10-20

An empty rich-text block can contain a browser-created `<br>` or whitespace, which prevented the `:empty` selector from showing its focused “Press / for formatting options” hint. The first correction based on a CSS pseudo-element still failed to paint the hint in a whitespace-only final block. The paragraph hint now renders as a separate visual element beside the rich-text field while the field has focus and no visible text. Slash-menu choices and storage are unchanged. Four focused mocked-API Chrome checks at 320 and 1280 px passed, including visible screenshots after Enter and `/` menu opening; frontend lint and production build passed.

## Rich-text arrow navigation repair — 2026-10-20

Arrow Up and Arrow Down in paragraph, heading, and quote fields now compare the caret with the first or last text position's visual line. This restores movement into adjacent blocks at line boundaries while retaining native movement through lines inside a block. Arrow Up places the caret at the previous block's end; Arrow Down places it at the next block's start. The rich-text field, block structure, styles, draft data, and APIs are unchanged. Focused mocked-API Chrome checks passed at 320 and 1280 px; frontend lint and production build passed.

## Phone editor command strip — 2026-10-20

Below 768 px, the existing visual-viewport strip places icon-only Undo, Redo, Bold, and Italic before the block-type choices. All icons use the same text color, including disabled actions; the strip uses curved history arrows, B and italic lowercase i, P for paragraph, the existing heading/quote/code symbols, and a monochrome image symbol. Accessible names and disabled states remain. Title focus exposes Undo/Redo; story-block focus also exposes block types. Bold/Italic enable only for a selected range in a format-capable block, including native touch selections. The separate floating selection toolbar appears only from 768 px. While the strip is open, the footer gains 64 px of bottom margin so the word count can scroll above the strip and mobile navigation. The desktop shortcut hint, keyboard shortcuts, history, block conversion, draft autosave, publication payloads, APIs, and schemas keep their existing behavior. Focused verification is recorded in the progress tracker.

## Responsive editor follow-up — 2026-10-20

At narrow phone widths, the editor heading and status use a full row and Instructions/Publish move beneath them, so words no longer break inside the header. The selected-text toolbar opens beneath an early text selection when placing it above would cover the Story label. The writing footer no longer reserves 24 px of internal bottom padding; the PageFrame uses 4 px of bottom padding so the word count sits closer to the mobile navigation or frame edge. The Short publishing dialog says Publish short or Update short. These are editor-only layout and copy changes; draft/publication data, routes, APIs, and schemas are unchanged. Focused browser verification is recorded in the progress tracker.

## Visible inline emphasis — 2026-10-20

Paragraph, heading, and quote blocks now show Bold and Italic in their editable fields while retaining the existing marker strings in draft and publication payloads. The selection toolbar and Ctrl/Cmd+B/I use visible text offsets; combined emphasis uses `***text***` and renders in the published reader. The title, code, and image URL remain textareas. Existing page structure, typography, colors, block types, autosave routes, revision checks, schemas, and stored records remain unchanged. Editor focus, split/merge, paste, history, slash conversion, and phone block choices were adapted to the rich fields. The former textarea-only behavior described in the 2026-10-17 entry below is superseded. Focused verification and limitations are dated in the progress tracker.

## Writing history — 2026-10-19

The desktop footer shows a muted, lowercase italic “(ctrl+z to undo, ctrl+y to redo)” hint with slight letter spacing immediately left of the word count at 768 px and wider. It supersedes the earlier two-row, left-aligned one-line, and separator versions. The former phone-only footer buttons moved into the command strip in the 2026-10-20 follow-up above; the earlier 24 px footer spacing was removed in the responsive follow-up below. History logic, keyboard commands, autosave, routes, APIs, and schemas remain unchanged.

The current editor already held title and blocks in local React state, with per-block insertion, deletion, split, merge, type, formatting, and clipboard handlers. Drafts autosave through the existing versioned API; published-post edits keep their existing local working copy. The additive `useWritingHistory` hook now owns a bounded, in-memory title/block history, and the editor routes writing mutations through it. A split is one transaction; consecutive typing in one field is grouped; Ctrl/Cmd shortcuts operate across fields and structural edits. The phone strip contains Undo/Redo below 768 px; a shortcut hint takes their place beside the count at wider widths. Hydrating a draft or post establishes a fresh baseline; undoing saved writing follows the existing autosave path. Tags, cover, scheduling, other editor controls, routes, APIs, schemas, typography, colors, and existing working-tree changes are preserved. No optional refactor or approval decision remains.

Changed `Frontend/src/features/editor/pages/index.jsx`, new `Frontend/src/features/editor/hooks/useWritingHistory.js`, new `Frontend/tests/editor-history.spec.js`, Frontend README, UI rules, this audit, and the progress tracker. Focused Chrome verification and limitations are dated in the tracker.

## Phone block-type strip — 2026-10-18

The phone editor introduced a Block types strip while a story field has focus. Follow-up on 2026-10-19: all eligible slash-menu choices appeared directly in one horizontally scrollable row, without an expansion button or popup. The 2026-10-20 command-strip follow-up above added writing and formatting actions before those choices. Tapping a type converts the focused block without typing `/`; the current content and focus are retained. The strip follows the visual viewport above an open keyboard, or sits above the bottom navigation when the keyboard is closed. The existing + insertion sheet, desktop slash menu, block storage, autosave, routes, and backend APIs remain unchanged. Verification on 2026-10-19: frontend lint and build passed; one focused mocked-API Chrome check at 375 px passed for direct choices, horizontal overflow, conversion, focus, and lower-viewport placement. A physical phone keyboard was not exercised.

## Tablet insert menu — 2026-10-19

The + insert control now uses the existing anchored SlashMenu at 768 px and wider; the existing bottom sheet remains below 768 px. The 24 px editor side gutters still apply below 1024 px. The same BLOCK_TYPES choices and insert action are reused, with no change to block storage, drafts, publication, routes, or backend APIs. Focused breakpoint verification is recorded in the progress tracker.

## Phone insert sheet backdrop dismissal — 2026-10-19

The phone insert sheet now closes when a pointer presses its exposed backdrop. In Chrome, the backdrop sent pointerdown but not the mouse event used by the shared modal dismissal path, leaving the sheet open. The editor sheet handles backdrop pointerdown locally; option presses, Close, Escape, insertion, and the anchored tablet menu remain unchanged. Focused phone, touch-emulated phone, and tablet dismissal checks passed; the existing short-viewport sheet check also passed. The progress tracker records build and lint verification.

Follow-up on 2026-10-19: a physical-phone report showed that relying on the native dialog backdrop still did not close the sheet. The phone sheet now places a transparent button behind its panel, inside the dialog, so outside taps land on a real element with a direct click handler. The earlier pointer handler remains as fallback. Chrome touch-emulated taps above the panel at 375 px and beside its 480 px capped panel at 600 px hit this control and close the sheet with focus returned to +. Native phone behavior still needs confirmation on the reporting device.

## Selected-text formatting — 2026-10-17

Story-block text selection now opens a Bold/Italic toolbar above the selected range. Ctrl/Cmd+B and Ctrl/Cmd+I use the same actions. Formatting is stored as lightweight markers in the existing block content string and rendered as escaped React strong/emphasis nodes in published text, heading, and quote blocks. Code/image/divider blocks do not offer inline formatting. Existing draft/post JSON storage, APIs, schema, block insertion, and navigation are unchanged. The editor textarea shows the markers during composition; nested and overlapping inline styles are not supported by this first pass.

Follow-up: the toolbar now dismisses when the selection collapses or a pointer action moves outside the field and toolbar. Applying a format leaves the caret after the inserted markers, so the menu does not reopen over a stale selection.

## Code block editor and reader parity — 2026-10-17

Editable and published code blocks now share explicit monospace, 13 px text, 1.7 line height, 16 px inner padding, an 8 px radius, and the existing themed subtle surface/text colors. The editor's general 12 px textarea inset no longer overrides code padding. Block data, wrapping/scroll behavior, surrounding layout, routes, APIs, and stored data remain unchanged.

## Stale saved-edit cleanup — 2026-10-17

Reopening a published post edit waits for a fresh post read before hydration. An unchanged editor no longer writes a local working copy, and a stored copy whose fields already match the published post is discarded even if its saved revision is older. This prevents a false conflict message after a completed Update while retaining genuinely unsaved edits and the backend revision conflict check. The existing local working-copy key and Update request are unchanged.

## Quote border theme color — 2026-10-17

The editable quote block now uses the existing secondary text token for its left border, replacing a fixed near-black color that disappeared in Dark mode. Quote typography, spacing, content, slash conversion, published rendering, routes, APIs, and stored data remain unchanged. The editor overlay spec checks the computed Dark-mode border color.

## Slash menu Tab selection — 2026-10-17

Tab now selects the highlighted slash-menu block type just like Enter, keeping focus in the converted block. When a filter has no matches, Tab closes the menu and keeps normal keyboard navigation. The change is confined to the existing SlashMenu keyboard handler and focused editor coverage; block content cleanup, pointer selection, Escape, layout, APIs, and stored data are unchanged.

## Recoverable published-post edits — 2026-10-17

Editing a published post or short now saves title, blocks, tags, release time, and the fetched revision to browser storage scoped to the signed-in writer and post. Refresh restores that working copy; only Update sends the revision-checked PUT to the published post. Successful Update clears the local copy. If the post revision changed elsewhere, the saved writing remains visible and the old expected revision preserves the backend conflict check. Drafts for new writing continue using the existing server autosave API. This supersedes the prior note below that published-post editing had no autosave. No backend route, API, schema, or stored post change is involved.

## Published short update revision — 2026-10-17

The editor now treats `?edit=` as an existing-post edit even if a stale `?draft=` parameter is present. Published-post editing no longer runs draft autosave, and Update remains disabled until the fetched post revision is loaded. This prevents an empty `expectedRevision` update request while preserving the backend's revision conflict check. Post and draft routes, API shapes, schemas, and stored data remain unchanged. A focused mocked-API browser check covers a short edit with both URL parameters and confirms the revision-bearing PUT without draft requests.

## Slash conversion and code block editing — 2026-10-17

The desktop slash menu now removes the typed command at the caret when converting a block, including commands placed between existing words. The surrounding writing is preserved. Code block editing uses the existing theme surface and text tokens, so its field remains legible in Dark mode. The change is confined to the editor block UI and a focused browser spec; draft/post routes, APIs, block schema, autosave, typography, and other block styles remain unchanged.

## Lazy draft creation from Writing studio — 2026-10-14

The Post/Short chooser no longer creates an empty server draft. It opens the existing `?new=` editor route, whose autosave guard creates the draft after the first non-whitespace title or block character. Existing draft reopening and publication behavior remain unchanged.

## Empty draft autosave guard — 2026-10-14

Direct editor autosave now skips empty drafts when both the title and all block content are blank. The first non-whitespace character enables the existing autosave flow. Existing draft records are not overwritten when a user clears the editor; draft creation, update payloads, and publication remain unchanged.

## Published draft history — 2026-10-14

After successful publication, the draft is deleted as before, but the editor now replaces the draft URL with the published post URL in browser history. Back therefore cannot reopen the deleted draft and show the draft-load error. Publication payloads, deletion behavior, and post routes remain unchanged.

## Publish modal hierarchy — 2026-10-14

The publish modal now presents Publishing options as a secondary section label, uses the concise None value for an unlinked short, and places selected tags below the tag search controls. Existing modal behavior, tag selection, APIs, and publication payloads remain unchanged.

## Arrow navigation within blocks — 2026-10-14

Arrow Up and Arrow Down now retain native textarea movement through each visual line in a block. The editor measures the caret's visual line before the key action and crosses immediately when it is already on the first or last line, avoiding an extra endpoint step. Block creation, deletion, autosave, publication, and stored content remain unchanged.

## Word-count bottom spacing at wider widths — 2026-10-14

The earlier phone fix left the shared PageFrame's 96 px bottom padding and the word-count row's 24 px bottom margin in place from 768 px upward. That change used 8 px of frame bottom padding and no extra counter margin; the later responsive follow-up above reduced the editor frame inset to 4 px and the command strip adds temporary scroll clearance below 768 px. The shared PageFrame defaults, other pages, editor controls, data flow, and APIs remain unchanged. Responsive verification is recorded in the progress tracker.

## Blank-space writing focus — 2026-10-14

The existing writing area now shows the text cursor over blank space. Clicking there focuses the nearest editable title or story textarea by vertical position. Direct input clicks and block buttons retain their own behavior. This is confined to the editor page; draft autosave, publication, APIs, and stored blocks are unchanged. A focused browser check covers blank-space and direct-field clicks.

## Desktop and hover block controls — 2026-10-14

Audit: the editor already has active-block +/× controls, a compact insertion sheet, and a desktop anchored insert menu. A responsive class hid the controls at 1024 px and above. The editor now exposes them at all widths, retains right text padding beside the delete target, and shows the controls plus a left line when a row is hovered on pointer devices. The control layer remains transparent to clicks on the text field. Backend routes, block storage, autosave, and publication remain unchanged. Focused browser verification is recorded in the progress tracker.

## Story row click recovery — 2026-10-14

Audit: compact +/× controls sat in an absolute layer across the first Story line. When the row remained active after focus moved elsewhere, the transparent layer intercepted a click back into its textarea. The layer now passes pointer events through; only the visible buttons accept clicks. The editor's block state, autosave, and backend contracts are unchanged. Focused browser results are recorded in the progress tracker.

## Editor heading label — 2026-10-14

Audit: the editor has a local title header, while shared PageHeader and nearby pages already establish the small uppercase accent eyebrow. The editor now shows “Editing” above Write Post/Write Short and Edit Post/Edit Short using that convention. Routes, APIs, data, controls, and publication behavior are unchanged. Verification is recorded in the progress tracker.

## Instructions button shape — 2026-10-14

The existing Instructions button now uses a pill radius. Its label, 44 px height, placement, modal, and behavior remain the same. No backend or data change is involved; verification is recorded in the progress tracker.

## Focused slash hint — 2026-10-14

Audit: the slash hint is the existing placeholder of editor text blocks; browser focus already identifies the current block. The editor now marks paragraph fields for focus-only placeholder styling, so the hint appears only in the empty paragraph being edited. Other block placeholders, controls, data, and APIs remain unchanged. Verification is recorded in the progress tracker.

## Mobile word-count spacing — 2026-10-14

Audit: the shared PageFrame added 96 px bottom padding while AppLayout already reserved space for the fixed mobile navigation. The editor's word-count row added another 24 px margin. The initial fix used 8 px PageFrame bottom padding and no counter margin below 768 px, leaving a small visible gap above navigation when scrolled to the bottom. The wider-width follow-up above extends that spacing to all widths. This changes no backend, draft, or publication behavior; browser verification is recorded in the progress tracker.

## Compact block-control placement — 2026-10-14

Audit: the editor already owns compact +/× block controls, the writing section gutter, and the native insertion sheet. The requested placement changes only editor layout and copy. Backend routes, autosave, publication, and stored blocks remain unchanged. The compact writing column now uses 24 px side gutters, with + left and × right of the active block, aligned to its first line. The existing 44 px targets remain. Responsive browser geometry is covered by the editor layout spec; results are in the progress tracker.

## Writing instructions copy — 2026-10-14

The editor's existing instructions modal opens from a text-labelled Instructions button. Its guide is a six-point list covering title/story, slash choices, phone/tablet block controls, undo/redo keyboard commands, autosave, and publishing. The modal shell, focus behavior, writing flow, and backend contracts remain unchanged. Verification is recorded in the progress tracker.

## Publish modal and writing alignment — 2026-10-13

Follow-up on 2026-10-13: Header Publish/Update is disabled until title and story content are present; divider-only blocks do not satisfy story content. The header and modal action provide specific disabled reasons. An application-level DisabledButtonTooltip supplies hover feedback for disabled shared and native buttons; the editor browser spec covers its shared/native behavior. Source changes are the editor page, new shared tooltip, application root, and focused tests; current verification is recorded in the progress tracker.

Audit: the current editor used the shared PageFrame, Button, TagPicker, Select, ModalLayer, ModalHeader, and dialog-focus hook. Its inline Publishing details held article cover, tags, optional short depth, and eligible release time above the title. A 96 px desktop left inset plus 12 px textarea padding shifted title and body text. Existing draft autosave and post create/update APIs already hold the needed data; no backend or stored-data change is needed.

The header Publish/Update action opens a native modal with the existing controls and final validation. Failed submission remains in the modal for retry; dismissal restores the header trigger. Guest Publish still opens sign-in. The 2026-10-13 refinements below supersede the original flush-padding, desktop block-action, and phone toolbar descriptions. The initial modal change passed 23 focused mocked-API Chrome checks across 320–2560 px; live persistence and physical devices were not verified.

## Editor interaction refinements — 2026-10-13

Audit: the existing editor, TagPicker, shared BackButton, MobileBlockMenu, Select, ModalLayer/Header, autosave, and `/api/drafts`, `/api/post`, and depth-option flows already support the requested behavior. The remaining defects were left-edge text clearance, redundant block and hint controls, unclear optional depth selection, selected-tag presentation, and loaded textarea height. Only editor UI, tag presentation, CSS, focused browser specs, and documentation need changes; backend routes, schemas, typography, palette, and publication rules remain as built.

The editor uses a 12 px text inset, autogrows loaded title and story fields, shows Back plus Write Post/Short or Edit Post/Short, and places an instructions dialog trigger immediately before Publish. Phones and tablets (<1024 px) show active-block + on the left and × on the right with the existing insertion sheet; desktop uses the slash menu without those buttons. The paragraph placeholder explains the slash shortcut and the bottom hint is gone. The publishing modal groups selected tags, removes redundant readiness prose, and offers an explicit None value for the optional full-post link. Existing autosave, cover upload, publication validation, and API payloads remain. Focused browser tests were updated; verification is recorded in the progress tracker.

## Unified Writing studio — 2026-10-13

Before: `/write` showed a second saved-draft list with Write new, while `/writing` held the owner Stories, Shorts, Drafts, and Analytics tabs. Draft continuation and deletion sat below the title/details on narrow screens. The frontend used the existing authenticated `/api/drafts` endpoints, post editor, publication API, and owner-scoped draft deletion; no backend or schema change was needed.

After: `/studio` is the single signed-in management page. Its Write a post button opens the existing Post/Short chooser, which creates a typed draft and opens `/studio?draft=<id>`. The same editor handles `?draft=`, `?edit=`, `?question=`, and direct guest `?new=` composition. The separate Write navigation entry and draft-list page were removed; the desktop sidebar and signed-in mobile Account sheet link to Writing studio. Old `/write` and `/writing` URLs redirect to `/studio` while preserving query and hash. Draft rows now place 44 px icon-only Continue writing and Delete draft actions to the right of the title and saved details at every width, with accessible names and the existing deletion confirmation/focus behavior. Existing typography, palette, tabs, filters, post/draft APIs, stored data, and publication logic remain.

Changed source: `Frontend/src/App.jsx`, `app/pages/HelpPage.tsx`, `features/editor/components/FormatChooser.tsx` (replaces `WriteDrafts.tsx`), `features/editor/components/DeleteDraftButton.tsx`, `features/editor/pages/index.jsx`, `features/question/components/QuestionResponseModal.jsx`, `features/question/pages/OpportunitiesPage.jsx`, `features/user/components/MobileProfileSheet.tsx`, `features/user/components/WritingPostMenu.jsx`, `features/user/pages/Profile/index.jsx`, `shared/components/layout/Navbar.jsx`, and `shared/components/layout/Sidebar.jsx`. Changed browser specs: `accessibility-audit`, `account-groups`, `add-to-collection`, `back-navigation`, `critical-flow`, `dropdown-alignment`, `editor-layout`, `editor-overlay`, `editor-tags`, `mobile-navigation`, `mobile-profile-sheet`, `opportunities`, `page-alignment`, `post-components`, `profile-settings-auth`, `question-card-layout`, and `write-drafts` under `Frontend/tests/`. Changed documentation: `Frontend/README.md`, `context/ui-rules.md`, `context/ui-registry.md`, `context/project-overview.md`, this audit, and `context/progress-tracker.md`. Frontend lint and production build passed on 2026-10-13; all browser specs parsed with Playwright. Browser execution was blocked by local sandbox loopback denial (`ERR_NETWORK_ACCESS_DENIED`); an earlier configured run could not connect to MongoDB. Physical layout and focus behavior remain browser-unverified. No optional refactor or approval decision remains.

## Draft deletion — 2026-10-12

Audit: WriteDrafts and Writing studio draft rows already use saved title/type/time metadata and continuation links. Existing DM Sans/Libre Baskerville, semantic themes, Button danger/action appearances, ModalLayer, ModalHeader, and dialog focus support an additive sibling Delete draft action. The existing draft API helper and authenticated owner-scoped DELETE `/api/drafts/:draftId` remove only the selected owned Draft record; no backend, service, schema, route, or persistence replacement is required.

Added shared DeleteDraftButton to both lists. It confirms permanent deletion, retains failed requests for retry, blocks dismissal/repeated writes while pending, updates/refetches the shared list, clears the exact editor record cache, and restores focus after a removed row. Current behavior belongs to UI rules. Existing row typography/palette/dividers, continuation destinations, composition/autosave, chooser, navigation, APIs and stored models are preserved. The row wrapper makes the button a sibling of the existing link, avoiding nested interactive elements. No optional refactor or approval-dependent decision remains.

Changed source: `Frontend/src/features/editor/components/DeleteDraftButton.tsx`, `WriteDrafts.tsx`, and `Frontend/src/features/user/pages/Profile/index.jsx`. Checks: `Frontend/tests/write-drafts.spec.js`. Documentation: Frontend README, UI rules/registry, this audit, and progress tracker. Dated verification and limitations are recorded in the tracker.

## Draft list and typed composition — 2026-10-12

Completed the user's explicit approval to create this flow. This section supersedes the earlier format-toggle/Add content layout below; UI rules owns the current editor behavior.

Audit: the existing AppLayout/1120 px PageFrame, Libre Baskerville titles, DM Sans controls, semantic themes, shared Button, ModalLayer, ModalHeader, ViewportPopover, and SlashMenu support the requested change. Authenticated `/api/drafts` already lists/creates/reads/updates/deletes owner-scoped, versioned drafts. Existing multipart post creation and revision-checked updates remain the publication paths. No backend, schema, route, or API replacement is required.

| Before | Completed requested change |
|---|---|
| `/write` immediately opens composition | Saved draft list with top-right Write new and Post/Short chooser; selection immediately creates a typed draft for authenticated writers |
| Inline format toggle and combined details panel | Fixed draft type; Post stacks full-width cover placeholder, tags, title, body; Short uses the same column without a cover |
| Add content alongside per-block controls | Add content removed; desktop plus/cross appear on hover or keyboard focus and plus opens existing block choices |
| Phone gutter actions | Active-block toolbar with insertion/type choices in a scrolling bottom sheet |

Guest composition remains local until authentication; saved draft/edit targets remain private. Direct `?new=article`, `?new=short`, saved draft/edit, and question-response targets remain available. Failed list/create operations expose retry; pending creation prevents duplicate clicks and dismissal. Draft re-entry fetches the current server record before hydration to prevent stale cached content. Existing tags, release/depth settings, autosave/version conflicts, publish validation, question linkage, theme, typography, navigation, and unrelated pages remain intact. This task contains no optional refactor.

Changed files for this follow-up:

- Source: `Frontend/src/features/editor/pages/index.jsx`, `Frontend/src/features/editor/components/WriteDrafts.tsx`, `Frontend/src/features/editor/components/MobileBlockMenu.tsx`, `Frontend/src/styles/global.css`.
- Checks: `Frontend/tests/write-drafts.spec.js`, `Frontend/tests/editor-layout.spec.js`, `Frontend/tests/editor-overlay.spec.js`, `Frontend/tests/editor-tags.spec.js`, `Frontend/tests/critical-flow.spec.js`.
- Documentation: `Frontend/README.md`, `context/ui-rules.md`, `context/ui-registry.md`, `context/project-overview.md`, this audit, `context/progress-tracker.md`.

Limitations: existing draft storage has no cover field. A newly chosen cover stays in the current editor until publication; Drafts navigation is disabled while that cover is present, with explanatory text. Guest drafts remain in memory. Browser verification uses mocked APIs, without live persistence/providers, physical devices, assistive technology, or other browser engines. No approval decisions remain.

Verification on 2026-10-12: 27 distinct mocked-API Chrome checks passed across editor layout, draft list/creation/reopening, guest authentication, tags, overlay menus, desktop keyboard controls, and short-screen phone-sheet behavior. Frontend lint, production build, security artifacts (79 files, no source maps), and scoped whitespace validation passed. Reviewed phone list, desktop Dark chooser, phone bottom sheet, and phone/desktop editor previews. The updated live critical-flow spec was not run. Initial environment/test failures and the corrected stale-cache defect are recorded in the progress tracker.

## Earlier editor/tag improvements — 2026-10-12

Status: the user approved this approach on 2026-10-12. The bounded editor changes and additive tag-choice endpoint are implemented; verification is recorded below.

## Before the change

`/write` renders WritePage/MemberEditor inside AppLayout and the shared 1120 px PageFrame. The compact serif header groups autosave status with the shared Publish/Update Button. DM Sans controls, Libre Baskerville titles, semantic Light/Dark colors, rounded details surfaces, and left-edge writing focus markers follow existing conventions.

Before this change, the order was header, format selector, collapsed Story details, title, and body. Story details contains cover upload/removal, free-text tags with Add, optional short depth links, and eligible release settings. Tags have no existing-choice dropdown. Writing reserves a 96 px left gutter for paragraph add/delete controls; desktop controls appear on hover/focus. The slash listbox exposes headings, quote, code, image URL, and divider. Pointer Add inserts only a paragraph; other block types require discovering the slash shortcut. The editor page defines the active Block component locally; the separate components/Block.jsx is not its current renderer.

Guests compose locally and Publish opens the shared sign-in modal. Authenticated editing hydrates drafts/posts through TanStack Query, autosaves after 1.5 seconds, and reports version conflicts. Existing validation, word counts, cover previews, image descriptions, keyboard block actions, and source-question linkage are present.

## Existing backend and data flow

Draft API `/api/drafts` supports authenticated list/create and owner-scoped read/update/delete; version checks prevent stale writes. Draft stores structured body, title, format, string tags, release date, and relationship fields. Publishing uses authenticated multipart POST `/api/post/`; editing uses PUT `/api/post/:id` with revision checks. Post stores string tags plus canonical Topic references; creation matches tag slugs/aliases to active topics, uploads article covers, and records immutable revisions. Arbitrary new tags already work without creating taxonomy records.

Topic owns active/retired canonical choices. Onboarding reads them through an authenticated endpoint that also returns private account selections. Before this change, audited routes had no dedicated public editor tag-choice API. The completed bounded public read endpoint supplies active topic slugs and existing tags from publicly released posts, excluding drafts, unpublished posts, and future releases. Creating a custom tag continues through existing draft/post writes and does not create a canonical Topic.

## Approved before/after impact

| Before | Completed |
|---|---|
| Cover and tags hidden in collapsed Story details | Cover and tags immediately visible in a compact section before title/body; optional depth/release settings retain a separate disclosure |
| Format in a detached panel | Group format selection with the compact writing header and preserve responsive wrapping |
| Desktop insertion relies on hover or slash discovery | Visible Add content control opens the existing block-choice menu; retain per-block add/delete and slash shortcuts |
| 96 px writing gutter at every size | Compact phone gutter, shared title/body alignment, existing desktop gutter |
| Type a tag and click Add | Searchable dropdown with existing choices, selected removable chips, and explicit Add new tag action; case-normalized duplicate protection |
| General prerequisite sentence | Visible readiness feedback near Publish naming remaining requirements, without adding a publication step |

The implementation reuses Button, PageFrame, ViewportPopover, and SlashMenu. The searchable multi-tag picker remains editor-local because shared Select is a single-choice control. Failed choice loading exposes retry and keeps custom-tag entry available. Existing tags remain supported, including saved draft/post tags absent from suggestions.

## Changed files

Implementation:
- `Frontend/src/features/editor/pages/index.jsx`
- New `Frontend/src/features/editor/components/TagPicker.tsx`
- New `Frontend/src/features/editor/api/fetchTagOptions.ts`
- `Frontend/src/features/editor/components/SlashMenu.jsx` (44 px choice targets)
- New `Backend/controllers/tag-options.controller.js`
- `Backend/routes/v1.routes.js` (add public GET `/tags`)

Verification:
- `Frontend/tests/editor-layout.spec.js`
- `Frontend/tests/critical-flow.spec.js` (visible-tag workflow selectors)
- New `Frontend/tests/editor-tags.spec.js`
- `Backend/tests/foundation-contracts.test.js`
- `Backend/tests/integration.test.js`

Documentation: this audit, `context/ui-rules.md`, `context/ui-registry.md`, `context/architecture.md`, `context/progress-tracker.md`, and `Frontend/README.md`. Existing `editor-overlay.spec.js` is reused without modification.

Preserved fonts, palette, shared frame, global navigation, other pages, stored schemas, existing routes/contracts, autosave/versioning, revision history, guest sign-in behavior, upload handling, scheduling entitlements, and formatting shortcuts. Unrelated working-tree changes are preserved. No architecture migration, file rename, dependency, schema replacement, optional redesign, or broad refactor is included. No approval decisions remain.

## Completed behavior

Cover/tags are visible with desktop side-by-side fields and phone stacking. Format joins the header; Publish stays on its right and wraps appropriately on phones. Readiness feedback names remaining requirements. The title/body gutter shrinks to 48 px on phones while retaining desktop alignment; block controls remain visible. Add content opens existing block choices and focuses the inserted block, reusing a trailing empty paragraph when available.

TagPicker supports existing choices and explicit new tags, removable chips, case-normalized deduplication, comma rejection, a 60-character custom-entry bound, and the existing draft/update 20-tag limit. A saved tag need not appear in suggestions to remain selected/removable. The dropdown debounces reads, supports keyboard/pointer choices and reopening, and isolates late responses by query. Failed reads expose keyboard-reachable retry without blocking custom tags. Guest composition remains local until explicit sign-in; public suggestions make no private draft or entitlement reads.

The public endpoint returns at most 50 choices from active topics and released-post tags, using literal escaped search text of at most 60 characters, deduplication, and metadata-only projection. Unpublished/future posts and private drafts are excluded. Adding custom tags uses existing publishing/autosave string fields and creates no taxonomy record.

## Verification

On 2026-10-12, all 102 backend contracts, frontend/backend lint, production build, artifact validation (79 files without source maps), and scoped whitespace checks passed. All 19 distinct mocked-API Chrome checks completed across the full 18-case editor run and the final three-case tag run. Phone Light and desktop Dark screenshots were visually reviewed. Initial localhost connection failures preceded the completed runs; the added twenty-tag fixture initially lacked the existing navbar notification metadata and passed after that fixture was corrected. No production recovery behavior was changed for that fixture failure. The focused suites cover phone/desktop Light/Dark, 320–2560 px layout, keyboard dropdown/block insertion, custom-tag creation/removal/duplicates, lookup failure/retry, autosave payloads/conflicts, guest state retention through sign-in, publication failure retention, cover requirements, scheduling, and existing slash-menu navigation/scroll stability. Live database/provider persistence, physical devices, assistive technology, other engines, and tag aggregation performance at production scale remain outside mocked browser/contract checks. The critical-flow selectors and Mongo integration visibility case are updated but require their controlled live database environment.
# Editor block arrow navigation — 2026-10-20

The editor's existing Up/Down boundary handler now carries the caret's horizontal position into the adjacent rich-text block's nearest visible line, including lines created by wrapping. Code and image textareas retain the logical-line fallback. This changes only cross-block caret placement in `Frontend/src/features/editor/pages/index.jsx`; block structure, formatting, slash actions, autosave, APIs, schemas, layout, and styling are unchanged. `Frontend/tests/editor-layout.spec.js` covers middle-of-line travel and wrapped blocks. Focused lint and the frontend production build passed on 2026-10-20. The browser checks could not complete because the sandbox denied localhost access; a separate default run could not start its API server without MongoDB.

