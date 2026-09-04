# Sprint 04: Multimodal Delivery and Recovery

**Status:** Planned

**Proposed branch:** `sprint/workshop-multimodal-composer-04-delivery-recovery`

**Depends on:** Sprint 01 typed messages and Sprint 03 asset repository

**Blocks:** Release qualification gate

## Goal

Deliver ordered binary attachment content to compatible OpenRouter models and preserve it
through Workshop room catch-up, participant history, restore, failure, and
damaged storage. Provider vocabulary remains at the transport boundary, and
unsupported requests are refused before inference.

## Deliverables

1. Retain and normalize live `architecture.input_modalities` in
   `OpenRouterModel`, `ModelOption`, and a host-owned capability catalog.
   Routing suffixes resolve to their base-model evidence as current metadata
   lookup already does.
2. Represent capability as `supported | unsupported | unknown` per modality,
   including OpenRouter's `file` input for PDF documents.
   Fallback/offline metadata and missing custom-model evidence are `unknown`.
3. Preflight the complete staged set against the model selected at dispatch
   time. A failed preflight rejects the complete send, emits an actionable
   error, preserves the exact typed draft and every staged attachment id, and
   makes zero provider calls. Never dispatch a supported subset.
4. Let the Workshop turn assembler produce ordered provider-neutral parts:
   writer text first when present, trusted textual artifact frames next, then
   binary asset references in pill order.
5. Carry multipart user content through `AssistantToolService`,
   `AgentRunEngine`, `ConversationManager`, atomic commit, export, and import.
   Agent-generated correction/evidence turns remain text.
6. Add `OpenRouterMultimodalMessageAdapter` to resolve verified asset bytes and
   emit exact Chat Completions parts:
   - image -> `image_url.url` data URL;
   - audio -> `input_audio.data` raw base64 plus `format`;
   - video -> `video_url.url` data URL;
   - PDF document -> `file.file_data` data URL plus filename.
7. For PDF requests, require live native `file` capability and explicitly set
   the OpenRouter `file-parser` PDF engine to `native`. Do not allow automatic,
   Cloudflare, or paid OCR parser fallback in v1, and do not persist provider
   file annotations.
8. Ensure both streaming and non-streaming clients use the same request DTO
   builder. No raw/base64 payload appears in error strings, observations, or logs.
9. Classify provider rejection without consuming the typed draft or staged
   items; mention that
   model/provider format limits may be narrower than the application allowlist.
10. Extend room-delivery preparation to return text catch-up plus the ordered
   asset references belonging to delivered `ta-N` artifacts.
11. Deliver each committed room binary artifact once to the host and each live or
   later-joining guest according to existing turn offsets. A participant's
   retained conversation keeps the reference for subsequent turns.
12. Keep direct-tool binary attachments private and absent from the room artifact ledger.
13. Acknowledge the room-delivery prefix only after the participant's assistant
   turn commits. Failure or cancellation retries the same turn/artifact set.
14. Record honest writer-source manifest metadata for binary assets without estimating
   character counts from binary bodies.
15. Define scoped degradation:
    - a pending missing asset remains visible and removable but blocks its send;
    - a committed missing asset marks that artifact unavailable;
    - only a participant request requiring the unavailable artifact is blocked
      or conversation-degraded;
    - unrelated text turns and other participants remain usable.
16. Ensure tombstone/session-reset flows retire references before deleting
    bytes, and prevent an old checkpoint from silently referencing
    already-collected assets.
17. Surface the selected model's current modality verdict in the composer
    without treating stale fallback evidence as support. Model changes update
    the visible verdict immediately.
18. Add bounded operational logs for capability verdict, request part
    kinds/count, asset verification failure, delivery retry, and scoped
    degradation. Never log content, absolute paths, full digests, or base64.

## Neutral-to-provider mapping example

The durable conversation stores semantic content and an asset reference:

```ts
const archivedMessage: ModelMessage = {
  role: 'user',
  content: [
    {
      type: 'text',
      text: 'What does this image suggest about the character?'
    },
    {
      type: 'asset',
      artifactId: 'ta-8',
      assetKind: 'image',
      asset: {
        sessionId: 'session-123',
        storageKey: 'asset-f147c9',
        sha256: '88d32c...',
        byteLength: 482193,
        assetKind: 'image',
        mimeType: 'image/png',
        format: 'png'
      }
    }
  ]
};
```

Only `OpenRouterMultimodalMessageAdapter` may turn that reference into wire
syntax. After capability preflight succeeds, it calls `readVerified`, keeps the
bytes/base64 local to request construction, and emits one of these ephemeral
parts:

```ts
// image
{
  type: 'image_url',
  image_url: {
    url: 'data:image/png;base64,<ephemeral-base64>'
  }
}

// audio
{
  type: 'input_audio',
  input_audio: {
    data: '<ephemeral-base64>',
    format: 'mp3'
  }
}

// video
{
  type: 'video_url',
  video_url: {
    url: 'data:video/mp4;base64,<ephemeral-base64>'
  }
}

// PDF document
{
  type: 'file',
  file: {
    filename: 'notes.pdf',
    file_data: 'data:application/pdf;base64,<ephemeral-base64>'
  }
}
```

PDF requests also include the provider-owned `file-parser` plugin configuration
with `pdf.engine: 'native'`. The host refuses PDF dispatch unless current model
evidence reports `file` input, preventing OpenRouter from silently selecting a
fallback parser.

The provider DTO is never written back to `ConversationManager`. Base64 must not
cross the adapter return boundary except as the immediate request body, and
request observations must summarize binary attachments by artifact id, kind, format, and
byte length rather than serialize content.

Text-only messages retain the current string shape. Multipart turns order
writer text first when present, trusted text-artifact frames next, and binary
references in composer-pill order. Attachment-only turns contain no fabricated text
part; the visible transcript uses separate display copy owned by Workshop.

## Required wire tests

- Text only remains the existing string request shape where possible.
- Text + each binary kind, attachment only, multiple same-kind, and mixed-kind ordering.
- Audio uses raw base64 rather than a data URL; image/video use correct MIME data
  URLs; PDF uses the exact `file.file_data` shape and native engine policy.
- Unknown/unsupported modality, changed model between staging and send, corrupt
  asset, and provider rejection all retain the exact draft and staged state.
- Streaming serialization matches non-streaming serialization.
- Fixtures prove logs and persisted JSON contain no recognizable base64 payload.

## Required room and recovery scenarios

- Original host send, host catch-up, guest catch-up, late guest join, and
  post-restore follow-up all carry the correct binary assets exactly once.
- Direct-tool targets never publish their assets to room catch-up.
- Provider failure before commit, cancellation during stream, acknowledgement
  persistence failure, and retry preserve current contiguous-prefix semantics.
- Missing or corrupt assets on activation, named-session open, and participant
  catch-up yield visible scoped degradation without global session loss.
- Removing one turn or session cannot delete bytes still referenced by its
  durable checkpoint transaction.

## Completion criteria

- [ ] OpenRouter-specific content-part names exist only in the provider package.
- [ ] Capability refusal occurs immediately before dispatch and makes zero fetches.
- [ ] Exact request-body tests cover every accepted kind and mixed ordering.
- [ ] Conversation atomicity and cancellation remain green for multipart content.
- [ ] Room, direct-tool, retained-history, and restore semantics match the ADR.
- [ ] No silent text-only fallback hides missing binary attachments.
- [ ] Degradation is scoped, visible, and tested.
- [ ] Provider, engine, model-data, Workshop, architecture, type, lint, and diff
      gates pass.

## Rollback seam

Close binary dispatch at the capability gate. Preserve stored/staged metadata,
existing text-artifact room delivery, and read-only asset degradation. Text and
long-paste messages continue through their existing path.
