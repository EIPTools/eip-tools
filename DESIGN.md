# DESIGN.md - EIP.tools

## Context

- Artifact type: docs/content site with a data-tool homepage.
- Positioning: technical, minimal, source-led.
- Audience: Ethereum developers, standards authors, researchers, and protocol readers. Primary action: search a proposal, read it, save it, or inspect proposal relationships.
- Adjectives: coherent, minimal, professional, scannable, credible.
- Visual word translations: coherent -> shared ETH.sh-style semantic tokens across every page. Minimal -> near-black base, defined edges, no decorative gradients. Professional -> restrained blue action color and clear table surfaces. Scannable -> row/card proposal blocks, compact metadata, predictable headings. Credible -> markdown source links, authors, statuses, and dependency graphs remain visible.
- Aesthetic essence: technical, dark, exact.
- Single-minded proposition: EIP.tools should feel like a focused standards workbench, not a marketing page.
- References: `~/blockchain/swiss-knife` for dark tool-page tokens, compact nav, semantic Chakra theme, defined edges, and restrained blue actions.
- Mode: dark. Density: balanced to dense.
- Constraints: Next.js app router, Chakra UI, no Tailwind, existing EIP/RIP/CAIP markdown rendering, WCAG 2.2 AA target, preserve search, reading list, graph, and proposal-fetch behavior.

## Aesthetic

- Direction: dark minimal developer-tool interface aligned to the ETH.sh tool-page system.
- Defining trait: one near-black app canvas with lighter surface ramps and light separators.
- Signature move: proposal metadata appears as compact source-led surfaces, with the document content constrained to a readable measure.

## Typography

- Display: Inter via `next/font/google`, matching the reference system. License: OFL.
- Body: Inter via `--font-inter`, matching the reference system. License: OFL.
- Mono: JetBrains Mono via `--font-jetbrains-mono`, for code, hashes, and data. License: OFL.
- Scale: reference tool scale, base 14px for UI, 16px for larger reading copy.
  - display: 48px / 56px
  - h1: 32px / 40px
  - h2: 24px / 32px
  - h3: 20px / 28px
  - body: 14px / 20px
  - body large: 16px / 24px
  - code: 13px / 20px
- Weights: 400, 500, 600, 700. Measure: proposal content follows the detail-page container width so markdown aligns with metadata surfaces. Tracking: 0 for body, slight negative only on headings from the reference.

## Color

- Strategy: professional blue actions on a neutral near-black canvas, matching `swiss-knife` and avoiding decorative color use. Status colors keep their meaning and always include labels.
- Distribution: 85 neutral / 15 blue action, with status colors used only for state.
- Status palette: Draft uses burnt amber `#9A5A18`; Review uses antique gold `#9A6D16`; Last Call uses muted green `#2F7D5A`; Final uses deep emerald `#287D49`. The warning/review family stays yellow-led, while green statuses stay calm on dark surfaces.
- Palette:
  - bg: oklch(0.14 0.006 285) | #0A0A0B
  - surface: oklch(0.18 0.006 285) | #111113
  - muted surface: oklch(0.23 0.008 285) | #18181B
  - fg: oklch(0.98 0.004 285) | #FAFAFA
  - muted: oklch(0.74 0.012 285) | #A1A1AA
  - quiet: oklch(0.55 0.014 285) | #71717A
  - border: oklch(1 0 0 / 0.10) | rgba(255,255,255,0.10)
  - accent: oklch(0.62 0.19 260) | #3B82F6
  - accent-fg: oklch(0.98 0.004 285) | #FAFAFA
  - success: oklch(0.72 0.17 145) | #22C55E
  - warning: oklch(0.80 0.16 80) | #F59E0B
  - error: oklch(0.64 0.22 25) | #EF4444

## Spacing, Radius, Shadow

- Spacing base: 4px scale.
- Radius: 6px for controls, 12px for larger surfaces.
- Shadow approach: defined edges first. Shadows are only for true overlays.

## Layout And Composition

