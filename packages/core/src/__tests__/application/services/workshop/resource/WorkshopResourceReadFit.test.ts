/**
 * `resource.read` fitted to the context window (ADR 2026-11-14 D2, D3): at
 * most half the room left, measured as the evidence will cost it; refused
 * when that holds less than the minimum; and, with no window, one read's
 * worth for the whole turn.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { workshopReadEvidenceTokens } from '@/application/services/workshop/reads/WorkshopReadWindowFit';
import {
  aliceCapability,
  aliceLines,
  decodeHint,
  fileRow,
  hintsIn,
  manuscript,
  windowWith
} from '@/__tests__/application/services/workshop/resource/resourceReadFixtures';

const budgets = PROMPT_BUDGETS.workshopResource;
/** 2,000 lines of 100 bytes: more than any read holds. */
const LONG = aliceLines(2_000, 99, 'Chapter');

describe('resource.read fitted to the window', () => {
  it('lands a one-path read within half the room left, close to it, at a whole line', async () => {
    const { capability, read } = aliceCapability([manuscript('alice-ch1.md', LONG)]);
    const free = 8_000;

    const result = await read(['alice-ch1.md'], { endLine: 2_000, window: windowWith(free) });

    expect(result.status).toBe('success');
    const tokens = workshopReadEvidenceTokens(result);
    expect(tokens).toBeLessThanOrEqual(free / 2);
    expect(tokens).toBeGreaterThan((free / 2) * 0.9);
    expect(result.metadata).toMatchObject({ limitedBy: 'context-window', truncated: true });
    const limit = result.metadata!.limitBytes as number;
    expect(limit).toBeLessThan(budgets.readBytes);
    expect(result.content!.startsWith(
      `This read was limited to ${limit.toLocaleString('en-US')} bytes, half the room left in your context window.`
    )).toBe(true);
    // Whole lines only, and the continuation is the next one.
    const endLine = result.metadata!.endLine as number;
    expect(result.metadata!.bytes).toBe(endLine * 100 - 1);
    expect(hintsIn(result).map(decodeHint)).toEqual([
      { capability: 'resource.read', files: [{ group: 'manuscript', path: 'alice-ch1.md' }], startLine: endLine + 1 }
    ]);
    expect(capability.deliveredSources(result)[0].lineRange).toEqual({ start: 1, end: endLine });
  });

  it('counts the escaped text and the metadata, as the evidence will', async () => {
    // Markup doubles in size once escaped; a fit that measured the raw text would overshoot.
    const markup = Array.from({ length: 2_000 }, (_, index) => `<<<<&&&&>>>> ${index + 1} `.repeat(4)).join('\n');
    const { read } = aliceCapability([manuscript('alice-ch1.md', markup)]);
    const free = 6_000;

    const result = await read(['alice-ch1.md'], { endLine: 2_000, window: windowWith(free) });

    expect(result.status).toBe('success');
    expect(workshopReadEvidenceTokens(result)).toBeLessThanOrEqual(free / 2);
    expect(Buffer.byteLength(result.content!, 'utf8') / 4).toBeLessThan(free / 2);
  });

  it('lands a read of several files within half the room, sharing what fits', async () => {
    const { capability, read } = aliceCapability([
      manuscript('alice-ch1.md', LONG),
      manuscript('alice-ch2.md', LONG),
      manuscript('alice-ch3.md', 'A short third chapter.')
    ]);
    const free = 20_000;

    const result = await read(['alice-ch1.md', 'alice-ch2.md', 'alice-ch3.md'], { window: windowWith(free) });

    expect(result.status).toBe('success');
    const tokens = workshopReadEvidenceTokens(result);
    expect(tokens).toBeLessThanOrEqual(free / 2);
    expect(tokens).toBeGreaterThan((free / 2) * 0.9);
    expect(result.metadata).toMatchObject({ limitedBy: 'context-window', truncated: true, filesRead: 3 });
    expect(fileRow(result, 'alice-ch3.md')).toMatchObject({ truncated: false });
    const [one, two] = ['alice-ch1.md', 'alice-ch2.md'].map((path) => fileRow(result, path));
    expect(one.truncated).toBe(true);
    expect(Math.abs((one.endLine as number) - (two.endLine as number))).toBeLessThanOrEqual(1);
    expect(capability.deliveredSources(result)).toHaveLength(3);
  });

  it('leaves a read alone, and says nothing of a limit, when the window has room', async () => {
    const { read } = aliceCapability([manuscript('alice-ch1.md', aliceLines(40)), manuscript('alice-ch2.md', aliceLines(40))]);

    const result = await read(['alice-ch1.md', 'alice-ch2.md'], { window: windowWith(400_000) });

    expect(result.metadata).toMatchObject({ limitedBy: 'read-budget', limitBytes: budgets.readBytesMulti, truncated: false });
    expect(result.content).not.toContain('This read was limited');
  });

  it('has no per-turn byte total when the window is known', async () => {
    const { read } = aliceCapability([manuscript('alice-ch1.md', LONG)]);
    const window = windowWith(2_000_000);

    // Eight full one-path reads: 512 KiB, twice the unknown-window total.
    for (let call = 0; call < 8; call += 1) {
      const result = await read(['alice-ch1.md'], { endLine: 2_000, window });
      expect(result.metadata).toMatchObject({ limitedBy: 'read-budget', limitBytes: budgets.readBytes });
      expect(result.metadata!.bytes as number).toBeGreaterThan(budgets.readBytes - 100);
    }
  });

  it('refuses a read the window cannot give the minimum, stating the room it had', async () => {
    const { capability, read, loadResources } = aliceCapability([manuscript('alice-ch1.md', LONG), manuscript('alice-ch2.md', LONG)]);
    // Half of 1,600 tokens is about 3,200 bytes: less than two files' minimum.
    const result = await read(['alice-ch1.md', 'alice-ch2.md'], { window: windowWith(1_600) });

    expect(result.status).toBe('rejected');
    expect(result.error).toBe(
      `This read names 2 files and needs at least ${(2 * budgets.readMinimumBytes).toLocaleString('en-US')} bytes ` +
      `(${budgets.readMinimumBytes.toLocaleString('en-US')} for each, or the whole of a smaller file), ` +
      'but half the room left in your context window holds only about 3,200 bytes. ' +
      'Name fewer files, or answer from what you have.'
    );
    expect(result.content).toBeUndefined();
    expect(result.metadata).toMatchObject({
      rejectionReason: 'resource-context-window', bytesLeft: 3_200, minimumBytes: 2 * budgets.readMinimumBytes, filesNamed: 2
    });
    expect(capability.deliveredSources(result)).toEqual([]);
    expect(loadResources).toHaveBeenCalledTimes(2);
  });

  it('refuses when even the minimum read measures over half the room', async () => {
    const { read } = aliceCapability([manuscript('alice-ch1.md', LONG)]);
    // Half is 520 tokens: 2,080 bytes passes the first check, but the header and metadata push the minimum over.
    const result = await read(['alice-ch1.md'], { window: windowWith(1_040) });

    expect(result.status).toBe('rejected');
    expect(result.error).toMatch(
      /^This read names 1 file and needs at least 2,048 bytes .*, but half the room left in your context window is 520 tokens, and the smallest read of this file measured [\d,]+\. Answer from what you have\.$/
    );
    expect(result.metadata).toMatchObject({ rejectionReason: 'resource-context-window', halfWindowTokens: 520 });
  });

  it('never refuses a small file for the minimum it does not need', async () => {
    const { read } = aliceCapability([manuscript('alice-ch1.md', 'Down, down, down.'), manuscript('alice-ch2.md', 'Would the fall never come to an end?')]);

    const result = await read(['alice-ch1.md', 'alice-ch2.md'], { window: windowWith(1_600) });

    expect(result.status).toBe('success');
    expect(result.content).toContain('Would the fall never come to an end?');
  });
});

