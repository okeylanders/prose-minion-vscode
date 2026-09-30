import {
  WorkshopRewindPolicy,
  WorkshopRewindTurnFacts,
  workshopBubbleCut
} from '@/application/services/workshop/session/WorkshopRewindPolicy';
import type {
  WorkshopConversationLogicalKey
} from '@/application/services/workshop/WorkshopSessionStateV1';

const divider = (id: string, artifact: WorkshopRewindTurnFacts['artifact']): WorkshopRewindTurnFacts =>
  ({ id, role: 'system', participant: 'session', artifact, capability: false });
const writer = (id: string, artifact: WorkshopRewindTurnFacts['artifact'] = 'persona_message'): WorkshopRewindTurnFacts =>
  ({ id, role: 'user', participant: 'writer', artifact, capability: false });
const reply = (
  id: string,
  participant: WorkshopRewindTurnFacts['participant'],
  artifact: WorkshopRewindTurnFacts['artifact']
): WorkshopRewindTurnFacts => ({ id, role: 'assistant', participant, artifact, capability: false });
const capability = (id: string): WorkshopRewindTurnFacts =>
  ({ id, role: 'assistant', participant: 'tool', artifact: 'tool_report', capability: true });

/**
 * One room, annotated. `*` marks a proven rest point after the turn.
 */
const BASE_ROOM: WorkshopRewindTurnFacts[] = [
  divider('start', 'session_start'),                // * fresh room
  writer('w1'),                                      //   host run opens
  capability('cap1'),                                //   evidence mid-run
  reply('r1', 'host', 'persona_message'),            // * host reply
  divider('ctx1', 'context_change'),                 // * edited at rest
  writer('tool-request', 'tool_request'),            //   tool run opens
  reply('report', 'tool', 'tool_report'),            // * report commit
  divider('ctx2', 'context_change'),                 //   during synthesis
  reply('synthesis', 'host', 'persona_synthesis'),   // * run ends
  writer('w2', 'direct_tool_message'),               //   direct follow-up
  reply('d1', 'tool', 'direct_tool_response'),       // * reply
  writer('invite'),                                  //   guest join opens
  reply('join', 'guest', 'persona_message'),         // * join reply
  writer('w3'),                                      //   abandoned run
  divider('ctx3', 'context_change'),                 //   ? unproven tail
  divider('resume', 'session_resume'),               // * right before w4
  writer('w4'),                                      //   host run opens
  reply('r4', 'host', 'persona_message')             // * idle head
];

/** The same room with a standing-directive change right after the join reply. */
const DIRECTIVE_ROOM: WorkshopRewindTurnFacts[] = [
  ...BASE_ROOM.slice(0, BASE_ROOM.findIndex((turn) => turn.id === 'join') + 1),
  divider('directive', 'standing_directive_change'), // * directive shifts
  ...BASE_ROOM.slice(BASE_ROOM.findIndex((turn) => turn.id === 'join') + 1)
];

const policy = (options: {
  turns?: WorkshopRewindTurnFacts[];
  marks?: Array<{ turnId: string; conversationKey: WorkshopConversationLogicalKey }>;
  busy?: boolean;
} = {}) => new WorkshopRewindPolicy({
  turns: options.turns ?? BASE_ROOM,
  marks: options.marks ?? [
    { turnId: 'r1', conversationKey: 'host' },
    { turnId: 'report', conversationKey: 'tool:prose' },
    { turnId: 'synthesis', conversationKey: 'host' },
    { turnId: 'r4', conversationKey: 'host' }
  ],
  busy: options.busy ?? false
});

