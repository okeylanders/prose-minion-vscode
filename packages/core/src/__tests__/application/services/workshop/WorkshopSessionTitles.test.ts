import {
  WORKSHOP_SESSION_TITLE_MAX_LENGTH,
  requireWorkshopSessionTitle,
  workshopBranchTitle
} from '@/application/services/workshop/WorkshopSessionTitles';

describe('Workshop session titles', () => {
  it('trims a title and refuses a blank or overlong one', () => {
    expect(requireWorkshopSessionTitle('  Chapter 3 — Felix  ')).toBe('Chapter 3 — Felix');
    expect(() => requireWorkshopSessionTitle('   ')).toThrow('cannot be blank');
    expect(requireWorkshopSessionTitle('x'.repeat(WORKSHOP_SESSION_TITLE_MAX_LENGTH)))
      .toHaveLength(WORKSHOP_SESSION_TITLE_MAX_LENGTH);
    expect(() => requireWorkshopSessionTitle('x'.repeat(WORKSHOP_SESSION_TITLE_MAX_LENGTH + 1)))
      .toThrow('limited to 160 characters');
  });

  describe('workshopBranchTitle (ADR 2026-09-30, D3)', () => {
    it('names a branch after its source', () => {
      expect(workshopBranchTitle('Chapter 3 — Felix')).toBe('Chapter 3 — Felix — branch');
      // A branch of a branch reads as one.
      expect(workshopBranchTitle('Chapter 3 — Felix — branch'))
        .toBe('Chapter 3 — Felix — branch — branch');
    });

    it('trims a long source title so the suffix still fits the limit', () => {
      const title = workshopBranchTitle('a'.repeat(200));

      expect(title).toBe(`${'a'.repeat(151)} — branch`);
      expect(title).toHaveLength(WORKSHOP_SESSION_TITLE_MAX_LENGTH);
      expect(requireWorkshopSessionTitle(title)).toBe(title);
      // A cut that lands after a space drops it rather than doubling it.
      expect(workshopBranchTitle(`${'a'.repeat(150)} ${'b'.repeat(20)}`))
        .toBe(`${'a'.repeat(150)} — branch`);
    });

    it('never cuts a long source title inside a surrogate pair', () => {
      // 150 letters, then emoji: the 151st code unit is a high surrogate.
      const title = workshopBranchTitle(`${'a'.repeat(150)}${'🌒'.repeat(10)}`);

      expect(title).toBe(`${'a'.repeat(150)} — branch`);
      expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(title)).toBe(false);
    });
  });
});
