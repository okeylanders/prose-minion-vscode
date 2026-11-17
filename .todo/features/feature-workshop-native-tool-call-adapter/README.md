# Feature: Translate a Persona's Native Tool Calls Into the XML Request

**Date Identified:** 2026-11-17
**Status:** Idea, wanted (Okey: "we'll need the adapter for sure"). A short ADR, or an amendment to the capability ADR, then one or two slices.
**Priority:** High. With web research on, Sonnet and Opus personas fail capability calls often.
**Origin:** Okey's reproduction, 2026-11-17

## What happens

- **The failure.** With web research on, a Claude persona (Sonnet or Opus)
  asks for a capability, in Okey's reproduction `transcript.catalog` to find
  sessions matching "6.11", as a **native tool call**, a structured part of
  the API reply, instead of the XML request in its text that Prose Minion
  reads.
- **Where it's lost.** `OpenRouterClient` keeps only `message.content`
  (`OpenRouterClient.ts:227`) and drops `message.tool_calls`. A reply that is
  only a tool call has `content: null`, so the engine sees an empty answer
  and shows its fallback.
- **The trigger is web research.** Okey verified on 2026-11-17 that with web
  research off it works without issue. Web research attaches a `tools` array
  (`openrouter:web_search`, `AssistantToolService.workshopWebSearchTools`),
  and that primes these models to call functions natively, even ones only
  described in the prompt.
- **A retry isn't enough.** The first fix tried detects the native call and
  asks the persona to retry in XML, within a bound. Okey's verdict: it
  "barely works".

## The design already anticipated this

The Workshop's capability work chose XML on purpose, and said so (Editor
Tab epic, Sprint 07, building on Sprint 06A's envelope):

> Provider-native function calling may become an optional adapter later
> without changing application request/result types; XML remains the
> primary cross-model transport and routes do not split by provider
> tool-call support.

This is that adapter.

## Idea

Translate a native call into the exact `<prose-minion-tool-call>` envelope
the persona should have written, and carry on as if it had.

1. **The provider boundary keeps the call.**
   - `OpenRouterClient` returns tool calls beside the content instead of
     dropping them: `message.tool_calls` when not streaming, and in the
     streaming path the fragments stitched together per call index.
   - OpenRouter's server-side web search, which comes back as annotations,
     stays apart from function calls.
2. **The capability translates, the engine doesn't.** The engine passes
   native calls to a translator its caller supplies, a seam like
   `finalReplyCheck` and `deferRetention`. It never gets a Workshop branch,
   and `AgentRunEngine` names no feature.
3. **A closed mapping.**
   - Only a name in `WORKSHOP_CAPABILITY_OPERATIONS` translates.
   - Each argument maps to an exact field of the XML grammar.
   - The result is decoded by `WorkshopCapabilityXmlCodec`, the one
     validator, exactly as typed XML would be, so bounds, visibility, cards
     and publication are unchanged.
   - The translator never runs anything; it only writes XML.
4. **The retained history holds the XML.** The persona's assistant turn is
   kept as the translated envelope, never as a tool call. `ConversationManager`
   keeps only `user` and `assistant` roles (`ConversationManager.ts:73`), so:
   - nothing about retained history, alternation, Rewind marks, archives or
     the session format changes;
   - the provider never sees a tool call without its tool result, which
     Anthropic and OpenAI both reject;
   - the persona sees its own request written as XML in its history, an
     example in context, so native calls should grow rarer as a
     conversation goes on.
5. **What can't be translated takes the correction path** the first fix
   built: an unknown name, arguments that don't map, unparseable argument
   JSON. Bounded, then a host-worded outcome.
6. **Counting.** A translated call counts against the turn's
   `callsPerTurn`, like any other.
7. **Logs** carry tool names, counts and fault kinds, never arguments, which
   can quote the writer.

## Open questions

- **Several native calls in one reply.** The XML wire carries one request
  per reply. Translate the first and tell the persona the rest weren't run,
  or run them as successive rounds within the calls left? Leaning: the
  first, said plainly. It's honest and the simplest.
- **Text beside a call.** Keep the reply's prose and append the envelope,
  or treat the reply as the call alone, as the wire does today?
- **A different search route?** OpenRouter can also search through its web
  plugin, which puts results into the prompt instead of offering the model a
  tool. That would remove the `tools` array, and with it the trigger. But it
  searches on every call rather than when the persona chooses, at a price,
  so it isn't the fix. Worth a note in the ADR.

## Completion Criteria

- [ ] With web research on, a native `transcript.catalog` call (and one of
      every capability family) is translated, decoded by the codec, run, and
      answered. A test reproduces Okey's case with a mocked transport, both
      streamed and not.
- [ ] The retained history holds the translated XML and no tool call, and
      the next request is well-formed (test).
- [ ] An unknown name or unmappable arguments take the correction path, and
      nothing runs (test).
- [ ] `AgentRunEngine` gains a seam, not a Workshop branch
      (`boundaries.test.ts`).
- [ ] Logs carry no arguments.

## Related

- [Model Providers](../feature-model-providers/README.md): each provider
  adapter there will need to surface tool calls the same way.
- [Workshop Research Agent](../feature-workshop-research-agent/README.md):
  web research, the trigger here.

## Related Files

- `packages/core/src/infrastructure/api/providers/OpenRouterClient.ts` (and
  `OpenRouterChatContracts.ts`)
- `packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts` and
  `AgentRunContracts.ts`
- `packages/core/src/infrastructure/api/orchestration/ConversationManager.ts`
- `packages/core/src/application/services/workshop/WorkshopCapabilityXmlCodec.ts`
  and `WorkshopCapabilityXmlDocument.ts`
- `packages/core/src/shared/types/workshopCapabilities.ts`
- `packages/core/src/infrastructure/api/services/analysis/AssistantToolService.ts`
  (`workshopWebSearchTools`)
- `.todo/archive/epics/epic-workshop-editor-tab-2026-07-03/sprints/07-persona-capabilities.md`
  (the original decision)