describe('WorkshopRewindPolicy — cut layer', () => {
  it.each([
    ['the start marker of a fresh room', 'start'],
    ['a divider edited at rest', 'ctx1'],
    ['a host reply', 'r1'],
    ['a writer-requested tool report', 'report'],
    ['a synthesis', 'synthesis'],
    ['a direct tool reply', 'd1'],
    ['a guest join reply', 'join'],
    ['the last turn before a run start, even after an abandoned run', 'resume'],
    ['the idle ledger head', 'r4']
  ])('accepts afterTurn at %s', (_label, turnId) => {
    expect(policy().evaluateCut({ kind: 'afterTurn', turnId }))
      .toEqual(expect.objectContaining({ ok: true, keptThroughTurnId: turnId }));
  });

  it.each([
    ['an open writer turn', 'w1'],
    ['capability evidence', 'cap1'],
    ['a tool request', 'tool-request'],
    ['a divider recorded during synthesis', 'ctx2'],
    ['an abandoned writer turn', 'w3'],
    ['an unproven divider in an abandoned tail', 'ctx3']
  ])('refuses afterTurn mid-run at %s', (_label, turnId) => {
    expect(policy().evaluateCut({ kind: 'afterTurn', turnId }))
      .toEqual({ ok: false, reason: 'not-a-rest-point' });
  });

  it('normalizes beforeTurn to afterTurn of the preceding rest point', () => {
    expect(policy().evaluateCut({ kind: 'beforeTurn', turnId: 'w1' }))
      .toEqual({ ok: true, keptThroughTurnId: 'start' });
    expect(policy().evaluateCut({ kind: 'beforeTurn', turnId: 'w4' }))
      .toEqual({ ok: true, keptThroughTurnId: 'resume' });
  });

  it('refuses a cut that keeps nothing, or names an unknown turn', () => {
    expect(policy().evaluateCut({ kind: 'beforeTurn', turnId: 'start' }))
      .toEqual({ ok: false, reason: 'not-a-rest-point' });
    expect(policy().evaluateCut({ kind: 'afterTurn', turnId: 'nope' }))
      .toEqual({ ok: false, reason: 'not-a-rest-point' });
  });

  it('refuses every cut while a run is active or a session operation is pending', () => {
    const busy = policy({ busy: true });
    for (const turnId of ['start', 'r1', 'r4']) {
      expect(busy.evaluateCut({ kind: 'afterTurn', turnId })).toEqual({ ok: false, reason: 'busy' });
    }
  });

  it('does not treat a busy head as a rest point once the run clears', () => {
    const inFlight = [...BASE_ROOM, writer('w5')];
    expect(policy({ turns: inFlight }).evaluateCut({ kind: 'afterTurn', turnId: 'w5' }))
      .toEqual(expect.objectContaining({ ok: true }));
    expect(policy({ turns: inFlight, busy: true }).evaluateCut({ kind: 'afterTurn', turnId: 'w5' }))
      .toEqual({ ok: false, reason: 'busy' });
  });

  describe('host exactness', () => {
    // A legacy room reopened at `join`: only the baseline and later commits are marked.
    const legacy = policy({
      marks: [
        { turnId: 'join', conversationKey: 'host' },
        { turnId: 'r4', conversationKey: 'host' }
      ]
    });

    it.each(['r1', 'report', 'synthesis', 'd1'])(
      'refuses a pre-baseline host point (%s)',
      (turnId) => {
        expect(legacy.evaluateCut({ kind: 'afterTurn', turnId }))
          .toEqual({ ok: false, reason: 'before-rewind-support' });
      }
    );

    it('accepts the baseline itself and everything after it', () => {
      expect(legacy.evaluateCut({ kind: 'afterTurn', turnId: 'join' }))
        .toEqual(expect.objectContaining({ ok: true }));
      expect(legacy.evaluateCut({ kind: 'afterTurn', turnId: 'r4' }))
        .toEqual(expect.objectContaining({ ok: true }));
    });

    it('accepts points before the host ever replied: the cut removes the host', () => {
      expect(legacy.evaluateCut({ kind: 'afterTurn', turnId: 'start' }))
        .toEqual(expect.objectContaining({ ok: true }));
    });
  });

  it('never lets a guest or sidecar without marks block a cut', () => {
    // Neither the guest nor the sidecar has a mark: at any cut they are dropped.
    const hostOnly = policy({
      marks: [
        { turnId: 'r1', conversationKey: 'host' },
        { turnId: 'synthesis', conversationKey: 'host' },
        { turnId: 'r4', conversationKey: 'host' }
      ]
    });
    expect(hostOnly.evaluateCut({ kind: 'afterTurn', turnId: 'join' }))
      .toEqual(expect.objectContaining({ ok: true }));
    expect(hostOnly.evaluateCut({ kind: 'afterTurn', turnId: 'd1' }))
      .toEqual(expect.objectContaining({ ok: true }));
  });

  it('holds the v1 directive floor: no cut may cross the latest directive change', () => {
    const directive = policy({ turns: DIRECTIVE_ROOM });
    expect(directive.evaluateCut({ kind: 'afterTurn', turnId: 'join' }))
      .toEqual({ ok: false, reason: 'before-directive-change' });
    expect(directive.evaluateCut({ kind: 'afterTurn', turnId: 'directive' }))
      .toEqual(expect.objectContaining({ ok: true }));
    expect(directive.evaluateCut({ kind: 'beforeTurn', turnId: 'w3' }))
      .toEqual({ ok: true, keptThroughTurnId: 'directive' });
  });
});

describe('WorkshopRewindPolicy — bubble layer', () => {
  it.each([
    ['a host reply', reply('x', 'host', 'persona_message'), 'afterTurn'],
    ['a guest reply', reply('x', 'guest', 'persona_message'), 'afterTurn'],
    ['a synthesis', reply('x', 'host', 'persona_synthesis'), 'afterTurn'],
    ['a tool report', reply('x', 'tool', 'tool_report'), 'afterTurn'],
    ['a direct tool reply', reply('x', 'tool', 'direct_tool_response'), 'afterTurn'],
    ['a writer message', writer('x'), 'beforeTurn'],
    ['a direct tool message', writer('x', 'direct_tool_message'), 'beforeTurn']
  ])('maps %s to its ADR §1 cut', (_label, turn, kind) => {
    expect(workshopBubbleCut(turn)).toEqual({ kind, turnId: 'x' });
  });

  it.each([
    ['a capability card', capability('x')],
    ['a tool request', writer('x', 'tool_request')],
    ['a context divider', divider('x', 'context_change')],
    ['a session marker', divider('x', 'session_resume')],
    ['a directive marker', divider('x', 'standing_directive_change')]
  ])('offers no action on %s', (_label, turn) => {
    expect(workshopBubbleCut(turn)).toBeUndefined();
  });

  it('publishes eligible verdicts only, with the disabled reason', () => {
    // A legacy room reopened at `join`, with a directive change after it.
    const verdicts = policy({
      turns: DIRECTIVE_ROOM,
      marks: [
        { turnId: 'join', conversationKey: 'host' },
        { turnId: 'r4', conversationKey: 'host' }
      ]
    }).bubbleRewindability(DIRECTIVE_ROOM.map((turn) => turn.id));

    expect(verdicts).toEqual({
      w1: { available: false, reason: 'before-directive-change' },
      r1: { available: false, reason: 'before-rewind-support' },
      report: { available: false, reason: 'before-rewind-support' },
      synthesis: { available: false, reason: 'before-rewind-support' },
      w2: { available: false, reason: 'before-rewind-support' },
      d1: { available: false, reason: 'before-rewind-support' },
      invite: { available: false, reason: 'before-rewind-support' },
      join: { available: false, reason: 'before-directive-change' },
      w3: { available: true },
      w4: { available: true },
      r4: { available: true }
    });
  });
});
