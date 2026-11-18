# Epic: Everyday Conveniences, Round Two

**Status:** Built. Every slice is merged into `epic/everyday-conveniences-round-two` (PRs #268–#281); the closing pass is on `epic/everyday-conveniences-round-two-close`. Next: Okey's [live pass](live-pass.md) and the open decisions it lists. Nothing has gone to `main`.
**Priority:** Medium
**Opened:** 2026-11-17
**Branch:** `epic/everyday-conveniences-round-two`, cut from `main` at `3f99e733`.
**ADR:** [2026-11-17: Everyday Conveniences, Round Two](../../../docs/adr/2026-11-17-everyday-conveniences-round-two.md)
(A part 2, C, D, F and H; A part 1, B, E and G are settled here).
**Sequel to:** [Everyday Conveniences](../epic-everyday-conveniences-2026-11-14/README.md) (v2.14.0).

## Goal

Eight small-to-medium writer features, built as one epic:

| Item | What the writer gets | Okey's # | Source note |
|---|---|---|---|
| A | A long room's earlier turns: the notice moved to the top (part 1), then "Show earlier turns" (part 2) | 22 | [Show a Long Room's Earlier Turns](../../features/feature-workshop-thread-earlier-turns/README.md) |
| B | A setting for how readily personas suggest memories | 8 | [How Readily Personas Suggest Memories](../../features/feature-workshop-memory-suggestion-level/README.md) |
| C | Personas see every memory's title, can page the catalog, and the list's size is a setting | new | [Show Personas Every Memory's Title](../../features/feature-workshop-memory-title-index/README.md) |
| D | A persona is told what became of its notes and file edits | follow-up | [Tell the Persona What Became of Its Notes](../../features/feature-workshop-memory-proposal-outcomes/README.md) |
| E | Lexical Gravity reads model JSON through the shared parser, repairs one known slip, and keeps the good lenses | 13 | [Lexical Gravity Reads JSON Without Repair](../../tech-debt/2026-11-09-lexical-gravity-reads-json-without-repair.md) (fixes 1–3) |
| F | Personas can list and read the writer's Lexical Gravity lenses | 12 | [Personas Can See the Writer's Lenses](../../features/feature-workshop-persona-reads-lenses/README.md) |
| G | `@` in the composer attaches a project file | 14 | [`@` in the Workshop Composer](../../features/feature-workshop-composer-at-mentions/README.md) |
| H | A Prose Minion reference any persona can answer from | 20 | [A Complete Prose Minion Reference](../../features/feature-prose-minion-help-reference/README.md) |

**The eight source notes are never edited on this branch.** Status and
decisions live in this README and the ADR.

## Slices

| # | Item | Source note | Okey's # | Branch | PR | Status |
|---|---|---|---|---|---|---|
| 0 | Spec | (this README and the ADR) | | `epic/everyday-conveniences-round-two-spec` | #269 | Merged |
| A1 | A, part 1 | thread-earlier-turns | 22 | `…-earlier-turns-notice` | #268 | Merged |
| E | E | lexical-gravity-reads-json-without-repair | 13 | `…-lexical-gravity-json` | #270 | Merged |
| G | G | composer-at-mentions | 14 | `…-at-mentions` | #271 | Merged |
| B | B | memory-suggestion-level | 8 | `…-memory-suggestion-level` | #272 | Merged |
| C | C | memory-title-index | new | `…-memory-title-index` | #274 | Merged |
| D | D | memory-proposal-outcomes | follow-up | `…-memory-proposal-outcomes` | #276 | Merged |
| A2 | A, part 2 | thread-earlier-turns | 22 | `…-earlier-turns` | #273 | Merged |
| F | F | persona-reads-lenses | 12 | `…-persona-reads-lenses` | #277 | Merged |
| H | H | prose-minion-help-reference | 20 | `…-help-reference` | #279 | Merged |
| H+ | H, follow-ups | prose-minion-help-reference | 20 | `…-help-followups` | #280 | Merged |
| A3 | A, follow-up: a bookmark outside the window loads its pages and scrolls to it (at most 3 pages; ADR D6 amendment) | thread-earlier-turns | Okey, 2026-11-18 | `…-bookmark-jump` | #281 | Merged |
| Close | Closing pass: [live pass](live-pass.md), `AGENTS.md`, memory bank, tech debt | | | `…-close` | this PR | In review |

