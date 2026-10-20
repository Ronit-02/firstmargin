# firstmargin project overview

Last updated: 2026-10-19

## Product definition

firstmargin is a responsive writing community for curious readers and aspiring writers. Readers discover thoughtful writing, ask questions, connect with creators, discuss ideas, vote in competitions, and help judge work. Writers publish articles and short reads, show their talent, respond to people, participate in competitions, and gain recognition.

firstmargin is not intended to be a generic blogging CMS or a clone of any single publishing platform. Its core loop is:

1. People discover thoughtful writing through curated and personalized surfaces.
2. They save, follow, comment, ask questions, and participate in the community.
3. Anyone can publish and respond to readers. Eligible non-staff writers can enter competitions; moderators and admins cannot submit entries and retain their staff judging responsibilities.
4. Reader behavior improves discovery while preserving quality, diversity, and writer visibility.
5. Membership comes later, without placing primary articles behind a paywall.

The current product priority is a calm, editorial reading experience with moderate community depth. firstmargin should feel like more than a place to read, but it must not become a generic social feed or an unfocused collection of every possible creator feature.

Writers can add their released stories and shorts to an existing matching-format series from shared list cards, Studio management rows/cards, the article reader, or the short reader. The action preserves writer ownership, ordered membership, the one-series-per-post rule, and the existing series size bound.

## Problems the product solves

### Writers do not know what to write

Readers can ask for explanations or articles. Duplicate requests should increase demand on the existing question instead of fragmenting it. Writers get a ranked opportunity inbox based on topic relevance, audience demand, and freshness.

### New writers struggle to earn distribution

firstmargin creates additional paths to visibility through weekly competitions, themed prompts, reader-choice awards, collaboration, and deliberately diverse recommendations. Existing follower count must not be the only route to reach.

### Discovery feeds become repetitive popularity contests

The feed should balance relevance, freshness, quality, diversity, exploration, and explicit reader controls. Popular, Latest, and Past 24 hours are feed modes, not the complete recommendation strategy.

### Readers cannot quickly judge whether an article is useful

Articles can expose a short abstract, reading time, table of contents, and optional generated summary. Writers can organize either full stories or short reads into separate ordered series without mixing their formats.

### Engagement signals can reward low-quality or toxic content

Ranking must use more than likes. Completion, saves, meaningful responses, follows after reading, reports, originality, and diversity all contribute. Readers can report spam, abuse, plagiarism, or harmful material.

### Paywalls interrupt discovery

Primary articles remain publicly readable. Membership pays for supporting creators and accessing extras such as early releases, workshops, behind-the-scenes material, audio, summaries, and direct creator interactions.

## Product principles

- Reader demand should produce useful writing opportunities.
- Primary knowledge stays accessible without an article paywall.
- Distribution should reward relevance and reader value, not only audience size.
- Recommendations should be explainable and controllable.
- Writers own their voice, formatting, and audience relationship.
- Reader privacy is not a monetization surface.
- Premium features enhance the experience; they do not degrade the free reading experience.
- Trust, moderation, accessibility, and performance are product features.

## Target users

### Emerging writer

Wants ideas, feedback, an audience, fair distribution, and a low-friction publishing workflow.

### Established writer or educator

Wants customizable publishing, direct audience demand, collections, analytics, workshops, and optional supporter experiences.

### Curious reader

Wants trustworthy discovery across topics, strong search, saved reading, concise previews, and control over recommendations.

### Time-constrained learner

Wants summaries, story and short series, audio, collections, and a path from quick understanding to deeper reading.

### Community participant

Wants to ask questions, vote, comment, join competitions, and influence what gets written next.

## Product surfaces and pages

Status meanings:

- **Connected:** uses persistent backend data for its primary job.
- **Partial:** some behavior is connected, but important states remain local or mocked.
- **Prototype:** primarily static data or temporary client state.
- **Planned:** not meaningfully represented yet.

