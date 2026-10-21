/**
 * Each paragraph's instances and dialogue spans, indexed once per text
 * (PR #162 F-01, `LightboxSpanIndex`). Every answer is the plain scan's,
 * checked here for every span of a few mixed paragraphs, and each
 * paragraph is detected once per text, and again only when its string
 * changes. Every line is a synthetic sentence written for these tests.
 */
import { findDialogueSpans } from '@/utils/dialogueSpans';
import { LIGHTBOX_NUMBER_PATTERNS } from '@/infrastructure/lightbox/LightboxNumbers';
import {
  lightboxIntervalReach,
  lightboxParagraphDialogue,
  lightboxParagraphPattern
} from '@/infrastructure/lightbox/LightboxSpanIndex';

const PARAGRAPHS = [
  // Speech, narration, speech again; contractions in each.
  '“It’s late,” she said. It was dark, and they’re gone. “I’m really very cold.”',
  // A stray closing mark opens nothing; an unclosed quote runs to the end.
  'He was quite still,” and then: “I’m not, I’m truly not',
  // No dialogue at all.
  'The hall was very dark and the door was shut.'
];

describe('every answer is the plain scan\'s, for every span of the paragraph', () => {
  it.each(['being-verbs', 'adverbs', 'intensifiers'] as const)('%s', (stat) => {
    PARAGRAPHS.forEach((source, index) => {
      const instances = LIGHTBOX_NUMBER_PATTERNS[stat](source);
      const spans = findDialogueSpans(source);
      const inSpan = (start: number, end: number) => spans.some((span) => span.start <= start && end <= span.end);
      const narrated = instances.filter((instance) => !inSpan(instance.start, instance.end));
      const pattern = lightboxParagraphPattern(PARAGRAPHS, stat, index + 1);
      const dialogue = lightboxParagraphDialogue(PARAGRAPHS, index + 1);
      for (let start = 0; start < source.length; start++) {
        for (let end = start + 1; end <= source.length; end++) {
          const scan = [
            instances.some((instance) => start <= instance.start && instance.end <= end),
            narrated.some((instance) => start <= instance.start && instance.end <= end),
            inSpan(start, end),
            spans.some((span) => span.start < end && start < span.end)
          ];
          expect([pattern?.holds(start, end), pattern?.holdsInNarration(start, end), dialogue?.holds(start, end), dialogue?.overlaps(start, end)])
            .toEqual(scan);
        }
      }
    });
  });

  it('answers no paragraph the text does not have', () => {
    expect([lightboxParagraphPattern(PARAGRAPHS, 'being-verbs', 0), lightboxParagraphPattern(PARAGRAPHS, 'being-verbs', 4),
      lightboxParagraphDialogue(PARAGRAPHS, 4)]).toEqual([undefined, undefined, undefined]);
  });

  it('reaches as far as any interval starting at or before a place, in any order', () => {
    const reach = lightboxIntervalReach([{ start: 10, end: 12 }, { start: 0, end: 30 }, { start: 5, end: 6 }]);
    expect([reach(-1), reach(0), reach(4), reach(5), reach(10), reach(40)]).toEqual([-Infinity, 30, 30, 30, 30, 30]);
  });
});

describe('each paragraph is indexed once per text', () => {
  afterEach(() => jest.restoreAllMocks());

  it('detects a paragraph once however often it is asked, and again only when its string changes', () => {
    const detect = LIGHTBOX_NUMBER_PATTERNS['being-verbs'];
    const calls: string[] = [];
    jest.spyOn(LIGHTBOX_NUMBER_PATTERNS, 'being-verbs').mockImplementation((text: string) => {
      calls.push(text);
      return detect(text);
    });
    const text = ['It was dark.', '“I’m here.”'];
    for (let round = 0; round < 3; round++) {
      lightboxParagraphPattern(text, 'being-verbs', 1)?.holds(0, 12);
      lightboxParagraphPattern(text, 'being-verbs', 2)?.holdsInNarration(0, 11);
    }
    expect(calls).toEqual(['It was dark.', '“I’m here.”']);
    // Another array of the same words is another text, indexed on its own.
    expect(lightboxParagraphPattern([...text], 'being-verbs', 1)?.holds(0, 12)).toBe(true);
    // A paragraph changed in place is indexed afresh, never answered from its old string.
    text[0] = 'It is dark.';
    expect(lightboxParagraphPattern(text, 'being-verbs', 1)?.holds(3, 5)).toBe(true);
    expect(calls).toEqual(['It was dark.', '“I’m here.”', 'It was dark.', 'It is dark.']);
  });
});
