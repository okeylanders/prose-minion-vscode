# Slice 1: The declaration

**Status:** Built and pushed on `epic/workshop-reply-edit-actions-slice-1-declaration`; awaiting its PR into `epic/workshop-reply-edit-actions`.
**Date:** 2026-11-10
**Decisions:** ADR 2026-11-10 D1, D2, and D8's `editOffers` parts.
**Scope:** Host only. No route, no UI, no press.

## What was built

| Piece | Where |
|---|---|
| The offer's types: `WORKSHOP_EDIT_OFFER_KINDS`, `WorkshopEditOffer`, the webview's view | `shared/types/messages/workshop/editOffers.ts`, behind the barrel |
| `WorkshopTurn.editOffers` | `shared/types/messages/workshop/session.ts` |
| The six bounds, `PROMPT_BUDGETS.workshopEditOffers` | `shared/constants/promptBudgets.ts` |
| The trailer's codec: tag, closed elements, kind, file, count | `utils/workshopEditOfferProtocol.ts` |
| The pure judge, one verdict per frame, and the redaction | `utils/workshopReplyEditOffers.ts` |
| The tag in the one pass: `TRAILER_TAGS`, `REDACTIONS`, the `editOffers` control | `utils/workshopReplyControls.ts` |
| Resolving a file with no baseline: `FileEditStaging.resolve` | `domain/models/FileEditStaging.ts`, `FileEditStagingService` |
| Resolving a reply's offers, settling them at completion, reporting them | `application/services/workshop/fileEdits/WorkshopReplyEditOffers.ts` |
| Offers passed to the turn | `WorkshopRunCompletion.ts`, `WorkshopSessionService.completeRun` |
| The session codec's shape and clone | `session/WorkshopEditOfferRecords.ts`, `WorkshopSessionStateV1Shape.ts` |
| The webview's view without `documentUri` | `fileEdits/WorkshopFileEditWebviewView.ts` |
| The transcript's decision to omit offers | `transcript/WorkshopTranscript.ts` (header note) and a test |
| The persona prompt, taught only while file edits are on | `resources/system-prompts/workshop-personas/reply-edit-offers.md`, `workshopPersonas.ts` |

## The drop rules, by name

Every dropped frame is logged once as `Edit offer dropped (reason=…)`. A kept one is logged as `Edit offer kept (kind=…; target=file|excerpt; count=…)`.

| Rule (D1) | Rejection | Decided in |
|---|---|---|
| Malformed inside | `malformed:<fault>` | the pure judge |
| Unclosed, unopened, nested, mistagged | `malformed:unclosed`, `:unopened`, `:nested`, `:tag` | the pure judge |
| Not at the tail | `misplaced` | the pure judge |
| Over `frameCharacters` | `oversized` | the pure judge |
| Unknown kind | `unknown-kind` | the pure judge |
| Second frame of a kind | `duplicate-kind` | the pure judge |
| No prose | `no-prose` | the pure judge (nothing left but trailers) and completion (the host wrote the reply's line) |
| File edits off | `file-edits-off` | the pure judge |
| The reply keeps a file-edit proposal | `has-file-edit-proposal` | the pure judge |
| The file did not resolve | `unresolved:<staging refusal>` | the resolver |
| Not a host or guest persona's reply | `not-a-persona` | after the turn is adopted |
| Prose over `sourceReplyCharacters` | `source-reply-too-long` | completion |
| Nothing was resolved for this reply | `not-resolved` | completion (as `not-staged` is for a card) |

## Choices taken

Each follows how file-edit proposals do it, unless said otherwise.

1. **The resolve seam is a second method on the staging port.** `FileEditStaging.resolve(target)` returns the identity alone. `FileEditStagingService` now splits `stage` into `identify` (the D4 rules) and the baseline read, and `resolve` stops after `identify`. No resolution logic is duplicated.
2. **`resolve` keeps staging's checks that need no text.** A file that is not `.md` or `.txt`, or whose catalog size is over the bound, does not resolve. A file that is merely unreadable does: freshness belongs to the cards.
3. **An identity a session can't hold is no offer** (`unresolved:identity-unpersistable`), by the same contract a card's identity is held to.
4. **"Keeps a file-edit proposal" means a frame the reply reader kept.** A reply whose file-edit frames were all dropped as malformed may still offer. A card later refused at staging still counts as proposed.
5. **Two offers may name one file.** Fixes and rewrites to one chapter are the ADR's own case, so there is no one-file-per-reply rule for offers.
6. **`count` is `count: 99` in the budgets,** the largest count; the least is 1. A count that is not one or two digits from 1 to 99 drops the frame (`malformed:invalid-count`), as any bad element does.
7. **`<kind>` is read without letter case.** `Rewrites` is `rewrites`.
8. **The file is decoded by the file-edit codec's own function.** `decodeWorkshopFileEditTarget` is now exported; a test holds the two codecs to the same fault for the same target.
9. **Offers ride in the file-edit context.** `resolveWorkshopReplyEdits` returns the proposals' context with an optional `editOffers`, so `WorkshopRoomHandler` and the side pass changed only an import and a type name (the handler's line count is unchanged).
10. **`REDACTIONS` is a table now,** in the shape Message Reactions gives it on its branch, so the merge adds one entry to it and one tag to `TRAILER_TAGS`.
11. **No checkpoint normalization was added.** No development checkpoint ever held another shape of `editOffers`, so there is nothing to repair. The records module says so.
12. **The prompt teaches four numbers:** 2 offers, a count from 1 to 99, a 600-character frame, and a 48,000-character reply. `whyCharacters` and `fixChangedCharacters` are in the budgets for Slice 2 and are not taught yet.

