# ADR Seed: Durable Multimodal Workshop Messages

**Date:** 2026-09-03

**Status:** Proposed — promote to `docs/adr/` only after Gate 00 acceptance

**Decision owner:** Okey

## Context

Workshop currently models every provider message as `{ role, content: string }`.
One-shot attachments are bounded text bodies framed into that string, committed
only after a successful assistant response, and replayed once to each room
participant. Persisted conversations also require string content.

The current checkpoint therefore retains prompt-bearing text in more than one
owner when an attachment is addressed to the room:

| Current owner | Durable body | Purpose |
|---|---|---|
| `workshop.pendingMessageAttachments[].content` | Inline bounded string | Retryable, unsent composer state |
| `workshop.threadArtifacts[].content` | Inline bounded string | Host-private once-per-participant room delivery |
| `conversations[].messages[].content` | Inline string containing the rendered `<thread-artifact>` frame | Exact retained history for the participant that received it |

The visible `WorkshopTurn` keeps only display-safe attachment metadata. A
direct-tool attachment does not enter the room artifact ledger; after a
successful send, its prompt-bearing body remains in that tool's private
conversation history.

Committed widget pills use the same `workshop.threadArtifacts` ledger and
text-frame renderer, with `kind: widget:<registry-id>`, but they do not use the
pending composer-attachment list. Their synchronous widget commit publishes the
writer turn and artifact together before inference. This shared delivery rail
must not be mistaken for an identical staging lifecycle.

OpenRouter accepts multipart Chat Completions messages containing text, images,
audio, and video. Local inputs require base64 at the provider boundary. Model and
provider support varies, and the current model catalog discards the live
`architecture.input_modalities` evidence needed for a preflight gate.

Binary media creates a second constraint: embedding base64 into Workshop JSON
would enlarge it by roughly one third, collide with the store's bounded reads,
make search/index paths inspect binary payloads, and spread sensitive material
through logs, IPC, clones, and fixtures. Re-reading the original absolute path
would make restored sessions depend on a stale path hint and weaken the current
host-authority boundary.

## Decision

Adopt a durable-reference, late-materialization design:

1. One canonical `WorkshopComposerAttachment` discriminated union represents
   `pasted-text`, `text-file`, `image`, `audio`, and `video` under the existing
   `ta-N` lifecycle.
2. Text bodies remain bounded strings in the aggregate. Binary bodies are copied
   at intake to a session-scoped asset repository below the Workshop sessions
   directory. Persisted state carries only an immutable asset reference,
   byte-length/digest evidence, media kind, format, and display metadata.
3. A provider-neutral `ModelMessage` contract permits string text or ordered
   content parts. Its binary parts carry asset references, not bytes or URLs.
4. `ConversationManager` and its archive retain provider-neutral parts so
   follow-up requests can rehydrate media. Workshop persisted schema v3 and a
   conversation archive v2 make this change explicit; v1/v2 input migrates to
   the new current shape.
5. An `OpenRouterMultimodalMessageAdapter` resolves asset references through a
   narrow read port immediately before dispatch and produces provider-specific
   `image_url`, `input_audio`, or `video_url` content parts. Base64 is scoped to
   this ephemeral request object.
6. A model capability catalog retains live `input_modalities`. The host checks
   every staged media kind against the current selected model immediately before
   dispatch. `unknown` and `unsupported` both refuse without a network call.
7. Existing room delivery, direct-tool privacy, commit-on-success, and retry
   semantics apply to all attachment kinds.

### Durable ownership after the change

Media extends the existing ownership model without duplicating bytes:

| Owner | Text or widget payload | Media payload |
|---|---|---|
| Pending composer attachment | Inline bounded string | Immutable asset reference |
| Committed room thread artifact | Inline bounded string | Immutable asset reference |
| Retained participant conversation | String or provider-neutral text part | Provider-neutral media part containing the same immutable reference |
| OpenRouter request | Text content | Ephemeral provider DTO containing materialized base64 |

