/**
 * The shared edit planner (ADR 2026-11-05 D3): exactly-once anchoring, the
 * faults per operation, the content span (front matter, surrounding
 * whitespace), joining touching ranges, and applying a plan. Pure. *Alice*.
 */

import { findExactlyOnce } from '@/utils/textEdits/findExactlyOnce';
import { applyTextEdits, planTextEdits } from '@/utils/textEdits/planTextEdits';
import type { TextEditOperation, TextEditPlan, TextEditRules } from '@/utils/textEdits/textEditOperations';

const OPEN: TextEditRules = { allowsRewrite: true };
const TEXT = 'Alice followed the Rabbit. The Rabbit checked its watch. Alice fell.';

function applied(text: string, operations: readonly TextEditOperation[], rules: TextEditRules = OPEN): string {
  const plan = planTextEdits(text, operations, rules);
  if (plan.kind !== 'planned') {
    throw new Error(`faulted: ${JSON.stringify(plan.faults)}`);
  }
  return applyTextEdits(text, plan.edits);
}

function faults(plan: TextEditPlan): ReadonlyArray<{ index: number; fault: string }> {
  return plan.kind === 'faulted' ? plan.faults : [];
}

const replace = (find: string, replacement: string): TextEditOperation => ({ op: 'replace', find, with: replacement });

describe('findExactlyOnce', () => {
  it('finds none, one, or more than one (counted overlapping)', () => {
    expect(findExactlyOnce('tea party', 'cake')).toEqual({ count: 0 });
    expect(findExactlyOnce('tea party', 'party')).toEqual({ start: 4 });
    expect(findExactlyOnce('tea and tea', 'tea')).toEqual({ count: 2 });
    expect(findExactlyOnce('aaa', 'aa')).toEqual({ count: 2 });
  });
});

describe('planTextEdits: anchoring', () => {
  it('anchors a quote at the very start and at the very end', () => {
    expect(applied(TEXT, [replace('Alice followed', 'She followed')])).toBe('She followed the Rabbit. The Rabbit checked its watch. Alice fell.');
    expect(applied(TEXT, [replace('Alice fell.', 'Down she went.')])).toBe('Alice followed the Rabbit. The Rabbit checked its watch. Down she went.');
  });

  it('refuses a quote that is missing, repeated or empty, naming each operation', () => {
    const plan = planTextEdits(TEXT, [replace('Hatter', 'x'), replace('Rabbit', 'x'), replace('', 'x'), replace('watch', 'clock')], OPEN);
    expect(faults(plan)).toEqual([
      { index: 0, fault: 'not-found' },
      { index: 1, fault: 'ambiguous' },
      { index: 2, fault: 'ambiguous' }
    ]);
  });

  it('finds every quote in the text as given, never in text another replace wrote', () => {
    expect(faults(planTextEdits(TEXT, [replace('watch', 'pocket watch'), replace('pocket', 'x')], OPEN)))
      .toEqual([{ index: 1, fault: 'not-found' }]);
  });

  it('refuses replaces whose quotes overlap, and keeps the first', () => {
    expect(faults(planTextEdits(TEXT, [replace('the Rabbit.', 'x'), replace('Rabbit. The', 'y')], OPEN)))
      .toEqual([{ index: 1, fault: 'overlapping' }]);
  });

  it('joins replaces that touch into one edit, carrying both operations', () => {
    const plan = planTextEdits(TEXT, [replace('watch.', 'watch!'), replace('checked its ', 'consulted its ')], OPEN);
    expect(plan).toMatchObject({ kind: 'planned', edits: [{ text: 'consulted its watch!', operations: [1, 0] }] });
    expect(plan.kind === 'planned' && plan.operations.map(({ index }) => index)).toEqual([0, 1]);
  });

  it('takes an empty replace-with as a deletion', () => {
    expect(applied(TEXT, [replace(' The Rabbit checked its watch.', '')])).toBe('Alice followed the Rabbit. Alice fell.');
  });

  it('counts by code units across surrogate pairs, and never splits one', () => {
    const text = 'Alice 🐇 ran. The 🐇 was late.';
    expect(applied(text, [replace('🐇 was', 'Rabbit was')])).toBe('Alice 🐇 ran. The Rabbit was late.');
    const lowHalf = '🐇'.charAt(1);
    expect(faults(planTextEdits('Alice 🐇 ran.', [replace(`${lowHalf} ran`, 'x')], OPEN))).toEqual([{ index: 0, fault: 'not-found' }]);
    expect(faults(planTextEdits('Alice 🐇 ran.', [replace(`Alice ${'🐇'.charAt(0)}`, 'x')], OPEN))).toEqual([{ index: 0, fault: 'not-found' }]);
  });

  it('plans CRLF text by its own code units, keeping its line breaks', () => {
    const text = 'Alice sat.\r\n\r\nThe Rabbit ran.\r\n';
    expect(applied(text, [replace('sat.\r\n\r\nThe', 'sat.\r\n\r\nA')])).toBe('Alice sat.\r\n\r\nA Rabbit ran.\r\n');
    expect(applied(text, [{ op: 'append', text: 'Alice followed.' }], { ...OPEN, separator: '\r\n\r\n' }))
      .toBe('Alice sat.\r\n\r\nThe Rabbit ran.\r\n\r\nAlice followed.\r\n');
  });
});

