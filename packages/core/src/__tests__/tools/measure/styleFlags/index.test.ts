/**
 * Style Flags: the exported detectors (Lightbox Slice 4B) and the tool's
 * output, which must not change when it counts through them. The legacy
 * oracle below is the tool's counting before the detectors were exported,
 * copied verbatim, so the Metrics tab's flags are pinned to it.
 */

import {
  STYLE_FLAG_FILLER_WORDS,
  STYLE_FLAG_WEAK_VERBS,
  StyleFlags,
  findAdverbs,
  findFillerWords,
  findPassiveVoice,
  findWeakVerbs
} from '@/tools/measure/styleFlags';

/** The pre-4B counting, verbatim from `StyleFlags`'s private checks. */
function legacyFlagCounts(text: string): Record<string, { count: number; examples: string[] }> {
  const unique = (matches: string[], limit: number) => Array.from(new Set(matches.map((m) => m.toLowerCase()))).slice(0, limit);
  const adverbs = text.match(/\b\w+ly\b/gi) || [];
  const passive = text.match(/\b(was|were|been|being)\s+\w+ed\b/gi) || [];
  const fillers = ['just', 'really', 'very', 'quite', 'rather', 'somewhat', 'somehow', 'actually', 'basically', 'literally'];
  const filler = text.match(new RegExp(`\\b(${fillers.join('|')})\\b`, 'gi')) || [];
  // The weak-verb check before its detector was exported (Slice 4E), verbatim.
  const weakVerbs = ['is', 'are', 'was', 'were', 'has', 'have', 'had', 'do', 'does', 'did', 'make', 'makes', 'made', 'get', 'gets', 'got'];
  const weak = text.match(new RegExp(`\\b(${weakVerbs.join('|')})\\b`, 'gi')) || [];
  /* eslint-disable @typescript-eslint/naming-convention -- the legacy service's own result keys. */
  return {
    'Adverbs (-ly words)': { count: adverbs.length, examples: unique(adverbs, 5) },
    'Passive Voice': { count: passive.length, examples: unique(passive, 5) },
    'Filler Words': { count: filler.length, examples: unique(filler, 5) },
    'Weak Verbs': { count: weak.length, examples: unique(weak, 5) }
  };
  /* eslint-enable @typescript-eslint/naming-convention */
}

const TEXTS = [
  'Alice was beginning to get very tired of sitting by her sister on the bank. It was labelled “ORANGE MARMALADE”, ' +
    'and the shelves were filled with jars. She fell very slowly, quite calmly, really.',
  'There was nothing so VERY remarkable in that; nor did Alice think it so VERY much out of the way. Just then, ' +
    'rather suddenly, the door was opened and the Rabbit was gone. It had been warned, actually, being watched.',
  '',
  'Nothing here.'
];

describe('Style Flags detectors', () => {
  it('counts exactly what the tool counted before they were exported', () => {
    const tool = new StyleFlags();
    for (const text of TEXTS) {
      const flags = Object.fromEntries(tool.analyze({ text }).flags.map((flag) => [flag.type, flag]));
      const legacy = legacyFlagCounts(text);
      for (const [type, expected] of Object.entries(legacy)) {
        if (expected.count === 0) {
          expect(flags[type]).toBeUndefined();
        } else {
          expect({ count: flags[type].count, examples: flags[type].examples }).toEqual(expected);
        }
      }
    }
  });

  it('places each match by its offsets in the text', () => {
    const text = TEXTS[1];
    for (const match of [...findPassiveVoice(text), ...findAdverbs(text), ...findFillerWords(text)]) {
      expect(text.slice(match.start, match.end)).toBe(match.text);
    }
    expect(findPassiveVoice(text).map((match) => match.text)).toEqual(['was opened', 'been warned', 'being watched']);
    expect(findFillerWords(text).map((match) => match.text.toLowerCase())).toEqual(['very', 'very', 'just', 'rather', 'actually']);
  });

  it('finds the weak verbs it counts as whole words, with offsets (Slice 4E)', () => {
    const text = TEXTS[1];
    expect(findWeakVerbs(text).map((match) => text.slice(match.start, match.end))).toEqual(['was', 'did', 'was', 'was', 'had']);
    expect(findWeakVerbs('Has HAD had; hasten madder gotten')).toHaveLength(3);
    expect(STYLE_FLAG_WEAK_VERBS).toHaveLength(16);
  });

  it('names the filler words it counts', () => {
    expect(STYLE_FLAG_FILLER_WORDS).toContain('very');
    expect(findFillerWords('VERY very Very')).toHaveLength(3);
    expect(findFillerWords('everyone delivery')).toHaveLength(0);
  });
});
