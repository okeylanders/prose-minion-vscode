# Feature: Personas Can See the Writer's Lexical Gravity Lenses

**Date Identified:** 2026-11-09
**Status:** Idea. Small to medium: one read-only capability family. A short ADR, or an amendment to [ADR 2026-08-01](../../../docs/adr/2026-08-01-lexical-gravity-interpretive-grammar.md).
**Priority:** Medium
**Origin:** Okey, 2026-11-09

## In Okey's words

> I would like for the persona to read the saved Lexical Gravity
> configurations. A tool call just to see what the user has already created.

## Problem

A writer builds Lexical Gravity lenses: word fields generated from a
subject, saved to the project. A persona can't see them.

- **They live in `prose-minion/lenses/*.json`** (`LexicalGravityLensRepository`;
  at most 200 files of 256 KiB each). Built-in lenses sit beside them
  (`source: 'built-in'`).
- **`resource.*` can't reach them.** It reads only the configured
  context-path groups (`CONTEXT_PATH_GROUPS`: characters, locations, themes,
  things, chapters, manuscript, project brief, general).
- **The persona's widget recommendation knows only the six starters.** Its
  prompt says "Choose one starter lens slug from photography, music,
  mathematics, weather, botany, architecture"
  (`LexicalGravityRecommendation.ts:85`).
- **A persona sees a lens only once it's installed** as a standing
  directive (`LexicalGravityDirective`), and then only that one.

So a persona can't say "you already have a tidepools lens; it might suit
this scene", or build on the writer's own vocabulary.

## Idea

A read-only capability family, `lens`, shaped like `memory.*`:

- **`lens.catalog`** lists the library: each lens's name, variant,
  description, the subject it came from (`originQuery`), and whether it is
  built-in or the project's. It marks the lens installed in this room, if
  any. Files that don't read are counted ("2 lens files couldn't be read"),
  never shown.
- **`lens.read`** shows one lens by slug: its logic, three degrees of
  vocabulary, gradient, clichés, substitutions, metaphor and sample.

It is evidence like any other capability result: quoted, neutralized, in the
persona's next message. It never enters a system prompt.

## What is already in place

- **The library's reader.** `LexicalGravityLensRepository.list()` returns
  lenses and incompatible files, bounded, and handles no workspace and
  multi-root.
- **The capability machinery.**
  - `WORKSHOP_CAPABILITY_OPERATIONS` and `WorkshopCapabilityFamily`
    (`shared/types/workshopCapabilities.ts`) are exhaustive: a new family is
    a compile error everywhere until each switch handles it.
  - `WorkshopCapabilityXmlCodec` reads the grammar, and the grammar prompt is
    pinned by a sync test.
- **The pattern to copy.** `memory.catalog` / `memory.read`, and
  `WorkshopResourceCapability`'s catalog with its item bound.

## Design notes

- **Reading is safe where recommending isn't.** The recommendation's guard
  (`LexicalGravityRecommendation.ts:142-151`) says personas "may seed
  host-owned starters only, never name an arbitrary project lens whose body
  would enter a system prompt". A lens read as evidence doesn't cross that
  line, so this feature leaves the guard as it is.
- **Lens text is untrusted.** A project lens was written by a model when it
  was generated, from the writer's subject. Treat it like a resource read:
  bounded, neutralized in the capability-result frame, never instructions.
- **Bounds.** The catalog shows at most `PROMPT_BUDGETS` items, with the
  total. A lens read is bounded, and, once [Reads That Fit the
  Window](../feature-workshop-reads-fit-the-window/README.md) lands, fitted
  by its shared rule like every other read.
- **Who can call it.** Personas, through the `workshopPersona` catalog, like
  memory. It is not offered to tool sidecars.
- **Boundaries.** The capability reads lenses only through the repository,
  and it writes nothing.

## Open questions

- **Recommending the writer's own lens.** With the catalog, a persona will
  *know* the writer's tidepools lens but can still only recommend a starter.
  Either:
  - keep it: the persona names the lens in prose, and the writer opens it
    from the Lexical Gravity modal; or
  - let a recommendation name a project lens by slug. The host resolves it
    and opens it in the modal for review, and the body enters a system
    prompt only once the writer installs it, as today.

  The second needs the guard's reason revisited. Leaning: the first for v1.
- **Catalog only, or read too?** Okey asked "just to see what the user has
  already created", so the catalog alone may do. `lens.read` lets a persona
  talk about a lens's actual words.
- **`lens.search`?** With up to 200 lenses, find by subject or word, as
  `memory.search` does. Or is the catalog enough?
- **Other widgets.** Show vs. Tell, Creative Variations and Gesture
  Playground keep their own configs. Name the family for lenses only, or
  `widget.*` with lenses first?

## Completion Criteria

- [ ] `lens.catalog` lists built-in and project lenses with their names,
      variants, descriptions, subjects and source, marks the room's
      installed lens, and counts unreadable files. Bounded, with the total.
- [ ] `lens.read` (if kept) shows one lens by slug, bounded, and refuses an
      unknown slug in host words.
- [ ] The family joins `WORKSHOP_CAPABILITY_OPERATIONS` with every family
      switch, and the grammar prompt teaches it, pinned by its sync test.
- [ ] Results are neutralized evidence. A test shows lens text never reaches
      a system prompt through this path.
- [ ] No workspace, or a multi-root one, answers in host words, not an error.
- [ ] Logs carry counts and outcomes, never lens text or subjects.
      Fixtures use *Alice*-style made-up lenses.

## Related Files

- `packages/core/src/infrastructure/storage/LexicalGravityLensRepository.ts` (`list`)
- `packages/core/src/shared/types/messages/workshop/lexicalGravity.ts` (`WorkshopLexicalGravityLens`)
- `packages/core/src/application/services/workshop/widgets/lexicalGravity/LexicalGravityRecommendation.ts`
  (`BUILT_IN_LENS_SLUGS`, the guard)
- `packages/core/src/application/services/workshop/widgets/lexicalGravity/LexicalGravityDirective.ts`
- `packages/core/src/shared/types/workshopCapabilities.ts`
- `packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts`
  and `WorkshopResourceCapability.ts` (the pattern)
- `packages/core/src/application/services/workshop/WorkshopCapabilityXmlCodec.ts`
