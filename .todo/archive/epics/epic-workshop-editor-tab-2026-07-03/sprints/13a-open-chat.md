# Sprint 13A: Open Chat

**Status**: Implemented on `sprint/workshop-editor-tab-13a-open-chat`; manual
Extension Development Host pass outstanding  
**Priority**: High  
**Branch**: `sprint/workshop-editor-tab-13a-open-chat` -> PR into `epic/workshop-editor-tab`  
**Depends on**: Sprint 10 persistence baseline and its recorded manual continuity pass  
**Parent**: [Sprint 13 delivery plan](13-open-chat-guest-room-polish.md),
approved design [Prose Minion - Assistant Tab](../../../../../docs/design/Prose%20Minion%20-%20Assistant%20Tab.html) (synced 2026-07-24)\
**Design load**: **High** — path chooser and path cards, scope strips, the
Edit/Preview sheet with its markdown renderer, the editor tab strip, pill
states, `NEEDS EXCERPT` badges, dividers, and a large amount of exact copy.
Build against the comp; do not improvise layout or wording.

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
> [ADR 2026-07-14](../../../../../docs/adr/2026-07-14-workshop-session-persistence.md).
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

- No guest invitation in an excerpt-free room in 13A. This temporary boundary
  is superseded by [Sprint 13D_2](13d_2-open-room-participants.md), which adds
  the required no-excerpt guest honesty envelope.
- No tool eligibility via a blank, fabricated, or implied excerpt.
- No guest capability or room-catch-up changes.
- No tool redesign — gating only.

## Implementation notes (2026-07-25)

### Where the comp and the product disagreed

Four places, all resolved toward product reality and recorded here rather than
silently absorbed:

1. **The editor tab strip.** The comp draws a VS Code-style tab bar *inside the
   page* and pushes file pills into it. In the shipped extension the Workshop
   **is** an editor tab, so VS Code already owns that chrome — rendering a
   second one would duplicate it and the tabs could not host a document. Okey
   chose a hybrid (2026-07-25): a file pill opens the shared **Edit/Preview
   sheet**, which renders the markdown prettified in-webview, and the sheet
   carries an explicit **Open in editor tab** action for the real document.
   That open routes through the existing `ShellService.openFileInEditor` port,
   so `packages/core` stays host-agnostic and the same flow ports to a desktop
   app. The pill caption reads accordingly: "Files open for reading · text and
   wizard notes open for edit or preview."
2. **"Paste sample passage."** Deliberately omitted. The comp's sample is its
   own demo novel; dropping invented prose into a writer's room would be worse
   than having no shortcut.
3. **Starter chips.** Implemented, but with generic copy — two of the comp's
   four name a character from its demo project. They prefill the composer; the
   writer still presses send.
4. **Mid-conversation reversal affordances.** Superseded by
   [ADR 2026-07-25](../../../../../docs/adr/2026-07-25-workshop-scope-immutability.md)
   and [Sprint 13A_2](13a_2-scope-immutability.md). §4's reversible path now
   survives only before the room has a memory; after any host, tool-sidecar, or
   guest conversation, scope is immutable. The comp's reversal controls
   therefore deliberately disappear and are replaced by the recovery path:
   *"Start a new session to change this — your excerpt and context carry
   over."* The withdrawal frame, legacy delivery reasons, and new
   `scope_change` turns retired with those controls. Existing `scope_change`
   transcript rows remain parseable and renderable as history.

### Design language

New surfaces are ported 1:1 from `pm-workshop.css`'s "Open-chat path" section.
The values carry across unchanged because `workshop.css` already holds the same
FM tokens verbatim; only the `--pm-` prefix and the `pm-ws-` class vocabulary
differ. Two deliberate deltas, both because the comp renders `wk-first` straight
into its scroll container while ours lives inside the padded `.pm-ws-thread`:
the path chooser uses `flex: 1` for full-height centering and adds only the
remainder of the comp's inset instead of stacking a second one.

### Contract decisions worth knowing

- **Scope is assigned, never derived.** `null` → `excerpt` happens on the
  writer's explicit path choice, on pinning, and on running a tool; `open`
  happens only on an explicit choice. An open conversation that later adopts an
  excerpt **stays** `open`, because that is the honest record of how the room
  started. Nothing reads scope off `excerpt !== undefined`.
- **Shelving does not move the excerpt version.** A shelved passage keeps
  owning `revisions.excerpt`, so turn and task staleness stay truthful about
  which text each was written against, and a re-pin restores that exact
  version. The V1 integrity rule was widened to accept the shelf as the
  version's owner and to reject a checkpoint holding both slots.
- **A retained host is told, in reason-appropriate language.** The pending
  update carries `excerptChange: 'revised' | 'added' | 'repinned'` plus
  `excerptWithdrawn`. "Added" explicitly says this is the FIRST passage the
  persona has been given, because a persona reading "revised" would imply it
  had already seen one. Withdrawal tells it to stop quoting a passage it no
  longer has — silence there was the sharpest honesty hole in the flow.
- **Excerpt analysis is gated at the protocol, not just at the door.** In an
  open conversation `analysis.run` is removed from the capability instruction
  *and* refused with a reason if requested anyway. Advertising a door the host
  will slam wastes a turn's allowance and reads to the persona as a
  malfunction. Dictionary and configured-resource families are unaffected.
