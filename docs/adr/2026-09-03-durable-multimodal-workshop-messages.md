# ADR: Durable Multimodal Workshop Messages

**Date:** 2026-09-03

**Status:** Accepted

**Accepted:** 2026-09-04

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
audio, video, and PDF files. Local inputs require base64 at the provider
boundary. Model and provider support varies, and the current model catalog
discards the live `architecture.input_modalities` evidence needed for a
preflight gate.

Binary attachments create a second constraint: embedding base64 into Workshop JSON
would enlarge it by roughly one third, collide with the store's bounded reads,
make search/index paths inspect binary payloads, and spread sensitive material
through logs, IPC, clones, and fixtures. Re-reading the original absolute path
would make restored sessions depend on a stale path hint and weaken the current
host-authority boundary.

## Decision

Adopt a durable-reference, late-materialization design:

1. One canonical `WorkshopComposerAttachment` discriminated union represents
   `pasted-text`, `text-file`, `image`, `audio`, `video`, and `document` under
   the existing `ta-N` lifecycle. PDF is the only initial `document` format.
2. Text bodies remain bounded strings in the aggregate. Binary bodies are copied
   at intake to a session-scoped asset repository below the Workshop sessions
   directory. Persisted state carries only an immutable asset reference,
   byte-length/digest evidence, asset kind, format, and display metadata.
3. Picker and drag-and-drop converge on one host-owned intake service. A dropped
   VS Code URI is passed as transient provenance. A pathless browser `File` is
   size-checked in the webview, transferred as an `ArrayBuffer` through one
   dedicated transient intake message, then independently revalidated by the
   host. No base64, data URL, or dropped bytes enter snapshots or persistence.
4. A provider-neutral `ModelMessage` contract permits string text or ordered
   content parts. Its binary parts carry asset references, not bytes or URLs.
5. `ConversationManager` and its archive retain provider-neutral parts so
   follow-up requests can rehydrate binary assets. Workshop persisted schema v3 and a
   conversation archive v2 make this change explicit; v1/v2 input migrates to
   the new current shape.
6. An `OpenRouterMultimodalMessageAdapter` resolves asset references through a
   narrow read port immediately before dispatch and produces provider-specific
   `image_url`, `input_audio`, `video_url`, or `file.file_data` content parts.
   Base64 is scoped to this ephemeral request object.
7. PDF delivery requires live `file` input evidence and explicitly selects
   OpenRouter's `native` PDF engine. Automatic or paid parser/OCR fallback is
   not allowed in v1. Provider-returned file annotations therefore do not join
   the durable conversation contract.
8. A model capability catalog retains live `input_modalities`. The host checks
   every staged binary kind against the current selected model immediately
   before dispatch. `unknown` and `unsupported` both refuse without a network
   call.
9. Existing room delivery, direct-tool privacy, commit-on-success, and retry
   semantics apply to all attachment kinds. Preflight and provider failures are
   atomic: the exact typed draft and complete staged attachment set remain for
   retry; no supported subset is sent alone.

### Durable ownership after the change

Binary assets extend the existing ownership model without duplicating bytes:

| Owner | Text or widget payload | Binary asset payload |
|---|---|---|
| Pending composer attachment | Inline bounded string | Immutable asset reference |
| Committed room thread artifact | Inline bounded string | Immutable asset reference |
| Retained participant conversation | String or provider-neutral text part | Provider-neutral asset part containing the same immutable reference |
| OpenRouter request | Text content | Ephemeral provider DTO containing materialized base64 |

Duplicating a small immutable reference across the room ledger and participant
history is deliberate: each owner can prove what it delivered without copying
the underlying binary body. The session-scoped asset repository is the only
durable byte owner.

`WorkshopThreadArtifact.kind` remains reserved for the existing
`widget:<registry-id>` classification. Text-versus-asset discrimination belongs
inside a nested artifact payload, so binary attachments do not counterfeit
widget identity.
An illustrative target is:

