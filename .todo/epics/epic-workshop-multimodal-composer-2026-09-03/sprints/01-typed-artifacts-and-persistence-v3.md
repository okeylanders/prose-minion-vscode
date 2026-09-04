# Sprint 01: Typed Artifacts and Persistence v3

**Status:** Planned

**Proposed branch:** `sprint/workshop-multimodal-composer-01-typed-artifacts`

**Depends on:** Gate 00 accepted ADR and limits

**Blocks:** Sprints 02-04

## Goal

Replace the text-only attachment and conversation assumptions with strict,
provider-neutral discriminated contracts while preserving all existing behavior.

## Deliverables

1. Introduce a canonical composer-attachment union with common display metadata
   and kind-specific text or immutable asset-reference fields, including PDF as
   the first `document` kind.
2. Keep `WorkshopTurn` and webview snapshots display-safe; add kind, byte/word
   size, and degradation metadata without content or host paths.
3. Generalize thread-artifact records so text frames and binary asset references share
   `ta-N` identity without pretending binary bytes are text.
4. Introduce provider-neutral `ModelMessage`/content-part contracts under API
   orchestration. Remove `ConversationManager`'s dependency on
   `OpenRouterMessage`.
5. Define conversation archive v2 with string-compatible text messages and
   durable binary-reference parts.
6. Add Workshop persisted session v3 and an explicit v2-to-v3 migration. Preserve
   the released v1-to-v2 decoder and fixture.
7. Update clone, shape, integrity, counter, summary/search, and snapshot code.
   Search indexes may include labels and textual summaries, never binary data.

## Illustrative target contracts

Implementation may refine local names, but Sprint 01 must preserve this accepted
ownership shape:

```ts
type WorkshopBinaryAssetKind = 'image' | 'audio' | 'video' | 'document';

interface WorkshopAttachmentAssetRef {
  sessionId: string;
  storageKey: string;
  sha256: string;
  byteLength: number;
  assetKind: WorkshopBinaryAssetKind;
  mimeType: string;
  format: string;
}

interface WorkshopComposerAttachmentBase {
  id: string; // ta-N
  label: string;
}

type WorkshopComposerAttachment = WorkshopComposerAttachmentBase &
  (
    | {
        attachmentKind: 'pasted-text';
        words: number;
        content: string;
      }
    | {
        attachmentKind: 'text-file';
        words: number;
        content: string;
        relativePath?: string;
        sourceUri?: string; // host-private provenance hint, never authority
        truncation?: { keptWords: number; totalWords: number };
      }
    | {
        attachmentKind: WorkshopBinaryAssetKind;
        asset: WorkshopAttachmentAssetRef;
      }
  );

type WorkshopThreadArtifactPayload =
  | { type: 'text'; content: string }
  | {
      type: 'asset';
      assetKind: WorkshopBinaryAssetKind;
      asset: WorkshopAttachmentAssetRef;
    };

interface WorkshopThreadArtifactV2 {
  id: string;
  turnId: string;
  kind?: string; // reserved for widget:<registry-id>
  name: string;
  payload: WorkshopThreadArtifactPayload;
}

interface ModelMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ModelContentPart[];
}

type ModelContentPart =
  | { type: 'text'; text: string }
  | {
      type: 'asset';
      artifactId: string;
      assetKind: WorkshopBinaryAssetKind;
      asset: WorkshopAttachmentAssetRef;
    };
```

The persisted aggregate and conversation archive may repeat an immutable asset
reference, but neither may contain the referenced bytes. `WorkshopTurn` and
webview snapshots project only display metadata: artifact id, label, attachment
kind, word or byte size, format, and availability/degradation state. They omit
text bodies, asset storage keys, digests, source URIs, and host paths.

## Required migration mapping

- Decode released v1 through the existing v1-to-v2 migration, then migrate the
  resulting v2 object to v3.
- Convert every existing pending message attachment to `text-file`, preserving
  its bounded content and existing provenance/truncation metadata. Migration
  creates no `document` attachment from a legacy text file.
- Convert every existing `WorkshopThreadArtifact.content` to
  `payload: { type: 'text', content }`. Preserve an existing outer
  `kind: widget:<registry-id>` exactly; do not reuse `kind` as the asset
  discriminant.
- Keep existing archived conversation message strings as strings. Migration
  creates no multipart entries and writes no asset files.
- Emit only schema v3 and conversation archive v2 after a successful migration;
  never partially rewrite one owner without the other.

## Required tests

- Legacy released v1 fixture -> v2 -> v3 opens and rewrites deterministically.
- Existing v2 text attachments become the correct typed text-file records.
- Unknown discriminants, extra fields, invalid `ta-N` ids, malformed digests,
  cross-session refs, attachment/asset-kind mismatches, and mismatched size
  fields fail at the raw boundary.
- Conversation archives still require complete user/assistant exchanges and a
  sole leading runtime system message.
- Defensive cloning proves callers cannot mutate nested content parts or asset
  references.
- Text-only export/import remains byte-semantically equivalent after migration.

## Completion criteria

- [ ] No UI or provider behavior changes yet.
- [ ] All current text attachment suites remain green with the typed contract.
- [ ] Current writers emit schema v3; v1/v2 readers remain explicit and tested.
- [ ] No provider-specific field name exists outside the OpenRouter boundary.
- [ ] Full persistence, conversation-manager, Workshop, type, lint, and diff
      gates pass.

## Rollback seam

Before any schema-v3 checkpoint is released, revert the sprint. After release,
retain the v3 decoder even if later binary slices roll back.
