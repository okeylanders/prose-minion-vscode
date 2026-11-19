/**
 * `history.diff` (ADR 2026-11-19 D13–D15): what it shows, how it is fitted
 * and continued, its manifest row, and the commit ids it refuses before
 * anything reaches git. Made-up *Alice* history.
 */
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { WorkshopCapabilityResult, WorkshopHistoryRequest } from '@shared/types/workshopCapabilities';
import { WorkshopCapabilityXmlCodec } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import { fileHistoryCommitId, type FileHistoryCommit } from '@/platform';
import { WorkshopHistoryDiffCache } from '@/application/services/workshop/history/WorkshopHistoryDiffCache';
import { diffWorkshopHistoryTexts } from '@/application/services/workshop/history/WorkshopHistoryDiff';
import {
  ALICE_FS_PATH,
  ALICE_PATH,
  aliceCommits,
  fakeHistory,
  historyCapability,
  prose,
  windowWith
} from './historyFixtures';

const codec = new WorkshopCapabilityXmlCodec();
const configured = { kind: 'configured', group: 'chapters', path: ALICE_PATH } as const;
const [newest, middle, oldest] = aliceCommits(3);
const short = (commit: FileHistoryCommit): string => commit.id.slice(0, 7);
const diff = (from: string, to: WorkshopHistoryRequest & { capability: 'history.diff' } extends { to: infer T } ? T : never, startChange?: number) =>
  ({ capability: 'history.diff', file: configured, from, to, ...(startChange ? { startChange } : {}) }) as WorkshopHistoryRequest;

const OLD = prose('Alice sat by the river bank.', 'The White Rabbit ran past.', 'She followed it down the hole.');
const NEW = prose('Alice sat by the river bank.', 'The White Rabbit walked past.', 'She followed it down the hole.', 'The hall was long and low.');
const texts = new Map<string, string>([[oldest.id, OLD], [middle.id, NEW], [newest.id, NEW]]);

describe('what a diff shows', () => {
  it('compares two commits: paragraphs first, then words, with marks, and adds a history manifest row', async () => {
    const harness = historyCapability({ history: fakeHistory({ commits: [newest, middle, oldest], texts }) });
    const result = await harness.capability.fulfill(diff(short(oldest), { kind: 'commit', commit: short(middle) }));
    expect(result.status).toBe('success');
    expect(result.content).toContain('2 changes: 1 changed, 1 added, 0 removed');
    expect(result.content).toContain('Change 1 · ¶ 2, changed: The White Rabbit ~~ran~~ **walked** past.');
    expect(result.content).toContain('Change 2 · ¶ 4, added: The hall was long and low.');
    expect(result.content).toContain('  Unchanged before, ¶ 1: “Alice sat by the river bank.”');
    // Git is given only full hashes from its own log.
    expect(harness.history.showCalls).toEqual([
      { fsPath: ALICE_FS_PATH, commit: oldest.id },
      { fsPath: ALICE_FS_PATH, commit: middle.id }
    ]);
    expect(harness.capability.deliveredSources(result)).toEqual([{
      kind: 'history',
      label: `${ALICE_PATH} · ${oldest.id.slice(0, 10)} → ${middle.id.slice(0, 10)}`,
      sizeChars: result.content!.length
    }]);
  });

  it('compares a commit with the file as saved on disk, and says unsaved editor changes are not included', async () => {
    const harness = historyCapability({ history: fakeHistory({ commits: [newest, middle, oldest], texts }), saved: NEW });
    const result = await harness.capability.fulfill(diff(short(oldest), { kind: 'current' }));
    expect(result.content).toContain('→ current (the file as saved on disk; unsaved changes in the editor are not included)');
    expect(harness.reads).toEqual([ALICE_FS_PATH]);
    expect(harness.history.showCalls).toEqual([{ fsPath: ALICE_FS_PATH, commit: oldest.id }]);
    expect(harness.capability.deliveredSources(result)[0].label).toMatch(/→ current$/);
  });

  it('says when the versions read the same, and escapes the diff\'s own marks in the writer\'s text', async () => {
    const same = await historyCapability({ history: fakeHistory({ commits: [newest, middle], texts }) }).capability
      .fulfill(diff(short(middle), { kind: 'commit', commit: short(newest) }));
    expect(same.content).toContain('No changes: the two versions read the same.');

    const marks = new Map([[oldest.id, 'A **bold** cup'], [middle.id, 'A ~~struck~~ cup']]);
    const escaped = await historyCapability({ history: fakeHistory({ commits: [middle, oldest], texts: marks }) }).capability
      .fulfill(diff(short(oldest), { kind: 'commit', commit: short(middle) }));
    expect(escaped.content).toContain('\\*\\*bold\\*\\*');
    expect(escaped.content).toContain('\\~\\~struck\\~\\~');
  });

  it('reads a side where the file did not exist as empty, and says so', async () => {
    const result = await historyCapability({ history: fakeHistory({ commits: [middle, oldest], texts: new Map([[middle.id, NEW]]) }) })
      .capability.fulfill(diff(short(oldest), { kind: 'commit', commit: short(middle) }));
    expect(result.content).toContain('where the file did not exist');
    expect(result.content).toContain('4 changes: 0 changed, 4 added, 0 removed');
  });

  it('refuses a side past diffSourceBytes in words', async () => {
    const big = 'a'.repeat(PROMPT_BUDGETS.workshopHistory.diffSourceBytes + 1);
    const result = await historyCapability({ history: fakeHistory({ commits: [middle, oldest], texts: new Map([[oldest.id, big], [middle.id, NEW]]) }) })
      .capability.fulfill(diff(short(oldest), { kind: 'commit', commit: short(middle) }));
    expect(result).toMatchObject({ status: 'rejected', metadata: { rejectionReason: 'diff-source-too-large', rejectionField: 'from' } });
  });
});

