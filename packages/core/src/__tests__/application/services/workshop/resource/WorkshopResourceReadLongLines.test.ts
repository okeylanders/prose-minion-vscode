/**
 * A line that does not fit (ADR 2026-11-14 D2a; PR #259 F-01). A line is
 * never cut: one longer than its file's share is that file's own outcome,
 * `line-too-long`, it counts as not delivered, and every hint the read
 * writes makes progress. A continuation never repeats its own request.
 */

import { createHash } from 'crypto';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { CapabilityContextWindow } from '@orchestration/AgentRunContracts';
import {
  aliceCapability,
  AliceFile,
  aliceLines,
  decodeHint,
  fileRow,
  hintsIn,
  manuscript,
  ResourceReadRequest,
  sectionOf,
  windowWith
} from '@/__tests__/application/services/workshop/resource/resourceReadFixtures';

const budgets = PROMPT_BUDGETS.workshopResource;
const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

/** One line of `bytes` bytes of prose. */
const longLine = (bytes: number): string => 'curiouser and curiouser '.repeat(Math.ceil(bytes / 24)).slice(0, bytes);
/** Longer than any read holds. */
const OVER_READ = longLine(70 * 1024);
/** Within a one-path read, but more than a fifth of a multi-file read. */
const OVER_SHARE = longLine(60 * 1024);
const GOOD = aliceLines(10, 60, 'Good');

