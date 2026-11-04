# PR #192: Workshop Project Memory specification review

## Review identity and verdict

- **PR:** [#192, Workshop Project Memory Slice 0: ADR, runway and slice docs](https://github.com/okeylanders/prose-minion-vscode/pull/192)
- **Latest reviewed specification head:** `089897d282d20a1c3c06218ac221c5fd9ea07d79`
- **Primary finding line-link snapshot:** `9cca60598e813a2dde53648dcd02a958f8a46b42` (findings unchanged by the later availability clarification)
- **Compared base:** `8fb016fa3e767964fe8c53c778d6453f8507667d`
- **PR source branch / report destination:** `epic/workshop-project-memory-slice-0-spec`
- **PR target branch:** `epic/workshop-project-memory`
- **Reviewed:** 2026-11-04
- **Latest verdict:** No remaining actionable findings in the reviewed specification. F-01 through F-04 and N-01 are closed at the design level after re-review. The original changes-requested review remains below as history.
- This document is the review report. It does not submit a formal GitHub approval, change the ADR's status, or authorize a merge.

Commit `9cca6059` now records the writer's six decisions. They are no longer
reported as unanswered gates. The findings below concern conflicts or missing
mechanisms in the chosen design; this review does not change those choices.

## Re-review, 2026-11-04 16:34 UTC

**Head:** `089897d282d20a1c3c06218ac221c5fd9ea07d79`, including correction commit
`29254beaa2818852cc6a62c9941699a5d0c5b426` and the author's resolution ledger.
The complete delta from published report head
`49c22c2b07bdf0d00a7ad073b6bdb00f119646ee` was reviewed, followed by the
updated ADR and Slice 3/4b contracts in context.

- **F-01 closed at design level.** [D6](https://github.com/okeylanders/prose-minion-vscode/blob/089897d282d20a1c3c06218ac221c5fd9ea07d79/docs/adr/2026-11-04-workshop-project-memory.md#L398-L437)
  now places memory last after any widget, gives one extractor ownership before
  other readers, and specifies misplaced, duplicate, malformed/unclosed, Off,
  and control-only outcomes. Diagnostics take the redacted copy. Slice 3 names
  the widget-prompt change and sentinel tests across those paths.
- **F-02 closed at design level.** [D10](https://github.com/okeylanders/prose-minion-vscode/blob/089897d282d20a1c3c06218ac221c5fd9ea07d79/docs/adr/2026-11-04-workshop-project-memory.md#L649-L663)
  separates a host-issued file entry handle from unique memory identity,
  resolves it against the current contained listing, and refuses stale, forged
  and cross-workspace keys. The unreadable/conflict cases have explicit tests.
- **F-03 closed at design level.** [Slice 4b](https://github.com/okeylanders/prose-minion-vscode/blob/089897d282d20a1c3c06218ac221c5fd9ea07d79/.todo/epics/epic-workshop-project-memory-2026-11-04/slice-4b-memory-tab.md#L6-L27)
  now depends on Slice 3 and reuses its named sheet and write routes. The
  integration branch's epic README was also checked: its 4b dependency row now
  includes Slice 3.
- **F-04 closed at design level.** [D5](https://github.com/okeylanders/prose-minion-vscode/blob/089897d282d20a1c3c06218ac221c5fd9ea07d79/docs/adr/2026-11-04-workshop-project-memory.md#L328-L358)
  now checks edits of pinned memories, specifies whole-body admission in
  `created`/id order, exposes “pinned, not loaded” and an over-budget meter,
  and states the absence of a cross-window lock. Hand edits and races no
  longer imply silently guaranteed loading. Slice 2/3/4b specify the relevant
  renderer, edit-refusal and manager tests.
- **N-01 closed.** [D4](https://github.com/okeylanders/prose-minion-vscode/blob/089897d282d20a1c3c06218ac221c5fd9ea07d79/docs/adr/2026-11-04-workshop-project-memory.md#L248-L253)
  distinguishes Forget/archive from physical Delete, with separate tests.
- The additional live-claim clarification was checked: claimed memories stay
  in the catalog/frame/delivery view while exact read returns busy. This is
  consistent with the existing listing discipline and prevents a transient
  rewrite from being announced as a removed memory.

**Verification limits.** This closes specification findings, not implementation
tests. The memory feature remains to be built and tested in its later slices;
no runtime/full-suite result is claimed here. CI for this reviewed head was
in progress at the re-review check
([run 41867966250](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41867966250)).
The verdict is a written review conclusion only. No formal GitHub approval or
merge is submitted, and the ADR still reaches Accepted after the live pass.

## Resolution ledger (author responses, verified in re-review)

| Finding | Status | How |
|---|---|---|
| F-01 · joint trailer contract, redacted logs | Fixed in `29254bea` | ADR D6: the memory frame comes last, after any widget control. A single tail extractor (`extractWorkshopReplyControls`) removes every memory frame before the widget inspector, the findings parser, display and retention see the reply. An outcome table covers both valid, misplaced, duplicate, malformed or unclosed, memory off, and control-only replies. D6 and D9 add the rule that every diagnostic, including the widget-rejection `boundedLogText` dump, gets the redacted copy. Slice 3 pins it with sentinel-text tests |
| F-02 · file handle vs memory identity | Fixed in `29254bea` | ADR D10: every manager row carries an opaque, session-keyed HMAC `entryKey` of its contained path (the `LightboxFileKey` precedent). *Open file* resolves it against the current listing and refuses stale, forged or out-of-folder keys. Model operations and mutations stay on the unique `mem-` id, so conflict and unreadable rows can't be rewritten or deleted. Slice 4b has the tests |
| F-03 · 4b depends on Slice 3 | Fixed in `29254bea` | Slice 4b's status, build and criteria now wait on Slice 3. Slice 3 owns `WorkshopMemorySheet` (Edit, Save to memory…, New) and the write routes, and 4b adds only the manager's routes (ADR D13). The coordinator updates the epic README's table |
| F-04 · pinned overflow | Fixed in `29254bea` | ADR D5: the budget is re-checked on every edit of a pinned memory, not only on pin, and refused with the reason (Slice 3). For hand edits and two-window races, whole pinned bodies load in `created` order (ties by id), and the rest stay as entries marked "pinned, not loaded: over the pinned budget". The meter reads over budget, the frame and the meter share one renderer and estimator, and nothing is unpinned or rewritten. The absence of a cross-window lock is a stated limit |
| N-01 · Forget vs Delete | Fixed in `29254bea` | ADR D4 names the actions exactly. Forget (archive) or archiving the newer memory doesn't revive the old one; Delete of the newer file does. Slice 3 tests Forget and Slice 4b tests Delete, separately |
| #194 N-02 · live claim and D14 | Fixed in `29254bea` | ADR D10: a memory under a live claim stays in the listing, catalog, frame and D14 view, decoded from the claim's bytes, and only `read` answers busy. Slice 2 has the test |

## Original review scope and evidence

The review covered all seven changed files at the reviewed head:

- the proposed Project Memory ADR, D1–D14;
- the boundary runway;
- Slice 2, read path;
- Slice 3, write path;
- Slice 4b, Memory tab and manager;
- Slice 5, Save and tell me;
- Slice 6, live verification and close-out.

It also traced the existing widget-recommendation prompt, exact-frame parser,
display/history stripping, and run-completion rejection logging at the compared
base. Repository `AGENTS.md` was read. The initial review was against
`3d5042e871572a2c5f8c9ec13991d9151f47f5fe`. A pre-publication check caught
`9cca6059`, so publication was paused while all seven changed-file deltas were
reviewed, including the new D14 delivery-record/update-note design. The findings,
line links and decision status below refer to that decision-bearing head.

Remote publication verification then found that
[`c1fb84d1`](https://github.com/okeylanders/prose-minion-vscode/commit/c1fb84d12e6d2580caa4d511ffc05de6d64f9522)
landed between the final head check and the report's creation. Its complete
delta was reviewed: it clarifies that an unavailable workspace disables that
workspace's memory access/manager but leaves the global mode cards usable,
and adds corresponding slice tests. It changes none of F-01 through F-04 or
N-01. The immutable finding links retain the decision-bearing snapshot so their
line references remain exact. The latest reviewed specification head at first publication was
`c1fb84d12e6d2580caa4d511ffc05de6d64f9522`.

This is a specification and integration review, not a test run of the planned
feature. No production implementation was changed, no full test suite, typecheck,
lint, build, or Extension Development Host session was run for this review, and
no live model call was made. At the pre-publication check, CI for the reviewed
decision-bearing head was queued ([run 41864505940](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41864505940)).
The earlier head's green CI is not a pass for this new commit. CI and
mergeability are transient and are not established by this report. Publication
triggered another CI run; no passing result for the report commit is asserted.

## Original findings (resolved by the re-review above)

### F-01 · Standard / P2 · Define a joint trailer contract and redact memory text before widget rejection logging

**Location:** [ADR D6, lines 354–397](https://github.com/okeylanders/prose-minion-vscode/blob/9cca60598e813a2dde53648dcd02a958f8a46b42/docs/adr/2026-11-04-workshop-project-memory.md#L354-L397), especially the final-trailer requirement and sanitizer composition.

**Evidence.** D6 introduces `prose-minion-memory-proposal` as a trailer at the
end of a reply and says to compose its retention sanitizer with the widget
sanitizer. The existing
[widget instruction](https://github.com/okeylanders/prose-minion-vscode/blob/8fb016fa3e767964fe8c53c778d6453f8507667d/packages/core/src/application/services/workshop/widgets/WorkshopWidgetRecommendationOperations.ts#L103-L115)
also requires its frame to be the response's final content. The existing
[exact-frame parser](https://github.com/okeylanders/prose-minion-vscode/blob/8fb016fa3e767964fe8c53c778d6453f8507667d/packages/core/src/utils/workshopWidgetRecommendationProtocol.ts#L122-L128)
rejects non-whitespace following the widget's closing frame. The
[widget stripper](https://github.com/okeylanders/prose-minion-vscode/blob/8fb016fa3e767964fe8c53c778d6453f8507667d/packages/core/src/utils/workshopWidgetRecommendationProtocol.ts#L157-L173)
owns the entire response tail beginning at `### Try a widget`.

If a persona emits a valid widget frame followed by the new memory trailer,
the unchanged widget inspection sees the memory block as invalid trailing
content. The current
[rejection path](https://github.com/okeylanders/prose-minion-vscode/blob/8fb016fa3e767964fe8c53c778d6453f8507667d/packages/core/src/application/services/workshop/WorkshopRunCompletion.ts#L259-L293)
logs `boundedLogText(result.content)`, which can include that memory's title,
summary and body. A rejected memory proposal can also share a response with an
independently malformed widget; composing retention sanitizers alone does not
redact this logging path.

Putting memory first avoids trailing text in the widget parser, but then memory
is no longer the final trailer promised by its own contract. The specification
does not choose an ordering, mutual-exclusion rule, or shared extraction owner.

**Impact.** An implementation following the two independent “final content”
contracts can lose a valid card or reject a valid widget. It can also log memory
payload text despite D6/D9/D10 requiring reason-only logging. This is an evidenced
integration risk, not a claim that an unimplemented memory feature has already
leaked data.

**Requested resolution.** Decide how the two controls may coexist. Specify a
single extraction/order contract, feed each inspector only the intended control
region, and remove private memory payloads before every diagnostic that can
receive the original reply. State malformed/duplicate-control handling and the
display/history fallback when the response contains only controls.

**Acceptance evidence.**

- A response carrying both valid controls produces the intended card and widget.
- Both allowed/forbidden orderings have explicit outcomes.
- Malformed, duplicated, disabled-memory, and control-only combinations leave
  no memory control text in the bubble or retained history.
- Sentinel memory text never reaches logs, including widget rejection logs.

### F-02 · Standard / P2 · Separate a listed file's handle from its memory identity

**Location:** [Slice 4b, lines 53–67](https://github.com/okeylanders/prose-minion-vscode/blob/9cca60598e813a2dde53648dcd02a958f8a46b42/.todo/epics/epic-workshop-project-memory-2026-11-04/slice-4b-memory-tab.md#L53-L67), together with [ADR D4, lines 254–280](https://github.com/okeylanders/prose-minion-vscode/blob/9cca60598e813a2dde53648dcd02a958f8a46b42/docs/adr/2026-11-04-workshop-project-memory.md#L254-L280).

**Evidence.** The manager must show each unreadable and conflicting file as its
own row, with **Open file** as its only action. The route contract says to open
files “by id, never a path from the webview.” D4 defines memory identity as the
frontmatter id and explicitly allows two readable files to share it, in which
case neither may be resolved for normal memory operations. An unreadable file
may have no valid frontmatter id at all.

**Impact.** The documented memory-id contract cannot select every row that the
manager must let the writer open. A duplicated id cannot select one conflict
member, and a malformed file need not supply an id. Falling back to arbitrary
webview paths would discard the intended containment boundary.

**Requested resolution.** Define a separate opaque file/entry handle for
host-issued manager rows, distinct from `mem-<hex>`. Resolve it against the
current, contained listing before opening the file; fail safely after the entry
or workspace changes. Keep model operations and ordinary memory mutations
addressed by the validated unique memory id.

**Acceptance evidence.**

- Two files with one memory id have independently working Open file actions.
- A malformed file with no valid id can be opened from its row.
- Stale, forged, and out-of-workspace handles are refused.
- Conflict/unreadable rows still cannot be rewritten or deleted through normal
  memory-id actions.

### F-03 · Standard / P2 · Make Slice 4b's dependency on Slice 3 explicit

**Location:** [Slice 4b, lines 6–22](https://github.com/okeylanders/prose-minion-vscode/blob/9cca60598e813a2dde53648dcd02a958f8a46b42/.todo/epics/epic-workshop-project-memory-2026-11-04/slice-4b-memory-tab.md#L6-L22) and [lines 56–67](https://github.com/okeylanders/prose-minion-vscode/blob/9cca60598e813a2dde53648dcd02a958f8a46b42/.todo/epics/epic-workshop-project-memory-2026-11-04/slice-4b-memory-tab.md#L56-L67).

**Evidence.** Slice 4b's status waits on 0d, 4a and Slice 2, but the same document
says its writes come from Slice 3 and its Edit action uses the Slice 3 sheet.
Slice 3 is also the stated owner of the
[new handler and library writes](https://github.com/okeylanders/prose-minion-vscode/blob/9cca60598e813a2dde53648dcd02a958f8a46b42/.todo/epics/epic-workshop-project-memory-2026-11-04/slice-3-write-path.md#L69-L90). Slice 4b's completion criteria
require all manager actions, including writes, rather than a read-only tab.

**Impact.** The dependency graph permits the complete manager to start before
its required handler, sheet and write APIs exist. Parallel implementers must
either duplicate those components, invent provisional contracts, or remain
blocked despite the published prerequisites being satisfied.

**Requested resolution.** Add Slice 3 to the complete 4b dependency set and
update the coordinating epic's dependency row, or explicitly split 4b into a
read-only/settings part after Slice 2 and a writing-manager part after Slice 3.
Name the owner of shared contracts and sheet components.

**Acceptance evidence.** The status, build instructions and completion criteria
describe one schedulable order with no undeclared dependency on Slice 3.

### F-04 · Standard / P2 · Define overflow after editing a pinned memory

**Location:** [ADR D5, lines 325–345](https://github.com/okeylanders/prose-minion-vscode/blob/9cca60598e813a2dde53648dcd02a958f8a46b42/docs/adr/2026-11-04-workshop-project-memory.md#L325-L345), [decided question 4, lines 806–809](https://github.com/okeylanders/prose-minion-vscode/blob/9cca60598e813a2dde53648dcd02a958f8a46b42/docs/adr/2026-11-04-workshop-project-memory.md#L806-L809), and [Slice 4b manager actions](https://github.com/okeylanders/prose-minion-vscode/blob/9cca60598e813a2dde53648dcd02a958f8a46b42/.todo/epics/epic-workshop-project-memory-2026-11-04/slice-4b-memory-tab.md#L56-L67).

**Evidence.** The decided design uses a 5,000-token pinned budget with a meter
and refusal, and D5 includes pinned bodies only up to that budget. The manager's
listed validation covers pin/unpin, while editing is a separate action. D4 also
permits hand-edited files. Raising the budget from the original draft's 1,500 to
5,000 tokens does not close the aggregate overflow paths.

A body can be pinned while the combined set fits and later enlarged without a
new pin action, taking the combined set past 5,000. Two windows can independently
pass a pin check, or a writer can edit `pinned: true` into a file. The individual
8,000-character body bound is not an aggregate token bound.

**Impact.** The frame must omit some pinned material or exceed the promised
budget. The specification does not say which pins lose their bodies or how
their rows explain that result. The general `<more count>` line does not
identify an omitted pinned body. D14's count-only overflow notice addresses a
large update note, but does not define the manager's state or the initial
frame's pinned-overflow policy.

**Requested resolution.** Check relevant edits as well as pin actions. Specify
the reader and manager behavior after external edits or concurrent pins create
an over-budget set: deterministic handling, visible omitted-pin state, and copy
that agrees with what was actually loaded. If strict aggregate admission across
windows is intended, name the synchronization mechanism that enforces it. Do
not silently unpin or rewrite hand-edited files to repair the budget.

**Acceptance evidence.**

- Enlarging an already-pinned memory has a stated, tested result.
- Hand-edited over-budget pinned files have a visible, deterministic outcome.
- A two-window pin race does not leave the UI implying every pinned body was
  loaded when some were omitted.
- The frame and meter use the same rendering and token estimates.

## Nonblocking correction

### N-01 · Clarify deletion versus Forget in supersession

[ADR D4, lines 248–250](https://github.com/okeylanders/prose-minion-vscode/blob/9cca60598e813a2dde53648dcd02a958f8a46b42/docs/adr/2026-11-04-workshop-project-memory.md#L248-L250) says deleting or archiving the newer
memory does not revive the old one, then says deleting the newer file does
revive it. The likely intended first word is **Forgetting**, since D8 defines
Forget as archive. Use the exact action names so an implementer does not choose
opposite catalog behavior. Test archive/Forget separately from physical Delete.

## Writer decisions recorded by the reviewed head

The new commit records these choices in the ADR's
[Decided questions](https://github.com/okeylanders/prose-minion-vscode/blob/9cca60598e813a2dde53648dcd02a958f8a46b42/docs/adr/2026-11-04-workshop-project-memory.md#L789-L812):

1. Global mode with per-project storage, with no `SettingsStore` target change.
2. No `INDEX.md` in v1.
3. Appended update notes when a conversation falls behind the memory set,
   including reopen, mid-room activation and external changes; implemented by
   new D14's per-turn delivery records.
4. A 5,000-token pinned budget and 2,000-token catalog budget, with a meter and
   refusal. The live pass measures the roughly 7,000-token frame cost.
5. `memory.read` results published to the room.
6. Workshop-only access in v1.

These replace the original draft's unresolved questions. D14's addition and
its propagated slice changes were read in the delta review. Its implementation,
including exact delivery commits, rollback, Rewind/Branch, receipt folding and
budget handling, still requires the tests its slice plan calls for.

## Original completion criteria (satisfied at the design level)

- Resolve F-01 through F-04, or document a specific accepted alternative that
  closes each conflicting contract.
- Correct N-01.
- Preserve the six decisions now recorded in the ADR while closing the
  implementation-contract gaps above.
- Re-review the amended head and relevant integration boundaries. Later code
  slices must supply the acceptance tests above; this report is not a substitute
  for their implementation review or Slice 6's live pass.
