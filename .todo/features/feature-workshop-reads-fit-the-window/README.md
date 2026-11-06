# Feature: Reads That Fit the Window, and Multi-File `resource.read`

**Date Identified:** 2026-11-06
**Status:** Planned. Okey: "we need to add the guard and make sure we fit the window on reads." ADR first: the engine's guard changes how every capability-bearing run ends.
**Priority:** High. The bookmark recall live pass raised a persona's turn to 15 calls and more reads ([ADR 2026-11-05 D11](../../../docs/adr/2026-11-05-workshop-bookmark-recall.md#d11-a-personas-turn-allows-15-capability-calls-and-more-reads-2026-11-06)). That made this gap reachable.
**Related:**
- [ADR 2026-10-05](../../../docs/adr/2026-10-05-workshop-session-transcript-recall.md) D9 and D11: how recall fits its reads to the window.
- [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-project-memory.md): memory reads name a note that does not fit, and never cut it.
- `infrastructure/api/orchestration/RequestContextPreflight.ts`: `measureContextWindow`, `assertRequestFitsContext`.

## Problem

Only session recall fits its reads to the context window. Everything else a persona reads lands whole, and the turn fails when the window fills.

- **The seam exists, but only recall uses it.**
  - The engine measures the room left before each call (`AgentRunEngine.fulfillCapability`, through `measureContextWindow`) and passes it as `fulfill(request, window)`.
  - `transcript.read` takes at most half of it (`recall/WorkshopRecallWindowClamp.ts`).
  - `WorkshopPersonaCapability` passes the window to recall alone. `resource.read` and `memory.read` are called without it (`WorkshopPersonaCapability.ts` near lines 640 and 650).
- **What a turn can carry today:**

  | Read | Per call | Per turn | Fitted to the window |
  |---|---|---|---|
  | `transcript.read` | 150,000 characters | 300,000 shared, at most 10 reads | yes |
  | `memory.read` | 40,000 characters | 5 reads, about 200,000 | no |
  | `resource.read` | 64 KiB | no total; 15 calls is about 960 KiB | no |

- **When the window fills, the turn fails.** Before each request, `executeTurn` runs `assertRequestFitsContext`.
  - A request whose evidence does not fit throws `AgentRunUnavailableError('context-window-exceeded')`.
  - The writer gets "Reduce standing context…" instead of an answer, and the reads the persona already made are lost to that reply.
  - With an unknown window there is no preflight, and the provider's own refusal is the first anyone hears of it.
- **Files are read one at a time.** A persona's `resource.read` takes one `<path>`, with a 400-line default window and a 64 KiB ceiling. "Chapters 1, 2 and 3" is three calls, three model round-trips and three evidence messages. `transcript.read` already reads up to 10 sessions in one call (`readSessions`), each under its own header, sharing the read fairly.

## Shape

### 1. Every read fits itself (the capabilities)

- **One fitting rule.** Lift recall's search (`fitWorkshopRecallReadToWindow`: measured with the preflight's own estimator, at most half the room left) into a shared module. Recall, files and memory all use it.
  - The rule's tests and its render bound (`WORKSHOP_RECALL_CLAMP_RENDERS`) move with it.
  - `recall/` is a boundary list in `boundaries.test.ts`, so the shared module needs its own entry. Recall may import it; it must not import recall.
- **`resource.read` takes the window.** A file read is clamped like a transcript read: the largest line window that fits. The evidence says where it stopped and gives the `startLine` to continue from, as the 64 KiB ceiling already does.
- **`memory.read` takes the window.** Notes are never cut (ADR 2026-11-04). The read delivers the notes that fit, in the order named, and names the rest: "did not fit the room left in your context window; read it on its own, or in a later turn."
- **An unknown window.** Nothing checks the cost locally. As recall already does, the turn's reads of each kind then share one read's worth, and a limited read says why.
- **Every limit is said, never silent.** A clamped or refused read says so at its top, with the room it had. The persona can then narrow the request or answer from what it has.

