# Concept Spring: Gesture Dictionary — Semantic Runway for the Gesture Playground

**Status**: Concept spring (prompt drafted, not wired)
**Classification**: Prompt design — Gesture Playground generation upgrade
**Depends on**: Widget host + Gesture Playground (Sprint 01)
**Prompt draft**: `packages/core/resources/system-prompts/gesture-dictionary/00-gesture-dictionary.md`
**Reference example**: `packages/core/resources/system-prompts/gesture-dictionary/01-gesture-dictionary-example.md`

## Product idea

The current Gesture Playground prompt asks the model to jump straight from a
target phrase to a JSON menu. This concept inserts a **full semantic runway**
first: one model call produces a substantial writer-facing Gesture Dictionary
in Markdown (a gesture-native sibling of the Writer's Dictionary), then
synthesizes the strictly validated JSON menu *from* that completed scan, in
the same response.

The dictionary is chain-of-thought made writer-facing: it is both a
deliverable the writer can read and the conditioning material that lifts menu
quality. Cost efficiency is explicitly secondary.

## The rhyme question (resolved as Sound & Rhythm on the Page)

The original spec dropped the Writer's Dictionary Soundplay & Rhyme block as
lexical-only material. The counter-argument (Okey): sound may influence the
actual gesture re-wording. Both are right about different halves:

- Rhyme *families* are malformed for gestures — a multiword beat like "his
  eyes stretched wide" has no perfect rhymes, and listing rhymes for "wide"
  is dictionary trivia that won't survive into a rewording.
- The *sound layer* absolutely shapes the re-word: consonant texture of
  candidate verbs, syllable weight, alliterative partners that knit a new
  line to the surrounding prose, and the sentence-rhythm shape of the moment
  (clipped fragment vs. suspended line). That was always the live part of
  the old block — the "meter note" — and it is exactly the craft that decides
  between `stopped`, `stalled`, and `stilled`.

So the section is **kept, transformed**: `🎵 Sound & Rhythm on the Page`,
explicitly instructed to serve the re-wording and to skip rhyme lists for
their own sake. In the worked example this section is load-bearing: it notices
the *str-* friction cluster in "stretched," ties the `st-` verb family to
"sewing" and "saucers" already in the passage, and flags that the paragraph's
closing simile forbids a second long lyric line — all of which visibly steers
the menu options.

## Section order rationale

The thirteen dictionary sections run comprehension → mechanics → meaning →
context → possibility → pressure → freshness → synthesis:

1. **🎬 The Beat** first, because everything downstream conditions on the
   dramatic function that must survive rewording — it is the contract.
2. **🫀 Physical Mechanics** before readings: what a body actually does
   (onset, decay, visibility, voluntary/autonomic) grounds every later claim
   and kills armchair anatomy in the menu.
3. **🔍 Reading Explorer** is the sense-distinction heart (the Writer's
   Dictionary's Sense Explorer, translated), ending by naming which readings
   *this* scene requests — the first explicit act of scene-conditioning.
4. **🗣️ Register / 👁️ POV / 🧰 Pathways / 🎭 Character** widen the option
   space from the scene inward: how loudly it reads, who perceives it, where
   else it can live, how this body does it.
5. **🧭 Gradients and 🎵 Sound & Rhythm** are tuning instruments — they only
   make sense once the option space exists.
6. **🗺️ Genre → ⚠️ Cliché → 🌱 Freshness → 🎯 Scene Synthesis Brief** is the
   deliberate tail: convention pressure is named *before* the escape routes,
   and the synthesis brief is the final text before the JSON so recency bias
   works for the writer. A model that reads clichés last regurgitates them;
   a model that reads scene-specific opportunities last mines them. The
   cliché → freshness → synthesis ordering is the single most important
   sequencing decision in the prompt.

## Compliance and framing risks

Note: the `widget` scope currently defaults to `anthropic/claude-haiku-4.5`,
so the fast-model column is the default reality, not a hypothetical.

**Fast models (Haiku-class)**

- *Sentinel drift* — added spaces, bold, or fenced sentinels. Mitigated by
  "spelled exactly / alone on its own line"; parser should still match
  sentinels with tolerant whitespace.
- *Text outside the protocol* — greetings or a closing summary after the last
  sentinel. Prompt forbids it; parser should ignore trailing/leading noise
  outside sentinel spans rather than reject.
- *Padding to hit the word target* — mitigated by the "never pad / short
  sections beat filler" rule and the 800–1,200 floor for simple targets.
- *Section skipping or icon mangling* — acceptable degradation for the
  writer-facing Markdown (it is not machine-parsed); only the menu is
  fail-closed.
- *Example bleed* — copying the exemplar's kitchen/swimmer imagery into
  unrelated scenes if `01` is loaded into the system message (same known risk
  as the current benchmark JSON, at larger scale). See integration note 5.
- *JSON wrapped in fences* — forbidden in-prompt, but the parser should strip
  fences defensively (the current parser already does).

**Reasoning-heavy models**

- *Runway evaporation* — the biggest structural risk: the model does the
  semantic scan in hidden reasoning and emits a thin visible dictionary,
  defeating both deliverables. Mitigated by the charter's explicit "not
  scratch work, not hidden reasoning — both parts must appear in the visible
  response."
- *Meta-commentary* — restating the protocol or explaining compliance;
  forbidden by "no text outside it."
- *Over-length dictionaries* crowding the menu against `maxTokens` — the
  ~2,200-word ceiling exists to protect the menu, since menu-last means
  truncation destroys the actionable half. If truncation is observed in
  practice, raising `maxTokens` (below) is the first lever, not reordering.

## Recommended limits

- **Dictionary**: target 1,500–2,000 substantive words; floor ~800 for simple
  targets; hard ceiling ~2,200 (≈3,000 tokens) to protect the menu.
- **Menu**: 4–6 groups (matches `gestureMenuGroups: 6`), 3–5 options per
  group (matches `gestureOptionsPerGroup: 5`), options under 220 characters
  (matches `gestureOptionCharacters`). Headings: advise ~8 words; validation
  can keep sharing the 220-char bound.
- **maxTokens**: raise 10,000 → **14,000** (worst-case dictionary ~3,000
  tokens + pretty-printed menu ~900 + fast-model verbosity headroom).
- **Temperature**: consider 0.9 → **0.85**. High temperature is right for the
  menu's divergence but raises composite-protocol drift on the fast default;
  0.85 is a hedge, and regenerate remains the recovery path either way.
- **Writer instructions input**: new budget key, suggest ~1,000 characters
  (`gestureWriterInstructionsCharacters`).

## Integration notes (production changes this concept requires; none made)

1. **Parser rewrite** — the current `parseMenu` greedy `\[[\s\S]*\]` match
   would swallow the dictionary's Markdown brackets, and the menu is now an
   object (`{"version":1,"groups":[...]}`), not a bare array. New parse:
   extract sentinel spans, JSON-parse the menu span, validate `version` and
   `groups` with the existing fail-closed bounds; reject wholesale on any
   violation, as today. The dictionary span ships to the webview as display
   Markdown — never machine-parsed, never blocking.
2. **Fourth input** — the modal and `GestureMenuRequest` carry
   target/context/notes today; writer instructions needs a field, a budget
   cap, and a labeled block in the user message. The prompt already treats it
   as optional, so the widget works before and after the UI lands.
3. **Commit rail unchanged** — the dictionary is exploration cloud. Per the
   Sprint 01 doctrine, only selections + note ride the rail at commit; the
   dictionary must not enter `buildGestureDirective`.
4. **UI surface** — the dictionary needs somewhere to live in the modal (a
   collapsible pane above the menu is the obvious shape). Menu-first
   rendering with the dictionary behind a disclosure keeps the pick-flow
   fast while honoring "writer-facing deliverable."
5. **Exemplar loading is optional** — `00` alone is a complete instruction
   set. Loading `01` too (the dictionary-utility pattern) buys structural
   fidelity on the fast default at the cost of input tokens and style-bleed
   risk. Suggested posture: load both for `haiku`-class widget models; `00`
   alone when the widget scope is pointed at a stronger model.
6. **Regenerate stays cheap-ish** — one call still produces everything;
   re-roll semantics are unchanged.
