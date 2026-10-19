# Button style duplicates and reusable matches

Reviewed 2026-10-12 after the authorized contrast/sizing correction. This list covers application-owned controls, including intentional local families and inactive legacy code. Repeated runtime labels from a mapped declaration are grouped. Paths are relative to Frontend/src. A similar shape is not an exact component match; preserve local typography, shape, semantics and behavior until a specific migration is requested.

Named shared appearances now live in `shared/components/ui/buttonStyles.ts`: primary, secondary, ghost, action, menu, disclosure, danger, selector. Button, ButtonLink, IconButton and Pill consume them. Sizes sm/md have 44 px minimum targets with different padding/type; lg has a 48 px minimum. Dedicated Select, ModalHeader, BackButton, ShareMenu, ActionMenu and AppreciationButton remain reusable owners of their specific behaviors.

## Ordinary actions and navigation

| Button name(s) | Location(s) | Closest reusable component | Match / remaining duplicate |
|---|---|---|---|
| Try again | discovery/pages/Home/index.jsx; Search/index.jsx | Button primary | Near match: local 12 px semibold vs shared md 13 px medium; still local |
| Try again | discovery/pages/Home/HomeSections.jsx | Button secondary | Near match: local 12 px semibold outlined capsule; still local |
| Try again | Explore/TrendingTab.jsx; MobileSearchDialog.tsx | Button ghost | No exact underlined-retry style; ghost is the closest quiet-action owner |
| Sign In | shared/components/ui/SignInPrompt.tsx; user/components/MobileProfileSheet.tsx | Button primary / secondary respectively | Near match: filled centered guest prompt and outlined sheet action use local weight/padding |
| Sign In to join; Open Member Hub | membership/pages/MembershipPage.tsx | Button primary / ButtonLink secondary | Near match: same capsule family, local linkClass; keep guest action as button and navigation as link |
| Become a member | post/pages/AIPanel.jsx | Button primary, sm | Migrated to shared Button; contrast and target corrected |
| Return home; recoveryLabel (Back to collections, Browse stories, etc. supplied by caller) | app/pages/NotFound.jsx; shared/components/ui/MissingResourceState.jsx | ButtonLink primary | Migrated to shared ButtonLink; native navigation preserved |
| Write a post | user/pages/Profile/index.jsx | ButtonLink primary / Button primary | Matches the agreed Ask a question primary family; local link classes remain |
| View more; See all; View trending; Find writers | discovery/pages/Home/HomeSections.jsx | ButtonLink secondary | Near match: local outline capsule copies shared base; still local |
| View all questions / question-section navigation; View all opportunities | Home/TopQuestionsSection.jsx; question/pages/OpportunitiesPage.jsx | ButtonLink secondary or ghost, depending on surface | Near match: local recovery/section-link treatment; still local |
| Write an article; Add response; question-related writing links | Explore/QuestionDetail.jsx; QuestionsTab.jsx; OpportunitiesPage.jsx | ButtonLink primary; Button primary for guest actions | Add response/View responses have no exact shared variant: approved 12 px regular-weight rounded-10px family differs from standard pill |
| Edit; Republish/Unpublish; Delete post | user/pages/Profile/index.jsx | ButtonLink action; Button action | Republish/Delete reuse Button; Edit is a local link counterpart. Delete's semantic danger label is intentional |
| Delete post; Delete collection | user/components/DeletePostDialog.tsx; collection/components/CollectionCard.jsx | Button danger | Existing Button with local danger color overrides; named danger now exists but these callers retain their existing styling |
| Not for me | question/pages/OpportunitiesPage.jsx | Button ghost | No exact 11 px underlined-decline variant; keep existing text treatment |
| Join | shared/components/layout/Navbar.jsx; mobile Account Join link | ButtonLink primary / sheet navigation row | Desktop's approved 36 px minimum is an intentional exception; no shared compact-below-44 size was introduced |
| Previous; Next; Read full article / depth links | post/pages/index.jsx; ShortReadModal.jsx; ShortSeriesDetail.jsx | ButtonLink secondary / primary as shown locally | Local progression/reading navigation styles; share link semantics, not mutation behavior |

## Selectors, tabs, menus and icons

