# ADR 2026-11-14: Everyday Conveniences: Multi-File Reads and Selected Text

**Status:** Proposed (defaults taken for Okey, 2026-11-14). Amended the same day for PR #259's review: D2a, D4's duplicate rule, D11 and D14's room binding.
**Date:** 2026-11-14
**Epic:** [Everyday Conveniences](../../.todo/epics/epic-everyday-conveniences-2026-11-14/README.md)
(its "Defaults taken" table is binding here)
**Ideas as filed:**
[Reads That Fit the Window](../../.todo/features/feature-workshop-reads-fit-the-window/README.md)
(item A: parts 1, for `resource.read` only, and 3),
[Send the Selection With Each Message](../../.todo/features/feature-workshop-send-selection-with-message/README.md)
(item B)
**Extends:**
- [ADR 2026-10-05: Session Recall](2026-10-05-workshop-session-transcript-recall.md)
  D9 and D11: fair shares and the window fit, which item A lifts out of
  `recall/` and uses for files.
- [ADR 2026-10-19: Lightbox](2026-10-19-lightbox-inspiration-board.md) D11:
  seed delivery, attachment kinds and attachment identity, which item B joins.
- [ADR 2026-07-30: Session Codec Evolution](2026-07-30-workshop-session-codec-evolution.md):
  item B's session fields are optional and additive, with no
  `schemaVersion` bump.

## Context

The epic has five items. **C, D and E need no ADR; they are settled in the
epic README.** This ADR decides A and B.

**A, as the code stands:**
- A persona's `resource.read` names one `<group>` and one `<path>`
  (`WorkshopCapabilityXmlCodec.resourceReadRequest`). It reads a 400-line
  default window under a 64 KiB ceiling (`PROMPT_BUDGETS.workshopResource`:
  `readDefaultLines`, `readBytes`), and refuses a source over 2 MiB
  (`readSourceBytes`).
- The engine measures the room left and passes it to
  `AgentCapability.fulfill(request, window?)`. `WorkshopPersonaCapability.dispatch`
  hands the window to recall alone; the resource family is called as
  `this.resourceCapability.fulfill(request)`.
- So "chapters 1, 2 and 3" is three calls, and none of them knows the
  window. Fifteen calls a turn can carry about 960 KiB.

**B, as the code stands:**
- `prose-minion.workshopSelection` replaces the room's excerpt
  (`WorkshopPanelProvider.seedExcerpt`). There is no way to point at a few
  lines for one message.
- `VsCodeEditorContext` keeps `lastSelection` only when a selection is
  non-empty, so a deselect leaves the old one in place.
- A message can already carry one-shot attachments
  (`pendingMessageAttachments`, at most 7), and one kind that is not a
  file: a Lightbox tile.

Okey, 2026-11-14, on B: "Send to Editor (Compose Box) but make it a pill
when adding: 'Selected Text', also a toggle option on compose to
automatically include selected text."

## Where the code differs from the notes

Checked before deciding; each is settled below.

1. **Recall does keep a per-turn total with a known window**
   (`readCharactersPerTurn`, two full reads). Okey's answer 2 was for
   files. Files get none (D3); recall's is left alone.
2. **A cut `resource.read` gives no continuation today.** The note says the
   64 KiB ceiling "already" gives a `startLine`. It says where it stopped
   in words ("stopped at the 65536-byte ceiling") and nothing decodable.
   D6 adds the hint.
3. **The grammar is not in a prompt file.** `resource.read` is taught by
   `createWorkshopCapabilityInstruction` (in `WorkshopCapabilityXmlCodec.ts`),
   entered once by `appendContract` and frozen for that conversation.
   Only `transcript.*` and `memory.*` have Markdown grammar files.
4. **Fair shares live in `recall/` too** (`allocateWorkshopRecallReadShares`).
   Files cannot import recall, so the shares move with the fit (D1).
5. **Three files are at the 500-line bound.** `WorkshopResourceCapability.ts`
   is 481 lines, `WorkshopCapabilityXmlCodec.ts` 479, and
   `WorkshopPersonaCapability.ts` 968. Slice A splits before it adds (D8).