describe('fitted by whole changes, continued at a later change (D13)', () => {
  const many = (count: number, word: string): string =>
    prose(...Array.from({ length: count }, (_, index) => `Paragraph ${index + 1}: the Queen ${word} the croquet ground, flamingo in hand.`));
  const OLDER = many(30, 'paced');
  const NEWER = many(30, 'stormed');

  /** The smallest window, searched downward, that limits the diff without refusing it. */
  async function limitedRun(saved: string): Promise<{ result: WorkshopCapabilityResult; free: number }> {
    for (let free = 20_000; free > 0; free -= 250) {
      const harness = historyCapability({ history: fakeHistory({ commits: [newest, oldest], texts: new Map([[oldest.id, OLDER]]) }), saved });
      const result = await harness.capability.fulfill(diff(short(oldest), { kind: 'current' }), windowWith(free));
      if (result.status === 'success' && result.metadata?.truncated === true && (result.metadata.changesShown as number) > 3) {
        return { result, free };
      }
    }
    throw new Error('no limiting window found');
  }

  it('says it was limited near its top, and every "exact call" decodes, makes progress and reaches the end', async () => {
    const { free } = await limitedRun(NEWER);
    let request = diff(short(oldest), { kind: 'current' });
    const seen: number[] = [];
    for (let guard = 0; guard < 40; guard += 1) {
      const harness = historyCapability({ history: fakeHistory({ commits: [newest, oldest], texts: new Map([[oldest.id, OLDER]]) }), saved: NEWER });
      const result = await harness.capability.fulfill(request, windowWith(free));
      expect(result.status).toBe('success');
      const lines = result.content!.split('\n');
      seen.push(...lines.map((line) => /^Change (\d+) · /.exec(line)?.[1]).filter(Boolean).map(Number));
      const hint = /^Changes \d+–\d+ not shown\. The exact call for them: (.*)$/.exec(lines.at(-1)!)?.[1];
      if (!hint) {
        break;
      }
      expect(lines.slice(0, 6).some((line) => line.startsWith('This diff was limited to changes'))).toBe(true);
      const next = codec.inspect(hint);
      expect(next.kind).toBe('request');
      const nextRequest = (next as { request: WorkshopHistoryRequest & { capability: 'history.diff' } }).request;
      const start = (request as { startChange?: number }).startChange ?? 1;
      expect(nextRequest.startChange).toBeGreaterThan(start);
      expect(nextRequest.to).toEqual({ kind: 'current', fingerprint: expect.stringMatching(/^[0-9a-f]{12}$/) });
      request = nextRequest;
    }
    expect(seen).toEqual(Array.from({ length: 30 }, (_, index) => index + 1));
  });

  it('refuses a continuation of current once the saved file changed, never a misnumbered part', async () => {
    const { result } = await limitedRun(NEWER);
    const hint = /The exact call for them: (.*)$/.exec(result.content!)![1];
    const next = (codec.inspect(hint) as { request: WorkshopHistoryRequest }).request;
    const harness = historyCapability({ history: fakeHistory({ commits: [newest, oldest], texts: new Map([[oldest.id, OLDER]]) }), saved: `${NEWER}\n\nA new last line.` });
    const changed = await harness.capability.fulfill(next, windowWith(20_000));
    expect(changed).toMatchObject({ status: 'failed', metadata: { outcome: 'current-changed' } });
    expect(changed.content).toContain('Ask again from change 1');
  });

  it('refuses a single change too big to fit, with the room it had and no call', async () => {
    const harness = historyCapability({ history: fakeHistory({ commits: [newest, oldest], texts: new Map([[oldest.id, OLDER]]) }), saved: NEWER });
    const result = await harness.capability.fulfill(diff(short(oldest), { kind: 'current' }), windowWith(60));
    expect(result).toMatchObject({ status: 'rejected', metadata: { rejectionReason: 'history-context-window', halfWindowTokens: 30 } });
    expect(result.error).toContain('half the room left in your context window is 30 tokens');
    expect(`${result.error}${result.content ?? ''}`).not.toContain('prose-minion-tool-call');
  });

  it('with no window, bounds a diff by diffBytes', async () => {
    const huge = (word: string): string => prose(...Array.from({ length: 400 }, (_, index) =>
      `Paragraph ${index + 1}: ${word} ${'the Queen paced the croquet ground with a flamingo in hand. '.repeat(4)}`));
    const harness = historyCapability({ history: fakeHistory({ commits: [newest, oldest], texts: new Map([[oldest.id, huge('once')]]) }), saved: huge('twice') });
    const result = await harness.capability.fulfill(diff(short(oldest), { kind: 'current' }));
    expect(result).toMatchObject({ status: 'success', metadata: { truncated: true, limitedBy: 'diff-bytes' } });
    expect(Buffer.byteLength(result.content!, 'utf8')).toBeLessThanOrEqual(PROMPT_BUDGETS.workshopHistory.diffBytes);
    expect(result.content).toContain('by the size one diff result may have');
  });

  it('says a start past the last change in words', async () => {
    const harness = historyCapability({ history: fakeHistory({ commits: [middle, oldest], texts }) });
    const result = await harness.capability.fulfill(diff(short(oldest), { kind: 'commit', commit: short(middle) }, 9));
    expect(result.content).toContain('Change 9 is past the end: 2 changes.');
    expect(result.content).not.toContain('prose-minion-tool-call');
  });
});