describe('planTextEdits: rewrite, append and prepend', () => {
  it('rewrites the content whole, and refuses a rewrite with anything else', () => {
    expect(applied(TEXT, [{ op: 'rewrite', text: 'Alice woke.' }])).toBe('Alice woke.');
    expect(faults(planTextEdits(TEXT, [{ op: 'rewrite', text: 'x' }, { op: 'append', text: 'y' }], OPEN))).toEqual([
      { index: 0, fault: 'conflicting-operations' },
      { index: 1, fault: 'conflicting-operations' }
    ]);
  });

  it('refuses a rewrite the rules do not allow', () => {
    expect(faults(planTextEdits(TEXT, [{ op: 'rewrite', text: 'x' }], { allowsRewrite: false })))
      .toEqual([{ index: 0, fault: 'not-allowed' }]);
  });

  it('refuses a second append or prepend', () => {
    expect(faults(planTextEdits(TEXT, [{ op: 'append', text: 'a' }, { op: 'append', text: 'b' }], OPEN))).toEqual([
      { index: 0, fault: 'conflicting-operations' },
      { index: 1, fault: 'conflicting-operations' }
    ]);
  });

  it('joins passages with a blank line, and an empty text without one', () => {
    expect(applied('Alice sat.', [{ op: 'prepend', text: 'First.' }, { op: 'append', text: 'Last.' }])).toBe('First.\n\nAlice sat.\n\nLast.');
    expect(applied('', [{ op: 'prepend', text: 'First.' }, { op: 'append', text: 'Last.' }])).toBe('First.\n\nLast.');
    expect(applied('', [{ op: 'append', text: 'Last.' }])).toBe('Last.');
    expect(applied('Alice sat.', [replace('Alice sat.', ''), { op: 'append', text: 'Last.' }])).toBe('Last.');
  });

  it('keeps front matter and the whitespace around the content', () => {
    const file = '---\ntitle: Alice\n---\n\nAlice sat.\n';
    const rules: TextEditRules = { allowsRewrite: true, skipLeading: '---\ntitle: Alice\n---\n'.length };
    expect(applied(file, [{ op: 'rewrite', text: 'Alice stood.' }], rules)).toBe('---\ntitle: Alice\n---\n\nAlice stood.\n');
    expect(applied(file, [{ op: 'prepend', text: 'First.' }, { op: 'append', text: 'Last.' }], rules))
      .toBe('---\ntitle: Alice\n---\n\nFirst.\n\nAlice sat.\n\nLast.\n');
  });

  it('puts an insertion before a quote at the same place, in one edit', () => {
    const plan = planTextEdits(TEXT, [replace('Alice followed', 'She followed'), { op: 'prepend', text: 'Chapter one.' }], OPEN);
    expect(plan).toMatchObject({ kind: 'planned', edits: [{ start: 0, end: 14, text: 'Chapter one.\n\nShe followed', operations: [1, 0] }] });
  });

  it('refuses a passage whose place falls inside a quote', () => {
    const file = 'Alice sat.\n\n';
    expect(faults(planTextEdits(file, [replace('sat.\n', 'stood.'), { op: 'append', text: 'Last.' }], OPEN)))
      .toEqual([{ index: 1, fault: 'overlapping' }]);
  });
});

describe('applyTextEdits', () => {
  it('applies from the last, so each earlier start holds', () => {
    expect(applyTextEdits('Alice sat by the Rabbit.', [{ start: 0, end: 5, text: 'She' }, { start: 17, end: 23, text: 'Hatter' }]))
      .toBe('She sat by the Hatter.');
  });
});
