# Kickoff prompt: Persona Measures, design sprint (A0)

Paste this into a new orchestrator session on `okeylanders/prose-minion-vscode`.

---

You're planning the **Persona Measures** epic for the Prose Minion VS Code extension. This sprint writes the plan, not the code. Read `AGENTS.md` first. Its sections on capability families, file reads, the context breakdown, native tool calls, the help reference and Passage Search apply throughout.

## Read these first

- `.todo/epics/epic-persona-measures-2026-11-27/README.md`: the epic's outline, steps, branching, decisions (M1–M3, R2–R4) and open items. It is the brief. Where your ADR improves on it, update the README to match.
- `.todo/features/feature-workshop-persona-measures/README.md` (#35): step 1.
- `.todo/features/feature-read-aloud-cadence/README.md` (#31): step 2, with R1 and the chapter pass.
- `docs/adr/2026-11-20-passage-search.md`: the scope grammar step 1 lifts (D2, D3, and the S42–S53 amendments on group narrowing).
- `docs/adr/2026-11-17-everyday-conveniences-round-two.md` (D16–D25, the lens and help families) and `docs/adr/2026-11-19-workshop-persona-tools.md` (the history and locations families). These are the shape a new family follows.

## Branches

1. Confirm the highlights epic has merged to `main`. If it hasn't, stop and say so.
2. Cut `epic/persona-measures` from `main` and push it.
3. Work on `sprint/persona-measures-00-design` and open a PR into the epic. Don't target `main`.

## What to write

1. **An ADR**, `docs/adr/YYYY-MM-DD-workshop-persona-measures.md`, for the `measure.*` family. It decides:
   - **the operations and their grammar:** `measure.stats`, `measure.flags`, `measure.frequency` and `measure.search` now, `measure.cadence` reserved for step 2. That covers fields, bounds in `PROMPT_BUDGETS`, results, window fitting through `reads/WorkshopReadWindowFit`, and continuations that decode as written;
   - **the scope lift:** `PassageSearchScope` and its resolver move to a neutral module, Passage Search moves onto it unchanged, and the boundary tests are updated on purpose;
   - **scansion's groundwork (M3):**
     - host-assigned sentence ids (stable for one text, built on `proseSentenceSpans`);
     - the per-sentence table format;
     - the pause splitter: which marks split, counted in words now and syllables in step 2;
   - **the port** into `ProseStatsService`, `StyleFlagsService`, `WordFrequencyService`, `WordSearchService` and `StandardsComparisonService`, built in `extension.ts` and placed in `CoreServices`. The family never imports a handler;
   - **publication (M1)** and **the Settings standard (M2);**
   - **step 2's decisions, recorded now so step 2 needs no second ADR:**
     - `cmu-pronouncing-dictionary` (code and data licenses checked and cited) and `syllable` as dependencies;
     - the build-time compact table, and lazy loading on the extension host;
     - R4: readability keeps `estimateSyllables`;
     - R3: the per-project pronunciation list's format and where it lives;
     - where `measure.cadence` joins the family;
   - **logs:** counts, operations and outcomes, never a word searched, a quote or a path.
2. **A runway** in the epic folder: the files each sprint touches, verified against the code with paths. Name anything in the README that doesn't match the code.
3. **Sprint documents** for A1, A2 and A3, and for B1 and B2, each with:
   - its deliverable;
   - the boundary and sync tests it adds;
   - its help-section work;
   - completion criteria that name a test for each.
4. **The README updated:** the branch, the sprint table linked to the documents, and any decision the ADR refined.

## Ground rules

- **Check every claim against the code** and cite paths. Don't plan a seam that doesn't exist without saying it's new.
- **Settled decisions:** M1–M3 and R1–R4 are Okey's. Don't reopen them.
- **What needs Okey:** the tool's name and the chapter pass's home are open, and don't block this sprint. Ask about anything else that is genuinely Okey's to decide. Otherwise take a default and list it in a defaults table in the ADR.
- **What this sprint leaves alone:** no implementation, and no model-facing prompts for the Listen reading or the chapter pass. Fable writes those later, against B's measure table.
- **Review:** stop once the PR is open. Okey sends it to Astra for review.