describe('commit ids: only as this file\'s log gave them (D14)', () => {
  const twin = (fill: string): FileHistoryCommit => ({ id: fileHistoryCommitId(`abcdef1${fill.repeat(33)}`)!, author: 'Alice', subject: 'twin' });

  it.each([
    ['ambiguous prefix', [twin('0'), twin('1')], 'abcdef1', 'ambiguous-commit'],
    ['not in this file\'s history', aliceCommits(3), 'abcdef1', 'commit-not-in-history']
  ] as const)('refuses an %s before git sees anything', async (_, commits, from, reason) => {
    const harness = historyCapability({ history: fakeHistory({ commits }), saved: NEW });
    const result = await harness.capability.fulfill(diff(from, { kind: 'current' }));
    expect(result).toMatchObject({ status: 'rejected', metadata: { rejectionReason: reason, rejectionField: 'from' } });
    expect(harness.history.showCalls).toEqual([]);
    expect(harness.reads).toEqual([]);
  });

  it('refuses the same commit twice, and a <from> newer than <to>', async () => {
    const commits = [newest, middle, oldest];
    const same = historyCapability({ history: fakeHistory({ commits, texts }) });
    expect(await same.capability.fulfill(diff(short(middle), { kind: 'commit', commit: middle.id })))
      .toMatchObject({ status: 'rejected', metadata: { rejectionReason: 'same-commit' } });
    const order = historyCapability({ history: fakeHistory({ commits, texts }) });
    expect(await order.capability.fulfill(diff(short(newest), { kind: 'commit', commit: short(oldest) })))
      .toMatchObject({ status: 'rejected', metadata: { rejectionReason: 'commit-order', rejectionField: 'to' } });
    expect([...same.history.showCalls, ...order.history.showCalls]).toEqual([]);
  });

  it('checks membership against the file\'s log, read logScanCommits back', async () => {
    const harness = historyCapability({ history: fakeHistory({ commits: [middle, oldest], texts }) });
    await harness.capability.fulfill(diff(short(oldest), { kind: 'commit', commit: short(middle) }));
    expect(harness.history.logCalls).toEqual([{ fsPath: ALICE_FS_PATH, limit: PROMPT_BUDGETS.workshopHistory.logScanCommits }]);
  });
});

