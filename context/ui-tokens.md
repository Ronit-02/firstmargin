# firstmargin UI tokens

Last reviewed: 2026-10-06

## Token principles

- Tokens describe purpose, not one component.
- Components consume semantic tokens rather than raw colors.
- Light and dark themes maintain the same semantic hierarchy.
- Editorial content gets more breathing room than dense management interfaces.
- New arbitrary pixel, color, radius, and shadow values require a documented reason.
- CSS custom properties are the runtime source of truth. TypeScript exports may reference those properties but must not duplicate raw values.

## Color tokens

These values preserve the current warm editorial direction while making states explicit.

### Light theme

| Token | Value | Use |
|---|---:|---|
| `--color-canvas` | `#FFFFFF` | Main page background |
| `--color-canvas-subtle` | `#F4F2EE` | Secondary sections and quiet controls |
| `--color-surface` | `#FFFFFF` | Elevated or grouped surfaces |
| `--color-surface-hover` | `#F9F8F6` | Hover surface |
| `--color-border` | `#E8E4DC` | Standard border |
| `--color-border-subtle` | `#F0EDE6` | Low-emphasis separators |
| `--color-text` | `#191919` | Primary content |
| `--color-text-secondary` | `#6B6560` | Supporting content |
| `--color-text-muted` | `#8A837C` | Metadata; adjusted darker than the current token for readability |
| `--color-text-inverse` | `#FFFFFF` | Text on dark surfaces |
| `--color-action` | `#191919` | Primary action and selected state |
| `--color-action-hover` | `#333333` | Primary action hover |
| `--color-focus` | `#8A5A32` | Focus ring |
| `--color-success` | `#356A4A` | Confirmed success |
| `--color-warning` | `#8A5A20` | Warning and pending attention |
| `--color-danger` | `#A13F3F` | Destructive action and error |
| `--color-info` | `#3F6078` | Informational state |

### Dark theme

The background uses Reddit's classic dark grey (`#1A1A1B`) rather than the previous near-black. Secondary, grouped, and hover surfaces retain their relative brightness steps. Runtime names in `Frontend/src/styles/global.css` are `--color-bg`, `--color-bg-alt`, and `--color-text-inverted` for canvas, subtle canvas, and inverse text respectively.

| Token | Value | Use |
|---|---:|---|
| `--color-canvas` | `#1A1A1B` | Main page background |
| `--color-canvas-subtle` | `#232324` | Secondary sections |
| `--color-surface` | `#1F1F20` | Grouped surfaces |
| `--color-surface-hover` | `#282829` | Hover surface |
| `--color-border` | `#302F2B` | Standard border |
| `--color-border-subtle` | `#24231F` | Low-emphasis separators |
| `--color-text` | `#EEECE8` | Primary content |
| `--color-text-secondary` | `#B1AAA3` | Supporting content |
| `--color-text-muted` | `#8D867F` | Metadata |
| `--color-text-inverse` | `#1A1A1B` | Text on light action surfaces |
| `--color-action` | `#EEECE8` | Primary action and selected state |
| `--color-action-hover` | `#D0CEC9` | Primary action hover |
| `--color-focus` | `#D39A68` | Focus ring |
| `--color-success` | `#77B28C` | Confirmed success |
| `--color-warning` | `#D2A05F` | Warning |
| `--color-danger` | `#DA7A7A` | Destructive action and error |
| `--color-info` | `#82A9C1` | Informational state |

Use status colors sparingly. They communicate meaning and are not decorative accents.

## Typography

### Font families

- `--font-display`: `Libre Baskerville`, Georgia, serif
- `--font-body`: `DM Sans`, `Helvetica Neue`, sans-serif
- `--font-reading`: `Source Serif 4`, Georgia, serif
- `--font-mono`: `ui-monospace`, `SFMono-Regular`, Consolas, monospace

Libre Baskerville is reserved for editorial headlines, article titles, and occasional high-value section titles. DM Sans is used for navigation, UI, metadata, forms, and compact Short bodies. Source Serif 4 is used for full Story body and quote text in the reader and editor. Existing sizes and line heights apply to each surface.

### Type scale

| Token | Size / line-height | Use |
|---|---|---|
| `--text-display` | `clamp(2.5rem, 6vw, 5.5rem) / 0.98` | Marketing or major editorial statement |
| `--text-h1` | `clamp(2rem, 4vw, 3.25rem) / 1.08` | Page and article title |
| `--text-h2` | `clamp(1.5rem, 2.5vw, 2.25rem) / 1.16` | Major section |
| `--text-h3` | `1.375rem / 1.25` | Subsection |
| `--text-title` | `1.125rem / 1.35` | Card title |
| `--text-body-lg` | `1.0625rem / 1.75` | Long-form article body |
| `--text-body` | `0.9375rem / 1.6` | Default UI body |
| `--text-small` | `0.8125rem / 1.45` | Supporting labels and metadata |
| `--text-caption` | `0.75rem / 1.35` | Compact metadata; never essential long text |

