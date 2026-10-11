# Feature: Dictionary Chromatic Palettes

**Status**: Planned
**Priority**: Medium
**Estimated Effort**: Medium (one branch, one PR)
**Date Identified**: 2026-10-11
**Source**: Okey's design conversation, 2026-10-09 (concept mockup in
[`assets/concept-mockup.webp`](assets/concept-mockup.webp))
**Suggested Branch**: `feature/dictionary-chromatic-palettes`
**Precedent**: [Dictionary Topic & Related Lexicon](../../archive/features/feature-dictionary-topic-lexicon/README.md),
which added an optional, toggled dictionary section end to end in one change

## Summary

Add an optional **🎨 Chromatic Palettes** section to the Writer's Dictionary.
When it is enabled, a lookup returns one to three named color palettes. Each
palette has three to six named swatches, and the Dictionary tab renders them as
real color chips.

A lookup for *copper* might return a literal **Warm Copper** palette, an
**Aged Copper & Patina** palette, and an evocative palette for the word's
mood. A lookup for *melancholy* returns only evocative palettes.

**This is a writer's dictionary, so every color is named.** The name is the
main content, and the hex value is the reference that goes with it. Names
such as *verdigris*, *burnished copper*, and *oxblood* are color words a
writer can put straight into a sentence. A swatch with only a hex value is
not valid output and is never displayed.

## Problem / Motivation

The dictionary is strong on sound, sense, register, and texture. It does not
give a visual reference, so a writer describing a copper-roofed observatory or
a melancholy room still has to work out the colors elsewhere. Narrative
Texture already lists sensory tags and mood levers in words. Palettes add the
visual counterpart.

Standard Markdown cannot do this today. `MarkdownRenderer` sanitizes every
render with DOMPurify, which forbids the `style` attribute
(`FORBID_ATTR: ['style']`) and `<style>` tags on purpose. Model output is
untrusted, and CSS such as `background: url(...)` can act as a network beacon.
Asking the model for `<div style="background-color: …">` would be stripped,
and loosening the sanitizer would weaken every Markdown surface in the
extension.

## Why a Feature, Not an Epic

This is one cohesive vertical slice that follows an established pattern. The
Topic & Related Lexicon change added the same kind of optional section (an
entry option, prompt composition, a Fast Generate block, persona exclusion, a
persisted switch) and shipped as one commit of about 30 files. This feature
adds one new piece: an opt-in, validated way to render one fenced-block type.
That piece is contained enough to record here as a design decision rather
than in a separate ADR. **Write an ADR only if a second fenced-block renderer
appears**, because at that point the extension point becomes architecture.

## Behavior

- The Dictionary tab gains a second switch next to **Topic & Related Lexicon**:
  **🎨 Chromatic Palettes · Color swatches**. It persists with the dictionary
  form state and is disabled while a lookup is running. The Standard, Fast,
  and context-menu auto-run requests all carry the writer's choice.
- When the switch is on, the entry includes a `# 🎨 Chromatic Palettes`
  section after **🧠 AI Advisory Notes** and before the optional
  **📂 Topic & Related Lexicon** appendix (see *Placement*).
- Each palette is a `pm-palette` fenced block (see *Palette Grammar*). The
  Dictionary result view and the Dictionary streaming view render these blocks
  as swatch grids. Every other Markdown surface is unchanged.
- **Every swatch is a named color.** Each swatch shows its color name first,
  then the hex value as its reference. A name can be an established color term
  (*verdigris*, *sienna*, *oxblood*, *celadon*) or, when no established term
  fits, a descriptive phrase a writer could use in prose (*deep patina*,
  *lamp-lit amber*). Generic labels like "Brown 2" are never acceptable.
- **Literal vs. evocative.** A palette is `literal` when it shows colors the
  word physically names or implies (a material, a light, a substance) and
  `evocative` when it gives the word's mood or atmosphere. A word can get
  both kinds. Abstract words usually get only evocative palettes.
- Words with no meaningful color resonance, such as *although*, get the
  section heading and one plain sentence saying so, with no fence.