6. **The read's log line names the path** (`requestLogSummary`:
   `path=…`). That is today's behavior, for a configured project path. The
   multi-file line carries counts and groups (D7).
7. **`seedExcerpt` is not a seed delivery.** It posts `WORKSHOP_SET_EXCERPT`
   straight through the panel's handler. The new command follows
   AGENTS.md's Seed Delivery instead (D12).
8. **The editor commands never use the port.** `getSelectionPayload` in
   `extension.ts` reads `vscode.window.activeTextEditor` itself. The new
   command goes through the port and the snapshot service (D10, D11).
9. **A message attachment is already cut by words.**
   `WorkshopMessageAttachmentTruncation` (`keptWords`, `totalWords`) and
   the frame's "Head slice" line exist. The selection's bound is in words
   and reuses them (D15).
10. **The transcript already shows attachments by label only**
    (`attachmentLabels` in `transcript/WorkshopTranscript.ts`), and Rewind
    already restages from the captured body (`composerRestoreFor` reads
    `threadArtifacts`). Defaults 7 and 8 need tests, not new code.
11. **The epic README calls the kind `editor-selection`.** That literal is
    already the excerpt's source kind (`WorkshopExcerptSource`). This ADR
    names the attachment kind `selected-text` (D13).

## Item A: decisions

### D1. One fitting module, outside recall

- **New folder** `application/services/workshop/reads/`:
  - `WorkshopReadWindowFit.ts`: `fitWorkshopReadToWindow`,
    `workshopReadEvidenceTokens`, `WORKSHOP_READ_FIT_RENDERS` (6), the
    2% tolerance. The search is recall's, unchanged; its measured field is
    renamed from `characters` to `size`, since files measure bytes.
  - `WorkshopReadShares.ts`: `allocateWorkshopReadShares` (water-filling).
- **Moved, not copied.** `recall/WorkshopRecallWindowClamp.ts` and
  `recall/WorkshopRecallReadAllocation.ts` are deleted, with no re-export.
  Their tests move to `__tests__/application/services/workshop/reads/`
  with every case kept.
- **Boundary.** `boundaries.test.ts` gains `WORKSHOP_READS_MODULES`:
  - both files join `WORKSHOP_CAPABILITY_BOUNDARY`;
  - a module under `reads/` imports nothing under `recall/` or `memory/`,
    and no session, store or renderer module. Today it needs only
    `@orchestration/RequestContextPreflight` and
    `@shared/types/workshopCapabilities`;
  - `WORKSHOP_RECALL_MODULES` loses the two names. Recall imports `reads/`.

### D2. `resource.read` takes the window

- `WorkshopPersonaCapability.dispatch` passes `window` to
  `resourceCapability.fulfill(request, window)`. Catalog and search ignore it.
- **The rule is recall's:** the largest read whose evidence, by
  `workshopReadEvidenceTokens`, costs at most half of
  `window.freeInputTokens`.
- **What is fitted is a byte limit.** Each render cuts every file at whole
  lines under its share (D5), so the result is the largest line window
  that fits. The first guess is the read's own bound.
- **The minimum** is `readMinimumBytes` (2,048) per file named. If half
  the room holds less than that for each file, the read is refused, with
  the room it had and "name fewer files, or answer from what you have."
  It is never cut below the minimum.

### D2a. A line that does not fit (PR #259 F-01)

Whole-line packing can meet a line longer than its file's share: a valid
source under 2 MiB may open with a 70 KiB line. Without a rule, the read
would deliver nothing and hint the same `startLine` forever.

- **A line is never cut.** Today's `sliceUtf8` can end a read mid-line.
  That stops: a one-path read changes here too, deliberately, and D5's
  "nothing changes for it but the fit" is amended to say so.
- **The outcome is the file's own:** `line-too-long`, in its section, with
  the line's number, its size in bytes and the share it had. No text is
  delivered for it.
- **It counts as not delivered.** No manifest row, no line range, no
  `deliveredItems` entry and no fingerprint for that file. The read's
  status follows D6 (`partial` beside a file that was read, `failed` alone).
- **A first line that fits, then a long one,** is an ordinary early stop:
  the lines before it are delivered, and the continuation names the long
  line. That next read then meets the rule above.
