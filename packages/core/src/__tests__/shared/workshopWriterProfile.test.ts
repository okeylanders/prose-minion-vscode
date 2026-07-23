import {
  coerceWorkshopWriterProfile,
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  isWorkshopWriterProfileActive,
  WORKSHOP_WRITER_PROFILE_LIMITS
} from '@messages';

describe('Workshop writer profile validation', () => {
  it('accepts a complete object and trims committed strings', () => {
    expect(coerceWorkshopWriterProfile({
      enabled: true,
      preferredAddress: '  Okey  ',
      bio: '  I write fiction.  '
    })).toEqual({
      enabled: true,
      preferredAddress: 'Okey',
      bio: 'I write fiction.'
    });
  });

  it.each([
    undefined,
    {},
    { enabled: true, preferredAddress: 'Okey' },
    { enabled: 'yes', preferredAddress: '', bio: '' },
    { enabled: true, preferredAddress: '', bio: '', inferredMood: 'sad' },
    { enabled: true, preferredAddress: 'x'.repeat(WORKSHOP_WRITER_PROFILE_LIMITS.preferredAddress + 1), bio: '' },
    { enabled: true, preferredAddress: '', bio: 'x'.repeat(WORKSHOP_WRITER_PROFILE_LIMITS.bio + 1) }
  ])('fails invalid or partial values closed to disabled and empty', (raw) => {
    expect(coerceWorkshopWriterProfile(raw)).toEqual(DEFAULT_WORKSHOP_WRITER_PROFILE);
  });

  it('accepts both writer-authored fields exactly at their configured limits', () => {
    const atLimit = {
      enabled: true,
      preferredAddress: 'x'.repeat(WORKSHOP_WRITER_PROFILE_LIMITS.preferredAddress),
      bio: 'y'.repeat(WORKSHOP_WRITER_PROFILE_LIMITS.bio)
    };

    expect(coerceWorkshopWriterProfile(atLimit)).toEqual(atLimit);
  });

  it('is active only when enabled and at least one normalized field has content', () => {
    expect(isWorkshopWriterProfileActive(DEFAULT_WORKSHOP_WRITER_PROFILE)).toBe(false);
    expect(isWorkshopWriterProfileActive({ enabled: true, preferredAddress: '', bio: '' })).toBe(false);
    expect(isWorkshopWriterProfileActive({ enabled: false, preferredAddress: 'Okey', bio: '' })).toBe(false);
    expect(isWorkshopWriterProfileActive({ enabled: true, preferredAddress: 'Okey', bio: '' })).toBe(true);
  });
});