- Copy and Save keep the raw fences verbatim. Saved entries stay
  human-readable and appear as ordinary code blocks in any other Markdown
  viewer.
- Persona-initiated `dictionary.lookup` and `dictionary.full-entry` calls in
  the Workshop always disable palettes, whatever the Dictionary tab's switch
  says, just as they disable the encyclopedia. Personas cannot see color, and
  the Workshop thread and HTML transcript export do not render palette blocks.

## Palette Grammar

One palette per fence. Optional header lines (`key: value`) come first,
followed by one swatch per line as `Color Name | #RRGGBB`. The **name comes
first** because it is the content; the hex value is the reference.

The example mixes established color terms, shown with their conventional
values, with descriptive phrases coined where no standard term fits:

````markdown
```pm-palette
title: Warm Copper
kind: literal
note: Polished, metallic warmth (new pennies, sunlit pans, a lamp-lit forge).
Copper | #B87333
Bronze | #CD7F32
Sienna | #A0522D
Fawn | #E5AA70
Desert Sand | #EDC9AF
```

```pm-palette
title: Aged Copper & Patina
kind: literal
note: Oxidation and weathering; roofs, statues, and old pipes after decades of rain.
Russet | #80461B
Deep Patina | #577E73
Verdigris | #43B3AE
Weathered Bronze | #C0A47D
Ecru | #C2B280
```
````

Parsing rules. The parser is a pure function that takes the fence body and
returns `ChromaticPalette | null`:

- **Header keys** (case-insensitive): `title`, `kind`, `note`. All are
  optional. A missing `title` falls back to `Palette`. A `kind` other than
  `literal` or `evocative` drops the badge. Headers are matched only before
  the first swatch line.
- **Swatch lines** split on the **last** `|`. The name is trimmed and capped
  at 40 characters. The value is trimmed and must match `^#[0-9A-Fa-f]{6}$`
  exactly. It is normalized to uppercase. No 3-digit hex, `rgb()`, CSS color
  keywords, alpha, or `;`.
- **A swatch needs a name.** A line with an empty name is skipped, and so is
  a line whose name is just a color code (`#…`, `rgb(…)`). The dictionary
  never shows an unnamed color. The parser cannot tell whether a name is
  generic, so the prompt is responsible for that.
- Lines that do not parse are skipped. A palette is capped at **8** swatches;
  extras are ignored, which tolerates mild overgeneration.
- **Zero valid swatches → `null`**, and the fence falls back to the existing
  code-block rendering so the raw text stays readable.
- CRLF line endings, blank lines, and trailing whitespace are tolerated.

Why one strict value form: `#RRGGBB` can be checked with a single anchored
pattern, it is the most common form models produce, and the renderer derives
`rgb(r, g, b)` for display. The writer's original question was about RGB
values, so both forms are shown (see *Rendering*). The tolerance goes into the
metadata. The color value, which is the only thing that reaches a style, is
never tolerant.

## Rendering Design

### Decision: render palette fences as React components, behind an opt-in prop

`MarkdownRenderer` gains an optional prop that maps a fence language to a
React renderer, for example `fencedBlocks={{ 'pm-palette': PaletteBlock }}`.
Keep it a closed, typed registry rather than an open string map, in line with
the Workshop's closed widget registries.

- **Without the prop, or with no matching fences**, rendering takes exactly
  today's path: one `marked` pass, the same sanitizer, and one
  `dangerouslySetInnerHTML`. No other surface changes.
- **With the prop**, the renderer lexes once (`marked.lexer`) and splits the
  **top-level** tokens into runs. A `code` token whose `lang` matches the
  registry and whose body parses becomes a component. Every other run goes
  through `marked.parser` → `sanitizeMarkdownHtml` → `dangerouslySetInnerHTML`,
  unchanged. Keep a single `.markdown-content` root so existing descendant
  CSS still applies.
  - Gotcha: `marked.parser` resolves reference-style links from
    `tokens.links`. Copy `links` onto each run's token array.
  - Fences nested inside lists or blockquotes are out of scope. They render as
    code blocks.
