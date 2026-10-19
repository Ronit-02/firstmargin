# firstmargin library and third-party API rules

Last updated: 2026-09-08

## Purpose and dependency decisions

Dependencies accelerate delivery but expand maintenance, performance, privacy, accessibility, and failure surface. Add one only when it supplies substantial, well-tested behavior that is riskier or disproportionately expensive to maintain ourselves.

Before adding a dependency, document the problem, why existing capabilities are insufficient, runtime/bundle cost, license, maintenance/release health, security history, compatibility, accessibility (for UI packages), data sent externally, and removal strategy. Changes affecting security, editor output, payments, AI, analytics, or multiple features require independent review or an explicit architectural decision.

## General usage rules

- Use documented public entry points and narrow tree-shakeable imports.
- Wrap high-churn or provider-specific libraries behind application-owned adapters.
- Keep configuration localized; avoid import-time network calls and hidden global state.
- Commit lockfiles, review changelogs before upgrades, and remove unused dependencies promptly.
- Do not introduce overlapping libraries without a migration plan.
- Browser configuration contains only intentionally public values.

## Frontend libraries

### React and React Router

Keep rendering pure, use composition and platform features before new abstractions, and do not add a second rendering framework. Routes own navigable application state: durable detail identifiers, shareable filters, loading, error, not-found, and unauthorized outcomes. Route guards improve UX but never replace server authorization.

### TanStack Query and Redux Toolkit

TanStack Query owns server and mutation state. Use domain query-key factories, intentional cache policies, smallest-correct invalidation, and rollback/pending behavior for optimistic updates. Redux is limited to cross-cutting client state that cannot be represented as a server query; do not duplicate fetched domain data into it. Shareable filters and cursors belong in URL parameters; ephemeral interaction state belongs locally.

### Axios, Framer Motion, Tailwind, and UUID

Use one configured application client per API origin and normalize transport failures into application errors. Respect reduced-motion preferences and use motion only when it improves comprehension. Tailwind consumes semantic UI tokens; repeated patterns become components or composed classes. Client UUIDs may identify unsaved editor blocks but do not establish trust or authorization.

## Backend libraries

Express routes are declarative and thin; central middleware handles parsing, errors, and application concerns. Mongoose schemas define persistence rather than browser contracts; indexes, query shape, relationship cardinality, and migrations are intentional. Authentication, hashing, uploads, and logging libraries are used through centralized application conventions rather than ad hoc controller code.

## External integration principles

Provider adapters expose application concepts, not raw vendor response objects. Every integration has clear ownership, input/output validation, failure states, privacy boundaries, test seams, and removal or migration considerations. Product behavior remains usable when an optional integration is unavailable.

## Upgrade and incident policy

Automated update proposals still require tests and changelog review. Critical security updates may use expedited review; major upgrades require a dedicated change and migration notes. Provider outages are tracked independently from application defects, and unmaintained, vulnerable, or disproportionally costly libraries need a removal plan.
