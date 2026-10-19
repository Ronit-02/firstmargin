# Development test fixtures

Last reviewed: 2026-10-19

## Purpose and safety

The development seed creates a connected, repeatable dataset that exercises the same application paths as user-created data without adding fallback mock logic. Fixtures are strictly non-production: use them only in isolated development or test environments, and never document or commit fixture credentials, account identifiers, tokens, or provider values.

Fixtures support product verification without creating real charges or fabricating provider success. Extend the set when a feature needs representative persisted state.

## Feature coverage map

| Area | Seeded scenarios |
|---|---|
| Discovery and search | Feeds, topics, varied authors, interaction signals, searchable writing, questions, and public profiles. |
| Reading and engagement | Structured content, accessible media alternatives, saves, reactions, comments, follows, sharing, progress, and reports. |
| Publishing | Drafts, revisions, publication states, short reads, source-question linkage, and writer-facing management. |
| Questions and opportunities | Open and answered questions, duplicate-aware states, votes, tags, linked responses, and reader demand. |
| Competitions | Multiple lifecycle states, entries, votes, judging, results, and review history. |
| Collections, shorts, and history | Ordered collections, saved items, short series, depth links, and varied reading progress. |
| Membership experiences | Member states, early access, summaries, browser speech, workshops, creator updates, requests, support, and analytics. |
| Notifications and moderation review | Read/unread activity, report lifecycle states, and non-destructive staff review scenarios. |
| Provider-independent lifecycle states | Billing, AI-use, media, email, and delivery-adjacent UI states without requiring live provider calls. |

## Expanded reading catalog — 2026-10-19

`npm run seed:dev` in `Backend/` now provides 74 keyed publications: 53 released stories, 17 released shorts, three future releases, and one unpublished owner example. The 32 discovery stories have distinct multi-paragraph bodies, nine more complete stories were added, and the original featured stories and shorts have fuller reading copy. The seed also provides 19 collections, seven ordered series (four story and three short), 14 reader questions, eight drafts, varied reading engagement, and subject-specific competition descriptions. Editorial copy lives in `Backend/data/development-writing.js`; boundary examples live in `Backend/data/development-edge-cases.js`; `Backend/scripts/seed-development.js` creates and links the persistent records. Existing seed keys, routes, schemas, and presentation components are retained. The corrected first discovery title is reconciled on rerun so an older demo record is not duplicated.

The seed was applied to the configured development database on 2026-10-19. Its verification completed with at least the expected records; the database also contains older and independently seeded fixtures, so total collection counts can exceed this catalog. Re-running the seed refreshes records selected by their existing natural keys and should be done only in an isolated development environment.

### Varied engagement fixtures — 2026-10-19

The seed includes twelve additional reader personas and assigns deterministic, varied appreciation and comment relationships to released stories and shorts. Some items deliberately retain zero activity for empty-state checks. Displayed publication counts are reconciled to the actual relationship records after seeding, and a seed invariant requires multiple count levels in each format. The deterministic selection makes reruns idempotent; it does not change counts randomly on every execution. Future releases and the unpublished owner example are not given generated public engagement.

### Content boundary and rough-writing fixtures — 2026-10-19

The development catalog varies related tag counts and order without removing each ordinary story's main subject. Published tag counts include 0, 1, several intermediate values, and 20. Tags are trimmed, lowercased, and deduplicated like the editor; intentional typo tags remain searchable custom labels. The named examples below stay within the application's publishing limits:

| Find this title | What it exercises |
|---|---|
| `Wait.` and `Oh! 👀` | Very short story/short, no tags, empty-looking previews. |
| `A reading path with every tag I could think of` | Twenty normalized tags, mixed subject labels, and one long custom tag. |
| `I tried to explain why the old riverside footpath...` | Story title near 180 characters. |
| `What happens when thisisoneverylongunbrokenword...` | Unbroken title/body text and a long plain-text URL. |
| `A café, a coast, and a question: mañana? 🌊` | Accents, non-Latin scripts, emoji, and mixed-language tags. |
| `Headings, a quote, code, and one image in the same story` | All supported reading block types, inline emphasis, literal markup text, and wide code. |
| `The photo I forgot to check before publishing` | Valid image URL that fails to load, with descriptive fallback text. |
| `i think this is abit messy... maybe??` | Typo tags, repeated punctuation, extra spaces, and unfinished prose. |
| `The quick note that kept growing` | A 472-word short near the 500-word limit. |
| `wait, why is this sign here??` | Informal question with no tags or context; the other added question has a near-limit title, five tags, and two answers. |
| `OK`, `Still collecting...`, and the long collection title | One-item, empty, and twelve-item mixed collections; optional/long descriptions. |

Two rough drafts and one long-titled story series exercise Studio and series layouts. These are valid persisted states; malformed requests and prohibited content still belong in validation tests. The seed checks title, tag, block, word, description, and item limits before writing.

## Intentional boundaries

Fixtures do not activate provider behavior. Live payment, AI, email, and media actions require separate authorized configuration and fresh verification. Staff fixtures exercise review and recommendations only; destructive moderation enforcement remains unavailable until its verified lifecycle is active.

For a small Member Hub preview on an already seeded development database, run `npm run seed:member-preview` from `Backend/`. It adds two future-release posts and two upcoming workshops through the existing schemas without refreshing unrelated fixtures. It requires the demo authors and an explicitly named development database. Workshop joining URLs are example-only fixture values.

For one current competition without refreshing the full fixture set, run `npm run seed:ongoing-competition` from `Backend/`. It creates or refreshes the demo-owned “The Places That Shape Us” contest, closing in two weeks, with reader voting and no prefilled entries. It requires the seeded demo administrator and an explicitly named development database; reruns preserve any entries while refreshing the demo dates.
