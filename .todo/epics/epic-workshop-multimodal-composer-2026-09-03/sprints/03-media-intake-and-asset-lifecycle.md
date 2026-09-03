# Sprint 03: Media Intake and Asset Lifecycle

**Status:** Planned

**Proposed branch:** `sprint/workshop-multimodal-composer-03-media-assets`

**Depends on:** Sprint 01 typed artifacts; Gate 00 accepted limits

**Blocks:** Sprint 04 and the release qualification gate

## Goal

Safely ingest local image, audio, and video files into session-owned durable
storage without exposing bytes or authority-bearing paths to the webview.

## Deliverables

1. Add a narrow `WorkshopMediaAssetRepository` behind the existing `FileSystem`
   and `Workspace` ports. It alone constructs asset paths and owns atomic write,
   verified read, copy, and scoped delete.
2. Store assets below
   `prose-minion/sessions/assets/<session-id>/` using host-minted opaque names.
   Persist SHA-256, byte length, media kind, format, and storage key; never trust
   an incoming path as an asset id.
3. Extend the host picker route for the accepted local formats. Read bytes only
   after a bounded stat; validate extension/format and signature where a stable
   signature exists; reject mismatches, directories, empty files, and oversize
   payloads before state mutation.
4. Stage the metadata record only after the asset write succeeds. If aggregate
   staging fails, compensate by removing only the newly written unreferenced
   asset.
5. Make remove/reset/delete clean session-owned unreferenced assets. Make named
   duplication deep-copy assets to the new session identity before committing
   the duplicate checkpoint. Rename keeps the session identity and assets.
6. On activation/open, verify referenced asset existence and metadata without
   loading every body. Missing/corrupt assets become scoped degradation records.
7. Add kind-specific pills using icons, label, format, and formatted byte size.
   Complete narrow-sidebar layout, mixed-kind wrapping, pending/degraded states,
   keyboard removal, focus behavior, and screen-reader copy in this slice. Do
   not ship thumbnails or playback.

## Repository contract sketch

The repository accepts a picker URI only as transient intake provenance. A
durable media attachment stores the returned reference and never stores or
re-reads the original URI.

```ts
interface WorkshopMediaAssetRepository {
  importAsset(input: {
    sessionId: string;
    sourceUri: string;
    mediaKind: 'image' | 'audio' | 'video';
    maximumBytes: number;
  }): Promise<WorkshopMediaAssetRef>;

  verify(ref: WorkshopMediaAssetRef): Promise<WorkshopMediaAssetVerification>;

  readVerified(ref: WorkshopMediaAssetRef): Promise<Uint8Array>;

  copyToSession(
    ref: WorkshopMediaAssetRef,
    targetSessionId: string
  ): Promise<WorkshopMediaAssetRef>;

  delete(ref: WorkshopMediaAssetRef): Promise<void>;
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
the durable media record, webview snapshot, prompt history, or provider request.

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

## Completion criteria

- [ ] Media stages and survives reload without source-file dependence.
- [ ] Session JSON and webview traffic contain metadata/refs only.
- [ ] Asset reads and deletes re-prove containment, digest, kind, and bound.
- [ ] Lifecycle operations are recoverable and never cross a session boundary.
- [ ] Repository, storage, coordinator, route, UI, architecture, and diff gates pass.

## Rollback seam

Hide the media picker and refuse new media intake. Retain schema-v3 media
decoding and read-only degradation so checkpoints created during development
remain explainable.
