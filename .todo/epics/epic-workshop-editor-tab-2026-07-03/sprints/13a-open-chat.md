# Sprint 13A: Open Chat

**Status**: Planned  
**Priority**: High  
**Branch**: `sprint/workshop-editor-tab-13a-open-chat` -> PR into `epic/workshop-editor-tab`  
**Depends on**: Sprint 10 persistence baseline and its recorded manual continuity pass  
**Parent**: [Sprint 13 delivery plan](13-open-chat-guest-room-polish.md),
approved design [Prose Minion - Assistant Tab](../../../../docs/design/Prose%20Minion%20-%20Assistant%20Tab.html) (synced 2026-07-24)

## Goal

Let a writer begin a retained Workshop conversation without an excerpt, while
keeping the product honest about what the persona has and has not seen.

## Scope

### 1. Session scope is an explicit property

`scope` is session state with three values — `null` (path not chosen),
`excerpt` (passage session), `open` (open conversation). It is **not** inferred
from excerpt presence. Center view, header meta, composer placeholder, and rail
all key off it. A blank `WorkshopExcerpt` is still forbidden.

### 2. The path chooser is the first-run center state

Replaces "Pin an excerpt to start the Workshop." Heading **"What are we making
today?"** over two equal-weight cards — *Workshop an excerpt / Passage session*
and *Just chatting / brainstorming / Open conversation*. The footer names the
host and points at the host switcher, ending with the accented "Or select
another host up top."

### 3. Excerpt and context survive a new session

A new session clears transcript, host settings, and to-dos but **retains the
pinned excerpt and all context attachments**. The excerpt path therefore leads
with **Continue with current excerpt** (`title vN · source · N words`) above
*Paste or type* and *Choose from project*. The same continue affordance appears
in the rail when an excerpt is shelved.

> This changes new-session semantics established in
> [ADR 2026-07-14](../../../../docs/adr/2026-07-14-workshop-session-persistence.md).
> Confirm the persisted shape carries excerpt + attachments across the boundary
> before implementing.

### 4. The path is reversible in both directions

- **Passage → open**: "Set this aside — just chat" (rail) and a "Changed your
  mind?" pill in the ready state. The passage is *shelved*, not deleted.
- **Open → passage**: "Add excerpt" in the scope strip, rail card, and composer,
  plus **Re-pin title vN** when something is shelved.
- **Excerpt pinned during open chat**: "Unpin excerpt" on the passage strip and
  "Unpin — back to open conversation" in the rail.

All of these are context transitions **inside one retained session**.

### 5. Paste or type is a widget, not an instant action

Modal sheet with `Edit │ Preview` tabs, live word count, Close / Apply (Apply
disabled at zero words), a "paste sample passage" helper, and a "Choose from
project…" cross-link. Invoked mid-conversation, the header states that the
conversation is retained.

### 6. One shared text sheet for all authored context

The same Edit/Preview sheet serves excerpt paste, **Add text**, editing an
existing text note, and editing wizard-generated context (kicker
`Context · Wizard suggestion`, with a note that edits are session-only and the
source file is untouched). Preview renders markdown read-only — headings,
bold/italic, lists, blockquote, code, rules. **Add text** no longer inserts a
placeholder pill; text-note labels derive from the first line.

### 7. Context attachments are clickable

File pills open an editor tab in the top tab strip (closable,
keyboard-accessible); text and wizard pills open the edit/preview sheet.
Caption: "Files open in an editor tab · text and wizard notes open for edit or
preview."

### 8. Context works in open chat

Copy states this explicitly in three places — the chat path note, the open-chat
start block, and the rail no-excerpt card: context rides along in open
conversations; only the excerpt is absent.

### 9. Tool gating

While no excerpt exists, the six rail tools and "All 14 tools…" are dimmed with
a `NEEDS EXCERPT` badge, `aria-disabled`, a tooltip, and a toast reading "Add an
excerpt to use analysis tools." The composer Tools button is likewise disabled.
No tool is redesigned.

### 10. Status honesty

Open chat shows `Open conversation · No excerpt yet` in the header meta, the
composer context line, and a center scope strip that adds "Host hasn't read any
pages." Adding an excerpt draws a divider — "Excerpt added · title vN — same
session, conversation retained" — and flips the strip to
`Passage session · title vN · Analysis tools available`.

### 11. Prompt honesty

The first persona prompt states plainly that no excerpt is available and that
the conversation is for planning, ideation, craft discussion, or getting to know
the Workshop. The persona must not claim to have read a passage. Session scope
is persisted and surfaced in restore/browser metadata.

## Explicit non-goals

- No guest invitation in an excerpt-free room.
- No tool eligibility via a blank, fabricated, or implied excerpt.
- No guest capability or room-catch-up changes.
- No tool redesign — gating only.

## Exit criteria

- A writer can have a retained host conversation with no excerpt, reload or
  reopen it, and later adopt an excerpt without restarting.
- Scope drives every surface; nothing infers scope from excerpt presence.
- Both path reversals work and shelve rather than delete.
- A new session retains excerpt + context attachments and clears transcript,
  host settings, and to-dos.
- The shared text sheet serves all four authoring cases, and wizard edits are
  session-only with the source file untouched.
- File pills open editor tabs; text and wizard pills open the sheet.
- Prompts, transcript labels, and empty-state/composer copy never imply that a
  persona read unseen prose.
- Tools remain disabled until an excerpt exists; the reason is visible,
  `aria-disabled`, and announced.
- Focused session, prompt, persistence, hook, and UI tests pass alongside the
  normal typecheck, full suite, lint, production build/bundle, and
  `git diff --check`.
