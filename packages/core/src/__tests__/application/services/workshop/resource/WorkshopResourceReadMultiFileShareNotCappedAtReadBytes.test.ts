/**
 * A file's share inside a multi-file read is NOT capped at the one-file
 * `readBytes` (ADR 2026-11-14 D5, as written; confirmed in PR #263's
 * review). The files of a read naming two or more share `readBytesMulti`,
 * and a short file leaves its room to the others. So a line no one-path
 * read can ever deliver can land beside a small file. The window fit still
 * bounds the whole read.
 *
 * This suite exists to make that choice explicit. If a file's share is ever
 * capped at `readBytes`, these cases change on purpose, with the ADR.
 */

import { createHash } from 'crypto';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  aliceCapability,
  aliceLines,
  fileRow,
  hintsIn,
  manuscript,
  sectionOf,
  windowWith
} from '@/__tests__/application/services/workshop/resource/resourceReadFixtures';

const budgets = PROMPT_BUDGETS.workshopResource;
const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

/** One line of 70 KiB: over the one-file `readBytes`, well under `readBytesMulti`. */
const LINE_BYTES = 70 * 1024;
const LONG = 'curiouser and curiouser '.repeat(Math.ceil(LINE_BYTES / 24)).slice(0, LINE_BYTES);
const SMALL = aliceLines(10, 60, 'Small');
const project = [manuscript('alice-long-line.md', LONG), manuscript('alice-small.md', SMALL)];

describe('a multi-file read shares readBytesMulti; a file\'s share is not capped at the one-file readBytes', () => {
  it('holds the premise: the line is over readBytes, and the two files together are within readBytesMulti', () => {
    expect(LINE_BYTES).toBeGreaterThan(budgets.readBytes);
    expect(LINE_BYTES + Buffer.byteLength(SMALL, 'utf8')).toBeLessThan(budgets.readBytesMulti);
  });

  it.each([
    ['an ample window', windowWith(2_000_000)],
    ['an unknown window', undefined]
  ])('named alone, the file is line-too-long: a one-path read holds at most readBytes (%s)', async (_label, window) => {
    const { capability, read } = aliceCapability(project);

    const result = await read(['alice-long-line.md'], { window });

    expect(result.status).toBe('failed');
    expect(result.metadata).toMatchObject({
      outcome: 'line-too-long', line: 1, lineBytes: LINE_BYTES, shareBytes: budgets.readBytes, filesRead: 0
    });
    expect(result.content).not.toContain('curiouser');
    expect(capability.deliveredSources(result)).toEqual([]);
    expect(hintsIn(result)).toEqual([]);
  });

  it.each([
    ['an ample window', windowWith(2_000_000)],
    ['an unknown window', undefined]
  ])('named beside a small file, the same file is delivered whole: its share is more than readBytes (%s)', async (_label, window) => {
    const { capability, read } = aliceCapability(project);

    const result = await read(['alice-long-line.md', 'alice-small.md'], { window });

    expect(result.status).toBe('success');
    expect(result.metadata).toMatchObject({ filesNamed: 2, filesRead: 2, limitedBy: 'read-budget', limitBytes: budgets.readBytesMulti });
    expect(fileRow(result, 'alice-long-line.md')).toMatchObject({
      outcome: 'read', startLine: 1, endLine: 1, totalLines: 1, bytes: LINE_BYTES, truncated: false
    });
    // The delivered bytes are more than any one-path read holds.
    expect(fileRow(result, 'alice-long-line.md').bytes as number).toBeGreaterThan(budgets.readBytes);
    expect(sectionOf(result, 'alice-long-line.md')).toContain('curiouser and curiouser');
    expect(fileRow(result, 'alice-small.md')).toMatchObject({ outcome: 'read', startLine: 1, endLine: 10 });
    expect(capability.deliveredSources(result)).toEqual([
      expect.objectContaining({ label: 'alice-long-line.md', lineRange: { start: 1, end: 1 }, sourceFingerprint: sha256(LONG) }),
      expect.objectContaining({ label: 'alice-small.md', lineRange: { start: 1, end: 10 }, sourceFingerprint: sha256(SMALL) })
    ]);
    expect(hintsIn(result)).toEqual([]);
  });

  it('is still bounded by the window fit: with too little room the line stays undelivered beside the small file', async () => {
    const { capability, read } = aliceCapability(project);
    // Half of 20,000 tokens holds about 40 KB of evidence: less than the line.
    const result = await read(['alice-long-line.md', 'alice-small.md'], { window: windowWith(20_000) });

    expect(result.status).toBe('partial');
    expect(result.metadata).toMatchObject({ limitedBy: 'context-window', filesRead: 1 });
    expect(fileRow(result, 'alice-long-line.md')).toMatchObject({ outcome: 'line-too-long', line: 1, lineBytes: LINE_BYTES });
    expect(result.content).not.toContain('curiouser');
    expect(capability.deliveredSources(result).map((row) => row.label)).toEqual(['alice-small.md']);
  });
});
