# firstmargin architecture

## Profile picture update — 2026-10-19

Authenticated `PUT /api/user/profile/avatar` accepts a validated image upload and updates both the public profile avatar and account picture. It preserves the existing text-profile update contract. Managed previous profile pictures are removed only after a successful replacement; provider and shared default images are retained. Google sign-in preserves a managed custom avatar.

## Staff account directory — 2026-10-18

The existing `/api/staff` namespace includes a paginated account directory and a role-change endpoint for moderators and administrators. Allowed transitions are regular or member to exclusive-writer or moderator, exclusive-writer to regular or moderator, and moderator to exclusive-writer or regular. Role-change history is stored separately from User/Profile records. Existing public APIs remain unchanged.

Last updated: 2026-09-08

## Architectural stance

firstmargin remains a modular monolith until demonstrated scale or team boundaries justify independent services. The web application, application API, durable storage, media delivery, background processing, and optional external integrations are distinct runtime responsibilities, but product logic must not be fragmented prematurely.

The architecture optimizes for:

- Correct ownership and authorization.
- Durable content and community data.
- Clear separation between authoritative records and derived presentation data.
- Replaceable external integrations.
- Observable asynchronous work.
- Safe incremental migration from the current JavaScript codebase.

## System boundaries

### Web application

Owns rendering, routing, accessibility, transient interface state, optimistic feedback, query caching, and client-side validation. It is never authoritative for permissions, entitlements, counters, deadlines, or recommendation eligibility.

### Application API

Owns authentication, authorization, validation, business workflows, persistence, moderation workflow, and stable public response contracts.

### Background processing

Owns retryable asynchronous work such as delivery, processing, scheduled publication, aggregation, and repair. Job boundaries must remain explicit even when processes share a repository or deployment.

### Durable data and integrations

Durable storage owns authoritative application records. Workflows affecting multiple records must preserve invariants through an appropriate transactional or repairable design. External providers are accessed through application-owned interfaces; raw provider payloads must not become domain API contracts.

## Repository and migration direction

The current project separates frontend and backend applications and keeps product context and repeatable verification in the repository. Evolve its structure incrementally: feature modules may use shared code and their own internals, but should not depend on another feature’s private folders. Server-side responsibilities remain separated between HTTP translation, business rules, and persistence access.

Do not reorganize the repository, migrate language, or replace architecture wholesale as part of feature work. Any architecture change affecting public contracts or stored data requires a migration or replay strategy, contract coverage, and an update to this document.

## Data-flow principles

Read flows validate input, resolve the appropriate identity, execute an owning domain query or service, map a stable response, and render it through accessible UI. Write flows validate user input, enforce authorization, preserve domain invariants, and update client state from the authoritative response.

Recommendation learning distinguishes viewed content from intentional interaction, keeps ranking explainable and diversity-aware, and does not introduce opaque machine-learning ranking before adequate event coverage and offline evaluation exist.

## Public contract principles

Owner series addition extends the existing format-specific series contract with authenticated `POST /api/series/:id/items`. It accepts one publicly released post owned by the series writer, preserves the 50-part limit and one-series-per-post invariant, appends without replacing the existing order, and returns already-present success for retry safety. Owned series lists may accept `postId` and expose `containsPost`; post summaries and detail expose viewer-relative `isOwner` so the action is not offered on another writer's work. Existing creation/update routes, schema, stored records, and legacy short-series routes remain unchanged.

Picked-post collection addition extends the existing ordered reference model with an authenticated owner-scoped operation. It accepts publicly released posts and shorts from any writer, appends without overwriting the existing order, prevents duplicates under repeated/concurrent additions, and retains the existing collection size bound. Legacy reference arrays remain readable and convert only on a targeted append. Existing collection creation/read/update contracts and schemas are preserved. The frontend reuses existing creation for create-with-story and partitions the private picker cache by viewer. Behavior and verification are owned by [collection items audit](collection-items-audit.md).

