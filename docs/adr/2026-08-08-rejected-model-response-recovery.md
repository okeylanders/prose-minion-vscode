# ADR 2026-08-08: Rejected Model Response Recovery

- **Status**: Accepted
- **Decision owner**: Okey
- **Context**: A Lexical Gravity build consumed 10,061 completion tokens and
  returned an otherwise complete 18,348-character response with one malformed
  JSON token. Strict validation correctly rejected it, but the only durable
  diagnostic retained the first and last 4,000 characters. The parse failure
  occurred inside the deliberately omitted middle, and the provider generation
  id had already been discarded. The paid artifact was therefore impossible to
  repair locally.

## Decision

Every structured widget response rejected after a completed provider call is a
recoverable artifact, not merely a log event.

Core owns a host-agnostic storage adapter plus an opt-in VS Code presenter. The
composition root gives the store the live `Workspace`, `FileSystem`, and an
extension-global fallback directory; it gives the presenter `ShellService`.
On rejection the widget explicitly persists, then presents the resulting
receipt:

1. writes the complete untouched provider body as an immediately editable
   `.response.txt`, preserving the provider's original character offsets;
2. writes a versioned `.metadata.json` sidecar containing the validation error,
   tool/request summary, provider generation id, model, finish reason, usage,
   response filename, character count, and a typed response-contract id;
3. writes each artifact through a temporary file and native rename so a crash
   cannot leave a deceptively valid partial artifact; the response is committed
   first, so a sidecar failure never sacrifices the paid body;
4. stores under the single open project at
   `prose-minion/recovery/model-responses/`, creating a recovery-local
   `.gitignore`; extension-global storage is used when no project is open,
   multiple project roots are open, or project persistence fails;
5. opens the exact response file in an editor tab automatically and shows a warning
   with an action to reveal it in the operating system;
6. returns the absolute recovery path so the normal webview failure also names
   where the artifact survived.

Provider generation ids and actual model ids propagate through
`AgentRunEngine.ExecutionResult`. This makes provider-side retrieval possible
when OpenRouter input/output logging is enabled, while local recovery remains
independent of that external setting.

Bounded Output-channel diagnostics remain bounded. They are useful for ordinary
support logs but are no longer treated as the recovery medium.

The metadata stores the static response contract rather than the original full
prompt. A future repair action can recover malformed JSON mechanically from its
sentinels/schema without persisting a second copy of manuscript input. It must
add a content hash and input/cost bounds before automatic retransmission.

## Scope

The first consumers are the two structured Conversation Widget generators:
Lexical Gravity and Gesture Playground. The service is deliberately generic so
future structured-output consumers use the same quarantine rather than growing
private debug dumps.

## Consequences

- A malformed paid completion remains inspectable and can be repaired without a
  second model call.
- Recovery files contain potentially sensitive prose. Project-local placement
  keeps an artifact beside the work that produced it, while the recovery-local
  `.gitignore` prevents accidental commits by default. Users remain responsible
  for deleting artifacts they no longer want.
- Automatic editor opening is intentionally assertive: this path represents a
  failed paid operation, and silent persistence would leave the writer unaware
  that recovery exists.
- Local persistence failure never replaces the original validation error. It is
  logged, and the user still receives the normal failure response.