describe('logs carry no id, subject, author, path or diff text (G3)', () => {
  it('across a log, a diff, a refusal and a failure', async () => {
    const harness = historyCapability({ history: fakeHistory({ commits: [newest, middle, oldest], texts }), saved: NEW });
    await harness.capability.fulfill({ capability: 'history.log', file: configured });
    await harness.capability.fulfill(diff(short(oldest), { kind: 'current' }));
    await harness.capability.fulfill(diff('abcdef1', { kind: 'current' }));
    await harness.capability.fulfill({ capability: 'history.log', file: { kind: 'configured', group: 'characters', path: 'Hatter.md' } });
    const logged = harness.lines.join('\n');
    expect(harness.lines.length).toBeGreaterThanOrEqual(4);
    for (const secret of [ALICE_PATH, ALICE_FS_PATH, 'Hatter', 'Alice Liddell', 'Trim the tea party', 'White Rabbit', 'walked',
      ...[newest, middle, oldest].map(short)]) {
      expect(logged).not.toContain(secret);
    }
  });
});

describe('a continuation never aligns again (D13a; PR #286 F-03)', () => {
  it('runs the alignment once across a continuation, from a per-window cache keyed by the pair', async () => {
    const compute = jest.fn(diffWorkshopHistoryTexts);
    const diffs = new WorkshopHistoryDiffCache(2, compute);
    const many = (word: string): string => prose(...Array.from({ length: 30 }, (_, index) => `Paragraph ${index + 1}: the Queen ${word}.`));
    const run = (request: WorkshopHistoryRequest, saved: string) => historyCapability({
      history: fakeHistory({ commits: [newest, oldest], texts: new Map([[oldest.id, many('paced')]]) }), saved, diffs
    }).capability.fulfill(request, windowWith(700));

    const first = await run(diff(short(oldest), { kind: 'current' }), many('stormed'));
    const hint = /The exact call for them: (.*)$/.exec(first.content!)![1];
    const next = (codec.inspect(hint) as { request: WorkshopHistoryRequest }).request;
    await run(next, many('stormed'));
    expect(compute).toHaveBeenCalledTimes(1);
    // A file saved again is another key: computed afresh, never served from the old one.
    await run(diff(short(oldest), { kind: 'current' }), many('strode'));
    expect(compute).toHaveBeenCalledTimes(2);
  });
});

describe('the outer alignment\'s ceiling, refused in words (D13a)', () => {
  it('refuses a diff past it, keeps the refusal, and shows nothing partial', async () => {
    const compute = jest.fn(() => ({ kind: 'refused' as const, reason: 'paragraph-edit-length' as const }));
    const diffs = new WorkshopHistoryDiffCache(4, compute);
    const run = () => historyCapability({ history: fakeHistory({ commits: [middle, oldest], texts }), diffs })
      .capability.fulfill(diff(short(oldest), { kind: 'commit', commit: short(middle) }));
    const refused = await run();
    expect(refused).toMatchObject({ status: 'rejected', metadata: { rejectionReason: 'paragraph-edit-length' } });
    expect(refused.error).toBe('Too much changed between these two versions to compare paragraph by paragraph. Pick two commits closer together.');
    expect(refused.content).toBeUndefined();
    await run();
    expect(compute).toHaveBeenCalledTimes(1);
  });
});