describe('a line longer than any read holds', () => {
  it('alone, with nothing after it: line-too-long, failed, no row and no hint', async () => {
    const { capability, read } = aliceCapability([manuscript('alice-ch1.md', OVER_READ)]);

    const result = await read(['alice-ch1.md']);

    expect(result.status).toBe('failed');
    expect(result.error).toBe('The line does not fit this read. No text was delivered.');
    expect(result.content).toContain(
      `Not read: line 1 of 1 is ${(70 * 1024).toLocaleString('en-US')} bytes, more than the ` +
      `${budgets.readBytes.toLocaleString('en-US')} bytes this read had. A line is never cut, so no text was delivered for this file.`
    );
    expect(result.content).toContain(`A read of one file holds at most ${budgets.readBytes.toLocaleString('en-US')} bytes, so line 1 cannot be read on its own.`);
    expect(result.content).not.toContain('curiouser');
    expect(result.metadata).toMatchObject({
      outcome: 'line-too-long', line: 1, lineBytes: 70 * 1024, shareBytes: budgets.readBytes, filesRead: 0,
      files: [{ group: 'manuscript', path: 'alice-ch1.md', outcome: 'line-too-long', line: 1, lineBytes: 70 * 1024, shareBytes: budgets.readBytes, totalLines: 1 }]
    });
    // Not delivered: no line range in the card's metadata, no row, no fingerprint.
    expect(result.metadata).not.toHaveProperty('startLine');
    expect(result.metadata).not.toHaveProperty('endLine');
    expect(capability.deliveredSources(result)).toEqual([]);
    expect(hintsIn(result)).toEqual([]);
  });

  it('with a later line: no hint at that line, and the next line\'s call, in words that say it passes over', async () => {
    const { capability, read } = aliceCapability([manuscript('alice-ch1.md', `${OVER_READ}\nThe second line.\nThe third.`)]);

    const result = await read(['alice-ch1.md']);

    expect(result.status).toBe('failed');
    expect(result.content).toContain('To read on from line 2, passing over line 1 unread, send this call alone:');
    const hints = hintsIn(result).map(decodeHint);
    expect(hints).toEqual([{ capability: 'resource.read', files: [{ group: 'manuscript', path: 'alice-ch1.md' }], startLine: 2 }]);
    expect(capability.deliveredSources(result)).toEqual([]);

    // Following it reads on, and never meets line 1 again.
    const next = await read(['alice-ch1.md'], { startLine: hints[0].startLine });
    expect(next.status).toBe('success');
    expect(next.metadata).toMatchObject({ startLine: 2, endLine: 3 });
    expect(next.content).toContain('The second line.');
  });

  it('beside good files: partial, and only the good files have a row and a fingerprint', async () => {
    // Four chapters that each want more than a fifth of the read, so the long line's share is about 51 KiB.
    const chapter = (tag: string): string => aliceLines(400, 199, tag);
    const good = ['alice-ch2.md', 'alice-ch3.md', 'alice-ch4.md', 'alice-ch5.md'];
    const long = `${OVER_READ}\nAfter it.`;
    const { capability, read } = aliceCapability([manuscript('alice-ch1.md', long), ...good.map((path) => manuscript(path, chapter(path)))]);

    const result = await read(['alice-ch2.md', 'alice-ch1.md', ...good.slice(1)]);

    expect(result.status).toBe('partial');
    expect(sectionOf(result, 'alice-ch2.md')).toContain('alice-ch2.md line 1:');
    expect(sectionOf(result, 'alice-ch1.md')).toContain('Not read: line 1 of 2 is');
    expect(sectionOf(result, 'alice-ch1.md')).toContain('this file had in this read');
    expect(sectionOf(result, 'alice-ch1.md')).toContain(`A read of one file holds at most ${budgets.readBytes.toLocaleString('en-US')} bytes`);
    expect(sectionOf(result, 'alice-ch1.md')).not.toContain('curiouser');
    expect(fileRow(result, 'alice-ch1.md')).toMatchObject({ outcome: 'line-too-long', line: 1, lineBytes: 70 * 1024 });
    expect(fileRow(result, 'alice-ch1.md').shareBytes as number).toBeLessThan(70 * 1024);
    expect(fileRow(result, 'alice-ch1.md')).not.toHaveProperty('endLine');
    const rows = capability.deliveredSources(result);
    expect(rows.map((row) => row.label)).toEqual(good);
    for (const row of rows) {
      expect(row.sourceFingerprint).toBe(sha256(chapter(row.label)));
      expect(row.lineRange).toEqual({ start: 1, end: fileRow(result, row.label).endLine });
    }
    expect(JSON.stringify(rows)).not.toContain(sha256(long));
    // The long file's only hint passes over the long line; none names its line 1.
    const longHints = sectionOf(result, 'alice-ch1.md').split('\n').filter((line) => line.startsWith('<prose-minion-tool-call '));
    expect(longHints.map(decodeHint)).toEqual([
      { capability: 'resource.read', files: [{ group: 'manuscript', path: 'alice-ch1.md' }], startLine: 2 }
    ]);
  });
});

