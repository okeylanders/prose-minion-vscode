/**
 * Reading edit-offer frames out of a persona's reply (ADR 2026-11-10 D1;
 * epic Slice 1): one pass with the other trailers, so any kind may stand
 * last; each frame judged on its own with a named rejection; an offer never
 * shows in the bubble's text, the streaming text or retained history, and
 * never earns a host line. Made-up text: Alice.
 */
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  extractWorkshopReplyControls,
  hasWorkshopEditOfferText,
  sanitizeWorkshopReplyForRetention,
  stripWorkshopReplyTrailersForRetention,
  stripWorkshopReplyTrailersForStreaming,
  WORKSHOP_FILE_EDIT_ONLY_REPLY_LINE,
  WORKSHOP_FILE_EDIT_REDACTION,
  WORKSHOP_MEMORY_ONLY_REPLY_LINE,
  WORKSHOP_MEMORY_PROPOSAL_REDACTION
} from '@/utils/workshopReplyControls';
import { WORKSHOP_EDIT_OFFER_REDACTION } from '@/utils/workshopReplyEditOffers';
import { editOfferFrame, fileEditFrame } from '@/__tests__/application/services/workshop/fileEdits/fileEditFixtures';
import { memoryFrame } from '@/__tests__/application/services/workshop/memory/memoryProposalFixtures';

const OPEN = { memoryOpen: true, fileEditsOpen: true };
const SAID = 'Three slips in the excerpt: "begining" is the first.';
const offers = (reply: string, options = OPEN) => extractWorkshopReplyControls(reply, options).editOffers;
const FIXES = editOfferFrame({ excerpt: true, count: 3 });
const REWRITES = editOfferFrame({ kind: 'rewrites', count: 2 });

describe('edit-offer frames in a reply', () => {
  it('one frame per kind becomes one offer each; the prose is kept, the frames removed and redacted', () => {
    const controls = extractWorkshopReplyControls(`${SAID}\n\n${FIXES}\n${REWRITES}\n`, OPEN);
    expect(controls.rest).toBe(SAID);
    expect(controls.redacted).toBe(`${SAID}\n\n${WORKSHOP_EDIT_OFFER_REDACTION}\n\n${WORKSHOP_EDIT_OFFER_REDACTION}`);
    expect(controls.memory).toEqual({ kind: 'none' });
    expect(controls.fileEdits).toBeUndefined();
    expect(controls.editOffers).toEqual({
      kind: 'frames',
      offers: [
        { kind: 'fixes', target: { kind: 'excerpt' }, count: 3 },
        { kind: 'rewrites', target: { kind: 'resource', group: 'chapters', path: 'chapters/down-the-rabbit-hole.md' }, count: 2 }
      ],
      rejections: []
    });
    expect(WORKSHOP_EDIT_OFFER_REDACTION).toBe('[edit offer removed]');
  });

  it('a reply with no offer frame has no offers at all', () => {
    expect(extractWorkshopReplyControls(`${SAID}\n\n${fileEditFrame()}`, OPEN)).not.toHaveProperty('editOffers');
    expect(hasWorkshopEditOfferText(SAID)).toBe(false);
    expect(hasWorkshopEditOfferText(`${SAID}\n<PROSE-MINION-EDIT-OFFER>`)).toBe(true);
  });

  it('stands at the tail with the other trailers, in any order among them', () => {
    const controls = extractWorkshopReplyControls(`${SAID}\n\n${FIXES}\n${memoryFrame()}\n${REWRITES}`, OPEN);
    expect(controls.rest).toBe(SAID);
    expect(controls.editOffers?.offers.map((offer) => offer.kind)).toEqual(['fixes', 'rewrites']);
    expect(controls.editOffers?.rejections).toEqual([]);
    expect(controls.memory).toMatchObject({ kind: 'frames', rejections: [] });
    expect(controls.redacted).toBe([SAID, WORKSHOP_EDIT_OFFER_REDACTION, WORKSHOP_MEMORY_PROPOSAL_REDACTION, WORKSHOP_EDIT_OFFER_REDACTION].join('\n\n'));
  });
});