- **Attachment bodies are fetched on demand.** The shared budget is 50,000
  words, so shipping every body in every session snapshot would be a
  ~200 KB broadcast on each state change. `WORKSHOP_REQUEST_CONTEXT_ATTACHMENT`
  serves exactly the one the writer opened, and the hook discards a late reply
  for a pill that has since closed.
- **Pre-13A checkpoints migrate once.** Persisted `scope` is optional; a
  checkpoint without it infers `excerpt`/`null` from excerpt presence at the
  hydration boundary only. That is a one-time migration, not the live
  inference the sprint forbids — and it avoids making saved rooms unopenable.
- **Regression caught and fixed in-sprint:** moving excerpt authoring out of
  the rail initially dropped Sprint 12's verified-paste round trip. The sheet
  now reports pastes and owns the draft-equality check, since only it knows the
  current draft.

### Behavior change to flag for review

`canMessage` is now false while scope is `null`, even when an excerpt carried
over from the previous session. That is the comp's contract (its composer reads
"Pick a starting path above to begin…"), and it means **New Session followed
immediately by a message now requires one click on "Continue with current
excerpt."** `WorkshopHandler.test.ts` asserts both halves.

### Pre-existing save bug fixed here

The first manual pass surfaced that **session save was failing outright** — both
autosave and manual — with
`state.turns[N].capability.metadata.requestedEndLine must be plain object`.

The two halves of the durable boundary disagreed about `undefined`.
`clonePersistedJson` documents that an `undefined` object member is omitted
exactly as `JSON.stringify` omits it, but `assertJsonValue` had no `undefined`
branch, so such a member fell through to the "plain object" check. Because the
WRITE path validates the live in-memory object, and
`WorkshopResourceCapability` sets `requestedEndLine: request.endLine` (undefined
whenever the persona omits `endLine` — the common case), **any session where a
persona read a project resource without an explicit end line could not be
saved.**

Not a 13A regression: this branch touches neither the resource capability nor
the JSON policy. Fixed by making `assertJsonValue` honor the documented policy
for object members while still refusing an `undefined` **array item**, which
`JSON.stringify` would write as `null` — a silent data change rather than an
omission. Four regression cases cover it in
`WorkshopSessionPersistence.test.ts`; reverting the policy change fails three.

### Added beyond scope: full reset (Okey's request, 2026-07-25)

§3's boundary deliberately CARRIES the excerpt and context into a new session,
which is right for "keep workshopping this passage in a fresh room" and wrong
for "I'm done with that passage entirely". Using it made the gap obvious, so a
second, explicitly destructive boundary now exists beside it:

- **Sessions menu** — `New session: full reset`, directly under `New session`,
  in the error accent with the subtitle "also clears the excerpt and context".
  Its placement is the point: the two differ by exactly one thing.
- **Path chooser** — `Reset excerpt and context` under the two cards, in the
  error accent, shown **only when something would actually be discarded** and
  annotated with what (`1 excerpt · 2 attachments`).
- Both always confirm when they would discard anything, and the dialog says
  what survives: *"Saved sessions on disk are not touched."*

Wire contract: `WORKSHOP_RESET_SESSION` gained
`{ clearWorkingSet?: boolean }` — the aggregate's own vocabulary for what the
ordinary boundary preserves. `reset({ clearWorkingSet: true })` additionally
clears the excerpt, the shelf, and every attachment, and **returns
`revisions.excerpt` to zero**: the counter belongs to a passage, so leaving it
set with nothing in either slot would fail the integrity rule at the next
checkpoint. A failed promotion rolls the whole thing back — a destructive reset
that cannot be written must not have destroyed anything.

**Answering "are the excerpt and context stored somewhere else?"** No. They live
in exactly two places: `WorkshopSessionService` **in memory** (composition-root
owned, so it survives webview reloads) and `prose-minion/sessions/*.json`, which
is written *from* memory. Deleting `current.json` while the extension runs clears
the file, but nothing re-reads it at that point — the aggregate still holds the
room and the next autosave rewrites the file from it. There is no VS Code
`globalState`/`workspaceState` involvement anywhere in Workshop; only conversation
behavior and the Writer Profile are settings-backed, and those are deliberately
global rather than session state. So "clear everywhere" means clearing the
aggregate and re-promoting the checkpoint, which is what this does.

### Verification

Typecheck (core + webview + ext), 126 suites / 1313 tests, lint (0 errors),
production build + bundle sentinel verification, and `git diff --check` all
pass. New focused coverage: `WorkshopSessionScope.test.ts` (30),
`WorkshopTextSheet.test.tsx` (17), plus scope/gating cases added to the handler,
hook, composer, excerpt-panel, context-panel, and prompt-frame suites.

**Still outstanding:** the manual Extension Development Host pass — open chat
end to end, later excerpt adoption, both reversals, the sheet's four authoring
cases, file-pill read + editor-tab open, tool gating announcement, and a
restored open-conversation session.

## Exit criteria

- A writer can have a retained host conversation with no excerpt, and reload or
  reopen it. *(Adopting an excerpt mid-conversation was removed by ADR
  2026-07-25 — see "Superseded" above.)*
- Scope drives every surface; nothing infers scope from excerpt presence.
- Both path reversals work and shelve rather than delete, **before the room has
  a memory**; after that they are refused with the recovery path named.
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
