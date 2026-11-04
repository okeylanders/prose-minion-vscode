# PR #196 review: Project Memory settings design

## Latest review status

**Changes requested at `8737686b`: one new overflow-count copy issue (F-05).**
The requested “Always load in full” rename is retained. F-01 through F-04
remain resolved. See the latest re-review below; the earlier approval
applied to the head before this rename.

## Initial target and verdict

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

## Re-review at 8a1828ef

- Exact target: `8a1828efea5a4ee069ceb8f4579e756fb257e3e7`.
- Base remains `9ba38154e883c2b29dce3d5455fef45b8271f80e`.
- **Current verdict: APPROVE for this documentation/design scope.** All four
  factual-copy findings above are resolved. This is a written review verdict,
  not a formal GitHub approval, and no merge was performed.
- This section supersedes the initial changes-requested verdict while
  preserving the original findings and acceptance witnesses.

### Resolution verification

- **F-01 closed:** the Thread board and both slice documents now say research
  was available. The conservative attached-tools hold remains explicit; no
  search execution is invented.
- **F-02 closed:** the same surfaces now describe the conversation's automatic
  save limit. No persona is credited with the entire shared count.
- **F-03 closed:** the specification uses oldest-created order, ID tie-breaks,
  and the shared builder's loaded/not-loaded result. The row simply says
  the body does not fit. The fixture flag changed from `newestPin` to
  `notFitting`, so the drawing no longer implies a nonexistent pin-time field.
- **F-04 closed:** archived rows state only that the memory is archived and
  can be made active. The specification explicitly disclaims unknown dates/
  causes and acknowledges that supersession/budgets still govern loading.

The source-availability caveat now points to D3 for current, unnamed, deleted,
or absent sessions. The six implementation watchpoints are carried forward
explicitly in Slice 0d; they are implementation gates, not unresolved defects
in this docs-only PR.

### Additional design change

The new “Memory isn't context” well is present in the shared Main component,
after the unavailable notice and before the mode cards, so every tab state
inherits it. The nine tab artboards and canvas dimensions agree at 1,040px.
Its 100,000-word upper bound matches the exact-head
`CONTEXT_ATTACHMENTS.words` constant in `promptBudgets.ts:453`; its approximate
7,000-token figure matches the ADR's two initial frame budgets. The
specification requires Slice 4b to read those values from the actual budgets,
not perpetuate sample constants. The claimed narrow-width stacking remains
a production implementation requirement; the fixed-width snapshot is not
evidence of responsive behavior.

### Re-review verification

- Read the full 14-file delta from report commit `f284238d` to this head,
  including both the new comparison well and the four corrections.
- Downloaded the 14 changed file contents at this exact SHA and verified their
  Git blob SHA-1s against the connector results.
- Re-ran the actual prototype state harness and added corrected-copy,
  overflow-badge, archived-state, comparison-well placement, and artboard
  checks: **296 assertions passed** (the original 250 plus 46).
- No remaining occurrences of the four incorrect statements or
  `newestPin` were found in the affected current specification/build
  instructions and boards.
- These remain state/callback and source-structure checks, not a browser,
  screen-reader, live VS Code, or production integration test.
- CI for this exact head was still in progress when this re-review was
  written: https://github.com/okeylanders/prose-minion-vscode/actions/runs/41872758307.
  Its final result will be checked separately.

The PR description still quotes the original hold string and lists 14
decisions; it can be refreshed to match the corrected files and new decision
15. This is stale summary text, not a remaining implementation-spec blocker.

## Rename re-review at 8737686b

- Exact target: `8737686b6a563d8aead4c447bd15a05b19771930`.
- Base remains `9ba38154e883c2b29dce3d5455fef45b8271f80e`.
- Scope: 11 documentation/design files since `8ec4b165`.
- **Verdict: changes requested for F-05 below.** The user-requested rename
  itself is consistent across the affected tab, manager, sheet, slice
  instructions, canvas index and ADR note. It does not change file keys,
  budgets, capability behavior, or model-facing framing.

### F-05 (P2): the overflow summary counts selected memories as loaded ones

**Locations:** `docs/design/workshop-project-memory/Manager.dc.html:230`;
`slice-0d-settings-design.md`, decision 16 and the loaded-in-full overflow
state.

The previous summary, “4 pinned · ≈ 5,600 of 5,000 tokens”, counted four
memories selected for full loading. The rename makes it “4 in full” while
the same overflow state correctly marks one of those four “Doesn't fit in
full”. D5 never loads more than the budget and the design already requires
the actual builder result to determine the row badges.

**Executed witness:** rendering the exact prototype with
`overPinned: true` gives:

- summary: `4 in full · ≈ 5,600 of 5,000 tokens`;
- rows badged `Loaded in full`: **3**;
- rows badged `Doesn't fit in full`: **1**.

Thus the summary says four are in full while the rows say only three are.
Likewise, the 5,600-token number describes selected demand, not tokens
actually delivered. A green code pipeline does not resolve this mismatch.

**Correction:** preserve “Always load in full” as the action and distinguish
the selected count/demand from the actual result in overflow. For example,
“4 set to load in full · ≈ 5,600 requested / 5,000 budget”, with the existing
per-row result; or show the builder's actual loaded count separately from
the requested count. Apply the same distinction to the specified tab
overflow meter. Do not relabel selected demand as actual delivered tokens.

**Acceptance witness:** with four selected bodies and only three fitting,
the summary must not claim four loaded in full. Its requested/actual token
meaning is explicit, and the builder, summary, and badges agree. The normal
in-budget state may retain the shorter “N in full” wording.

### Other checks

- The renamed toggle keeps a stable accessible label, “Always load in full:
  [title]”, plus its pressed state. The sheet uses the same action name and
  retains its checked state and refused-save behavior.
- The manager uses the eye glyph; storage keys/fixture properties remain
  `pinned`, as intended.
- F-01 through F-04 remain fixed. Receipt behavior, source fallback, global
  mode, unavailable states, and the comparison well are unchanged.
- The PR description has been refreshed and no longer repeats the old hold
  copy or decision count.

### Verification

- Read all 11 changed files and checked exact remote blob hashes when
  materializing them.
- Updated the prototype harness for the intentional label changes:
  **332 assertions passed**, including the explicit inconsistent-count
  witness above. Passing those checks documents existing behavior; it does
  not mean F-05 is correct.
- The prior 296 checks remain covered. These are state/callback and source
  checks, not a browser rendering, screen-reader, or production integration
  test.
- Exact-head CI was in progress:
  https://github.com/okeylanders/prose-minion-vscode/actions/runs/41874162248.
- No formal GitHub approval or merge was performed.
