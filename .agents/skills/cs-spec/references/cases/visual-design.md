# Spec Case: Visual Direction & Style System ("好不好看")

Load this case **only** when establishing, rethinking, or rescuing visual aesthetics:
- **0→1 Greenfield UI** (no `DESIGN.md` or Design Token system exists yet);
- **Visual redesign / re-skin** of an existing product or key surface;
- **Brand, landing, editorial, or showcase pages** where aesthetic craft is a primary goal;
- **New visual component family** requiring deliberate aesthetic rules.

**Do NOT load this case** on routine Brownfield feature additions inside a product whose visual system (`DESIGN.md` / Design Tokens) is already settled—inherit existing tokens via [`interactive-ux.md`](interactive-ux.md) so features stay visually cohesive instead of reinventing styles per PR.

> **Why This Case Exists**: Left without explicit aesthetic direction, coding agents converge on **Visual AI Slop**—timid purple/indigo gradients on white/slate backgrounds, default `Inter`/`Roboto` typography with flat hierarchy, nested `rounded-xl shadow-sm` card-in-card clutter, ALL-CAPS eyebrow clichés, and random bouncy animations. Aesthetic tone and visual hierarchy are **What-level product decisions** that belong in `Spec` before code is written.

---

## 1. Calibrate Aesthetic Tone & Density to Product Purpose

Never apply flashy poster theatrics to an 8-hour-a-day productivity tool, and never apply sterile admin-table defaults to a brand or consumer showcase. Align on the product's visual archetype first (via Frontier Grilling with concrete options):

- **High-Frequency Workbench / B2B / Developer Tool**:
  - *Priority*: Precision, scannable information density, low visual fatigue, calm authority.
  - *Signature traits*: Subtle tonal surface elevation instead of heavy drop shadows, crisp hairline borders, strict grid alignment, `tabular-nums` (`font-variant-numeric: tabular-nums`) on all metrics/tables/timestamps, restrained semantic accents, snappy `120–180ms` feedback.
- **Consumer / Creative / Interactive Product**:
  - *Priority*: Approachability, clarity of focal action, tactile responsiveness.
  - *Signature traits*: Generous breathing room, clear primary-action contrast, expressive micro-interactions, warm or characterful surface palette, progressive visual focus.
- **Brand / Editorial / Showcase Surface**:
  - *Priority*: Memorability, storytelling rhythm, distinct point of view.
  - *Signature traits*: Bold display-to-body typographic contrast, intentional asymmetry or editorial grid pacing, atmospheric depth/texture, choreographed entrance and scroll rhythm.

## 2. Lock the Four Visual Pillars (Design Token Direction)

Commit to concrete choices (not vague adjectives like *"modern and clean"*):

1. **Surface & Color Architecture (4–6 Core Roles)**:
   - Define layered **background & surface elevation tiers** (canvas, primary surface, raised popover/dialog, subtle muted fill), **foreground contrast tiers** (primary, secondary, muted), **one decisive primary accent** (avoiding washed-out multi-stop purple/blue gradients), and **semantic status colors** (success, warning, danger, info). Specify light/dark mode stance upfront.
2. **Typography & Hierarchy**:
   - Choose an intentional **heading/display + UI body + monospace** pairing suited to the tone, with clear size, weight, tracking, and line-height contrast between page titles, section headers, body copy, and metadata labels. Mandate `tabular-nums` wherever numbers are compared or updated live.
3. **Spatial Rhythm & Framing Philosophy**:
   - Commit to a consistent spacing scale, border-radius character (sharp architectural vs. balanced vs. soft pill), and **one primary containment model** (e.g., tonal background shifts + hairline dividers *or* elevated cards—**never stack bordered cards inside bordered cards**).
4. **Motion & Tactile Restraint**:
   - Define where motion earns its keep: spatial orientation (drawer/popover origin), state confirmation, or choreographed hero reveal—banning gratuitous hover-scale bounces and sluggish `>300ms` transitions on everyday controls.

## 3. Align via a Native CSS-Variable HTML Style Tile (Never Bootstrap)

Aesthetic choices are hard to judge in prose, and **Bootstrap CDN sketches actively pollute visual taste** toward generic admin templates.

- When proposing or comparing visual directions, create a single-file HTML **Style Tile / Visual Swatch** in scratch space using **native CSS Custom Properties** (`--bg-canvas`, `--bg-surface`, `--fg-primary`, `--accent`, font pairings, radius/border tokens) and **realistic domain data** (never `Lorem ipsum`).
- Render a compact, representative slice (typography scale, color/surface swatches, primary/secondary buttons, and 1–2 realistic domain components in active/empty/status states) so the user can see, critique, and approve the exact visual feel before `/cs-build`.
- Treat the scratch HTML file as disposable once agreed; record the approved visual pillars and token semantics into Change Section 3.

## 4. Persist Visual Spec, Anti-Slop Guardrails & Lifecycle Handoff

Before closing `/cs-spec`, ensure Change Section 3 records:
- **Visual Direction & Token Semantics**: Approved archetype, density, color/surface roles, typography pairing/hierarchy, framing model, and light/dark stance;
- **Explicit Visual `Out of Scope` / Anti-Slop Guardrails**: Specific clichés refused for this product (e.g., *"No decorative purple-blue gradients, no nested bordered cards, no arbitrary hex colors or ad-hoc spacing outside semantic tokens"*);
- **Downstream Handoff**:
  - `/cs-build` (`frontend-architecture` case) turns these pillars into centralized **CSS Custom Properties / Design Tokens** before building feature views;
  - `/cs-merge` settles durable Greenfield/redesign visual rules and token routing into **Living Knowledge** (e.g., `DESIGN.md` registered in `.cstack/index.md`), turning the visual spec into the enforced baseline for future Brownfield work.
