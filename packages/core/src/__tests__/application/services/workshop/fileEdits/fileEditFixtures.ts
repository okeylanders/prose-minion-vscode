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
} = {}): FileEditStaging & { calls: FileEditStagingTarget[] } {
  const calls: FileEditStagingTarget[] = [];
  return {
    calls,
    async stage(target) {
      calls.push(target);
      if (options.reject) {
        throw new Error(`staging failed for ${URI_SENTINEL}`);
      }
      const refusal = options.refuse?.(target);
      if (refusal) {
        return { kind: 'refused', reason: refusal };
      }
      const relativePath = target.kind === 'excerpt' ? 'chapters/chapter-1.md' : target.path;
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
