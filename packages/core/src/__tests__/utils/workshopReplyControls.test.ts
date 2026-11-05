import {
  extractWorkshopReplyControls,
  hasWorkshopMemoryProposalText,
  sanitizeWorkshopReplyForRetention,
  stripWorkshopMemoryProposalForStreaming,
  WORKSHOP_MEMORY_ONLY_REPLY_LINE,
  WORKSHOP_MEMORY_PROPOSAL_REDACTION
} from '@/utils/workshopReplyControls';
import * as proposalProtocol from '@/utils/workshopMemoryProposalProtocol';
import { decodeWorkshopMemoryProposal } from '@/utils/workshopMemoryProposalProtocol';
import { inspectWorkshopWidgetRecommendation } from '@/application/services/workshop/widgets/WorkshopWidgetRecommendationOperations';
import { WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY } from '@/application/services/workshop/widgets/WorkshopWidgetAvailabilityPolicy';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { memoryFrame, WIDGET } from '@/__tests__/application/services/workshop/memory/memoryProposalFixtures';

/**
 * The reply tail's one owner (ADR 2026-11-04 D6; PR #192 F-01): every row of
 * D6's outcome table, every decode rejection, and several frames judged one
 * by one (Slice 6b).
 */

const OPEN = { memoryOpen: true } as const;

/** One dropped frame, and no proposal. */
const dropped = (...rejections: string[]) => ({ kind: 'frames', proposals: [], rejections });

const PROSE = 'Good. It earns its place: the first sign that time here is wrong.';

function titles(controls: ReturnType<typeof extractWorkshopReplyControls>): string[] {
  return controls.memory.kind === 'frames' ? controls.memory.proposals.map((proposal) => proposal.title) : [];
}

function widgetOutcome(rest: string): string {
  return inspectWorkshopWidgetRecommendation(rest, WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY).outcome;
}