describe('a line over its share of a read, but within a one-path read', () => {
  /** Five files, each opening with a 60 KiB line: an equal share of 256 KiB is about 51 KiB. */
  const five: AliceFile[] = Array.from({ length: 5 }, (_, index) =>
    manuscript(`alice-ch${index + 1}.md`, `${OVER_SHARE}\nChapter ${index + 1} goes on.`));
  const names = five.map((file) => file.path);

  it('hints the one-path call at that line, and that call delivers it', async () => {
    const { capability, read } = aliceCapability(five);

    const result = await read(names, { window: windowWith(2_000_000) });

    expect(result.status).toBe('failed');
    expect(capability.deliveredSources(result)).toEqual([]);
    for (const path of names) {
      expect(fileRow(result, path)).toMatchObject({ outcome: 'line-too-long', line: 1, lineBytes: 60 * 1024 });
      expect(sectionOf(result, path)).toContain('The line fits a read of this file alone. To read it, send this call alone:');
      expect(sectionOf(result, path)).not.toContain('passing over');
    }
    const hints = hintsIn(result).map(decodeHint);
    expect(hints).toEqual(names.map((path) => ({ capability: 'resource.read', files: [{ group: 'manuscript', path }], startLine: 1 })));

    // The same startLine with fewer files: its share is the whole one-path read, and the line lands.
    const alone = await capability.fulfill(hints[0], windowWith(2_000_000));
    expect(alone.status).toBe('success');
    expect(alone.metadata).toMatchObject({ path: 'alice-ch1.md', startLine: 1, endLine: 2, bytes: Buffer.byteLength(five[0].content, 'utf8') });
    expect(capability.deliveredSources(alone)).toEqual([
      expect.objectContaining({ lineRange: { start: 1, end: 2 }, sourceFingerprint: sha256(five[0].content) })
    ]);
  });

  it('beside a good file: partial, the good file\'s row only, and the same-line hint for the other', async () => {
    const { capability, read } = aliceCapability([...five, manuscript('alice-ch6.md', GOOD)]);

    const result = await read([...names, 'alice-ch6.md']);

    expect(result.status).toBe('partial');
    expect(capability.deliveredSources(result)).toEqual([
      expect.objectContaining({ label: 'alice-ch6.md', lineRange: { start: 1, end: 10 }, sourceFingerprint: sha256(GOOD) })
    ]);
    expect(result.metadata).toMatchObject({ filesNamed: 6, filesRead: 1 });
    expect(hintsIn(result).map(decodeHint)).toEqual(
      names.map((path) => ({ capability: 'resource.read', files: [{ group: 'manuscript', path }], startLine: 1 }))
    );
  });

  it('gives no same-line hint when the window could not hold the line even alone', async () => {
    const { read } = aliceCapability(five);
    // Half of 28,000 tokens is about 112 KB for five files: 22 KB each. Alone, a 60 KiB line needs about 15,400 tokens.
    const result = await read(names, { window: windowWith(28_000) });

    expect(result.status).toBe('failed');
    for (const path of names) {
      expect(sectionOf(result, path)).toContain('Line 1 cannot be read in this turn: it does not fit the room left even in a read of this file alone.');
    }
    expect(hintsIn(result).map(decodeHint)).toEqual(
      names.map((path) => ({ capability: 'resource.read', files: [{ group: 'manuscript', path }], startLine: 2 }))
    );
  });

  it('gives no same-line hint when the unknown-window total could not hold the line', async () => {
    const { read } = aliceCapability([...five, manuscript('alice-notes.md', aliceLines(2_600, 99))]);
    // Spend most of the turn's total: three one-path reads of about 64 KiB, then one of about 40 KB.
    for (let call = 0; call < 3; call += 1) {
      await read(['alice-notes.md'], { endLine: 2_600 });
    }
    await read(['alice-notes.md'], { endLine: 400 });

    const result = await read(names.slice(0, 2));

    expect(result.metadata).toMatchObject({ limitedBy: 'per-turn-total', filesRead: 0 });
    expect(sectionOf(result, 'alice-ch1.md')).toContain('Line 1 cannot be read in this turn');
    expect(hintsIn(result).map(decodeHint).map((hint) => hint.startLine)).toEqual([2, 2]);
  });
});

describe('a short line, then a long one', () => {
  const content = `A short first line.\n${OVER_READ}\nThe third line.`;

  it('delivers the first, continues at the long line, and the follow-up read meets the rule', async () => {
    const { capability, read } = aliceCapability([manuscript('alice-ch1.md', content)]);

    const first = await read(['alice-ch1.md']);

    // An ordinary early stop: the line before it is delivered, with its row.
    expect(first.status).toBe('success');
    expect(first.metadata).toMatchObject({ startLine: 1, endLine: 1, truncated: true, totalLines: 3 });
    expect(first.content).toContain('A short first line.');
    expect(capability.deliveredSources(first)).toEqual([
      expect.objectContaining({ lineRange: { start: 1, end: 1 }, sourceFingerprint: sha256(content) })
    ]);
    const [continuation] = hintsIn(first).map(decodeHint);
    expect(continuation).toEqual({ capability: 'resource.read', files: [{ group: 'manuscript', path: 'alice-ch1.md' }], startLine: 2 });

    // That read is at the long line: nothing delivered, no hint at line 2, and the call that passes over it.
    const second = await capability.fulfill(continuation);
    expect(second.status).toBe('failed');
    expect(second.metadata).toMatchObject({ outcome: 'line-too-long', line: 2 });
    expect(capability.deliveredSources(second)).toEqual([]);
    const [passOver] = hintsIn(second).map(decodeHint);
    expect(passOver).toEqual({ capability: 'resource.read', files: [{ group: 'manuscript', path: 'alice-ch1.md' }], startLine: 3 });

    const third = await capability.fulfill(passOver);
    expect(third.status).toBe('success');
    expect(third.content).toContain('The third line.');
    expect(hintsIn(third)).toEqual([]);
  });
});