### 2. A guard in the engine (the backstop)

The capabilities' fits are estimates. The engine still needs a last resort, so that a full window ends the turn with an answer instead of an error.

- **Where.** In the capability loop (`AgentRunEngine`, the `while … rounds < policy.maxCapabilityRounds` loop), before the evidence turn is sent. Measure the request with its evidence against the preflight.
- **What it does when the evidence does not fit:**
  - Send a short notice in the evidence's place: what was asked, that it did not fit, the room left.
  - Then force the final reply, as the round limit does (`limitInstruction()` with its one retry).
- **When the history alone does not fit** (no evidence at all), the turn fails as today. Only the writer can shrink standing context.
- **The ledger must agree.** A capability records its turn (the capability card, `capability.status`) before the engine sends its evidence. When the engine withholds evidence, the record must say so too.
  - The likely shape is a callback on the capability, `evidenceWithheld(request, reason)`, so the card reads "did not fit the window" rather than "success".
  - Withheld evidence never reaches catch-up or the published audience.
- **It covers every policy.** The tool chat, the sidebar assistant and context generation reach the same loop, and the backstop needs no change in them.

### 3. Multi-file `resource.read` (concatenated reads)

- **The grammar.** `<path>` may repeat, up to a new bound (`readPaths`, around 10), each path once. This mirrors `<session>` in `transcript.read`.
  - `startLine` and `endLine` stay, but only beside exactly one `<path>`. Anywhere else the read is refused, as recall refuses `ambiguous-turns`.
  - The persona instruction states the grammar, built from the constants in `WorkshopCapabilityXmlCodec`. Its tests pin the text.
- **The result.** One evidence message, each file under its own header with its canonical configured path, in the order named.
- **The budget.**
  - The files share one read's bytes, fairly, then the window fit applies to the whole read.
  - Raise the per-read bound for a multi-file read (a chapter is often 20–40 KB). Decide its number in the ADR, against the window fit.
  - Each file that stops early gives its own continuation.
- **Per-file outcomes.** A path that is missing, unconfigured or over `readSourceBytes` is reported in its own section. The read keeps the other files, and never fails as a whole for one bad path.
- **Accounting.** One call against `callsPerTurn`, however many files it names. The window fit and the shared bytes bound what it carries.

## Open questions for the ADR

1. **The share.** Half the room left per read is recall's rule. Should files and memory take half too, or a smaller share once the turn has many calls left?
2. **A per-turn file total.** The window fit replaces a byte total when the window is known. Is a total still wanted as a cost bound on large-window models?
3. **The backstop's ending.** Should the engine force the final reply, or hand the persona the notice and let it choose a smaller read within its remaining calls?
4. **`dictionary.full-entry` and `analysis.run`.** Measure their largest evidence. If either can approach the window, it fits itself too; otherwise the backstop covers it.

## Completion Criteria

- [ ] An ADR records the shared fitting rule, the engine's backstop, the ledger's record of withheld evidence, and the multi-file grammar and bounds.
- [ ] `resource.read` and `memory.read` take the window, fit to it with recall's rule, and say when they were limited. A memory note is never cut.
- [ ] With an unknown window, each kind of read shares one read's worth per turn, and says so.
- [ ] A capability round whose evidence would not fit sends a notice instead and ends the turn with a reply, never `context-window-exceeded`. The capability card says the evidence was withheld.
- [ ] A turn whose history alone does not fit still fails with today's message.
- [ ] `resource.read` reads up to `readPaths` files in one call, each under its own header with its own continuation, and reports a bad path in its own section.
- [ ] The persona instruction states the new grammar and bounds, pinned by tests to the constants.
- [ ] Engine tests fill a known window with reads across several rounds and get a reply, not an error. Each read kind has a test of its fit at the window's edge.
- [ ] `boundaries.test.ts` lists the shared fitting module, and `recall/` still imports nothing outside its list.