- `PaletteBlock` sets each chip's color through React's `style` prop
  (`{ backgroundColor: hex }`) using a value that has already passed the
  strict hex check. This is a CSSOM property write on an element React
  creates. It is not sanitized HTML, so **the DOMPurify configuration does not
  change**. The webview CSP already allows inline styles
  (`style-src … 'unsafe-inline'` in `apps/vscode-extension/src/application/providers/webviewHtml.ts`).
- A validated `#RRGGBB` cannot carry `url(`, so the CSS-beacon concern in the
  sanitizer's comment still holds.
- Names, titles, and notes render as React text nodes and are escaped.

### Alternatives considered

| Option | Why not |
|---|---|
| Allow `style` in DOMPurify with a hook that keeps only `background-color` | Widens the sanitizer for every Markdown surface (Assistant, Search, Workshop) in exchange for one feature, and the hook becomes security-critical parsing of CSS. |
| `marked` extension emitting `data-color` attributes, plus a layout effect that applies colors after `innerHTML` | Works, but adds imperative DOM mutation after React commits and couples correctness to effect timing during streaming re-renders. The React-component split is easier to test. |
| Enable palette rendering globally in `MarkdownRenderer` | Every surface would render `pm-palette`, including the Workshop thread, whose HTML transcript export mirrors thread rendering ([ADR 2026-10-05](../../../docs/adr/2026-10-05-workshop-transcript-export.md)) and would then owe a matching host-side renderer. Opt-in keeps that obligation out of scope. |
| Model writes inline `<div style>` HTML | Stripped by the sanitizer, which is the right behavior. |

### Visual and accessibility requirements

- Each palette is a `<figure>` with a heading row: the title plus a
  **Literal** or **Evocative** text badge. A swatch grid follows, then a
  `<figcaption>` with the note.
- Each swatch shows a color chip with two lines of visible text below it,
  never on top of it, which avoids contrast problems on arbitrary colors. The
  **color name** is the primary line, in normal body text, wrapping rather
  than truncating. The **hex** is the secondary line, smaller and muted, in
  monospace. The chip has `role="img"` and
  `aria-label="Copper, #B87333, rgb(184, 115, 51)"`, and the same
  `rgb(…)` string appears as its `title` tooltip. Color is never the only
  carrier of information.
- The grid wraps for the narrow sidebar
  (`grid-template-columns: repeat(auto-fill, minmax(64px, 1fr))` or
  equivalent). The 5-wide row in the mockup is for a wide pane only.
- Chips get a 1px theme-token border so near-black and near-white swatches
  stay visible in dark, light, sepia, and Follow VS Code modes. Chip colors
  render literally, with no theme filter, opacity, or blend.
- Styles live in `packages/core/src/presentation/webview/index.css` next to
  the existing `pm-dictionary-*` rules and use the `pm-palette-*` prefix.

### Streaming

The Dictionary streaming view (`StreamingContent`) passes the same opt-in
prop through to `MarkdownRenderer`. Mid-stream, `marked` lexes an unclosed
fence as a code block that runs to the end of the input, so swatches appear
line by line. A half-arrived value such as `#CD7` fails validation and is
skipped until it is complete. The parser must never throw on truncated input.

## Placement

**Recommendation:** put **🎨 Chromatic Palettes** after **🧠 AI Advisory
Notes** and before **📂 Topic & Related Lexicon**.

- Sections 1–15 keep their numbering and wording byte for byte, which matches
  the precedent set by the encyclopedia change.
- The long encyclopedia stays last. Its "required final section" contract was
  the fix for the 2026-10-02 omission bug, which was caused by conflicting
  prompt emphasis about what comes last, so this placement keeps that
  contract intact.
- Palettes appear before the long encyclopedia text, so a writer does not
  have to scroll past it to find them.

Blueprint numbering is computed: Palettes is 16 when enabled, and Topic is 16
or 17 depending on whether Palettes is on. Fast Generate ordering becomes
`… ai-advisory-notes, chromatic-palettes, topic-related-lexicon`. The file
prefix is derived from block order (`DICTIONARY_BLOCKS.indexOf + 1`), so this
adds `16-chromatic-palettes-block.md` and renames
`16-topic-related-lexicon-block.md` to `17-…` with its content unchanged.

