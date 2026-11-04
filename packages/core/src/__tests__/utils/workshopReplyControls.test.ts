import {
  extractWorkshopReplyControls,
  hasWorkshopMemoryProposalText,
  sanitizeWorkshopReplyForRetention,
  WORKSHOP_MEMORY_ONLY_REPLY_LINE,
  WORKSHOP_MEMORY_PROPOSAL_REDACTION
} from '@/utils/workshopReplyControls';
import { decodeWorkshopMemoryProposal } from '@/utils/workshopMemoryProposalProtocol';
import { inspectWorkshopWidgetRecommendation } from '@/application/services/workshop/widgets/WorkshopWidgetRecommendationOperations';
import { WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY } from '@/application/services/workshop/widgets/WorkshopWidgetAvailabilityPolicy';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { memoryFrame, WIDGET } from '@/__tests__/application/services/workshop/memory/memoryProposalFixtures';

/**
 * The reply tail's one owner (ADR 2026-11-04 D6; PR #192 F-01): every row of
 * D6's outcome table, and every decode rejection.
 */

const OPEN = { memoryOpen: true } as const;

const PROSE = 'Good. It earns its place: the first sign that time here is wrong.';

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
      kind: 'proposal',
      proposal: {
        title: 'The Rabbit\'s watch runs backward',
        kind: 'canon',
        summary: 'From chapter 3 on, the White Rabbit\'s watch runs backward.',
        body: 'We settled this while working the tea-party scene.',
        supersedes: ['mem-1a9e04']
      }
    });
    expect(controls.rest).toBe(`${PROSE}\n\n${WIDGET}`);
    expect(widgetOutcome(controls.rest)).toBe('accepted');
    expect(controls.redacted).toBe(`${PROSE}\n\n${WIDGET}\n\n${WORKSHOP_MEMORY_PROPOSAL_REDACTION}`);
  });

  it('memory before the widget: rejected misplaced, and the widget is judged without it', () => {
    const controls = extractWorkshopReplyControls(`${PROSE}\n\n${memoryFrame()}\n\n${WIDGET}`, OPEN);
    expect(controls.memory).toEqual({ kind: 'rejected', reason: 'misplaced' });
    expect(controls.rest).toBe(`${PROSE}\n\n${WIDGET}`);
    expect(widgetOutcome(controls.rest)).toBe('accepted');
  });

  it('memory before prose is misplaced too', () => {
    const controls = extractWorkshopReplyControls(`${memoryFrame()}\n${PROSE}`, OPEN);
    expect(controls.memory).toEqual({ kind: 'rejected', reason: 'misplaced' });
    expect(controls.rest).toBe(PROSE);
  });

  it('two frames: every one removed, rejected duplicate', () => {
    const controls = extractWorkshopReplyControls(`${PROSE}\n\n${memoryFrame()}\n${memoryFrame({ title: 'Another' })}`, OPEN);
    expect(controls.memory).toEqual({ kind: 'rejected', reason: 'duplicate' });
    expect(controls.rest).toBe(PROSE);
    expect(controls.redacted.split(WORKSHOP_MEMORY_PROPOSAL_REDACTION)).toHaveLength(3);
  });

  it('an unclosed frame takes everything after it, a widget written after it included', () => {
    const controls = extractWorkshopReplyControls(`${PROSE}\n\n<prose-minion-memory-proposal>\n<title>Half</title>\n\n${WIDGET}`, OPEN);
    expect(controls.memory).toEqual({ kind: 'rejected', reason: 'malformed:unclosed' });
    expect(controls.rest).toBe(PROSE);
    expect(widgetOutcome(controls.rest)).toBe('absent');
    expect(controls.redacted).toBe(`${PROSE}\n\n${WORKSHOP_MEMORY_PROPOSAL_REDACTION}`);
  });

  it('a stray closing tag is removed and rejected as unopened', () => {
    const controls = extractWorkshopReplyControls(`${PROSE}\n</prose-minion-memory-proposal>`, OPEN);
    expect(controls.memory).toEqual({ kind: 'rejected', reason: 'malformed:unopened' });
    expect(controls.rest).toBe(PROSE);
  });

  it('memory off: removed, rejected memory-off, whatever the frame holds', () => {
    for (const reply of [`${PROSE}\n\n${memoryFrame()}`, `${memoryFrame()}\n${memoryFrame()}`]) {
      const controls = extractWorkshopReplyControls(reply, { memoryOpen: false });
      expect(controls.memory).toEqual({ kind: 'rejected', reason: 'memory-off' });
      expect(controls.rest).not.toContain('prose-minion-memory-proposal');
    }
  });

  it('a control-only reply leaves no prose', () => {
    expect(extractWorkshopReplyControls(memoryFrame(), OPEN).rest).toBe('');
    expect(extractWorkshopReplyControls(`${WIDGET}\n${memoryFrame()}`, OPEN).rest).toBe(WIDGET);
  });

  it('removes a frame from the middle without leaving a gap, and keeps the next line\'s indentation', () => {
    const controls = extractWorkshopReplyControls(`First.\n\n${memoryFrame()}\n\n\n    indented code\nLast.`, OPEN);
    expect(controls.rest).toBe('First.\n\n    indented code\nLast.');
  });

  it('reads the tags in any case, with whitespace before the closing bracket', () => {
    const frame = memoryFrame().replace('<prose-minion-memory-proposal>', '<PROSE-MINION-MEMORY-PROPOSAL >')
      .replace('</prose-minion-memory-proposal>', '</prose-minion-memory-proposal >');
    expect(extractWorkshopReplyControls(`${PROSE}\n${frame}`, OPEN).memory.kind).toBe('proposal');
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
    expect(extractWorkshopReplyControls(frame, OPEN).memory).toEqual({ kind: 'rejected', reason: `malformed:${fault}` });
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