describe('extractWorkshopReplyControls', () => {
  it('leaves a reply without a frame exactly as it is', () => {
    const reply = `${PROSE}\n\n${WIDGET}`;
    expect(extractWorkshopReplyControls(reply, OPEN)).toEqual({ rest: reply, redacted: reply, memory: { kind: 'none' } });
    expect(hasWorkshopMemoryProposalText(reply)).toBe(false);
  });

  it('prose, widget, memory last, both valid: a proposal, and the widget stands', () => {
    const controls = extractWorkshopReplyControls(`${PROSE}\n\n${WIDGET}\n\n${memoryFrame({ supersedes: ['mem-1a9e04'] })}\n`, OPEN);
    expect(controls.memory).toEqual({
      kind: 'frames',
      proposals: [{
        title: 'The Rabbit\'s watch runs backward',
        kind: 'canon',
        summary: 'From chapter 3 on, the White Rabbit\'s watch runs backward.',
        body: 'We settled this while working the tea-party scene.',
        supersedes: ['mem-1a9e04']
      }],
      rejections: []
    });
    expect(controls.rest).toBe(`${PROSE}\n\n${WIDGET}`);
    expect(widgetOutcome(controls.rest)).toBe('accepted');
    expect(controls.redacted).toBe(`${PROSE}\n\n${WIDGET}\n\n${WORKSHOP_MEMORY_PROPOSAL_REDACTION}`);
  });

  it('memory before the widget: rejected misplaced, and the widget is judged without it', () => {
    const controls = extractWorkshopReplyControls(`${PROSE}\n\n${memoryFrame()}\n\n${WIDGET}`, OPEN);
    expect(controls.memory).toEqual(dropped('misplaced'));
    expect(controls.rest).toBe(`${PROSE}\n\n${WIDGET}`);
    expect(widgetOutcome(controls.rest)).toBe('accepted');
  });

  it('memory before prose is misplaced too', () => {
    const controls = extractWorkshopReplyControls(`${memoryFrame()}\n${PROSE}`, OPEN);
    expect(controls.memory).toEqual(dropped('misplaced'));
    expect(controls.rest).toBe(PROSE);
  });

  it('two frames: both proposals, in order, and both removed (Slice 6b)', () => {
    const controls = extractWorkshopReplyControls(`${PROSE}\n\n${memoryFrame()}\n${memoryFrame({ title: 'Another' })}`, OPEN);
    expect(controls.memory).toMatchObject({ kind: 'frames', rejections: [] });
    expect(titles(controls)).toEqual(['The Rabbit\'s watch runs backward', 'Another']);
    expect(controls.rest).toBe(PROSE);
    expect(controls.redacted.split(WORKSHOP_MEMORY_PROPOSAL_REDACTION)).toHaveLength(3);
  });

  it('a second frame with the same title is dropped as a duplicate, in any case', () => {
    const controls = extractWorkshopReplyControls(`${PROSE}\n\n${memoryFrame()}\n${memoryFrame({ title: 'THE RABBIT\'S WATCH RUNS BACKWARD' })}`, OPEN);
    expect(titles(controls)).toEqual(['The Rabbit\'s watch runs backward']);
    expect(controls.memory).toMatchObject({ rejections: ['duplicate'] });
  });

  it('an unclosed frame takes everything after it, a widget written after it included', () => {
    const controls = extractWorkshopReplyControls(`${PROSE}\n\n<prose-minion-memory-proposal>\n<title>Half</title>\n\n${WIDGET}`, OPEN);
    expect(controls.memory).toEqual(dropped('malformed:unclosed'));
    expect(controls.rest).toBe(PROSE);
    expect(widgetOutcome(controls.rest)).toBe('absent');
    expect(controls.redacted).toBe(`${PROSE}\n\n${WORKSHOP_MEMORY_PROPOSAL_REDACTION}`);
  });

  it('a stray closing tag is removed and rejected as unopened', () => {
    const controls = extractWorkshopReplyControls(`${PROSE}\n</prose-minion-memory-proposal>`, OPEN);
    expect(controls.memory).toEqual(dropped('malformed:unopened'));
    expect(controls.rest).toBe(PROSE);
  });

  it('memory off: every frame removed, each dropped memory-off, whatever it holds', () => {
    expect(extractWorkshopReplyControls(`${PROSE}\n\n${memoryFrame()}`, { memoryOpen: false }).memory).toEqual(dropped('memory-off'));
    const two = extractWorkshopReplyControls(`${memoryFrame()}\n${memoryFrame()}`, { memoryOpen: false });
    expect(two.memory).toEqual(dropped('memory-off', 'memory-off'));
    expect(two.rest).not.toContain('prose-minion-memory-proposal');
  });

  it('a control-only reply leaves no prose', () => {
    expect(extractWorkshopReplyControls(memoryFrame(), OPEN).rest).toBe('');
    expect(extractWorkshopReplyControls(`${WIDGET}\n${memoryFrame()}`, OPEN).rest).toBe(WIDGET);
  });

  it('removes a frame from the middle without leaving a gap, and keeps the next line\'s indentation', () => {
    const controls = extractWorkshopReplyControls(`First.\n\n${memoryFrame()}\n\n\n    indented code\nLast.`, OPEN);
    expect(controls.rest).toBe('First.\n\n    indented code\nLast.');
  });

  it('reads the tags in any case, but only exactly as the grammar writes them (PR #200 F-03 recheck)', () => {
    const upper = memoryFrame().replace('<prose-minion-memory-proposal>', '<PROSE-MINION-MEMORY-PROPOSAL>')
      .replace('</prose-minion-memory-proposal>', '</Prose-Minion-Memory-Proposal>');
    expect(titles(extractWorkshopReplyControls(`${PROSE}\n${upper}`, OPEN))).toHaveLength(1);
    const spaced = memoryFrame().replace('</prose-minion-memory-proposal>', '</prose-minion-memory-proposal >');
    const controls = extractWorkshopReplyControls(`${PROSE}\n${spaced}\nAfter.`, OPEN);
    expect(controls.memory).toEqual(dropped('malformed:tag'));
    expect(controls.rest).toBe(PROSE);
  });
});

