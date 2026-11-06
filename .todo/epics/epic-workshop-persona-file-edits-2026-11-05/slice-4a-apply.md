# Slice 4a: Apply (host): the claim and the durable checkpoint

**Status:** Built, for review.
**Branch:** `epic/workshop-persona-file-edits-slice-4a-apply`, from the combined stack (`epic/workshop-persona-file-edits-slice-2-gateway` at `6749bf7f`: Slices 1–3 and the gateway, in review as PR #229).
**Decision:** [ADR 2026-11-05](../../../docs/adr/2026-11-05-workshop-persona-file-edits.md) D7.5–D7.6, D8, D9 (words and routes), D10 (`landed`).
**Next:** Slice 4b (the webview cards) builds on this head. It consumes the routes below and the words table.

Host only. No webview, no UI.

## Scope

- **Routes** (`WorkshopFileEditHandler`, composed in `WorkshopSliceComposition`; it constructs no service):
  - `WORKSHOP_FILE_EDIT_ACTION` (`apply` | `review` | `decline`), behind the session-operation gate. Refused there with `session-operation`, answered by request id.
  - `WORKSHOP_FILE_EDIT_PREVIEW`, a read (direct).
  - Answers: `WORKSHOP_FILE_EDIT_RESULT` and `WORKSHOP_FILE_EDIT_PREVIEW_RESULT`.
  - Every request carries a webview-minted `requestId` and the `roomRevision` the card was shown in. Every answer echoes both.
- **The claim (D8).**
  - When an Apply or Review arrives, before anything is awaited, the handler captures `readRoomRevision()` and takes the claim `(generation, turnId, index)`.
  - A second Apply or Review while it is held, with the same or another request id, joins it. Each request gets the one outcome: the first as `settled`, the rest as `joined`.
  - Decline while claimed is answered `held` (state `applying`), and nothing changes.
  - A settled card replays its state (`replayed`) and writes nothing. Operations always come from the stored card; a request names only its card.
  - An action shown in another room (`roomRevision` ≠ the live one) is refused `room-changed`, even with matching ids.
- **Before the checkpoint**, Apply is refused with nothing written when the setting is `off` (`file-edits-off`) or a reply is running (`run-active`).
- **`checkpointFileEdit(generation, turnId, index)`**, on `WorkshopSessionPersistenceCoordinator`:
  - It is ordered behind autosaves and room operations, and a room replacement queues behind it in turn.
  - It refuses when:
    - the generation moved (`room-changed`);
    - the store is unavailable or protected, or the workspace changed since load (`store-unavailable`);
    - the live card is not `applying` (`not-applying`);
    - a reply is running, so capture defers (`run-active`).
  - Otherwise it captures, then writes the named file first when the room is named, then `current.json` (the mirror), and reads each back.
  - It answers `{ ok: true }` only when every file read back holds that card in `applying`, and the generation is still the one asked about.
  - A failed write is `checkpoint-failed`. A failed or differing mirror is `mirror-failed`; the mirror is left pending for the next flush.
  - A resolved `flush()` is never success.
  - On a refusal the handler returns the card to `pending` (best effort) and writes nothing.
- **`stillCurrent()`** for the gateway: this claim is still the one held, the generation is unchanged, and the setting is still `ask`. The gateway calls it at its last boundary and before every attempt (D7.6). The checkpoint is acknowledged before the gateway is called, and nothing is awaited between the gateway's boundary and the applier's call.
- **The session setter** `setFileEditProposalState(turnId, index, settlement)`:
  - it changes only state, reason, outcomes and `landed`, replacing what was there;
  - it is held to the session codec (`settleWorkshopFileEditProposal` runs `assertWorkshopFileEditProposalShape` on the turn);
  - it throws `no-card` for a turn without the card;
  - a settlement the codec would refuse throws and leaves the card as it was.
- **Outcomes (D8, D10)**, `workshopFileEditSettlementOf`:

  | Gateway state | Card |
  |---|---|
  | `applied` | `applied`, every outcome `landed`, a landed record each |
  | `partial` | `partial` by operation (`landed`, `unknown`, else `not-applied`), a record per landed one |
  | `unknown` | `unknown` by operation, reason `outcome-unknown` when the gateway gave none |
  | `declined` (a discarded review) | `pending`: nothing was written |
  | `refused` at the boundary (`superseded`, `authority-changed`) | `pending`: nothing was written |
  | `stale`, `refused` | as such, with the reason, no outcomes |

  An outcome the codec would refuse is held as `unknown`, never lost. A gateway that throws leaves the card `unknown`.
- **`landed` records** (`fileEditLandedRecords`, computed by the gateway, which has the text):
  - `before` and `after` are the planned operation's text: what it replaced and what it wrote, the separator included for append and prepend;
  - the context is up to 80 characters on each side of the written text, in the planned text after the landed edits;
  - `versionAfter` is the settled version;
  - over `revertCharacters`, or with no version after, only the two SHA-256 hashes are kept.
- **The writer's words (D9).** One table, `WORKSHOP_FILE_EDIT_REASON_WORDS` in `shared/constants/workshopFileEditWords.ts`, shared with the webview so a stored kind reads the same after a reload.
  - It covers every kind:
    - staging's;
    - `rewrite-on-prose`, `identity-unpersistable` and `applying-on-reopen`;
    - the gateway's refusals and operation faults;
    - the applier's refusals;
    - the checkpoint's;
    - the handler's.
  - `workshopFileEditCardWords(state, reason)` gives a card's line. An unlisted kind reads as the generic line.
  - `fileEditCopy` now reads its words from this table; it has none of its own.
- **The preview** (`FileEditApplyPort.preview`, the gateway):
  - It uses Apply's own resolution (re-authorize, recompute the class, open). For a rewrite card it answers the live content (after front matter) and the rewrite, only while the baseline holds; otherwise `stale`.
  - A stale answer turns a pending, unclaimed card `stale`, in its own room only.
  - It writes nothing, carries no `documentUri`, and logs kinds only.
  - A card that isn't a rewrite is refused `not-a-rewrite`, since its operations are its diff.
- **Shutdown.** Claims are never awaited. An acknowledged `applying` reads as `unknown` after a reload (Slice 3's reopen rule).
- **The port.** Workshop modules may not name the gateway (`boundaries.test.ts`), so the gateway's two doors are `FileEditApplyPort` in `domain/models/FileEdit.ts`, with the outcome and preview types. The gateway implements it and re-exports the types. `WorkshopRoomHandler` takes it after staging. `MessageHandler` passes `CoreServices.projectFileEditGateway`.

## Message contracts (for 4b)

In `shared/types/messages/workshop/fileEdits.ts`, through `@messages`:

```ts
// webview → host
WORKSHOP_FILE_EDIT_ACTION   { requestId, roomRevision, turnId, index, action: 'apply' | 'review' | 'decline' }
WORKSHOP_FILE_EDIT_PREVIEW  { requestId, roomRevision, turnId, index }
// host → webview
WORKSHOP_FILE_EDIT_RESULT   { requestId, roomRevision, turnId, index,
                              answer: 'settled' | 'joined' | 'replayed' | 'held' | 'refused' | 'room-changed' | 'no-card',
                              state?: WorkshopFileEditState, reason?: string /* a kind */, message: string /* the writer's words */ }
WORKSHOP_FILE_EDIT_PREVIEW_RESULT { requestId, roomRevision, turnId, index,
                              preview: { kind: 'rewrite', before, after }
                                     | { kind: 'stale' | 'refused', reason, message } }
```

- The card's own state also arrives through `WORKSHOP_SESSION_STATE` (`applying` while it runs, then the outcome), with `documentUri` stripped (`workshopTurnForWebview`).
- Words for a stored `reason`: `workshopFileEditCardWords(state, reason)` from `@shared/constants/workshopFileEditWords`.
- `roomRevision` is the session state's. An answer whose `roomRevision` isn't the room on screen is ignored (#221).

## Tests

- **`WorkshopFileEditHandler.test.ts`** (real session; fake gateway and checkpoint), 30 tests:
  - the stored operations applied, never the request's;
  - review mode;
  - double Apply with the same and with different ids, and Review joining: one checkpoint and one write;
  - a replay control;
  - Apply racing Decline (`held`), with a Decline-first control;
  - every terminal state replays and writes nothing;
  - each checkpoint refusal writes nothing and leaves the card pending;
  - a deferred checkpoint ("Apply after the current reply finishes"), then a control that lands;
  - a reply running, or the setting off, refused before any checkpoint;
  - another room's action;
  - `stillCurrent` with the setting turned off, and the boundary loss returning the card to pending;
  - the same session reopened while the old action is paused: authority false, the outcome dropped, with a control;
  - outcomes: partial, unknown (no second Apply), a discarded review, stale and refused, a throwing gateway;
  - the preview: rewrite, stale (the card turns stale), and the room replaced mid-read;
  - log and answer sentinels;
  - malformed requests.
- **`fileEditApply.integration.test.ts`** (real session, coordinator, in-memory store, staging, gateway and applier over `FakeDocuments`), Astra's F-04 acceptance cases, 18 tests:
  - **Double Apply** with the same and with different ids: one `applyEdits`.
  - **Apply racing Decline:** one write.
  - **The durable checkpoint control:** `current.json` holds `applying` while the write is out, then `applied` after.
  - **A named room:** both files hold `applying` before the write.
  - **Checkpoint failure and deferral** (a write fails; a reply running): zero `open`, zero `applyEdits`.
  - **A mirror failure:** zero writes.
  - **The room replaced while the gateway's catalog or open is paused:** no write, `room-changed`.
  - **The room replaced while the checkpoint is paused:** the reset queues behind it, then the boundary refuses.
  - **The generation moved inside the checkpoint:** never opened.
  - **The same session reopened while an old action is paused:** zero writes; the reopened card reads `unknown` (`applying-on-reopen`) and replays with no Apply.
  - **Retry authority lost** (the setting turned off between attempts): one `applyEdits`; control: the retry lands.
  - **A preview with an entry unticked:** `partial`, by operation, with its landed record.
  - **Close during review:** `unknown`, no second Apply.
  - **A card saved `applying` and reopened** reads `unknown`.
  - **The combined integration gate:** stage, reply, Apply, a card `applied` with both landed records (before, after, context, version), revealed; then saved, reopened, identical.
- **`WorkshopFileEditActionRoutes.test.ts`** (the real router and room handler):
  - Apply through the wiring;
  - Decline;
  - behind the gate, answered by request id;
  - the setting off;
  - no posted message carries the URI.
- **`WorkshopFileEditSettlements.test.ts`:**
  - each gateway state's settlement;
  - the setter keeps staging, operations and why, and replaces the settlement;
  - four codec refusals leave the card as it was;
  - `no-card`;
  - the webview view;
  - the staged edit from the stored card only.
- **`workshopFileEditWords.test.ts`:**
  - a test per kind, from each source's union: present, a sentence, no path or URI, never the kind's spelling;
  - no orphan kinds;
  - an unknown kind reads generic;
  - state words;
  - `fileEditCopy` reads the one table.
- **`fileEditLandedRecords.test.ts`:**
  - context in the text after;
  - only landed operations;
  - the context bound;
  - joined operations;
  - hashes past the bound or with no version.
- **`ProjectFileEditGatewayPreview.test.ts`:**
  - before and after while the baseline holds;
  - stale;
  - re-authorized;
  - not a rewrite;
  - its log line.
- **`boundaries.test.ts`:**
  - the two routes in the owner ledger (88: 48 mutation, 40 direct);
  - `WorkshopFileEditHandler` among the composed handlers.

## Verification

- Baseline at `6749bf7f`: typecheck clean; lint 0 errors, 1,165 warnings; jest 773 suites, 10,774 tests, 59 snapshots.
- After: see the epic README's progress note.

## Implementation note

- **The checkpoint precedes the gateway call, not its last boundary.** D7.5 reads "the durable `applying` checkpoint is acknowledged, then the authority predicate holds, with nothing awaited between them and the applier's call". The checkpoint is itself awaited I/O, so the handler acknowledges it before calling the gateway, and the gateway's boundary then calls `stillCurrent()` synchronously.
  - `applying` is durable before any write either way.
  - It is durable a little earlier than strictly needed: across the gateway's catalog read and open. A refusal there returns the card to `pending`, and a replacement there drops the outcome (its file reads `unknown` when reopened, which is safe).
  - Putting the checkpoint inside the gateway, after planning, would put an await between planning and the applier, whose snapshot would then be stale.
- **Replacements queue behind the checkpoint.** Session operations wait on the autosave queue, and the checkpoint runs on that queue. A Reset or Open asked while the checkpoint writes runs after it, while the gateway awaits, and the boundary refuses. The integration test covers this ordering, plus a direct generation move inside the write.
- **Read-back.** The checkpoint reads `current.json`, and the named file when the room is named, back from the store before answering `ok`. That makes "each holds that exact state" literal rather than inferred from a write that didn't throw.
- **Boundary refusals return to `pending`.** `superseded` and `authority-changed` with nothing landed mean nothing was written (D8.3). A card whose setting was turned off shows Apply again, and that Apply is refused `file-edits-off` with nothing written.
- **`roomRevision` on every request.** The ADR keys the claim by the generation captured at arrival. A request carries the generation it was shown in, so an Apply clicked in a room that was replaced before the message arrived never acts on the new room's card with the same ids.
- **Preview marks stale.** D6 says the card "turns stale" when the baseline no longer holds; the preview route does that only for a pending, unclaimed card in its own room.
- **Words moved, slightly reworded.** `fileEditCopy`'s lines now come from the shared table. Two are more specific than before: stale with `not-found` says the text is no longer in the file, and `unreadable` reads "could not be opened or read as text" for both staging and Apply. No test pinned either.
- **Coordinator growth.** `WorkshopSessionPersistenceCoordinator.ts` (1,814 lines) grows by the one method, `checkpointFileEdit` (about 70 lines). It needs the coordinator's private store, capture and named-checkpoint state. The pure contract (results, the read-back rule) lives in `workshop/fileEdits/WorkshopFileEditCheckpoint.ts`.

### Open for review

1. **`applied` with a reason.** The codec allows a reason on `applied`. The mapping passes the gateway's reason through, which it never gives on `applied` today.
2. **The `refused` states that offer no Apply.** These follow the ADR literally: `catalog-unreadable` at Apply, `host-failed`, `unreadable`. A transient catalog failure leaves the card refused, and the writer asks the persona again. A case could be made for returning the transient ones to `pending`.
3. **`landed` context after a retry.** It is the planned text after, not the live buffer. When the writer typed beside an edit as it went out, the context may not stand there, and a future Revert refuses (D12's rule). That is safe; it is noted for D12.