describe('resource.read with an unknown window', () => {
  it('shares one read\'s worth across the turn\'s reads, and says why when it limits one', async () => {
    const { read } = aliceCapability([manuscript('alice-ch1.md', LONG)]);
    const total = budgets.readBytesMulti;
    let used = 0;

    // Three full one-path reads and a short one fit the total; each is limited only by its own ceiling.
    for (let call = 0; call < 3; call += 1) {
      const result = await read(['alice-ch1.md'], { endLine: 2_000 });
      expect(result.metadata).toMatchObject({ limitedBy: 'read-budget', limitBytes: budgets.readBytes });
      expect(result.content).not.toContain('context window is unknown');
      used += result.metadata!.bytes as number;
    }
    used += (await read(['alice-ch1.md'], { endLine: 100 })).metadata!.bytes as number;
    const fourth = await read(['alice-ch1.md'], { endLine: 2_000 });

    expect(fourth.status).toBe('success');
    expect(fourth.metadata).toMatchObject({ limitedBy: 'per-turn-total', limitBytes: total - used, truncated: true });
    expect(fourth.content!.startsWith(
      `This read was limited to ${(total - used).toLocaleString('en-US')} bytes: earlier file reads this turn used ` +
      `${used.toLocaleString('en-US')} of the ${total.toLocaleString('en-US')}-byte total, one read's worth, ` +
      'because the size of your context window is unknown.'
    )).toBe(true);
    expect(used + (fourth.metadata!.bytes as number)).toBeLessThanOrEqual(total);
  });

  it('refuses a read once the total is spent, in words that say it resets with the next writer message', async () => {
    const { capability, read } = aliceCapability([manuscript('alice-ch1.md', LONG), manuscript('alice-ch2.md', LONG)]);

    // 400 lines of each is 80 KB a read; three reads leave less than one file's minimum.
    for (let call = 0; call < 3; call += 1) {
      await read(['alice-ch1.md', 'alice-ch2.md']);
    }
    const fill = await read(['alice-ch1.md'], { endLine: 2_000 });
    expect(fill.metadata).toMatchObject({ limitedBy: 'per-turn-total' });
    const refused = await read(['alice-ch1.md', 'alice-ch2.md']);

    expect(refused.status).toBe('rejected');
    expect(refused.error).toMatch(/^This read names 2 files and needs at least 4,096 bytes .*, but only [\d,]+ bytes are left: earlier file reads this turn used [\d,]+ of the 262,144-byte total, one read's worth, because the size of your context window is unknown\. The total resets with the next writer message\./);
    expect(refused.metadata).toMatchObject({ rejectionReason: 'resource-read-total', filesNamed: 2 });
    expect(capability.deliveredSources(refused)).toEqual([]);
  });

  it('starts each turn\'s total afresh: the count is the turn\'s capability\'s', async () => {
    const files = [manuscript('alice-ch1.md', LONG)];
    const first = aliceCapability(files);
    for (let call = 0; call < 4; call += 1) {
      await first.read(['alice-ch1.md'], { endLine: 2_000 });
    }
    const next = aliceCapability(files);

    const result = await next.read(['alice-ch1.md'], { endLine: 2_000 });

    expect(result.metadata).toMatchObject({ limitedBy: 'read-budget', limitBytes: budgets.readBytes });
  });
});
