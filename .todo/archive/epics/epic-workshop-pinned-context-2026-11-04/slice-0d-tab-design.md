# Slice 0d: Tab Design

**Epic:** [Workshop Pinned Context](README.md)
**Decision:** [ADR 2026-11-04](../../../../docs/adr/2026-11-04-workshop-pinned-context.md), D6 (budget), D7 (what the writer sees), D8 (the tab)
**Design precedent:** Project Memory's approved settings design (PR #196):
`docs/design/workshop-project-memory/` and
`.todo/epics/epic-workshop-project-memory-2026-11-04/slice-0d-settings-design.md`
on `epic/workshop-project-memory-slice-0-design`
**Canvas:** https://claude.ai/artifact/2dZHup6uEFKQML17dJeZqz (private to Okey), snapshotted in `docs/design/workshop-pinned-context/`
**Status:** Done. Okey approved the third pass on 2026-11-05 (13 artboards).

## Outcome

The Pinned context tab is drawn on the real dark theme, in every state below,
beside the approved Memory tab so the two read as one dialog. Okey approves
it, and the canvas is snapshotted under `docs/design/workshop-pinned-context/`
with a README, as Project Memory's is. **Once approved, this doc owns the
layout, copy and states;** Slice 3 owns the wiring.

The pill's pin mark and tooltip (Slice 4) and the full reset's new subtitle
(Slice 2) are drawn in the same canvas.

## Rules carried over from the Memory design

- Full tabs stay warm-dark (`styles/fulltab/tokens.css`). No light theme.
- No new colors. Amber means "needs attention", as on the Memory tab.
- Cards, rows and rules use the dialog's existing classes
  (`pm-ws-behavior-card`, the About you notice well, the Memory tab's folder
  row).
- Copy is plain and specific, and says what happens, never what "may".
- The two-meter row on the Memory tab stacks below 760px. This tab's one
  meter does the same.

## Starting brief (the designer may change any of it)

**Tab strip:** Behavior · About you · **Pinned context** · Memory · Advanced
(question 1).

**Header copy:** "Choose how Workshop personas respond, what they may
proactively offer, what you explicitly share and attach to every new
conversation, what they remember about this project, and whether they may
research the live web."

**Section "Pinned context".**

- Help: "These files are attached to every new conversation in this project,
  in this order. Each new conversation reads them as they are when it
  starts."
- A line that echoes the Memory tab's well without repeating it: "Pinned
  files are context: sent in full, and counted in the 100,000-word context
  limit with anything else you attach."
- Meter: "10 files · about 23,400 of 100,000 words".

**The list.** One row per entry, in order:

- name; the path in mono; the catalog group as a chip ("Characters");
  words;
- "In this conversation" when the current room has it (ADR D4);
- utilities on hover or focus: Move up, Move down, Open file. **Unpin** is
  the row's button.

**Actions under the list:**

- **Add from project…** (primary). It opens the shared picker over the
  dialog, with the footer "Pin 3 files · ~4,100 words est.";
- **Pin what's attached now (3)**;
- **Attach missing to this conversation (2)**;
- the file row: `prose-minion/pinned-context.json` in mono, "Saved in this
  project. You can read and edit it in VS Code.", and **Open file**.

**Footer:** "Applies the Behavior, About You, Memory, and Advanced drafts
together. Pinned context saves as you change it and applies to new
conversations. Memory and live web research take effect on your next
message."

## States to draw

