/** File-edit trailers for tests (made-up text: Alice). */

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
