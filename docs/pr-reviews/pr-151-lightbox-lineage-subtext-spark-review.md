# PR Review — Lightbox Slice 4: Lineage, Subtext, Spark and Bring to Workshop

**Author:** okeylanders · **PR:** [#151](https://github.com/okeylanders/prose-minion-vscode/pull/151) (open, unmerged at review)
**Branches:** `epic/lightbox-slice-4-lineage` → `epic/lightbox`
**Reviewed implementation head:** `132aabbe1441b49cdb3f1518d52fda90233c9159`
**Verified base / merge-base:** `9e5363c398fd04ca578e207c47b429c59687ed8b` (merged PR #150)
**Scope:** 176 files · +7,825 / −530 · 8 commits
**Reviewed:** 2026-10-20 · **Reviewer:** Astra
**Mode:** independent source/spec review; deterministic production service/handler and lifecycle probes; exact rebuilt-production-bundle DOM/protocol witnesses; inspection of all 33 supplied PNGs; full tests, typechecks, build and baseline-normalized lint comparison

**Latest independent re-review:** `0e87c80163e901bf70af3a52ce8eca253fbd00af` (2026-10-20). **Current verdict: the original six findings are addressed; only nonblocking F-07 remains.** Original findings/history and author response are retained below. See [Independent re-review](#independent-re-review-2026-10-20) for current evidence and limits.

## Resolution ledger

Status legend: **Open** = recommended action · **Addressed** = independently verified fix · **Deferred** = explicitly accepted follow-up. An author-proposed deferral is not acceptance on the writer's behalf.

| ID | Severity | Finding | Status at `132aabbe` | Status at `0e87c801` |
| --- | --- | --- | --- | --- |
| F-01 | Medium / P2 | Rewind duplicates a Lightbox tile already pending and loses its duplicate identity | **Open** | **Addressed** |
| F-02 | Medium / P2 | Handoff bounding can remove a subtext pair's mandatory said line while reporting success | **Open** | **Addressed** |
| F-03 | Medium / P2 | Ordinary prefixed and comma-clause revision instructions pass the Spark validator | **Open** | **Addressed** |
| F-04 | Medium / P2 | A narration match can eclipse valid normalized dialogue and wrongly withhold Subtext | **Open** | **Addressed** |
| F-05 | Medium / P2 | An attachment reference bypasses the existing persisted widget-kind integrity check | **Open** | **Addressed** |
| F-06 | Low / P3 · nonblocking | A delayed old-receiver tile accept can mutate the session after delivery settled as reset | **Open — transport-ordering-qualified hardening** | **Addressed** |
| F-07 | Low / P3 · nonblocking | Carried Subtext inspector evidence can select equivalent narration instead of the selected said span | Not previously reported | **Open — nonblocking consistency follow-up** |

**Original verdict at `132aabbe`: Changes requested.** F-01 through F-05 are independently reproduced and should be addressed before this slice is considered clear. F-06 is a narrower, explicitly qualified recovery concern; native cross-reload IPC ordering has not been established. All ordinary repository gates pass, but they do not cover these counterexamples.

The original **PR #150 F-08 queue-stranding issue is addressed**: a new receiver releases a grant belonging to a vanished receiver, unclaimed offers are resent without extending their deadline, and subsequent deliveries proceed. F-06 concerns the new tile mutation message beyond that corrected claim/answer protocol, not continued failure of the original fix.

This report authorizes no merge or implementation change. It is not native VS Code acceptance, live-provider validation, writer-output acceptance, or clearance to skip the real-chapter output checkpoint before Slice 5 fixes a board file format.

## F-01 — Preserve tile identity when rewinding and restaging (P2)

**New feature location:** [WorkshopLightboxTileAttachment.ts:128–139](https://github.com/okeylanders/prose-minion-vscode/blob/132aabbe1441b49cdb3f1518d52fda90233c9159/packages/core/src/application/services/workshop/WorkshopLightboxTileAttachment.ts#L128-L139). The duplicate key is supplied only as `sourceUri`, even though the attachment also carries durable `lightboxTile.boardId` / `tileId` metadata.

**Existing integration points missed by the feature:** [WorkshopSessionRewind.ts:453–466](https://github.com/okeylanders/prose-minion-vscode/blob/132aabbe1441b49cdb3f1518d52fda90233c9159/packages/core/src/application/services/workshop/session/WorkshopSessionRewind.ts#L453-L466), [WorkshopSessionService.ts:669–680](https://github.com/okeylanders/prose-minion-vscode/blob/132aabbe1441b49cdb3f1518d52fda90233c9159/packages/core/src/application/services/workshop/WorkshopSessionService.ts#L669-L680).

**Natural reproduction:**

1. Bring tile A into Workshop and send it with a writer message.
2. Bring A again, leaving it pending for the next message. This is permitted after the first send clears the tray.
3. Rewind/edit the earlier writer message that carried A.
4. The rewind transform restores the sent attachment alongside the already-pending copy. Both have the same board and tile IDs, and the tray reports two copies of the same tile.
5. Sending the restored draft emits two `kind="lightbox-tile"` frames containing the identical claim.

The production-route → real session → rewind → hydrate → send witness demonstrates all five steps. The restored copy has no `sourceUri`: rewind reconstructs it from the public attachment snapshot plus its artifact body. Its `alreadyStaged` check only recognizes configured resources, so neither the new tile metadata nor its source-key scheme participates. Removing the newer copy does not repair the restored copy's identity; `addMessageAttachment` then accepts A again.

**Impact:** Normal editing duplicates a claimed one-shot attachment, inflates the tray and consumes attachment capacity and prompt space. The writer need not corrupt a file or race a reload.

**Requested change:** Deduplicate restored Lightbox attachments by their board/tile identity, preserve or reconstruct the source key, and make session admission recognize the durable tile identity. Cover rewind with the same tile already pending, rewind with no pending copy, remove/re-bring after rewind, and the resulting send frames. Preserve other attachment types' existing behavior.

**Pre-existing distinction:** Generic file attachments already lose a host-only `sourceUri` on this reconstruction path. This finding is the new Lightbox feature's reliance on that key, despite adding its own durable identity and claiming duplicate rejection across whole-room operations.

## F-02 — Do not hand off a said/meant pair after dropping its said quote (P2)

**Location:** [LightboxTileHandoff.ts:99–118](https://github.com/okeylanders/prose-minion-vscode/blob/132aabbe1441b49cdb3f1518d52fda90233c9159/packages/core/src/infrastructure/lightbox/LightboxTileHandoff.ts#L99-L118), particularly the independent length filter at line 112 and success at lines 116–118.

The handoff checks that `said` can be found, adds it first, then filters every quote to the 240-character handoff limit. It only requires the final list to be nonempty. Therefore an oversized said quote can disappear while a short context quote keeps the handoff valid.

**Reproduction through the production decoder, verifier, tile assembly, handoff, Workshop validator and attachment renderer:**

- The model supplies this valid 239-character said quote:

  > I have told you everything I remember about that night, from the sound of the rain against the windows to the empty chair beside the fire, and if there is anything else you want from me, you will have to ask someone who was actually there.

- The source contains the same dialogue hard-wrapped after `of`, `if`, and `someone`, with four spaces of continuation indentation after each newline. It remains one paragraph. Shared whitespace normalization correctly returns the source's 251-character verbatim span.
- The pair also cites the short context evidence `Her hands shook.` and the interpretation `She is asking him to stop.`
- Lightbox correctly draws the pair. Bring succeeds, but its only quote is `Her hands shook.`. Workshop accepts the payload and renders `Reading: Said / meant` plus that interpretation, with no spoken line and no `(said)` quote.

**Impact:** The interpretation crosses into Workshop without the speech it purports to interpret, despite the lens making that speech a mandatory anchor. This is not simply optional evidence being bounded, and no warning explains what was removed.

**Requested change:** Check the required said anchor after all bounding/deduplication. Keep it verbatim within the supported budget or refuse the handoff with an accurate reason. Do not silently truncate a quote. Add a normalized-source-growth case with surviving context evidence and a corresponding refusal/acceptance assertion at the Workshop boundary.

## F-03 — Reject ordinary command prefixes and comma-led instructions in Spark (P2)

**Location:** [LightboxSparkPhrasing.ts:55–88](https://github.com/okeylanders/prose-minion-vscode/blob/132aabbe1441b49cdb3f1518d52fda90233c9159/packages/core/src/infrastructure/lightbox/LightboxSparkPhrasing.ts#L55-L88), especially the first-token/two-token opener check at lines 81–88.

The current rule catches a bare imperative only when it begins one of the punctuation-delimited clauses. Polite/adverbial prefixes and comma-led commands evade it. All of these return no phrasing fault and become drawn Spark tiles through the production codec and assembler when given a valid supporting term and quote:

- `Please add a line where Alice notices the cold. What does she fear?`
- `The Rabbit is late, so add a deadline. Who is waiting?`
- `Before she falls, show the sister looking up. What might she notice?`
- `Now cut the jar from the scene. What remains on the shelves?`

Each ends in a question, but each also directly instructs the writer to revise the chapter. These are ordinary prose constructions, not obfuscated inputs. The fixed directive-phrase list does not cover them either.

**Impact:** The new lane can display explicit fixes while presenting them as offers that never instruct. The contract is enforced only for the narrow fixture grammar, not for these common variations.

**Requested change:** Extend the conservative validator to recognize command-bearing prefixes and clause forms, or otherwise constrain the accepted question grammar so these commands are withheld. Preserve genuine open questions. This is not a request to claim that a finite heuristic proves all semantic intent; explicitly test these ordinary counterexamples and state the remaining limit honestly.

## F-04 — Select dialogue evidence using the verifier's complete matching semantics (P2)

**Location:** [LightboxDialogueAnchor.ts:43–55](https://github.com/okeylanders/prose-minion-vscode/blob/132aabbe1441b49cdb3f1518d52fda90233c9159/packages/core/src/infrastructure/lightbox/LightboxDialogueAnchor.ts#L43-L55).

**Minimal paragraph:**

> I don't know was written all over his face. “I don’t know,” he said.

**Model said quote:** `I don't know`

The shared verifier first finds the exact straight-apostrophe narration. The dialogue anchor then searches for occurrences of only that returned raw text. It never considers the curly-apostrophe speech, despite that speech matching under the verifier's documented normalization. The resulting pair is withheld as not inside quoted dialogue. Remove the unrelated first sentence and the same model quote is accepted and returned as the actual curly-apostrophe speech.

Trying every occurrence of one selected raw span does not cover every equivalent quote match. The input is ordinary double-quoted dialogue; this is **not** the explicitly deferred single-quote convention.

**Impact:** Legitimate subtext disappears based on the typography of unrelated narration within the same paragraph, with an inaccurate refusal reason. Existing exact-duplicate occurrence tests do not cover differently formatted equivalents.

**Requested change:** Let dialogue selection constrain which verified source span is chosen, using the same verifier and normalization semantics. Avoid adding a second divergent matcher. Cover exact narration plus normalized speech, normalized occurrences with differing raw whitespace/typography, valid speech-only controls, and narration-only rejection; verify fresh assembly and stale carry remain consistent.

## F-05 — Keep widget provenance validation even when an attachment reference also exists (P2)

**Location:** [WorkshopSessionStateV1Integrity.ts:233–246](https://github.com/okeylanders/prose-minion-vscode/blob/132aabbe1441b49cdb3f1518d52fda90233c9159/packages/core/src/application/services/workshop/WorkshopSessionStateV1Integrity.ts#L233-L246), particularly the new `!attachmentReference` guard at line 241.

**Reproduction and baseline control:**

1. Create a valid Gesture Playground committed session through the production scripted-room helper, including its normal widget configuration and artifact linkage.
2. In its persisted state, add a `messageAttachments` reference to the same turn using the widget artifact's ID.
3. Change that artifact's kind to the different but recognized `widget:show-vs-tell`.
4. The head's complete session parser accepts the state. The exact, unmodified integrity validator from base `9e5363c` rejects the identical state with `wrong widget kind`.

With both `attachmentReference` and `widgetReference` true, the new attachment-kind check is skipped because of `!widgetReference`, and the old widget-kind check is skipped because of `!attachmentReference`. A second reference has disabled both provenance checks.

**Impact and scope:** A malformed/imported or disk-corrupted checkpoint bypasses an invariant previously enforced by the session codec and can retain a falsely typed artifact. No normal UI path that creates this malformed shape was found; this is validation regression coverage, not a claim that ordinary sends corrupt their own sessions.

**Requested change:** Enforce widget-kind consistency whenever the artifact is widget-owned, and reject ambiguous dual ownership if it is not an intentional contract. Retain the new attachment-kind validation. Add the overlapping-reference case plus ordinary file, valid Lightbox and valid widget controls.

## F-06 — Correlate the actual tile mutation with its receiver (P3, nonblocking)

**Locations:** [WorkshopLightboxTileHandler.ts:119–134](https://github.com/okeylanders/prose-minion-vscode/blob/132aabbe1441b49cdb3f1518d52fda90233c9159/packages/core/src/application/handlers/domain/workshop/WorkshopLightboxTileHandler.ts#L119-L134), [useWorkshopLightboxTiles.ts:82–88](https://github.com/okeylanders/prose-minion-vscode/blob/132aabbe1441b49cdb3f1518d52fda90233c9159/packages/core/src/presentation/webview/hooks/domain/workshop/useWorkshopLightboxTiles.ts#L82-L88).

`WORKSHOP_ACCEPT_LIGHTBOX_TILE` contains a delivery ID but no receiver. It reaches the tile handler without the provider's current-receiver/granted-delivery validation. The handler retains its offered tile across a same-panel receiver reset.

**Controlled asynchronous witness:**

1. A real provider/seed owner grants tile A to receiver R1. The real Workshop root reacts and posts ACCEPT; hold that outgoing message at the test transport boundary.
2. Replace the frontend realm on the same panel. R2 announces itself, and the real provider settles A as `{ opened: false, reason: 'reset' }`.
3. Release R1's queued ACCEPT. The tile handler still stages A in the session.
4. R2 has no matching grant and sends no completion answer. A's original outcome remains reset.

This is not a request to revoke a live grant: the provider has already settled that receiver's delivery as reset. The new mutation path is outside the documented late-old-receiver rejection.

**Qualification:** The witness deliberately permits delayed delivery across receiver generations. Native VS Code cross-reload IPC ordering was not established, and normal FIFO delivery of ACCEPT before the new announcement does not fail. No native reload or ordinary hide-induced message loss is claimed. For that reason this is nonblocking P3 hardening, not an unconditional user-path failure or a continuation of PR #150's original F-08.

**Suggested correction:** Carry receiver identity on ACCEPT and validate the currently granted delivery/receiver at the host mutation boundary. Cover reset-before-accept, late old acceptance, current granted acceptance, already-staged/lost-answer recovery, and the two kinds' independence. Plain room replacement after a still-valid grant was also probed; no explicit room-bound delivery contract was found, so that behavior is not listed as another finding.

## Architecture and preserved boundaries

- The new feature follows the existing host/core split. Lightbox requests carry IDs only; the host resolves the tile, checks source/quotes and bounds the payload. No new core `vscode` import was found.
- The tile route joins the session-operation gate; offer holding is direct and nonmutating, acceptance is a mutation. Busy/full/duplicate responses are explicit.
- `lightbox-tile` joins the closed thread-artifact kind registry. Ordinary send and retained-room delivery use the frame renderer and its model-reading trust line; reserved delimiters are neutralized.
- Transcript export and recall continue to use the common projection. The new tile projects its pill label only. No independent claim/quote/body leak was found.
- Spark dismissal is host-owned. A lifecycle probe confirms source switching, a failed unrelated lineage reread and stale carry retain dismissal; successful Spark reread resets dismissals and rejects the old tile IDs. Lineage friction and set-asides survive those transitions.
- Per-kind claim results are correctly isolated. A tile stages behind an already-open gravity sheet without changing it; simultaneous kinds settle independently; receiver reset releases both kinds and fresh deliveries work.
- New production modules remain below 500 lines; the largest new production module is the 280-line handoff route. Existing oversized composition/session files grow modestly, notably `WorkshopSessionService` 2,512 → 2,556 lines and `WorkshopApp` by six net lines. These are existing concentration risks, not new monolithic feature owners.
- New nested `lightboxTile` metadata is still shallow-copied by existing record helpers. A synthetic internal snapshot mutation can alias session state, but no current production mutator was found. This is a defensive-copy note, not an asserted user-facing defect.

## Verification and comparison

All full gates below ran independently on `132aabbe`, before reviewer probes were temporarily copied into the source tree. The temporary probes were removed; the only committed review change is this report.

| Check | Result |
| --- | --- |
| Full `npx jest --runInBand` | **383 suites / 5,412 tests / 2 snapshots passed**, 198.305 seconds |
| All three `npm run typecheck` stages | **Passed**: core, webview, extension |
| `npm run build`, including bundle sentinels | **Passed**; three existing webpack size/performance warnings |
| Full lint | **0 errors / 1,133 warnings**; normalized file/rule/message multiset identical to the independently verified PR #150 final-code baseline |
| Diff whitespace | **Passed** |
| Targeted story/phrasing/carry/lifecycle author suites | **6 suites / 116 tests passed**, included in the full-suite count |
| Targeted receiver author suites | **5 suites / 41 tests passed**, included in the full-suite count |
| Independent lens/lifecycle probes | **2 suites / 7 tests passed**, including assertions demonstrating F-02/F-03/F-04 rather than assertions of expected-safe behavior |
| Independent session/protocol probes | **2 suites / 5 probes passed**, nine inherited tests skipped; witnesses cover F-01/F-05/F-06 and explicitly labeled room-replacement/alias diagnostics |
| Exact production-bundle receiver protocol | **12 scenarios passed**, with real provider/seed owner, feature handlers/session and controlled transport |
| Exact production-bundle Lightbox/Workshop UI | **49 assertions passed**: pin/Escape, actual Model Browser overlay dismissal, host-confirmed dismiss/undo, ids-only Bring, repeated/foreign-result guards, tray removal/source changes, stale gating, pill removal and no unintended send/run/install |
| Ordinary Workshop parity against PR #150 | **9 checkpoints / 27 DOM, persistence and outbound-message comparisons passed**, excluding only the new receiver-announcement message; loading, empty/excerpt, key states, overlay reopen, sessions and restored UI |

The preceding independent base verification was **370 suites / 5,257 tests / 2 snapshots**, passing typechecks/build and **0 errors / 1,133 warnings**. This review reused that unchanged-code baseline and compared its retained lint output; it does not claim to have rerun all base suites again. Local runtime is **Node 24.19.0 / npm 11.9.0**; CI uses Node 18.

Both exact implementation-head CI runs succeeded: [PR CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39359928287) and [branch CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39359798519). The report-only publication commit requires its own exact-head CI check.

## Visual evidence and provenance

All **33 supplied PNGs** in [the Slice 4 evidence directory](evidence/lightbox-slice-4-visual/README.md) were individually inspected: eleven states each at 1440×1600, 1000×1600 and 500×1800. The independently rebuilt `webview.js` SHA-256 is:

`237331b625ee99c7e63f658246daaac518205825e097179cebee164bab3f831e`

It exactly matches the evidence README.

- Lineage's two stories, stance labels, paragraph strips and Persephone/Orpheus reasons are readable at all widths.
- Subtext's three said/meant cards wrap cleanly and retain the visible source-versus-reading distinction.
- Spark's three questions, support/addresses, dismissed two-card state, Undo wording and restored state are visible.
- Bring, bound status, explanatory text, Open Workshop and busy refusal are visible in their curated inspector views. The two-tile header tray fits all widths.
- Both Workshop pills and their remove glyphs are fully visible at 1440/1000. The 500-pixel Workshop clips most of its main column, including controls. The same clipping was independently inspected in PR #147's 500-pixel baseline, and the author has filed it as pre-existing debt. It is not a new finding here.

**Small evidence-harness correction:** [harness.js:254](evidence/lightbox-slice-4-visual/harness.js#L254) reads `.pm-lb-set-aside` for `lineageFoot`, but the actual component uses `.pm-lb-lineage-set-aside`. That facts field is always null. The PNGs themselves visibly establish the set-aside wording, so this does not invalidate that pixel result; correct the selector before reusing the harness.

**Limits:** The images are the author's Chromium captures, not new captures made during this review. The state builder uses real production services with a stub model, then manually plays the provider/webview handshake. The browser harness clicks controls and injects predetermined responses; the screenshots establish rendered states, not a connected end-to-end delivery proof. The separate independent protocol witnesses cover that layer with controlled transport. Generated `facts.json` / `errors.txt` are not committed; “no page errors” in the evidence README is the author's recorded result. Facts use DOM text/properties, and document-width overflow does not detect the acknowledged inner Workshop clipping.

JSDOM checks do not verify CSS layout, native focus/IPC behavior or Extension Development Host acceptance. No new Chromium capture, native VS Code run, live/billable provider call, user-machine access, writer-manuscript output assessment, code fix, PR comment/formal review, merge or deployment was performed. Public-domain and synthetic fixtures only.

## Original recommended next step

Address F-01 through F-05, retain targeted regressions for each, and rerun the full gates on the resulting implementation head. F-06's qualified recovery case is worth hardening alongside the receiver work, without describing the original F-08 as still broken. Keep author responses and subsequent independent resolution evidence appended to this report. After the slice is clear, the separate writer real-chapter output checkpoint remains necessary before Slice 5.

## Author response (2026-10-20)

All six findings and the harness nit are addressed on
`epic/lightbox-slice-4-lineage`, in three commits on top of this report
(`f93e1b0`):

- `a70d2a1`: Workshop side. F-01, F-05, F-06, the Workshop half of F-02,
  and the defensive copy of `lightboxTile` meta.
- `7241c83`: Lightbox side. F-02, F-03 and F-04.
- `971b95e`: evidence and notes. The harness selector, the evidence
  builder's accept, the rebuilt `states/chapter.json`, the Slice 4 notes and
  the agent setup.

The ledger statuses above are left for re-verification.

**How the regressions were checked.** Every new test was run against the
reviewed head's sources. The `packages/core/src`, `apps/vscode-extension/src`
and `packages/core/resources` trees came from `132aabb`, the tests from this
branch, and ts-jest's type diagnostics were off so that failures are
behavioral. 30 tests fail there: every regression test below, plus the
dialogue-index unit test, which was rewritten for the new index API. Sixteen
new tests pass there on purpose. They are the controls you asked for:

- F-04: the speech-only and narration-only cases;
- F-02: the in-budget pair;
- F-05: the valid widget, file and Lightbox artifacts;
- F-01: a second tile from the same board;
- F-03: the nine genuine-question controls.

### F-01: Rewind duplicates a pending tile

- **Root cause.** Two places decided duplicates, each in its own way.
  - `addMessageAttachment` compared only `sourceUri` and configured
    resources.
  - Rewind's `alreadyStaged` compared only configured resources.
  - A sent message's attachment reference never carries the host-private
    `sourceUri`, so a restaged tile came back without its key. Neither check
    looked at the tile's durable `lightboxTile.boardId`/`tileId`.
- **Fix** (`a70d2a1`).
  - New module, `WorkshopMessageAttachmentIdentity`, with one rule for "the
    same source": a tile by its board and tile ids, a configured resource by
    its group and path, and any other file by its source key. Staging and
    Rewind's restage both use it.
  - Rewind no longer restages a tile beside a copy already waiting. That copy
    stays, and the composer restore lists nothing for it, as configured
    resources already did. A tile restaged with nothing waiting gets its
    source key rebuilt from its ids (`withWorkshopMessageAttachmentSourceKey`).
  - Hydration, which every whole-room operation ends in (open, rewind,
    branch, rollback), repairs development checkpoints. The repairs are two
    logged normalizations in `WorkshopSessionCheckpointNormalization`:
    `dropped-duplicate-pending-lightbox-tiles` keeps a tile's first copy, and
    `restored-lightbox-tile-source-keys` re-keys an unkeyed tile.
  - `workshopLightboxTileSourceKey` moved into the identity module.
  - Files and configured resources behave exactly as before. A file
    restaged by Rewind still has no source key; that is the pre-existing
    distinction you noted, and it is unchanged.
- **Tests.** `session/WorkshopLightboxTileRewind.test.ts` uses the scripted
  room, sends tile A, saves the room as a named session and opens it through
  the real coordinator and store, then rewinds through `rewindTo`. It covers:
  - rewind with A pending: one A, the tray reads 1, the next send's frames
    hold one `kind="lightbox-tile"`, and bringing A again is a duplicate;
  - rewind with nothing pending: A is restored with its key and meta, and
    bringing it again is a duplicate;
  - remove and bring again after a rewind: never two copies;
  - a development checkpoint holding A twice, and one holding A unkeyed:
    both are repaired on open, and the log line names each normalization;
  - a control: another tile from the same board stages beside A.

  The existing file-attachment rewind tests are unchanged and pass.
  `ScriptedWorkshopRoom` gained an optional production attachment input,
  and gives each artifact the kind its shape has, as the room handler does.

### F-02: A subtext handoff can drop its said line

- **Root cause.** `prepareLightboxTileHandoff` checked that the said line was
  found, then bounded every quote to 240 characters, then required only a
  non-empty list. The Workshop validator accepted a said/meant tile with no
  said quote.
- **Fix** (`7241c83` for the handoff, `a70d2a1` for the validator).
  - The handoff checks the said line after all bounding and deduplication.
    A said line longer than a Workshop quote, as the chapter has it, refuses
    the pair with a new reason (`LIGHTBOX_TILE_HANDOFF_REFUSALS.saidTooLong`):
    "Its said line, as the chapter has it, is longer than a Workshop quote
    can carry, so the pair was not brought. Nothing was cut." No quote is
    ever cut.
  - `validateWorkshopLightboxTile` now requires a said/meant tile to lead
    with its said quote, and allows `said` only on that first quote.
- **Tests** (`LightboxTileHandoff.test.ts`). These run through the production
  decoder, verifier, assembly and handoff, then the Workshop validator and
  renderer.
  - Your case. The 239-character said quote against the same speech
    hard-wrapped after "of", "if" and "someone" with four-space
    continuations. The board draws the 251-character span (normalized), and
    the handoff refuses with `saidTooLong`.
  - Control, the unwrapped speech: Bring succeeds, the Workshop validator
    keeps `[{ said line, said: true }, "Her hands shook."]`, and the
    rendered body ends with `- ¶1 (said): “…”` then `- ¶1: “Her hands shook.”`.
  - At the Workshop boundary: a said/meant tile with no said quote, or with
    it second, is refused (`tile.quotes[0].said`).

  The route test's said/meant fixture now leads with its said line.

### F-03: Spark lets ordinary instructions through

- **Root cause.** The opener check looked only at the first one or two words
  of each punctuation-delimited clause. A softening word ("Please", "Now")
  or a set-up clause before a comma hid the command.
- **Fix** (`7241c83`).
  - Before the opener check, the clause drops leading softening words
    (`LIGHTBOX_SPARK_SOFTENERS`: please, kindly, now, so, then, and, but, or,
    yet, just, simply, also, first, next, finally, instead, perhaps, maybe,
    again, possibly) and leading marks.
  - A clause that does not open as a question is checked again after each
    of its commas. A question opens with an interrogative or an auxiliary
    (`LIGHTBOX_SPARK_QUESTION_OPENERS`); "when" and "where" count only before
    an auxiliary.
  - The prompt's rule says so too: "not even after a word like please, now
    or so, or after a set-up clause and a comma".
- **Tests.**
  - `LightboxSparkPhrasing.test.ts` adds your four counterexamples and three
    more ("Then, give…", "Maybe end…", "Alice, look back…").
  - Genuine-question controls, which all pass:
    - "Before she falls, what does she see on the shelves?"
    - "The Rabbit is late, so who is waiting at the other end?"
    - "Now that the jar is empty, what else might be?"
    - "Does she, like the Rabbit, keep checking the time?"
    - "When does she, at last, stop falling?"
    - "What if she stayed, and let the Rabbit go?"
    - "If the jar were full, would she take it?"
    - "So, who is waiting?"
    - "Perhaps the Rabbit, too, is late?"
  - All 24 earlier questions still pass.
  - `LightboxStoryReadings.test.ts` shows your four withheld through the
    production codec and assembly, with the other sparks still drawn.
- **The remaining limit, stated plainly** (module header, Slice 4 notes, and
  a test that pins each case). This is a word-list heuristic, not a parse.
  - These pass, though they instruct:
    - an unlisted verb ("Sprinkle in a storm. What changes?");
    - a command inside a clause that opens as a question ("What if you add
      a storm?", "Does she fall, and add a line?").
  - This is withheld, though it asks: a listed word opening a comma segment
    of a set-up clause ("She could stop, look and listen: …"). That is the
    safe failure.

### F-04: Narration can hide valid dialogue

- **Root cause.** The dialogue anchor took the verifier's first match and
  then tried only exact occurrences of that one raw span. It never saw
  other spans that are equivalent under the verifier's fold.
- **Fix** (`7241c83`).
  - `LightboxQuoteVerifier.verify` takes an optional span filter
    (`LightboxSpanFilter`). With one, the verifier returns the first span the
    filter accepts, among its exact matches and then its folded matches,
    under the same unit-boundary and fold-back rules.
  - The dialogue index is now built from the verifier, and has three
    methods:
    - `contains` places a span inside a dialogue span;
    - `verifySaid` finds a said line with the dialogue filter first, and
      falls back to the plain match only for the gate to refuse as
      narration;
    - `holds`, the gate's check, asks the verifier the same filtered
      question.
  - No text is matched outside the verifier. Fresh assembly
    (`GroupAssembly.claim`) and stale carry (`recheckQuote` for the said
    line) both use `verifySaid`.
- **Tests** (`LightboxStoryReadings.test.ts`, `LightboxCarryParity.test.ts`).
  - Your paragraph, exact narration plus normalized speech: the said line
    is the curly-apostrophe speech, with nothing withheld.
  - Normalized matches that differ in whitespace and typography
    (`I  don’t\nknow` in narration, `I don‘t   know` in speech): the speech
    is chosen.
  - Controls:
    - speech-only, exact and normalized, as before;
    - narration-only, still withheld as narration.
  - Fresh/carry parity: a reading of `"I don't know," he said.` carried
    onto your paragraph keeps the speech, and equals a fresh read there.

### F-05: Widget-kind integrity is bypassed

- **Root cause.** The new attachment-kind check was skipped when a widget
  reference existed, and the widget-kind check was skipped when an attachment
  reference existed. An artifact with both references skipped both checks.
- **Fix** (`a70d2a1`).
  - A committed artifact has one owner. Referenced both as a message
    attachment and as a widget artifact, it is refused ("…is referenced both
    as a message attachment and as a widget artifact").
  - A widget-owned artifact always has its widget's kind checked ("wrong
    widget kind", "no widget kind"). An attachment-owned artifact keeps the
    attachment-kind check.
  - `recordRoomThreadArtifacts` refuses the same dual reference on the live
    path.
- **Tests** (`WorkshopThreadArtifactProvenance.test.ts`). They use a Gesture
  Playground room built by the scripted room, edited as persisted JSON.
  - Your repro: an added attachment reference with the widget artifact's id,
    and kind `widget:show-vs-tell`. Refused.
  - The same dual reference with the widget's own kind. Refused.
  - Controls:
    - a valid widget artifact passes, and its wrong kind (another widget,
      or `lightbox-tile`) or missing kind is refused;
    - a file's artifact passes with no kind, and a given kind is refused;
    - a Lightbox tile's artifact passes as `lightbox-tile`, and a widget
      kind or none is refused.

### F-06 (P3): An old receiver can still stage a tile

- **Root cause.** `WORKSHOP_ACCEPT_LIGHTBOX_TILE` carried no receiver and
  reached the tile handler unchecked. The handler stages any accept that
  names the offer it holds, and it held the offer across a receiver reset.
- **Fix** (`a70d2a1`).
  - **Contract.** `WorkshopAcceptLightboxTilePayload` gains a required
    `receiver`, and `useWorkshopLightboxTiles` sends its seed receiver.
  - **Delivery.** `WorkshopSeedDelivery.isGranted(recipient, deliveryId,
    receiver)` is true only while that delivery is opening on that panel,
    claimed by that receiver, and the panel still has that receiver.
  - **Provider.** `WorkshopPanelProvider` forwards an accept to the panel's
    MessageHandler only while `isGranted` holds for the tile delivery.
    Otherwise it drops the accept and logs one line. This covers a late
    accept from a reset receiver and one for an offer never granted.
  - **Why the check holds at the mutation.** The path from the provider's
    check to the staging mutation is synchronous: router, the mutation
    gate's synchronous check, then the handler up to `addMessageAttachment`.
    So the grant checked is the one the tile stages under.
  - The tile handler is unchanged apart from its header. The offer it still
    holds after a reset is inert, because no accept for it can reach it, and
    the next offer replaces it.
  - The evidence builder plays the same check.
- **Tests.**
  - `WorkshopSeedDelivery.test.ts`:
    - `isGranted` is false while a delivery is only sent, false for another
      receiver, delivery or panel, and false after a reset, an answer or a
      close;
    - kind independence: two kinds with the same delivery id keep their
      grants apart.
  - `WorkshopLightboxTileDelivery.integration.test.tsx` uses the real
    provider, seed delivery, tile handler and session, the production
    Workshop app, and held transport both ways:
    - the accept names the receiver that holds the grant, and stages;
    - your witness: R1's accept is held, the webview reloads, A settles as
      `reset`, then R1's accept lands. Nothing stages, A stays `reset`, and
      the next tile stages;
    - a forged accept for an offer whose claim was never granted, even from
      the current receiver, stages nothing, and the offer still stages
      through its own claim.
  - The existing reset-before-accept and lost-answer recovery tests are
    unchanged and pass.

### Harness nit and the defensive copy

- `harness.js` reads `.pm-lb-lineage-set-aside` (`971b95e`). A rerun records
  the lineage foot in `facts.json`.
- The evidence was rerun at the new head:
  - `states/chapter.json` was rebuilt. The Spark prompt's new sentence moves
    each group's estimate by 21 input tokens; it still shows "est. $0.11".
  - The other states came out byte-identical.
  - All 33 screenshots rendered pixel-identical to the committed ones, so
    they were not replaced. No page errors.
- The record helpers (`cloneMessageAttachment`,
  `cloneMessageAttachmentInput`, `cloneMessageAttachmentSnapshot`, and
  through them `messageAttachmentSnapshot`) copy `lightboxTile`. A test
  shows that mutating the input, a staged result, a collected copy or a
  snapshot leaves the session's meta alone. It fails at `132aabb`.

### Verification at the new head

| Check | `132aabb` | New head |
| --- | --- | --- |
| Jest | 383 suites / 5,412 tests / 2 snapshots | 385 suites / 5,457 tests / 2 snapshots |
| `npm run typecheck` (core, webview, extension) | Passes | Passes |
| Lint | 0 errors / 1,133 warnings | 0 errors / 1,133 warnings, identical per file and rule |
| `npm run build` with `verify:bundle` | Passes | Passes |
| `git diff --check` | Passes | Passes |

- No live or billable provider call. Fixtures are public-domain or
  synthetic.
- New production module: `WorkshopMessageAttachmentIdentity.ts` (89 lines).
  `WorkshopSessionService` is 2,555 lines, one fewer than at `132aabb`.

## Independent re-review (2026-10-20)

**Reviewer:** Astra · **Re-reviewed head:** `0e87c80163e901bf70af3a52ce8eca253fbd00af` · **Base:** `9e5363c398fd04ca578e207c47b429c59687ed8b`.

Read the original report and the complete author response before reviewing the four commits after `f93e1b0`: Workshop fixes `a70d2a1`, Lightbox fixes `7241c83`, evidence/notes `971b95e`, and response `0e87c80`. The full PR is now 184 files, +9,306 / −585; this re-review concentrates on the fixes and their affected boundaries, with the unchanged original review retained above. Repository instructions, ADR D3/D7/D11/D12, Slice 4's updated spec, session codec evolution, and rewind/branch contracts informed the review.

**Current verdict: No blocking review findings remain. F-01 through F-06 are independently Addressed.** F-07 below is a narrow, nonblocking P3 consistency follow-up, not a reopening of F-04. This is code-review clearance within the evidence below, not native VS Code acceptance, a merge instruction, live-provider quality validation, writer acceptance, or permission to skip the real-chapter output checkpoint before Slice 5.

### Independently verified resolutions

| Finding | Disposition and evidence |
| --- | --- |
| **F-01** | **Addressed.** [One durable board/tile identity](https://github.com/okeylanders/prose-minion-vscode/blob/0e87c80163e901bf70af3a52ce8eca253fbd00af/packages/core/src/application/services/workshop/WorkshopMessageAttachmentIdentity.ts#L37-L59) is used by admission and [rewind restaging](https://github.com/okeylanders/prose-minion-vscode/blob/0e87c80163e901bf70af3a52ce8eca253fbd00af/packages/core/src/application/services/workshop/session/WorkshopSessionRewind.ts#L457-L473). Independent real-coordinator rewind tests cover A already pending and A absent, then actually publish/commit the next send: exactly one Lightbox frame and an empty tray afterward. Re-bring with a deliberately different source key is still duplicate. Branch preserves the source named file and one keyed tile; an injected write failure rolls back state/counters/metadata, and retry succeeds. Normalization is idempotent, keeps the first body, preserves distinct-board tiles and ID counters, leaves ordinary files unchanged, and logs both repairs on actual open. A counter of 91 produces `ta-92`, not a reused ID. |
| **F-02** | **Addressed.** [The post-bound anchor check](https://github.com/okeylanders/prose-minion-vscode/blob/0e87c80163e901bf70af3a52ce8eca253fbd00af/packages/core/src/infrastructure/lightbox/LightboxTileHandoff.ts#L104-L126) refuses an oversized said line, and [Workshop requires the leading said quote](https://github.com/okeylanders/prose-minion-vscode/blob/0e87c80163e901bf70af3a52ce8eca253fbd00af/packages/core/src/application/services/workshop/WorkshopLightboxTileAttachment.ts#L63-L89). Independent normalized-source cases span 239, 240 and 241+ characters, with short context still present. In-budget pairs retain verbatim said text; over-budget pairs return `saidTooLong`, not success. Missing/second/duplicate/foreign-kind said flags are rejected at the receiving boundary. |
| **F-03** | **Addressed for the reported conservative-validator defect.** All four original command counterexamples plus five additional prefixed/comma command forms are withheld; eight additional genuine-question controls survive. The production codec/assembly path is exercised, not just the helper. The fix's explicit limits are retained: unlisted verbs and commands embedded in question-opening clauses can pass, while some declarative setup clauses can be over-withheld. Tests demonstrate those limits. This closes the ordinary-prefix/comma loopholes reported in F-03; it does **not** claim universal semantic intent classification, or establish model-output quality from fixtures. |
| **F-04** | **Addressed for narration eclipsing the said anchor.** [Filtered matching stays inside the shared verifier](https://github.com/okeylanders/prose-minion-vscode/blob/0e87c80163e901bf70af3a52ce8eca253fbd00af/packages/core/src/infrastructure/lightbox/LightboxQuoteVerifier.ts#L95-L157), preserving exact-before-normalized order, normalization-unit boundaries and fold-back validation. Independent probes cover apostrophe, whitespace, dash, NFKC and supplementary-character variants, multiple equivalent matches, explicit filter rejection, speech-only/narration-only controls, and repeated carry. The actual spoken said line survives. The full carried evidence list still has the narrower F-07 inconsistency below. |
| **F-05** | **Addressed.** [Persisted dual ownership is rejected](https://github.com/okeylanders/prose-minion-vscode/blob/0e87c80163e901bf70af3a52ce8eca253fbd00af/packages/core/src/application/services/workshop/WorkshopSessionStateV1Integrity.ts#L222-L256) for correct/different widget kinds, Lightbox kind and absent kind. The live recording path rejects a correct-kind dual reference atomically, even after a valid file artifact earlier in the batch. Separate file/widget owners in one turn remain valid; correcting a wrong attachment kind permits retry. Parsing does not mutate input. Baseline controls matter: absent persisted widget kinds and wrong/absent live widget kinds were already rejected before these fixes and are not counted as newly fixed defects. |
| **F-06** | **Addressed, retaining the original transport qualification.** The actual rebuilt Workshop bundle includes the receiver in ACCEPT, and the real provider checks [the current tile grant](https://github.com/okeylanders/prose-minion-vscode/blob/0e87c80163e901bf70af3a52ce8eca253fbd00af/apps/vscode-extension/src/application/providers/WorkshopPanelProvider.ts#L192-L200) before routing. The held R1 ACCEPT delivered after R2 reset stages nothing; the outcome remains reset and the next tile works. Missing/wrong receiver, wrong delivery, never-granted and settled-replay accepts do not consume the valid offer; a gravity grant cannot authorize tile staging. Repeating the current receiver and hiding after dispatch preserve valid acceptance. Source review confirms no await before staging along provider → MessageHandler → router → production mutation gate → tile handler; the controlled callback witness observes staging before return. These checks do not establish native cross-reload IPC ordering. |

**Defensive-copy note resolved.** Mutating exported pending state, hydration input, sent-reference input, returned turns, ledger reads or snapshots no longer aliases stored `lightboxTile` metadata. Its scalar fields need only the new one-level copy; existing recursive turn cloning still applies. Ordinary file/configured-resource identity controls retain their prior behavior. No new core `vscode` import or feature-owner monolith was introduced; the new identity module is 89 lines. The mutation/session boundary, one artifact-kind registry, frame neutralization and label-only transcript projection remain intact.

### F-07 — Keep carried Subtext evidence aligned with its selected said span (P3, nonblocking)

**Locations:** [LightboxStaleReadings.ts:173–188](https://github.com/okeylanders/prose-minion-vscode/blob/0e87c80163e901bf70af3a52ce8eca253fbd00af/packages/core/src/infrastructure/lightbox/LightboxStaleReadings.ts#L173-L188), [219–220](https://github.com/okeylanders/prose-minion-vscode/blob/0e87c80163e901bf70af3a52ce8eca253fbd00af/packages/core/src/infrastructure/lightbox/LightboxStaleReadings.ts#L219-L220). Presentation witness: [useLightboxInspector.ts:231–240](https://github.com/okeylanders/prose-minion-vscode/blob/0e87c80163e901bf70af3a52ce8eca253fbd00af/packages/core/src/presentation/webview/hooks/domain/lightbox/controllers/useLightboxInspector.ts#L231-L240).

1. Read `"I don't know," she said.` as Subtext with said quote `I don't know` and no extra context quote.
2. Change the same paragraph to `I don't know was written all over her face. “I don’t know,” she said.` and carry the reading.
3. The card's `said` is now correctly `I don’t know` with normalized matching. Its `evidence[0]`, however, is `I don't know` from narration with exact matching, because the carry loop rechecks evidence without the dialogue filter.
4. The production inspector projection therefore shows the narration typography as “found verbatim”. A fresh assembly of the same paragraph leads its evidence with the selected speech instead.

**Impact is limited:** the words and paragraph agree; the selected said line is real speech; no source quote is fabricated. The tile is explicitly stale and cannot be brought until reread, so this is not an invalid Workshop handoff. It is a visible card/inspector and fresh/carry evidence inconsistency. The author's parity regression checks said values and tile outcomes, not the complete evidence projection, which explains why it passes.

**Recommended follow-up:** For a carried Subtext pair, make the newly selected said quote lead the evidence list and deduplicate the remainder just as fresh assembly does. Add an assertion on the complete evidence list and inspector projection. This can be handled as a nonblocking consistency cleanup; F-04's incorrect withholding is fixed.

A separate diagnostic in which speech moves to another paragraph but nearer narration remains reproduces on both `132aabb` and the new head. That nearest-match carry behavior is pre-existing, not a new regression attributed to these fixes.

### Fresh verification and counterfactuals

The following commands were run in an isolated checkout of `0e87c801`, with no tracked implementation edits. Local runtime: Node `v24.19.0`, npm `11.9.0`. The repository's CI separately uses Node 18. Independent scratch suites were outside the repository and are excluded from the 385-suite repository count.

| Check | Independently observed result |
| --- | --- |
| `npx jest --runInBand` | **385 suites / 5,457 tests / 2 snapshots passed**, 187.22 seconds |
| `npm run typecheck` | **All three stages passed**: core, webview, extension |
| `npm run build`, including `verify:bundle` | **Passed**; three webpack size/performance warnings, as before |
| `npx eslint packages apps --ext ts,tsx --format json` | **0 errors / 1,133 warnings**; normalized file/rule/severity/message multiset exactly matches saved independently-run `132aabb` and base `9e5363c` lint evidence |
| `git diff --check 9e5363c..0e87c801` | **Passed** |
| Independent lens/boundary suite | **52/52 passed**; same applicable probes against archived exact `132aabb` production sources: **25 fail / 20 pass**; seven probes for the newly introduced filter API excluded from the old-source run |
| Independent carry diagnostics | **2/2 observed-behavior assertions passed**: F-07 witness and explicitly pre-existing moved-speech control. These assertions demonstrate the residual behavior, not a safe-behavior pass |
| Independent session/coordinator/store/frame suite | **16/16 passed**; identical probes against archived `132aabb` production sources: **11 behavioral failures / 5 passing controls**, excluding error-wording-only differences |
| Rebuilt-production-bundle seed protocol | **17 scenarios passed**: eight original receiver/deadline controls, four cross-kind/recovery controls, five added accept-boundary cases |
| Rebuilt-production-bundle Lightbox/Workshop DOM | **49 assertions passed**, rerun: pin/Escape, overlay dismissal, host-confirmed dismiss/undo, IDs-only Bring, repeated/foreign-result guards, tray changes, stale gating, pill removal, and no unintended send/run/install |
| Implementation-head GitHub CI | Both exact `0e87c801` jobs passed all install/typecheck/test/lint/build steps: [PR verify](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39366694878/job/118445048895), [branch verify](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39366688516/job/118445029195) |

The counterfactual runs use the same new independent assertions with production imports redirected to a clean archive of the old source. Type diagnostics were disabled where old/new APIs differ; those behavioral comparisons do not replace the successful production typechecks. The session run keeps the current scripted-room harness while all production aliases target the old code. Of the 25 lens counterfactual failures, 24 demonstrate corrected behavior (eight F-02, seven F-04, nine Spark command cases); one pins the newly documented conservative Spark false positive, not another fixed defect. The lens comparison excludes the seven new-filter-API cases rather than counting missing APIs as behavioral failures. No author assertion set was simply relabeled as independent coverage.

### Visual provenance and limits

- All **33 supplied PNGs are unchanged Git blobs** from the original reviewed evidence. The original report's inspection of all 33 is retained as historical evidence, not claimed as a fresh capture. This re-review directly reinspected five representative supplied images: Subtext at 1000 px, Lineage at 1000 px, Bound at 1440 px, dismissed Spark at 500 px, and Workshop composer at 500 px. The known narrow Workshop clipping remains visible and already tracked; no CSS or component markup changed in the fix series.
- A fresh production build with dependencies materialized in this checkout yields `webview.js` SHA-256 **`dc53b9eaaf02eec6c7ac6e9225c9a6b5abb94445956745c130d68ef1d2b691a4`**, exactly the author's post-fix evidence hash. All 17 protocol scenarios and 49 DOM assertions above ran again against that exact bundle. These run the real frontend bundle, real provider/seed owner and feature handlers/session under controlled transport/routing seams; they are not a native extension-host run.
- The harness selector is now `.pm-lb-lineage-set-aside`; the independent DOM replay finds its set-aside text. The updated recorded chapter state and harness/host-builder diff were reviewed. Full evidence state generation was **not** rerun here. The author's “33 pixel-identical” and “no page errors” capture claims remain attributed to the author, not converted into independent Chromium results.
- Fresh Chromium was **not rerun** in this re-review after the prior same-environment review hit sandbox-denied socket creation and a `bwrap` failure on the escalated launch. No access denial was bypassed. JSDOM's unsupported-CSS parsing warnings are filtered from its runtime-error check; it establishes DOM/protocol behavior, not layout, clipping, visual pixels, native focus or native IPC.
- No live or billable provider calls, user-computer access, native VS Code acceptance, writer-manuscript assessment, implementation changes, PR comments/formal reviews, merges or deployments were performed. Public-domain/synthetic fixtures only. Exact report-only remote commit and its CI are verified separately after publication; the implementation under review remains `0e87c801`.

### Next step

The original five blocking issues and qualified receiver hardening are clear. Keep F-07 as a nonblocking consistency follow-up. Native VS Code acceptance and the writer's real-chapter output checkpoint remain open; neither supplied screenshots, fixtures nor green CI constitutes that acceptance. In particular, do not freeze Slice 5's board file format on the strength of this review alone.

## Author note (2026-10-20): F-07

F-07 is fixed in `218656b` on `epic/lightbox-slice-4-followups`, branched from
`epic/lightbox` at `1532a46` (PR #151 merged). The ledger status is left for
re-verification.

- **Root cause.** Stale carry re-found a pair's said line with the dialogue
  filter, but re-checked its evidence, said line included, without the
  filter. So `evidence[0]` could be the narration's exact copy.
- **Fix.** One helper, `lightboxSaidLedEvidence` (with `lightboxSameQuote`)
  in `LightboxDialogueAnchor`, builds a pair's evidence for fresh assembly
  and stale carry alike: the said line as found, then every other found
  quote once, without the said line again. Carry checks the pair's other
  quotes on their own, then leads with the said line it found. A said line
  that is gone still counts as the first lost quote.
- **Tests** (`LightboxCarryParity.test.ts`):
  - your reproduction, asserting the complete evidence list (`[“I don’t
    know”, normalized]`) and the inspector projection ("found with
    typography folded"), equal to a fresh read;
  - context quotes kept after the said line, with the speech's copy
    dropped as a fresh read drops it, on the card and in the inspector;
  - a gone said line as the first lost quote (a control);
  - a fresh/carry parity sweep over every drawn tile's full evidence, said
    line and witness, on the worked examples, their four edits, and the
    narration-first edit.

  The three regression tests fail at `1532a46`. The control and the sweep's
  worked-example part pass there; its narration-first case fails.
- **The moved-speech diagnostic** stays as it is, as you noted. It is
  recorded as Low tech debt:
  `.todo/tech-debt/2026-10-20-lightbox-carried-said-line-moved-speech.md`.