Duplicating a small immutable reference across the room ledger and participant
history is deliberate: each owner can prove what it delivered without copying
the underlying binary body. The session-scoped asset repository is the only
durable byte owner.

`WorkshopThreadArtifact.kind` remains reserved for the existing
`widget:<registry-id>` classification. Text-versus-media discrimination belongs
inside a nested artifact payload, so media does not counterfeit widget identity.
An illustrative target is:

```ts
type WorkshopThreadArtifactPayload =
  | { type: 'text'; content: string }
  | {
      type: 'media';
      mediaKind: 'image' | 'audio' | 'video';
      asset: WorkshopMediaAssetRef;
    };

interface WorkshopThreadArtifactV2 {
  id: string;
  turnId: string;
  kind?: string; // widget:<registry-id> only
  name: string;
  payload: WorkshopThreadArtifactPayload;
}
```

This is the adapter pattern at an existing provider boundary: orchestration owns
meaningful message content; OpenRouter owns only its wire spelling.

## Consequences

### Positive

- One attachment lifecycle covers pasted prose and media.
- Session JSON stays inspectable and bounded.
- Model changes and unsupported combinations fail before paid inference.
- Provider DTOs do not leak into Workshop or conversation ownership.
- Follow-up turns and late-joining participants retain access to the media that
  established their conversation context.
- A future provider can map the same model-message parts without changing the
  composer or Workshop aggregate.

### Costs

- Session storage becomes a JSON-plus-assets aggregate rather than a single
  self-contained file.
- Save-as/duplicate/delete/reset require coordinated asset lifecycle behavior.
- Conversation archive migration is broader than a request-only patch.
- Every asset read must validate containment, digest, type, and bound.
- A missing asset can degrade one participant conversation and must have visible
  recovery rather than a silent text-only fallback.

## Alternatives rejected

### Persist base64 inside session JSON

Rejected. It duplicates binary data into every checkpoint, exceeds existing
session bounds quickly, and makes unrelated search, reveal, diff, and fixture
paths handle sensitive payloads.

### Keep only the original absolute file path

Rejected. Paths move, remote workspaces differ, and a persisted path is a hint,
not authority. It also makes later reads observe changed bytes under an old
attachment identity.

### Send media once, then retain only a text marker

Rejected. Chat Completions is request-history based; later questions about an
image or recording would no longer carry the original input. This also breaks
Workshop's once-per-participant room-delivery promise.

### Upload to a public/private URL service

Rejected for this epic. It adds cloud retention, credentials, deletion policy,
and a privacy boundary unrelated to the requested local composer feature.

### Put OpenRouter multipart DTOs directly in `ConversationManager`

Rejected. The manager is described as provider-neutral durable conversation
ownership; importing provider wire shapes would make that boundary untrue and
force Workshop persistence to track OpenRouter implementation details.

## Proposed product decisions for Gate 00

| Decision | Recommendation |
|---|---|
| Long-paste threshold | 2,000 characters in one `text/plain` paste event |
| Existing selected text during long paste | Leave the draft unchanged; the paste is an attachment action |
| Attachment-only send | Permit it; show generated transcript copy, send no invented text part |
| Item/size limits | 3 items, 60 MiB binary aggregate; per-kind limits from the epic |
| Unknown capability | Fail closed and retain the staged items |
| Media previews | Type icon and metadata only in v1; no raw-byte webview previews |
| URL inputs | Defer; local file picker only |
| Damaged committed asset | Visible degraded attachment; block only a request that needs it |

## Follow-up decisions outside this epic

- Export/import packaging for a portable JSON-plus-assets bundle.
- Remote URL attachments and provider-specific URL routing.
- PDF inputs.
- Media transformation, compression, trimming, and thumbnails.
- Per-provider endpoint pinning when model-level modality evidence is
  insufficient.
