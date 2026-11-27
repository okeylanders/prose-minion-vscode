# Read the Problems for one file in Workshop

2026-11-27 · Sprint `sprint/workshop-file-problems` · Base `2198d442` · Decision owner: Okey · Maintainers, implementers and reviewers

## Change card · 30 seconds

[Declared] A persona in any Workshop session can ask for the highlights and Problems on a file. [Proposed] `problems.read` reads the current window’s published diagnostics for the authorized file. A caller gets the source, severity, location, message and a bounded quote of the live buffer when available. The writer can ask a guest in another tab what it thinks of Jill’s notes. Implementation gate: **open**.

| Move | Existing owner | Extension |
| --- | --- | --- |
| Name the file | Workshop file resolution for history and configured reads | Reuse the current run’s file-backed excerpt or a catalog group/path |
| Read the marks | VS Code hosts each publisher’s diagnostic collection | Query the exact authorized URI and project a bounded page, across publishers and rooms |
| Deliver evidence | Persona capability dispatch, XML/native translation, engine admission | Give the requesting persona a quoted, window-fitted page and a continuation when more entries remain |
| Record the read | Private Workshop tool artifacts and transcript projection | Keep a receipt separate from diagnostic bodies and excerpts |

## Ownership and flow · 2 minutes

What connects a second room to the first room’s notes? Component-level path for one call. Arrows show requests or returns. Brackets show the ownership change.

```text
[=] Room A → WorkshopHighlightService → VS Code diagnostics for the excerpt URI
[~] Room B host or guest → persona tool contract and dispatcher → [+] problems.read
[=] Turn excerpt or configured file → shared Workshop file resolution → authorized host path
[+] File Problems adapter → VS Code diagnostics for this URI → published entries and live range quotes
[+] Core renderer → [=] engine admission → requesting persona
[~] Receipt → existing session, transcript and tool card
```

[Observed] `WorkshopHighlightService.draw` publishes the persona, set title and note together in the diagnostic message. `VsCodeIssueAnnotator` supplies the source and the current range. The Problems adapter should preserve that message as published, including punctuation, for both Workshop and other sources. The diagnostic collection already handles edits, dismissals and clear. A separate window or a cleared set has its own current state.

[Observed] `history/WorkshopHistoryFiles.ts` resolves file selections and file excerpts via `authorizeExcerptReread`, and configured files via `resolveConfiguredResource`. `WorkshopPersonaCapabilityTurn.excerpt` is captured at run start. A configured file can therefore be queried from a room without an excerpt. A pasted excerpt has no backing URI. Requests may finish after an asynchronous authorization, so the capability also observes turn cancellation.

## Contracts, risks and checks · 10 minutes

| Boundary | Contract and impact | Witness |
| --- | --- | --- |
| Model to core · moderate | Closed `problems.read` XML operation with matching native call. `group=excerpt`, or configured `group` plus `path`. Optional 1-based `start` for subsequent entries. | Codec, native translator, prompt examples, host/guest instantiation |
| Core to host · high | Only a resolved file reaches a URI-scoped query. No workspace-wide diagnostics, cross-file related locations or command links. | Refused path/pasted excerpt never calls adapter. Two files and unrelated marks in fixture |
| Snapshot to model · moderate | Current source, severity, range and note; snapshots can change between reads. Bound individual strings and page output, escape reserved delimiters, fit whole items when possible. Zero entries and reader unavailable are distinct. | Long spans/messages, unsaved text, cleared collection, tight window, continuation |
| Persistence and audience · moderate | Private evidence follows normal capability admission. Stored tool receipt, public transcript and logs use count/status. Existing sessions continue to load. | Artifact/codec and transcript tests with sentinel note |
| Runtime and operations · low | Passive reads from the host window. A closed document can have published diagnostics without a live buffer to quote. A query cannot force an extension to refresh its diagnostics. | Real editor smoke across rooms and two diagnostic sources; fresh read after Clear |

The adapter projects editor fields. It does not make file-access decisions. The persona registry dispatches known operations. Another editor-data read can use the same file resolution without changing `IssueAnnotator` or another capability’s behavior. Preservation of current publisher messages takes priority over reconstructing structured Workshop labels from punctuation. The same file can have many problems, so the position of the next result must account for the number actually returned.

### ADR seed and implementation slices

[Proposed] A dedicated read-only capability over a window API is sufficient. Reading only the Workshop annotation collection would miss proofread, Craft and third-party Problems. Indexing all saved sessions would return historical sets the writer has hidden and require new persistence. File-scoped reads return the same current evidence the writer can inspect. Existing highlight approval and reload behavior have independent ownership.

| Owner | Component/file card | Change and verification |
| --- | --- | --- |
| Persona | `workshopCapabilities`, `WorkshopCapabilityXmlCodec`, `WorkshopNativeToolCallTranslator`, `WorkshopPersonaCapability`, prompt resources | Register, decode, dispatch and frame one operation. Check closed-operation switches and examples. |
| Core | `workshop/problems/`, file resolver and `promptBudgets` | Bind the run source, render bounded pages, handle empty, fault and cancellation. Exercise exact lookup and window fitting. |
| Editor | VS Code platform adapter, `extension.ts`, core port exports | Read one URI, sample dirty-buffer ranges and return a page. Exercise mixed sources, missing buffer and large diagnostics. |
| Receipt | Workshop session, projection, persistence and tool presentation | Expose the read’s count/status in the ledger; verify private data stays out of the receipt. |
| Integration | Existing native VS Code development-host harness | Ask in another room, verify the exact marked passage and a second publisher, then clear and read again. |

**Re-plan verdict: refined.** The initial idea was reading the Workshop highlight service. The writer’s request includes the Problems panel, whose sources extend beyond Workshop. Use the URI-scoped editor API for the current snapshot; reuse the existing file authority rather than adding a free path. No new permissions or saved-session migration are required. The main uncertainty is whether a particular diagnostic publisher reports entries for a closed file; its absence is handled as the current snapshot.

Evidence: `apps/vscode-extension/src/platform/vscode/VsCodeIssueAnnotator.ts`, `WorkshopHighlightService.draw`, `history/WorkshopHistoryFiles.ts`, `WorkshopPersonaCapabilityTurn`, `WorkshopReadWindowFit`, `history-capability.md`, and ADR 2026-11-19 D11–D15. Reviewer checks: one authorized URI, bounded responses, per-run ownership, stale-read isolation and no diagnostic bodies in stored receipts.