| Button name(s) | Location(s) | Closest reusable component | Match / remaining duplicate |
|---|---|---|---|
| Category names | discovery/pages/Home/HomeSections.jsx | Pill | Near match: local 12 px / 16 px padding and surface background; 44 px target corrected |
| Topic names | discovery/pages/Search/index.jsx | Pill | Near match: local 11 px / 12 px padding; 44 px target corrected |
| Interest/topic names | onboarding/pages/StepInterests.jsx | Pill | Near match: 13 px / 16 px padding and surface background; 44 px target corrected |
| Home feed modes; Posts/Writers/Shorts/Questions; Saved/History; Posts/Drafts/Analytics; Explore sections | Home/index.jsx; Search/index.jsx; collection/pages/SavedPage.jsx; user/pages/Profile/index.jsx; Explore/index.jsx | No exact reusable underline-tab component | Intentional underline family. Library/Writing copy nearly identical classes; Home/Search have local spacing, Explore uses route links. Pill is a different appearance and must not replace them |
| Login; Sign Up tabs | auth/pages/Login.jsx | No exact shared segmented-auth-tab component | Local 14 px rounded-rectangle segmented tabs; neither Pill nor underline tabs match |
| Login; Sign Up submit; Verify Email | auth/pages/Login.jsx | No exact shared auth-submit variant | Button lg has similar font scale, but local full-width rounded-lg auth layout is distinct; sizing corrected without changing shape |
| Resend OTP | auth/pages/Login.jsx | Button ghost | Near match: compact 12 px local quiet action; 44 px target corrected |
| Save story / Remove from saved; Share link; Not interested; Report this post/short; Save collection; Delete collection | DiscoveryPostCard.jsx; collection/components/CollectionCard.jsx | ActionMenuItem (shared menu, sm) | Already consolidated by separate card-menu work; ActionMenuItem now consumes shared named menu style/size |
| Save story / Remove from saved; Share link; Add to collection; Report this post | Explore/TrendingTab.jsx featured article | PostCardMenu / ActionMenuItem | Consolidated with shared story commands; featured appreciation remains in PostEngagementControls |
| Sign Out; Sign Out all Devices | shared/components/layout/Navbar.jsx | ActionMenuItem / Button menu | Near match: 13 px rounded-6px text rows; no exact shared Account menu-row style. Focus semantics remain with Account |
| Sign Out; Help | user/components/MobileProfileSheet.tsx | Button action / disclosure | No exact sheet-row variant: icon/label placement and sheet-specific help expansion are intentional |
| Copy Link; Share on X | shared/components/ui/ShareMenu.tsx | Button menu | Dedicated shared ShareMenu already owns 13 px/44 px modal rows; near visual match but no need to replace its behavior |
| Save/Saved; Share | CollectionDetail.jsx; ShortReadModal.jsx; post/pages/index.jsx | IconButton secondary for circular Save/Share; Button action for labeled article actions | Similar circle or quiet-action families; local border/selected behavior remains. Short-reader targets corrected to 44 × 44 px |
| More options | DiscoveryPostCard.jsx; CollectionCard.jsx; Explore/TrendingTab.jsx | ActionMenuTrigger | Cards and featured article reuse the shared trigger; featured commands are owned by PostCardMenu |
| Move earlier; Move later | collection/pages/CollectionDetail.jsx; discovery/pages/ShortSeriesDetail.jsx | IconButton secondary | Near match: local arrow circles with their own disabled opacity; corrected from 40/32 px to 44 px |
| Upvote / Remove upvote | Explore/QuestionsTab.jsx; QuestionDetail.jsx | Button action; IconButton action for icon-only forms | No exact shared stacked triangle/count vote component. Boundary/stacked vs inline variants are intentional; sizing corrected |
| Vote / Voted | CompetitionEntryCard.jsx | No exact shared entry-vote component | Full-width placement below card content, count and rounded-12px state treatment are distinct from ordinary Button |
| Article overview; Read aloud | post/pages/AIPanel.jsx | No exact shared responsive tool-rail style | Rounded-10px tool with phone label/desktop icon is distinct from circular IconButton; theme tokens and 44 px targets corrected |
| Read article aloud / Pause reading | post/pages/AIPanel.jsx | IconButton primary | Migrated to shared IconButton; theme-aware glyph and 44 × 44 px target |
| Restart | post/pages/AIPanel.jsx | Button ghost | No exact 11 px restart style; quiet action retains its local typography with corrected target |
| Open account menu; unread notifications | shared/components/layout/Navbar.jsx | IconButton ghost / secondary | No exact avatar-trigger or badge-link wrapper; local semantics remain. Targets now 44 × 44 px and badge uses inverted theme text |
| Clear search; Search | Navbar.jsx; MobileSearchDialog.tsx | IconButton ghost | Similar quiet circles; Navbar Clear search intentionally retains 32 px visual cross with expanded 44 px pseudo-element hit area |
| Reset filters; Filters; Close filters | shared/components/ui/FilterPopover.jsx | No exact generic Button variant for filter trigger/reset; IconButton ghost for Close | Existing shared FilterPopover owns this approved trigger/badge/panel family; reset/close already 44 px, desktop trigger corrected |
| Theme; Language; Status; Sort and other dropdown choices | shared/components/ui/Select.tsx and callers | Select | Already a shared component. Combobox/options are not interchangeable with Button menu |
| Close / Close search / Close dialog | shared/components/ui/ModalHeader.tsx | ModalHeader; visually IconButton ghost | Already shared 44 px header control; preserve header refs/dismissal semantics |
| Back | shared/components/ui/BackButton.tsx | BackButton | Already shared; geometry preserved |
| Appreciate / Remove appreciation; Comments | AppreciationButton.tsx; PostEngagementControls.tsx | AppreciationButton; Button action | Dedicated shared engagement already owns heart/count. Comments is local inside the shared engagement component, with the same transparent action family |
| Like/Unlike; Reply; Edit; Delete; Read more/Show less; View replies/Hide replies | post/components/CommentItem.tsx | Button action / ghost | Already reuse Button with intentional compact top-aligned comment overrides; shared sizes now provide the minimum target |
| Show comments / Hide comments | post/pages/CommentsSection.jsx | Button disclosure | Already shared disclosure variant; flat full-width shape retained |
| Dismiss notification | shared/components/ui/ToastViewport.jsx | IconButton ghost | No exact square rounded-7px toast-close style; retains CSS appearance with corrected 44 × 44 px target |