## Prompt Guidance

Full-lookup instructions and a short reference example go in a new
`dictionary-utility/03-chromatic-palettes.md`, loaded **only** when enabled,
the same way `02-encyclopedia-entry.md` is. The Fast block gets the same rules
in compact form.

- Use the heading `# 🎨 Chromatic Palettes`. Produce 1–3 palettes with 3–6
  swatches each, following the grammar exactly, one fence per palette.
- Choose literal and evocative palettes by the definitions in *Behavior*.
  Literal colors should be plausible for the real material or light. For
  example, `#B87333` is the conventional copper.
- **Name every swatch.** This is a writer's dictionary, so the color names are
  the vocabulary and the hex values only back them up. Prefer an established
  color term when one fits (*verdigris*, *sienna*, *oxblood*, *celadon*,
  *umber*), since those teach real color vocabulary. When none fits, coin a
  short descriptive phrase that works in a sentence (*deep patina*,
  *lamp-lit amber*). Never use generic labels ("Brown 2", "Light Copper 3"),
  bare color codes, or names that repeat within one palette.
- When a swatch uses an established term, its hex should be close to that
  term's conventional value, so the name and the chip agree.
- Give each palette a one-sentence `note` on its visual character and one way
  a writer might use it (scene lighting, wardrobe, setting, motif).
- Let the context excerpt steer evocative palettes. A night scene gets a
  night palette.
- Treat hex values as illustrative approximations. Do not claim Pantone,
  RAL, or other standard matches.
- When there is no meaningful color resonance, write the heading and one
  sentence, with no fence.
- Use *copper* as the reference example. It matches the concept mockup and
  is a word already used in live dictionary checks.

Apply the lesson from the encyclopedia omission: state the active selection
explicitly in both the system message and the user message. Audit every
existing "continue after AI Advisory Notes with Topic…" phrase in
`dictionaryUtility.ts` and `02-encyclopedia-entry.md` so the two optional
sections never give conflicting instructions about what comes next.

## Plumbing (file by file)

| Layer | Change |
|---|---|
| `shared/types/messages/dictionary.ts` | Add `includePalettes?: boolean` to `DictionaryEntryOptions`. **Absent means off** (opt-in), documented on the field, so non-UI callers (Workshop, a future console host) never receive fences they cannot render. The UI always sends an explicit boolean. |
| `DictionaryHandler.ts` | Forward the option on both routes. Prefer passing the entry-options object through instead of destructuring each flag, so the next option does not need handler edits. |
| `tools/utility/dictionaryUtility.ts` | Add a `{{PALETTES_BLUEPRINT_SECTION}}` placeholder (in `00-dictionary-utility.md` and the default fallback blueprint) before the encyclopedia placeholder. Compute the section numbers. Load `03-chromatic-palettes.md` only when enabled. State the selection in the system and user messages. The fallback instructions respect the choice. |
| `DictionaryService.ts` | Add the `chromatic-palettes` block. Generalize selection to a small optional-block → entry-option map instead of chained conditions. Progress, metadata, and usage/cache aggregation already count only selected blocks. The default budget (3,500 tokens / 15 s) is enough. Extend the sparse diagnostics with `palettes=enabled\|disabled` and a palette-fence count, with no content. |
| `resources/system-prompts/dictionary-fast/` | Add `16-chromatic-palettes-block.md`. Rename Topic to `17-…` with its content unchanged. |
| `WorkshopPersonaCapability.ts` | Pass `includePalettes: false` on both dictionary calls. |
| `useDictionary.ts` | Add `includePalettes` state and persist it as `dictionaryIncludePalettes` (default per Open Question 2). |
| `UtilitiesTab.tsx` | Add the second switch and pass `includePalettes` on Standard, Fast, and auto-run. Pass the palette registry to the result view's `MarkdownRenderer` and to `StreamingContent`. **The file is 490 lines**, so extract the switch markup into a small `DictionaryOptionSwitch` used by both switches, with neutral `pm-dictionary-option*` classes, rather than pushing the tab past 500. |
| `components/shared/MarkdownRenderer.tsx`, `StreamingContent.tsx` | Add the opt-in fenced-block prop and pass it through. |
| New: palette parser + `PaletteBlock` | Put them in a dictionary-scoped presentation module, for example `components/dictionary/` plus a pure parser under `utils/`. The parser has no React dependency. |
| `CHANGELOG.md`, `docs/CHANGELOG-DETAILED.md` | Add a user-facing entry, as the encyclopedia change did. |

