# Workshop Reply Edit Actions: complete, and what went to `main` with it

**Date:** 2026-11-12
**Epic:** [archive](../.todo/archive/epics/epic-workshop-reply-edit-actions-2026-11-10/README.md)
**Decision:** [ADR 2026-11-10](../docs/adr/2026-11-10-workshop-reply-edit-actions.md), Accepted 2026-11-12
**Branch:** `epic/workshop-reply-edit-actions`, cut from `main` at `c0a6e497` (Persona File Edits, #249). Taken to `main` on Okey's word after his live runs.

## Facts

- **What it is.** A persona's reply that names small fixes, or writes out a rewrite, says so in a trailer, and the bubble's footer draws a chip for each.
  - A press asks the reply's author for exactly those edits.
  - The answer comes back as ordinary file-edit cards, or as one host line saying there is nothing to change. It is never prose.
  - Nothing changes in a file until the writer applies a card.
- **How it was built.** A spec and four code PRs into the epic, each reviewed by Astra:
  - #251: the declaration (trailer, codec, bounds, `editOffers` on the turn);
  - #252: the press (routes, the directive, the engine's `finalReplyCheck` and `deferRetention`), three review rounds;
  - #253: the footer row and its chips;
  - #254: a chip per version, a firmer rule to declare, a per-turn reminder, and a requested rewrite past the prose ceiling.
- **Okey's live runs** changed the design twice (both on 2026-11-10):
  - A reply with three written-out versions drew no chip. The teaching had discouraged declaring, and `rewrites` had no shape for alternatives. Slice 3b fixed both.
  - A requested rewrite came back as a card the prose rewrite ceiling refused. Okey chose option A (PR #254 D1): a rewrite the writer pressed for is not held to the ceiling.
- **To `main`** (2026-11-12). Okey: "We are ready to go ahead and open a pr to merge all of this epic branch into main, including everything that travels with it."

## What travels with it

The epic branch carried more than its own feature, each merged in on Okey's word:

- **Message Reactions** ([ADR 2026-11-07](../docs/adr/2026-11-07-workshop-message-reactions.md)): the whole epic, merged in at `e250a6d7` so Slice 3 could share the footer row, then Slice 3c (#256, personas' reactions as a tapback on the writer's message). Its [epic folder](../.todo/epics/epic-workshop-message-reactions-2026-11-07/README.md) stays open for Slice 4's recorded tuning counts.
- **The memory fence fix** (#255, [ADR 2026-11-04](../docs/adr/2026-11-04-workshop-project-memory.md) D8/D9, addendum of 2026-11-11): a memory proposal that trips the personal-word list is now a pending card held `personal`, naming the word, in both modes. It is never dropped silently and never auto-saved.
- **The model catalog refresh** (`16690cc5`, [audit](../.todo/archive/epics/epic-workshop-reply-edit-actions-2026-11-10/model-audit-2026-11-11.md)): four opt-in models added, two unavailable ones removed, `docs/RECOMMENDED_MODELS.md` updated. Defaults and saved selections are unchanged.

## Decisions

- **The reply declares; the renderer never guesses** (D1, D2). Chips come only from a checked `<prose-minion-edit-offer>` trailer.
- **Status is derived from the ledger, never stored** (D5). A Rewind that removes an answer reopens its offer.
- **A press carries ids only** (D4). The host quotes the source reply from the ledger.
- **The engine checks the final reply** (D6). `finalReplyCheck` and `deferRetention` are feature-agnostic seams on `AgentRunOptions`. The press retains its exchange only once the answer turn is adopted.
- **Intent comes from the host** (D7). `fixes` narrows a card to small find-and-replace changes (40 changed characters a side). `rewrites` lifts the prose rewrite ceiling, for a pressed rewrites offer alone.
- **One footer row** (U1). Offer chips, the widget chip and the reaction corner share it; fixes always draw before rewrites.
- **The codec: no `schemaVersion` bump** (ADR 2026-07-30). `editOffers`, `editOfferRequest`, `editOfferAnswer`, `reactions`, `reactionDelivery`, `reactionOnly`, `noMessage`, and the memory card's `held: 'personal'` with `heldWord`, are all optional and additive. An older build can't open a session holding them; that is forward compatibility, which a migration doesn't address.

## Lessons

- **Don't wait on an upstream epic; merge it in.** Slice 3 sat blocked on Reactions reaching `main` until Okey said to merge it and keep going.
- **A prompt that permits is read as one that discourages.** "Most replies declare nothing" got exactly that from a capable model. Reactions' Slice 4a found the same with "react rarely". State the rule, give worked examples, and repeat it per turn where it matters.
- **A policy written for unprompted edits is wrong for requested ones.** The rewrite ceiling protects prose from a persona's own initiative; a writer's press is the opposite case.
- **Check where a rule runs before describing it.** The ceiling is checked at Apply, not at staging.
- **A stop can land mid-staging** (PR #252 R1): retention has to wait for the commit it belongs to.

## Verification

On the epic head with these docs, 2026-11-12, run locally:
- typecheck clean;
- lint: 0 errors / 1,171 warnings;
- jest: **843 suites / 11,915 tests / 59 snapshots**, all passing.

- `npm run build` succeeds.

Nothing was run in the Extension Development Host here; the live runs are Okey's.

## Follow-ups

- **[Thin the bubble's action row](../.todo/features/feature-workshop-bubble-action-row-thinning/README.md)** (low): Q6, deferred until the chips were live.
- **[A reply is retained before staging settles](../.todo/tech-debt/2026-11-10-workshop-reply-retained-before-settlement.md)**: ordinary messages, found in Slice 2.
- **The 40-character fix bound** was never tuned against live use.
- **A refused press** shows only in the chip's tooltip and the live region; a more visible refusal is unbuilt.
- **Message Reactions' Slice 4** (recorded per-persona counts) is not done.
- **Whether live models declare reliably** under a long persona prompt rests on Okey's runs, not on a test.
