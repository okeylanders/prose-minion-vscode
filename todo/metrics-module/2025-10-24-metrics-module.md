# Running List of Metrics Module feature additions, bug fixes, improvements

## Module

**Critical Move Word Search Component to new Module Search & Add Tab For new Module**

1. Prose Stats, Word Frequency, Word Search, Style flags components should all have individual file destinations. Keep route through same handler ( to not duplicate code ) but pass file-path/name into handler or better alternative architecture

2. Each component in Metrics should store the rendered markdown in cache, so that searches do not have to repeat when switching between tabs. There should be "⚡ Generate/Search " button that triggers the appopriate action. this will serve to indicate when the user wants to generate new output.

3. It is ok for tabs that can auto-generate not to automatically generate when empty and user clicks on tab button. User can hit generate button - it is obvious lol.

4. Publishing standards selection block should be placed within prose stats view above new generate button - it is only associated with prose stats so should not be visible on other panels; it takes up space.

5. Prose Metrics dedicated tab bar should be above "measure block"

6. Change "Measure:" block label to "Scope:"

## Component: Prose Statistics

### Prose Statistic Punchlist

1. Move Publishing Standards selection block to this component so that it is only visible when PS component is visible.

## Component: Word Search

### Word Search Punchlist

1. Word Search View: remove ⚡ from context bot button. Leave as bot button, we'll wire up later.

2. Word Search View: Targets & Criteria panel inputs & buttons should have same styling as all other inputs. Remove number inputs. It's obvy they should be numbers and it's hard to type in those types of inputs.
  
3. Word Search View: Stretch the targets box to full width. It feels awkward.

4. Word Search View: Center "run search" button. Add lightening bolt as well.

5. Word Search View: Bug Fix: There is supposed to be a simple summary table "| File | Word | Hits | Cluster Count |" before the chapter by chapter break downs.

6. Minor fidelity: Word Search scannedFiles currently sets `absolute` == `relative`; consider populating true absolute path.

## Component: Style Flags

### Incorporate wink-pos-tagger

• Goal: improve precision for select Style Flags using POS tags while keeping current heuristics as fallback (offline, deterministic).

- Adverbs
  - Prefer POS tags RB/RBR/RBS to capture non-ly adverbs (very, quite, rather) and avoid false positives.
  - Fallback: existing “-ly” regex in case POS is disabled/unavailable.

- Weak Verbs
  - Filter to verb tokens (VB, VBD, VBG, VBN, VBP, VBZ) first; then match against a weak-verb lexicon (be/have/do/get/make/go/take/seem/appear…).
  - Reduces non-verbal matches compared to plain regex.

- Passive Voice (heuristic, improved)
  - Detect BE-aux (is/are/was/were/be/been/being) followed by a VBN within a small window (allow optional adverb between).
  - Optional: stronger signal when followed by a “by …” phrase. Fallback to current “was|were|been|being + \w+ed” regex.

- Leave as-is (no POS needed)
  - Filler Words (lexicon-driven), Repetition (frequency/proximity), Clichés (phrase list).

Implementation notes
- Add setting: `proseMinion.styleFlags.posEnabled` (boolean, default true). If tagger fails to init, gracefully fallback to heuristics.
- Lazy-load wink in Style Flags tool; add `tagText(text)` helper returning `{ value, pos }[] | undefined`.
- Update checks to prefer POS branch with fallback:
  - `checkAdverbs` → RB* tokens; fallback to -ly regex.
  - `checkWeakVerbs` → verb POS filter + weak-verb set.
  - `checkPassiveVoice` → BE + VBN window (+ optional “by …”); fallback regex.
- UI/Formatter: when POS disabled/unavailable, show a short note similar to Word Frequency’s “POS tagging unavailable” message.
- Performance: comparable to Word Frequency POS pass; remains offline and fast for chapter/manuscript scopes.

Reference patterns in repo
- POS loading and usage: `src/tools/measure/wordFrequency/index.ts:114–175`.
- Style Flags tool: `src/tools/measure/styleFlags/index.ts`.
- Service call path: `src/infrastructure/api/ProseAnalysisService.ts:535`.