Slice branches are `epic/everyday-conveniences-round-two-<slug>`. A slice
already running under another slug keeps its own; this table then records
the name it used.

## Order

1. **Start together:** Slice 0, and A part 1, E and G. None of those three
   needs an ADR decision.
2. **After Slice 0 is approved:**
   - the memory trio, in sequence: **B, then C, then D**. They share the
     Memory tab and the project-memory prompts;
   - **A part 2,** beside them;
   - **F,** after C. It uses C's `<page>` and edits the same grammar lists.
3. **H last,** so the reference documents this epic's own features, and so
   its grammar work lands on F's.
4. **The closing pass:** the live-pass checklist, `AGENTS.md`, a
   memory-bank entry.

## Settled here: A part 1, B, E and G

### A, part 1: the notice

- The hidden-turns notice moves from below the thread to **above its first
  bubble** (`presentation/webview/WorkshopApp.tsx`, `.pm-ws-thread-hidden`).
- New words, with no "coming soon" and "kept" said once: "73 earlier turns
  aren't shown here. They're kept in full: export, bookmarks and the
  personas still have them."
- Part 2 (ADR D7) puts "Show earlier turns" in the same place.

### B. How readily personas suggest memories

- **Three levels, a closed list:** `WORKSHOP_MEMORY_SUGGESTION_LEVELS`
  (`sparingly`, `readily`, `aggressively`), in `shared/constants/`.
- **The setting:** `proseMinion.workshop.memory.suggestions`, an enum,
  default `sparingly`, application scope, as `proseMinion.workshop.projectMemory`.
- **One whole proposals file per level.** The persona chain is a list of
  files joined with a rule (`'\n\n---\n\n'`, `tools/shared/prompts.ts`), so
  a paragraph cannot be swapped inside a file without a rule landing in the
  middle of the section. So:
  - `workshop-personas/project-memory-proposals.md` **is Sparingly, and is
    not edited.** Today's prompt is byte for byte what a writer on the
    default gets.
  - `workshop-personas/memory-suggestions/readily.md` and
    `aggressively.md` are the same file with one paragraph changed.
  - `workshopPersonaSystemPromptPaths` picks exactly one, by the level, and
    only where it picks the proposals file today (memory open).
- **The paragraph that moves** is the one that begins "Don't suggest one
  for something the notes already say" and ends "…in the same reply."
  It holds the brake ("Most replies suggest none") and three rules that
  never move. A test holds, for every level:
  - everything outside that paragraph is byte-identical across the three
    files;
  - the paragraph keeps, word for word, "One reply suggests at most 10
    notes." and "Each one stands alone: it names one thing, and it never
    repeats or overlaps another suggestion in the same reply.";
  - the paragraph still says not to suggest what the notes already say;
  - Sparingly's paragraph is today's text (a copy in the test).
