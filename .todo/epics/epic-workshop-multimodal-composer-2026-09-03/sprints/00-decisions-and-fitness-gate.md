# Gate 00: Decisions and Fitness Baseline

**Status:** Complete

**Completed:** 2026-09-04

**Proposed branch:** `gate/workshop-multimodal-composer-00-decisions`

**Depends on:** Epic and architecture-runway review

**Blocks:** Sprints 01-04 and the release qualification gate

## Gate objective

Close the product decisions that alter contracts or storage, promote the ADR,
and install characterization/architecture witnesses before changing the current
text-only behavior.

## Deliverables

1. Accept or revise every product decision in the ADR: paste threshold,
   attachment-only turns, item/byte limits, formats, picker/drop intake,
   capability-unknown policy, previews, and damaged-asset behavior.
2. Accept or revise the durable ownership contract: the asset repository is the
   only binary-byte owner; room artifacts and participant history may repeat an
   immutable reference; `WorkshopThreadArtifact.kind` remains widget-only; and
   widgets share the committed artifact rail without joining composer staging.
3. Promote the accepted ADR into `docs/adr/` and link it from the epic.
4. Characterize current short-paste, typed-send, staged-file, quick-action,
   cancellation, retry, room catch-up, direct-tool privacy, restore, duplicate,
   and delete behavior.
5. Add red/green architecture witnesses for the future rules:
   - no base64/data URLs in IPC or persisted session types;
   - raw dropped bytes exist only in one bounded transient intake contract;
   - only the provider adapter may emit OpenRouter multimodal wire parts;
   - core remains `vscode`-free;
   - binary dispatch requires a host-side capability verdict;
   - asset paths are constructed only by the asset repository.
6. Record tiny synthetic fixtures for each accepted binary format. Do not add
   copyrighted or personal files.

## Accepted decisions

Gate 00 accepts the recommendations in
[ADR 2026-09-03](../../../../docs/adr/2026-09-03-durable-multimodal-workshop-messages.md),
including the 2,000-character threshold, attachment-only sends, distinct
repeated-paste actions, conservative size/format policy, metadata-only
attachment pills, fail-closed unknown capability, local picker and
drag-and-drop intake, native-file PDF delivery, atomic mixed-capability
failure, and scoped degradation.

On 2026-09-04, Okey explicitly ratified the sidecar-asset persistence model,
drag-and-drop and PDF scope, exact draft preservation on failed mixed-modality
sends, and the remaining recommended policy bundle. PDF uses the `document`
asset kind, a 20 MiB per-item bound, and OpenRouter's native file path only;
automatic or paid PDF parser fallback remains outside this epic.

## Current-behavior characterization ledger

Gate 00 reuses the repository's existing behavioral tests instead of cloning
them under new names:

| Behavior pinned before migration | Existing witness |
|---|---|
| Typed/pasted composer text sends and clears through the current textarea path | `WorkshopComposer.test.tsx` — `sends a multiline pasted draft on Enter and clears it afterward` |
| Staged text artifact ships once, stamps the turn, and clears only on success | `WorkshopRoomHandler.seams.test.ts` — `ships staged artifacts inside one send, stamps the turn, and clears pending on success` |
| Failed send retains the same `ta-N` for retry | `WorkshopRoomHandler.seams.test.ts` — `retains staged artifacts when the send fails, so a retry ships the same ids` |
| Deterministic quick actions do not consume composer attachments | `WorkshopRoomHandler.seams.test.ts` — `never lets a deterministic quick action consume staged message attachments` |
| Direct-tool turns remain private through failure, retry, and cancellation | `WorkshopRoomHandler.roomAndRun.test.ts` — direct-sidecar privacy/cancellation cases |
| Room artifacts reach another participant exactly once | `WorkshopRoomDeliveryService.test.ts` — `delivers a room-turn artifact to another participant exactly once` |
| Host-private artifact content survives export/restore but stays out of snapshots | `WorkshopSessionPersistence.test.ts` — `round-trips host-private room artifact bodies without exposing them in the snapshot` |
| Conversation archive remains string-based and defensively copied | `ConversationManager.test.ts` — `conversation archive V1` |
| Named duplicate/delete actions remain routed through the persistence owner | `WorkshopRoutes.sessions.test.ts` — `delegates browser actions and posts typed list/action responses` |
| Widget commits share the artifact rail while preserving retryable turn/artifact identity | `WorkshopRoomHandler.seams.test.ts` — `keeps a failed widget send as a complete retryable user turn plus artifact` |

## Gate witness inventory

| Boundary | Gate 00 evidence |
|---|---|
| Core stays `vscode`-free | Existing `boundaries.test.ts` source scan |
| Workshop IPC/durable contracts contain no base64 fields or data URLs | Actual-source scan plus deliberate violating fixtures in `boundaries.test.ts` |
| Raw dropped bytes exist only in the future dedicated transient intake contract | Allowlisted-owner source scan plus allowed/disallowed fixtures in `boundaries.test.ts` |
| OpenRouter multimodal wire names exist only in the future provider adapter | New actual-source scan plus allowed/disallowed ownership fixtures in `boundaries.test.ts` |
| Workshop asset paths are constructed only by the future asset repository | New actual-source scan plus allowed/disallowed ownership fixtures in `boundaries.test.ts` |
| Accepted limits and formats have one owner | `WORKSHOP_COMPOSER_ATTACHMENT_POLICY` plus exact policy test |
| Every accepted format has non-personal test input | Header-only `WORKSHOP_SYNTHETIC_ASSET_FIXTURES` inventory test, including PDF |
| Unsupported/unknown binary input makes zero provider calls | Mandatory Sprint 04 runtime test; Gate 00 records the contract but does not mock a dispatch path that does not exist yet |

The last row is intentionally a future behavioral witness rather than a Gate 00
test double testing itself. Sprint 04 cannot open its capability gate until that
zero-fetch test is green.

## Exit criteria

- [x] ADR status is Accepted and the epic has no architecture-reversing unknown.
- [x] Byte/reference ownership, the bounded D&D intake exception, and
      widget-versus-composer lifecycle boundaries are explicit and accepted.
- [x] Current attachment semantics are protected before the type migration.
- [x] Each structural fitness witness fails against a deliberate violating
      fixture; the nonexistent dispatch path has a required Sprint 04 runtime
      witness instead of a self-testing mock.
- [x] Limits and MIME/format mappings have one named owner.
- [x] No provider request or Marketplace action occurs in this gate.
- [x] Focused tests, typecheck, lint, and `git diff --check` pass.

## Validation evidence

- `boundaries.test.ts` plus `workshopComposerAttachments.test.ts`: 3 matching
  suites, 45 tests passed.
- Existing characterization ledger: 7 suites, 165 tests passed.
- All three TypeScript projects passed `npm run typecheck`.
- Focused ESLint passed for every Gate 00 TypeScript change.
- Epic/ADR Markdown structure, relative links, and whitespace checks passed.

## Rollback seam

Documentation and characterization tests only. Revert this gate without data
or runtime migration.
