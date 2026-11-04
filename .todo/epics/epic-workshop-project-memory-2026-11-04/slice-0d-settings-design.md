# Slice 0d: Settings Design

**Epic:** [Workshop Project Memory](README.md)
**Decision:** [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-project-memory.md), D4 (limits), D5 (budgets), D7 (receipts), D8 (modes, unavailable), D10 (storage), D14 (update notes)
**Design:** [`docs/design/workshop-project-memory/`](../../../docs/design/workshop-project-memory/README.md)
(canvas https://claude.ai/artifact/NYB5iZWgaJB4BJdPuN3hwF)
**Branch:** `epic/workshop-project-memory-slice-0-design`
**Status:** Done. Okey approved the design on 2026-11-04, with one change (the
receipt expand, below), which is drawn.

## Outcome

The writer-facing surfaces of project memory are drawn on the real dark theme
and approved by Okey:

- the Memory tab in Conversation settings;
- the memory manager;
- the suggestion card, the receipts and the update note in the thread;
- the Save to memory… / Edit… / New memory sheet.

The canvas is snapshotted under `docs/design/workshop-project-memory/`. No
production code changed.

## Who builds what

| Surface | Slice |
|---|---|
| Memory tab (every state below), including the "Memory isn't context" well | 4b, on 4a's per-tab panels |
| Memory manager, including conflict, unreadable and over-pinned rows | 4b |
| Suggestion card, its settled states, writer-save receipts | 3 |
| Update note divider | 3 draws it; 2b builds the note itself (ADR D14) |
| "Save to memory…" on a bubble, and the sheet (save, edit, new, refused) | 3 (4b's manager opens the same sheet for New and Edit) |
| Save-and-tell-me receipt (Edit · Forget, the expand), the held card | 5, rendered by Slice 3's components |

**One component, two modes.** The Ask-first suggestion card and the expanded
Save-and-tell-me receipt are the same component. The receipt renders it
read-only: no Save, Edit… or Dismiss. Slices 3 and 5 build it once.

## Decisions

1. **The mode is global; memories are per project.** One setting,
   `proseMinion.workshop.projectMemory` (`off` | `ask` | `auto`), applies to
   every project. Each project keeps its own memories in
   `<workspace>/prose-minion/memory/`. Okey decided it; this answers ADR open
   question 1.
2. **The setting starts Off. Ask first is recommended** (D8). Its card carries
   a small "Recommended" tag. Off is not drawn as a warning.
3. **Unavailable is not a mode.** With no folder open, or several, this
   workspace gets no memory and the manager is disabled, with the reason. The
   mode cards **stay choosable**, because the global mode still applies to the
   writer's other projects. There is no session-only memory.
4. **Off keeps the writer's access** (D8). Manage memories…, Open memory
   folder, New, edit, pin, archive and delete all work while memory is off.
5. **Two budgets, two meters.** Pinned bodies load in full up to
   `pinnedTokens: 5_000`, and the list (title and summary of the rest) up to
   `catalogTokens: 2_000`. The tab shows a meter for each, plus the total. Both
   numbers are starting values that the live pass tunes (D11).
6. **Limits are the codec's** (D4, Slice 1): title 120 characters, summary
   280, note (body) 8,000. The sheet's counters show them.
7. **An update note replaces "the catalog loads at the start"** (Okey's
   answer to ADR open question 3). When memories change after a conversation
   started, the personas get a note with the writer's next message. The thread
   marks it once with a quiet divider. So the footer's "Memory … takes effect
   on your next message" is simply true.
8. **No `INDEX.md` in v1**, so nothing offers to open one.
9. **Nothing is ever unpinned for the writer.** Over the pinned budget,
   pinned memories are considered oldest-created first, ties by id (ADR D5;
   format 1 stores no pin time). Bodies that fit load in full; the rest load
   as list entries. The manager shows the shared builder's actual
   loaded/not-loaded result, never a guess from dates, and the writer
   unpins.
10. **Forget archives; only Delete removes a file** (D8). Forget's receipt
    says "It's archived, not deleted" and offers Restore.
11. **Superseded is derived** (D4): the manager shows "Superseded by '…'" from
    the newer memory's `supersedes`. It stores no status.
12. **Origin is shown in words** (D4): `writer` → "written by you",
    `proposed` → "suggested by Jill · saved by you", `auto` → "saved by
    Jill".
13. **The Save-and-tell-me receipt expands** (Okey's change at approval).
    - A chevron button before the receipt line expands the saved memory in
      place, as the suggestion card's box without actions: header "Saved to
      project memory", kind chip, title, summary, the "Replaces …, which stays
      searchable" line when it supersedes, and the "Full note" disclosure.
    - It is collapsed by default.
    - The button has `aria-expanded` and `aria-controls`, and its name is
      "Show the saved memory" / "Hide the saved memory".
    - The receipt line keeps Edit · Forget.
14. **Light theme is a proposal only.** Full tabs are pinned warm-dark
    (`styles/fulltab/tokens.css`). The two light artboards show what the tab
    would look like if full tabs follow VS Code's theme later. Nothing builds
    them now.
15. **"Memory isn't context."** Okey added this after approval. A well near
    the top of the tab keeps writers from confusing project memory with the
    context they attach to a conversation.
    - It shows in every state, off and unavailable included, because that is
      when a writer decides whether to turn memory on.
    - It sits below any unavailable notice and above the mode cards, compact
      enough not to push them out of view.
    - Its treatment is the frame's existing accent well, the one About you's
      notice uses (`pm-ws-profile-notice`: accent at 6% with the accent
      `info` glyph), plus a faint accent border. No new color.
    - Its context column defines context as what is *attached* to a
      conversation ("The conversation it's attached to"). A future settings
      tab that attaches files automatically can then be referenced without
      rewording. The design names no such tab.

## The Memory tab

The tab order is Behavior · About you · **Memory** · Advanced.

- **Header copy** gains memory: "Choose how Workshop personas respond, what
  they may proactively offer, what you explicitly share, what they remember
  about this project, and whether they may research the live web."
- **The "Memory isn't context" well** (decision 15), in every state, after
  the unavailable notice when there is one and before the cards. Its head is
  the `info` glyph, **Memory isn't context.** and "They reach personas
  differently." Under it is a three-row comparison (a `dl`):

  | | Project memory | Context |
  |---|---|---|
  | **Reaches** | Every conversation in this project | The conversation it's attached to |
  | **Holds** | A one-line summary of each memory, plus the few you pin. Personas open a full note only when they need it | Whole files and passages, sent in full |
  | **Size** | Kept small: about 7,000 tokens in all | Much larger: up to 100,000 words |

  The 7,000 is `pinnedTokens` plus `catalogTokens`, and the 100,000 words is
  the context limit (`CONTEXT_ATTACHMENTS.words` in `promptBudgets.ts`). Slice 4b reads both from their budgets, so the well
  never states a number the build doesn't enforce. Below 760px the grid
  stacks to one column per side.
- **Section "Project memory".** Three cards in the existing
  `pm-ws-behavior-card` style:
  - **Off** (a slashed circle, a new glyph): "Personas start each
    conversation without project memory, and they don't suggest new ones."
  - **Ask first** (`hand`, "Recommended"): "A persona can suggest a memory
    under its reply. It's saved only when you choose Save."
  - **Save and tell me** (`stamp`): "Personas save what's worth keeping and
    say so in the thread. Edit or forget any of it there."
  - Note under them: "This setting applies to all your projects. Each
    project keeps its own memories, in its own folder."
- **Section "At the start of each conversation".** One row, with labels for
  the count, the pinned count and the token total (`12 memories`, `2 pinned`,
  `≈ 1,800 tokens`), and two meters:
  - "Pinned, in full · 2", "about 1,100 of 5,000 tokens";
  - "Titles and summaries · all 10 fit", "about 700 of 2,000 tokens".
  - Row name: "Every memory's title and summary". Help line: "Each persona
    also sees the 2 pinned memories in full, and opens the rest when the
    conversation needs them."
- **Section "Your memories".** A row with `prose-minion/memory/` in mono and
  "One Markdown file per memory. You can read and edit them in VS Code.", and
  the buttons **Open memory folder** and **Manage memories…**. Both act at
  once, not on Apply.
- **Footer:** "Applies the Behavior, About You, Memory, and Advanced drafts
  together. Memory and live web research take effect on your next message."

### States

| State | What changes |
|---|---|
| **On, with memories** | As above |
| **Off** | Row "Nothing loads while memory is off": "Memory is off in every project. This project's memories stay in its folder, and you can still manage them." Label `12 saved`. No meters |
| **On, no memories yet** | Row "No memories yet". Under Ask first: "When a persona suggests a memory, it appears under its reply for you to save. You can also say "remember that…", or choose Save to memory… on any message." Under Save and tell me: "Personas save what's worth keeping as you work. …". Folder help line: "The folder is made when the first memory is saved, or when you open it." |
| **List over its budget** | Row "Pinned memories first, then the most recent". The list meter turns amber and full: "Titles and summaries · 25 of 37 fit", "about 2,000 of 2,000 tokens". An amber line: "12 more are searchable. Personas find them with memory search when the conversation needs them." |
| **Pinned over its budget** | Not drawn on the tab. The pinned meter takes the same amber, full treatment, "about 5,600 of 5,000 tokens", and the row's help line points to the manager. The manager state is drawn |
| **Unreadable files** | An amber row under "Your memories": "2 files can't be read". "They aren't loaded, and personas can't find them. Fix the frontmatter in the editor, or move the file out of the folder. Nothing else is affected." Each file is listed with its reason, plus **Show in manager** |
| **Unavailable: no folder** | An amber notice at the top: "**Project memory isn't available here.** No folder is open, so there's no project to keep memories in. Open a single folder to use project memory. The mode above still applies to your other projects." Row "Nothing loads": "Personas in this workspace get no project memory, whatever the mode above says." Both buttons are disabled |
| **Unavailable: several folders** | The same, with "This workspace has several folders, so memory can't tell which project it belongs to." |

## The memory manager

Built from `SavedItemBrowserModal` and `SavedItemRow`, the session browser's
markup and classes. It needs no new shared opt-in, and the Workshop's and the
Lightbox's markup stay unchanged.

- **Header:** eyebrow "Workshop · Project memory", title "Project memories",
  and "What this project's personas start each conversation knowing. Pinned
  memories load in full; the rest load as a title and summary, and a persona
  opens the full note when it needs it."
- **Toolbar:**
  - Search: "Search titles, summaries and notes…", with the scope pill
    "searches notes".
  - Group by **Kind** | **Date**.
- **Status labels:** `6 active`, `4 pinned · ≈ 4,300 of 5,000 tokens`,
  `list · ≈ 700 of 2,000 tokens`, and `3 files need attention` in amber.
  - With memory off, an info line comes first: "Memory is off, so personas
    don't read these. You can still edit, pin, archive and delete them. Turn
    memory on in Conversation settings."
- **Section "Needs attention"** ("Not loaded. Fix the file in the editor;
  Memory never rewrites it."). The rows show the file name in mono, an amber
  badge and the reason. Each offers **Open file** only.
  - **Same id:** "Same id as *other-file*.md. Change one file's id, or delete
    one copy." Each conflicting file has its own row (D4).
  - **Can't read:** the codec's reason, in words.
- **Section "Active"** ("Load at the start of each conversation."), grouped
  by kind (Decisions, Canon, Preferences, Open threads) or by date (Today,
  This week, Earlier).
  - Glyphs by kind: decision `stamp`, canon `book`, preference `sliders`,
    open thread `dialogue`.
  - Badge: **Pinned**.
  - Meta line: kind · origin in words · date · "from 'session title'".
  - The summary sits under the meta line.
  - Hover or focus utilities: Rename, Pin/Unpin (`aria-pressed`), Archive
    (a new glyph), Open file, Delete. The primary button is **Edit**.
- **A refused pin,** inline under the row: "Can't pin this one: pinned
  memories would come to about 5,100 of 5,000 tokens. Unpin another, or
  shorten this note."
- **Pinned over budget** (hand edits, two windows; #192 F-04):
  - The pinned label turns amber: `4 pinned · ≈ 5,600 of 5,000 tokens`.
  - An amber status line: "Pinned memories are over their budget, probably
    from an edit outside the manager. Pinned memories are considered
    oldest-created first, and 'The Cheshire Cat is never seen arriving'
    doesn't fit, so it loads as a list entry instead. Unpin one to make room.
    Nothing is unpinned for you."
  - Each memory the builder didn't load in full has the badge **Pinned, not
    loaded** and the reason: "Doesn't fit the pinned budget, so it loads as a
    list entry, not in full. Unpin it or another to make room." The row never
    infers why from a date (PR #196 F-03).
- **Section "Superseded and archived"** ("Never loaded. Personas find them
  only by searching."), in muted rows:
  - superseded rows read "Superseded by '…'.", with **Edit**;
  - archived rows read "Archived. Restore to make this memory active
    again.", with **Restore**. Format 1 records no archive date or cause, so
    the row states neither (PR #196 F-04). Restoring makes the memory active;
    whether it then loads in full still depends on supersession and the
    budgets.
- **Footer:** "Changes save to the memory's file right away. Archive keeps a
  memory searchable; Delete removes its file." Buttons: **Open memory
  folder** and **New memory** (primary).

## In the thread

1. **The suggestion card** (Ask first) sits under the persona's reply, in the
   reply's own box, styled like the Next steps findings box with an accent
   border.
   - Header: "Suggested for project memory" (`bookmark` glyph) and a kind
     chip.
   - The title, the summary, and "Replaces **…**, which stays searchable."
     when it supersedes.
   - A **Full note** disclosure.
   - Buttons: **Save** (primary) · **Edit…** · **Dismiss**, with the hint
     "Saved to this project only. Later conversations start knowing it."
2. **Settled card states**, in place:
   - "Saved to project memory: **…** · Open in manager";
   - "Dismissed. **…** wasn't saved. · Show it again".
3. **Receipts** are centered divider lines that every participant sees (D7):
   - a writer's save: "Saved to project memory: **…**";
   - Save and tell me: "Jill saved to project memory: **…** · Edit ·
     Forget", with the expand (decision 13);
   - Forget: "Forgotten from project memory: **…**. It's archived, not
     deleted. · Restore".
4. **The held card** (Save and tell me), with an amber border. Its header is
   "Held for you to decide" and it has the same buttons. The reason is
   "Live web research was available for this reply, so this memory waits for
   you to save it." The hold reads whether search tools were attached, not
   whether a search ran (ADR D8), so the copy claims no search (PR #196 F-01).
   The cap variant: "This conversation has reached its limit of 5 automatic
   memory saves. This one waits for you." The cap is room-wide, so the copy
   names no persona (F-02).
5. **The update note:** a quiet divider, "Project memory updated · 1 new, 1
   changed", and under it "Sent to the personas with your next message." with
   **Show what changed**. It sits just before the writer message that carries
   the note.
6. **"Save to memory…"** joins the bubble's actions, after Bookmark.

## The sheet (Save to memory… / Edit… / New memory)

- **Title:** "Save to project memory", or "Edit memory" for an existing one.
  Help line: "Personas in later conversations start with the title and
  summary, and read the note when they need it. You can change any of it
  later."
- **Fields:**
  - Title, `n / 120`.
  - Kind, as four small cards:
    - Decision: "A choice the project made."
    - Canon: "A fact of the story."
    - Preference: "How you like to work."
    - Open thread: "A question to come back to."
  - Summary ("· what every conversation sees"), `n / 280`.
  - Note ("· read in full only when a persona needs it"), `n / 8,000`.
  - Replaces: each superseded memory with "· stays searchable" and **Don't
    replace**.
  - **Pin this memory** switch: "Pinned memories load in full at the start
    of every conversation. This one adds about 60 tokens; pinned memories
    would come to about 4,360 of 5,000."
- **Source line** (when the memory has a recallable source; a writer's new
  memory may have none, and a current, unnamed or deleted session shows ADR
  D3's reason instead): "From Jill's reply in 'Tea-party pacing', Nov 3. Personas
  can check the note against that conversation. Saved as a Markdown file in
  prose-minion/memory/."
- **Footer:** "Saving tells the room: 'Saved to project memory: …'". Buttons:
  Cancel, **Save to memory** (or **Save changes**).
- **Refused edit** (a pinned memory's edit past the budget): an amber alert
  under the note, "Can't save this edit: this memory is pinned, and the longer
  note would bring pinned memories to about 5,300 of 5,000 tokens. Shorten the
  note, or unpin this memory or another." **Save changes** is disabled. The
  same rule applies to pinning in the sheet.

## Reconciled with the ADR

Everything the design decided is in the merged ADR (PR #192) or its slice
docs:

- **Unavailable keeps the mode** (decision 3): ADR D8 ("An unavailable
  workspace … disables this workspace's memory, never the mode") and D10 (no
  session-only mode).
- **The update note** (decision 7): ADR D14 is its mechanism: the
  per-participant delivery record, the delta of new, changed and gone
  memories, and the count line past the budget. Slice 2b builds it. The design
  gives only its visible divider, which Slice 3 draws.
- **The held card's copy:** the design's wording, which Okey approved, is now
  Slice 5's: "Live web research was available for this reply, so this
  memory waits for you to save it." The cap variant is aligned too. Both were
  corrected in PR #196's review (F-01, F-02). ADR D8 quotes no copy for the
  hold ("the card says why"), so it needed no change.

## Open questions for Slice 4b and Slice 3

1. **Show what changed** on the update note: open the manager filtered to
   those memories, or expand a list in place? The design draws only the
   button.
2. **Show in manager** from the tab's unreadable row: does it close
   Conversation settings, or open the manager on top? The manager is a full
   modal, so on top seems right; confirm against `WorkshopModalShell`
   stacking.
3. **Narrow widths.** The session browser's 760px and 520px rules carry the
   manager. The tab's two-meter row should stack its labels under the meters
   below 760px. That isn't drawn.
4. **Contrast.** The real `--pm-dim` on `--pm-surface-2` is under 4.5:1. The
   design matches the product rather than fixing it here. That is worth a
   separate tech-debt item across the full tabs.
5. **New glyphs:** the Off card's slashed circle and Archive join
   `iconPaths.ts`.

## Progress

- **2026-11-04.**
  - First pass (the Memory tab, nine artboards) published.
  - Folded in the draft ADR's D8 and Okey's answers:
    - a global mode;
    - pinned 5,000 and list 2,000;
    - the update note;
    - no `INDEX.md`;
    - unavailable = off with a reason.
  - Second pass: the manager, the thread and the sheet. Then the codec's
    limits (120/280/8,000) and the over-pinned states (#192 F-04).
  - Okey approved, with the receipt expand, which is drawn.
  - Snapshotted, with this doc. No production code; no tests run (docs only).
  - After approval, Okey added the "Memory isn't context" well (decision 15).
    It is drawn in every tab state, the tab artboards grew to 1,040px, and
    the canvas and snapshot were updated.

## PR #196 review

[docs/pr-reviews/pr-196-project-memory-settings-design-review.md](../../../docs/pr-reviews/pr-196-project-memory-settings-design-review.md)
asked for four factual-copy fixes. All four are fixed in the canvas, the
snapshot and the docs above:

- **F-01:** the hold copy claims no search.
- **F-02:** the cap copy is room-wide.
- **F-03:** the pinned overflow follows D5's creation order and the builder's
  result.
- **F-04:** archived rows state no date or cause.

Its six implementation watchpoints carry to 4b and 3 as written there:

1. no memory body in the receipt's model-facing payload;
2. drafts survive the nested manager;
3. summaries from the host's live state;
4. the divider is not the delivery record;
5. source fallbacks;
6. the existing tab and row interaction contracts.
