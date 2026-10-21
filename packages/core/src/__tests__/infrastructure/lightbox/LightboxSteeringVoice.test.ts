/**
 * Where a steering note's instance stands (epic decision 26,
 * `LightboxSteeringVoice`): in dialogue only when every instance of its
 * figure its checked quote holds is inside double quotation marks, the
 * steering measure's own dialogue (`findDialogueSpans`); and the host's
 * words for a note in dialogue. The rule itself, fresh, carried and at
 * Bring, is pinned in `LightboxSteeringVoiceRule.test.ts`. Every line is a
 * synthetic sentence written for these tests.
 */
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import {
  LIGHTBOX_STEERING_VOICE_REASONS,
  holdLightboxSteeringVoice,
  lightboxSteeringInstanceVoice
} from '@/infrastructure/lightbox/LightboxSteeringVoice';
import { WORKSHOP_LIGHTBOX_TILE_LIMITS } from '@messages';
import { STEERING_VOICE_LINES } from './lightboxSteeringVoiceFixtures';

describe('where a note\'s instance stands', () => {
  const verifier = createLightboxQuoteVerifier(STEERING_VOICE_LINES);

  it('places it in dialogue only when every instance its checked quote holds is in double quotation marks', () => {
    expect([
      lightboxSteeringInstanceVoice(verifier, 'being-verbs', { paragraph: 1, text: 'I’m late, I’m really very late' }),
      lightboxSteeringInstanceVoice(verifier, 'being-verbs', { paragraph: 2, text: 'The hall was dark' }),
      // One instance in speech, one in narration: a narration note.
      lightboxSteeringInstanceVoice(verifier, 'being-verbs', { paragraph: 3, text: 'It’s cold in here,” she said, and the hall was dark' }),
      lightboxSteeringInstanceVoice(verifier, 'being-verbs', { paragraph: 3, text: 'It’s cold in here' }),
      // The shared matcher's limit: single-quoted speech reads as narration.
      lightboxSteeringInstanceVoice(verifier, 'being-verbs', { paragraph: 4, text: 'It’s cold in here' }),
      lightboxSteeringInstanceVoice(verifier, 'adverbs', { paragraph: 1, text: 'I’m really very late' }),
      lightboxSteeringInstanceVoice(verifier, 'intensifiers', { paragraph: 1, text: 'really very late' }),
      // No instance in the quote, or no quote: nothing to place.
      lightboxSteeringInstanceVoice(verifier, 'being-verbs', { paragraph: 1, text: 'said the Rabbit' }),
      lightboxSteeringInstanceVoice(verifier, 'being-verbs', undefined)
    ]).toEqual(['dialogue', 'narration', 'narration', 'dialogue', 'narration', 'dialogue', 'dialogue', undefined, undefined]);
  });
});

describe('the host\'s words for a note in dialogue', () => {
  it('says why there is no nudge or example, each within one Workshop point', () => {
    expect(LIGHTBOX_STEERING_VOICE_REASONS).toEqual({
      none: 'Its instance is in dialogue, the character\'s voice: the board reads it there but offers no nudge or example.',
      withheld: {
        fresh: 'Its instance is in dialogue, the character\'s voice, so no nudge or example the reading gave is shown.',
        carried: 'Its instance now stands in dialogue, the character\'s voice, so its nudge, and any example, are no longer shown.'
      }
    });
    const lines = [LIGHTBOX_STEERING_VOICE_REASONS.none, ...Object.values(LIGHTBOX_STEERING_VOICE_REASONS.withheld)];
    expect(lines.every((line) => line.length <= WORKSHOP_LIGHTBOX_TILE_LIMITS.pointCharacters)).toBe(true);
  });

  it('holds a note\'s fields: dialogue keeps the stance and drops the nudge and example; narration and earns are untouched', () => {
    const leaning = { stance: 'leans' as const, nudge: 'A verb may be worth a look.', example: { before: 'was dark', after: 'darkened' } };
    expect(holdLightboxSteeringVoice(leaning, 'dialogue', 'fresh')).toEqual({ stance: 'leans', voice: LIGHTBOX_STEERING_VOICE_REASONS.withheld.fresh });
    expect(holdLightboxSteeringVoice(leaning, 'dialogue', 'carried')).toEqual({ stance: 'leans', voice: LIGHTBOX_STEERING_VOICE_REASONS.withheld.carried });
    expect(holdLightboxSteeringVoice({ stance: 'compensates' as const }, 'dialogue', 'fresh'))
      .toEqual({ stance: 'compensates', voice: LIGHTBOX_STEERING_VOICE_REASONS.none });
    // A line already drawn stays as it is while the instance stays in dialogue.
    expect(holdLightboxSteeringVoice({ stance: 'leans' as const, voice: LIGHTBOX_STEERING_VOICE_REASONS.withheld.fresh }, 'dialogue', 'carried'))
      .toEqual({ stance: 'leans', voice: LIGHTBOX_STEERING_VOICE_REASONS.withheld.fresh });
    expect(holdLightboxSteeringVoice(leaning, 'narration', 'fresh')).toBe(leaning);
    const earns = { stance: 'earns' as const };
    expect(holdLightboxSteeringVoice(earns, 'dialogue', 'fresh')).toBe(earns);
  });
});