- **Concrete anchors** are allowed in Readily and Aggressively ("about one
  reply in three"), as `workshop-personas/reaction-frequency/` does.
- **`projectMemoryProposalPromptSync.test.ts` runs over all three files.**
- **Mid-room:** a change goes through the existing system-message rebuild
  (`replaceWorkshopConversationSettings`), from the next turn, at one
  prompt-cache miss.
- **Off stays off.** No level adds a proposals file while memory is off.
- **The tab.** "Suggest notes" on the Memory tab
  (`WorkshopMemorySettingsPanel`), beside the memory mode. Under it, one
  line, its number from `PROMPT_BUDGETS.workshopProjectMemory.autoSavesPerRoom`
  (test): "With Save and tell me, at most 5 notes are saved in one
  conversation; the rest wait as cards."
- **The evidence** is a live pass: one fixture conversation at each level,
  with the count of suggestions each made.

### E. Lexical Gravity reads JSON without repair

Fixes 1–3 of the note. Fix 4 (flattening the reply format) and the
helper's reasoning repair stay in the note.

- **Both readers go through `parseModelJson`** (`@parsers/ModelJsonRepair`):
  the preview and the lens build in
  `infrastructure/api/services/widgets/LexicalGravityModelService.ts`. Each
  repair is logged by its kind, never with text.
- **One feature-local repair,** narrowly named, in a module beside the
  service, never in `@parsers/*`: an `attention` object holding only
  `foregrounds`, followed at once by a `backgrounds` member, has its
  closing brace moved back.
  - `modelJsonContentMatches` checks original against repaired.
  - A guard that cannot confirm moves nothing.
  - It is logged as its own kind.
- **Keep the valid lenses.** When the reply parses and some candidates fail
  validation, the valid ones are offered with a note ("1 of 3 lenses
  couldn't be used"). Three stays the ask (`lexicalBuildCandidates`); it
  stops being a gate. No valid candidate is still a failed build.
- **Fixtures** are made-up *Alice*-style lenses, never Okey's.
- **Logs** carry repair kinds and counts, never lens text or the query.

### G. `@` in the composer

- **A1 (Okey): the pill is the truth.** The token is prose in a plain
  textarea. Deleting a token leaves the pill; removing a pill leaves the
  text.
- **A2 (Okey): a file token always holds a `.` or a `/`,** and the list is
  built in sections (**Files** now, **People** later). A test pins the rule
  for every token the list can insert.
- **This message only.** `@` stages a one-shot message attachment through
  `WORKSHOP_ATTACH_MESSAGE_RESOURCES`, by catalog key. No new host route.
- **What it lists:** the configured files (`WORKSHOP_CONTEXT_CATALOG`),
  filtered in the webview, grouped by context group, then **Browse
  project…**, which opens today's picker in `'message'` mode.
- **Where:** anchored above the composer, as wide as it is. Not at the
  caret.
- **Keys:** while the list is open, ↑ and ↓ move, Enter or Tab picks,
  Escape closes and keeps the text. Enter sends only with the list closed.
  Nothing acts during IME composition.
- **Unique tokens,** by the shortest unique path, matching the attachment
  frame's label. A file already staged inserts its token and stages nothing
  twice.
- **The shared picker and its parity tests are unchanged.** The list is a
  new composer component with a pure token module, so `WorkshopComposer.tsx`
  (443 lines) stays under 500.

## Shared seams

- **The capability grammar is touched three times:** C's `<page>`, F's
  `lens` family and H's `help` family. Each edits
  `WORKSHOP_CAPABILITY_OPERATIONS` or its request types,
  `WorkshopCapabilityXmlCodec`, every family switch, and a grammar prompt
  with its sync test. **Those slices are sequenced: C, F, H.** ADR D16 is
  the list of what widens.
- **The native tool-call map.** Every new operation and field joins
  `WORKSHOP_NATIVE_CALL_FIELDS` (`WorkshopNativeToolCallTranslator.ts`,
  PR #267). It is keyed by the closed operation list, so a new operation
  does not compile without it.
- **`PROMPT_BUDGETS`** (`shared/constants/promptBudgets.ts`): A
  (`workshopThread`), C (`workshopProjectMemory`), F (`workshopLens`), H
  (`workshopHelp`).
- **The manifest** (`apps/vscode-extension/package.json`): B and C, one
  setting each.
- **The Memory settings tab and the project-memory prompts:** B, C and D,
  in that order. D changes no prompt file (ADR D14), so B's byte pins hold.
- **`WorkshopApp.tsx`** (1,951 lines): A and G. Each adds a component and
  a hook, and as few lines here as it can.
- **The session shape** (`WorkshopSessionStateV1Shape.ts`): D's field, F's
  and H's turn artifacts.
- **`AGENTS.md`:** H's help-section rule, and the closing pass.

The second slice to merge takes the other's lines.

## Rules binding every slice

**Branches and review**
- Slice PRs go into `epic/everyday-conveniences-round-two`.
- **Astra** (Okey's review agent) reviews each. A slice is merged with a
  merge commit, and only after Astra approves. Findings are fixed on the
  slice branch, answered in the PR and re-reviewed.
- Never rebase a shared branch. Merge between branches.
- **Nothing targets `main` without Okey.** Never commit to `main` or
  `claude/idea-inbox`.

**Verification**
- `npm run typecheck`.
- `npm run lint`: no new errors.
- The full `npx jest`, with its counts in the PR.
- No `from 'vscode'` in `packages/core/src`.
- No new file over 500 lines.
- No live, billable model calls in tests.

**Writer data**
- Logs never carry writer text, note text, lens text, paths or queries.
- Fixtures use *Alice*, or made-up names.
- A session-codec change is optional and additive (ADR 2026-07-30), with an
  authentic fixture from before the slice that must keep reading.

**Contracts**
- New capability grammar keeps the families exhaustive, and keeps the
  "hints decode as written" sync tests.
- Webview hooks are tripartite, with webview-minted request ids.
- Shared components keep their parity tests.

**At the end**
- A live-pass checklist ([`live-pass.md`](live-pass.md), as the first epic's).
- `AGENTS.md` updated where a rule changed.
- A memory-bank entry.

## Defaults taken

Okey's decisions are marked. The rest were taken for him by the
orchestrator, from his notes' leanings or the brief. **None of those is an
owner decision,** and each is his to overturn.

**The ADR's open questions Q1–Q7 are among them, and stay open:** Q1 is
row 30, Q2 row 13, Q3 row 41, Q4 row 42, Q5 row 36, Q6 row 44 and
Q7 row 38. PR #269's review did not accept any of them on Okey's behalf.

| # | Item | Decision | Default taken | Why |
|---|---|---|---|---|
| 1 | A | Which parts | Both. Part 1 lands first. | **Okey's decision** |
| 2 | A | Page size, and the window | 100 turns a page, also bounded by 1 MiB. The snapshot window stays 200. | Brief default. The byte bound is new: the snapshot has none (ADR D3). |
| 3 | A | Read-only, or full bubbles | Full bubbles. A page carries its turns' host verdicts, so Rewind and Branch work there. | The note's leaning |
| 4 | A | Jump to a bookmark's page | ~~Out of scope.~~ Superseded 2026-11-18: a bookmark outside the window loads up to 3 pages back to its turn and scrolls there; past that, the reader opens (ADR D6 amendment, slice A3). | **Okey's decision** (2026-11-18) |
| 5 | B | How many levels | Three: Sparingly (default), Readily, Aggressively. | Brief default |
| 6 | B | Per room, or every room | One global setting, application scope. | The memory mode is global |
| 7 | B | Concrete anchors | Allowed in Readily and Aggressively. | The reaction-frequency files do |
| 8 | B | Aggressively in auto mode | One line on the tab: auto saves at most 5 a conversation and holds the rest. | The cap already exists (`autoSavesPerRoom`) |
| 9 | C | The size setting | Ships here; each size grows both buckets (T1). | **Okey's decision** |
| 10 | C | Titles tier by default | On. It appears only once the list overflows. | The note's leaning |
| 11 | C | Order of the titles tier | Newest first, as the list. | The note's leaning |
| 12 | C | When a size change applies | From the next conversation; the tab says so. | The frame is built once |
| 13 | C | Small-context warning | Not built. | The preflight guards the request |
| 14 | D | Cards' answers in the line | Never. | "Saved to project memory: …" covers them |
| 15 | D | File-edit trailers | The same frame, a line of their own. | Brief default |
| 16 | D | When the line is sent | Whenever the reply carried such a trailer. | Brief default |
| 17 | E | Scope | Fixes 1–3. Fix 4 and the helper's repair stay in the note. | **Okey's decision** |
| 18 | F | Which calls | `lens.catalog` and `lens.read`; no `lens.search`. | Brief default |
| 19 | F | Recommending a project lens | Starter-only stays. A persona names the writer's lens in prose. | The note's leaning |
| 20 | F | The family's name | `lens`, for lenses only. | Brief default |
| 21 | G | A1, A2 | The pill is the truth; file tokens hold a `.` or a `/`; a sectioned list. | **Okey's decisions** |
| 22 | G | This message, or the room | This message only. | Brief default |
| 23 | G | What `@` lists | Configured files, plus Browse project…. | Brief default |
| 24 | G | Placement | Above the composer, not at the caret. | The note's design note |
| 25 | H | Capability, persona, or both | The capability, for every persona. No guide persona. | The note's leaning |
| 26 | H | One source for people and models | No. The writer-facing docs are untouched. | Brief default |
| 27 | H | Size | Read by section, within the window fit. | Brief default |

**Taken while writing the ADR, where the code disagreed with the brief or
a note.** These are the ones to look at first.

| # | Item | Decision | Default taken | Why |
|---|---|---|---|---|
| 28 | B | How the paragraph is swapped | **One whole proposals file per level;** today's file is Sparingly, unedited. Not a paragraph file assembled into the section. | The loader joins files with a rule (`---`), so a three-part split would change the default prompt's bytes. A test holds the three files identical outside the paragraph. |
| 29 | B | "The paragraph", exactly | The brake paragraph whole. It also holds "at most 10" and "each one stands alone", which the note says never move, so every level must keep those sentences word for word (test). | They share one line in today's prompt. |
| 30 | C | The list's entry cap | **It grows with the size:** 40, 100, 200. | `catalogEntries` (40) caps the list beside its tokens. At 40, Larger and Largest could not use their budgets. **Goes past T1 as written** (ADR Q1). |
| 31 | C | The update note's bound | Stays today's, at every size. | It is a delta, not the list (ADR D9). |
| 32 | C | The titles tier's elements | `<title-only>` per note; `<unlisted>` for notes in effect that no tier shows; `<more>` for superseded and archived only. | "Worded apart" needs two counts (ADR D8). |
| 33 | C | The catalog's page | 40 a page at every size. **No page ceiling:** `<page>` is 1 to 999,999,999, more pages than any listing can have; the next call is written exactly when a later page exists; a page past the end answers in words. No cap on how many notes a project holds. | Nothing bounds the library, so a highest page would hide notes or name a call the codec refuses (ADR D10; PR #269 F-02). |
| 34 | D | Where the counts live | A new optional turn field, `trailerOutcomes`, counting **every** frame once: a card, a refused card, or a drop with a closed reason, whether it was dropped when the reply was read or when it was settled. Settlement returns typed verdicts; nothing reads a log line. | Drop reasons are only logged today, and a settlement drop's reason is only a string inside the line (ADR D13; PR #269 F-01). |
| 35 | D | A delivery record | **None.** The line is derived from the participant's latest reply. | The reactions' record answers "was it told"; here the latest reply answers it (ADR D15). |
| 36 | D | A card refused at staging | Counted, apart from drops. No reason given. A dropped frame's reason is given. An edit-offer answer's refused cards are counted the same way. | It is news for the persona too; the writer sees a refused card, and nobody sees a drop (ADR D13, Q5). |
| 37 | D | Prompt changes | None. The frame's `note` explains it. | It keeps B's byte pins whole. |
| 38 | A | A loaded page going stale | The held range is re-read after each session state in the same room. | The snapshot is posted whole on every change, and the window slides (ADR D5, Q7). |
| 39 | F | Where lenses are read from | Project lenses through the repository alone; **built-ins through `builtInLexicalGravityLenses()`**; a built-in wins its slug. | Built-ins are not in the repository (ADR D17). |
| 40 | F | The catalog pages | `lens.catalog` takes `<page>`, 50 a page, through C's parser and with C's rule: no page ceiling. The library's own bound (206) makes it 5 pages at most. | With no search, a capped catalog would hide lenses (ADR D17). |
| 41 | F | How `lens.read` is fitted | By whole sections, with an optional `<section>` so a limited read has a next call. | A lens cannot be cut by lines (ADR D18, Q3). |
| 42 | F, H | Who sees a read | Private to the persona that asked. | Publishing needs a context-source kind and Read in (ADR D16, Q4). |
| 43 | F | ADR 2026-08-01 | Not amended. | It says nothing of who reads a lens; the guard is code. |
| 44 | H | "Generated or checked" | Both: committed tables written by a script, held by a test, plus an index that makes a hand-written section own every command and setting. | Core cannot read the manifest at run time (ADR D24, Q6). |
| 45 | D | Which messages carry the line | The writer's next message to the participant, **and the request that asks the host to synthesize a tool run** (2026-11-17). Still derived from the ledger, with no delivery record. Never a tool sidecar's message or a pressed edit offer's request. | **Okey's decision.** Without it, a tool run right after a reply made the synthesis the latest reply, and the earlier reply's outcomes were never told (PR #276; ADR D15 addendum). |
| 46 | D | A lost conversation | The fresh conversation's first message carries the line, in the same words. | Review F-01 (PR #276). The fresh conversation is not shown the earlier reply, so "Your last reply" names one it cannot see; a different frame `note` there is proposed, not taken. **Okey's to decide.** |

## Test counts

| When | Suites | Tests | Snapshots |
|---|---|---|---|
| `main` at v2.14.0's close (the first epic, `epic/everyday-conveniences-close`) | 870 | 12,327 | 59 |
| Baseline (`main` at `3f99e733`) | not run | | |
| B (`…-memory-suggestion-level`, on the spec branch) | 879 | 12,529 | 59 |
| A, part 2 (`…-earlier-turns`, on the epic branch at `649b9f24`) | 884 | 12,572 | 59 |
| C (`…-memory-title-index`, on B's branch) | 884 | 12,681 | 59 |
| D (`…-memory-proposal-outcomes`, on C's branch) | 894 | 12,900 | 59 |
| D after PR #276's review (on the epic branch with A part 2 and C merged in) | 903 | 13,024 | 59 |
| F (`…-persona-reads-lenses`, on C's branch) | 896 | 12,874 | 59 |
| H (`…-help-reference`, on the epic branch at `5ebe42fe`) | 917 | 13,186 | 59 |
| H follow-ups (`…-help-followups`, on the epic branch at `3a6054c3`) | 918 | 13,195 | 59 |
| A3 bookmark jump (`…-bookmark-jump`, as reported in PR #281) | 920 | 13,214 | 59 |
| Close (`…-close`, the epic at `caff8379`, all slices merged) | 921 | 13,230 | 59 |

Each slice adds its row.

## Completion Criteria

- [ ] The ADR passes its technical review and is merged into the epic.
- [ ] A, part 1: the notice sits at the top, without "coming soon".
- [ ] A, part 2: "Show earlier turns" pages back to the room's first turn,
      holds the scroll position, drops a page from a replaced room, and
      persists nothing. Rewind and Branch work on an earlier bubble.
- [ ] B: the Memory tab offers three levels; exactly one proposals file is
      assembled; Sparingly is today's prompt; a mid-room change applies
      from the next turn.
- [ ] C: every other note in effect is listed by title; `<more>` counts
      only superseded and archived notes; `memory.catalog` pages to the
      end at any number of notes (2,001 of one kind included), every hint
      decoding as written; the size setting grows both buckets, and the
      tab's meters agree with the frame.
- [ ] D: a persona's next message says what became of its last reply's
      notes and file edits, in counts and reasons only, with every frame
      counted once, settlement drops included; earlier messages are
      unchanged.
- [ ] E: both readers use the shared parser; the early-closed `attention`
      is repaired under the content guard; valid lenses survive an invalid
      one.
- [ ] F: `lens.catalog` and `lens.read` work for host and guest; lens text
      never reaches a system prompt.
- [ ] G: `@` attaches a configured file to this message, with the keyboard
      path and the combobox's ARIA tested.
- [ ] H: the reference covers every area; its sync tests fail on an
      undocumented command, setting or tab; a persona answers "how do I
      pin a file?" from it.
- [x] A live-pass checklist ([live-pass.md](live-pass.md)), `AGENTS.md` updated, and a memory-bank entry ([2026-11-18](../../../.memory-bank/20261118-2015-everyday-conveniences-round-two-complete.md)).
- [ ] Okey's live pass.

## Review record

**PR #269** (Slice 0, the spec): [the review](../../../docs/pr-reviews/pr-269-everyday-conveniences-round-two-spec-review.md),
at `dab5760f`. Two P2 findings, both accepted and resolved in the ADR.

| Finding | Resolution | ADR |
|---|---|---|
| **F-01.** D13 mapped only the extractor's rejections; a memory edit dropped at settlement left no card and no recorded drop. | `settleWorkshopMemoryEdit`, `settleWorkshopMemoryProposals` and `resolveWorkshopReplyFileEdits` return typed verdicts. `trailerOutcomes` counts every frame once, with ten settlement reasons beside the read-time ones, each with one fixed phrase. Both commit paths write it. Tests: one per reason to the line, an exhaustive mapping, and conservation. | D13, D14, D15, test plan D |
| **F-02.** D10 capped the catalog at page 50 yet promised every note is reachable; the library has no cap. | No page ceiling. `<page>` is 1 to 999,999,999 (nine digits), which no listing's last page can pass; the next call is written exactly when a later page exists; a page past the end answers in words. `lens.catalog` shares the parser. No storage cap. Tests: the 40/41/80/81/2,001 boundaries and the full walk. | D10, D11, D17, D20, test plan C |

Also settled in that pass:

- The file-edit side had the same gap: `duplicate-identity` and
  `not-staged` were log literals. They are typed (D13).
- `help.search` promises no complete list and writes no continuation; every
  section id decodes, and each section is found by its own heading (D21,
  D22).
- The earlier-turns walk drops a restarted walk's answers and evicts turns
  the host no longer returns (D5), which the review named as an
  implementation risk.
- Q1–Q7 stay open, as the orchestrator's defaults ("Defaults taken").

**PR #276** (item D): [the review](../../../docs/pr-reviews/pr-276-trailer-outcomes-review.md),
at `5e099e47`. One P2 and one P3, both accepted and resolved in code; with
them, Okey's decision of 2026-11-17 on a tool run's synthesis request.

| Finding | Resolution | ADR |
|---|---|---|
| **F-01 (P2).** The room handler asked for a provider conversation id before it read the ledger, so a lost conversation lost the last reply's outcomes: the fresh conversation's first message carried no line, and its reply replaced the one that was owed. | The reader is the participant, whether or not it has a conversation (`WorkshopRoomHandler`, `RunWorkshopToolSidePass`). A press and a tool sidecar are still excluded; a first-ever participant has no reply in the ledger and is told nothing. Tests: the recovery path carries the frame once, a later send carries none, and a first-ever message carries none. | D15 addendum |
| **F-02 (P3).** The builder clipped each count at 10,000, so 10,001 dropped frames read as an exact 10,000. | The builder never clips. The codec's bound is the longest an array can be (2^32 − 1), which no tally can pass. Test: 10,001 frames record, validate and read as 10,001. The before-fixture still reads. | D15 addendum |
| **Okey, 2026-11-17.** A tool run right after a reply with outcomes made the synthesis the latest reply; the outcomes were never told. | The synthesis request carries the frame, from the ledger, with no delivery record. Tests: the request carries it, the writer's next message does not repeat it, a sidecar never holds it, earlier messages are byte for byte, and the mirror (a synthesis with trailers) is told with the writer's next message. | D15 addendum; default 45 |

## Notes

- **Follow-ups.** Fix 4 and the helper's repair (E) stay in
  [their note](../../tech-debt/2026-11-09-lexical-gravity-reads-json-without-repair.md);
  the `memory.read` fit stays in
  [Reads That Fit the Window](../../features/feature-workshop-reads-fit-the-window/README.md).
  Jumping to a bookmark's page (A) was built (A3, #281). The closing pass
  split the rest into their own entries:
  [every "show me that turn" loads its pages](../../features/feature-workshop-jump-to-earlier-turn-everywhere/README.md) (A),
  [`lens.search` and recommending a project lens](../../features/feature-workshop-persona-lens-search-and-recommend/README.md) (F),
  [`@persona`](../../features/feature-workshop-composer-at-persona/README.md) (G) and
  [a guide persona](../../features/feature-prose-minion-guide-persona/README.md) (H).
- **Tech debt found at the close:**
  [Lexical Gravity logs a rejected reply's text](../../tech-debt/2026-11-18-lexical-gravity-logs-rejected-reply-text.md),
  [room context reads are not bound to their room](../../tech-debt/2026-11-18-workshop-room-context-reads-unbound-to-room.md),
  [a send refused by the session gate loses its draft](../../tech-debt/2026-11-18-workshop-gated-send-loses-draft.md),
  and [earlier turns' re-read cost](../../tech-debt/2026-11-18-workshop-earlier-turns-reread-cost.md) (Q7).
- **Files already over 500 lines** that these slices touch are tracked in
  [tech debt](../../tech-debt/2026-11-14-everyday-conveniences-oversized-files.md).
  A slice adds its own module and only the call into it.
