# Feature: Workshop Persona Schematic (read-only)

- **Status:** Implemented (read-only) — 2026-07-21
- **Priority:** Medium
- **Design:** [docs/design/Prose Minion - Persona Schematic.html](../../../docs/design/Prose%20Minion%20-%20Persona%20Schematic.html)
- **ADR:** [2026-07-21 — Persona Schematic as a JSON Read-Model](../../../docs/adr/2026-07-21-persona-schematic-read-model.md)

## Problem / motivation

The persona browser (State A) let a writer pick a persona but never showed *how*
a persona is tuned. The Persona Schematic design adds State B: a read-only,
nine-panel configuration view of a persona's authored expression spec, opened
from a card's "More info" affordance.

## What shipped

- **Data:** `PersonaSchematic` type + a hand-authored `<id>.json` per persona
  (12 total), extracted from the persona expression prose. Loaded via
  `personaSchematics.ts` with a `satisfies` completeness/shape seam and a
  guardrail test. Prose stays canonical (see ADR).
- **UI:** `WorkshopPersonaSchematicModal` → `PersonaSchematicView` renders the
  identity hub + nine panels (`schematic/` folder), with hub → panel scroll/flash
  navigation, `prefers-reduced-motion` support, and CSS scoped under `.pm-schem`.
- **Wiring:** "More info" on each persona browser card opens the schematic
  (browser closes); Back / Esc / backdrop return to the browser.
- **Presentation-only:** accent colors + focus icons keyed by persona id, kept
  out of the authored JSON.

## Verification

- `npm run typecheck` (core + webview + ext) — green (validates all 12 JSON via
  `satisfies` + catalog completeness).
- `npm test` — 108 suites / 1013 tests green, incl.
  `personaSchematics.test.ts` (completeness/shape) and
  `WorkshopPersonaSchematicModal.test.tsx` (render smoke).
- `npm run build` — webview bundles the JSON + `schematic.css`.
- Not yet done: visual F5 pass in the Extension Development Host.

## Follow-ups (out of scope here)

- [ ] **Visual QA pass** (F5) across a few personas — verify hub math, gauge
      animation, constellation layout, and per-persona accent legibility.
- [ ] **Per-persona accent review** — the 10 non-golden accents are first-pass
      warm hues; a designer may want to tune them.
- [ ] **Persona config utility (future epic)** — makes the dashed `edit`
      affordances live; would likely invert canonicality to JSON-first and
      move the JSON to a runtime-loaded location (see ADR §2, §"future").
- [ ] **Prose ↔ JSON drift guard** — once the inversion ADR lands, generate the
      prompt markdown from the JSON so there is one source of truth.
- [ ] A few gauge calibrations (aperture openness, saturation level, some detent
      indices) were inferred from prose and can be tuned.