| Surface | Route | Current status | Target responsibility |
|---|---|---:|---|
| Home | `/` | Connected | Server-backed discovery feed with a latest Short reads shelf after story eight when shorts are available, plus article of the day, categories, writer picks, competition winner, collections, hot questions, and top authors |
| Explore trending | `/explore/trending` | Connected | Ranked, filterable discovery with explainable feed modes |
| Explore questions | `/explore/questions` | Connected | Independent question discovery, deduplication, voting, answering, and article requests |
| Question detail | `/explore/questions/:id` | Connected | Question context, short answers, follows, reports, and related published writing |
| Writer opportunities | `/opportunities` | Connected | Authenticated opportunity inbox ranked by topic fit, reader demand, and freshness |
| Explore competitions | `/explore/competitions` | Partial | Browse active and completed contests; staff and operational edge cases remain |
| Competition detail | `/explore/competitions/:id` | Partial | Rules, deadlines, entries, voting, judging, results, disqualification, and appeals |
| Search | `/search` | Connected | Unified server search across posts, writers, shorts, and reader questions with URL-persisted tabs/filters; question categories open the Questions tab. Global autocomplete suggests up to five content-based search phrases and five authors without type-selection buttons. |
| Shorts | `/shorts` | Connected | Filterable short-form discovery using the shared compact reader |
| Article | `/post/:id` | Partial | Public reading, engagement, context, recommendations, summary, audio, and reports |
| Public writer profile | `/author/:handle` | Connected | Durable writer identity, Published work with Stories/Shorts/Collections/Series pills, writing sorting, and paginated public collections and story/short series, follow state and labelled direct-request controls; `/author` provides a writer-search recovery path |
| Collections | `/collections` | Connected | Browse, save, create, and manage curated reading sets; add any public post/short from its card or reader to an owned collection or create one in place |
| Collection detail | `/collections/:id` | Connected | Read, save, share, and manage a collection |
| Library | `/saved` | Connected | Saved, Collections, and History top tabs; Collections switches between My and Saved sets with URL-backed pill selection, visibility, and sort filters |
| Writer/editor | `/studio?draft=`, `?edit=`, `?new=`, or `?question=` | Partial | Shared studio Post/Short chooser creates a typed draft; existing editor retains stacked fields, phone active-block toolbar/bottom sheet, guest local composition via direct `?new=`, autosave, validation, scheduling, and publication |
| Personal profile | `/profile` | Connected | Centered guest sign-in prompt; mobile Account sheet links to the profile and supplies account navigation; signed-in public identity, biography, icon-only editing action, follower/following counts, direct-request preference, and Your published writing with Posts/Shorts pills, sorting Filters, and Edit in Studio |
| Studio | `/studio` | Connected | Private Analytics, Published (Stories/Shorts), Drafts (Stories/Shorts), Ideas, Updates, Workshops, and Requests tabs; Analytics opens by default with basic released-post counts while detailed performance remains member-only; Ideas shows ranked reader questions and the full reader-demand link; Updates lists past creator updates, Workshops lists hosted sessions, and Requests lists direct requests; Write a post opens the Post/Short chooser; legacy `/write` and `/writing` redirect here |
| Edit profile | `/profile/edit` | Connected | Guarded standalone editing page with display-name/biography fields and existing reading-interest controls; Save/Cancel return to Profile |
| Onboarding | `/onboarding` | Connected | Persist interests, initial follows, goals, and consent preferences |
| Authentication | `/login`, `/signup` | Connected | Account creation, verification, recovery, and session management |
| Settings | `/settings` | Connected | Public theme and language settings |
| Help | `/help` | Connected | Public product guide and links to existing reading, writing, community, membership, and settings routes |
| Notifications | `/notifications` | Connected | Inbox anchored below the desktop notification button, with the existing mobile modal over the originating route (Home for direct entries), unread activity, read actions, and cursor pagination; desktop navbar and signed-in mobile Account access |
| Membership | `/membership` | Connected | Public firstmargin Pro features and provisional ₹199/month price, guest sign-in return, checkout, and existing-member billing management; unconfigured billing stays inline and payment integration remains pending |
| Member Hub | `/members` | Connected | Centered guest sign-in prompt; signed-in Early access, Creator extras, and Workshops tabs, with Early access selected by default and limited to future-release posts |
| Moderation | Internal/admin | Planned | Reports, review queues, appeals, enforcement, and audit history |

## Navigation model

### Global navigation

- Home
- Explore
  - For you
  - Trending
  - Latest
  - Questions
  - Competitions
- Search
- Collections
- Saved
- Write
- Notifications
- Profile menu

Desktop may use a compact side rail plus a global top bar. Mobile uses a consistent bottom bar for Home, Explore, Shorts, Collections, and an Account sheet button for guests and members across application pages. Studio is available in the desktop sidebar and signed-in mobile Account sheet. Guests and confirmed nonmembers see Join; active/trialing subscribers manage billing from Your space in the desktop profile menu, the mobile Account sheet, or their personal Profile header. Global search remains in the top bar; Account opens an animated bottom sheet with guest authentication or signed-in Profile, Library, Studio, and Member Hub links, Settings, Help, and temporary social homepage links. At 768 px and above, Help opens `/help` directly above Settings in the bottom sidebar group; Settings includes appearance controls.

Every detail page must provide a stable parent path or back destination. Navigation must never depend solely on browser history.

## Core user flows

### Reader discovery flow

1. Reader lands on Home or Explore.
2. Feed records an impression when an item is actually visible.
3. Reader opens an article or short.
4. The product records reading depth, completion, and intentional actions.
5. Reader can save, follow, respond, share, report, or tune future recommendations.
6. The next feed uses those signals while preserving topic and author diversity.