## Other local controls and inactive code

| Button name(s) | Location(s) | Closest reusable component | Match / remaining duplicate |
|---|---|---|---|
| Trending search names; suggested topics; autocomplete search phrases/writers | Navbar.jsx; MobileSearchDialog.tsx | No exact generic Button component | Suggestion rows have listbox/navigation semantics and their own data/keyboard behavior; Select is single-choice and ActionMenu is a command menu |
| Similar question text; selected writer ×; writer autocomplete choices | Explore/QuestionsTab.jsx | No exact shared question-duplicate / multi-writer selector component | Local form suggestions/chips; corrected targets, existing layout retained |
| Add cover image; Remove cover; Insert block (+); Delete block (×); Insert [block type]; Post; Short | editor/pages/index.jsx; MobileBlockMenu.tsx; SlashMenu.jsx; WriteDrafts.tsx | No exact generic Button match for cover/block/card choices | Feature-owned dashed cover picker, editor toolbar/insertion rows and type-choice cards. Mobile toolbar already uses Button action |
| Remove tag; tag choices; Add new tag | editor/components/TagPicker.tsx | No exact shared multi-tag selector component | Feature-owned multi-value picker; shared Select is single-choice. Add/retry already use Button |
| Explore; Account bottom navigation | shared/components/layout/Sidebar.jsx; BottomBar.jsx | No exact generic Button match | Dedicated navigation/disclosure appearance; preserve active-route and mobile stacked-label layout |
| B; I; U; link | editor/components/HoveringMenu.jsx | No exact shared formatting-toolbar component | Inactive/commented rendering; gray/white legacy styles were not changed |
| Save article; author/avatar navigation | post/components/ArticleCard.jsx; FeaturedCard.jsx; HorizontalCard.jsx; CompactCard.jsx | IconButton secondary; identity links | Legacy exported components have no active caller found by source search; excluded from application sizing migration |

This list records resemblance and ownership, not a blanket migration recommendation. The contrast and target fixes were authorized; further consolidation of the remaining local typography/shapes is separate work.