describe('decodeWorkshopMemoryProposal: every rejection', () => {
  const inner = (frame: string): string =>
    frame.replace('<prose-minion-memory-proposal>', '').replace('</prose-minion-memory-proposal>', '');
  const budgets = PROMPT_BUDGETS.workshopProjectMemory;

  it.each([
    ['stray-text', memoryFrame({ extra: 'and also this' })],
    ['unknown-element', memoryFrame({ extra: '<note>x</note>' })],
    ['provenance', memoryFrame({ extra: '<proposed-by>cliff</proposed-by>' })],
    ['provenance', memoryFrame({ extra: '<source-session>abc</source-session>' })],
    ['provenance', memoryFrame({ extra: '<id>mem-000000</id>' })],
    ['provenance', memoryFrame({ extra: '<created>2026-11-04T00:00:00Z</created>' })],
    ['unclosed-element', memoryFrame({ extra: '<supersedes>mem-1a9e04' })],
    ['repeated-element', memoryFrame({ extra: '<title>Again</title>' })],
    ['missing-title', memoryFrame({ title: ' ' })],
    ['missing-kind', memoryFrame({ kind: '' })],
    ['missing-summary', memoryFrame({ summary: '' })],
    ['invalid-kind', memoryFrame({ kind: 'secret' })],
    ['title-not-one-line', memoryFrame({ title: 'Two\nlines' })],
    ['summary-not-one-line', memoryFrame({ summary: 'Two\nlines' })],
    ['title-too-long', memoryFrame({ title: 'x'.repeat(budgets.titleCharacters + 1) })],
    ['summary-too-long', memoryFrame({ summary: 'x'.repeat(budgets.summaryCharacters + 1) })],
    ['body-too-long', memoryFrame({ body: 'x'.repeat(budgets.bodyCharacters + 1) })],
    ['invalid-supersedes', memoryFrame({ supersedes: ['the old one'] })],
    ['invalid-supersedes', memoryFrame({ supersedes: ['MEM-1A9E04'] })],
    ['too-many-supersedes', memoryFrame({ supersedes: Array.from({ length: 9 }, (_, i) => `mem-00000${i}`) })]
  ])('%s', (fault, frame) => {
    expect(decodeWorkshopMemoryProposal(inner(frame))).toEqual({ kind: 'rejected', fault });
    expect(extractWorkshopReplyControls(frame, OPEN).memory).toEqual(dropped(`malformed:${fault}`));
  });

  it('accepts the bounds exactly, an empty body, and repeated supersedes once each', () => {
    const decoded = decodeWorkshopMemoryProposal(inner(memoryFrame({
      title: 'x'.repeat(budgets.titleCharacters),
      summary: 'y'.repeat(budgets.summaryCharacters),
      body: '',
      supersedes: ['mem-1a9e04', 'mem-1a9e04', 'mem-0e0e0e']
    })));
    expect(decoded).toMatchObject({ kind: 'proposal', proposal: { body: '', supersedes: ['mem-1a9e04', 'mem-0e0e0e'] } });
  });

  it('keeps a multi-line Markdown body', () => {
    const decoded = decodeWorkshopMemoryProposal(inner(memoryFrame({ body: '\n- one\n- two\n' })));
    expect(decoded).toMatchObject({ kind: 'proposal', proposal: { body: '- one\n- two' } });
  });
});

describe('sanitizeWorkshopReplyForRetention', () => {
  it('stores the reply without its trailer, so the persona never sees it again', () => {
    expect(sanitizeWorkshopReplyForRetention(`${PROSE}\n\n${memoryFrame()}`)).toBe(PROSE);
  });

  it('stores the host line, never an empty message, for a proposal-only reply', () => {
    expect(sanitizeWorkshopReplyForRetention(memoryFrame())).toBe(WORKSHOP_MEMORY_ONLY_REPLY_LINE);
  });

  it('then strips the widget control as before', () => {
    expect(sanitizeWorkshopReplyForRetention(`${PROSE}\n\n${WIDGET}\n\n${memoryFrame()}`)).toBe(PROSE);
    expect(sanitizeWorkshopReplyForRetention(`${WIDGET}\n${memoryFrame()}`)).toBe('[Widget setup delivered through the Workshop interface.]');
  });
});

