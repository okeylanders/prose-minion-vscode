import type { ContextPathGroup } from '@shared/types/context';

/** What a frame names (ADR 2026-11-05 D2): a configured resource by catalog key, or the room's excerpt. Never a path or URI to trust. */
export type FileEditStagingTarget =
  | { readonly kind: 'resource'; readonly group: ContextPathGroup; readonly path: string }
  | { readonly kind: 'excerpt' };

/** Prose or notes, decided by identity (D5). */
export type FileEditClass = 'prose' | 'notes';

/** The host-owned identity (D4.3). `documentUri` is host-written and never reaches the webview. */
export interface FileEditIdentity {
  readonly kind: 'file' | 'excerpt';
  readonly documentUri: string;
  readonly relativePath: string;
}

/** SHA-256 (hex) and UTF-16 length of the planner's content: after front matter, surrounding whitespace trimmed (D6). */
export interface FileEditBaseline {
  readonly sha256: string;
  readonly length: number;
}

export const FILE_EDIT_STAGING_REFUSALS = [
  'unknown-group',
  'unsafe-path',
  'not-configured',
  'ambiguous-target',
  'outside-workspace',
  'not-text',
  'too-large',
  'catalog-unreadable',
  'excerpt-not-a-file',
  'unreadable'
] as const;
export type FileEditStagingRefusal = typeof FILE_EDIT_STAGING_REFUSALS[number];

export type FileEditStagingResult =
  | {
      readonly kind: 'staged';
      readonly target: FileEditIdentity;
      readonly class: FileEditClass;
      readonly baseline: FileEditBaseline;
    }
  | { readonly kind: 'refused'; readonly reason: FileEditStagingRefusal };

/** A target resolved to its identity alone (ADR 2026-11-10 D2): no text is read, so there is no class or baseline. */
export type FileEditResolutionResult =
  | { readonly kind: 'resolved'; readonly target: FileEditIdentity }
  | { readonly kind: 'refused'; readonly reason: FileEditStagingRefusal };

export interface FileEditStagingOptions {
  /**
   * The document `<excerpt/>` names for this reply, when its run was bound
   * to one (the answer to a reply's excerpt offer, ADR 2026-11-10 D2; PR
   * #252 F-03): a host-held identity, recorded when the offer's reply was
   * read. An excerpt target is then staged against it, by the same rules,
   * whatever the room's excerpt is now, so a later excerpt never retargets
   * it. A resource target is not affected.
   */
  readonly boundExcerpt?: FileEditIdentity;
}

/** Staging (D4): called once per frame when a reply is read. It never rejects; a failure is a refusal. */
export interface FileEditStaging {
  stage(target: FileEditStagingTarget, options?: FileEditStagingOptions): Promise<FileEditStagingResult>;
  /**
   * The identity `stage` would give the target, by the same rules (D4), with
   * no baseline: the file's text is never read. For what names a file without
   * yet editing it (a reply's edit offer, ADR 2026-11-10 D2).
   */
  resolve(target: FileEditStagingTarget): Promise<FileEditResolutionResult>;
}