- **What the section offers** is decided by host code, and every hint must
  make progress:
  - **The line would fit a read of this file alone** (it is within
    `readBytes` and within half the room left): one hint, the plain
    one-path call at that `startLine`. Its share is then strictly larger.
  - **The line fits no read** (over `readBytes`, or over half the room
    left even alone): no hint at that line. The section says the line
    cannot be read in this turn, and, when the file has a later line,
    gives the one-path call at the *next* `startLine`, in words that say
    it passes over the long line.
- **The invariant, tested:** a continuation never repeats its own request.
  It names a later `startLine`, or the same `startLine` with fewer files.
- **The window ceiling is unchanged.** Nothing here reads past half the
  room left.

### D3. No window, one read's worth; a known window, no total

- **Window known:** no per-turn byte total (Okey, 2026-11-06). The fit and
  `callsPerTurn` are the bounds.
- **Window unknown:** nothing local checks the cost, so the turn's file
  reads together share one read's worth: `readBytesMulti` (D5). This
  mirrors recall's `turnTotal(window)`, which falls back to one read's
  `readCharacters`.
  - The counter lives on the turn's `WorkshopResourceCapability`, which is
    built per turn.
  - A read that the total limits says so, and why: "the size of your
    context window is unknown."
  - With nothing left, the read is refused, in words that say the total
    resets with the next writer message.

### D4. The grammar: repeated `<path>`

```xml
<prose-minion-tool-call name="resource.read">
  <group>manuscript</group>
  <path>alice-ch1.md</path>
  <path>alice-ch2.md</path>
  <path group="characters">white-rabbit.md</path>
</prose-minion-tool-call>
```

- **`<path>` repeats**, 1 to `readPaths` (**10**, as `readSessions`).
- **`<group>` stays required, once.** A `<path>` may carry `group="…"` for
  a file in another group, the way `<session turns="…">` carries its own
  turns. This uses the document parser's existing attribute policy.
- **`startLine` / `endLine` only beside exactly one `<path>`.** Otherwise:
  refused as `ambiguous-lines`.
- **New refusals** in `WorkshopCapabilityRejectionReason`:
  `ambiguous-lines`, `too-many-paths`, `duplicate-path`.
