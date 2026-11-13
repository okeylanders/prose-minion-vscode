/**
 * Guard the press's persona-facing words (ADR 2026-11-10 D4, D5, D6; epic
 * Slice 2) against drift between the three places that hold them: the
 * directive frame the host builds, the persona prompt's teaching
 * (`workshop-personas/reply-edit-offers.md`), and the codec and policy that
 * read the answer.
 *
 * - the prompt teaches the frame's own tags, and the no-file-edit form
 *   exactly as the directive writes it and the answer reader takes it;
 * - the numbers it quotes for a press are the fixes policy's and the why's
 *   bound;
 * - the directive's two kinds are exactly the vocabulary's;
 * - the refusal words cover the closed list, and name no path.
 */
import * as fs from 'fs';
import * as path from 'path';
import { WORKSHOP_EDIT_OFFER_KINDS, WORKSHOP_EDIT_OFFER_REFUSALS } from '@messages';
import { FILE_EDIT_INTENT_POLICIES } from '@/domain/models/FileEdit';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { WORKSHOP_EDIT_OFFER_REFUSAL_WORDS } from '@shared/constants/workshopEditOfferWords';
import { WORKSHOP_FILE_EDIT_REASON_WORDS } from '@shared/constants/workshopFileEditWords';
import { readWorkshopEditOfferAnswer } from '@/utils/workshopEditOfferAnswer';
import {
  buildWorkshopEditRequestFrame,
  WORKSHOP_EDIT_REQUEST_CORRECTION,
  WORKSHOP_EDIT_REQUEST_KIND_WORDS,
  WORKSHOP_EDIT_REQUEST_SOURCE_TAG,
  WORKSHOP_EDIT_REQUEST_TAG,
  WORKSHOP_NO_FILE_EDIT_FORM
} from '@/utils/workshopEditRequestFrame';
import { WORKSHOP_FILE_EDIT_TAG } from '@/utils/workshopFileEditProtocol';
import { WORKSHOP_NO_FILE_EDIT_ELEMENTS, WORKSHOP_NO_FILE_EDIT_TAG } from '@/utils/workshopNoFileEditProtocol';
import { neutralizeReservedPersonaPromptDelimiters } from '@/utils/workshopPromptFrames';

const PROMPT = fs.readFileSync(path.resolve(__dirname,
  '../../../resources/system-prompts/workshop-personas/reply-edit-offers.md'), 'utf8');
const PRESS = PROMPT.slice(PROMPT.indexOf('### When the writer presses the button'));
const budgets = PROMPT_BUDGETS.workshopEditOffers;

describe('the press\'s teaching ↔ the directive frame', () => {
  it('has its own section, after the declaration\'s', () => {
    expect(PRESS.startsWith('### When the writer presses the button')).toBe(true);
    expect(PROMPT.indexOf('### The trailer')).toBeLessThan(PROMPT.indexOf(PRESS));
  });

  it('teaches the frame\'s tags as the host writes them', () => {
    for (const tag of [WORKSHOP_EDIT_REQUEST_TAG, WORKSHOP_EDIT_REQUEST_SOURCE_TAG, WORKSHOP_FILE_EDIT_TAG]) {
      expect(PRESS).toContain(`\`<${tag}>\``);
    }
    const frame = buildWorkshopEditRequestFrame({
      turn: { id: 'turn-1', content: 'Alice has two slips.' }, at: '2:02 pm',
      offer: { kind: 'fixes', target: { kind: 'excerpt', relativePath: 'chapters/one.md' } }
    });
    expect(frame.startsWith(`<${WORKSHOP_EDIT_REQUEST_TAG} kind="fixes">`)).toBe(true);
    expect(frame.endsWith(`</${WORKSHOP_EDIT_REQUEST_SOURCE_TAG}>\n</${WORKSHOP_EDIT_REQUEST_TAG}>`)).toBe(true);
  });

  it('teaches the no-file-edit form exactly as the directive and the correction write it, and the reader takes it', () => {
    const example = /```xml\n([\s\S]*?)```/.exec(PRESS)![1].trim();
    expect(example).toBe(WORKSHOP_NO_FILE_EDIT_FORM);
    expect(WORKSHOP_EDIT_REQUEST_CORRECTION).toContain(example);
    expect(readWorkshopEditOfferAnswer(example)).toMatchObject({ outcome: 'none', why: 'one line' });
    expect(WORKSHOP_NO_FILE_EDIT_FORM).toBe(`<${WORKSHOP_NO_FILE_EDIT_TAG}><${WORKSHOP_NO_FILE_EDIT_ELEMENTS[0]}>one line</${WORKSHOP_NO_FILE_EDIT_ELEMENTS[0]}></${WORKSHOP_NO_FILE_EDIT_TAG}>`);
  });

  it('quotes the fixes policy\'s numbers and the why\'s bound, and the policy is what it says', () => {
    expect(Number(/at most ([\d,]+) on each side/.exec(PRESS)![1])).toBe(budgets.fixChangedCharacters);
    expect(Number(/one line of at most ([\d,]+) characters/.exec(PRESS)![1])).toBe(budgets.whyCharacters);
    expect(FILE_EDIT_INTENT_POLICIES.fixes.narrows!.changedCharacters).toBe(budgets.fixChangedCharacters);
    expect(PRESS).toContain('never a line break');
    expect(FILE_EDIT_INTENT_POLICIES.fixes.narrows!.allowsNewlineChanges).toBe(false);
    expect(PRESS).toContain('No appends, no prepends, no rewrites.');
    expect([...FILE_EDIT_INTENT_POLICIES.fixes.narrows!.operations]).toEqual(['replace']);
    // The card's own words point the same way the prompt does.
    expect(PRESS).toContain('ask for it as a rewrite');
    expect(WORKSHOP_FILE_EDIT_REASON_WORDS['more-than-a-fix']).toContain('Ask for it as a rewrite.');
  });

  it('teaches what the answer may be: trailers and nothing else, one correction, and prose never shown', () => {
    expect(PRESS).toContain('and nothing else: no greeting, no commentary, no other trailer');
    expect(PRESS).toContain('The writer sees only the edit cards, never your prose.');
    expect(PRESS).toContain('is sent back to you once to correct');
    expect(PRESS).toContain('Work from that quote, not from memory.');
    expect(PRESS).toContain('Edit only the file the frame names');
  });

  it('words exactly the vocabulary\'s kinds, each with its own ask and rule', () => {
    expect(Object.keys(WORKSHOP_EDIT_REQUEST_KIND_WORDS)).toEqual([...WORKSHOP_EDIT_OFFER_KINDS]);
    for (const kind of WORKSHOP_EDIT_OFFER_KINDS) {
      expect(WORKSHOP_EDIT_REQUEST_KIND_WORDS[kind].ask).toContain(kind);
      expect(PRESS).toContain(`**${kind[0].toUpperCase()}${kind.slice(1)}**`);
    }
  });

  it('reserves every tag of the press, so quoted text cannot forge one', () => {
    for (const tag of [WORKSHOP_EDIT_REQUEST_TAG, WORKSHOP_EDIT_REQUEST_SOURCE_TAG, WORKSHOP_NO_FILE_EDIT_TAG, 'prose-minion-edit-offer']) {
      expect(neutralizeReservedPersonaPromptDelimiters(`<${tag}>x</${tag}>`)).toBe(`&lt;${tag}&gt;x&lt;/${tag}&gt;`);
    }
  });
});