describe('nested frames consume the whole outer region (PR #200 F-03)', () => {
  const O = '<prose-minion-memory-proposal>';
  const C = '</prose-minion-memory-proposal>';

  it.each([
    ['one level', `${PROSE}\n\n${O}<title>A</title>${O}SENTINEL-INNER${C}SENTINEL-OUTER${C}`],
    ['two levels', `${PROSE}\n\n${O}${O}${O}SENTINEL-INNER${C}SENTINEL-MID${C}SENTINEL-OUTER${C}`],
    ['nested, outer unclosed', `${PROSE}\n\n${O}SENTINEL-A${O}SENTINEL-B${C}SENTINEL-OUTER`],
    ['nested, nothing closed', `${PROSE}\n\n${O}SENTINEL-A${O}SENTINEL-B`]
  ])('%s', (_label, reply) => {
    for (const memoryOpen of [true, false]) {
      const controls = extractWorkshopReplyControls(reply, { memoryOpen });
      expect(controls.rest).toBe(PROSE);
      expect(controls.redacted).toBe(`${PROSE}\n\n[project memory proposal removed]`);
      expect(controls.memory).toMatchObject({ kind: 'frames', proposals: [] });
      expect(sanitizeWorkshopReplyForRetention(reply)).not.toContain('SENTINEL');
    }
  });

  it('names a closed nested frame as nested', () => {
    expect(extractWorkshopReplyControls(`${O}${memoryFrame({})}${C}`, OPEN).memory)
      .toEqual(dropped('malformed:nested'));
  });

  it('keeps prose after a closed nested frame, and still reads it as misplaced', () => {
    const reply = `${PROSE}\n\n${O}x${O}SENTINEL${C}SENTINEL${C}\n\nAfter.`;
    const controls = extractWorkshopReplyControls(reply, OPEN);
    expect(controls.rest).toBe(`${PROSE}\n\nAfter.`);
    expect(controls.redacted).not.toContain('SENTINEL');
  });
});

describe('a streaming reply never shows a memory frame (PR #200 F-02)', () => {
  const O = '<prose-minion-memory-proposal>';
  const C = '</prose-minion-memory-proposal>';
  const frame = memoryFrame({ title: 'SENTINEL title', summary: 'SENTINEL summary', body: 'SENTINEL body' });

  it.each([
    ['a whole frame', `${PROSE}\n\n${frame}`],
    ['a frame with attributes', `${PROSE}\n\n<prose-minion-memory-proposal data-x="SENTINEL">${frame}`],
    ['a nested frame', `${PROSE}\n\n${O}SENTINEL${O}SENTINEL${C}SENTINEL${C}`],
    ['a frame after the widget section', `${PROSE}\n\n${WIDGET}\n\n${frame}`]
  ])('at every prefix of %s', (_label, reply) => {
    for (let length = 0; length <= reply.length; length += 1) {
      const shown = stripWorkshopMemoryProposalForStreaming(reply.slice(0, length));
      expect(shown).not.toMatch(/SENTINEL|<prose-minion-mem|<\/prose-minion-mem/i);
      expect(reply.startsWith(shown.trimEnd()) || shown === '').toBe(true);
    }
    expect(stripWorkshopMemoryProposalForStreaming(reply)).toBe(extractWorkshopReplyControls(reply, OPEN).rest);
  });

  it('holds back a fragment that could still open a frame, and releases one that cannot', () => {
    expect(stripWorkshopMemoryProposalForStreaming(`${PROSE} <`)).toBe(PROSE);
    expect(stripWorkshopMemoryProposalForStreaming(`${PROSE} <prose-min`)).toBe(PROSE);
    expect(stripWorkshopMemoryProposalForStreaming(`${PROSE} </prose-minion-memory`)).toBe(PROSE);
    expect(stripWorkshopMemoryProposalForStreaming(`${PROSE} <em>`)).toBe(`${PROSE} <em>`);
    expect(stripWorkshopMemoryProposalForStreaming(`${PROSE} <prose-minion-memory-proposalx`)).toBe(`${PROSE} <prose-minion-memory-proposalx`);
  });
});

