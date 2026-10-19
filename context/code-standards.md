# firstmargin code standards

Last updated: 2026-09-08

## Engineering mindset

- Prefer correct, observable behavior over convincing-looking demos.
- Model business rules explicitly; do not scatter them across components and controllers.
- Make invalid states difficult to represent and impossible to persist.
- Keep source records authoritative and derived values repairable.
- Optimize for the next maintainer's understanding before cleverness.
- Make the smallest coherent change that completes a user-visible outcome.
- Preserve backward compatibility intentionally, not accidentally.
- Treat accessibility, security, privacy, loading behavior, and failure recovery as acceptance criteria.
- Do not hide uncertainty with fallback mock data in production flows.

## Language direction

The repository currently uses JavaScript. New modules and materially rewritten modules should use TypeScript. Migration is incremental; do not rename every file in an unrelated feature change.

Target configuration:

- `strict: true`
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`
- `noImplicitOverride: true`
- `useUnknownInCatchVariables: true`
- `noFallthroughCasesInSwitch: true`
- `noEmit: true` for frontend type checking

## TypeScript rules

- Do not use `any`. Use `unknown`, validate it, then narrow it.
- Do not use type assertions to silence an unresolved contract problem.
- Infer local implementation types; explicitly type module boundaries.
- Use discriminated unions for states and domain variants.
- Use string literal unions for closed application values and constants for runtime validation.
- Generate or share API DTO types only from a versioned contract. Never import Mongoose document types into the frontend.
- Mark immutable inputs as `Readonly` when mutation is not intended.
- Avoid TypeScript `enum`; prefer `as const` objects and derived union types.
- Optional fields mean truly optional. Use `null` when the API intentionally communicates an empty value.
- Parse environment variables and external payloads at startup or adapter boundaries.
- Exhaustively handle union members with a `never` check.
- Dates cross API boundaries as ISO strings and become `Date` objects only where required.
- IDs use named types or domain-specific aliases when mixing identifiers would be dangerous.

Example:

```ts
export const postStatuses = [
  'draft',
  'scheduled',
  'published',
  'unlisted',
  'archived',
] as const;

export type PostStatus = (typeof postStatuses)[number];
```

## Naming conventions

### Code symbols

| Kind | Convention | Example |
|---|---|---|
| React component | PascalCase | `ArticleHeader` |
| Hook | camelCase with `use` | `useArticleQuery` |
| Function | verb-led camelCase | `publishDraft` |
| Boolean | `is`, `has`, `can`, `should` | `isPublished` |
| Event handler prop | `on` prefix | `onSave` |
| Local event handler | `handle` prefix | `handleSave` |
| Constant | camelCase unless global scalar | `postStatuses`, `MAX_UPLOAD_BYTES` |
| Type/interface | PascalCase | `PostSummary` |
| Database model | singular PascalCase | `CompetitionEntry` |
| API path | plural kebab-case nouns | `/api/v1/competition-entries` |
| Analytics event | dotted lowercase domain action | `post.read_completed` |

Use the product terms defined in the context documents. Do not alternate between artist, author, creator, and writer in code without a domain reason. The preferred public term is **writer**; the persisted relationship may use `authorId` on a post.

### Files and folders

- React component: `ArticleCard.tsx`
- Hook: `useArticleQuery.ts`
- Utility: `formatReadingTime.ts`
- Domain service: `post.service.ts`
- Route/controller/schema: `post.routes.ts`, `post.controller.ts`, `post.schema.ts`
- Tests: `post.service.test.ts`, `publish-flow.spec.ts`
- Folders: lowercase kebab-case for multiword feature names, such as `reading-history/`
- Avoid generic files such as `helpers.ts`, `utils.ts`, or `common.ts` when a specific name is possible.
- `index.ts` may define a deliberate public module API; it must not become a circular-import dumping ground.

## Import rules

- Use `@/` for frontend imports rooted at `src`.
- Prefer feature public exports for cross-feature imports.
- Relative imports are acceptable inside a small feature subtree.
- Sort imports by platform/external, application absolute, then relative.
- Avoid importing private files across features.
- Circular dependencies are defects and must be removed.
- Confirm every runtime import exists in `package.json`; do not rely on transitive packages.

## Component structure

A page component should coordinate route data and composition, not contain an entire feature implementation.

Recommended order:

1. Imports
2. Module constants and types
3. Small private pure helpers
4. Exported component
5. Private subcomponents only when they are truly local

Component rules:

- Keep render functions declarative.
- Derive values during render instead of synchronizing redundant state in effects.
- Use controlled state only when the component owns that interaction.
- Avoid effects for ordinary data transformation.
- Never perform API calls directly inside presentational components.
- Do not define reusable components inside a page file.
- Prefer composition over boolean-prop explosions.
- Every interactive element uses the correct semantic element.
- Do not attach click navigation to a plain `div`.
- Forward refs only when the component contract requires DOM access.
- Stable list keys come from data identifiers, never array positions for mutable lists.

Suggested feature component:

```tsx
type QuestionCardProps = {
  question: QuestionSummary;
  onVote: (questionId: QuestionId) => void;
  isVoting?: boolean;
};

