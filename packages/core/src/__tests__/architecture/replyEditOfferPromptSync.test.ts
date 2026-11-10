/**
 * Guard the edit-offer prompt (ADR 2026-11-10 D1; epic Slice 1) against
 * drift from the code it teaches:
 *
 * - every number it quotes is pinned to PROMPT_BUDGETS.workshopEditOffers,
 *   and it quotes no other number;
 * - the kinds it teaches are exactly `WORKSHOP_EDIT_OFFER_KINDS`, and the
 *   elements exactly the codec's;
 * - its worked example decodes, through the production extractor and codec,
 *   to the offers it shows, placed last as the prose says;
 * - it teaches the rules a persona must keep: declare only what the prose
 *   holds, never as an invitation, never beside a file-edit trailer;
 * - it is taught to host and guest only while file edits are on, right
 *   after the file-edit teaching.
 * Made-up text: Alice.
 */
import * as fs from 'fs';
import * as path from 'path';
import { WORKSHOP_EDIT_OFFER_KINDS } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { CONTEXT_PATH_GROUPS } from '@shared/types/context';
import { extractWorkshopReplyControls } from '@/utils/workshopReplyControls';
import { WORKSHOP_EDIT_OFFER_ELEMENTS, WORKSHOP_EDIT_OFFER_TAG } from '@/utils/workshopEditOfferProtocol';
import {
  getWorkshopPersona,
  WORKSHOP_FILE_EDIT_PROPOSALS_PROMPT_PATH,
  WORKSHOP_GUEST_BASE_PROMPT_PATH,
  WORKSHOP_HOST_BASE_PROMPT_PATH,
  WORKSHOP_REPLY_EDIT_OFFERS_PROMPT_PATH,
  workshopPersonaSystemPromptPaths
} from '@shared/constants/workshopPersonas';

const PROMPT = fs.readFileSync(path.resolve(__dirname,
  '../../../resources/system-prompts/workshop-personas/reply-edit-offers.md'), 'utf8');
const budgets = PROMPT_BUDGETS.workshopEditOffers;
const number = (quoted: string): number => Number(quoted.replace(/,/g, ''));
const prose = PROMPT.replace(/```[\s\S]*?```/g, '');

