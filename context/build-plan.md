# firstmargin build plan

Last updated: 2026-09-08

## Implementation snapshot

Phases 0–6 have working vertical slices. The current focus is hardening the core community loop before expanding premium experiences. [The progress tracker](progress-tracker.md) is the canonical source for verified implementation status.

Execution order:

1. Questions and community interaction as a separate product surface.
2. Publishing and writer-experience hardening.
3. Competitions and community-judging hardening.
4. Monetization and premium experiences after the core community loop is reliable.

## Planning rules

- Build a reliable vertical slice before expanding horizontally.
- Each phase ends with demonstrable behavior and proportionate acceptance checks.
- Do not present mock or local-only state as a completed feature.
- Do not begin advanced recommendation automation, payments, or AI generation before their product, data, safety, and operating foundations exist.
- Repair data contracts before polishing dependent screens.
- Preserve the current stack and migrate incrementally.

## Confirmed product direction

- firstmargin is a responsive writing community for curious readers and aspiring writers.
- The core loop is discover, read, save or follow, discuss, publish, participate, and return.
- Every signed-in account can participate without a progressive-role system.
- Questions are an independent community surface, not comments on stories.
- Discovery favors quality and diversity over raw engagement.
- Saved stories are private by default; public collections are opt-in.
- Responsive web supports the same core phone and desktop capabilities; native-only work is deferred.
- Monetization follows reader retention and community health rather than leading the product.

## Completed reading and discovery hardening

The responsive reading and discovery phase established coherent phone and desktop flows for Home, Explore, Search, article reading, Saved, and profile discovery. It also requires consistent actions, feedback states, reader controls, accessible behavior, and automated critical-path coverage appropriate to the test harness.

## Phase 0 — Baseline and contract repair

Goal: make the repository safe to change and remove contradictions.

- Establish documented setup, formatting, linting, testing, repeatable fixtures, and stable API contracts.
- Reconcile core records and durable relationships.
- Add centralized validation, error handling, authorization coverage, and migration/rollback documentation.

Exit: documented startup, contract coverage, authorization coverage, build health, and coherent source-of-truth data.

## Phase 1 — Complete publishing and reading loop

Goal: a writer can publish durable content and a reader can engage with it.

- Deliver persistent drafts, editing, preview, publishing, stable public identity, and management workflows.
- Deliver server-backed reading, structured content, engagement, reporting, feedback states, and public metadata.

Exit: an end-to-end publish/read/engage flow is verified without mock-data dependence and meets accessibility expectations.

## Phase 2 — Discovery, search, and onboarding

Goal: replace demo discovery with useful server-backed content discovery.

- Persist onboarding interests and follows, canonical topics, discovery modes, unified search, pagination, and reader controls.
- Capture privacy-reviewed interaction signals and use an explainable, diversity-aware initial ranking approach.

Exit: primary discovery has no local article datasets, readers can tune recommendations, and ranking behavior can be evaluated reproducibly.

## Phase 3 — Reader demand and writer opportunities

Goal: deliver the central reader-demand-to-writing loop.

- Deliver duplicate-aware questions, voting, topics, answers, opportunity discovery, notifications, related writing, and demand analytics.

Exit: a request can become a linked published response end to end, without forced incorrect merges or missing abuse/report controls.

## Phase 4 — Competitions and creator growth

Goal: create a fair, recurring route to writer discovery.

- Deliver competition administration, submissions, community participation, judging, results, bounded recognition, notifications, and review history.

Exit: results are reviewable, promotion is bounded, and staff workflows can resolve disputes without manual database changes.

## Phase 5 — Collections, shorts, and richer learning

Goal: help readers organize knowledge and consume it at different depths.

- Deliver persistent collections, article and short formats, series progression, history, and writer-curated learning paths.

Exit: collections are durable and accessible, shorts are a real format, and readers retain context while moving between depths.

## Phase 6 — Membership, creator support, AI, and audio

Goal: add sustainable premium value without locking primary knowledge.

- Finalize membership and creator-support policy, entitlement-backed premium experiences, summaries, audio, workshops, creator updates, requests, and analytics.

Exit: primary articles remain public; premium behavior is explicit, accessible, traceable, correctable, and resilient to dependent-service failure.

## Continuous workstreams and definition of done

Every phase includes accessibility, responsive behavior, privacy and moderation review, performance, documentation, realistic fixtures, and proportionate security/quality review. A feature is complete when its behavior, persistence, permission states, accessible feedback states, verification, privacy implications, operational diagnostics, and relevant context are updated.