- **Duplicates are refused, never merged.** Two paths are one when group
  and case-folded path match. Recall refuses `duplicate-session` the same
  way.
  - **This is stricter than the lookup, on purpose** (PR #259).
    `findConfiguredResource` prefers an exact match and only then falls
    back to a case-folded one, so `Alice.md` and `alice.md` can both
    resolve today when both are configured. One multi-file read naming
    both is refused all the same: the persona reads them in two calls.
    It is the conservative rule, not the lookup's, and a test names the
    pair.
- **The request type** becomes
  `{ capability: 'resource.read'; files: { group; path }[]; startLine?; endLine? }`.
  No new operation: `WORKSHOP_CAPABILITY_OPERATIONS` and
  `workshopCapabilityFamily()` are unchanged.
- **A one-path call is today's call**, so a conversation whose contract
  froze before this slice keeps working.

### D5. The budget

New in `PROMPT_BUDGETS.workshopResource`:

| Key | Value | What |
|---|---|---|
| `readPaths` | 10 | files one read names |
| `readBytesMulti` | 256 KiB | a read naming two or more files, before the fit |
| `readMinimumBytes` | 2,048 | the least a file is given (D2) |

- **A one-path read keeps `readBytes` (64 KiB)** and its 400-line default.
  Two things change for it: the fit, and that it stops at a whole line
  (D2a).
- **Why 256 KiB.** A chapter is 20–40 KB, so six to ten chapters land
  whole. It is about 64,000 tokens, so on any model with less than about
  128,000 tokens free the window fit is the tighter bound, which is the
  point. It is also `searchFileBytes`, a size the host already reads.
- **Sharing.** Each file's need is its selected window's bytes (the
  400-line default from line 1). `allocateWorkshopReadShares` splits the
  limit; a short file leaves its room to the others.
- **Then the fit** (D2) runs over the whole read, shrinking the limit and
  sharing again at each render.

### D6. The result: one message, a section per file

- **Order named.** Each file has its own header: label, group, canonical
  configured path, `Lines: a-b of N`, then its fenced text
  (`neutralizeFence`, as today).
- **A limited read says so at its top,** with the room it had: "This read
  was limited to 41,200 bytes, half the room left in your context window."
- **Per-file outcomes.** Missing, ambiguous by case, unreadable, over
  `readSourceBytes`, or a `startLine` past the end: each is reported in
  that file's own section, in today's words. The others are still read.
  A line that does not fit its share is `line-too-long` (D2a).
- **Status:** `success` when every file was delivered, `partial` when at
  least one was and one was not, `failed` when none was.
- **Continuation.** A file that stopped early ends its section with a
  complete call on one line:
  `<prose-minion-tool-call name="resource.read"><group>manuscript</group><path>alice-ch2.md</path><startLine>212</startLine></prose-minion-tool-call>`
  - It always uses the plain form, with the file's own group.
  - Each hint decodes alone, exactly as written. Two written together are
    two calls and are refused; the instruction says so.
  - A one-path read cut by bytes or by the fit gets the same hint.
  - A hint is written only where the next read can deliver a line (D2a).
- **Metadata** (the card persists it): `files`, one row each of `group`,
  `path`, `outcome`, and when read `startLine`, `endLine`, `totalLines`,
  `bytes`, `truncated`; plus `limitedBy` and `limitBytes`. A one-path
  read keeps today's top-level fields too, so `resourceReadLineRange` and
  its callers are unchanged.

### D7. One call, one card, a row per file

- **One call** against `callsPerTurn`, however many files it names.
- **One capability card**, recorded by `recordCompletedTurn` as today.
  - `requestSummary`: the path for one file; for more,
    "3 files: alice-ch1.md, alice-ch2.md, +1 more".
  - The card's status is the read's (D6), and its metadata lists each file.
  - Publication and catch-up treat it as any resource card. No rule changes.
- **Delivered sources:** one manifest row per file delivered, each with
  its own `lineRange`, `configuredResource` and `sourceFingerprint`, all
  naming the one card (`cardTurnId`), so Read in still works per file.
  - The resource capability keeps the rows beside the result, as recall's
    `deliveredSources(result)` does. `WorkshopCapabilityResult.sourceFingerprint`,
    which holds one file's hash, is retired.
- **`deliveredItems`:** each delivered path.
- **Log:** `files=3; groups=manuscript,characters; lines=default`. A
  one-path read keeps its line.

### D8. Where the grammar is taught, and what pins it

- `createWorkshopCapabilityInstruction` teaches the repeated `<path>`, the
  `group` attribute, the lines rule, `readPaths`, `readBytesMulti`, that
  a read is fitted to half the room left, and the continuation line.
- Every number comes from `PROMPT_BUDGETS`. A new
  `__tests__/architecture/resourceReadPromptSync.test.ts` holds the text
  to the constants, and decodes each taught form and each hint the
  renderer emits through `WorkshopCapabilityXmlCodec`, as written (the
  rule `transcriptRecallPromptSync.test.ts` keeps for recall).
- `workshop-personas/file-edit-proposals.md` names `<group>` and `<path>`
  "as `resource.read` does". That stays true and is not edited.
- **Splits, done first, with no behavior change:**
  - `WorkshopResourceXmlCodec.ts`: the three resource validators and the
    family's field policy, beside recall's and memory's.
  - `WorkshopResourceRead.ts`: the read operation and its renderer.
  - `WorkshopResourceInstruction.ts`: the resource half of the instruction.

## Item B: decisions

### D9. One pill, two ways in

- **The pill** reads **Selected Text**. Its second line (and tooltip)
  names the file and lines: `alice-ch3.md · lines 40–44 · 62 words`. Cut,
  it adds "first 5,000 of 8,120 words".
- **By hand:** the command **Add Selection to Workshop Message** stages
  the pill for the next message. It is removable like any attachment.
- **By toggle:** "Include selected text", by the composer. While on, the
  current selection shows as the same pill, live, and rides with each
  message.
- `prose-minion.workshopSelection` (replaces the excerpt) is unchanged.
- Any text document (default 5). A selection inside the excerpt is sent
  as text (default 6). The excerpt never changes.

### D10. The port: the current selection, and when it changes

`EditorContext` gains two members. `getActiveSelection()` stays as it is,
with its remembered selection, for its four callers
(`TextSourceResolver` twice, `SourcesHandler`, `UIHandler`), whose paste
verification depends on it.

```ts
/** The last focused text editor's selection now, empty included. */
currentSelection(): ActiveSelectionInfo | undefined;
/** Fires when that selection, its text, or its editor may have changed. */
onDidChangeSelection(listener: () => void): PlatformDisposable;
```

- **`undefined`** means no text editor has had focus, or the last one's
  document has closed. A closed document counts as nothing.
- **Empty is reported** (`isEmpty: true`), so a deselect clears the pill.
- **`VsCodeEditorContext`** tracks the last focused editor (the
  `viewColumn` filter stays) and reads its selection live. It fires on a
  selection change, an active-editor change, an edit to that document, and
  that document closing.
- **The event is raw.** Throttling is the snapshot service's (D11), so it
  is tested with fake timers and no VS Code.

### D11. Snapshots by id: what you saw is what was sent

- **Owner:** `EditorSelectionSnapshots`, a core service
  (`application/services/workshop/selection/`), built only in
  `extension.ts` and placed in `CoreServices`. One per window.
- **A snapshot** is the selection at one moment: a host-minted opaque id
  (a UUID), the text cut to the bound (D15), display path, lines, word
  counts, and whether it was cut.
  - Capturing the same document, range and text as the newest snapshot
    returns that snapshot, so one selection has one id.
- **It keeps the newest 8.** A staged pill has already copied its text
  into the session, so a snapshot is needed only between the pill and the
  send. An evicted id is simply unknown.
- **The cache is the window's, not a room's** (PR #259). A selection is
  the editor's, so replacing the room does not empty the cache, and
  eviction is by count alone. What binds a pill to the room it was shown
  in is the send's `roomRevision` (D14), never an eviction that happens to
  fall right.
- **The webview gets metadata only:** id, display name, lines, word count,
  cut or not, and a preview of at most **120 characters**, one line.
- **The webview sends back only the id.** Text never travels webview → host.
- **Throttle:** at most one capture per **150 ms**, and the trailing edge
  always fires, so the last selection of a drag is the one shown.
- **Empty or `undefined`** is pushed as "nothing selected", with no id.

### D12. The command is a seed

- **Manifest:** `prose-minion.addSelectionToWorkshopMessage`, title "Add
  Selection to Workshop Message", category "Prose Minion", in
  `prose-minion.editorContext` at `2_open@2` (the Lightbox's two rows move
  to `@3`), `when: editorHasSelection`, with its `onCommand` activation
  event. `editorContextMenu.test.ts` gets its row for each editor state.
- **At the gesture**, before anything awaits, the command captures a
  snapshot. No selection: the usual warning, and nothing opens.
- **A new `WorkshopSeedKind`: `selected-text`.** Everything it joins:
  - the provider's `Record<WorkshopSeedKind, WorkshopSeedDelivery>` and a
    `WorkshopPanelProvider.stageSelectedText(snapshotId)`;
  - `WorkshopSelectedTextHandler` (`handlers/domain/workshop/`), a
    seventeenth composed route owner: holds the offer, and stages on accept;
  - `useWorkshopSelectedText`, composing `useWorkshopSeedClaim`;
  - an entry in `dispatchWorkshopSeedClaimResult`'s receivers;
  - the accept gate: the provider forwards
    `WORKSHOP_ACCEPT_SELECTED_TEXT` only while
    `WorkshopSeedDelivery.isGranted` holds for that delivery and receiver.
- **The offer carries the snapshot id only.** On accept the handler reads
  the snapshot and stages it with `addMessageAttachment`. Refusals are the
  seed's own: `busy`, `full`, `duplicate`; an unknown id is `busy` with a
  logged reason, and the command's notice says to try again.
- **The outcome** settles the command: a refusal or a failure shows one
  VS Code notice in the host's words.

### D13. The attachment kind: `selected-text`

- **Named apart on purpose.** `editor-selection` stays the excerpt's
  source kind only. The attachment kind, the seed kind and the meta field
  are `selected-text` / `selectedText`, so no grep or codec can confuse a
  message's pill with the room's excerpt.
- **Registry.** `WORKSHOP_MESSAGE_ATTACHMENT_KINDS` gains `selected-text`;
  `workshopMessageAttachmentKind` returns it when `selectedText` is set.
  The frame builder, the session codec and both commit checks
  (`WorkshopSessionService`, `WorkshopSessionStateV1Integrity`) read that
  registry already.
- **The snapshot meta** on `WorkshopMessageAttachmentSnapshot`:
  `selectedText?: { snapshotId; startLine; endLine }`. `label` is
  "Selected Text", `relativePath` the display path, `truncation` the cut.
- **The frame** is `buildWorkshopThreadArtifactFrame`'s, with:
  - `Name: Selected Text`, `Source: alice-ch3.md`, the head-slice line
    when cut;
  - the kind's preamble: "Text the writer selected in this file, at lines
    40–44, when the message was sent. It is the passage the message is
    about: not the writer's own words in this message, and not the room's
    excerpt." The lines come from the meta, so the preamble becomes a
    function of the attachment for this kind;
  - the body neutralized, like any other.
- **Session codec.** `selectedText` is an optional key on a pending
  attachment and on a turn's attachment reference
  (`WorkshopSessionStateV1Shape`, both lists), exact inside. Optional and
  additive: no `schemaVersion` bump, no normalization.
  - **Forward only** (ADR 2026-07-30, PR #259): an older build's strict
    reader rejects a session that holds the new key. The release notes
    say so; nothing here promises older builds read newly saved sessions.
- **Identity.** `WorkshopMessageAttachmentIdentity`: two attachments with
  `selectedText` are one source when their `snapshotId`s match. The host
  key is `selected-text:<snapshotId>`, rebuilt by
  `withWorkshopMessageAttachmentSourceKey`. So staging twice, Rewind's
  restage and hydration never double a pill.

### D14. The toggle: shown live, attached at the send

- **A UI preference.** `includeSelectedText` in
  `useWorkshopSelectedText`'s `persistedState`, off by default, per
  window. Never the session.
- **Subscribe.** While on, the webview posts
  `WORKSHOP_SELECTED_TEXT_WATCH { on: true }`; off, or on unmount,
  `{ on: false }`. The host pushes `WORKSHOP_SELECTED_TEXT_CURRENT` only
  to a watching panel, and only while it is visible. It pushes the current
  state once on subscribe and when the panel becomes visible again. Panel
  disposal drops the watch.
- **The live pill is not session state.** A selection change never
  dirties or saves the session.
- **The send.** `WorkshopSendMessagePayload` gains optional
  `selectedTextSnapshotId`: the id the pill showed. In the send's own
  mutation the host looks the snapshot up, stages it, then sends.
  - **The room it was shown in.** With a snapshot id the send also names
    `roomRevision`, the room the webview was showing when it drew the
    pill, as bookmark and pin requests already do. The room handler owns
    the check: inside the send's mutation it compares that revision with
    the live room's before it looks the snapshot up.
  - **Another room** (New, Open, Rewind or Branch landed between the pill
    and the send): the whole send is refused and the draft stays. A test
    delays the send across each of the four.
  - **Unknown id** (evicted by count): refused the same way.
  - **The words, for both:** "The selected text changed before this was
    sent. Check the pill and send again." The live selection is never
    sent unseen, and no paid call goes out without the lines the writer
    meant.
  - **The command's path** needs no revision of its own: seed delivery
    already settles a held offer when its receiver or room goes.
  - **No room** (7 attachments already): the live pill is drawn disabled,
    with the reason, before the send; a send that raced it is refused
    the same way.
  - **A send that rolls back** leaves the pill staged, as an ordinary
    pending attachment: it is the text the writer saw.
- **With a hand-added pill.** Hand-added pills are ordinary attachments,
  so a message may carry several selections. The live pill is not drawn,
  and not attached, when its snapshot is already staged; D11's "one
  selection, one id" makes that the same check as D13's identity. A
  different live selection rides beside them, visibly.
- **Rewind** restages the captured text as a pill, under its original
  snapshot id (default 7). The pill reads as any restaged pill does.

### D15. The bound

`PROMPT_BUDGETS.workshopSelectedText`:

| Key | Value |
|---|---|
| `words` | 5,000 |
| `characters` | 40,000 |
| `previewCharacters` | 120 |
| `snapshots` | 8 |
| `pushIntervalMs` | 150 |

- **5,000 words** is about one chapter, and half of what a file attached
  to a message may carry (`workshopThreadArtifacts.words`). With the
  toggle on it can ride on every message, so it is the smaller number.
- **Over the bound, it is cut at capture,** to the head slice, and the
  pill says so before the send. A whole-file selection is never refused.

### D16. Who sees it, export, recall, logs

- **Visibility.** The selection is a thread artifact of the writer's
  turn. It reaches whoever sees that message, by the room's own rule and
  delivery offsets. A direct tool message keeps it private, as today.
- **Export and recall.** `projectWorkshopTranscript` already includes an
  attachment as its label and omits its body. The decision for this kind:
  **include the label "Selected Text"; omit the text, the path and the
  lines.** No code changes; a test pins it for the projection, so export
  and recall both hold.
- **Logs** carry the kind, counts (words, cut or not) and ids. Never the
  text, a path or lines.

### D17. Contracts and the webview

- **`shared/types/messages/workshop/selectedText.ts`**, exported through
  the workshop barrel, with these `MessageType`s:

  | Type | Direction | Payload |
  |---|---|---|
  | `WORKSHOP_STAGE_SELECTED_TEXT` | host → host | `deliveryId`, `snapshotId` |
  | `WORKSHOP_SELECTED_TEXT_OFFERED` | host → webview | `deliveryId` |
  | `WORKSHOP_ACCEPT_SELECTED_TEXT` | webview → host | `deliveryId`, `receiver` |
  | `WORKSHOP_SELECTED_TEXT_STAGED` | host → webview | staged with `attachmentId`, or a `WorkshopSeedRefusal` |
  | `WORKSHOP_SELECTED_TEXT_WATCH` | webview → host | `on` |
  | `WORKSHOP_SELECTED_TEXT_CURRENT` | host → webview | the snapshot's metadata, or nothing selected |

- **Correlation.** The seed messages are correlated by `deliveryId` and
  receiver. The watch is a subscription with no answer; its push is a
  state, where the newest wins. The send's refusal rides the send's
  existing error path. So no new request id is needed.
- **`useWorkshopSelectedText`** (`hooks/domain/workshop/`), tripartite:
  state (the live snapshot's metadata, the toggle), actions (set the
  toggle, the seed's claim and accept), persistence
  (`includeSelectedText`).
- **Drawing.** `workshopAttachmentPills.ts` gains the kind's title and
  size note. The composer draws the toggle and the live pill from props;
  `WorkshopApp.tsx` (1,918 lines) only composes the hook.

## Slice plan

Two slices, two PRs into `epic/everyday-conveniences`, in either order.

| Slice | Branch | First commit |
|---|---|---|
| A | `…-multi-file-reads` | the D8 splits and the D1 move, with no behavior change |
| B | `…-selected-text` | the port (D10) and `EditorSelectionSnapshots` (D11) |

**Shared files; the second to merge takes the other's lines:**
`shared/constants/promptBudgets.ts`, `__tests__/architecture/boundaries.test.ts`,
`apps/vscode-extension/package.json` (B, and slices C–E),
`presentation/webview/WorkshopApp.tsx` (B, and slices D and E), `AGENTS.md`
(the epic's closing pass).

## Test plan

**A**
- The moved fit and shares tests pass unchanged but for names.
- `boundaries.test.ts`: `reads/` imports no recall, memory or session module.
- Codec: one path with lines; ten paths; eleven (`too-many-paths`); a
  repeat, and a case-folded repeat (`duplicate-path`); lines beside two
  paths (`ambiguous-lines`); a `group` attribute; a bad one.
- Read: order kept; a missing, an oversized and a good file in one read
  (`partial`, each in its section); every file bad (`failed`); fair
  shares with one short file.
- Fit: a read at the window's edge lands within half the room; a window
  too small for the minimum is refused with the room stated; an unknown
  window shares `readBytesMulti` across the turn's reads and says why.
- A line that does not fit (D2a):
  - a single line over 64 KiB, alone: `line-too-long`, `failed`, no row,
    no hint at that line, and the next-line hint when the file has one;
  - a line over its multi-file share but within `readBytes`: its section
    hints the one-path call at that line, and that call delivers it;
  - mixed: a good file beside each of the two (`partial`; the good file's
    row and fingerprint only);
  - a short first line, then a long one: the first is delivered, and the
    follow-up read meets the rule;
  - every hint a renderer writes differs from the request that made it.
- A case-distinct configured pair (`Alice.md`, `alice.md`) in one read is
  refused as `duplicate-path`; each resolves alone.
- `resourceReadPromptSync.test.ts` (D8).
- Persona capability: one call counted; one card; a manifest row per
  file with its own line range and fingerprint; Read in from each row.

**B**
- Adapter: a deselect reports empty; a closed document reports nothing;
  an edit inside the selection fires.
- Snapshots: the trailing edge fires; the same selection keeps its id;
  the ninth capture evicts the first; the cut is at the bound.
- **The witness:** with the toggle on, the pill shows snapshot 1; the
  selection changes; a send naming snapshot 1 attaches snapshot 1's text.
  A send naming an evicted id sends nothing and keeps the draft.
- **Room replacement:** a pill is shown, then New, Open, Rewind and Branch
  each land before the delayed send. Each send is refused on its
  `roomRevision`, with the snapshot still in the cache, and the new room
  gains no turn and no attachment.
- Seed: claim before stage; an accept without a grant stages nothing; a
  reloaded receiver; `full` and `duplicate`.
- Identity: the same snapshot twice; Rewind's restage beside a waiting
  copy; hydration.
- Frame: kind, preamble with lines, neutralized body, head-slice line.
- Codec: round trip with and without `selectedText`; an authentic
  session from before this slice still reads.
- Projection: label only. Excerpt: unchanged by a send.
- Watch: no push to a tab that is not watching, or not visible.
- `editorContextMenu.test.ts`: the new row.
- Logs: a test greps the handler's and the service's lines for the
  fixture's text and path.

## Open questions for Okey (work proceeds on the default)

- **Q1. The command for B.** Default: a new "Add Selection to Workshop
  Message"; "Send Selection to Workshop" keeps replacing the excerpt.
  The other reading of his words is that the existing command becomes
  the pill.
- **Q2. Several selections in one message.** Default: yes, by hand; the
  live pill hides only when its own snapshot is already staged. The
  stricter choice is one Selected Text pill a message.
- **Q3. A stale send.** Default: refuse the whole send and keep the
  draft. The other choice sends the message without the selection and
  says so.
- **Q4. The selection's bound.** Default: 5,000 words, cut with a note.
- **Q5. `group` on a `<path>`.** Default: allowed, so a chapter and a
  character sheet are one read.
- **Q6. The multi-file bound.** Default: 256 KiB before the fit, and the
  same number as the turn's total when the window is unknown. Today such
  a turn can carry about 960 KiB.
- **Q7. The kind's name.** Default: `selected-text`, apart from the
  excerpt's `editor-selection`.

## Consequences and risks

- **A persona reads a few chapters in one round-trip,** and a file read
  can no longer be the thing that fills the window by itself.
- **The engine backstop is still missing** (the note's part 2). Fits are
  estimates, and `memory.read`, full entries and analysis runs are
  unfitted, so `context-window-exceeded` is rarer, not gone. The note
  stays open for it.
- **Unknown-window turns read less** than today (Q6). That is the intent.
- **Old conversations keep the old instruction.** They can still read one
  path a call, and learn the continuation from the hints.
- **A hidden editor.** `currentSelection()` trusts the last focused
  editor after its tab is covered by the Workshop. If VS Code closes that
  document, the pill clears, which is safe but may surprise. The live
  pass checks a selection made, then the Workshop focused, in one group
  and in two.
- **The toggle sends text on every message** while a selection stands.
  The pill is always visible, and the bound is the smaller one, for that
  reason.
- **`CoreServices` grows by one service,** and the Workshop by one route
  owner and one seed kind. AGENTS.md's counts change at the epic's close.