| State | What changes |
|---|---|
| **Listed** | As above |
| **Empty** | "Nothing pinned yet." and "Add files from your project, or pin what's attached to this conversation now." No meter. The file row says "The file is made when you pin the first file." |
| **Over budget** | The meter turns amber and full: "about 104,000 of 100,000 words". An amber line: "*manuscript.md* won't attach to new conversations until there's room. Unpin a file to make room. Nothing is unpinned for you." |
| **Refused pin** | Inline under the picker's footer, or under the row: "Can't pin this one: pinned context would come to about 104,000 of 100,000 words. Unpin another file, or shorten this one." Also "Pinned context holds at most 20 files." |
| **Missing entry** | The row's state is amber "Not found", with "It isn't attached. Unpin it, or put the file back." and Unpin only |
| **Can't read an entry** | Amber "Can't read: …" with the reason in words |
| **Head-sliced entry** | "Attached as its first 99,000 of 140,000 words", as the pill says today |
| **The file is unreadable** | An amber notice at the top: "**pinned-context.json can't be read.** *Reason in words.* Nothing is attached from it until it's fixed. Fix it in the editor." Only Open file is enabled |
| **Changed in another window** | An info line above the list: "Pinned context changed in another window. This is the current list." |
| **Unavailable: no folder** | An amber notice, as on the Memory tab: "**Pinned context isn't available here.** No folder is open, so there's no project to pin files in. Open a single folder to use pinned context." Every action is disabled |
| **Unavailable: several folders** | The same, with "This workspace has several folders, so pinned context can't tell which project it belongs to." |
| **A run in progress** | Attach missing is disabled, with "Wait for the reply to finish." Pin and unpin still work |

**Also in the canvas:**

- **The pill's mark** (Slice 4): a small pin glyph on a pinned pill, with the
  tooltip "Pinned: attached to every new session. Removing it here removes
  it from this conversation only."
- **The sessions menu** (Slice 2): "New session: full reset", with the
  subtitle "clears the excerpt and context, then attaches pinned context".
- **The New result line** (Slice 2), full and partial (ADR D7).

## Open questions for the design

1. **Picker stacking.** The shared picker opens over the settings dialog.
   Confirm with `WorkshopModalShell` that Escape closes only the picker and
   that focus returns to **Add from project…**. Project Memory has the same
   question for its manager (its 0d, question 2).
2. **Move up and Move down, or drag?** Buttons are keyboard-honest and cheap.
   Drag can come later.
3. **The glyph.** `iconPaths.ts` already has `pin` (`:40`), and the
   Workshop already uses it twice. It's on the excerpt's "Re-pin *chapter*
   v2" and "Continue with current excerpt" buttons, and it marks a Lightbox
   tile among a message's attachments (ADR D1). The first pass draws the
   pinned pill's mark as a small accent `pin` after the word count, where
   context pills had no pin before. Okey decides whether that reads clearly,
   or whether the mark takes another glyph. Memory's `eye` is out either
   way.

## First pass (2026-11-04)

The boards, and what they settle, are listed in the
[design README](../../../../docs/design/workshop-pinned-context/README.md).
Choices the brief left open, made here for Okey to accept or change:

- **The list is numbered,** with the order spelled out in the heading
  ("Files, in order"). Order is the attach order, so it's shown, not
  implied.
- **"In this conversation"** is an accent check on each row the current room
  holds (ADR D4). The meter's chips count them ("8 in this conversation").
  "Attach missing to this conversation (2)" takes its count from the same
  rule.
- **Move up and Move down are buttons** (question 2): two small chevron
  buttons with full accessible names ("Move alice.md up"). Drag is left for
  later.
- **Problems sit on their rows,** in amber, with the reason in words. One
  amber line under the meter counts them and ends "Nothing is unpinned for
  you." This matches the Memory tab's over-budget line.
- **A start note under the meter** says which room starts seed: "New session
  and New session: full reset both start with these files, in this order.
  Opening, branching or rewinding a saved session leaves its context as it
  was." (ADR D2).
- **Picker stacking** (question 1) is drawn as the picker over the dimmed
  dialog. Escape and focus return still need checking against
  `WorkshopModalShell` when Slice 3 builds it.
- **The picker in pin mode** keeps the shared picker's markup. Only its
  copy and footer change: eyebrow "Pin context", already-pinned files
  disabled and tagged "Pinned", "Pin N files", and the estimate measured
  against what pinned context has left (76,600 of 100,000 words).
- **A refused pin** shows as an alert in the picker, above its footer, so
  the writer sees it where they acted.
- **Pin from a pill** (ADR question 6) is drawn as a small "Pin" button on a
  hovered, unpinned file pill. It's drawn so Okey can judge it, and is cut
  if the answer is no.

## Second pass (2026-11-04, Okey's notes)

