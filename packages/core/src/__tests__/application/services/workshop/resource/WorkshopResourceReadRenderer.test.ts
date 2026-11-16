/**
 * The read's packing and its hints, on their own (ADR 2026-11-14 D2a, D5):
 * whole lines within fair shares, and the rules a hint holds whatever the
 * operation's estimate says.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { WorkshopCapabilityXmlCodec } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import type { WorkshopResourceReadyFile } from '@/application/services/workshop/WorkshopResourceReadFiles';
import {
  planWorkshopResourceRead,
  workshopResourceReadMinimumBytes
} from '@/application/services/workshop/WorkshopResourceReadPlan';
import {
  renderWorkshopResourceRead,
  workshopResourceContinuationCall
} from '@/application/services/workshop/WorkshopResourceReadRenderer';

const budgets = PROMPT_BUDGETS.workshopResource;

/** A ready file whose lines have these byte lengths. */
function ready(path: string, lineLengths: readonly number[]): WorkshopResourceReadyFile {
  const lines = lineLengths.map((length) => 'a'.repeat(length));
  const windowBytes = lineLengths.reduce((total, length) => total + length, 0) + lineLengths.length - 1;
  return {
    kind: 'ready',
    group: 'manuscript',
    path,
    label: path,
    lines,
    totalLines: lines.length,
    totalBytes: windowBytes,
    startLine: 1,
    selectedEndLine: lines.length,
    lineBytes: lineLengths,
    windowBytes,
    fingerprint: `fingerprint-of-${path}`
  };
}

const limit = (bytes: number) => ({ bytes, by: 'read-budget' as const });
const hintLines = (content: string): string[] => content.split('\n').filter((line) => line.startsWith('<prose-minion-tool-call '));

describe('planning a read', () => {
  it('packs whole lines, counting the separators between them', () => {
    const plan = planWorkshopResourceRead([ready('alice-ch1.md', [10, 10, 10])], limit(21));

    // Two lines are 21 bytes with their separator; a third would be 32.
    expect(plan.files[0]).toMatchObject({ kind: 'read', endLine: 2, bytes: 21, truncated: true });
    expect(plan).toMatchObject({ deliveredBytes: 21, limited: true });
  });

  it('never cuts a line: one that exceeds its share delivers nothing', () => {
    const plan = planWorkshopResourceRead([ready('alice-ch1.md', [30, 5])], limit(29));

    expect(plan.files[0]).toMatchObject({ kind: 'line-too-long', line: 1, lineBytes: 30, share: 29 });
    expect(plan.deliveredBytes).toBe(0);
  });

  it('gives a short file what it needs and splits the rest between the others', () => {
    const plan = planWorkshopResourceRead(
      [ready('alice-ch1.md', Array(100).fill(9)), ready('white-rabbit.md', [9]), ready('alice-ch2.md', Array(100).fill(9))],
      limit(209)
    );

    expect(plan.files.map((file) => (file.kind === 'read' ? [file.share, file.endLine] : file.kind)))
      .toEqual([[100, 10], [9, 1], [100, 10]]);
  });

  it('needs the minimum for each readable file, or the whole of a smaller one, and nothing for a file that cannot be read', () => {
    const files = [
      ready('alice-ch1.md', Array(100).fill(99)),
      ready('white-rabbit.md', [40]),
      { kind: 'fault' as const, group: 'manuscript' as const, path: 'alice-ch9.md', fault: 'missing' as const, error: 'gone', metadata: {} }
    ];

    expect(workshopResourceReadMinimumBytes(files, budgets.readMinimumBytes)).toBe(budgets.readMinimumBytes + 40);
    // At that limit, the file that falls short still has the minimum.
    const plan = planWorkshopResourceRead(files, limit(budgets.readMinimumBytes + 40));
    expect(plan.files[0]).toMatchObject({ kind: 'read', share: budgets.readMinimumBytes });
    expect(plan.files[1]).toMatchObject({ kind: 'read', truncated: false });
  });
});

describe('a long line\'s hints, whatever the estimate says', () => {
  const always = { fitsAlone: () => true };

  it('never offers a one-path read its own first line again', () => {
    const plan = planWorkshopResourceRead([ready('alice-ch1.md', [500, 5])], limit(100));

    const rendered = renderWorkshopResourceRead(plan, always);

    // The estimate said the line fits alone, but this read was the read alone.
    expect(rendered.hints).toEqual([workshopResourceContinuationCall({ group: 'manuscript', path: 'alice-ch1.md' }, 2)]);
    expect(rendered.result.content).toContain('passing over line 1 unread');
    expect(rendered.result.content).not.toContain('fits a read of this file alone');
  });

  it('never offers the same line for one longer than a one-path read holds', () => {
    const plan = planWorkshopResourceRead(
      [ready('alice-ch1.md', [budgets.readBytes + 1, 5]), ready('alice-ch2.md', [budgets.readBytes + 1])],
      limit(1_000)
    );

    const rendered = renderWorkshopResourceRead(plan, always);

    // The first file has a later line; the second has none, so it gets no call at all.
    expect(rendered.hints).toEqual([workshopResourceContinuationCall({ group: 'manuscript', path: 'alice-ch1.md' }, 2)]);
  });

  it('offers the same line, alone, beside other files when the line is within a one-path read', () => {
    const plan = planWorkshopResourceRead([ready('alice-ch1.md', [500, 5]), ready('alice-ch2.md', [500])], limit(600));

    const offered = renderWorkshopResourceRead(plan, always);
    const withheld = renderWorkshopResourceRead(plan, { fitsAlone: () => false });

    expect(offered.hints).toEqual([
      workshopResourceContinuationCall({ group: 'manuscript', path: 'alice-ch1.md' }, 1),
      workshopResourceContinuationCall({ group: 'manuscript', path: 'alice-ch2.md' }, 1)
    ]);
    expect(withheld.hints).toEqual([workshopResourceContinuationCall({ group: 'manuscript', path: 'alice-ch1.md' }, 2)]);
    expect(offered.sources).toEqual([]);
    expect(offered.result.status).toBe('failed');
  });

  it('writes each hint as a whole line of the text, and reports exactly those', () => {
    const plan = planWorkshopResourceRead([ready('alice-ch1.md', Array(50).fill(20)), ready('alice-ch2.md', [900, 5])], limit(400));

    const rendered = renderWorkshopResourceRead(plan, always);

    expect(hintLines(rendered.result.content!)).toEqual(rendered.hints);
    const codec = new WorkshopCapabilityXmlCodec();
    for (const hint of rendered.hints) {
      expect(codec.inspect(hint)).toMatchObject({ kind: 'request', request: { capability: 'resource.read' } });
    }
    // Two written together are two calls, and are refused.
    expect(codec.inspect(rendered.hints.join('\n'))).toMatchObject({ kind: 'invalid', reason: 'mixed-content', callMarkerCount: 2 });
  });

  it('neutralizes a fence in the text, so a file cannot close its own block', () => {
    const file = { ...ready('alice-ch1.md', [3, 11]), lines: ['```', 'Drink me.```'] };

    const rendered = renderWorkshopResourceRead(planWorkshopResourceRead([file], limit(100)), always);

    expect(rendered.result.content!.match(/```/g)).toHaveLength(2);
    expect(rendered.result.content).toContain('`​``');
  });
});
