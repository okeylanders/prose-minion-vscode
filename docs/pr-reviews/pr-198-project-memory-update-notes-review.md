# PR #198 review: Project Memory update notes (Slice 2b)

## Target and verdict

- PR: https://github.com/okeylanders/prose-minion-vscode/pull/198
- Reviewed head: `cd995c9bf1606ebe559010eba687ccdcc15d9bda`.
- Reviewed base: `epic/workshop-project-memory-slice-2a-read-path` at
  `27da6fee5d7ca97119b563f1b6d121eef524bf9f` (PR #197).
- Head branch: `epic/workshop-project-memory-slice-2b-update-notes`.
- Reviewed on: 2026-11-04.
- Scope: the 22-file Slice 2b delta, its D14/D8 contracts, and the real
  session, retained-history, rewind, library, store, and capability seams.
- **Verdict: CHANGES REQUESTED.** Three reproduced defects below, one P1 and
  two P2. The green existing suites do not cover these cases. No formal
  GitHub approval or merge was performed.

## Author resolution ledger

| ID | Priority | Status |
|---|---|---|
| F-01 | P1 | Fixed in `7e3d566c`: the record rides the persona reply that committed it, never the writer turn or the tool request. A cut that removes the delivery (a synthesis included) removes the reply and its record with the history that received them. The codec refuses it on any turn but a host or guest reply, and for another participant; staging refuses a record for a conversation the run doesn't answer for. Regression: Rewind (through the coordinator and through the transform) and Branch to just after a report restore the report's view, A (`WorkshopProjectMemoryDeliveryWholeRoom.test.ts`). It failed before the fix. |
| F-02 | P2 | Fixed in `1106e278`: every conversation start records a frame, an empty one when it delivered nothing (memory off, the workspace unavailable, the folder unlisted, a failure). A new membership's view therefore starts from nothing, and earlier memberships' records stay in history for valid cuts. Regressions (`ProjectMemoryUpdateNotes.test.ts`): On → dismiss → re-invite Off → On, with an unchanged set and with a partly changed set, both deliver the whole current set and then nothing; a re-invite with memory On gets its own frame; a join while unavailable, then available; the new membership's empty frame through save and reopen. The first two and the last failed before the fix. |
| F-03 | P2 | Fixed in `6b4a45ed`: past the codec's 4,096, a delivery records `digest: { count, hash }` over its ids and versions in place of the list, so every committed record validates. The codec accepts a digest only above the bound and only beside an empty list. The fold compares a digest whole: the same set sends nothing; any change sends the count line and records the new digest, so nothing is announced twice or lost. Regressions: 4,096 real files record a list, and 4,097 a digest, through a frame and a note, each through the strict persisted-session parse; an unchanged digest sends no note; an edited memory sends the count line once; plus the codec's digest cases. |

## Findings

### F-01 (P1): a synthesis snapshot survives a cut that removes its delivery

**Location:** `WorkshopSessionService.ts:1808–1828`, especially the fallback
anchor at line 1813.

A synthesis has no writer turn, so `commitProjectMemoryDelivery` writes its
snapshot onto the earlier tool request. That request predates the tool
report. The report is deliberately a supported rest point: both its bubble
and the cut policy allow Rewind/Branch immediately after it.

**Reproduction through the actual scripted room and rewind transform:**

1. Commit a host message that records memory version A.
2. Run a writer-requested tool. Its report commits while the host still
   knows version A.
3. The host synthesis receives and commits version B. Its record is placed
   on the earlier tool-request turn.
4. Rewind to immediately after the tool report, before the synthesis.

The real provider archive correctly returns to its pre-synthesis messages.
The delivery fold incorrectly still returns **B**, because the tool request
survives the cut. The historical report rest point's delivery view was **A**.

Observed in both an exact-source Node probe and a separately executed Jest
regression:

```text
original report rest-point view: mem-7f3c2a -> aaaaaaaaaaaa
rewound-to-report view:         mem-7f3c2a -> bbbbbbbbbbbb
host messages after the cut:    byte-equivalent to the original report rest point
```

A subsequent D14 update compares against B and suppresses a change the
retained host history no longer contains. Branch uses the same transform,
so it inherits this inconsistency. This contradicts the stated “cutting a
turn cuts its record along with the provider history” guarantee.

**Required correction:** tie the synthesis delivery to a boundary that is
removed with the synthesis, or explicitly cut/reconstruct it using the
retained-history boundary. Do not put a later delivery onto a turn that
survives a valid earlier cut. Adjust the codec/ADR deviation if the correct
anchor is not a writer turn.

**Acceptance:** actual room + retained archive tests for Rewind and Branch
after the report but before synthesis, both for an initial frame and a later
note. The fold must equal the original rest-point view, and the next host
message must receive the owed delta again. Also keep ordinary writer-turn
rollback behavior.

### F-02 (P2): a re-invited guest inherits an old conversation's memory view

**Location:** `memory/ProjectMemoryDeliveredView.ts:23–36`;
`session/WorkshopProjectMemoryDeliveryRecords.ts:64–67`;
the membership boundary at `WorkshopSessionService.adoptPersonaGuest`.

The fold scans the entire room and keys records only by `guest:personaId`.
That is a persona identity, not a retained-conversation lifetime. Existing
retained-history code explicitly prunes the same key when a guest is
dismissed/re-adopted; the new memory fold has no corresponding boundary.

**Reproduction with the real store, library, capability and session:**

1. With memory On, invite Cliff. His old conversation gets the frame.
2. Dismiss Cliff, turn memory Off, and invite Cliff again. This is a fresh
   provider conversation, correctly given no frame while Off.
3. Turn memory On and send Cliff a follow-up.

`updateNote()` returns **undefined**: the fold finds the first membership's
snapshot and concludes the new conversation already knows the unchanged
memories. The fresh conversation has received neither a frame nor the
required Off-to-On whole-catalog note. With a partially changed set, it gets
only the changes and silently misses the unchanged notes.

**Required correction:** scope the delivered view to the current retained
conversation/membership, including a fresh join that delivers no frame
because memory is Off or temporarily unavailable. Preserve earlier
historical records for valid cuts without treating them as the new
conversation's knowledge. Apply the same principle wherever host/guest
provider history is replaced or degraded.

**Acceptance:** invite On → dismiss → re-invite Off → On; both an unchanged
set and a partly changed set must deliver the whole current set to the
fresh guest. Also cover unavailable-at-join → available and save/reopen of
that new membership. Existing ordinary guest-specific delivery must remain
independent of the host.

### F-03 (P2): an accepted snapshot can exceed its own persisted codec limit

**Location:** `memory/ProjectMemoryCatalogFrame.ts:137–142`;
`session/WorkshopProjectMemoryDeliveryRecords.ts:27,50`;
the staging/commit path in `WorkshopSessionService.ts:1796–1817`.

The builder records every memory in effect, with no cardinality check.
The store/library can list more than 4,096 valid files, but the new codec
refuses any snapshot above 4,096. Staging and completion accept that
snapshot, leaving an in-memory session that cannot pass its persistence
boundary.

**Executed witness:** 4,097 valid small writer-authored memory files:

```text
library.frame(): accepted
rendered entries: 40
rendered frame: 1,435 estimated tokens
snapshot memories: 4,097
strict persisted-session parse:
  projectMemoryDelivery[0].memories must be an array of at most 4096 delivered memories
```

The prompt itself is safely bounded; it is the hidden record that poisons
persistence. The same issue can happen when a folder grows past the limit
mid-room. This is a new failure caused by Slice 2b, not a frame-budget
regression in #197.

**Required correction:** make the production snapshot producer and durable
codec agree. If a hard supported-library limit is chosen, handle it
explicitly before committing invalid state, with a bounded refusal/retry
policy and no lost session. Do not silently truncate the snapshot: that
would falsely change the “full set in effect” contract and can repeatedly
announce unrecorded memories. A larger coherent format is another option,
but merely moving the mismatch to a larger unchecked number is not.

**Acceptance:** boundary tests at 4,096 and 4,097, on initial frame and
follow-up note, through the real save/reopen path. Every accepted committed
record must validate; any refusal must preserve the old session and keep
the necessary future update owed.

## Stacking and integration assessment

- This is genuinely stacked on #197: the PR's base SHA is #197's exact
  `27da6fee` head, and the 22-file diff is Slice 2b alone.
- #197 supplies the store/library read path, frame renderers, capability
  family, settings/grammar, and composition wiring. #198 extends those same
  owners rather than adding a parallel memory service. Its constructor and
  `frame`/snapshot API changes are coherent with that precise base.
- This report is **not an approval of #197**. Its separate findings and
  corrections remain a dependency gate. Any later #197 implementation
  changes must be integrated into #198 and the combined head rechecked.
- After #197 merges, retarget to `epic/workshop-project-memory`, verify the
  resulting diff still contains only the intended 2b work, and run checks
  against the resulting integration head. A green run against the current
  stacked base does not certify an unreviewed future base.
- Slice 3 receipts are explicitly deferred. The current fold's lack of
  receipt handling is therefore not reported as a defect in 2b. Slice 3
  still needs per-participant delivered offsets, receipt versions and
  cancellation/Rewind coverage.
- The visible update divider is likewise later UI work; the current scope
  is the provider message and delivery record.

## What passed and what is sound

- Version calculation notices changes to id, title, kind, summary, body,
  pinned flag and effective standing, while an `updated`-only change
  intentionally does not alter the version.
- Normal follow-up deltas are deterministic, XML-escaped, and absent when
  nothing changed. Archived/deleted entries produce the expected gone
  reasons. The whole-set snapshot prevents repeating a count-only
  over-budget note, as D14 specifies.
- Staging until successful reply commitment works for ordinary writer
  messages: rollback, abandon, cancellation and inactive request IDs do
  not claim delivery. That choice is sound; F-01 concerns its synthesis
  anchor, not the idea of staging.
- Current host and ordinary guest records are separate. The counterexample
  in F-02 is reuse of a logical key across different memberships.
- Off keeps the old view and emits no note; an ordinary existing
  conversation switched back On receives the changes.
- Workspace refusal and cancellation do not advance the view.
- Codec validation rejects wrong turn roles, malformed versions, duplicate
  memory IDs, duplicate participants and extra fields. Delivery copies
  do not alias caller-owned nested arrays.
- Ordinary Rewind of a writer-carried note restores the earlier snapshot.
  A legacy session with no new field still round-trips byte-identically.
- The existing side-pass isolation suite passes; no live provider call was
  made.

## Verification

### Exact-source probes

The focused runtime was materialized from repository source, then checked
against the recursive Git tree for `cd995c9b`. Each module loaded by the Node
probes is hash-verified before execution. The broad positive probe loaded
**194 real source modules** and passed **52 assertions**. File system and
external service ports use the repository's test doubles.

Separate probes reproduced F-01, F-02 and F-03 through the actual affected
production classes, not reimplementations of their algorithms.

### Actual Jest runs

Used the repository Jest/ts-jest configuration and the exact #197 lockfile
dependencies; #198 does not change that lockfile.

**Existing focused suites: 5 passed, 57 tests passed:**

- `ProjectMemoryUpdateNotes.test.ts`
- `WorkshopProjectMemoryDeliveryWholeRoom.test.ts`
- `ProjectMemoryFrameStability.test.ts`
- `WorkshopProjectMemoryCapability.test.ts`
- `RunWorkshopToolSidePass.integration.test.ts`

**Independent regression witnesses: 3 failed as expected**, one for each
finding. These assert the required behavior:

1. delivery view after cutting before synthesis equals the original
   report rest point;
2. a fresh guest first switched On receives the current catalog;
3. an accepted large-folder snapshot passes strict persisted-session
   parsing.

The failure outputs are recorded in the findings above. The existing
whole-room suite primarily stages deliveries onto normal host messages;
it does not exercise these synthesis/membership/capacity cases.

### CI and limits

Exact-head CI succeeded, including typecheck, tests, lint and both bundles:
https://github.com/okeylanders/prose-minion-vscode/actions/runs/41886012679.

The full Jest/typecheck/lint/build result is CI evidence, not a separate
local full-repository run. Local verification was the five focused Jest
suites and the independent probes above. No live VS Code/provider, browser
or accessibility result is claimed.

## Next gate

Fix F-01 through F-03 and add their real integration regressions. Bring in
any fixes to #197, then re-review the exact combined head and its CI before
considering 2b ready. Keep the report's historical target and evidence when
adding implementation responses.