describe('edit-offer prompt ↔ PROMPT_BUDGETS', () => {
  const pinned: ReadonlyArray<readonly [RegExp, number[]]> = [
    [/One reply declares at most ([\d,]+) offers/, [budgets.offersPerReply]],
    [/a whole number from ([\d,]+) to ([\d,]+)/, [1, budgets.count]],
    [/An offer longer than ([\d,]+) characters is dropped/, [budgets.frameCharacters]],
    [/a reply longer than ([\d,]+) characters keeps no offers/, [budgets.sourceReplyCharacters]]
  ];

  it.each(pinned)('quotes %s from its bound', (pattern, expected) => {
    const match = pattern.exec(prose);
    expect(match).not.toBeNull();
    expect(match!.slice(1).map(number)).toEqual(expected);
  });

  it('quotes no number it does not pin', () => {
    const unpinned = [...pinned.map(([pattern]) => pattern), /`[^`\n]*`/]
      .reduce((text, pattern) => text.replace(new RegExp(pattern.source, 'g'), ''), prose);
    expect(unpinned.match(/\d[\d,.]*/g)).toBeNull();
  });

  it('allows one offer per kind, which is the per-reply bound', () => {
    expect(budgets.offersPerReply).toBe(WORKSHOP_EDIT_OFFER_KINDS.length);
  });
});

describe('edit-offer prompt ↔ the vocabulary and the codec', () => {
  it('teaches exactly the kinds the vocabulary holds', () => {
    const section = /### The two kinds\n\n([\s\S]*?)\n\n/.exec(PROMPT)![1];
    expect([...section.matchAll(/^- `([a-z]+)`:/gm)].map((match) => match[1])).toEqual([...WORKSHOP_EDIT_OFFER_KINDS]);
    expect(prose).toContain(`\`<kind>\`: required, ${WORKSHOP_EDIT_OFFER_KINDS.map((kind) => `\`${kind}\``).join(' or ')}.`);
  });

  it('teaches every element the codec reads, and no other', () => {
    const taught = new Set([...PROMPT.matchAll(/`<([a-z-]+)\/?>`/g)].map((match) => match[1]));
    expect([...taught].sort()).toEqual([...WORKSHOP_EDIT_OFFER_ELEMENTS].sort());
    expect(PROMPT).toContain(`<${WORKSHOP_EDIT_OFFER_TAG}>`);
  });

  it('teaches the rules a persona must keep', () => {
    expect(prose).toContain('Declare only what the reply\'s prose really holds');
    expect(prose).toContain('Never declare an offer as an invitation');
    expect(prose).toContain('Never put an offer and a file-edit trailer in the same reply.');
    expect(prose).toContain('A reply with no prose has nothing to offer.');
    expect(prose).toContain('Name it as a file-edit trailer names it: `<group>` and `<path>`');
    expect(prose).toContain('or `<excerpt/>` alone');
    expect(prose).toContain('nothing changes in any file');
  });
});

describe('the worked example, through the production extractor and codec', () => {
  const examples = [...PROMPT.matchAll(/```xml\n([\s\S]*?)```/g)].map((match) => match[1].trim());
  const said = 'Three slips in the excerpt: "begining", "its\' own", and a doubled "the". '
    + 'And the Rabbit\'s two lines in the chapter would land harder cut short.';

  it('shows one example of two offers', () => {
    expect(examples).toHaveLength(1);
  });

  it('decodes to the two offers it shows, in order, and leaves the prose', () => {
    const controls = extractWorkshopReplyControls(`${said}\n\n${examples[0]}\n`, { memoryOpen: false, fileEditsOpen: true });
    expect(controls.rest).toBe(said);
    expect(controls.editOffers).toEqual({
      kind: 'frames',
      offers: [
        { kind: 'fixes', target: { kind: 'excerpt' }, count: 3 },
        { kind: 'rewrites', target: { kind: 'resource', group: 'chapters', path: 'chapters/down-the-rabbit-hole.md' }, count: 2 }
      ],
      rejections: []
    });
    expect(CONTEXT_PATH_GROUPS as readonly string[]).toContain('chapters');
  });

  it('is refused anywhere but last, as the prose says', () => {
    expect(extractWorkshopReplyControls(`${examples[0]}\n\n${said}`, { memoryOpen: false, fileEditsOpen: true }).editOffers)
      .toEqual({ kind: 'frames', offers: [], rejections: ['misplaced', 'misplaced'] });
  });
});

describe('when the edit-offer prompt is taught (D1)', () => {
  const jill = getWorkshopPersona('jill')!;
  const behavior = { interactionMode: 'conversational', expressionLevel: 'subtle', relationalDepth: 'reserved' } as const;

  it('host and guest, only while file edits are on, right after the file-edit teaching', () => {
    expect(WORKSHOP_REPLY_EDIT_OFFERS_PROMPT_PATH).toBe('workshop-personas/reply-edit-offers.md');
    for (const base of [WORKSHOP_HOST_BASE_PROMPT_PATH, WORKSHOP_GUEST_BASE_PROMPT_PATH]) {
      const on = workshopPersonaSystemPromptPaths(base, jill, behavior, { fileEdits: true });
      expect(on.indexOf(WORKSHOP_REPLY_EDIT_OFFERS_PROMPT_PATH)).toBe(on.indexOf(WORKSHOP_FILE_EDIT_PROPOSALS_PROMPT_PATH) + 1);
      expect(workshopPersonaSystemPromptPaths(base, jill, behavior, { projectMemory: true })).not.toContain(WORKSHOP_REPLY_EDIT_OFFERS_PROMPT_PATH);
      expect(workshopPersonaSystemPromptPaths(base, jill, behavior)).not.toContain(WORKSHOP_REPLY_EDIT_OFFERS_PROMPT_PATH);
    }
  });

  it('never to a base that is not a participant\'s', () => {
    expect(workshopPersonaSystemPromptPaths('workshop-personas/other.md', jill, behavior, { fileEdits: true }))
      .not.toContain(WORKSHOP_REPLY_EDIT_OFFERS_PROMPT_PATH);
  });
});
