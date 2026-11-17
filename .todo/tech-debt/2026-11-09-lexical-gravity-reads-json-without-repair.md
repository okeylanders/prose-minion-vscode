# Lexical Gravity Reads Model JSON Without Repair, and Loses Every Lens to One Fault

**Date:** 2026-11-09
**Status:** Open. Okey wants all four fixes below (2026-11-09).
**Priority:** Medium. A failed build wastes a paid call, loses lenses that were fine, and has no recovery path.
**Found by:** Okey, generating a lens for "unfinished score"

## Problem

Lexical Gravity reads its model replies with plain `JSON.parse`, and its
lens build is all-or-nothing.

- **Both readers skip the shared parser.** `LexicalGravityModelService`
  calls `JSON.parse(framed)` for the preview (line 147) and for the lens
  build (line 204). The house rule elsewhere is `parseModelJson`, used by
  the Lightbox, Proofread, Craft Flags and the helper.
- **One fault loses every lens.** `parseCandidates` requires exactly
  `BUDGET.lexicalBuildCandidates` (3) candidates, each validated. Any
  failure throws, and the raw reply goes to the rejected-response recovery
  (`prose-minion/recovery/`).
- **Nothing reads a saved reply back in,** so a writer can't recover the
  good lenses without help.

## The failure that found it

The reply, a well-framed `===LEXICAL_GRAVITY_LENSES_V2===` block of about
16,200 characters, failed to parse.

- **The slip.** In two of its three candidates, the model closed `attention`
  one brace early:

  ```
  "attention":{"foregrounds":[…]},"backgrounds":[…]}   ← written
  "attention":{"foregrounds":[…],"backgrounds":[…]}    ← meant
  ```

- **The evidence.** The reply has 74 `}` against 72 `{`. `JSON.parse` fails
  at character 8,780, where candidate 2's `"degrees"` follows a candidate
  that had already closed. Moving `backgrounds` back into `attention` in both
  makes the reply parse, with all three candidates whole.
- **Not the prompt's fault.** The prompt's example nests it correctly
  (`resources/system-prompts/lexical-gravity/00-build-lens.md`, pretty
  printed). The model wrote compact one-line JSON and slipped at the same
  spot twice.
- **Candidate 1 was valid** and was lost with the other two.
- **The workaround used:** Okey had Codex repair the saved reply by hand,
  and saved the lenses to his project.

## Why the shared parser alone wouldn't have saved it

`parseModelJson`'s `stray-closing-bracket` repair removes brackets only
*after* a complete top-level value (the trailing `}}}` case). A stray in the
middle is ambiguous: removing different braces gives different nestings with
the same content, which the content guard can't tell apart. Only the lens
schema knows `backgrounds` belongs in `attention`. So the fix is the shared
parser plus a schema-aware repair, as the Lightbox does with its
`misnested-member` repair (`LightboxBlockFormat`).

## Recommendation (Okey: all four)

1. **Read through the shared parser.** Both readers use `parseModelJson`
   (`@parsers/ModelJsonRepair`): code fences, trailing commas, trailing
   strays and curly-quote delimiters. Each repair is logged by its kind,
   never with text.
2. **A Lexical Gravity repair for this slip.** It is narrowly named and
   lives with the feature, never in `@parsers/*`, which must import no
   feature (`boundaries.test.ts`).
   - **When it applies:** an `attention` object holding only `foregrounds`,
     followed at once by a `backgrounds` member.
   - **What it does:** moves the closing brace back after `backgrounds`.
   - **The guard:** `modelJsonContentMatches` checks original and repaired.
     A repair that can't be checked moves nothing.
   - It is logged as its own kind.
3. **Keep the good lenses.** When the reply parses but some candidates fail
   validation, offer the valid ones with a note ("1 of 3 lenses couldn't be
   used"), instead of failing the build. Exactly 3 stays the ask; it stops
   being a gate.
4. **If the slip recurs, change the reply format the model writes.** Put
   `foregrounds` and `backgrounds` directly on `logic`, and have the reader
   map them back into `attention`. The saved lens format
   (`LEXICAL_GRAVITY_LENS_VERSION`) doesn't change, so saved lens files
   don't either. The prompt, its example and its sync test move together.

## Later: a reasoning repair by the helper (Okey's idea)

When the deterministic repairs above can't make a reply parse, the helper
agent could try. Give it the broken JSON and the schema, and ask for the
same JSON with its structure fixed.

- **The guard keeps a model repair honest.** `modelJsonContentMatches`
  accepts only a text whose strings and scalars are identical, in order, to
  the original's. So the model can move brackets and commas, and nothing
  else. The lens validator then checks the result.
- **The tension to settle.** The helper ADR (2026-11-05, D2) says a
  malformed reply "is never repaired into something the writer didn't see".
  That rule is about the helper's own replies, but a repair task needs its
  own ADR note saying why a guarded structural repair is allowed.
- **Cost.** This is a second, paid call on a long input, so it runs only
  after the deterministic repairs fail, and says so in the log.
- It is not part of this item's completion. It joins the helper's tasks
  when wanted.

## Related Files

- `packages/core/src/infrastructure/api/services/widgets/LexicalGravityModelService.ts`
  (`parseCandidates`, the preview reader)
- `packages/core/src/infrastructure/api/parsers/ModelJsonRepair.ts`
  (`parseModelJson`, `modelJsonContentMatches`)
- `packages/core/src/infrastructure/lightbox/LightboxBlockFormat.ts`
  (the schema-aware repair to model this on)
- `packages/core/resources/system-prompts/lexical-gravity/00-build-lens.md`
- `packages/core/src/application/services/workshop/widgets/lexicalGravity/LexicalGravityConfigCodec.ts`
  (`validateLexicalGravityLens`)
- `packages/core/src/shared/types/messages/recovery.ts` (the saved-reply notice)

## Completion Criteria

- [ ] The preview and lens readers go through `parseModelJson`, with each
      repair logged by kind.
- [ ] A fixture with this slip in two candidates (made-up *Alice*-style
      lenses, never the writer's) parses after the Lexical Gravity repair,
      with all three lenses. The content guard holds, and a variant the
      guard can't confirm moves nothing.
- [ ] A reply with one invalid candidate offers the valid ones, with a note.
- [ ] (If the slip recurs) the reply format is flattened. Saved lens files
      are untouched, and the prompt, example and sync test agree.
- [ ] Logs carry repair kinds and counts, never lens text or the query.
