/**
 * Dictionary history navigation rules (ADR 2026-10-14, D6, D8, and D9):
 * stepping like browser back and forward, the draft rule's dirty check, the
 * entry → view mapping, the `3 / 12` position label, and the prior-lookup
 * match.
 */

import {
  describeDictionaryHistoryPosition,
  dictionaryPhraseKey,
  dictionaryViewFromEntry,
  findPriorDictionaryLookups,
  isDictionaryFormDirty,
  normalizeDictionaryPhrase,
  stepDictionaryHistory
} from '@utils/dictionaryHistoryNavigation';
import { DictionaryHistoryEntry, DictionaryHistorySummary, DictionaryLookupRequest } from '@messages';

const IDS = ['newest', 'middle', 'oldest'];

describe('stepDictionaryHistory', () => {
  describe('older (‹)', () => {
    it('goes from live to the newest entry', () => {
      expect(stepDictionaryHistory({ ids: IDS, position: null, direction: 'older', hasDraft: false }))
        .toEqual({ kind: 'entry', id: 'newest' });
    });

    it('goes from an entry to the next older one', () => {
      expect(stepDictionaryHistory({ ids: IDS, position: 'newest', direction: 'older', hasDraft: false }))
        .toEqual({ kind: 'entry', id: 'middle' });
      expect(stepDictionaryHistory({ ids: IDS, position: 'middle', direction: 'older', hasDraft: true }))
        .toEqual({ kind: 'entry', id: 'oldest' });
    });

    it('stops at the oldest entry', () => {
      expect(stepDictionaryHistory({ ids: IDS, position: 'oldest', direction: 'older', hasDraft: true })).toBeNull();
    });

    it('has nowhere to go in an empty history', () => {
      expect(stepDictionaryHistory({ ids: [], position: null, direction: 'older', hasDraft: true })).toBeNull();
    });
  });

  describe('newer (›)', () => {
    it('goes from an entry to the next newer one', () => {
      expect(stepDictionaryHistory({ ids: IDS, position: 'oldest', direction: 'newer', hasDraft: false }))
        .toEqual({ kind: 'entry', id: 'middle' });
      expect(stepDictionaryHistory({ ids: IDS, position: 'middle', direction: 'newer', hasDraft: true }))
        .toEqual({ kind: 'entry', id: 'newest' });
    });

    it('goes from the newest entry back to the draft when one is stashed', () => {
      expect(stepDictionaryHistory({ ids: IDS, position: 'newest', direction: 'newer', hasDraft: true }))
        .toEqual({ kind: 'draft' });
    });

    it('stops at the newest entry when there is no draft', () => {
      expect(stepDictionaryHistory({ ids: IDS, position: 'newest', direction: 'newer', hasDraft: false })).toBeNull();
    });

    it('has nothing newer than live, even with a draft', () => {
      expect(stepDictionaryHistory({ ids: IDS, position: null, direction: 'newer', hasDraft: true })).toBeNull();
    });
  });

  describe('a position id the list does not hold counts as live', () => {
    it('steps older to the newest entry', () => {
      expect(stepDictionaryHistory({ ids: IDS, position: 'deleted', direction: 'older', hasDraft: false }))
        .toEqual({ kind: 'entry', id: 'newest' });
    });

    it('has nothing newer', () => {
      expect(stepDictionaryHistory({ ids: IDS, position: 'deleted', direction: 'newer', hasDraft: true })).toBeNull();
    });
  });
});

describe('isDictionaryFormDirty', () => {
  const subject: DictionaryLookupRequest = {
    word: 'petrichor',
    context: 'Rain on hot stone.',
    includeEncyclopedia: true,
    includePalettes: false,
    mode: 'standard'
  };
  const matchingForm = {
    word: 'petrichor',
    context: 'Rain on hot stone.',
    includeEncyclopedia: true,
    includePalettes: false
  };

  describe('with no subject (nothing looked up yet)', () => {
    it('is clean when the form is empty or only whitespace', () => {
      expect(isDictionaryFormDirty({ ...matchingForm, word: '', context: '' }, null)).toBe(false);
      expect(isDictionaryFormDirty({ ...matchingForm, word: '   ', context: '\n\t ' }, null)).toBe(false);
    });

    it('is dirty when the form has a word or context', () => {
      expect(isDictionaryFormDirty({ ...matchingForm, context: '' }, null)).toBe(true);
      expect(isDictionaryFormDirty({ ...matchingForm, word: '' }, null)).toBe(true);
    });
  });

  describe('with a subject', () => {
    it('is clean when the form matches the request behind the result', () => {
      expect(isDictionaryFormDirty(matchingForm, subject)).toBe(false);
    });

    it('ignores whitespace the submit normalization would remove', () => {
      expect(isDictionaryFormDirty({
        ...matchingForm,
        word: '  petrichor ',
        context: '\n Rain on hot stone.  '
      }, subject)).toBe(false);
    });

    it('compares the word after the six-word cut the tab applies on submit', () => {
      const long = { ...subject, word: 'one two three four five six' };
      expect(isDictionaryFormDirty({ ...matchingForm, word: 'one  two three four five six seven' }, long)).toBe(false);
    });

    it.each([
      ['word', { word: 'geosmin' }],
      ['context', { context: 'Rain on cold stone.' }],
      ['encyclopedia option', { includeEncyclopedia: false }],
      ['palettes option', { includePalettes: true }]
    ])('is dirty when the %s differs', (_field, change) => {
      expect(isDictionaryFormDirty({ ...matchingForm, ...change }, subject)).toBe(true);
    });
  });
});

