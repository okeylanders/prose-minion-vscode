# Tools

> **Status**: Current as of v2.0.1. Tool implementations live in `packages/core/src/tools/` and supporting application services under `packages/core/src/infrastructure/api/services/`.

## Overview

Prose Minion includes **11 integrated prose tools** organized in clean architecture — 7 AI-powered (require OpenRouter API key) and 4 deterministic (work offline, no API key).

### AI-Powered Tools (require OpenRouter API key)

| # | Tool | Model Scope | Location |
|---|------|-------------|----------|
| 1 | **Dialogue Microbeat Assistant** | Assistant | `tools/assist/dialogueMicrobeatAssistant.ts` |
| 2 | **Prose Assistant** | Assistant | `tools/assist/proseAssistant.ts` |
| 3 | **Context Assistant** | Context | `tools/assist/contextAssistant.ts` |
| 4 | **Dictionary Utility** | Dictionary | `tools/utility/dictionaryUtility.ts` |
| 5 | **Category Search** | Category Search | `infrastructure/api/services/search/CategorySearchService.ts` |
| 6 | **Proofread** | Proofread | `infrastructure/api/services/proofread/ProofreadService.ts` |
| 7 | **Craft Flags** | Craft Flags | `infrastructure/api/services/craftFlags/CraftFlagsService.ts` |

### Measurement Tools (no API key required)

| # | Tool | Location |
|---|------|----------|
| 8 | **Prose Statistics** | `tools/measure/passageProseStats/index.ts` |
| 9 | **Style Flags** | `tools/measure/styleFlags/index.ts` |
| 10 | **Word Frequency** | `tools/measure/wordFrequency/index.ts` |
| 11 | **Word Search** | `infrastructure/api/services/search/WordSearchService.ts` |

---

## AI-Powered Tools

### 1. Dialogue Microbeat Assistant

**Location**: `packages/core/src/tools/assist/dialogueMicrobeatAssistant.ts`

Analyzes dialogue passages and suggests:
- Appropriate dialogue tags
- Action beats that show emotion through physical actions
- Show-don't-tell improvements in dialogue

Supports focus modes: dialogue only, microbeats only, or both.

### 2. Prose Assistant

**Location**: `packages/core/src/tools/assist/proseAssistant.ts`

Strengthens narrative prose with:
- Craft-grounded suggestions and vocabulary palettes
- Focus guidance (tone, imagery, cadence priorities)
- POV, tense, and genre awareness via context
- Pacing, imagery, and cadence analysis
- Verbalized sampling for creative diversity

Craft guides are included when `proseMinion.includeCraftGuides` is enabled.

### 3. Context Assistant

**Location**: `packages/core/src/tools/assist/contextAssistant.ts`

Project-aware insights using your reference materials:
- Two-turn workflow: first turn catalogs resources + includes full source document; second turn delivers analysis
- Accesses Characters, Locations, Themes, Things, Manuscript, Drafts, and General reference paths
- Configurable via Context Resource Paths (Settings Overlay)
- Glob-based file discovery (`.md` and `.txt` only)
- Dedicated model scope for cost/performance tuning

### 4. Dictionary Utility

**Location**: `packages/core/src/tools/utility/dictionaryUtility.ts`

Long-form fiction-focused dictionary entries:
- Definitions, connotations, tonal notes, usage examples
- Adapts to optional context excerpts
- Pronunciation (IPA, phonetic, syllables, stress)
- Parts of speech, sense explorer, synonyms
- Falls back to clipboard when no editor selection exists
- Persists word/context across tabs and sessions
- Suppresses auto-fill after manual edits

### 5. Category Search

Semantic word discovery by meaning, not exact match. Uses the Category Search model scope (`proseMinion.categoryModel`).

- `[clothing]` → finds: coat, pants, jeans, shirt, jacket...
- `[angry]` → finds: pissed, upset, furious, irate, seething...
- `[color red]` → finds: crimson, scarlet, ruby, burgundy, rose...

