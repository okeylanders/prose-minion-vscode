# Epic: Workshop Multimodal Composer

**Created:** 2026-09-03

**Status:** Active — Gate 00 complete; Sprint 01 ready

**Priority:** High

**Proposed integration branch:** `epic/workshop-multimodal-composer`

**Architecture runway:** [Workshop Multimodal Composer Architecture Change Runway](architecture-change-runway.md)

**Decision:** [ADR — Durable Multimodal Workshop Messages](../../../docs/adr/2026-09-03-durable-multimodal-workshop-messages.md)

## Problem

The Workshop composer already stages text files as one-shot attachments, but its
contracts, persistence, conversation history, and OpenRouter transport all assume
that a message is a string. The composer also lets a large paste expand inside
the textarea, even when the pasted material is better understood as source
material attached to the next turn.

OpenRouter's Chat Completions API accepts image, audio, video, and PDF content
parts. Prose Minion does not retain the model's input modalities, cannot fail
closed before an incompatible request, and has no safe durable representation
for local binary inputs.

## Goal

Make the Workshop composer a coherent one-shot attachment surface for:

- text files and configured text resources already supported today;
- long pasted plain text, rendered as a removable attachment pill above the
  compose box; and
- local image, audio, video, and PDF files delivered to compatible OpenRouter
  models through picker or drag-and-drop intake.

The implementation must preserve Workshop's current commit-on-success,
participant catch-up, privacy, persistence, and host-authority semantics.

## Proposed user experience

1. Pasting fewer than 2,000 characters behaves normally.
2. Pasting 2,000 or more characters stages `Pasted text` as a one-shot text
   attachment and leaves the existing draft text in place.
3. The `+` menu offers a binary-file picker alongside the existing text-resource
   paths. Dropping accepted local files on the composer uses the same intake and
   validation behavior.
4. Text, image, audio, video, and PDF attachments share one tray and one remove
   interaction. Pills show type-appropriate metadata; dropped bytes cross only
   the dedicated transient intake message when no URI is available.
5. The send affordance is enabled when the draft or at least one attachment is
   present. Attachment-only turns receive an honest presentation label without
   inventing an instruction for the model.
6. Unsupported or unverified modalities are blocked before network dispatch.
   The whole send is refused; the exact typed message and all staged attachments
   remain available for retry.
7. A failed or cancelled request likewise retains the exact typed message and
   every staged attachment.

The accepted 2,000-character threshold is an application policy, not a provider
constraint.

## Architectural direction

- Generalize the existing `ta-N` one-shot artifact rail with a discriminated
  attachment kind; do not build a second binary-only rail.
- Keep long pasted text and text-file bodies in the durable Workshop aggregate.
- Store binary attachments in a session-scoped, containment-checked asset directory;
  persist only immutable asset references and display metadata in JSON.
- Converge file picker and drag-and-drop on one host intake service. URI-bearing
  drops pass transient provenance; pathless drops use one bounded binary IPC
  message and are revalidated host-side before persistence.
- Introduce a provider-neutral multipart model-message contract. An OpenRouter
  adapter alone translates it to `text`, `image_url`, `input_audio`, and
  `video_url` or PDF `file.file_data` wire parts.
- Retain OpenRouter `architecture.input_modalities` in the model catalog and
  enforce capability checks host-side immediately before dispatch.
- Preserve asset references in retained conversation history so follow-up turns,
  room catch-up, and session restore can rehydrate the original content.

## Non-goals

- No image, audio, or video generation.
- No remote URL attachment input in the first release.
- No automatic PDF parsing or paid OCR fallback for models without native
  `file` input.
- No media thumbnails, waveform player, video player, editing, transcoding, or
  automatic compression.
- No global upload service, CDN, or cloud asset persistence.
- No attempt to promise every provider-specific format or size limit.
- No change to standing Workshop context; these remain one-message artifacts.
- No paid provider calls during automated verification.

## Locked invariants

1. `packages/core` remains free of `vscode` imports; VS Code remains the adapter
   and composition root.
2. The webview receives metadata and bounded text previews only. A pathless
   dropped `File` may leave the webview only as size-bounded `ArrayBuffer` data
   through the dedicated transient intake route; it is never restored there.
3. A model with unknown or missing modality evidence cannot receive a binary
   attachment. PDF additionally requires native `file` capability.
4. Base64 exists only in the ephemeral OpenRouter request DTO and is never
   logged, checkpointed, indexed, or posted over IPC.
5. `ta-N` remains the stable, monotonic address across text and binary artifacts.
6. Staged attachments are consumed only after a successful assistant turn;
   quick actions never consume them.
7. Room artifacts retain once-per-participant delivery. Direct-tool artifacts
   remain private.
8. A persisted asset reference is not filesystem authority: every read and
   delete re-proves session identity, containment, size, digest, and declared
   asset kind.