`DictionaryService.ts` is already 695 lines, over the 500-line guideline,
before this change. This feature adds only a little to it and should not be
the branch that splits it. If selection logic grows beyond the small map,
extract the Fast Generate fan-out into its own collaborator and track that as
debt.

## Open Questions

1. **Placement.** Is *after AI Advisory Notes, before Topic* right, or should
   palettes sit next to 🪶 Narrative Texture, their nearest neighbor in
   meaning? Placing them there means renumbering blueprint sections 7–16,
   renaming ten Fast prompt files, and breaking the "original blocks keep
   their numbering" precedent. The recommendation is the end placement.
2. **Default.** Should the switch start **on** (matching the encyclopedia,
   and the cost is small at about 150–400 completion tokens) or **off**? The
   recommendation is on.
3. **Visible RGB.** The name and hex are always visible. Should `rgb(r, g, b)`
   be a third visible line, or appear only in the tooltip and accessible
   label? The recommendation is tooltip only, to keep chips compact in the
   sidebar.
4. **Evocative palette for a literal word.** Should *copper* always get one
   evocative palette alongside its literal ones, or only when the context
   excerpt invites it? The recommendation is to let the model decide, with
   the prompt encouraging one evocative palette when it adds something.
5. **Per-swatch gloss.** Established terms like *celadon* or *sang-de-boeuf*
   may be new to a writer. Should a swatch line be allowed an optional third
   field, a short gloss
   (`Verdigris | #43B3AE | the blue-green crust on weathered copper`), shown
   under the name? That would add a little vocabulary teaching, at the cost of
   longer output and taller swatches in the sidebar. The recommendation is
   to leave it out of the first version and rely on the palette `note`. If
   it's wanted, it is an additive change to the grammar.

## Out of Scope

- Click-to-copy hex or rgb values.
- Palettes in the Workshop thread, persona capabilities, or the HTML
  transcript export.
- Palette rendering on other tools' Markdown surfaces (Assistant, Context,
  Search).
- Exporting palettes as images or swatch files (`.ase`, `.gpl`).
- Color-space features beyond hex → rgb display, such as alpha, HSL,
  contrast scoring, or CSS color keywords as values.

## Completion Criteria

### Automated

- [ ] Parser covers valid fences; optional and missing `title`, `kind`, and
      `note`; last-`|` splitting; name trimming and capping; uppercase
      normalization; rejection of 3-digit hex, `rgb()`, CSS color keywords,
      and `#B87333; background:url(x)` values; skipping of unnamed swatches and
      of names that are only a color code (`#B87333 | #B87333`); the 8-swatch
      cap; zero valid swatches → `null`; CRLF; and truncated mid-stream input
      (never throws).
- [ ] `PaletteBlock` renders every swatch's name as visible text before its
      hex, and no chip is rendered without a name.
- [ ] `MarkdownRenderer` without the prop is unchanged. The existing
      sanitization test passes **unmodified**, and the DOMPurify config is
      byte-identical.
- [ ] `MarkdownRenderer` with the prop renders `pm-palette` fences as
      swatches, leaves other fences as code blocks, keeps one
      `.markdown-content` root, and falls back to a code block when a fence
      has no valid swatches. No rendered `style` contains anything other than
      a validated `background-color`, and an injection-attempt fence produces
      no `url(` anywhere in the DOM.