describe('a marker that is not exactly the grammar\'s tag hides everything after it (PR #200 F-03 recheck)', () => {
  const C = '</prose-minion-memory-proposal>';
  const witnesses: Array<[string, string]> = [
    ['a close marker inside a double-quoted attribute', `<prose-minion-memory-proposal data-x="${C}">PRIVATE_MEMORY_SENTINEL${C}`],
    ['a close marker inside a single-quoted attribute', `<prose-minion-memory-proposal data-x='${C}'>PRIVATE_MEMORY_SENTINEL${C}`],
    ['an unquoted close marker in the tag', `<prose-minion-memory-proposal ${C}>PRIVATE_MEMORY_SENTINEL${C}`],
    ['a nested open inside an attribute', `<prose-minion-memory-proposal data-x="<prose-minion-memory-proposal>">PRIVATE_MEMORY_SENTINEL${C}${C}`],
    ['an opening tag with no closing bracket', `<prose-minion-memory-proposal PRIVATE_MEMORY_SENTINEL${C}`],
    ['a malformed close inside a frame', `<prose-minion-memory-proposal><title>PRIVATE_MEMORY_SENTINEL</title></prose-minion-memory-proposal x>PRIVATE_MEMORY_SENTINEL`]
  ];

  it.each(witnesses)('%s', (_label, frame) => {
    const reply = `${PROSE}\n\n${frame}\n\nPRIVATE_MEMORY_SENTINEL trailing.`;
    for (const memoryOpen of [true, false]) {
      const controls = extractWorkshopReplyControls(reply, { memoryOpen });
      expect(controls.rest).toBe(PROSE);
      expect(controls.redacted).toBe(`${PROSE}\n\n${WORKSHOP_MEMORY_PROPOSAL_REDACTION}`);
      expect(controls.memory).toEqual(dropped(memoryOpen ? 'malformed:tag' : 'memory-off'));
      expect(sanitizeWorkshopReplyForRetention(reply)).toBe(PROSE);
    }
    for (let length = 0; length <= reply.length; length += 1) {
      expect(stripWorkshopMemoryProposalForStreaming(reply.slice(0, length))).not.toMatch(/PRIVATE_MEMORY|<\/?prose-minion-mem/i);
    }
  });

  it('leaves a longer tag name alone: it is not a marker', () => {
    const reply = `${PROSE} <prose-minion-memory-proposals> stays.`;
    expect(extractWorkshopReplyControls(reply, OPEN)).toEqual({ rest: reply, redacted: reply, memory: { kind: 'none' } });
  });
});

