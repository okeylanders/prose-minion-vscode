import {
  extractWorkshopActionableFindings,
  WORKSHOP_ACTIONABLE_FINDING_BOUNDS
} from '@/application/services/workshop/WorkshopActionableFindings';

describe('extractWorkshopActionableFindings', () => {
  it('extracts only an exact, single-line Next steps list', () => {
    expect(extractWorkshopActionableFindings([
      '# Report',
      'Evidence stays verbatim.',
      '### Next steps',
      '- Clarify who moves the cup before the door opens.',
      '* Remove the repeated weather image.',
      '### Notes',
      '- This belongs to another section.'
    ].join('\n'))).toEqual([
      { key: 'finding-1', ordinal: 1, text: 'Clarify who moves the cup before the door opens.' },
      { key: 'finding-2', ordinal: 2, text: 'Remove the repeated weather image.' }
    ]);
  });

  it.each([
    ['heuristic imperative prose', 'You should rewrite the opening.'],
    ['wrong heading case', '### Next Steps\n- Rewrite the opening.'],
    ['duplicate sections', '### Next steps\n- One.\n### Next steps\n- Two.'],
    ['non-list content', '### Next steps\nRewrite the opening.'],
    ['duplicate items', '### Next steps\n- One.\n- One.'],
    ['nested item', '### Next steps\n  - Nested.'],
    ['multiline item', '### Next steps\n- One.\n  Continued.']
  ])('rejects %s', (_label, report) => {
    expect(extractWorkshopActionableFindings(report)).toEqual([]);
  });

  it('rejects oversized item and count payloads wholesale', () => {
    const oversized = `### Next steps\n- ${'x'.repeat(
      WORKSHOP_ACTIONABLE_FINDING_BOUNDS.itemCharacters + 1
    )}`;
    const tooMany = [
      '### Next steps',
      ...Array.from(
        { length: WORKSHOP_ACTIONABLE_FINDING_BOUNDS.items + 1 },
        (_, index) => `- Item ${index}`
      )
    ].join('\n');

    expect(extractWorkshopActionableFindings(oversized)).toEqual([]);
    expect(extractWorkshopActionableFindings(tooMany)).toEqual([]);
  });
});
