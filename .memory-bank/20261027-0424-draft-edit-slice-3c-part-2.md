# Draft Edit Slice 3c, part 2: register shift

**Date:** 2026-10-27
**Branch:** `claude/upbeat-galileo-y1l4yf`, restarted from `epic/lightbox` at
`f7b0c851` (the PR #177 merge: Slice 3c part 1, the Craft Flags pass and
cliché).
**Decision record:** ADR 2026-10-21, "Amendment 2026-10-26: Slice 3c",
"Part 2: register shift" (`bc7086fe`).
**Slice doc:** `.todo/epics/epic-draft-edit-2026-10-25/slice-3c-craft-flags.md`,
"Part 2: as built".

## The writer's decision

The register call names the chapter's register itself, in its reply,
rather than a separate register-note call or a host measure of formality.
Asked 2026-10-27, with the recommended option chosen.

## What was built

- **Category `register`** in `CRAFT_FLAG_CATEGORIES`. Kinds `period`,
  `slang`, `jargon`, `ornate` (`REGISTER_SHIFT_KINDS`,
  `REGISTER_SHIFT_DEFINITIONS` in `domain/models/CraftFlag.ts`).
- **The register line:** the reply's root `register`.
  - Required when the reply has flags (malformed ones count); otherwise the
    reply is rejected and saved for recovery.
  - Held to `craftFlagPhrasing` except the digit rule, so a period's years
    are allowed; withheld and counted when it breaks the fence.
  - Clipped to `registerCharacters` (160).
  - Carried on each finding and issue, ending the note: "The chapter's
    narration: …".
- **Root fields per category** (`ROOT_FIELDS`): a cliché reply's `register`
  is ignored and counted.
- **Speech** is left alone (`CRAFT_FLAG_LEAVES_SPEECH.register`). Free
  indirect discourse and anachronism are the prompt's rules.
- **Prompts:** `craft-flags/20-register.md` and `21-register-example.md`.
  The example adapts *Alice*, its passage setting its own summer (1862),
  with an ornate image, a boardroom phrase, a narration "okay" (slang: the
  word dates from 1839, so it is no anachronism there, PR #178 N-01) and
  "on autopilot" (period). The Rabbit's "okay" in speech is left alone.
- **`proseMinion.craftFlags.categories`:** array, both on by default, read
  at the gesture through `CraftFlagsCommandHost.craftFlagCategories()`, and
  normalized by `craftFlagCategoriesOf`. None on refuses the run.

## Verification

- Mutations: 12, all caught. They cover the line being required, the years
  allowance, root fields, the fence, the clip, the withheld count,
  malformed flags needing a line, the speech drop, the message, the
  placement copy, refusing with none on, and canonical order.
- Node 18 mirror: typecheck, lint (0 / 1,133) and build pass; 574 suites /
  8,089 tests / 59 snapshots after N-01 (base 573 / 8,054).
- Astra's review (`6342688e`): no blocking findings; N-01 (P3), the worked
  example's period flag on "okay" was historically wrong, fixed.

## Follow-ups

- The fixture run's hits and false positives, for cliché and register.
- Gesture strain (part 3), then continuity (part 4); then Slice 3b part 3.