Avoid essential content below 12 px. Article paragraphs target roughly 60–70 characters per line.

### Weight and tracking

- Regular: 400 for body copy
- Medium: 500 for controls and metadata emphasis
- Semibold: 600 for UI headings
- Bold: 700 for editorial headings
- Display headings: tracking between `-0.04em` and `-0.015em`
- Labels: tracking no more than `0.06em`; avoid excessive all caps

Use `text-wrap: balance` for short headings and `text-wrap: pretty` for prose where supported.

## Spacing

Base unit: 4 px.

| Token | Value |
|---|---:|
| `--space-1` | `0.25rem` |
| `--space-2` | `0.5rem` |
| `--space-3` | `0.75rem` |
| `--space-4` | `1rem` |
| `--space-5` | `1.25rem` |
| `--space-6` | `1.5rem` |
| `--space-8` | `2rem` |
| `--space-10` | `2.5rem` |
| `--space-12` | `3rem` |
| `--space-16` | `4rem` |
| `--space-20` | `5rem` |
| `--space-24` | `6rem` |

Default page gutters:

- Small: 16 px
- Medium: 24 px
- Large: 32–48 px depending on surface density

Section spacing is optical. Do not mechanically use equal top and bottom padding when content requires a different rhythm.

## Layout

| Token | Value | Use |
|---|---:|---|
| `--width-reading` | `44rem` | Article body |
| `--width-content` | `64rem` | Forms and focused application pages |
| `--width-wide` | `75rem` | Discovery feeds and dashboards |
| `--width-max` | `90rem` | Maximum full application frame |
| `--nav-height` | `3.5rem` | Global top navigation |
| `--sidebar-width` | `12.5rem` | Default desktop navigation width |

Responsive reference points:

- `sm`: 40rem / 640 px
- `md`: 48rem / 768 px
- `lg`: 64rem / 1024 px
- `xl`: 80rem / 1280 px
- `2xl`: 90rem / 1440 px

Components should respond to available space rather than target a device name. Prefer grid `minmax()` and container-aware composition where practical.

## Radius

### Button targets

Runtime `--control-target` is 44 px and `--control-target-large` is 48 px. Shared sm/md buttons use the former; lg uses the latter. sm changes horizontal padding and label scale without shrinking the interactive target. Icon-only shared buttons use the same value for minimum width. Native feature controls can consume `button-target` without changing their existing appearance. The explicitly approved desktop Join link keeps its separate 36 px minimum. Detailed style/size APIs are owned by the UI registry; use theme-aware inverted text on action backgrounds.

| Token | Value | Use |
|---|---:|---|
| `--radius-xs` | `0.25rem` | Small indicators |
| `--radius-sm` | `0.375rem` | Inputs and compact controls |
| `--radius-md` | `0.625rem` | Buttons and menus |
| `--radius-lg` | `0.875rem` | Cards |
| `--radius-xl` | `1.25rem` | Hero media and major panels |
| `--radius-round` | `999px` | Avatars and true pill controls only |

Do not use the same radius everywhere. Nested elements use a smaller radius than their parent surface.

## Borders and shadows

- Default border: 1 px solid `--color-border`
- Quiet divider: 1 px solid `--color-border-subtle`
- Focus ring: 2 px `--color-focus` plus a 2 px canvas offset
- `--shadow-menu`: `0 0.5rem 1.5rem rgba(42, 36, 30, 0.12)`
- `--shadow-float`: `0 1rem 3rem rgba(42, 36, 30, 0.16)`

Cards do not receive shadows by default. Use elevation only for overlays, floating controls, and surfaces that genuinely sit above content.

## Motion

| Token | Value |
|---|---:|
| `--duration-fast` | `120ms` |
| `--duration-normal` | `200ms` |
| `--duration-slow` | `320ms` |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` |
| `--ease-emphasized` | `cubic-bezier(0.2, 0.8, 0.2, 1)` |

- Animate `transform` and `opacity` when possible.
- Pressed controls may translate by 1 px or scale to 0.98.
- Content animation must not delay access to information.
- Respect `prefers-reduced-motion`; remove nonessential transforms and continuous motion.

## Layering

| Token | Value | Use |
|---|---:|---|
| `--z-base` | `0` | Page content |
| `--z-sticky` | `20` | Sticky toolbars |
| `--z-nav` | `40` | Global navigation |
| `--z-popover` | `60` | Menus and popovers |
| `--z-dialog` | `80` | Dialogs and drawers |
| `--z-toast` | `100` | Notifications |

Do not introduce arbitrary values such as 9999.