Comment lists and direct reply counts exclude deleted leaves and entirely deleted branches, while retaining deleted ancestors needed to reach surviving replies. Visibility filtering occurs before cursor limits. Existing soft-deletion records, mutation authorization/idempotency, response fields, active-comment totals, and schemas remain preserved. UI behavior and verification are owned by [comment actions audit](comment-actions-audit.md).

Owner post deletion uses the existing relationship model and missing-reference handling. Saves are post-indexed records, so cleanup does not rewrite user accounts. Existing collections, short series, and reading history omit unavailable posts; old article links use the existing missing-resource response and competition history retains its unavailable-entry state. Completed moderation history and immutable revisions remain preserved. Behavior, changed files, and verification are owned by [post deletion audit](post-deletion-audit.md).

Public writer-profile article summaries include the viewer's `isLiked` and `isBookmarked` state, resolved with batched reads of existing like/save relationships. Guests receive false without a relationship lookup. Each writer post summary also includes a body-derived `excerpt` using the shared discovery text extractor; no body or stored-data shape changes are needed. The frontend waits for session restoration and partitions writer queries by viewer identity; shared post-cache updates also cover writer articles for appreciation and comment-count changes. Existing response fields, routes, and persistence models are preserved.

- Version public APIs and maintain a clear compatibility path for breaking changes.
- Validate identifiers, allowlist client-controlled filters and sort keys, and paginate unstable result sets.
- Use stable success and failure response shapes.
- Map internal persistence objects to audience-appropriate public data-transfer objects.
- Support retry safety where a user action can be repeated.

Discovery lists use bounded cursor pages and compact presentation DTOs. Personalized ranking reads a bounded candidate projection, then loads only the selected page's display fields; it must not hydrate or parse full article bodies for every ranking candidate.

Unified search also supports explicit reader-question results. It matches question text, context, and tags with the existing topic/time filters and bounded limits, excludes closed questions, and reuses the question-list presenter for public author identity, viewer upvote state, answer counts, and accessible published responses. Existing post/writer/short search behavior and stored models are preserved. Search caches for questions are viewer-specific and refresh after confirmed upvotes.

Global autocomplete returns independent groups of up to five complete search phrases and five public writers. Phrases come from publicly released post tags and titles, with normalized deduplication, exact/phrase-prefix/word-prefix ranking, and supporting-publication counts. It does not read article bodies or search history. Selecting a phrase runs unified search; selecting a writer opens their profile. Full-result contracts and persistence models remain unchanged.

New competitions use `reader_choice` (Readers’ Choice) or `collective_choice` (Collective Choice) as their stored type; `votingMode` remains `readers`/`hybrid` internally for ranking and legacy closed records. `closeDate` is the voting deadline. The worker polls due competitions every 15 seconds, and competition reads also reconcile due records. Reader votes are switched atomically within one competition document, so each reader has at most one active vote. Readers’ Choice closes at the deadline with every first-place entry as a co-winner, or no winner when there are no eligible entries or reader votes. Collective Choice freezes the moderator roster using role-change history to resolve each active moderator’s role at the deadline, then accepts one score per eligible entry and roster slot. An active admin can fill only a missing slot on a moderator’s behalf. During judging, an admin can edit a recorded moderator score without adding another slot; the original submitter is preserved and the edit is audited. Moderators cannot resubmit completed Collective Choice slots. Reader and judge scores each contribute 50%. The final required score closes and announces results through a conditional update; closed results cannot be edited through scoring. A Collective Choice contest with no eligible entries or no active moderator slots closes without a winner. Existing closed competitions remain readable, and legacy manual-result endpoints remain available only for legacy types.

The staff judging route `/staff/competitions/:id/judging` reads the existing competition detail API and presents all entries with roster scores and submitter identities. Legacy judge scores also resolve their moderator names through the same detail response; admins edit a recorded legacy moderator score instead of adding their own score to an already scored entry. Google login refreshes the provider photo for existing accounts and updates the profile avatar only when that avatar still matches the prior account photo or is unset; a custom profile image remains authoritative. Session refresh returns the profile avatar when present.

