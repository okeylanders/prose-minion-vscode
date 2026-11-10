/** File-edit trailers and a fake staging port for tests (made-up text: Alice). */

import type { FileEditApplyOptions, FileEditApplyOutcome, FileEditApplyPort, StagedFileEdit } from '@/domain/models/FileEdit';
import type {
  FileEditStaging,
  FileEditStagingRefusal,
  FileEditStagingTarget
} from '@/domain/models/FileEditStaging';

export const QUOTE_SENTINEL = 'ZZQ-QUOTE';
export const WITH_SENTINEL = 'ZZQ-WITH';
export const PASSAGE_SENTINEL = 'ZZQ-PASSAGE';
export const WHY_SENTINEL = 'ZZQ-WHY';

export function fileEditFrame(fields: {
  group?: string | null;
  path?: string | null;
  excerpt?: boolean;
  why?: string | null;
  body?: string[];
} = {}): string {
  const target = fields.excerpt
    ? ['<excerpt/>']
    : [
      ...(fields.group === null ? [] : [`<group>${fields.group ?? 'characters'}</group>`]),
      ...(fields.path === null ? [] : [`<path>${fields.path ?? 'characters/alice.md'}</path>`])
    ];
  return [
    '<prose-minion-file-edit>',
    ...target,
    ...(fields.why === null ? [] : [`<why>${fields.why ?? 'Alice is ten now.'}</why>`]),
    ...(fields.body ?? ['<find>Alice is seven</find>', '<replace-with>Alice is ten</replace-with>']),
    '</prose-minion-file-edit>'
  ].join('\n');
}

/** An edit-offer trailer (ADR 2026-11-10 D1); `null` leaves an element out. */
export function editOfferFrame(fields: {
  kind?: string | null;
  group?: string | null;
  path?: string | null;
  excerpt?: boolean;
  count?: string | number | null;
  extra?: string[];
} = {}): string {
  const target = fields.excerpt
    ? ['<excerpt/>']
    : [
      ...(fields.group === null ? [] : [`<group>${fields.group ?? 'chapters'}</group>`]),
      ...(fields.path === null ? [] : [`<path>${fields.path ?? 'chapters/down-the-rabbit-hole.md'}</path>`])
    ];
  return [
    '<prose-minion-edit-offer>',
    ...(fields.kind === null ? [] : [`<kind>${fields.kind ?? 'fixes'}</kind>`]),
    ...target,
    ...(fields.count === null || fields.count === undefined ? [] : [`<count>${fields.count}</count>`]),
    ...(fields.extra ?? []),
    '</prose-minion-edit-offer>'
  ].join('\n');
}

/** A frame whose every text is a sentinel, for log and transcript checks. */
export function sentinelFileEditFrame(path = 'characters/alice.md'): string {
  return fileEditFrame({
    path,
    why: `Why ${WHY_SENTINEL}`,
    body: [
      `<find>Alice ${QUOTE_SENTINEL}</find>`,
      `<replace-with>Alice ${WITH_SENTINEL}</replace-with>`,
      `<append>More ${PASSAGE_SENTINEL}</append>`
    ]
  });
}

/** A fake staging port (ADR 2026-11-05 D4): stages every resource to a file under `/ws`, the excerpt to `chapter-1.md`, unless told to refuse. */
export function fakeFileEditStaging(options: {
  refuse?: (target: FileEditStagingTarget) => FileEditStagingRefusal | undefined;
  reject?: boolean;
  /** The room's excerpt document now, as the real service reads it at each call; `chapters/chapter-1.md` when absent. */
  excerptPath?: () => string;
} = {}): FileEditStaging & { calls: FileEditStagingTarget[]; resolutions: FileEditStagingTarget[] } {
  const calls: FileEditStagingTarget[] = [];
  const resolutions: FileEditStagingTarget[] = [];
  return {
    calls,
    resolutions,
    async resolve(target) {
      resolutions.push(target);
      if (options.reject) {
        throw new Error(`resolution failed for ${URI_SENTINEL}`);
      }
      const refusal = options.refuse?.(target);
      if (refusal) {
        return { kind: 'refused', reason: refusal };
      }
      const relativePath = target.kind === 'excerpt' ? options.excerptPath?.() ?? 'chapters/chapter-1.md' : target.path;
      return {
        kind: 'resolved',
        target: { kind: target.kind === 'excerpt' ? 'excerpt' : 'file', documentUri: `file:///ws/${URI_SENTINEL}/${relativePath}`, relativePath }
      };
    },
    async stage(target, staging) {
      calls.push(target);
      if (options.reject) {
        throw new Error(`staging failed for ${URI_SENTINEL}`);
      }
      const refusal = options.refuse?.(target);
      if (refusal) {
        return { kind: 'refused', reason: refusal };
      }
      if (target.kind === 'excerpt' && staging?.boundExcerpt) {
        // As the real service does (PR #252 F-03): the run's bound document, not the room's excerpt now.
        return { kind: 'staged', target: { ...staging.boundExcerpt }, class: 'prose', baseline: { sha256: 'a'.repeat(64), length: 42 } };
      }
      const relativePath = target.kind === 'excerpt' ? options.excerptPath?.() ?? 'chapters/chapter-1.md' : target.path;
      return {
        kind: 'staged',
        target: { kind: target.kind === 'excerpt' ? 'excerpt' : 'file', documentUri: `file:///ws/${URI_SENTINEL}/${relativePath}`, relativePath },
        class: target.kind === 'excerpt' || (target.kind === 'resource' && target.group === 'chapters') ? 'prose' : 'notes',
        baseline: { sha256: 'a'.repeat(64), length: 42 }
      };
    }
  };
}

export const URI_SENTINEL = 'zzq-uri';

/** A fake Apply port (ADR 2026-11-05 D7): records what it is asked, and answers each Apply `applied`, unless told otherwise. */
export function fakeFileEditApply(answer?: (staged: StagedFileEdit, options: FileEditApplyOptions) => Promise<FileEditApplyOutcome> | FileEditApplyOutcome): FileEditApplyPort & {
  applies: Array<{ staged: StagedFileEdit; options: FileEditApplyOptions }>;
  previews: StagedFileEdit[];
} {
  const applies: Array<{ staged: StagedFileEdit; options: FileEditApplyOptions }> = [];
  const previews: StagedFileEdit[] = [];
  return {
    applies,
    previews,
    async apply(staged, options) {
      applies.push({ staged, options });
      if (answer) {
        return answer(staged, options);
      }
      return {
        state: 'applied',
        operations: staged.operations.map((_, index) => ({ index, outcome: 'landed' as const })),
        landed: staged.operations.map((_, index) => ({ operation: index, beforeSha256: 'b'.repeat(64), afterSha256: 'c'.repeat(64) })),
        revealed: false,
        message: 'Applied. The file is not saved yet.'
      };
    },
    async preview(staged) {
      previews.push(staged);
      return { kind: 'refused', reason: 'not-a-rewrite' };
    }
  };
}
