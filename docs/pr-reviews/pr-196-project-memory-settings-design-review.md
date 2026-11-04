# PR #196 review: Project Memory settings design

## Target and verdict

- PR: https://github.com/okeylanders/prose-minion-vscode/pull/196
- Reviewed head: `1c992c13e9097c47b2a570c201f38c561e04b7fc`.
- Base: `epic/workshop-project-memory` at
  `9ba38154e883c2b29dce3d5455fef45b8271f80e`.
- Head branch: `epic/workshop-project-memory-slice-0-design`.
- Reviewed on: 2026-11-04.
- Scope: 18 documentation/design files; no production code changes.
- **Verdict: changes requested for factual copy and specification consistency.**
  The approved layout, global mode, budget choices, and expandable receipt
  interaction are not being reopened. Four small corrections below are needed
  so implementation does not promise facts the ADR and stored data cannot
  support. No formal GitHub review approval or merge was performed.

## Findings

### F-01 (P2): the web-research hold must not assert that a search happened

**Locations:** `slice-5-save-and-tell-me.md:25–34`;
`slice-0d-settings-design.md:212–216`; `Thread.dc.html` held-card copy.

The changed build instruction says: “This reply used live web research.”
The same slice immediately says the hold is based on **web-search tools being
attached**, and ADR D8 deliberately uses that conservative signal instead of
evidence that the tools actually ran.

**Witness:** web research is enabled and attached to a reply, but the persona
answers from the existing conversation and makes no search call. D8 still
requires the hold. The approved copy would tell the writer that research was
used even though it was not. In the opposite direction, implementing the
copy literally by holding only after a confirmed search would weaken the
required hold.

**Correction:** preserve the attached-tools rule and say what is known, for
example: “Live web research was available for this reply, so this memory
waits for you to save it.” Update the canvas, re-export its Thread board,
and align both slice documents.

**Acceptance witness:** a reply with tools attached and zero search calls is
held, with copy that does not claim a search ran.

### F-02 (P2): the cap explanation attributes the room total to one persona

**Locations:** `slice-5-save-and-tell-me.md:27–29,35–37`;
`slice-0d-settings-design.md:214–216`; `Thread.dc.html` cap variant.

The new text substitutes the proposing persona's name into “Jill has saved N
memories in this conversation,” while N is `autoSavesPerRoom`. The counter
explicitly includes every room receipt with `by: 'auto'`; it is not a
per-persona counter.

**Witness:** Jill saves two memories and Cliff saves three. Jill's next
proposal is correctly held at the shared room cap of five. The specified
copy says Jill saved five. A newly joined guest who saved none can be shown
the same false claim. It also implies that changing personas might grant a
fresh allowance, which D8 does not permit.

**Correction:** make the subject the room or the automatic-save total, for
example: “This conversation has reached its limit of N automatic memory
saves. This one waits for you.” Keep the existing room-wide cap and its
Rewind behavior.

**Acceptance witness:** a mixed-persona room reaches the cap, and a proposal
from any participant receives accurate shared-cap copy.

### F-03 (P2): overflow guidance names pin age, but the ADR orders by creation

**Locations:** `slice-0d-settings-design.md:173–181` and decision 9;
`Manager.dc.html:103,148,208–218`.

The overflow notice says “The oldest pins load in full,” and the affected
row says “It's the newest pin.” The prototype uses a `newestPin` flag.
ADR D5 instead orders eligible pinned memories by **oldest `created`, ties
by ID**, explicitly explaining that format 1 stores no pin time.

**Witness:** an October memory is pinned today; a November memory was
pinned last week. Under D5, the October memory is considered first despite
being the newest pin. The row's explanation would be wrong. Unpinning and
repinning does not change that ordering either. Moreover, which whole bodies
fit depends on their sizes, so a not-loaded row should not infer its reason
merely from being the “newest” member.

**Correction:** explain the actual order (“Pinned memories are considered
oldest-created first”) and describe a refused body as not fitting the pinned
budget, without inferring a pin date. Have the eventual manager use the
shared builder's actual loaded/not-loaded result. Keep the current
“nothing is unpinned for you” promise.

**Acceptance witness:** creation order and pin-action order disagree, and
both the loaded subset and the manager's explanation follow D5.

### F-04 (P2): archived rows require history that format 1 does not contain

**Locations:** `slice-0d-settings-design.md:182–186`;
`Manager.dc.html:246`.

The design prescribes “Forgotten from the thread on Oct 24” for archived
rows. Format 1 records `status: archived`, not an archive timestamp or
whether it came from Forget, the manager's Archive action, or a hand edit.
ADR D10 further says that archiving leaves `updated` unchanged. Neither
`origin` nor the memory's source session supplies this missing event history.

**Witness:** a writer makes a file in October and changes its status to
archived by hand in November. The manager can correctly know that it is
archived. It cannot know that the thread forgot it or when. Reading
`updated` as the archive date would be wrong, and fabricating a thread
receipt would be worse.