describe('the press\'s refusal words', () => {
  it('cover the closed list, one line each, with no path or URI', () => {
    expect(Object.keys(WORKSHOP_EDIT_OFFER_REFUSAL_WORDS).sort()).toEqual([...WORKSHOP_EDIT_OFFER_REFUSALS].sort());
    for (const words of Object.values(WORKSHOP_EDIT_OFFER_REFUSAL_WORDS)) {
      expect(words).toMatch(/^[A-Z].*\.$/u);
      expect(words).not.toMatch(/file:|\/|\\|\.md\b|\n/);
    }
  });
});

describe('edit-offer prompt ↔ a press of one version (second addendum)', () => {
  it('teaches what the frame says: the version is named by its label, and that version alone is suggested', () => {
    const { WORKSHOP_EDIT_REQUEST_OPTION_ASK, workshopEditRequestOptionWords } = jest.requireActual('@/utils/workshopEditRequestFrame');
    const prompt = jest.requireActual('fs').readFileSync(
      jest.requireActual('path').resolve(__dirname, '../../../resources/system-prompts/workshop-personas/reply-edit-offers.md'), 'utf8');
    expect(prompt).toContain('When the writer chose one of your versions, the frame names it by the label you gave it: '
      + 'suggest that version only, and leave the others out.');
    expect(WORKSHOP_EDIT_REQUEST_OPTION_ASK).toBe('Suggest that version only, as file edits.');
    const words = workshopEditRequestOptionWords('Version 1');
    expect(words.pressed).toBe('The writer chose "Version 1" from your reply');
    expect(words.rule).toContain('That version only');
    expect(words.rule).toContain('Leave the other versions out');
  });
});

describe('edit-offer prompt ↔ a requested rewrite (second addendum)', () => {
  it('teaches that a pressed rewrite may replace the whole passage, never the file, and says nothing of any other edit', () => {
    const prompt: string = jest.requireActual('fs').readFileSync(
      jest.requireActual('path').resolve(__dirname, '../../../resources/system-prompts/workshop-personas/reply-edit-offers.md'), 'utf8');
    expect(prompt).toContain('Because the writer asked for it, a pair may replace the whole passage your reply reworded');
    expect(prompt).toContain('Keep it to that passage, never the whole file.');
    // The teaching never names the ceiling or a lifted limit: it is not an invitation for any other edit.
    expect(prompt).not.toMatch(/ceiling|lifted|limit is/i);
    const { WORKSHOP_EDIT_REQUEST_KIND_WORDS } = jest.requireActual('@/utils/workshopEditRequestFrame');
    expect(WORKSHOP_EDIT_REQUEST_KIND_WORDS.rewrites.rule).toContain('which it may replace whole');
    expect(WORKSHOP_EDIT_REQUEST_KIND_WORDS.rewrites.rule).toContain('Never the whole file');
    expect(WORKSHOP_EDIT_REQUEST_KIND_WORDS.fixes.rule).not.toContain('replace whole');
    expect(FILE_EDIT_INTENT_POLICIES.rewrites).toEqual({ liftsRewriteCeiling: true });
  });
});

