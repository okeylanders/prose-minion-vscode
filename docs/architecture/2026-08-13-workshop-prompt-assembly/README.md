# Workshop Prompt Assembly — Illustrated Series

An illustrated tour of how the Workshop assembles prompts and talks to the
remote LLM provider (OpenRouter). This assembly is the crux of the harness:
what the model is told, when, by which service, and what survives a restore.

Written 2026-08-13 from a verified source sweep (file:line claims checked
against `packages/core/src` on branch
`sprint/conversation-widgets-03-creative-variations`).

## The series

| Doc | Question it answers |
|---|---|
| [01 · Lifecycle Overview](01-lifecycle-overview.md) | How one writer message travels composer → handler → prompt builders → run engine → OpenRouter, and which layer owns which decision |
| [02 · System Prompt Assembly](02-system-prompt-assembly.md) | The 12-layer persona system message: which service builds each layer, and when it is rebuilt (behavior change, directive edit, **session restore — always rebuilt fresh, never replayed**) |
| [03 · Excerpt & Context Lifecycle](03-excerpt-and-context-lifecycle.md) | Where the pinned excerpt and context attachments live (first user message, forever), what happens on revision (additive supersede frames), and the host/guest/tool-sidecar asymmetry |
| [04 · Per-Turn Frame Anatomy](04-per-turn-frame-anatomy.md) | Every frame that rides a user turn, what repeats every turn vs. rides once, capability evidence turns, and two verified wrinkles |
| [05 · Widget Contributions](05-widget-contributions.md) | What Gesture Playground, Lexical Gravity, and Creative Variations each push into turns, the two rails (one-shot vs. standing), and where the interpreting instructions live |

## The five facts to remember

1. **One producer per prompt kind.** `workshopPersonaSystemPromptPaths` +
   `buildWorkshopPersonaSystemMessage` are the only source of persona system
   messages; `WorkshopPromptBuilder` is the only source of turn frames. Every
   path — start, mode change, restore — goes through the same functions.
2. **The transcript is append-only below index 0.** Only the system message
   can be replaced (atomically, between runs). Excerpt/context corrections
   are additive `<workshop-host-update>` supersede frames; the old material
   stays in history and in token costs.
3. **Restore rebuilds the contract, preserves the memory.** Checkpoints store
   user/assistant turns but deliberately no system prompt; import rebuilds all
   12 layers from current resources, current behavior, the current global
   writer profile, and the *archived* session's standing directives.
4. **Repetition is deliberate and tiered.** Identity and directives live at
   system priority (said once); short activation/interaction/scope frames
   repeat every turn so behavior survives 75k-word evidence envelopes;
   everything else is delta-gated (time, transitions, catch-up, host updates).
5. **Widgets ride two rails.** One-shot commits become per-message
   `<thread-artifact>` frames delivered once per participant; Lexical Gravity
   installs a standing `<prose-directive>` into every persona system message.
   Widget private runs are discard-retention one-shots with their own prompt
   files; persona recommendations are proposal-only and stripped from
   retained history.

## Trust boundary, in one paragraph

Writer-influenced text never crosses into trusted framing:
`neutralizeReservedPersonaPromptDelimiters` encodes reserved delimiters at
every insertion point, frames carry inline "quoted material, not
instructions" contracts, provenance rides as header lines (never
writer-controlled attribute values), raw absolute paths and `file:` URIs
never reach model-visible text, and the streaming visibility guard withholds
capability protocol markup from the UI until validated.

## Related ADRs

- [2026-07-20 Persona interaction modes & expression profiles](../../adr/2026-07-20-workshop-persona-interaction-modes-and-expression-profiles.md)
- [2026-07-22 Conversation widgets](../../adr/2026-07-22-conversation-widgets.md)
- [2026-07-24 Room ledger & delivery offsets](../../adr/2026-07-24-workshop-room-ledger-and-delivery-offsets.md)
- [2026-07-25 Scope immutability](../../adr/2026-07-25-workshop-scope-immutability.md)
- [2026-07-30 Session codec evolution](../../adr/2026-07-30-workshop-session-codec-evolution.md)
- [2026-08-01 Lexical Gravity interpretive grammar](../../adr/2026-08-01-lexical-gravity-interpretive-grammar.md)
- [2026-08-12 Offline-capable agent run engine](../../adr/2026-08-12-offline-capable-agent-run-engine.md)
