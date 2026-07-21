# ADR 2026-07-21: Persona Schematic as a JSON Read-Model

- **Status:** Accepted
- **Date:** 2026-07-21
- **Related:** [ADR 2026-07-20 — Persona Interaction Modes & Expression Profiles](2026-07-20-workshop-persona-interaction-modes-and-expression-profiles.md), [ADR 2026-07-09 — Workshop Persona-Hosted Conversations](2026-07-09-workshop-persona-hosted-conversations.md)
- **Design source:** [docs/design/Prose Minion - Persona Schematic.html](../design/Prose%20Minion%20-%20Persona%20Schematic.html)

## Context

The approved Persona Schematic design turns each Workshop persona's authored
expression spec into a read-only "configuration schematic" (State B of the
persona browser): a nine-panel view — identity hub, trait tensions, turn-taking
signature, personal aperture, verbal palette, lexical gravity, communication
gradients, trait pressure, signature floor.

Every field that view renders **already exists in the repo — but as prose**,
split across three sources per persona:

- `WORKSHOP_PERSONA_CATALOG` (typed) — identity (label, specialty, description).
- `resources/system-prompts/workshop-personas/expression-profiles/<id>.md` —
  tensions, turn-taking, aperture, verbal palette, saturation.
- `resources/system-prompts/workshop-personas/expression-calibrations/<id>.md` —
  lexical gravity, communication gradients, trait pressure, signature floor.

Those markdown files are **canonical and load-bearing**: they are injected
verbatim into persona system prompts by the assembly chain ADR 2026-07-20 just
stabilized (`workshopPersonaSystemPromptPaths`). The schematic needs the same
content as **typed structured fields**. Something has to bridge prose → structure.

## Decision

**1. A JSON read-model, hand-authored per persona.** Each persona gets a
`packages/core/src/shared/personas/schematics/<id>.json` — a structured
extraction of its prose, typed by `PersonaSchematic` and loaded through a
`satisfies Record<WorkshopPersonaId, PersonaSchematic>` seam
(`personaSchematics.ts`). JSON (not a TS constant) because the roadmap wants a
future inline persona-config editor that reads/writes these files, and because
generating prompts *from* structured data later is far cleaner than from code.

**2. The prose stays canonical; JSON is a derived read-model — for now.**
This work does **not** touch the prompt-assembly path. Today the direction is
`prose (canonical) → JSON (extracted, read-only UI)`. A future ADR may invert it
to `JSON (canonical) → generated prompt markdown + a live config utility`, at
which point the design's dashed `edit` affordances become real. Until then:
**edit the prose, then refresh the JSON.**

**3. Validation seam.** JSON has no compile-time type safety on its own, so
correctness is enforced two ways: the loader's `satisfies` clause (structural
assignability + catalog completeness, at build time) and a companion test
(`personaSchematics.test.ts`: non-empty required content, detent indices within
their stop arrays, no missing/extra personas).

**4. Presentation concerns stay out of the JSON.** Accent colors and focus icons
are design, not persona spec — they live in the presentation layer keyed by
persona id (`personaSchematicChrome.ts`, `WORKSHOP_PERSONA_FOCUS_ICONS`).

**5. The schematic is its own modal.** Rather than the mockup's single-shell
view-flip (a prototype convenience), State B is a separate, roomier
`WorkshopModalShell` consumer (like `WorkshopToolsModal`), opened by a card's
"More info" affordance; Escape / backdrop / "Back to personas" all return to the
browser (State A).

## Consequences

**Positive**
- The whole feature ships as an additive, read-only surface — zero risk to the
  prompt-assembly path or persona behavior.
- All 12 personas are covered; the build fails if a persona is missing or a JSON
  drifts from the type.
- The JSON is exactly the shape a future config utility and a future
  prompt-generation step want, so neither is a rewrite.

**Negative / risks**
- **Drift:** while prose is canonical and JSON is derived, the two can disagree
  if the prose changes and the JSON isn't refreshed. Mitigation today is
  documentation (this ADR + the source-policy header in `personaSchematic.ts`);
  the future inversion removes the duplication entirely. The blast radius is low
  — a stale field shows in a read-only viz, not in a shipped prompt.
- A few schematic gauge values (aperture openness, saturation level, some detent
  indices) are visual calibrations inferred from prose, not stated verbatim.
  They are authored judgments, easily tuned.

## Alternatives considered

- **Hand-authored TS constant.** Type-safe for free, but a dead end for the
  editor roadmap (rewriting `.ts` programmatically) and for prompt generation.
- **Parse the markdown at load.** Single source of truth, but the prose is only
  semi-uniform (Penny/Edna differ from Margot; "NONE" fields); a heading-based
  parser is brittle — the "let the model be the trash compactor" trap.
- **Restructure the persona source now (single source of truth).** The correct
  long-term shape, but it perturbs the prompt-assembly path ADR 2026-07-20 just
  settled, to feed a read-only visualization. Deferred to the future inversion
  ADR — tail should not wag dog.