## Things to know

- **A reply of offers alone reads as an empty reply does.** It earns no host line (D1), so its bubble content is empty, and retained history holds what an empty reply holds today (the widget sanitizer's placeholder). Once Message Reactions is merged, its "Replied without a message." line may be the better home; that is the merge's call.
- **`completeRun` gained a thirteenth positional argument** (`editOffers`). Message Reactions adds its own in the same place, so the merge needs both, in an order the coordinator picks.
- **`WorkshopRunCompletion.ts` is at 496 lines.** Message Reactions moves the widget copy out of it, which gives the room back.
- **The architecture guard's module list and the two documented trees** (`AGENTS.md`, `docs/ARCHITECTURE.md`) gained the `editOffers.ts` line the guard requires. The feature's own `AGENTS.md` section is Slice 4's.
- **Not done here, by design:** the derived status, the view's "file edits still on" check per snapshot, the route, the directive, `intent` and the fixes policy. They are Slice 2.

## Tests added

| Suite | Covers |
|---|---|
| `utils/workshopEditOfferProtocol.test.ts` | The codec: kinds, file (fault for fault with the file-edit codec), count, closed elements |
| `utils/workshopReplyEditOffers.test.ts` | The one pass: every pure rejection, redaction, streaming, retention, no host line |
| `architecture/replyEditOfferPromptSync.test.ts` | The prompt's numbers, kinds and elements; the worked example through the production extractor; when it is taught |
| `application/services/fileEdits/FileEditStagingService.test.ts` (added to) | `resolve`: the same identity as `stage`, no file read, its refusals, its log |
| `application/services/workshop/fileEdits/WorkshopReplyEditOffers.test.ts` | Resolving, settling and reporting, with a log sentinel check |
| `application/services/workshop/session/WorkshopEditOfferTurns.test.ts` | Offers on host and guest turns; every completion-stage drop; the session codec's round trip and 20 refused shapes; the webview's view; transcript, exports, recall and preview show no offer; findings and the to-do list the same with and without an offer; the log sentinel sweep |

## Verification

| Check | Baseline (epic tip `c32a31dc`) | After |
|---|---|---|
| `npx jest` | 797 suites / 11,186 tests / 59 snapshots, all passing | 802 suites / 11,284 tests / 59 snapshots, all passing |
| `npm run typecheck` | — | passes |
| `npm run lint` | 0 errors, 1,165 warnings | 0 errors, 1,165 warnings |

- The baseline was taken in a clean worktree of the epic's tip, under Node 22.
- `packages/core/src` has no `from 'vscode'`.
- No new file is over 500 lines; the largest is the turn test at 416. Files already over grew only by the seam: `WorkshopSessionService.ts` +5, `WorkshopSessionStateV1Shape.ts` +4, `session.ts` +3, `promptBudgets.ts` +28 (the bounds and their notes), `WorkshopRoomHandler.ts` +0.
- No test makes a model call.
- Offer logs carry kinds, counts and fault names. Two sentinel tests hold that: no path, URI or reply text in any offer line.