```ts
type WorkshopThreadArtifactPayload =
  | { type: 'text'; content: string }
  | {
      type: 'asset';
      assetKind: 'image' | 'audio' | 'video' | 'document';
      asset: WorkshopAttachmentAssetRef;
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

- One attachment lifecycle covers pasted prose and binary assets.
- Session JSON stays inspectable and bounded.
- Model changes and unsupported combinations fail before paid inference.
- Provider DTOs do not leak into Workshop or conversation ownership.
- Follow-up turns and late-joining participants retain access to the attachments that
  established their conversation context.
- A future provider can map the same model-message parts without changing the
  composer or Workshop aggregate.

### Costs

- Session storage becomes a JSON-plus-assets aggregate rather than a single
  self-contained file.
- Save-as/duplicate/delete/reset require coordinated asset lifecycle behavior.
- Conversation archive migration is broader than a request-only patch.
- Every asset read must validate containment, digest, type, and bound.
- Pathless operating-system drops require a bounded transient byte transfer from
  the webview to the host and therefore need explicit peak-memory qualification.
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

### Send a binary attachment once, then retain only a text marker

Rejected. Chat Completions is request-history based; later questions about an
image or recording would no longer carry the original input. This also breaks
Workshop's once-per-participant room-delivery promise.

### Upload to a public/private URL service

Rejected for this epic. It adds cloud retention, credentials, deletion policy,
and a privacy boundary unrelated to the requested local composer feature.

### Automatically parse PDFs for models without native file input

Rejected for v1. OpenRouter can make PDFs work with any model by invoking a PDF
parser, but its default fallback may use paid OCR and returns provider-specific
file annotations that should be replayed to avoid repeated parsing. Native-file
models keep the initial contract deterministic and avoid hidden parser spend.

### Put OpenRouter multipart DTOs directly in `ConversationManager`

Rejected. The manager is described as provider-neutral durable conversation
ownership; importing provider wire shapes would make that boundary untrue and
force Workshop persistence to track OpenRouter implementation details.

## Accepted product decisions

| Decision | Recommendation |
|---|---|
| Long-paste threshold | 2,000 characters in one `text/plain` paste event |
| Existing selected text during long paste | Leave the draft unchanged; the paste is an attachment action |
| Attachment-only send | Permit it; show generated transcript copy, send no invented text part |
| Repeated identical pasted text | Treat each paste as a distinct writer action; do not digest-deduplicate |
| Item/size limits | 3 items; 10 MiB image, 20 MiB audio, 50 MiB video, 20 MiB PDF, and 60 MiB binary aggregate per message |
| Initial formats | PNG/JPEG/WebP/GIF; WAV/MP3/AIFF/AAC/OGG/FLAC/M4A; MP4/MPEG/MOV/WebM; PDF |
| Intake surfaces | File picker and drag-and-drop for accepted local files; reject directories and URL-only drops |
| Pathless drop transport | One bounded transient `ArrayBuffer` intake message; never base64 or durable state |
| Mixed-capability failure | Reject the entire send and preserve the exact draft plus all staged attachment ids |
| Unknown capability | Fail closed and retain the draft and staged items |
| PDF delivery | Require native `file` capability and force the `native` PDF engine; no automatic/OCR parser fallback |
| Attachment previews | Type icon and metadata only in v1; no raw-byte webview previews |
| URL inputs | Defer remote URL attachment inputs; dropped local URI references are intake provenance only |
| Damaged committed asset | Visible degraded attachment; block only a request that needs it |

Changing any accepted limit or format is a policy revision, not an architecture
change, provided one canonical limits owner and the same fail-closed validation
boundaries remain intact.

## Follow-up decisions outside this epic

- Export/import packaging for a portable JSON-plus-assets bundle.
- Remote URL attachments and provider-specific URL routing.
- Universal PDF parsing for models without native `file` input, including
  parser-engine policy and reusable file-annotation ownership.
- Media transformation, compression, trimming, and thumbnails.
- Per-provider endpoint pinning when model-level modality evidence is
  insufficient.

## Evidence

- [OpenRouter PDF inputs](https://openrouter.ai/docs/guides/overview/multimodal/pdfs)
- [OpenRouter Models API](https://openrouter.ai/docs/api/api-reference/models/get-models)
- [VS Code typed-array webview transfer](https://code.visualstudio.com/updates/v1_57#_improved-webview-array-buffer-transfers)
- [Electron `File.path` replacement](https://www.electronjs.org/docs/latest/api/web-utils)
