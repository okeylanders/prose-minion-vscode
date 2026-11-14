/**
 * One `resource.read` naming several files (ADR 2026-11-14 D5–D7): one
 * message, a section per file in the order named, each file's outcome its
 * own, fair shares of the read's bytes, and a row per file delivered with
 * that file's own line range and fingerprint.
 */

import { createHash } from 'crypto';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  aliceCapability,
  aliceLines,
  decodeHint,
  fileRow,
  hintsIn,
  manuscript,
  sectionOf
} from '@/__tests__/application/services/workshop/resource/resourceReadFixtures';

const budgets = PROMPT_BUDGETS.workshopResource;
const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

const CH1 = aliceLines(12, 60, 'Chapter one');
const CH2 = aliceLines(8, 60, 'Chapter two');
const RABBIT = '# The White Rabbit\nChecks his watch.\nLate for the Duchess.';

describe('a resource.read naming several files', () => {
  const project = [
    manuscript('alice-ch1.md', CH1),
    manuscript('alice-ch2.md', CH2),
    { group: 'characters' as const, path: 'white-rabbit.md', content: RABBIT }
  ];

  it('reads each file under its own header, in the order named', async () => {
    const { capability, read, loadResources } = aliceCapability(project);

    const result = await read(['alice-ch2.md', { group: 'characters', path: 'white-rabbit.md' }, 'alice-ch1.md']);

    expect(result.status).toBe('success');
    const content = result.content!;
    const order = ['alice-ch2.md', 'white-rabbit.md', 'alice-ch1.md'].map((path) => content.indexOf(`Path: ${path}`));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((left, right) => left - right)).toEqual(order);
    expect(sectionOf(result, 'white-rabbit.md')).toContain('Group: characters');
    expect(sectionOf(result, 'white-rabbit.md')).toContain('Lines: 1-3 of 3.');
    expect(sectionOf(result, 'white-rabbit.md')).toContain('Late for the Duchess.');
    expect(sectionOf(result, 'alice-ch1.md')).toContain('Lines: 1-12 of 12.');
    expect(sectionOf(result, 'alice-ch1.md')).not.toContain('Chapter two');
    expect(loadResources.mock.calls.map(([paths]) => paths)).toEqual([['alice-ch2.md'], ['white-rabbit.md'], ['alice-ch1.md']]);
    expect(result.requestSummary).toBe('3 files: alice-ch2.md, white-rabbit.md, +1 more');
    expect(result.metadata).toMatchObject({ filesNamed: 3, filesRead: 3, limitedBy: 'read-budget', limitBytes: budgets.readBytesMulti });
    expect(capability.deliveredSources(result).map((row) => row.label)).toEqual(['alice-ch2.md', 'white-rabbit.md', 'alice-ch1.md']);
  });

  it('records a row per file with that file\'s own line range and fingerprint, never the whole card\'s', async () => {
    const { capability, read } = aliceCapability(project);

    const result = await read(['alice-ch1.md', { group: 'characters', path: 'white-rabbit.md' }]);

    const rows = capability.deliveredSources(result);
    expect(rows).toEqual([
      {
        kind: 'resource',
        label: 'alice-ch1.md',
        configuredResource: { group: 'manuscript', path: 'alice-ch1.md' },
        sizeChars: sectionOf(result, 'alice-ch1.md').length,
        lineRange: { start: 1, end: 12 },
        sourceFingerprint: sha256(CH1)
      },
      {
        kind: 'resource',
        label: 'white-rabbit.md',
        configuredResource: { group: 'characters', path: 'white-rabbit.md' },
        sizeChars: sectionOf(result, 'white-rabbit.md').length,
        lineRange: { start: 1, end: 3 },
        sourceFingerprint: sha256(RABBIT)
      }
    ]);
    expect(rows[0].sizeChars).toBeLessThan(result.content!.length);
    // Host-private: no fingerprint reaches the text or the card's metadata.
    expect(result.content).not.toContain(sha256(CH1));
    expect(JSON.stringify(result.metadata)).not.toContain(sha256(RABBIT));
    expect(result).not.toHaveProperty('sourceFingerprint');
  });

  it('reports a missing, an oversized and an unreadable file each in its own section, and still reads the good one', async () => {
    const { capability, read } = aliceCapability([
      ...project,
      { ...manuscript('alice-ch9.md', 'too big to read'), sizeBytes: budgets.readSourceBytes + 1 },
      { ...manuscript('alice-ch7.md', 'gone'), unreadable: true }
    ]);

    const result = await read(['alice-ch4.md', 'alice-ch9.md', 'alice-ch1.md', 'alice-ch7.md']);

    expect(result.status).toBe('partial');
    expect(result.error).toBeUndefined();
    expect(sectionOf(result, 'alice-ch4.md')).toContain('Not read: The requested path is not one of the configured project resources in that group.');
    expect(sectionOf(result, 'alice-ch9.md')).toContain(`Not read: The configured project resource exceeds the ${budgets.readSourceBytes}-byte source-read ceiling.`);
    expect(sectionOf(result, 'alice-ch7.md')).toContain('Not read: The configured project resource could not be read.');
    expect(sectionOf(result, 'alice-ch1.md')).toContain('Chapter one line 12');
    expect(result.content).toContain('# Project resources · 1 of 4 files read');
    expect((result.metadata!.files as { path: string; outcome: string }[]).map(({ path, outcome }) => [path, outcome])).toEqual([
      ['alice-ch4.md', 'missing'],
      ['alice-ch9.md', 'too-large'],
      ['alice-ch1.md', 'read'],
      ['alice-ch7.md', 'unreadable']
    ]);
    expect(fileRow(result, 'alice-ch1.md')).toMatchObject({ startLine: 1, endLine: 12, totalLines: 12, truncated: false });
    expect(fileRow(result, 'alice-ch4.md')).not.toHaveProperty('startLine');
    // Only the file that was read has a row, a line range or a fingerprint.
    expect(capability.deliveredSources(result)).toEqual([
      expect.objectContaining({ label: 'alice-ch1.md', lineRange: { start: 1, end: 12 }, sourceFingerprint: sha256(CH1) })
    ]);
  });

  it('reports a path that is ambiguous by letter case in its own section', async () => {
    const { read } = aliceCapability([manuscript('Notes/Queen.md', 'Off with'), manuscript('notes/queen.md', 'her head'), ...project]);

    const result = await read(['NOTES/QUEEN.MD', 'alice-ch2.md']);

    expect(result.status).toBe('partial');
    expect(sectionOf(result, 'NOTES/QUEEN.MD')).toContain('matches more than one configured resource when letter case is ignored');
    expect(fileRow(result, 'NOTES/QUEEN.MD')).toEqual({ group: 'manuscript', path: 'NOTES/QUEEN.MD', outcome: 'ambiguous' });
  });

  it('fails, with every file\'s reason, when none could be read', async () => {
    const { capability, read } = aliceCapability(project);

    const result = await read(['alice-ch4.md', { group: 'characters', path: 'cheshire-cat.md' }]);

    expect(result.status).toBe('failed');
    expect(result.error).toBe('None of the named files could be read.');
    expect(sectionOf(result, 'alice-ch4.md')).toContain('Not read:');
    expect(sectionOf(result, 'cheshire-cat.md')).toContain('Not read:');
    expect(result.metadata).toMatchObject({ filesNamed: 2, filesRead: 0 });
    expect(capability.deliveredSources(result)).toEqual([]);
    expect(hintsIn(result)).toEqual([]);
  });

  it('shares the read fairly: a short file takes what it needs and leaves the rest to the others', async () => {
    // Two long chapters and a short note: 200 KiB each of 100-byte lines against the 256 KiB read.
    const long = (tag: string): string => aliceLines(2_048, 99, tag);
    const { capability, read } = aliceCapability([
      manuscript('alice-ch1.md', long('One')),
      { group: 'characters', path: 'white-rabbit.md', content: RABBIT },
      manuscript('alice-ch2.md', long('Two'))
    ]);

    const result = await read(['alice-ch1.md', { group: 'characters', path: 'white-rabbit.md' }, 'alice-ch2.md'], {});

    expect(result.status).toBe('success');
    const rabbitBytes = Buffer.byteLength(RABBIT, 'utf8');
    expect(fileRow(result, 'white-rabbit.md')).toMatchObject({ bytes: rabbitBytes, truncated: false, endLine: 3 });
    // The default window is 400 lines (40 KB) of each chapter, which the shares hold whole.
    expect(fileRow(result, 'alice-ch1.md')).toMatchObject({ endLine: budgets.readDefaultLines, truncated: false });
    expect(fileRow(result, 'alice-ch2.md')).toMatchObject({ endLine: budgets.readDefaultLines, truncated: false });
    expect(capability.deliveredSources(result)).toHaveLength(3);
  });

  it('cuts each long file at a whole line within its share, and gives each its own continuation', async () => {
    // Three files of 400 one-kilobyte lines: each needs 400 KB, and the read holds 256 KiB.
    const kilobyteLines = (tag: string): string => aliceLines(400, 1_023, tag);
    const { read } = aliceCapability([
      manuscript('alice-ch1.md', kilobyteLines('One')),
      manuscript('alice-ch2.md', kilobyteLines('Two')),
      { group: 'characters', path: 'white-rabbit.md', content: RABBIT }
    ]);

    const result = await read(['alice-ch1.md', 'alice-ch2.md', { group: 'characters', path: 'white-rabbit.md' }]);

    const share = Math.floor((budgets.readBytesMulti - Buffer.byteLength(RABBIT, 'utf8')) / 2);
    const wholeLines = Math.floor((share + 1) / 1_024);
    for (const path of ['alice-ch1.md', 'alice-ch2.md']) {
      expect(fileRow(result, path)).toMatchObject({ startLine: 1, endLine: wholeLines, truncated: true, bytes: wholeLines * 1_024 - 1 });
      expect(sectionOf(result, path)).toContain(`Lines: 1-${wholeLines} of 400.`);
      expect(sectionOf(result, path)).toContain('share of this read');
    }
    const delivered = (result.metadata!.files as { bytes: number }[]).reduce((total, row) => total + row.bytes, 0);
    expect(delivered).toBeLessThanOrEqual(budgets.readBytesMulti);
    expect(result.metadata).toMatchObject({ bytes: delivered, truncated: true });
    expect(result.content).toContain(`This read was limited to ${budgets.readBytesMulti.toLocaleString('en-US')} bytes, shared between its files.`);
    // A file that stopped early says how to go on; the file that was read whole does not.
    expect(hintsIn(result).map(decodeHint)).toEqual([
      { capability: 'resource.read', files: [{ group: 'manuscript', path: 'alice-ch1.md' }], startLine: wholeLines + 1 },
      { capability: 'resource.read', files: [{ group: 'manuscript', path: 'alice-ch2.md' }], startLine: wholeLines + 1 }
    ]);
    expect(sectionOf(result, 'white-rabbit.md')).not.toContain('prose-minion-tool-call');
  });

  it('writes a continuation that decodes alone, for a path with markup characters and its own group', async () => {
    const { read } = aliceCapability([
      { group: 'characters', path: 'tweedledum & tweedledee.md', content: aliceLines(500) },
      manuscript('alice-ch1.md', CH1)
    ]);

    const result = await read([{ group: 'characters', path: 'tweedledum & tweedledee.md' }, 'alice-ch1.md']);

    const [hint] = hintsIn(result);
    expect(hint).toBe(
      '<prose-minion-tool-call name="resource.read"><group>characters</group><path>tweedledum &amp; tweedledee.md</path>' +
      `<startLine>${budgets.readDefaultLines + 1}</startLine></prose-minion-tool-call>`
    );
    expect(decodeHint(hint)).toEqual({
      capability: 'resource.read',
      files: [{ group: 'characters', path: 'tweedledum & tweedledee.md' }],
      startLine: budgets.readDefaultLines + 1
    });
  });

  it('resolves each of a case-distinct configured pair alone, by the lookup\'s exact match', async () => {
    const { read } = aliceCapability([manuscript('Alice.md', 'The upper-case Alice.'), manuscript('alice.md', 'The lower-case alice.')]);

    const upper = await read(['Alice.md']);
    const lower = await read(['alice.md']);

    expect(upper).toMatchObject({ status: 'success', metadata: { path: 'Alice.md' } });
    expect(upper.content).toContain('The upper-case Alice.');
    expect(lower).toMatchObject({ status: 'success', metadata: { path: 'alice.md' } });
    expect(lower.content).toContain('The lower-case alice.');
  });

  it('logs counts and groups for a read of several files, and no path or text', async () => {
    const { read, logged } = aliceCapability(project);

    await read(['alice-ch1.md', { group: 'characters', path: 'white-rabbit.md' }, 'alice-ch4.md']);

    const lines = logged().join('\n');
    expect(lines).toContain('read files=3 delivered=2 status=partial');
    expect(lines).toContain('window=unknown');
    expect(lines).not.toMatch(/alice-ch|white-rabbit|Chapter one|Duchess/);
  });
});