describe('several frames, each judged on its own (Slice 6b)', () => {
  const C = '</prose-minion-memory-proposal>';
  const frames = (count: number, from = 1) => Array.from({ length: count }, (_, i) => memoryFrame({ title: `Note ${from + i}` }));
  const CAP = PROMPT_BUDGETS.workshopProjectMemory.proposalsPerReply;

  it('keeps every well-formed frame at the tail, in order, up to the cap', () => {
    const controls = extractWorkshopReplyControls(`${PROSE}\n\n${frames(CAP).join('\n')}`, OPEN);
    expect(titles(controls)).toEqual(Array.from({ length: CAP }, (_, i) => `Note ${i + 1}`));
    expect(controls.memory).toMatchObject({ rejections: [] });
    expect(controls.rest).toBe(PROSE);
  });

  it('drops a frame past the cap whole, and counts it', () => {
    const controls = extractWorkshopReplyControls(`${PROSE}\n\n${frames(CAP + 2).join('\n')}`, OPEN);
    expect(titles(controls)).toHaveLength(CAP);
    expect(controls.memory).toMatchObject({ rejections: ['over-cap', 'over-cap'] });
    expect(controls.rest).toBe(PROSE);
    expect(controls.redacted.split(WORKSHOP_MEMORY_PROPOSAL_REDACTION)).toHaveLength(CAP + 3);
  });

  it('a malformed frame between good ones drops only itself, and does not use a place under the cap', () => {
    const bad = memoryFrame({ title: 'PRIVATE_MEMORY_SENTINEL', kind: 'secret' });
    const reply = `${PROSE}\n\n${frames(1).join('')}\n${bad}\n${frames(CAP, 2).join('\n')}`;
    const controls = extractWorkshopReplyControls(reply, OPEN);
    expect(titles(controls)).toEqual(Array.from({ length: CAP }, (_, i) => `Note ${i + 1}`));
    expect(controls.memory).toMatchObject({ rejections: ['malformed:invalid-kind', 'over-cap'] });
    expect(controls.rest).toBe(PROSE);
    expect(controls.redacted).not.toContain('PRIVATE_MEMORY_SENTINEL');
    expect(sanitizeWorkshopReplyForRetention(reply)).toBe(PROSE);
  });

  it('a frame before prose is misplaced; the frames at the tail still stand', () => {
    const controls = extractWorkshopReplyControls(`${frames(1)[0]}\n${PROSE}\n\n${frames(2, 2).join('\n')}`, OPEN);
    expect(titles(controls)).toEqual(['Note 2', 'Note 3']);
    expect(controls.memory).toMatchObject({ rejections: ['misplaced'] });
    expect(controls.rest).toBe(PROSE);
  });

  it('a nested frame after good ones drops only itself, and hides what it holds', () => {
    const O = '<prose-minion-memory-proposal>';
    const reply = `${PROSE}\n\n${frames(2).join('\n')}\n${O}${O}PRIVATE_MEMORY_SENTINEL${C}PRIVATE_MEMORY_SENTINEL${C}`;
    const controls = extractWorkshopReplyControls(reply, OPEN);
    expect(titles(controls)).toEqual(['Note 1', 'Note 2']);
    expect(controls.memory).toMatchObject({ rejections: ['malformed:nested'] });
    expect(`${controls.rest}${controls.redacted}${sanitizeWorkshopReplyForRetention(reply)}`).not.toContain('PRIVATE_MEMORY_SENTINEL');
  });

  it('an unclosed frame after good ones takes everything after it, and drops only itself', () => {
    const reply = `${PROSE}\n\n${frames(2).join('\n')}\n<prose-minion-memory-proposal><title>PRIVATE_MEMORY_SENTINEL`;
    const controls = extractWorkshopReplyControls(reply, OPEN);
    expect(titles(controls)).toEqual(['Note 1', 'Note 2']);
    expect(controls.memory).toMatchObject({ rejections: ['malformed:unclosed'] });
    expect(controls.rest).toBe(PROSE);
    expect(controls.redacted).toBe(`${PROSE}\n\n${Array(3).fill(WORKSHOP_MEMORY_PROPOSAL_REDACTION).join('\n\n')}`);
  });

  it('an unclosed frame before good ones takes them with it: nothing after it is read', () => {
    const reply = `${PROSE}\n\n<prose-minion-memory-proposal><title>Half</title>\n${frames(2).join('\n')}`;
    const controls = extractWorkshopReplyControls(reply, OPEN);
    expect(titles(controls)).toEqual([]);
    expect(controls.rest).toBe(PROSE);
  });

  it('never shows any of several frames while streaming, at any prefix', () => {
    const reply = `${PROSE}\n\n${memoryFrame({ title: 'SENTINEL one' })}\n${memoryFrame({ title: 'SENTINEL two', body: 'SENTINEL' })}`;
    for (let length = 0; length <= reply.length; length += 1) {
      expect(stripWorkshopMemoryProposalForStreaming(reply.slice(0, length))).not.toMatch(/SENTINEL|<\/?prose-minion-mem/i);
    }
  });

  it('keeps the text between removed frames apart, in rest and in the redacted copy', () => {
    const controls = extractWorkshopReplyControls(`First.\n\n${memoryFrame()}\n\nMiddle.\n\n${memoryFrame({ title: 'B' })}\n\nLast.`, OPEN);
    expect(controls.rest).toBe('First.\n\nMiddle.\n\nLast.');
    expect(controls.redacted).toBe(`First.\n\n${WORKSHOP_MEMORY_PROPOSAL_REDACTION}\n\nMiddle.\n\n${WORKSHOP_MEMORY_PROPOSAL_REDACTION}\n\nLast.`);
  });

  it('stores the host line for a reply that held only frames', () => {
    expect(sanitizeWorkshopReplyForRetention(frames(3).join('\n'))).toBe(WORKSHOP_MEMORY_ONLY_REPLY_LINE);
  });

  it('reads many frames by counting, not by a clock: each frame decoded once, the rest counted over the cap', () => {
    const many = Array.from({ length: 4_000 }, (_, i) => memoryFrame({ title: `Note ${i}` })).join('\n');
    const decode = jest.spyOn(proposalProtocol, 'decodeWorkshopMemoryProposal');
    const controls = extractWorkshopReplyControls(`${PROSE}\n\n${many}`, OPEN);
    expect(titles(controls)).toHaveLength(CAP);
    expect(controls.memory).toMatchObject({ rejections: Array<string>(4_000 - CAP).fill('over-cap') });
    expect(decode).toHaveBeenCalledTimes(4_000);
    decode.mockRestore();
  });
});