**Correction:** make the default row state factual, for example:
“Archived. Restore to make this memory active again.” An actual known
Forget receipt may support a richer line, but require verified provenance
for that case and retain an unknown-origin/date fallback. Do not add new
persisted keys merely to fit illustrative text without an ADR decision.
Also avoid promising that every restore will load a full note: supersession
and the frame budgets still apply.

**Acceptance witness:** manager-archived, hand-archived, and known-Forget
examples render without invented dates or action sources.

## What is sound

- The setting is global, defaults to Off, and recommends Ask first without
  treating Off as an error. Project files remain scoped to one workspace.
- Unavailable workspaces keep mode cards usable while disabling this
  workspace's manager and folder controls. No session-only memory is implied.
- Turning memory Off preserves writer management actions.
- The two separate budgets and codec limits match the merged ADR:
  5,000 pinned tokens, 2,000 catalog tokens, and 120/280/8,000 characters.
- Conflicting and unreadable files are individually listed for Open file
  only. No destructive mutation is offered on those rows.
- Forget is distinguished from Delete, and supersession is presented as
  derived rather than as another stored status.
- The receipt expansion has a stable controlled ID, changing accessible
  name, `aria-expanded`, a collapsed default, and a read-only card with a
  separate Full note disclosure. It does not accidentally add Save/Edit/
  Dismiss actions inside the expanded card.
- The production component choices are consistent with the existing UI:
  the settings tab registry owns keyboard/ARIA navigation, and the shared
  browser shell/rows own rename and delete confirmation. The shared overlay
  hook already supports topmost-only Escape and nested focus return.
- Light-theme boards are explicitly proposals, not new implementation work.
  Fixed-width/narrow-layout and contrast limitations are explicitly recorded.

## Implementation watchpoints, not current defects

1. **Do not put an expanded memory body into the receipt's model-facing
   payload.** D7 says receipt turns are exported and recalled, with no body.
   Define a writer-facing expansion/read path separately and handle memory
   edits, deletion, busy claims, changed workspace, stale results, and a
   receipt whose stored version no longer matches the file. Decide whether
   the expansion means the saved version or the current version, and label
   that choice honestly.

2. **Preserve draft semantics across nested modals.** The settings mode is
   staged until Apply, while manager writes occur immediately. Opening the
   manager must not discard or silently commit Behavior, About you, Memory,
   or Advanced drafts. Reuse the existing overlay stack rather than inventing
   a second Escape/focus system. Test manager → editor → cancel/close and
   settings Cancel after a completed manager write.

3. **Use the host's live state for summaries.** Active counts, overflow flags,
   unavailable/busy/refused results, and catalog fit should come from the
   same library/builder as the actual prompt data. In particular, a live
   claim does not make a memory disappear from the listing (D10).

4. **The visible update marker is not the delivery record.** D14 computes
   changes per participant, including guests delivered later, and ties the
   record to the actual carrying turn and rollback. A single decorative
   divider must not advance all participants or claim a note was sent before
   a successful delivery. The “Show what changed” destination remains an
   explicitly open design choice.

5. **Retain source-availability fallbacks.** The sheet's made-up named-session
   example does not establish that every source is recallable. New writer
   memories can lack a source; current/unnamed/deleted sessions need the D3
   reason rather than “Personas can check” without qualification.

6. **Retain existing interaction contracts when implementing the drawings.**
   The static tab markup is not a replacement for the production registry's
   roving tab index, linked tab/panel IDs, or keyboard behavior. Likewise,
   inherit the shared row's confirm-before-delete flow. The acknowledged
   narrow-width and contrast follow-ups still need actual verification.

## Verification

- Read the complete diff and all 18 changed files, the exact-head merged ADR,
  epic process/dependency notes, and relevant production settings, browser,
  row, modal, and overlay components.
- Checked the canvas inventory: 14 boards, each present, and every
  `dc-import` resolves to a supplied component.
- Executed the actual four component `DCLogic` classes with a small
  state/props harness: **250 assertions passed** covering all tab view/mode
  combinations, unavailable-mode interaction, Off manager access, manager
  grouping and overflow flags, refused-sheet state, and receipt
  open/close/accessible-name/read-only structure.
- These are **prototype state/callback checks**, not browser rendering,
  screen-reader, or production integration tests.
- The snapshot intentionally requires the private canvas runtime
  `support.js`, as its README says. Missing local runtime is not reported as
  a product defect. No private-canvas visual result is claimed.
- No production code changed, so no new full Jest, typecheck, lint, or live
  VS Code run is claimed for this design review.
- Exact-head CI was in progress when inspected:
  https://github.com/okeylanders/prose-minion-vscode/actions/runs/41870985745.
  A green code pipeline cannot establish the factual accuracy of these
  design strings.

## Publication and next gate

Fix the four factual explanations in the source canvas, export the changed
boards under the documented sync policy, and update the matching prose/build
instructions. No change to the approved layout or core policy is needed.
Re-review the resulting exact head before treating this design specification
as ready for the implementation slices.