export function QuestionCard({
  question,
  onVote,
  isVoting = false,
}: QuestionCardProps) {
  // render only; domain behavior remains in the mutation/service layer
}
```

## State management

- TanStack Query owns remote server state.
- Redux is reserved for cross-cutting client/application state that cannot be represented as server queries; authentication is the current use.
- URL search parameters own shareable filters, tabs, sorts, and pagination cursors.
- Local component state owns ephemeral interaction state.
- Form state belongs to the form and is validated against the same logical contract as the server.
- Do not copy query results into local state unless implementing an intentional editable draft.
- Optimistic mutations require rollback behavior and clear pending states.
- Query keys are factories, not ad hoc arrays repeated across files.

## API route structure

Prefer resource-oriented `/api/v1` paths for new routes. Current canonical publication routes include:

```text
GET    /api/publications
POST   /api/publications
GET    /api/publications/:publicationId
PUT    /api/publications/:publicationId/appreciation
DELETE /api/publications/:publicationId/appreciation
GET    /api/v1/publications/:publicationId/summary
DELETE /api/v1/publications/:publicationId
```

Rules:

- Use plural resource nouns.
- Use `PATCH` for partial updates and `PUT` for idempotent replacement or relationship creation.
- Use action subresources only for actual state transitions such as `/publish`.
- Avoid ambiguous `toggle` endpoints; retries must not reverse the user's intended state.
- Validate params, query, headers, and body before controller logic.
- Controllers translate HTTP and call services.
- Services enforce domain rules and authorization.
- Repositories perform database access.
- Return `201` with a resource location after creation, `204` for a successful empty deletion, and precise 4xx errors for client-correctable failures.
- Never return a `500` for a known duplicate, validation, permission, or not-found condition.

## Error handling

- Throw or return typed application errors with stable codes.
- Central middleware maps application errors to HTTP responses.
- User-facing messages explain what can be done next without leaking internals.
- Logs include request ID, error code, route, and safe context.
- Log only privacy-safe diagnostic context.
- Frontend errors use inline or page-level states; do not use `window.alert()`.
- Error boundaries protect route groups and preserve a recovery action.

## Validation and security

- Validate and normalize external input before it affects application state.
- Enforce authorization before any mutation.
- Build privacy, safe rendering, abuse resistance, and dependency review into every feature.

## Testing standards

- Unit tests cover pure ranking, normalization, validation, and policy functions.
- Service tests cover domain invariants and authorization.
- API integration tests use a controlled database and real middleware.
- Component tests cover interaction and accessible names, not implementation details.
- Browser-level tests cover a small set of critical user journeys.
- Every bug fix adds a regression test when practical.
- Time, randomness, external providers, and IDs are injectable in deterministic tests.
- Snapshots do not replace behavioral assertions.

## Comments and documentation

- Explain why a constraint exists, not what obvious code does.
- Delete stale and commented-out code.
- Use JSDoc only where it improves a public contract or JavaScript type safety during migration.
- Update relevant context files when a decision changes product behavior, architecture, tokens, or shared components.

## Review checklist

- Does the change complete a coherent user outcome?
- Are ownership and authorization explicit?
- Is server state represented once?
- Are loading, empty, error, permission, and retry states handled?
- Are API and database contracts validated?
- Are keyboard, focus, mobile, and reduced-motion behaviors correct?
- Are analytics purposeful and privacy-safe?
- Can failures be diagnosed without exposing sensitive data?
- Are tests and context documents updated?