- [ ] `dictionaryUtility` composes the palette prompt only when enabled.
      Section numbers are correct in all four palette/encyclopedia
      combinations. The system and user messages both state the selection.
      The fallback respects it.
- [ ] `DictionaryService` selects blocks correctly in all four combinations,
      reports the right totals in progress and metadata, and resolves the
      `16-chromatic-palettes` and `17-topic-related-lexicon` prompt files.
- [ ] All 15 original Fast blocks, the original reference example, and the
      Topic block content are byte-identical apart from the Topic rename.
- [ ] `DictionaryHandler` forwards `includePalettes` on both routes.
      `WorkshopPersonaCapability` passes `false` on both calls.
- [ ] `useDictionary` persists and restores `dictionaryIncludePalettes`.
      `UtilitiesTab` tests cover the switch, its disabled-while-generating
      state, and the payloads for Standard, Fast, and auto-run.
- [ ] The repo's typecheck, lint (zero errors), `npm test`, and production
      build pass. No `from 'vscode'` in `packages/core/src`.

### Manual (Extension Development Host)

- [ ] *copper*, Standard and Fast: plausible literal palettes, readable
      notes. Every swatch is named, established color terms appear where they
      fit, coined names read as usable prose phrases, and no generic labels
      appear.
- [ ] *melancholy*: evocative palettes only.
- [ ] *although*: heading plus one sentence, no fence, no broken rendering.
- [ ] A word with context, such as *dusk* with a night-scene excerpt: the
      evocative palette follows the context.
- [ ] Dark, light, sepia, and Follow VS Code: near-black and near-white chips
      stay visible and labels are legible.
- [ ] Narrow sidebar: the grid wraps with no horizontal scroll.
- [ ] Streaming: swatches appear progressively, with no console errors and no
      flash of broken markup.
- [ ] Copy and Save: fences are preserved verbatim, and the saved file reads
      cleanly in VS Code's Markdown preview.
- [ ] The palette switch off removes the section in Standard, Fast, and
      auto-run. A persona-triggered lookup never includes palettes.

## Suggested Commit Sequence

1. Palette parser, `PaletteBlock`, and the `MarkdownRenderer` and
   `StreamingContent` opt-in, with tests. No visible change yet.
2. Entry option, handler forwarding, and persona exclusion.
3. Standard prompt (`03-chromatic-palettes.md`), placeholder, numbering, and
   `DictionaryUtility` composition.
4. Fast block, Topic rename, and service selection and diagnostics.
5. `DictionaryOptionSwitch` extraction, the palette switch, persistence, and
   wiring of the result and streaming views.
6. Changelog entries.

## Related Files

- `packages/core/src/presentation/webview/components/shared/MarkdownRenderer.tsx`
  (sanitizer and renderer)
- `packages/core/src/presentation/webview/components/shared/StreamingContent.tsx`
- `packages/core/src/presentation/webview/components/tabs/UtilitiesTab.tsx`
- `packages/core/src/presentation/webview/hooks/domain/useDictionary.ts`
- `packages/core/src/presentation/webview/index.css`
- `packages/core/src/shared/types/messages/dictionary.ts`
- `packages/core/src/application/handlers/domain/DictionaryHandler.ts`
- `packages/core/src/tools/utility/dictionaryUtility.ts`
- `packages/core/src/infrastructure/api/services/dictionary/DictionaryService.ts`
- `packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts`
- `packages/core/resources/system-prompts/dictionary-utility/`
- `packages/core/resources/system-prompts/dictionary-fast/`
- `apps/vscode-extension/src/application/providers/webviewHtml.ts` (webview CSP)
- Tests: `packages/core/src/__tests__/presentation/webview/components/shared/MarkdownRenderer.test.tsx`,
  `…/components/tabs/UtilitiesTab.test.tsx`, `…/hooks/domain/useDictionary.test.ts`,
  `…/infrastructure/api/services/dictionary/DictionaryService.test.ts`,
  `…/tools/utility/dictionaryUtility.test.ts`, `…/handlers/domain/DictionaryHandler.test.ts`,
  and the Workshop persona capability tests