describe('dictionaryViewFromEntry', () => {
  it('maps every request field into the view, and the request becomes the lookup subject', () => {
    const entry: DictionaryHistoryEntry = {
      id: 'h1',
      createdAt: '2026-10-14T12:00:00.000Z',
      request: {
        word: 'petrichor',
        context: 'Rain on hot stone.',
        includeEncyclopedia: false,
        includePalettes: true,
        mode: 'fast',
        sourceUri: 'file:///novel/ch1.md',
        relativePath: 'ch1.md'
      },
      modelIds: ['anthropic/claude'],
      toolName: 'dictionary_fast_generate',
      result: '# petrichor'
    };

    expect(dictionaryViewFromEntry(entry)).toEqual({
      word: 'petrichor',
      context: 'Rain on hot stone.',
      includeEncyclopedia: false,
      includePalettes: true,
      sourceUri: 'file:///novel/ch1.md',
      relativePath: 'ch1.md',
      result: '# petrichor',
      toolName: 'dictionary_fast_generate',
      lookupSubject: entry.request
    });
  });

  it('clears the source fields when the entry has no source', () => {
    const view = dictionaryViewFromEntry({
      id: 'h2',
      createdAt: '2026-10-14T12:00:00.000Z',
      request: { word: 'umbra', context: '', includeEncyclopedia: true, includePalettes: true, mode: 'standard' },
      modelIds: [],
      toolName: 'dictionary_lookup',
      result: '# umbra'
    });

    expect(view.sourceUri).toBe('');
    expect(view.relativePath).toBe('');
  });
});

describe('describeDictionaryHistoryPosition', () => {
  it('counts from the newest entry as 1', () => {
    expect(describeDictionaryHistoryPosition(IDS, 'newest')).toEqual({ index: 1, total: 3 });
    expect(describeDictionaryHistoryPosition(IDS, 'oldest')).toEqual({ index: 3, total: 3 });
  });

  it('has no index when live or when the id is not listed', () => {
    expect(describeDictionaryHistoryPosition(IDS, null)).toEqual({ index: null, total: 3 });
    expect(describeDictionaryHistoryPosition(IDS, 'deleted')).toEqual({ index: null, total: 3 });
  });

  it('reports an empty history', () => {
    expect(describeDictionaryHistoryPosition([], null)).toEqual({ index: null, total: 0 });
  });
});

describe('normalizeDictionaryPhrase', () => {
  it('collapses whitespace, trims, and keeps six words', () => {
    expect(normalizeDictionaryPhrase('  the   quick\tbrown fox jumps over the dog ')).toBe('the quick brown fox jumps over');
    expect(normalizeDictionaryPhrase('   ')).toBe('');
  });
});

describe('dictionaryPhraseKey', () => {
  it('names a phrase by its submitted form, ignoring case and spacing', () => {
    expect(dictionaryPhraseKey('  Bated   Breath ')).toBe('bated breath');
    expect(dictionaryPhraseKey('LUMINOUS')).toBe(dictionaryPhraseKey('luminous'));
  });
});

describe('findPriorDictionaryLookups', () => {
  const summary = (id: string, word: string): DictionaryHistorySummary => ({
    id,
    createdAt: '2026-10-14T12:00:00.000Z',
    word,
    contextPreview: '',
    includeEncyclopedia: true,
    includePalettes: true,
    mode: 'standard',
    modelIds: []
  });
  const ENTRIES = [
    summary('h4', 'luminous'),
    summary('h3', 'bated breath'),
    summary('h2', 'Luminous'),
    summary('h1', 'umbra')
  ];

  it('returns every recorded lookup of the phrase, newest first, whatever its case', () => {
    expect(findPriorDictionaryLookups(ENTRIES, 'LUMINOUS', null).map(entry => entry.id)).toEqual(['h4', 'h2']);
    expect(findPriorDictionaryLookups(ENTRIES, ' bated  breath', null).map(entry => entry.id)).toEqual(['h3']);
  });

  it('matches whole phrases only', () => {
    expect(findPriorDictionaryLookups(ENTRIES, 'bated', null)).toEqual([]);
    expect(findPriorDictionaryLookups(ENTRIES, 'luminous glow', null)).toEqual([]);
  });

  it('offers nothing for an empty word or an empty history', () => {
    expect(findPriorDictionaryLookups(ENTRIES, '   ', null)).toEqual([]);
    expect(findPriorDictionaryLookups([], 'luminous', null)).toEqual([]);
  });

  it('offers nothing when the result pane already shows one of the matches', () => {
    expect(findPriorDictionaryLookups(ENTRIES, 'luminous', 'h2')).toEqual([]);
    expect(findPriorDictionaryLookups(ENTRIES, 'luminous', 'h1').map(entry => entry.id)).toEqual(['h4', 'h2']);
  });
});
