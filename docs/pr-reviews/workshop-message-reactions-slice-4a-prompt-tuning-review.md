# PR #250 Review: Message Reactions Slice 4a (prompt tuning)

**PR:** #250, `epic/workshop-message-reactions-slice-4a-prompt-tuning` → `epic/workshop-message-reactions`
**Reviewed head:** `ee87a1b8` (base `4fb4bd97`). Merged as `f6a0ccb2`.
**Spec:** ADR 2026-11-07, addendum 2026-11-10 (Okey's four decisions; Q7 superseded).
**Reviewer:** the epic's coordinator.

## Scope

Most of this slice is prompt text, which Okey reads directly; the live pass is the real test of it. The code change is small:

- `reactions/WorkshopReactionInvite.ts` (pure);
- `WorkshopRoomHandler.reactionInvite`, wired into the host, guest and join builders;
- one reserved tag;
- per-level frequency paths in `workshopPersonaPromptPaths`.

## Checks

- **Where the invite rides.** It takes its target from `personaReplyReactionTarget`, the same rule that decides where a reaction trailer can land. The invite and the trailer therefore cannot disagree about which runs may react.
- **Setting off.** The invite is absent, and so are the permission and frequency files.
- **No literal reaction tag.** The invite does not write `<prose-minion-reaction>`. Its own tag is reserved, so writer text cannot forge it.
- **History.** Earlier retained messages stay byte-identical (scripted-room test, reactions on).

## Verification (coordinator's own run at `ee87a1b8`)

- Typecheck clean; lint 0 errors.
- `npx jest`: 817 suites, 11,456 tests, all passing.
- CI green.

## Findings

None blocking.

- **Watch in the live pass:** whether the invite line's wording ("one prose-minion-reaction trailer") makes models write the tag correctly. The system prompt shows the tag in full.