Competition detail entry author data includes the stored public profile handle, resolved through one batch profile read, so entry cards can link directly to the writer without guessing a handle from the display name.

Editor tag suggestions use additive public GET `/api/v1/tags?q=...`, returning at most 50 value/label choices from active canonical topics and tags on publicly released posts. Queries are bounded and treated as literal text; only tag metadata is projected from posts. Drafts, unpublished posts, and future releases do not supply suggestions. Custom tags remain existing string values in draft/post writes, without creating canonical topics or changing schemas. Lookup failure does not block custom tag entry.

## Product data principles

firstmargin maintains identity, content, community, discovery, and optional member-experience records. Published content preserves its historical representation; drafts remain private to authorized people. Relationship and event records remain authoritative over derived counters, and private activity is not exposed through public discovery.


## Format propagation in reading summaries

Publication.format is the stored source of truth and accepts `story` or `short`, defaulting to `story`. A publication is the shared record for either format; an appreciation is a separate user-to-publication relationship. Competition entry votes remain a separate relationship and counter. Discovery, search, writer, competition, question, and series summaries propagate the format. Legacy HTTP responses translate `story` to `article` for the current frontend.

## Publication terminology migration

The backend stores `Publication` in `publications` and `Appreciation` in `appreciations`. Revisions, summaries, and comment appreciations use `publicationrevisions`, `publicationsummaries`, and `commentappreciations`. Relationship records use `publicationId`; publication counters use `appreciationsCount`; competition entries use `publication`, `publicationRevision`, `votes`, and `votesCount`. Collections and series store publication references, and question responses use `relatedPublications`. Notifications, reports, entitlements, and interaction events use the matching canonical enum values.

`Backend/scripts/migrate-publication-terminology.js` provides a read-only plan by default and requires `--apply --expect-db=<name>` to write. It rejects records containing both old and new fields, preserves existing IDs, renames populated collections, converts fields and enum values, and refreshes affected indexes. Stop writes and back up the affected collections before applying it to another database. A second dry run should report zero legacy records.

Existing `/api/post` and `/api/v1/posts/...` paths remain for the frontend. Request normalization accepts legacy `postId`, `article`, and related fields; responses include legacy aliases and enum values. Canonical `/api/publications` and `/api/v1/publications/...` routes expose canonical response names. Compatibility is confined to the HTTP boundary and small module import shims; new storage and domain modules use publication and appreciation names.

## Story and short series

Series retain the existing ordered short-series records. A published post may belong to multiple series, with its position stored separately in each. A `type` field distinguishes article/story series from short series; older records without it read as short series. The existing `/api/short-series` API remains available, and `/api/series` exposes the same controller for the dedicated browser. List requests filter one type at a time. Create and update validate owner, public release, one format per series, two to fifty unique entries, and duplicate-free membership within each series. The eligible-post read is owner scoped and format scoped. The post reader supplies series progression for articles and shorts. Existing `/shorts/series/:id` links remain supported alongside `/series/:id`.

## Story summary state

Existing discovery presentation is reused by owner posts and published question responses with populated public author identity. Owner responses retain management fields and omit bodies; question summaries retain legacy identifiers. Collection, history and early-access reads pass viewer identity; competition nested posts and writer/saved summaries expose existing appreciation/save relationships. This is additive response mapping over current routes and schemas. Frontend updates traverse the owning summary query shapes, with competition votes separate from story likes. See [post components audit](post-components-audit.md) for scope and verification.

Authenticated article reading progress uses a unique per-user/post `ReadingState` checkpoint. The reader rounds progress down to 10-point increments and sends at most one checkpoint per 10 seconds, with a final visibility/page-exit flush. History prefers this latest state and retains interaction-event fallback for older records; completion is stored separately from the latest progress value. The existing interaction events remain the analytics source for reading-depth milestones and completion counts.
