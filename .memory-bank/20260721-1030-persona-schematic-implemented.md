# Persona Schematic implemented (read-only) — 2026-07-21

Branch: `claude/workshop-persona-interaction-modes-7ssg6k`

## What landed

Implemented the approved [Persona Schematic design](../docs/design/Prose%20Minion%20-%20Persona%20Schematic.html)
as State B of the Workshop persona browser: a read-only, nine-panel persona
configuration schematic opened from each card's "More info" affordance.

## Key decisions (see [ADR 2026-07-21](../docs/adr/2026-07-21-persona-schematic-read-model.md))

- The schematic content already existed as **prose** across the persona
  `expression-profiles/` + `expression-calibrations/` markdown. Modeled it as a
  **hand-authored JSON read-model** (`packages/core/src/shared/personas/schematics/<id>.json`,
  typed by `PersonaSchematic`, loaded via `personaSchematics.ts` with a
  `satisfies` seam).
- **Prose stays canonical** (it feeds prompts per ADR 2026-07-20); JSON is
  derived and read-only. Prompt-assembly path was NOT touched. A future ADR may
  invert this (JSON-canonical + a live config editor).
- JSON (not a TS constant) chosen for the future config-utility + prompt-gen
  roadmap. Accent colors/icons kept in the presentation layer, not the JSON.
- The 10 non-golden persona JSONs were extracted from prose by parallel fast
  (haiku) subagents against Margot/Penny golden references; 5 needed a
  curly-quote fix (unescaped inner double-quotes). All 12 validated.

## Files

- Data: `shared/personas/personaSchematic.ts`, `personaSchematics.ts`,
  `schematics/*.json` (12), `presentation/.../schematic/personaSchematicChrome.ts`.
- UI: `presentation/.../schematic/` — `WorkshopPersonaSchematicModal`,
  `PersonaSchematicView`, `SchematicHub`, `SchematicConstellation`,
  `SchematicParts`, `schematic.css`.
- Wiring: `WorkshopPersonaBrowserModal` (+ "More info" prop/button),
  `WorkshopApp` (`schematicPersonaId` state + modal), `workshop.css` (trigger).
- Tests: `__tests__/shared/personas/personaSchematics.test.ts`,
  `__tests__/presentation/webview/components/workshop/WorkshopPersonaSchematicModal.test.tsx`.

## Verification run

- `npm run typecheck` (core + webview + ext): green.
- `npm test`: 108 suites / 1013 tests green.
- `npm run build`: webview bundles JSON + `schematic.css`; verify-bundle OK.
- **Not done:** visual F5 pass in the Extension Development Host.

## Follow-ups

Tracked in [.todo/features/feature-workshop-persona-schematic](../.todo/features/feature-workshop-persona-schematic/README.md):
visual QA, per-persona accent tuning, the persona config utility (future epic),
and a prose↔JSON drift guard once canonicality inverts.