describe('each dropped frame has its own named rejection (D1)', () => {
  it('malformed, unclosed, unopened, nested, mistagged and misplaced', () => {
    expect(offers(`${SAID}\n\n${editOfferFrame({ kind: null })}`)?.rejections).toEqual(['malformed:missing-kind']);
    expect(offers(`${SAID}\n\n${editOfferFrame({ count: 0 })}`)?.rejections).toEqual(['malformed:invalid-count']);
    expect(offers(`${SAID}\n\n${editOfferFrame({ path: '../one.md' })}`)?.rejections).toEqual(['malformed:invalid-path']);
    expect(offers(`${SAID}\n\n${editOfferFrame({ extra: ['<why>Alice</why>'] })}`)?.rejections).toEqual(['malformed:unknown-element']);
    expect(offers(`${SAID}\n\n<prose-minion-edit-offer><kind>fixes</kind><excerpt/>`)?.rejections).toEqual(['malformed:unclosed']);
    expect(offers(`${SAID}\n\n</prose-minion-edit-offer>`)?.rejections).toEqual(['malformed:unopened']);
    expect(offers(`${SAID}\n\n<prose-minion-edit-offer>${FIXES}</prose-minion-edit-offer>`)?.rejections).toEqual(['malformed:nested']);
    expect(offers(`${SAID}\n\n<prose-minion-edit-offer kind="fixes"><excerpt/></prose-minion-edit-offer>`)?.rejections).toEqual(['malformed:tag']);
    expect(offers(`${FIXES}\n\n${SAID}`)).toEqual({ kind: 'frames', offers: [], rejections: ['misplaced'] });
  });

  it('a frame nested in another kind\'s frame drops that frame, and is no offer', () => {
    const controls = extractWorkshopReplyControls(`${SAID}\n\n<prose-minion-file-edit>${FIXES}</prose-minion-file-edit>`, OPEN);
    expect(controls.editOffers).toBeUndefined();
    expect(controls.fileEdits?.rejections).toEqual(['malformed:nested']);
  });

  it('a frame over frameCharacters is dropped whole, unread', () => {
    const padding = ' '.repeat(PROMPT_BUDGETS.workshopEditOffers.frameCharacters);
    expect(offers(`${SAID}\n\n<prose-minion-edit-offer><kind>fixes</kind><excerpt/>${padding}</prose-minion-edit-offer>`))
      .toEqual({ kind: 'frames', offers: [], rejections: ['oversized'] });
    const inside = `<kind>fixes</kind><excerpt/>`;
    const exact = `${inside}${' '.repeat(PROMPT_BUDGETS.workshopEditOffers.frameCharacters - inside.length)}`;
    expect(offers(`${SAID}\n\n<prose-minion-edit-offer>${exact}</prose-minion-edit-offer>`)?.offers).toHaveLength(1);
  });

  it('an unknown kind, and a second frame of a kind', () => {
    expect(offers(`${SAID}\n\n${editOfferFrame({ kind: 'polish' })}`)).toEqual({ kind: 'frames', offers: [], rejections: ['unknown-kind'] });
    const twice = offers(`${SAID}\n\n${FIXES}\n${editOfferFrame({ kind: 'fixes' })}\n${REWRITES}\n${editOfferFrame({ kind: 'rewrites', excerpt: true })}`);
    expect(twice?.offers).toEqual([
      { kind: 'fixes', target: { kind: 'excerpt' }, count: 3 },
      { kind: 'rewrites', target: { kind: 'resource', group: 'chapters', path: 'chapters/down-the-rabbit-hole.md' }, count: 2 }
    ]);
    expect(twice?.rejections).toEqual(['duplicate-kind', 'duplicate-kind']);
    expect(twice?.offers.length).toBeLessThanOrEqual(PROMPT_BUDGETS.workshopEditOffers.offersPerReply);
  });

  it('one bad frame drops only itself', () => {
    const judged = offers(`${SAID}\n\n${editOfferFrame({ kind: 'polish' })}\n${REWRITES}`);
    expect(judged?.offers.map((offer) => offer.kind)).toEqual(['rewrites']);
    expect(judged?.rejections).toEqual(['unknown-kind']);
  });

  it('a reply with no prose offers nothing', () => {
    expect(offers(`${FIXES}\n${REWRITES}`)).toEqual({ kind: 'frames', offers: [], rejections: ['no-prose', 'no-prose'] });
    expect(offers(` \n${FIXES}\n${memoryFrame()}`)?.rejections).toEqual(['no-prose']);
  });

  it('with file edits off, every frame is stripped, dropped and counted', () => {
    const controls = extractWorkshopReplyControls(`${SAID}\n\n${FIXES}\n${REWRITES}`, { memoryOpen: true, fileEditsOpen: false });
    expect(controls.rest).toBe(SAID);
    expect(controls.editOffers).toEqual({ kind: 'frames', offers: [], rejections: ['file-edits-off', 'file-edits-off'] });
    // Absent reads as off.
    expect(extractWorkshopReplyControls(`${SAID}\n\n${FIXES}`, { memoryOpen: true }).editOffers?.rejections).toEqual(['file-edits-off']);
  });

  it('a reply that keeps a file-edit proposal offers nothing; one whose proposals were all dropped still may', () => {
    const proposed = extractWorkshopReplyControls(`${SAID}\n\n${fileEditFrame()}\n${FIXES}\n${REWRITES}`, OPEN);
    expect(proposed.fileEdits?.proposals).toHaveLength(1);
    expect(proposed.editOffers).toEqual({ kind: 'frames', offers: [], rejections: ['has-file-edit-proposal', 'has-file-edit-proposal'] });
    const dropped = extractWorkshopReplyControls(`${SAID}\n\n${FIXES}\n${fileEditFrame({ why: null })}`, OPEN);
    expect(dropped.fileEdits).toEqual({ kind: 'frames', proposals: [], rejections: ['malformed:missing-why'] });
    expect(dropped.editOffers?.offers).toHaveLength(1);
  });
});