describe('every side is sized before it is fetched (PR #287)', () => {
  const limit = PROMPT_BUDGETS.workshopHistory.diffSourceBytes;

  it('refuses an older side past the bound before fetching anything, and never reads the other side', async () => {
    const harness = historyCapability({
      history: fakeHistory({ commits: [middle, oldest], texts, sizes: new Map([[oldest.id, limit + 1]]) }),
      saved: NEW
    });
    const result = await harness.capability.fulfill(diff(short(oldest), { kind: 'current' }));
    expect(result).toMatchObject({ status: 'rejected', metadata: { rejectionReason: 'diff-source-too-large', rejectionField: 'from' } });
    expect(harness.history.sizeCalls.map((call) => call.commit)).toEqual([oldest.id]);
    expect(harness.history.showCalls).toEqual([]);
    expect([...harness.stats, ...harness.reads]).toEqual([]);
  });

  it('refuses a saved file past the bound by its stat, before either side is fetched', async () => {
    const harness = historyCapability({ history: fakeHistory({ commits: [middle, oldest], texts }), saved: NEW, savedSize: limit + 1 });
    const result = await harness.capability.fulfill(diff(short(oldest), { kind: 'current' }));
    expect(result).toMatchObject({ status: 'rejected', metadata: { rejectionReason: 'diff-source-too-large', rejectionField: 'to' } });
    expect(harness.history.showCalls).toEqual([]);
    expect(harness.reads).toEqual([]);
  });

  it('checks again after the read, for a side that grew between sizing and reading', async () => {
    const big = 'a'.repeat(limit + 1);
    const harness = historyCapability({
      history: fakeHistory({ commits: [middle, oldest], texts: new Map([[oldest.id, big], [middle.id, NEW]]), sizes: new Map([[oldest.id, 10]]) })
    });
    const result = await harness.capability.fulfill(diff(short(oldest), { kind: 'commit', commit: short(middle) }));
    expect(result).toMatchObject({ status: 'rejected', metadata: { rejectionReason: 'diff-source-too-large', rejectionField: 'from' } });
    // The second side is never fetched once the first is refused.
    expect(harness.history.showCalls.map((call) => call.commit)).toEqual([oldest.id]);
  });
});

describe('one decoder for every side: strict UTF-8 (PR #287)', () => {
  const NOT_UTF8 = new Uint8Array([0x41, 0x6c, 0x69, 0x63, 0x65, 0xe9, 0x0a]);

  it.each([
    ['a commit', () => fakeHistory({ commits: [middle, oldest], texts: new Map<string, string | Uint8Array>([[oldest.id, NOT_UTF8], [middle.id, NEW]]) }), NEW, 'from'],
    ['the saved file', () => fakeHistory({ commits: [middle, oldest], texts }), NOT_UTF8, 'to']
  ] as const)('refuses %s that is not UTF-8 text, in words', async (_, history, saved, field) => {
    const result = await historyCapability({ history: history(), saved }).capability.fulfill(diff(short(oldest), { kind: 'current' }));
    expect(result).toMatchObject({ status: 'rejected', metadata: { rejectionReason: 'not-utf8', rejectionField: field } });
    expect(result.error).toBe('This file isn\'t UTF-8 text, so its history can\'t be compared.');
  });

  it('strips a byte-order mark on either side alike, so it is no change', async () => {
    const bom = (text: string): Uint8Array => new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(text)]);
    const result = await historyCapability({
      history: fakeHistory({ commits: [middle, oldest], texts: new Map<string, string | Uint8Array>([[oldest.id, bom(NEW)]]) }),
      saved: NEW
    }).capability.fulfill(diff(short(oldest), { kind: 'current' }));
    expect(result.content).toContain('No changes: the two versions read the same.');
  });
});
