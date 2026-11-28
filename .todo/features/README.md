# Feature Ideas: Status Index

**As of:** 2026-11-28. `main` holds 2.17.0, waiting for its release tag: Workshop tabs (PR #312), and persona highlights with the conveniences patch (PR #322).

Numbers come from Okey's idea inbox. Each row links to a note. The note
holds the problem, Okey's decisions, the open questions and the completion
criteria.

## Picking up an item

1. **Read the note, then the AGENTS.md sections it touches.** Each note
   lists its related files.
2. **The Decisions table is settled.** Those rows are Okey's answers.
   **Open questions are not settled:** ask Okey, or state the lean you
   took in the ADR or PR.
3. **ADR first** where the note says so.
4. **A feature is done when its help section explains it**
   (`packages/core/resources/help/`, mapped in `help/index.json`).
5. **Branch from `main`, or from the epic branch the note names.** A PR
   into `main` waits for Okey.
6. **Keep this index current.** When an item starts or ships, update its
   row here and the note's `Status` line.

## ✅ Done

| # | Idea | Shipped | Note |
|---|---|---|---|
| 2 | Emoji reactions, both ways | v2.13.0 | [message reactions](../archive/features/feature-workshop-message-reactions/README.md) |
| 4 | Personas read several files in one request | v2.14.0 | [reads fit the window](feature-workshop-reads-fit-the-window/README.md) (first part; see 4+) |
| 4+ | Reads, the rest: `memory.read` fit and the engine backstop | 2.17.0 (PR #322) | [reads fit the window](feature-workshop-reads-fit-the-window/README.md) |
| 6 | "Selected Text" pill and toggle | v2.14.0 | [send selection with message](../archive/features/feature-workshop-send-selection-with-message/README.md) |
| 7 | Search the Dictionary's history | v2.14.0 | [dictionary history search](../archive/features/feature-dictionary-history-search/README.md) |
| 8 | How readily personas suggest memories | v2.15.0 | [memory suggestion level](feature-workshop-memory-suggestion-level/README.md) |
| 9 | Several Workshop tabs, including unsaved rooms | 2.17.0 | [Epic](../epics/epic-workshop-tabs-2026-11-25/README.md) · [feature note](feature-multiple-workshop-and-lightbox-tabs/README.md) |
| 10 | Collapse the Workshop's side pane | v2.14.0 | [collapsible rail](../archive/features/feature-workshop-collapsible-rail/README.md) |
| 12 | Personas list and read your lenses | v2.15.0 | [persona reads lenses](feature-workshop-persona-reads-lenses/README.md) |
| 13 | Lexical Gravity JSON repair | v2.15.0 | [tech debt](../tech-debt/2026-11-09-lexical-gravity-reads-json-without-repair.md) |
| 14 | `@` in the composer attaches a file | v2.15.0 | [composer @ mentions](feature-workshop-composer-at-mentions/README.md) |
| 15 | Buttons to apply a reply's fixes and rewrites | v2.13.0 | [reply edit actions](../archive/features/feature-workshop-reply-edit-actions/README.md) |
| 16 | Memory privacy fence holds notes | v2.13.0 | [memory fence holds](../archive/features/feature-workshop-memory-fence-holds/README.md) |
| 16a | Personas told what became of their notes and file edits | v2.15.0 | [memory proposal outcomes](feature-workshop-memory-proposal-outcomes/README.md) |
| 20 | Prose Minion help reference for personas | v2.15.0 | [help reference](feature-prose-minion-help-reference/README.md) |
| 21 | Re-read from file in a new room | v2.14.0 | [reread excerpt in new room](../archive/features/feature-workshop-reread-excerpt-in-new-room/README.md) |
| 22 | Long rooms' earlier turns, plus the bookmark jump | v2.15.0 | [thread earlier turns](feature-workshop-thread-earlier-turns/README.md) |
| 23 | Native tool calls translated to XML | v2.14.1 | [native tool call adapter](feature-workshop-native-tool-call-adapter/README.md) |
| 24 | Every memory's title, catalog paging, list size | v2.15.0 | [memory title index](feature-workshop-memory-title-index/README.md) |
| 25 | Context panel breakdown | v2.15.0 | [context breakdown](feature-workshop-context-breakdown/README.md) |
| 26 | Context paths, from Settings or by asking a persona | v2.16.0 | [helper project locations](feature-helper-project-locations/README.md) |
| 27 | Room open builds the catalog once | v2.15.0 | [tech debt](../tech-debt/2026-11-18-room-open-indexes-catalog-per-context-file.md) |
| 28 | Personas read a file's git history | v2.16.0 | [file git history](feature-workshop-file-git-history/README.md) |
| 29 | Passage Search, with group narrowing | v2.16.0 | [passage search](feature-passage-search/README.md) |
| 30 | Personas mark to-dos done, here and in saved sessions | v2.16.0 | [recall to-do closeout](feature-workshop-recall-todo-closeout/README.md) |
| 33 | The default models updated, one table instead of three | 2.17.0 (PR #322) | [tech debt](../tech-debt/2026-11-20-default-models-behind.md) |
| 34 | Click a sent pill to see what was sent | 2.17.0 (PR #322) | [sent attachment viewer](feature-workshop-sent-attachment-viewer/README.md) |
| 36 | A long paste becomes a "Pasted text" pill | 2.17.0 (PR #322) | [long paste pill](feature-workshop-long-paste-pill/README.md) |
| 37 | A session keeps its cache key and cache clock across a reload | 2.17.0 (tabs Sprint 08, PR #310) | [session cache key](feature-workshop-session-cache-key/README.md) |
| 38 (core) | Branch opens the saved branch in a new tab; the source tab stays | 2.17.0 (tabs Sprint 08, PR #310) | [branch in new tab](feature-workshop-branch-in-new-tab/README.md) |
| 39 | Personas highlight the excerpt's file, each with a note | 2.17.0 (PR #322) | [persona highlights](../epics/epic-workshop-persona-highlights/README.md) |

Several of these notes still carry their build-time status line (for example
"In the … epic, on `epic/…`"). This table is the truth. They move to
`.todo/archive/` in the next archive pass.

## 🔨 In flight

| # | What | Who and where | Note |
|---|---|---|---|
| 42 | Pin a model: the on-screen design | A Fable session (2026-11-28); the design lands in the feature folder | [pin model](feature-workshop-pin-model-to-session/README.md) |

Nothing else is being built. 2.17.0 is on `main`, waiting for its release.

## ⏳ Not started

| # | Idea | Priority | Size and notes | Note |
|---|---|---|---|---|
| 1 | Research agent | Low | Large; ADR first. Would call Passage Search and the measures. | [research agent](feature-workshop-research-agent/README.md) |
| 3 | Helper drafts the session name | Medium | Small; N1–N4 decided. Pairs with 18. More useful with tabs: more rooms to tell apart. | [session name draft](feature-workshop-session-name-draft/README.md) |
| 5 | Anthropic, OpenAI and local providers | High | Epic; ADR first. | [model providers](feature-model-providers/README.md) |
| 6a | Selection inside the excerpt sent as a pointer | Low | Small; deferred by Okey. | [selection in excerpt pointer](feature-workshop-selection-in-excerpt-pointer/README.md) |
| 9 (Lightbox) | Several Lightbox tabs | Medium | Follow-up to the Workshop tabs epic. | [multiple tabs](feature-multiple-workshop-and-lightbox-tabs/README.md) |
| 11 | Basic WYSIWYG Markdown editor | Medium | Large; ADR first. | [markdown writing editor](feature-markdown-writing-editor/README.md) |
| 13+ | Lexical Gravity fix 4 and the helper's repair | — | Deferred pending recurrence. The existing repair passed its 30 regression tests on 2026-11-27. | [tech debt](../tech-debt/2026-11-09-lexical-gravity-reads-json-without-repair.md) |
| 17 | Compaction that keeps the whole history | High | Epic. | [compaction keeps history](feature-workshop-compaction-keeps-history/README.md) |
| 18 | Searchable session summary | Medium | Small to medium. Pairs with 3. | [session summary](feature-workshop-session-summary/README.md) |
| 19 | Context strategies (diffs, superseded versions) | Medium | Medium. Pairs with 17. | [context strategies](feature-workshop-context-strategies/README.md) |
| 31 | Read Aloud: measured cadence | Medium | Step 2 of the [Persona Measures epic](../epics/epic-persona-measures-2026-11-27/README.md), after 35 ships; R1–R4 decided. | [read aloud cadence](feature-read-aloud-cadence/README.md) |
| 32 | Help section: using an OpenAI or Claude account (BYOK) | Medium | Small; the text is drafted in the note. | [help: OpenRouter BYOK](feature-help-openrouter-byok/README.md) |
| 35 | Personas run the deterministic measures | Medium | Step 1 of the [Persona Measures epic](../epics/epic-persona-measures-2026-11-27/README.md); M1–M3 decided; kickoff prompt ready. | [persona measures](feature-workshop-persona-measures/README.md) |
| 38 (rest) | Branch from an unsaved room; "Branch in new tab instead" in Rewind's confirm | Medium | Small. Branch still requires a saved room (ADR 2026-09-30, multi-tab amendment). B1 and B2 open, with leans. | [branch in new tab](feature-workshop-branch-in-new-tab/README.md) |
| 40 | The writer's name on their own bubbles | Medium | Small; W1–W2 decided. | [writer name on bubbles](feature-workshop-writer-name-on-bubbles/README.md) |
| 41 | A persona's reply can arrive as several bubbles (react to each) | Medium | Medium; reactions ADR addendum. S1–S3 decided. | [split replies](feature-workshop-persona-split-replies/README.md) |
| 43 | Reactions in the transcript export | Low | Small; answers the reactions ADR's Q9. R1–R2 decided. | [reactions in export](feature-workshop-reactions-in-export/README.md) |
| 44 | A timestamp on each bubble | Low | Small; T1–T2 decided. | [bubble timestamps](feature-workshop-bubble-timestamps/README.md) |
| 45 | Personas draw in their replies (SVG, then Mermaid) | Medium | Medium; short ADR. D1–D3 decided. | [drawings in replies](feature-workshop-drawings-in-replies/README.md) |
| 46 | Personas ask for a Category Search (the paid-search card) | Medium | Medium; ADR 2026-11-20 addendum. After the measures epic's scope lift. C1–C3 decided. | [persona category search](feature-workshop-persona-category-search/README.md) |

### Follow-ups split from shipped work (Low)

| Idea | Split from | Note |
|---|---|---|
| Every way to a turn uses the bookmark jump | 22 | [jump to earlier turn everywhere](feature-workshop-jump-to-earlier-turn-everywhere/README.md) |
| Personas search and recommend the writer's lenses | 12 | [persona lens search and recommend](feature-workshop-persona-lens-search-and-recommend/README.md) |
| `@` a persona in the composer | 14 | [composer @ persona](feature-workshop-composer-at-persona/README.md) |
| A Prose Minion guide persona | 20 | [guide persona](feature-prose-minion-guide-persona/README.md) |

### Tech debt waiting

| Item | Priority | Note |
|---|---|---|
| Workshop tabs follow-ups: an import can keep sending the writer bio after About you is off (High); a Branch retry loses its starting text, and a stale rolling lock sticks the primary room in recovery (Medium); six Low | High | [tabs epic-review follow-ups](../tech-debt/2026-11-26-workshop-tabs-epic-review-follow-ups.md) |
| The Lightbox passage tests fail CI on timing, including unrelated PRs | Medium | [wall-clock test](../tech-debt/2026-11-19-lightbox-passages-wall-clock-test.md) |
| A send refused while the room is busy loses its draft | Medium | [gated send loses draft](../tech-debt/2026-11-18-workshop-gated-send-loses-draft.md) |
| Lexical Gravity logs a rejected reply's text | Medium | [LG logs reply text](../tech-debt/2026-11-18-lexical-gravity-logs-rejected-reply-text.md) |
| The stored-file rewrite may not fence a stalled writer | Medium | [stalled writer fence](../tech-debt/2026-11-19-stored-file-rewrite-stalled-writer-fence.md) |
| Earlier turns re-read cost | Low | [re-read cost](../tech-debt/2026-11-18-workshop-earlier-turns-reread-cost.md) |

The full list is in [`.todo/tech-debt/`](../tech-debt/README.md).

## Suggested next rounds

1. **The Persona Measures epic: 35, then 31.** One epic, two releases. The
   [plan and kickoff prompt](../epics/epic-persona-measures-2026-11-27/README.md)
   are ready.
2. **Bubble polish: 40, 44 and 43.** Small, visible, and none of them
   touches the session file's format beyond an optional field.
3. **Round three cleanup:**
   - **The tabs follow-ups' High item first:** the writer bio still sent
     after About you is off. A privacy fix, and a 2.17.x patch.
   - **The CI timing test.** It blocks other people's PRs.
   - **The draft-loss tech debt** and **the Lexical Gravity log leak.**
   - **32 (BYOK help)** and **38's rest.**

**After those:** 42 (its design is being drawn), 41, 45 and 46, each its
own slice; then a context and memory epic (19, 17), the High items that
have waited longest.

## Older notes in this folder

These are earlier than the numbered inbox. The status is as each note
gives it. Several look stale; confirm them in code before acting on one,
and archive any that shipped.

| Note | Status the note gives | Priority |
|---|---|---|
| [Context bar: cache vs. fresh tokens](feature-context-cache-token-visibility/README.md) | Proposed | Low |
| [Desktop shell adapter](feature-desktop-shell-adapter/README.md) | Planned | Low |
| [Dictionary chromatic palettes](feature-dictionary-chromatic-palettes/README.md) | In review on an old branch (check) | Medium |
| [Full-tab conversation agent](feature-full-tab-conversation-agent/README.md) | Planned | Medium |
| [Lightbox ribbon structure](feature-lightbox-ribbon-structure/README.md) | Proposed | Medium |
| [A prior conversation is a resource](feature-prior-conversation-as-resource/README.md) | No status line | — |
| [Proofread and the Draft Edit foundation](feature-proofread/README.md) | "In progress" via the Draft Edit epic (check: Proofread and Craft Flags have shipped) | Medium |
| [Provider conversation prompt cache](feature-provider-conversation-prompt-cache/README.md) | Implemented; live acceptance pending | High |
| [Publishing standards: genre data](feature-publishing-standards-genre-expansion/feature-publishing-standards-genre-expansion.md) | Planned | Medium |
| [Request history buttons](feature-request-history-buttons/README.md) | Planned; the Dictionary part is built | Medium |
| [Settings support and community tile](feature-settings-support/README.md) | No status line | — |
| [Sidebar frame reskin](feature-sidebar-frame-minion-reskin/README.md) | Parked | Medium |
| [Story bible](feature-story-bible/README.md) | Queued | Low |
| [Amplified persona expression](feature-workshop-amplified-expression/README.md) | Implemented (check) | High |
| [Apply to draft](feature-workshop-apply-to-draft/README.md) | Superseded in part by Persona File Edits | Medium |
| [Branch board](feature-workshop-branch-board/README.md) | Parked | Medium |
| [Thin the bubble's action row](feature-workshop-bubble-action-row-thinning/README.md) | Idea | Low |
| [Personas propose file edits readily](feature-workshop-file-edit-proposal-readiness/README.md) | Open | Medium |
| [Header model browser](feature-workshop-header-model-browser/README.md) | Parked | Medium |
| [Memories citing several sessions](feature-workshop-memory-multi-session-sources/README.md) | Idea | Low |
| [Participant identity colors](feature-workshop-participant-identity-colors/README.md) | Proposed | Low |
| [Persona schematic](feature-workshop-persona-schematic/README.md) | No status line | — |
| [Project memory](feature-workshop-project-memory/README.md) | "In an epic" (check: Project Memory has shipped) | Medium |
| [Bookmark counts in the session catalog](feature-workshop-recall-bookmark-counts/README.md) | Idea | Low |
| [Relational depth](feature-workshop-relational-depth/README.md) | Implemented on a feature branch (check) | High |
| [Response save names](feature-workshop-response-save-names/README.md) | Planned; ADR deferred | Medium |
| [Retired sidecar divider emphasis](feature-workshop-retired-sidecar-divider-emphasis/README.md) | Planned | Low |
| [Side Quests](feature-workshop-side-quests/README.md) | Planned (check: AGENTS.md describes a Side Quest's End) | Medium |
| [Subagents](feature-workshop-subagents/README.md) | Idea; ADR first | Medium |
| [Task sidecar conversations](feature-workshop-task-sidecar-conversations/README.md) | Proposed; ADR first | Medium |
| [Transcript PDF export](feature-workshop-transcript-pdf-export/README.md) | Parked | Low |