9. Existing schema-v1/v2 Workshop checkpoints remain readable through an
   explicit v2-to-v3 migration.
10. Asset deletion cannot make a previously committed checkpoint silently lie;
    missing or corrupt assets produce visible, scoped degradation.

## Delivery sequence

| Phase | Work unit | Purpose | Exit |
|---:|---|---|---|
| 0 | [Gate 00: Decisions and fitness baseline](sprints/00-decisions-and-fitness-gate.md) | Accept the ADR, lock UX limits/semantics, and pin current attachment behavior | No unresolved decision can reverse the implementation shape |
| 1 | [Typed artifacts and persistence v3](sprints/01-typed-artifacts-and-persistence-v3.md) | Introduce the discriminated attachment model and explicit checkpoint/archive migration | Legacy text-only sessions round-trip; new typed refs validate strictly |
| 2 | [Long-paste composer flow](sprints/02-long-paste-composer-flow.md) | Turn long clipboard text into an inspectable, editable one-shot pill | Long paste, short paste, remove, retry, reload, and attachment-only send are proven |
| 3 | [Binary attachment intake and asset lifecycle](sprints/03-media-intake-and-asset-lifecycle.md) | Validate picker/drop inputs, store bytes safely, and manage session-owned assets | Images, audio, video, and PDFs can stage, restore, duplicate, and delete without leaking durable bytes or paths |
| 4 | [Multimodal delivery and recovery](sprints/04-multimodal-delivery-and-recovery.md) | Carry multipart content through retained conversations, map it to OpenRouter, and preserve room/recovery semantics | Compatible requests have exact wire shapes, each participant receives each room artifact once, and degradation is scoped |
| 5 | [Release Gate 05: Qualification](sprints/05-release-qualification-gate.md) | Verify integrated accessibility, observability, limits, docs, packaging, and release evidence | Full automated gates pass and opt-in manual smoke evidence is recorded |

Work units are ordered. Sprint 02 is an independently reviewable text-only
checkpoint; multimodal enablement remains behind Sprint 03, Sprint 04, and the
release qualification gate. Sprint 04 may use separate transport and
room/recovery commits or PRs, but it has one exit because neither half is a
safely releasable feature alone.

## Suggested initial limits

These are application safety bounds, not claims about universal provider limits:

| Input | Per-item bound | Allowed initial formats |
|---|---:|---|
| Pasted/text attachment | 10,000 words | UTF-8 text |
| Image | 10 MiB | PNG, JPEG, WebP, GIF |
| Audio | 20 MiB | WAV, MP3, AIFF, AAC, OGG, FLAC, M4A |
| Video | 50 MiB | MP4, MPEG, MOV, WebM |
| Document | 20 MiB | PDF |
| One message | 3 items / 60 MiB binary total | Mixed modalities when the model supports all of them |

Gate 00 accepted these values. Validation must use one canonical limits object
rather than duplicating numbers across picker, handler, repository, and UI.

## Epic completion criteria

- [x] ADR is accepted and all Gate 00 product decisions are closed.
- [ ] Long paste becomes a one-shot text pill at the accepted threshold.
- [ ] Local image, audio, video, and PDF files can be staged and removed through
      the picker and drag-and-drop.
- [ ] Selected-model modality support is visible and enforced before dispatch.
- [ ] Provider-neutral history contains asset references, never provider DTOs or
      base64 strings.
- [ ] OpenRouter receives text first, then binary parts in deterministic pill
      order.
- [ ] Attachment-only messages work without fabricated prompt text.
- [ ] Retry/cancel, direct-tool privacy, and once-per-participant room delivery
      preserve current semantics.
- [ ] Current, named, duplicated, restored, deleted, and degraded sessions have
      tested asset lifecycles.
- [ ] Legacy released checkpoint fixtures still open and migrate deterministically.
- [ ] Architecture fitness witnesses confine raw-byte IPC to bounded transient
      drop intake and prevent persisted base64, provider DTO leakage, and
      unguarded binary dispatch.
- [ ] Focused tests, full Jest, all TypeScript projects, ESLint, production build,
      package verification, and `git diff --check` pass.
- [ ] Any live OpenRouter smoke test is explicitly approved, uses tiny fixtures,
      records the selected model/provider, and reports actual cost.

## Provider evidence reviewed on 2026-09-04

- [OpenRouter multimodal overview](https://openrouter.ai/docs/guides/overview/multimodal/overview)
- [Image inputs](https://openrouter.ai/docs/guides/overview/multimodal/image-understanding)
- [Audio inputs](https://openrouter.ai/docs/guides/overview/multimodal/audio)
- [Video inputs](https://openrouter.ai/docs/guides/overview/multimodal/videos)
- [PDF inputs](https://openrouter.ai/docs/guides/overview/multimodal/pdfs)
- [Models API](https://openrouter.ai/docs/api/api-reference/models/get-models)
