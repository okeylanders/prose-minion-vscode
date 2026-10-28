# Workshop recall: rejected multi-call response

Investigated the live Workshop failure on 2026-10-26 around 17:57 CDT.

## Findings

- The latest Prose Minion Output log was under VS Code's long-running `20261002T182453/window16/exthost/output_logging_20261025T082132` directory, not a log directory named for today.
- The affected host request was `workshop_host-1793055433898-6`, using `openai/gpt-6.1-terra`. Both its initial response and its single correction were rejected as `mixed-content`. No capability fulfillment or session read happened in this turn.
- The rolling checkpoint retained the first rejected assistant response: four complete `transcript.catalog` / `transcript.search` calls in one response, plus stray text. The second rejected response was replaced by the engine's fallback, so its exact shape was unavailable without debug logging. Do not infer that it repeated the identical bundle.
- `WorkshopCapabilityXmlDocument` deliberately rejects multiple executable calls. The production codec rejected the retained bundle and accepted its first call alone. Keep the single-call boundary; executing an arbitrary subset would silently change intent.
- An independently renamed session has a mismatched `fileName` inside its `.summary.json`. `readSearchIndexForBrowser` logs and discards that index, then the store falls back to the full snapshot. It does not abort the listing or disable recall. The same warning preceded successful reads in earlier live turns.

## Verification

A temporary local diagnostic loaded production TypeScript modules and supplied a filesystem port whose write, rename, delete, and mkdir methods throw. It performed no mutations of writer data:

- Listed 92 named sessions without truncation.
- Opened both the requested brainstorming session (29 turns) and the independently renamed session successfully.
- Ran the production recall catalog and read service; the requested session was discoverable and read successfully with zero unreadable sessions.
- Inspected the retained multi-call response and its first call separately through the production codec.

Four existing Jest suites passed: `WorkshopCapabilityXmlCodec`, `WorkshopSessionStore`, `WorkshopTranscriptRecallService`, and `AgentRunEngine` (191 tests total).

## Disposition

Investigation only: no runtime code, settings, session files, or search summaries changed. A fresh writer message asking the persona to issue one capability call at a time is a reasonable immediate retry. The stale summary is independent cleanup. Any protocol hardening should preserve the one-call contract and improve correction feedback rather than silently executing bundled calls. Debug logging was off; do not enable it implicitly because it records manuscript-bearing responses.

## Follow-up: successful model switch

The live log subsequently confirmed the writer hot-swapped back to `openai/gpt-5.6-terra`, rewound before the failed writer turn (dropping that host conversation), and retried with a fresh host. Request `workshop_host-1793055733755-7` completed a catalog call, a successful read of the intended session, and final prose in three provider calls. The stale summary warning remained throughout the successful exchange.

Manual/custom model selection does not select another Workshop instruction set: `SettingsOverlay` treats custom as a display distinction, `ConfigurationHandler` stores the same model-id setting, and `AIResourceManager` changes the engine's model. `AssistantToolService.buildWorkshopPersonaSystemMessage` assembles prompts from role, persona, behavior, writer profile, and directives, with no model-id parameter. `WorkshopPersonaCapability` injects the same XML protocol. The failed custom-model run lacked live context-window metadata, affecting preflight checks rather than instruction assembly.

Evidence favors a model-specific XML-protocol compliance failure in this interaction; it does not establish a general model regression or isolate upstream routing behavior. The successful retry also involved rewind and a fresh request, so it was not a byte-identical controlled comparison.

## Recovery improvement (2026-10-27)

The Workshop parser now includes the number of opening markers when it rejects a response containing more than one. Its correction tells the model that those requests did not run and asks for one call followed by a wait. The engine logs the marker count without response content and, if correction fails, tells the writer to retry or choose another model. The rejection and execution boundaries are unchanged; marker counts do not claim that each marker is a valid call.

An integration test covers the real engine and Workshop capability correcting a four-marker bundle and executing the single corrected call. The focused codec, capability, and engine suites passed (156 tests), as did the full TypeScript typecheck.