- Grid: app-width content bands, max `container.xl` on homepage sections and `container.lg` on proposal pages.
- Rhythm: compact header, search band, scannable proposal sections, graph tool surface, daily proposal surface.
- Signature layout move: standards documents use a compact metadata block followed by markdown content aligned to the same detail-page measure.
- Density: balanced homepage, dense metadata and graph tools.
- Responsive: mobile-first, horizontal proposal rails remain scrollable.

## Components And States

- Buttons: primary filled blue for direct actions, secondary bordered for utility actions, ghost for low-emphasis controls. Hover changes surface or border, focus uses a blue ring.
- Inputs: filled dark surface, visible border, placeholder subdued, focus ring blue, invalid border uses semantic error.
- Tables: light row separators, left-aligned text, muted headers, no heavy cell grid.
- Overlays: drawers and modals use `bg.base` or `bg.subtle`, blurred dark overlay, focus handled by Chakra.
- Empty/loading/error: skeletons use dark surface colors; empty text uses muted tokens.
- Focus ring: `0 0 0 3px rgba(59,130,246,0.25)`.

## Motion

- Duration scale: 100ms instant, 200ms fast, 300ms normal, 500ms slow.
- Easing: cubic-bezier(0.4, 0, 0.2, 1).
- What animates: color, border, opacity, and occasional transform on buttons. No decorative page motion.
- Reduced motion: no required page motion beyond native Chakra transitions.

## Iconography

- Set: existing FontAwesome and Chakra icons, kept small and functional.
- Usage: icons support commands like bookmark, copy, search, and external links. Emojis are not used as visible UI icons in redesigned surfaces.

## Imagery And Graphic Device

- Mode: product/data surfaces and the existing Ethereum icon. No stock imagery.
- Rules: graphs and markdown assets are content, not decoration.
- Avoid: gradients, glassmorphism, blob backgrounds, stock illustrations.

## Dark Mode

- Base bg: near-black #0A0A0B, not pure black.
- Elevation ramp: #111113, #18181B, #27272A.
- Accent: desaturated professional blue, used sparingly.
- Border: lighter than surface via white alpha.

## Accessibility

- Contrast: semantic text tokens target AA on dark surfaces.
- Focus: visible on buttons, links, inputs, drawers, and modals.
- Keyboard: native buttons, links, inputs, Chakra modal/drawer behavior.
- Targets: controls are at least 32px high, with larger touch targets where space permits.
- Color independence: proposal statuses include text labels and prefixes, not color alone.

## Tokens

```css
:root {
  --font-display: var(--font-inter);
  --font-body: var(--font-inter);
  --font-mono: var(--font-jetbrains-mono);
  --color-bg: oklch(0.14 0.006 285);
  --color-surface: oklch(0.18 0.006 285);
  --color-muted-surface: oklch(0.23 0.008 285);
  --color-fg: oklch(0.98 0.004 285);
  --color-muted: oklch(0.74 0.012 285);
  --color-border: oklch(1 0 0 / 0.10);
  --color-accent: oklch(0.62 0.19 260);
  --radius-control: 6px;
  --radius-surface: 12px;
  --space-base: 4px;
}
```

- Adapter: Chakra UI semantic theme in `style/theme.ts`, backed by `style/tokens.ts`.

## Cards And Surfaces

- Top-level surfaces use `bg.subtle`, `border.default`, and `lg` radius.
- Nested panels use `whiteAlpha` or muted surfaces only when needed.
- Avoid card-in-card layouts; metadata and graph surfaces are framed tools.

## Slop Audit

- Date: 2026-07-02. Result: pass with one accepted reference constraint.
- Fixed tells: bright white cards, green footer border, emoji section headers, animated gradient notification underline, raw blue buttons, fixed-width detail pages, heavy table borders, old Poppins font, and raw scroll-to-top CSS.
- Accepted constraint: Inter is retained because the user explicitly requested the same visual system as `~/blockchain/swiss-knife`.
- Accessibility gate: visible focus, dark contrast tokens, native controls, and status text labels are preserved.

## Changelog