1. **The tab says what pinned context is.** Okey asked for wording that
   explains how pinned context differs from a conversation's context:
   context is managed per session, character files and places are wanted in
   most sessions, pinning saves the step, and files can still be added and
   removed in the session's context panel.
   - A **template well** now heads the tab in every state, the counterpart
     of the Memory tab's "Memory isn't context" well, in the same accent
     treatment.
   - Head: **Pinned context is a starting template.** "Each new
     conversation copies it once, then keeps its own."
   - A two-column comparison:

     | | Pinned context | A conversation's context |
     |---|---|---|
     | **Change it** | Here, in this tab | In that conversation's Context panel, any time |
     | **Reaches** | Every new conversation in this project, as it starts | That conversation only |
     | **Holds** | Files most conversations need: characters, places, the project brief | Whatever the conversation needs, starting with the pinned files |

   - Last line: "Removing a file from a conversation doesn't unpin it.
     Unpinning a file doesn't remove it from conversations that have
     already started."
   - The note under the actions, which said the unpinning half of that,
     drops it and keeps "Pin files from this project only."
2. **New session: full reset, empty context** (ADR question 5, now decided).
   It is drawn in the sessions menu under the full reset, with "clears the
   excerpt and context, and leaves pinned context out". Its result line is
   drawn with the others: "Started an empty Workshop session: excerpt and
   context cleared, and pinned context left out." The tab's start note now
   names all three starts.

Every tab state grew by the well's height (about 140px). The frames and the
picker's backdrop grew with it.

## Third pass (2026-11-04, Okey's notes)

Okey: "This looks good." Two refinements:

1. **The file list is a scrollable well,** so the dialog doesn't get too
   tall.
   - The rows sit in an inset box (`--inset`, the frame's border, 10px
     radius) with a 340px maximum height, about six rows. It scrolls
     inside the tab.
   - The heading gains the count: "Files, in order · 10".
   - The dialog's height no longer depends on the list. The tab states with
     a list came down by 160–220px.
   - Nothing hides under the scroll: the amber line above the well already
     counts every row that won't attach. In the Problems and Over budget
     boards the well starts scrolled to the bottom, to show those rows.
   - In the build, a row moved past the fold scrolls into view, with focus
     kept on its Move button (Slice 3's tests).
2. **The template note collapses, and starts open.**
   - Its heading is a disclosure button: the info glyph, **Pinned context
     is a starting template.**, the one-line gist, and a chevron at the
     end. It has `aria-expanded` and `aria-controls`.
   - Collapsed, the heading line stays and the comparison and last line
     hide.
   - The choice is remembered as one UI preference in the hook's persisted
     state, so a writer who collapses it isn't shown it again on every
     visit. This goes slightly past "starts out visible"; if Okey wants it
     open on every visit instead, the preference goes and nothing else
     changes.
   - A new board, `Collapsed.dc.html`, shows the collapsed state. In
     `Main.dc.html` the toggle works.

## Progress

- **2026-11-04.** Brief written with the spec.
- **2026-11-04. First pass.** Okey asked to start the design. The canvas
  reuses the approved Memory design's dialog shell, tokens and rules by
  value, so the two tabs read as one dialog. It has 12 artboards: 9 tab
  states, the picker in pin mode and refusing a pin, and one Workshop board
  (pill mark, full reset copy, New result). It is published and snapshotted
  under `docs/design/workshop-pinned-context/`. Waiting on Okey's review.
  No production code; no tests run (docs only).
- **2026-11-04. Second pass.** Two notes from Okey are drawn: the template
  well at the top of the tab, and the empty-context New in the sessions
  menu with its result line. Snapshotted again. Waiting on his review.
- **2026-11-04. Third pass.** Okey liked the second pass. Drawn: the file
  list in a scrollable well, and the template note as a disclosure that
  starts open, with a new Collapsed board (13 artboards in all).
  Snapshotted again. Waiting on his approval.
- **2026-11-05. Approved.** Okey approved the third pass as it stands. The
  snapshot in `docs/design/workshop-pinned-context/` is the approved design.
  The design draws the recommended answers to ADR questions 1, 2, 3 and 6,
  so the ADR records them as decided.
