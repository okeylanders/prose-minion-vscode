# Dictionary Chromatic Palettes — Implementation Handoff

**Date:** 2026-10-11 17:49 UTC

**Branch:** `claude/busy-curie-9x9nw7`, cut from `main` at `37a1d06` (the
spec commits). One PR into `main`. Not merged.

**Spec:** [feature-dictionary-chromatic-palettes](../.todo/features/feature-dictionary-chromatic-palettes/README.md)

**Current gate:** automated criteria pass; the manual Extension Development
Host checks in the spec are open, and no live provider call has been run.

## What landed

An optional **🎨 Chromatic Palettes** dictionary section. Each palette is a
`pm-palette` fence (`title:`, `kind: literal|evocative`, `note:`, then
`Color Name | #RRGGBB | short definition` lines). The Dictionary tab renders
it as a color strip plus one row per swatch: name, definition, hex.

1. **Contract** (`shared/constants/chromaticPalettes.ts`): the fence language
   and renderer bounds (8 swatches, 40-character names, 160-character
   definitions).
2. **Renderer** (webview): pure parser `utils/chromaticPalette.ts`;
   `components/dictionary/ChromaticPaletteBlock.tsx` with the module-level
   `DICTIONARY_FENCED_BLOCKS`; `MarkdownRenderer` and `StreamingContent` gain
   an opt-in `fencedBlocks` prop. Without the prop, rendering is the old
   single pass; with it, top-level tokens are split into sanitized runs and
   components. The DOMPurify config is unchanged; chip color goes through
   React's `style` prop from a strictly validated `#RRGGBB`.
3. **UI**: `DictionaryOptionSwitch` (extracted from the encyclopedia switch,
   neutral `pm-dictionary-option*` classes) and a second switch, persisted as
   `dictionaryIncludePalettes` (default on). Standard, Fast, and auto-run send
   `includePalettes`.
4. **Host**: `includePalettes` is opt-in (absent = off), resolved with the
   encyclopedia default in `resolveDictionaryEntryOptions`. Standard lookup
   computes section numbers (Palettes 16; Topic 16 or 17) and states the
   selection in system and user messages. Fast Generate adds the
   `chromatic-palettes` block; the Topic prompt moved to
   `17-topic-related-lexicon-block.md` unchanged. Workshop persona lookups pass
   `includePalettes: false`. Logs add `palettes=` and `paletteFences=`.

## Decisions

- Names and per-swatch definitions are first-class (Okey, 2026-10-11).
- The four open questions in the spec (placement, default on, RGB in the
  tooltip only, model-chosen evocative palettes) are implemented with their
  recommendations and can be overturned in review.
- No changelog entry: release preparation writes the changelogs.

## How it was built

The coordinator session committed the shared contract, then ran two isolated
worktree agents in parallel (renderer; host and prompts) while wiring the UI
itself, and integrated by cherry-pick. The prompt grammar guard checks every
example against the spec grammar and round-trips it through the webview
parser.

## Verification

At the integrated head: typecheck clean; 304 suites / 4,377 tests /
2 snapshots (`main` 299 / 4,257 / 2); lint 0 errors, 1,121 warnings
(`main` 1,116; all five new are `naming-convention`); build and
`verify:bundle` OK. See the spec's verification record.

## Follow-ups

- Manual EDH checks in the spec (copper, melancholy, although, dusk with
  context, all themes, narrow sidebar, streaming, copy/save, switch off,
  persona lookup).
- Watch live output for table-style swatch lines (`| Copper | #B87333 | … |`):
  the parser skips them by design, so a model that emits that shape would get
  code-block fallbacks.