describe('the invariant: a continuation never repeats its own request', () => {
  const sameRead = (hint: ResourceReadRequest, request: ResourceReadRequest): boolean =>
    JSON.stringify({ files: hint.files, startLine: hint.startLine ?? 1 }) ===
    JSON.stringify({ files: request.files, startLine: request.startLine ?? 1 });

  /** Follow every hint a read writes, breadth first, until none is left. */
  async function followAll(files: readonly AliceFile[], start: ResourceReadRequest, window?: CapabilityContextWindow): Promise<number> {
    const queue: ResourceReadRequest[] = [start];
    const asked = new Set<string>();
    let reads = 0;
    while (queue.length > 0) {
      const request = queue.shift()!;
      const key = JSON.stringify(request);
      // A request asked twice would be a loop.
      expect(asked.has(key)).toBe(false);
      asked.add(key);
      // A fresh turn each read, so an unknown window's total never ends the walk early.
      const result = await aliceCapability(files).capability.fulfill(request, window);
      reads += 1;
      expect(reads).toBeLessThan(200);
      for (const hint of hintsIn(result).map(decodeHint)) {
        expect(sameRead(hint, request)).toBe(false);
        // It names a later startLine, or the same one with fewer files.
        const later = (hint.startLine ?? 1) > (request.startLine ?? 1);
        expect(later || (hint.files.length < request.files.length && (hint.startLine ?? 1) === (request.startLine ?? 1))).toBe(true);
        queue.push(hint);
      }
    }
    return reads;
  }

  const mixed: AliceFile[] = [
    manuscript('alice-ch1.md', `${OVER_SHARE}\n${aliceLines(500, 99)}`),
    manuscript('alice-ch2.md', `Short.\n${OVER_READ}\n${OVER_SHARE}\nEnd.`),
    manuscript('alice-ch3.md', OVER_READ),
    manuscript('alice-ch4.md', `${OVER_SHARE}\n${OVER_SHARE}\n${OVER_SHARE}`),
    manuscript('alice-ch5.md', aliceLines(900, 99)),
    manuscript('alice-ch6.md', GOOD)
  ];
  const all: ResourceReadRequest = {
    capability: 'resource.read',
    files: mixed.map((file) => ({ group: file.group, path: file.path }))
  };

  it.each<[string, CapabilityContextWindow | undefined]>([
    ['an unknown window', undefined],
    ['a wide window', windowWith(2_000_000)],
    ['a narrow window', windowWith(24_000)],
    ['a window too small for the long lines', windowWith(9_000)]
  ])('holds for every hint, followed to the end, with %s', async (_label, window) => {
    const reads = await followAll(mixed, all, window);

    expect(reads).toBeGreaterThan(1);
  });

  it('holds for a one-path read at each line of a file of long and short lines', async () => {
    for (let startLine = 1; startLine <= 4; startLine += 1) {
      await followAll(mixed, { capability: 'resource.read', files: [{ group: 'manuscript', path: 'alice-ch2.md' }], startLine });
    }
  });
});