- 2026-07-02: Cached homepage trending proposals in localStorage and revalidated them in the background so repeat visits keep showing cards instead of skeletons.
- 2026-07-02: Reworked proposal-page dependency graphs from bright circular nodes into compact dark proposal tags with muted status fills, thin technical traces, and tool-like controls.
- 2026-07-02: Vertically centered single-line author names inside metadata chips when no social handle is available.
- 2026-07-02: Framed every proposal author as a consistent metadata chip, even when no GitHub or X profile is available.
- 2026-07-02: Added adjacent proposal numbers to previous/next detail-page tooltips while keeping the controls compact and icon-only.
- 2026-07-02: Moved the EIP-GPT summary accordion below the proposal metadata card so source details appear before generated summary content.
- 2026-07-02: Removed the Chakra `Code` wrapper from fenced markdown blocks and forced syntax-highlighter children transparent to eliminate extra grey backgrounds.
- 2026-07-02: Restyled markdown code blocks as a single dark surface with local syntax colors, compact copy action, horizontal scrolling, and normalized leading/trailing blank lines.
- 2026-07-02: Restored proposal markdown content to the full detail-page width so it aligns with metadata and graph surfaces.
- 2026-07-02: Embedded search into the single top navbar on proposal detail pages and kept the separate search band for non-proposal pages.
- 2026-07-02: Increased proposal title size on shared reading-list cards without changing compact homepage card density.
- 2026-07-02: Increased the shared reading-list page title scale so it reads as a primary page heading.
- 2026-07-02: Simplified the share reading-list modal by removing the nested link panel and redundant ready-state text.
- 2026-07-02: Centered and restyled the share reading-list modal with a stronger dark surface, bookmark count, framed link field, and cleaner copy action.
- 2026-07-02: Moved the reading-list share action to the left side of the drawer header so it no longer overlaps the close button.
- 2026-07-02: Restored the footer creator attribution as `by @apoorveth` while keeping the X social icon linked to `@EIPTools`.
- 2026-07-02: Updated footer X/Twitter branding to the EIPTools account and removed the redundant Project footer label.
- 2026-07-02: Removed the Trending proposals icon to keep the first homepage section more editorial and restrained.
- 2026-07-02: Moved the Trending proposals icon after the heading text while keeping other section icons leading.
- 2026-07-02: Reworked homepage section icons from boxed blue decorations into small monochrome inline glyphs to reduce generic AI-style visual noise.
- 2026-07-02: Added restrained outline icons to homepage section titles and the Random EIP action, replacing emoji-style visual cues with consistent iconography.
- 2026-07-02: Increased homepage section title scale to restore stronger hierarchy for proposal sections.
- 2026-07-02: Darkened positive status greens so Final and Last Call no longer feel overly bright against the near-black cards.
- 2026-07-02: Returned Review to the yellow status family with antique gold, preserving the green/yellow/yellow status language while separating it from Draft.
- 2026-07-02: Changed Review status from olive-gold to muted steel-teal to avoid the sickly yellow-green read while keeping it distinct from Draft.
- 2026-07-02: Muted Draft and Review status colors for dark-mode contrast, with Review moved from bright yellow to olive-gold for clearer separation from Draft.
- 2026-07-02: Increased horizontal padding on EIP status badges while preserving their compact vertical height.
- 2026-07-02: Matched the EIP dependency graph search action to the global search nested-radius treatment and removed its extra right-side slot gap.
- 2026-07-02: Applied the nested-radius rule to the search button: 12px input radius minus 4px inset gives an 8px inset action radius.
- 2026-07-02: Tightened the search submit button into a 32px inset action so its corners visually match the surrounding input radius.
- 2026-07-02: Made the global search compact at rest and restore the wider result surface only while suggestions are visible.
- 2026-07-02: Narrowed the global search input so it no longer dominates the header/search band on wider screens.
- 2026-07-02: Slimmed the homepage proposal rail scrollbars to a 4px subtle thumb with a transparent track.
- 2026-07-02: Fixed EIP.tools logo rendering in the header and footer by preserving the Ethereum mark's natural aspect ratio instead of forcing it into a square box.
- 2026-07-02: Revamped EIP.tools to the dark minimal ETH.sh-style system from `swiss-knife`; added semantic tokens, Chakra theme, Inter and JetBrains Mono, redesigned nav/search/footer/home sections/detail pages/markdown/graphs, and documented the design contract.
