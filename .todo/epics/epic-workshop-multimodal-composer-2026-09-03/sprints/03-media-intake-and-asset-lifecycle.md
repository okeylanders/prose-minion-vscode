# Sprint 03: Binary Attachment Intake and Asset Lifecycle

**Status:** Planned

**Proposed branch:** `sprint/workshop-multimodal-composer-03-media-assets`

**Depends on:** Sprint 01 typed artifacts; Gate 00 accepted limits

**Blocks:** Sprint 04 and the release qualification gate

## Goal

Safely ingest local image, audio, video, and PDF files through the picker or
drag-and-drop into session-owned durable storage without persisting bytes or
authority-bearing paths in the webview.

## Deliverables

1. Add a narrow `WorkshopAttachmentAssetRepository` behind the existing
   `FileSystem` and `Workspace` ports. It alone constructs asset paths and owns
   atomic write, verified read, copy, and scoped delete.
2. Store assets below
   `prose-minion/sessions/assets/<session-id>/` using host-minted opaque names.
   Persist SHA-256, byte length, asset kind, format, and storage key; never trust
   an incoming path as an asset id.
3. Extend the host picker route for the accepted local formats, including PDF.
   Read bytes only after a bounded stat; validate extension/format and signature
   where a stable signature exists; reject mismatches, directories, empty files,
   and oversize payloads before state mutation.
4. Add composer drag-and-drop for accepted local text and binary files. Preserve
   ordinary text dragging/pasting. Reject directories, URL-only drops, unsupported
   files, and over-limit batches with visible feedback.
5. Route URI-bearing VS Code Explorer drops through the same host file intake as
   the picker. For a pathless browser `File`, check its declared size and the
   current batch aggregate before reading it, transfer one `ArrayBuffer` through
   a dedicated transient intake message, and independently validate its size,
   signature, MIME hint, and format host-side. Filename and MIME are hints only.
   The transient bytes must never enter snapshots, logs, or persistence.
6. Stage the metadata record only after the asset write succeeds. If aggregate
   staging fails, compensate by removing only the newly written unreferenced
   asset.
7. Make remove/reset/delete clean session-owned unreferenced assets. Make named
   duplication deep-copy assets to the new session identity before committing
   the duplicate checkpoint. Rename keeps the session identity and assets.
8. On activation/open, verify referenced asset existence and metadata without
   loading every body. Missing/corrupt assets become scoped degradation records.
9. Add kind-specific pills using icons, label, format, and formatted byte size.
   Complete narrow-sidebar layout, mixed-kind wrapping, pending/degraded states,
   picker/drop focus behavior, keyboard removal, and screen-reader copy in this
   slice. Do not ship thumbnails, document previews, or playback.

## Repository contract sketch

The repository accepts a picker URI only as transient intake provenance. A
durable binary attachment stores the returned reference and never stores or
re-reads the original URI.

A browser `File` supplies `name`, `size`, `lastModified`, a MIME `type` that may
be empty or inaccurate, and readable bytes. It does not standardly expose the
original filesystem URI or path. VS Code Explorer drops may separately provide
`text/uri-list`; operating-system drops may not. Neither the filename nor MIME
hint is accepted as format proof.

```ts
interface WorkshopAttachmentAssetRepository {
  importAsset(input: {
    sessionId: string;
    source:
      | { type: 'uri'; sourceUri: string }
      | { type: 'bytes'; fileName: string; mimeType?: string; bytes: Uint8Array };
    assetKind: 'image' | 'audio' | 'video' | 'document';
    maximumBytes: number;
  }): Promise<WorkshopAttachmentAssetRef>;

  verify(ref: WorkshopAttachmentAssetRef): Promise<WorkshopAssetVerification>;

  readVerified(ref: WorkshopAttachmentAssetRef): Promise<Uint8Array>;

  copyToSession(
    ref: WorkshopAttachmentAssetRef,
    targetSessionId: string
  ): Promise<WorkshopAttachmentAssetRef>;

  delete(ref: WorkshopAttachmentAssetRef): Promise<void>;
}
```

Only this repository resolves `sessionId` plus opaque `storageKey` into a
physical path. Every operation re-proves session-root containment. The
coordinator proves a reference is no longer used before requesting `delete`;
the repository then proves that the resolved target belongs to that reference's
session before touching it.

Intake is ordered as one compensatable transaction:

1. Bound and validate the selected source without mutating session state.
2. Copy the accepted bytes to a host-minted session asset and calculate the
   digest from the bytes actually stored.
3. Stage the returned immutable reference in the Workshop aggregate.
4. If step 3 fails, delete only the newly written, still-unreferenced asset.

`sourceUri` may appear in diagnostics before acceptance but must not appear in
the durable asset record, webview snapshot, prompt history, or provider request.
Raw dropped bytes may appear only in the dedicated intake message and repository
call; diagnostics record bounded kind/size outcomes, never content.

## Failure and race tests

- Stat/read/write/rename/delete failure at each lifecycle boundary.
- Source changes between stat and read; accepted bytes are identified by the
  digest actually stored, not by the earlier stat.
- Path traversal, crafted storage key, symlink/virtual-filesystem behavior, and
  a session id that resembles a path.
- Duplicate session copy fails halfway: neither a valid partial checkpoint nor
  another session's assets are deleted.
- Autosave races with remove/send; serialized mutation observes one coherent
  attachment-plus-asset state.
- Two sessions reference identical bytes but cannot delete one another's copy.
- VS Code Explorer URI drop and pathless operating-system `File` drop converge
  on identical stored metadata and pills.
- A forged MIME type/extension, empty browser `File`, oversized declared size,
  oversized actual buffer, URL-only drop, directory, and mixed batch over the
  aggregate limit all fail before aggregate mutation.
- Transient dropped bytes are absent from restored webview state, snapshots,
  logs, and persisted session JSON.

## Completion criteria

- [ ] Picker and drag-and-drop images, audio, video, and PDFs stage and survive
      reload without source-file dependence.
- [ ] Session JSON and webview traffic contain metadata/refs only.
- [ ] Asset reads and deletes re-prove containment, digest, kind, and bound.
- [ ] Lifecycle operations are recoverable and never cross a session boundary.
- [ ] Repository, storage, coordinator, route, UI, architecture, and diff gates pass.

## Rollback seam

Hide binary picker/drop intake and refuse new binary attachments. Retain schema-v3 asset
decoding and read-only degradation so checkpoints created during development
remain explainable.