### Reader request flow

1. Reader opens the independent Questions surface.
2. The system searches semantically and lexically for existing questions.
3. Reader upvotes an existing question or confirms a genuinely new one.
4. Writers can discover questions as community demand, without questions being structurally attached to stories.
5. Writers answer questions through the question flow or publish independently.
6. Participants receive notifications for answers, votes, follows, and moderation outcomes.

### Writer publishing flow

1. Writer starts from an idea, question, competition, or blank draft.
2. Draft autosaves title, cover, blocks, tags, metadata, and revision state.
3. Writer previews and validates the article.
4. Writer publishes immediately or schedules a release.
5. The post enters eligible discovery surfaces.
6. Writer sees performance, audience quality, and actionable feedback.

### Competition flow

1. Reader or writer discovers an open competition.
2. Writer reviews rules and submits an eligible owned post.
3. Staff, judges, and/or readers evaluate entries according to the contest mode.
4. Results lock at a defined time and winners receive durable recognition.
5. Winning and finalist work receives bounded promotion rather than permanent ranking privilege.

### Membership flow

1. Reader sees a clearly labeled membership benefit.
2. Reader purchases platform membership.
3. Entitlements are resolved on the server.
4. Primary articles remain public; extras respect entitlement checks.
5. Cancellation changes future renewal without silently removing already paid access.

## Data architecture overview

The system owns four categories of data:

- **Identity:** users, profiles, roles, sessions, follows, preferences, blocks. Admin roles receive member capabilities through the entitlement service; Profile and signed-in Account menus display the stored role.
- **Content:** posts, post revisions, blocks, tags, shorts, collections, questions, answers.
- **Community:** comments, reactions, saves, reports, competition entries, subscriptions.
- **Discovery:** impressions, reads, completion, hides, topic affinities, rankings, experiments.

The frontend consumes the backend through versioned JSON APIs. Derived counters may be cached, but source event or relationship records remain authoritative.

See [architecture.md](architecture.md) for system boundaries, schemas, data flow, and invariants.

## Features in scope

### MVP foundation

- Authentication, verification, sessions, and profile basics
- Public writer identities with durable handles
- Draft creation, autosave, preview, publish, edit, and unpublish
- Long-form article reading
- Tags and topic taxonomy
- Server-backed Home, Explore, and Search
- Likes or appreciations, saves, comments, follows, shares, and reports
- Independent reader questions, duplicate detection, upvotes, answers, and moderation
- Basic writer analytics
- Moderation queue and enforcement primitives
- Event capture required for recommendations
- Accessible responsive UI, SEO metadata, loading states, and error states

### Growth scope after the core loop

- Explainable personalized recommendations
- Competitions and reader-choice voting
- Collections and collaborative collections
- Short-form posts and separate story or short learning series
- Notifications
- Platform membership
- Early access, workshops, behind-the-scenes content, and direct requests
- Generated summaries and article audio
- Advanced writer analytics and experimentation

## Features out of scope for the initial build

- Native mobile applications; responsive web phone support is required now
- Real-time collaborative document editing
- General-purpose Notion replacement
- Full video hosting or YouTube-style creator tooling
- Advertising marketplace or sale of behavioral data
- Cryptocurrency, tokens, or speculative creator economies
- Complex machine-learning recommendation infrastructure before sufficient event data exists
- Multi-region active-active infrastructure
- Enterprise publication/team administration
- Arbitrary third-party embeds without a security and privacy review

“Out of scope” means deferred, not permanently rejected. A feature enters scope only through an updated build plan and explicit acceptance criteria.

## Success criteria

### MVP release gates

- A new user can sign up, verify, onboard, publish, and reload without losing state.
- A reader can discover, open, save, follow, comment, report, and later find the same persisted state.
- A reader question can be deduplicated, upvoted, answered, followed, and moderated as an independent community item.
- No primary route depends on mock data.
- Authorization tests cover every write endpoint.
- Core flows meet WCAG 2.2 AA keyboard and contrast expectations.
- Public article pages include correct canonical, Open Graph, and structured metadata.
- Operational logs do not contain passwords, tokens, OTPs, or private article content.

### Product health metrics

- Reader activation: completes one meaningful read and one intent signal within the first session.
- Writer activation: saves a draft and publishes or responds to a request within seven days.
- Demand fulfillment rate: percentage of qualified questions receiving a useful answer or response.
- Discovery quality: long-read completion, saves per impression, hides, reports, and author diversity.
- Writer opportunity fairness: distribution of qualified impressions across new and established writers.
- Retention: weekly returning readers and monthly returning writers.
- Trust: report rate, confirmed violation rate, appeal rate, and moderation response time.
- Performance: Core Web Vitals and API latency budgets defined per release phase.

Raw likes, page views, and account registrations are diagnostic metrics, not standalone definitions of success.
