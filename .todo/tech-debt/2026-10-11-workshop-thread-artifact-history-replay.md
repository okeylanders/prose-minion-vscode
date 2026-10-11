# Thread Artifacts Replay on Every Later Turn

**Date Identified**: 2026-10-11
**Reviewed**: 2026-10-11
**Status**: Identified
**Priority**: Medium
**Estimated Effort**: Small for the wording and test pin; the real fix belongs to
the planned [Workshop Context Compaction epic](../epics/epic-workshop-context-compaction-2026-07-21/README.md).

## Problem

A `<thread-artifact>` frame is attached to exactly one writer turn. Other
participants receive it once through room catch-up. Both statements are true,
and tests pin them.

What the docs leave out is what happens after that. Each persona's retained
provider history stores the full user message that carried the frame,
verbatim. Every later request to that persona replays its history, so the frame
goes back to the model **on every later turn** until something removes it.
Nothing does today: "tombstone surgery" by `ta-N` id appears only as future
work.

This means "rides exactly one turn and is never re-shipped" (Sprint 05,
*Payload, ceiling, and commit*) is accurate only as **"never re-attached"**. A
reader can easily take it to mean "sent once".

### Evidence

- **What the history stores.** `AgentRunEngine` builds
  `pendingMessages = [{ role: 'user', content: userMessage }]` from the full
  model message, frames included, and commits it with
  `conversationManager.addMessages`. Only the assistant reply goes through a
  sanitizer.
- **Replay on the next request.** The next request reads the stored messages
  back through `getMessages` (`ConversationManager`), so the stored user
  message, with its frame, is sent again.
- **Catch-up skips the addressed persona.** `WorkshopRoomAudience` skips the
  addressed persona because the turn is "already materialized in this
  participant's own retained conversation". Catch-up frames delivered to other
  personas land in their histories the same way.
- **The pinned excerpt behaves the same way.** It is sent once as
  `<pinned-excerpt>` and again only on revision, and both copies stay in
  retained history.
- **No test covers the replay.**
  - `ShowVsTellOneShotCommit.test.ts` ("rides exactly one turn … never
    re-shipped") checks only that a later turn attaches no new artifact.
  - No test pins what retained history contains.

### Size of the replay (estimates)

The figures assume about 4 characters, or about 0.75 words, per token. A frame
of **T** tokens committed now costs **T × N × P** input tokens over the next
**N** turns to each of **P** personas that hold it.

| What rides the history | Typical size | Ceiling | Source |
|---|---|---|---|
| Show vs. Tell commit | ~150–300 tokens (2–3 kept lines, few warnings, plus ~200 characters of envelope) | ~1,900 tokens: 600-character body + 8 × 4 warning lines of ≤ ~210 characters each | `showVsTellArtifactCharacters: 600` |
| Creative Variations commit | ~1,000–2,500 tokens | ~5,000 tokens | `creativeArtifactCharacters: 20_000` |
| Writer message attachment | depends on the file | ~13,000 tokens each (10,000-word head slice); up to 7 per message, ~91,000 tokens | `workshopThreadArtifacts: { itemsPerMessage: 7, words: 10_000 }` |
| Pinned excerpt | depends on the excerpt | up to 25,000 words / 300,000 characters | `personaExcerpt` |

Worked examples, for 30 later turns:

| Frame | 1 persona | 3 personas (Host + 2 guests) |
|---|---|---|
| Typical Show vs. Tell commit (~250 tokens) | ~7,500 tokens | ~22,500 tokens |
| Full-size Creative Variations commit (~5,000 tokens) | ~150,000 tokens | ~450,000 tokens |
| One 10,000-word attachment (~13,000 tokens) | ~390,000 tokens | ~1.2 million tokens |

Show vs. Tell's own frame is small, so the widget is not the problem. The
pattern is: attachments and large widget artifacts dominate.

Provider prompt caching (see the cache-usage epic) bills the replayed prefix at
a discounted cache-read rate where the provider supports it, and only while the
cache is warm. An idle gap longer than the provider's cache TTL pays full input
price again. Caching does **not** relieve context-window pressure: every frame
stays in the window for as long as it is held.

## Recommendation

1. **Fix the wording now.** Wherever a current doc says a frame "rides exactly
   one turn" or is "never re-shipped", say that it is **attached once and stays
   in each persona's retained history until released**. The Sprint 05 doc was
   corrected on 2026-10-11. No such phrase was found in `docs/ARCHITECTURE.md`
   or `AGENTS.md`. The ADR keeps its historical wording.
2. **Pin today's behaviour with a test.** Assert that, after a widget commit,
   a later turn's request still contains the earlier frame in the replayed
   history. Any future release or compaction then changes that test
   deliberately.
3. **Measure before optimizing.** Log, or expose in the Context Bar, an estimated
   retained-history token count per persona, using the preflight's existing
   estimator. That shows how often real rooms hit the large cases.
4. **Resolve it through the compaction epic, not a one-off.** Its planned
   **Release** (tombstone by stable id; `ta-N` already exists as the address) and
   **Compress/Compact** actions are the designed fix. Make sure that epic's scope
   names thread artifacts and widget commit frames explicitly.
5. **Leave automatic policies to the writer.** One example is tombstoning a
   widget frame once every participant has answered it. Such a policy can make a
   persona forget directions it was meant to apply, so it is a writer-level
   product decision and is not recommended by default.

## Related Files

- `packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts`: builds and commits the retained user message
- `packages/core/src/infrastructure/api/orchestration/ConversationManager.ts`: `addMessages`, `getMessages`, artifact-id comment
- `packages/core/src/application/services/workshop/WorkshopThreadArtifactFrame.ts`: frame builder; `ta-N` is the tombstone address
- `packages/core/src/application/services/workshop/WorkshopRoomAudience.ts` and `WorkshopRoomDeliveryService.ts`: once-per-participant delivery
- `packages/core/src/application/services/workshop/WorkshopPromptBuilder.ts`: where frames enter the model message
- `packages/core/src/shared/constants/promptBudgets.ts`: the ceilings in the table above
- `packages/core/src/__tests__/application/services/workshop/widgets/showVsTell/ShowVsTellOneShotCommit.test.ts`: the "never re-shipped" test, which checks only the attachment
- [ADR 2026-07-18 — Workshop Thread Artifacts & Context Compaction](../../docs/adr/2026-07-18-workshop-thread-artifacts-and-context-compaction.md)
- [Workshop Context Compaction epic](../epics/epic-workshop-context-compaction-2026-07-21/README.md) (Planned)
- [Workshop cache-usage epic](../epics/epic-workshop-cache-usage-2026-09-23/README.md)

## Completion Criteria

- Current docs describe frames as attached once and retained until released.
  No current doc implies they are sent only once.
- A test pins the retained-history replay of a committed widget frame.
- A per-persona retained-history size estimate is visible to the writer or in
  the logs, or a recorded decision explains why not.
- The compaction epic's scope explicitly covers thread artifacts and widget
  commit frames, linked back to this item. Close this item when that epic owns
  the fix.
