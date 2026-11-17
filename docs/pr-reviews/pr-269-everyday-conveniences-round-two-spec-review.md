# PR #269 review: Everyday Conveniences, Round Two spec

Reviewed source head: `dab5760fb0a030655e4091936cda00d8c88a3663`.
Scope: the two added planning documents, source feature notes, and existing implementation seams. This is a design review, not runtime validation of the future slices. **Two P2 contract gaps should be resolved before the affected slices implement these decisions.** No merge performed. Product defaults Q1–Q7 remain the owner's decisions; this review does not approve them on their behalf.

## F-01 [P2] Include settlement-time memory-edit drops in the outcome contract

Location: `docs/adr/2026-11-17-everyday-conveniences-round-two.md`, D13, lines 469–473.

D13 specifies an exhaustive mapping over `WorkshopReplyMemoryRejection` and `WorkshopReplyFileEditRejection`. The memory union is the extraction/grammar verdict only. A syntactically valid memory **edit** can subsequently disappear in `settleWorkshopMemoryEdit`: unreadable listing, unknown/archived/superseded/busy target, refused anchoring, or pinned-budget refusal. That function returns no proposal and only a log string; `settleWorkshopMemoryProposals` keeps that log but adds no card.

Example: a reply proposes a valid edit targeting a note that has since been archived. Extraction has no rejection, settlement produces zero cards, and the proposed mapper has no dropped reason. The next-message outcome therefore still fails to tell the persona what became of its suggestion, precisely the failure item D is meant to repair.

Amend D13 to require structured, closed settlement outcomes from the memory-edit path as well as parser rejections, with a documented bounded mapping into trailer outcomes. Do not parse log strings. Add acceptance cases for at least unknown/archived target, anchor refusal and pinned-budget refusal, verifying one drop, no card, no text/path leakage, and next-message delivery.

Observed evidence:
- `packages/core/src/utils/workshopReplyControls.ts:153–168`: parser rejection union and accepted drafts.
- `packages/core/src/application/services/workshop/memory/WorkshopReplyMemoryEdit.ts:49–82`: valid edits dropped after extraction.
- `packages/core/src/application/services/workshop/memory/WorkshopReplyMemory.ts:103–113`: only an optional proposal and log survive this step.
- Source feature note requires a counts-and-reasons line after all or partial drops, and explicitly points to settled proposals/log reasons.

## F-02 [P2] Reconcile the page ceiling with complete catalog reachability

Location: `docs/adr/2026-11-17-everyday-conveniences-round-two.md`, D10, lines 384–398.

The request accepts only pages 1–50 and each page holds 40 notes, yet the contract promises that following continuation hints reaches every note in effect and every hint decodes. The existing store has no 2,000-note project ceiling: `readProjectMemoryFolder` reads all qualifying memory files, and catalog listing filters/orders that whole set.

With 2,001 valid in-effect notes of one kind, page 50 has another note left. Emitting page 51 violates the decoder bound; suppressing its hint leaves that note unreachable through this catalog and breaks the stated completeness guarantee. A kind filter does not fix the same-kind case.

Amend the contract to support continuation across the entire supported library (for example a bounded cursor/offset representation with a compatible upper domain), or explicitly define the supported storage ceiling and truthful terminal behavior. Avoid silently introducing a destructive storage cap. Add a 2,001-note, same-kind fixture that follows every generated hint and checks decoder validity and complete unique coverage.

Observed evidence:
- `packages/core/src/infrastructure/storage/ProjectMemoryFiles.ts:104–164`: all matching files enter the listing; no library-count cap.
- `packages/core/src/application/services/workshop/memory/WorkshopProjectMemoryRenderer.ts:39–49`: live catalog consumes the whole listing.
- `PROMPT_BUDGETS.workshopProjectMemory.catalogEntries` is 40.

## Compact architecture/contract check

- **Declared and consistent:** earlier-turn paging uses host-owned projection and rewindability, room correlation, nonpersisted client state, and fresh host checks for actions. Lens/help results remain private neutral evidence; new families explicitly traverse grammar, native mapping, artifacts, persistence and prompt sync surfaces.
- **Observed:** existing memory settlement has a second rejection stage absent from the proposed typed mapping (F-01); storage is not capped to the pagination domain (F-02).
- **Inferred implementation risk, not an additional finding:** the earlier-turn refresh walk must evict stale covered ranges and discard responses from superseded walks; the ADR already asks for sliding-window/rollback/race tests. Preserve that invariant during implementation.
- **Unknown until implementation:** runtime fit behavior, UI scroll stability/accessibility, persistence round trips and generated-help completeness. The ADR's acceptance tests are planned tests, not evidence that they have passed.

## Verification and limits

- Confirmed docs-only diff: two new files, no executable changes.
- Inspected the affected current code paths and source notes to substantiate both findings.
- Rechecked PR head and existing reviews immediately before publishing; head unchanged and no existing review to duplicate.
- No build, tests or live UI pass run for this documentation-only review. No claim of CI success or merge readiness.
