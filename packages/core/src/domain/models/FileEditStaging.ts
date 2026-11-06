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

/** Staging (D4): called once per frame when a reply is read. It never rejects; a failure is a refusal. */
export interface FileEditStaging {
  stage(target: FileEditStagingTarget): Promise<FileEditStagingResult>;
}