**Features**:
- Natural language category queries
- N-gram mode (words, bigrams, trigrams)
- Cancellation support with partial results
- Full word search integration (occurrence counts, clusters, chapter locations)
- Markdown export

### 6. Proofread

Finds mechanical errors in an open Markdown or plain-text file: spelling,
homophones and other wrong words, punctuation, capitalization, spacing,
agreement, tense, missing and stray words, and a first-person "I" slipping
into third-person narration. Right-
click in the editor and choose **Prose Minion ▸ Proofread and Flag** or
**Proofread and Fix**; the Command Palette names them **Prose Minion: Proofread
and Flag** and **Prose Minion: Proofread and Fix**. A selection narrows the run;
with nothing selected the whole file is proofread. Uses the Proofread model
scope (`proseMinion.proofreadModel`, a fast, inexpensive model by default).

- **Proofread and Flag never changes the text.** Each issue is a diagnostic: a
  squiggle, an entry in the Problems panel, and a suggested correction in its
  message. Surface errors Fix may correct show as information. Everything only
  ever flagged shows as a warning: tense, agreement, person, wrong, missing
  and stray words, and name variants. The summary counts those as needing
  your judgment.
- **Knows the book's narration.** Proofread measures the whole file's narrative
  tense and person (past or present, first or third), from the sentences no
  one speaks, and judges each passage against them. A short selection, or a
  page of dialogue, is not judged by its own few verbs.
- **Leaves markup alone.** Front matter, code, link targets, URLs, HTML comments,
  and tags are never sent or flagged. Indented paragraphs are proofread.
- **Follows your edits.** Flags move with their text as you type, and a flag
  whose text you change disappears. Each flag offers **Dismiss**;
  **Prose Minion: Clear Proofread Flags** removes them all. Closing the file
  clears its flags, and they are not restored after a reload.
- **Proofreads section by section.** A selection run replaces only the flags
  inside the selection; flags elsewhere in the file stay, and the summary
  counts them.
- **Fixes the safe ones.** **Proofread and Fix** applies the spelling,
  homophone, punctuation, capitalization, and spacing fixes as one change you
  can undo, and flags the rest. By default the fixes open in Refactor Preview,
  unticked: tick the file to take them all, or tick them one by one, then
  Apply. The judgment calls are only ever flagged. A flag's lightbulb offers
  **Replace with '…'** and **Fix all Proofread issues in this file**
  (`proseMinion.proofread.fixReview`).
- **Holds your spelling convention.** Set
  `proseMinion.proofread.spellingConvention` to American, British, Canadian, or
  Australian English, or leave it at `auto` to flag only a spelling that breaks
  the text's own pattern.
- **Accepts your names and invented words.** List them in
  `proseMinion.proofread.wordList`, in workspace settings for a list per
  project. A listed word is never flagged as a spelling or wrong word, in any
  case or with a possessive.
- **Catches a misspelled name.** Proofread reads the whole file for names
  (capitalized words used mid-sentence) and flags a rare spelling beside a
  common one: *Alcie*, once, beside *Alice*, three times or more. Its
  **Replace with** offers the common spelling, never as Proofread's own fix.
  A name used only at the start of sentences is not read as a name; a listed
  word is never flagged.
- **Asks before long runs.** A whole file over 15,000 words asks first. The run
  can be cancelled from its progress notification, and its summary reports what
  was flagged and what it cost.

See [ADR 2026-10-21](adr/2026-10-21-draft-edit-engine-and-document-write-back.md).

### 7. Craft Flags

**Location**: `packages/core/src/infrastructure/api/services/craftFlags/CraftFlagsService.ts`
(the run: `application/services/draftEdit/CraftFlagsUseCase.ts`)

