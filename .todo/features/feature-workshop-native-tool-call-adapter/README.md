# Feature: Translate a Persona's Native Tool Calls Into the XML Request

**Date Identified:** 2026-11-17
**Status:** Built on `fix/workshop-empty-response-diagnostics`, in review (2026-11-17). The first fix's retry is kept as the fallback for calls that can't be translated. See **What was built** below; the rules live in `AGENTS.md`, **Workshop Native Tool Calls**.
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

## What was built (2026-11-17)

- **Provider.** `OpenRouterClient` returns `toolCalls` beside `content`,
  whole or stitched from a stream (`providers/OpenRouterToolCalls.ts`).
- **Seam.** `AgentCapability.translateNativeToolCalls`, offered a reply's
  calls by `orchestration/AgentNativeToolCalls.ts`. The engine appends the
  returned text and reads the reply as it reads typed XML.
- **Translator.** `WorkshopNativeToolCallTranslator.ts`: the closed mapping
  (`WORKSHOP_NATIVE_CALL_FIELDS`), escaped XML out, nothing run.
- **Fallback.** A call that can't be translated sets the first fix's
  correction path going, whatever finish reason the provider gave.

### Decisions on the open questions

- **Several native calls in one reply: the first runs, the rest are said.**
  The persona reads, beside that call's evidence, how many more calls its
  reply held and that they were not run. Running them as successive rounds
  would have the host order work the persona never sequenced.
- **Text beside a call: kept, with the envelope after it.** The reply
  becomes the prose, a blank line, then the envelope: exactly what typed XML
  after narration is, so the codec's existing rule decides it (plain
  narration passes; a preamble with markup is `mixed-content`). In a stream,
  the envelope goes through the visibility guard, so a short "Let me
  check…" is dropped with the request, as it is for typed XML.
- **Prose beside a call that can't be translated: the prose stands.**
  Streamed prose can't be retracted, so there is no correction turn; the
  log records the untranslated call.
- **A different search route: not taken.** The web plugin searches on every
  call. It stays a note, as below.

### Not verified against a live provider

Tests use a mocked transport. Two things are assumed from OpenRouter's
OpenAI-compatible wire, and a live pass with web research on should confirm
them:

- the name a model gives an unadvertised call. The translator accepts the
  operation name with `.`, `-` or `_` as separators, in any case;
- the argument shapes for repeating fields (`paths`, `sessions`,
  `memories`). Another shape takes the correction path, so the cost of a
  wrong guess is one retry.

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

- [x] With web research on, a native `transcript.catalog` call (and one of
      every capability family) is translated, decoded by the codec, run, and
      answered. A test reproduces Okey's case with a mocked transport, both
      streamed and not.
- [x] The retained history holds the translated XML and no tool call, and
      the next request is well-formed (test).
- [x] An unknown name or unmappable arguments take the correction path, and
      nothing runs (test).
- [x] `AgentRunEngine` gains a seam, not a Workshop branch
      (`boundaries.test.ts`).
- [x] Logs carry no arguments.

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
