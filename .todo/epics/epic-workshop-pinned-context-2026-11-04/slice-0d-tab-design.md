# Slice 0d: Tab Design

**Epic:** [Workshop Pinned Context](README.md)
**Decision:** [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-pinned-context.md), D6 (budget), D7 (what the writer sees), D8 (the tab)
**Design precedent:** Project Memory's approved settings design (PR #196):
`docs/design/workshop-project-memory/` and
`.todo/epics/epic-workshop-project-memory-2026-11-04/slice-0d-settings-design.md`
on `epic/workshop-project-memory-slice-0-design`
**Status:** Not started. It can start now, because it touches no code.

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
3. **The glyph.** `iconPaths.ts` already has `pin` (`:40`); check where it is
   used before giving it this meaning. It must not be Memory's `eye`.

## Progress

- **2026-11-04.** Brief written with the spec. Not started.
