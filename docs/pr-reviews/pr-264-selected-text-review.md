# PR #264 re-review: Selected Text

Reviewed code: `e8839f9626b9fba61e61ef6066f79cccb9a0b8f8`
Fix commit: `84e7670`
Verdict: **Review clear. Both prior P2 findings are resolved; no new blocking finding identified.** This supersedes the initial changes-requested verdict below. No merge performed.

## Fix verification

- **Draft preservation:** host-restored text now uses `keepDraft`; an empty composer receives it unchanged, while existing newer writing is preserved after the returned text with a blank-line separator. Starter seeds retain their original replacement behavior. The exact prior reproduction now checks that both strings survive, and repeated renders of the same seed do not duplicate them.
- **Room binding:** the live selection records its displayed room revision. Every render filters out another room's pill; replacement drops it and asks the host for a fresh selection push. The send carries the recorded revision rather than the newest room revision. The hook, send payload, host's four replacement paths, and webview-to-host integration tests cover stale sends and re-display in the new room.

## Verification at the reviewed head

- Focused Jest: **8 suites, 106 tests passed**.
- `npm run typecheck`: passed (exit 0).
- `npm run build`: passed (exit 0), including production webpack and bundle verification. This successful rerun supersedes the previous local exit-137 limitation.
- `npm run lint`: passed (exit 0), **0 errors / 1,172 warnings**.
- GitHub CI run **43638898619**: completed successfully at `e8839f96`.
- No full-suite local rerun in this re-review. Real VS Code focus/selection, panel visibility, native menus, and live model calls remain unverified.
- The report-only publication creates a newer branch head; its CI is separate from the code-head CI above.

## Historical initial review (superseded)


Reviewed code: `5e39800149ddcf0a301a71c613696b2582bfe6c4`
Base: `76280a5054fc4ca8a0f6b6c2d02174b3b7472e13`
Verdict: **Changes requested. Two P2 correctness issues remain.** No merge performed.

## Findings

### P2: Preserve edits made while a selected-text send is being refused

Location: `packages/core/src/application/handlers/domain/workshop/WorkshopRoomHandler.ts:579–583`

The newly added selection-refusal branch restores the submitted text via the existing uncorrelated draft-seed message. The composer clears immediately on Enter and stays editable while this refusal is in transit. If the writer types another draft before the reply arrives, `handleComposerDraftRestored` seeds the old prompt and the composer's draftSeed effect unconditionally replaces the new writing. This loses user text on an ordinary stale/evicted-snapshot, full-attachment, or room-change refusal. Disclosure in the PR does not make the loss safe.

Reproduction (confirmed with a temporary React test): send “original refused prompt”; type “newer unsent writing”; deliver the refusal's draftSeed; textarea becomes “original refused prompt”, and newer writing disappears. The temporary test was removed.

Keep the submitted draft until acknowledgment, or correlate the send with a draft revision and restore only when no newer edit exists. Preserve both drafts if edits occurred. Add a delayed-refusal regression test.

### P2: Bind a live selection to its displayed room, not the latest room at send time

Location: `packages/core/src/presentation/webview/hooks/domain/workshop/useWorkshopRoom.ts:539–547`

The send callback stamps the current `roomRevision`, while `useWorkshopSelectedText` keeps its snapshot without any associated room revision or replacement invalidation. Show snapshot S in room A, let New/Open/Rewind/Branch finish and update the UI to B, then send with S still selected: the payload names B, so the host comparison succeeds and stages the old pill in B. Only replacement after the payload was formed is rejected.

ADR D14 explicitly requires refusal when replacement lands between the pill and send, and D11 says this binding is not supplied by cache eviction. The current host-side replacement tests exercise a stale payload revision; they do not test the hook's re-stamping after the UI processes replacement. This deviation is disclosed, but weakens the agreed room-boundary safeguard. Store the displayed pill's room revision and send it unchanged, or explicitly invalidate/re-confirm selection across replacement. Add a UI-to-host replacement test rather than only manually passing an old revision.

## Validation

- Eight focused host/adapter/UI suites: **95 tests passed**.
- Temporary draft-overwrite reproduction: **1 test passed**, confirming the unwanted behavior; removed afterward.
- `npm run typecheck`: passed.
- `npm run build`: **not verified locally**. Webpack was killed with exit 137 while the broader Jest run was active. The initial report incorrectly treated the surrounding shell's successful lint exit as build success; this line corrects that claim. No source-level build error was established.
- `npm run lint`: passed, **0 errors / 1,172 warnings**.
- GitHub CI run **43633091221**: completed successfully at the reviewed head.
- A broader local Jest run was still in progress when this report was published; no full-suite local claim is made.

Snapshot cache/identity, bounds, granted seed delivery, deduplication, persistence/hydration, rewind metadata, and initial/catch-up frame paths were inspected with an independent host-side review. No additional concrete blocker was found.

Not validated: real VS Code focus/selection and panel visibility behavior, drawn native menus, or live model calls. Unit tests use mocks. Green checks do not cover the two boundary cases above.