describe('a one-path resource.read, beside the new grammar', () => {
  it('keeps its top-level metadata and adds its one row', async () => {
    const { capability, read } = aliceCapability([manuscript('alice-ch1.md', CH1)]);

    const result = await read(['alice-ch1.md'], { startLine: 3, endLine: 5 });

    expect(result.status).toBe('success');
    expect(result.requestSummary).toBe('alice-ch1.md');
    expect(result.content!.startsWith('## Project resource · alice-ch1.md\nGroup: manuscript\nPath: alice-ch1.md\nLines: 3-5 of 12.')).toBe(true);
    expect(result.metadata).toMatchObject({
      group: 'manuscript',
      path: 'alice-ch1.md',
      startLine: 3,
      endLine: 5,
      requestedEndLine: 5,
      totalLines: 12,
      truncated: false,
      files: [{ group: 'manuscript', path: 'alice-ch1.md', outcome: 'read', startLine: 3, endLine: 5, totalLines: 12, truncated: false, bytes: 182 }],
      limitedBy: 'read-budget',
      limitBytes: budgets.readBytes
    });
    expect(capability.deliveredSources(result)).toEqual([expect.objectContaining({ lineRange: { start: 3, end: 5 }, sourceFingerprint: sha256(CH1) })]);
    // It reached the end line it asked for, so it offers no continuation.
    expect(hintsIn(result)).toEqual([]);
  });

  it('offers the next line when the default window ends before the file does', async () => {
    const { read } = aliceCapability([manuscript('alice-ch1.md', aliceLines(budgets.readDefaultLines + 5))]);

    const result = await read(['alice-ch1.md']);

    expect(result.content).toContain(`Default window: up to ${budgets.readDefaultLines} lines.`);
    expect(hintsIn(result).map(decodeHint)).toEqual([
      { capability: 'resource.read', files: [{ group: 'manuscript', path: 'alice-ch1.md' }], startLine: budgets.readDefaultLines + 1 }
    ]);
  });

  it('keeps today\'s results for a path that cannot be read at all', async () => {
    const { capability, read } = aliceCapability([manuscript('alice-ch1.md', CH1)]);

    const missing = await read(['alice-ch4.md']);
    const pastEnd = await read(['alice-ch1.md'], { startLine: 40 });

    expect(missing).toMatchObject({ status: 'rejected', requestSummary: 'alice-ch4.md' });
    expect(missing.error).toContain('not one of the configured project resources');
    expect(pastEnd).toMatchObject({ status: 'failed', metadata: { startLine: 40, totalLines: 12 } });
    expect(pastEnd.error).toBe("The requested start line 40 is beyond the file's 12 lines.");
    expect(capability.deliveredSources(missing)).toEqual([]);
    expect(capability.deliveredSources(pastEnd)).toEqual([]);
  });
});