Leaves the notes a line editor leaves in a fiction draft: each a flag on a
few words, with a short note on what they are doing and one way they could
go. Right-click in the editor and choose **Prose Minion ▸ Craft Flags**; the
Command Palette names it **Prose Minion: Craft Flags**. It reads the whole
chapter. Uses the Craft Flags model scope (`proseMinion.craftModel`), which
follows the Workshop's model until you pick one.

- **Never changes the text.** Each flag is an information diagnostic under
  the source **Prose Minion Craft**, apart from Proofread's, with its note as
  the message: why the words stand out, then "One way it could go: …". It
  offers only *Dismiss this Craft flag* and *Clear all Craft flags in this
  file*: no quick fix. **Prose Minion: Clear Craft Flags** removes them all.
  A Craft Flags run never replaces Proofread's flags.
- **Clichés, first.** A phrase worn smooth by use, or a familiar phrase asked
  to carry a turn. Idioms and stock phrases are familiar, not faults, and
  are never flagged: the same four kinds the Lightbox's familiar phrasing
  names. A cliché in dialogue is the character's voice, and is left alone.
  A phrase the chapter leans on says so: "This phrase appears 3 times in
  this document."
- **Register shifts.** Narration that leaves the register the chapter
  keeps: a word from outside the period the narration sets (`period`), slang
  in formal narration (`slang`), legal or corporate wording where the
  narration keeps none (`jargon`), or a sudden ornate passage in plain prose
  (`ornate`). The call first names the register the chapter's narration
  keeps, and each flag says so: "The chapter's narration: a wry, formal
  English, plain and unhurried." Dialogue is left alone, and so is a
  character's own marked thought. A word is flagged for its date only when
  the narration sets a period.
- **Gesture strain.** A gesture a reader stumbles on: one the body cannot
  make as written (`impossible`; "her eyes dropped" and other accepted
  figures are left alone), choreography the reader stops to assemble
  (`complicated`), a stock beat that carries nothing (`thin`), or one that
  names its own body part (`redundant`: "nodded his head"). A thin beat is
  flagged only where the chapter leans on it or it alone carries a turn.
  Prose Minion counts each stock beat a flag names (nod, shrug, sigh,
  smile, grin, frown, wink, smirk, a shake of the head, a roll of the eyes),
  every form together, and says so: "Nods appear 7 times in this
  document." A gesture in a dialogue beat is narration, and is read; words
  inside quotation marks are left alone.
- **Choose what it looks for.** `proseMinion.craftFlags.categories` turns
  each category on or off. All three are on by default, and each is a
  request of its own, priced in the confirmation.
- **Options, never orders.** A note that tells you what to do, grades the
  writing, quotes, or states a count is not shown as written: a why becomes
  a plain description of the phrase's kind, and a suggestion is left out.
- **Asks first, with a price.** Every run names the words it reads, the
  model, and an estimated price ("≈ $0.06"), never a cap. A chapter over
  25,000 words is refused whole; select a part and that part is read alone.
  Under that, a selection reads the whole chapter for context and flags only
  the selection.

In-chapter continuity follows (Slice 3c).

---

## Measurement Tools (No API Key Required)

### 8. Prose Statistics

**Location**: `packages/core/src/tools/measure/passageProseStats/index.ts`

Comprehensive prose metrics:
- **Counts**: Words, sentences, paragraphs
- **Averages**: Words/sentence, sentences/paragraph
- **Dialogue**: Percentage of text in quotes
- **Lexical density**: Content-word ratio (non-stopwords/total × 100)
- **Vocabulary**: Unique words, Type-Token Ratio, hapax count/percentage
- **Readability**: Flesch Reading Ease, Flesch-Kincaid Grade Level
- **Pacing**: Qualitative assessment from sentence length
- **Reading time**: Estimated minutes/hours
- **Word length distribution**: Percentage by character length

**Multi-file features**:
- Chapter-by-chapter analysis
- Publishing standards comparison (when preset selected)
- Publishing format with trim size and page estimate
- Optional chapter breakdown tables on save/copy

### 9. Style Flags

**Location**: `packages/core/src/tools/measure/styleFlags/index.ts`

