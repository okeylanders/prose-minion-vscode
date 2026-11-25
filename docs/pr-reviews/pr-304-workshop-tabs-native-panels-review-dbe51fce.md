# PR #304 · Native Workshop panels and room ownership

**Verdict: Request changes.** Two issues remain in the proposed final stack: disabling the global writer bio can leave it in a sibling’s retained persona prompt, and the first ordinary Workshop can bind to the wrong workspace configuration before it is opened. A third close-lifetime issue on #304 is already addressed in #305.

**Independent review:** GPT-6.2 Astra, 2026-11-25. [PR #304](https://github.com/okeylanders/prose-minion-vscode/pull/304) targets `epic/workshop-tabs` at `a8e04ce9ca92a64ae9744b56e806cd3d42b296a2`. For attribution I used [the verified #303 → #304 comparison](https://github.com/okeylanders/prose-minion-vscode/compare/a4e5d97560930a513bad62555082b87baef63d1b...dbe51fce46454b2fc123d734661ffb267a77af73): merge base equals the #303 head, 26 commits ahead, none behind, 60 changed paths. This is not a second review of the prerequisite’s storage implementation or of #305’s usage accounting.

### F1 · P1 · Turning off “About you” does not remove it from another room’s retained prompt

[Window profile and room factory](https://github.com/okeylanders/prose-minion-vscode/blob/dbe51fce46454b2fc123d734661ffb267a77af73/apps/vscode-extension/src/extension.ts#L564-L570) · [Comparison, early return and commit](https://github.com/okeylanders/prose-minion-vscode/blob/dbe51fce46454b2fc123d734661ffb267a77af73/packages/core/src/application/services/workshop/WorkshopConversationSettingsService.ts#L270-L307)

A and B have existing persona conversations with the writer profile enabled. A disables it without changing behavior. A updates its own retained prompts and commits the shared profile. When B receives the configuration change, it compares the new value to that **same shared, already-updated value**. It returns unchanged, without rebuilding B’s retained prompt. B’s settings now say disabled, but its next continuation can still include the old bio in the system message. This is not a request to erase prior messages; the obsolete *system instruction* is the defect.

An offline two-room check used the real settings coordinators, session aggregates and shared writer-profile service, with a synthetic bio and an instrumented prompt-replacement port. The global profile became disabled; A rebuilt once and B rebuilt **zero** times. No traffic was sent to a model.

**Fix and gate:** Keep the preference global but track the profile or version actually applied to each room’s retained prompts; advance that room’s marker only after replacement succeeds. Check two retained hosts plus a guest and a sibling that defers until its run finishes. Disabling the profile must cause the old bio to disappear from every later system prompt, without a restart or a second settings change.

### F2 · P2 · The first legacy panel binds its store at extension activation, not at attachment

[Slot-store construction](https://github.com/okeylanders/prose-minion-vscode/blob/dbe51fce46454b2fc123d734661ffb267a77af73/apps/vscode-extension/src/extension.ts#L544-L549) · [First-primary reuse](https://github.com/okeylanders/prose-minion-vscode/blob/dbe51fce46454b2fc123d734661ffb267a77af73/apps/vscode-extension/src/extension.ts#L779-L791) · [Store workspace guard](https://github.com/okeylanders/prose-minion-vscode/blob/dbe51fce46454b2fc123d734661ffb267a77af73/packages/core/src/infrastructure/storage/WorkshopSessionStore.ts#L580-L591)

Activate the extension with folders A and B, remove B while retaining the same host, then use ordinary **Open Workshop** for the first time. The composition root built the primary room’s store when both folders were present. The coordinator now sees A as available, but the store refuses its first checkpoint read because its own binding still says multi-root. Hydration interprets that refusal as a restore failure and pauses rolling autosave. The existing checkpoint is not erased, but the writer gets the wrong initial room and cannot rely on rolling saves. Freshly created room stores do not have this problem.

A read-only in-memory store check exercised that exact binding order: both views reported the same available folder A; the newly bound view read normally, while the activation-time view rejected with “The Workshop workspace changed after this room was attached.” The provider-to-store wiring was traced, not operated in a native host.

**Fix and gate:** Construct even the primary room’s store when the registry first acquires it. Keep non-Workshop shared dependencies separate from an unacquired primary room. In the activation harness, start with A+B, remove B, then open Workshop: a pre-existing A checkpoint should hydrate and accept the next edit. Keep the guard that rejects an actual *post-attachment* workspace change.

### F3 · P2 on #304 only · Context Wizard resource reads can finish after their panel’s close drain

[Dispose](https://github.com/okeylanders/prose-minion-vscode/blob/dbe51fce46454b2fc123d734661ffb267a77af73/packages/core/src/application/handlers/domain/workshop/WorkshopContextHandler.ts#L208-L219) · [Await and mutation](https://github.com/okeylanders/prose-minion-vscode/blob/dbe51fce46454b2fc123d734661ffb267a77af73/packages/core/src/application/handlers/domain/workshop/WorkshopContextHandler.ts#L822-L877) · [Late dirty mark](https://github.com/okeylanders/prose-minion-vscode/blob/dbe51fce46454b2fc123d734661ffb267a77af73/packages/core/src/application/handlers/domain/workshop/WorkshopContextHandler.ts#L900-L905)

The ordinary context picker now checks the originating room. The Wizard checks its run before entering result adoption, but on this head adoption adds the brief, awaits a configured file, then adds the file without rechecking. In an offline composed-route check, I held that read, disposed the real handler, invalidated room reads and awaited the fixture’s flush. Releasing the read added a new file to the closed aggregate and called `markDirty('context wizard attachments committed')` **after** the flush. The persistence port was a spy; this demonstrates the escaped mutation and save request, not an observed disk overwrite.

[The #305 fix](https://github.com/okeylanders/prose-minion-vscode/blob/e5e244712024ae1f09f88be1ba06c53de4f14cfe/packages/core/src/application/handlers/domain/workshop/WorkshopContextHandler.ts) stages the batch and rechecks the original run after reads. Carry that fix if #304 can ship separately. **Do not count F3 as outstanding on the combined stack.**

### What held up

- An attached handler captures its own services and reply channel. The restore path maps a genuine old panel to `legacy`, gives malformed/duplicate slot IDs fresh UUIDs, and drops unrelated serialized UI state when a slot is reassigned.
- The Lightbox captures the tab and generation before the file reread; it does not consult a sibling’s tray to prove the send. A delivery-specific host receipt and an attachment-specific tray-navigation token serve different purposes. The selected-text and excerpt commands choose their destination at invocation.
- Release invalidates pending reads, joins hydration and checkpoint/memory drains, retains a failed room in the picker and does not discharge named ownership merely because the panel vanished. Reopening during a close reuses the graph behind its close barrier. The closed-room picker checks workspace identity before acting on a previous choice.

### Verification and limits

- Reconstructed a private head tree from the existing reviewed #303 snapshot. GitHub reports the snapshot as an ancestor; every one of the 69 intervening changed file payloads was fetched at the pinned #304 SHA and its Git blob hash checked. Used the existing local dependencies.
- **16 upstream suites / 247 tests and one snapshot passed**: registry, provider assembly, panel restore and seed delivery, editor selection, Lightbox handoffs, context and session routes, memory writes and assistant facade. Three additional local expected-contract checks failed as detailed above. No production files or upstream tests were modified.
- [Head CI run 2655](https://github.com/okeylanders/prose-minion-vscode/actions/runs/45693877600) completed successfully. The PR author reports native VS Code 1.148.0 smoke for tab/reload/legacy/recovery scenarios; I did not independently rerun that native smoke, all Jest suites, or paid inference. No GitHub writes, merges or branch changes.