describe('an offer never shows, and never earns a host line (D1)', () => {
  it('is removed from retained history, and a reply of offers alone leaves nothing', () => {
    expect(sanitizeWorkshopReplyForRetention(`${SAID}\n\n${FIXES}\n${REWRITES}`)).toBe(SAID);
    expect(stripWorkshopReplyTrailersForRetention(`${FIXES}\n${REWRITES}`)).toBe('');
    // Nothing is left, so it is retained exactly as an empty reply is: no line of its own.
    expect(sanitizeWorkshopReplyForRetention(FIXES)).toBe(sanitizeWorkshopReplyForRetention(''));
  });

  it('beside another trailer, the host\'s line names only that trailer', () => {
    expect(sanitizeWorkshopReplyForRetention(`${FIXES}\n${memoryFrame()}`)).toBe(WORKSHOP_MEMORY_ONLY_REPLY_LINE);
    expect(sanitizeWorkshopReplyForRetention(`${fileEditFrame()}\n${FIXES}`)).toBe(WORKSHOP_FILE_EDIT_ONLY_REPLY_LINE);
    expect(extractWorkshopReplyControls(`${fileEditFrame()}\n${FIXES}`, OPEN).redacted)
      .toBe(`${WORKSHOP_FILE_EDIT_REDACTION}\n\n${WORKSHOP_EDIT_OFFER_REDACTION}`);
  });

  it('never shows while streaming: a frame being written, and a tag that could still become one, are held back', () => {
    const whole = `${SAID}\n\n${FIXES}`;
    for (let length = 0; length <= whole.length; length += 1) {
      const shown = stripWorkshopReplyTrailersForStreaming(whole.slice(0, length));
      expect(SAID.startsWith(shown.trimEnd())).toBe(true);
      expect(shown).not.toContain('<');
    }
    expect(stripWorkshopReplyTrailersForStreaming(whole)).toBe(SAID);
    expect(stripWorkshopReplyTrailersForStreaming(`${SAID}\n\n<prose-minion-edit-off`)).toBe(SAID);
    // Text that is no trailer tag still shows.
    expect(stripWorkshopReplyTrailersForStreaming('Alice wrote <prose> here')).toBe('Alice wrote <prose> here');
  });
});