Identifies style patterns that need attention:
- **Adverbs** (‑ly words)
- **Weak verbs** (forms of "be", passive constructions)
- **Filler words** (just, really, actually, basically, etc.)
- **Repetitive words** (close-proximity repeats)
- **Placeholder words** (draft markers)
- **Intensifiers** (overused emphasis)
- **Hedges** (uncertainty language)
- **Noun fog** (heavy nominalization)
- **Value labels** (telling instead of showing)
- **Cognition tags** (thought verbs vs. direct thought)

Output: count per category + example sentences.

### 10. Word Frequency

**Location**: `packages/core/src/tools/measure/wordFrequency/index.ts`

Comprehensive word usage analysis:
- **Top Words** — most frequent content words (stopwords excluded by default)
- **Stopwords Table** — top function words with counts
- **Hapax Legomena** — words appearing exactly once (alphabetized list)
- **Parts of Speech** — nouns, verbs, adjectives, adverbs via `wink-pos-tagger`
- **N-grams** — top bigrams and trigrams
- **Word Length Histogram** — distribution of word lengths (1–10+ characters)
- **Lemmas** (optional) — groups inflected forms (running/ran/runs → run)

Configurable via `proseMinion.wordFrequency.*` settings. POS tagging uses `wink-pos-tagger` bundled with the extension.

### 11. Word Search

Advanced word pattern matching with context windows and cluster detection.

- **Scope options**: Active File, Manuscripts, Chapters, Selection
- **Glob patterns**: Target specific folders (e.g., `Drafts/**/*.md`)
- **Context window**: N words before/after each match
- **Cluster detection**: Group nearby matches within a word-distance window
- **Min cluster size**: Only report clusters with N+ hits
- **Case sensitive**: Toggle exact case matching
- **AI expansion** (optional): Use assistant model for synonym/inflection expansion

Results: total occurrences, average gap, per-file breakdown, cluster locations.

---

## Customization

### System Prompts

Tool-specific prompts live in `packages/core/resources/system-prompts/`:

```
system-prompts/
├── category-search/
├── context-assistant/
├── dialog-microbeat-assistant/
├── dictionary-fast/
├── dictionary-utility/
├── prose-assistant/
└── writing-tools-assistant/
```

Each directory contains numbered markdown files (00-, 01-, etc.) loaded by `packages/core/src/tools/shared/prompts.ts`.

### Craft Guides

Optional writing craft guides in `packages/core/resources/craft-guides/`:
- `descriptors-and-placeholders/` — sensory details, emotions, movements
- `scene-example-guides/` — scene examples (campfire, basketball, etc.)

Loaded by `packages/core/src/tools/shared/guides.ts` when `proseMinion.includeCraftGuides` is enabled.

---

## Token Limits & Models

- `proseMinion.maxTokens` is the general tool default (10,000). Bounded
  composite workflows may use their own documented allowance; Gesture
  Dictionary generation uses 14,000 so the readable scan and menu can complete.
  Responses hitting a provider cap show a truncation notice.
- Models are scoped per feature: `assistantModel`, `dictionaryModel`, `contextModel`, `categoryModel`, `proofreadModel`, `craftModel`. See the in-app **Model Browser** for the full curated list.
- Curated model IDs are defined in `packages/core/src/infrastructure/api/providers/OpenRouterModels.ts` and verified against the live OpenRouter API.

---

## Session Persistence & Model Sync

- Long-running OpenRouter calls continue when you switch away from Prose Minion. Cached status updates and final responses are replayed on return.
- Model selections are written back to `settings.json` instantly via the Domain Hooks sync.
- UI state (active tab, latest results, status ticker) is restored on reload.

---

## See Also

- [ARCHITECTURE.md](ARCHITECTURE.md) — System design and patterns
- [CONFIGURATION.md](CONFIGURATION.md) — Complete settings reference
- [TESTING.md](TESTING.md) — Test strategy and commands
