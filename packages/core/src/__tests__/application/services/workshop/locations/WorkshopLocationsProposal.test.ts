/**
 * A persona's context-paths proposal, from the reply to the card and the
 * line the persona reads next (ADR 2026-11-19 D27), through the production
 * extractor, the checker over the *Alice* project, completion, the session,
 * the outcome record and its frame; then the codec, the transcript and the
 * writer's Apply through the route owner.
 */

import {
  decodeWorkshopPersistedSessionCheckpoint,
  parseWorkshopPersistedSession
} from '@/application/services/workshop/WorkshopPersistedSession';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { completeWorkshopRun, workshopMessageCompletionCopy } from '@/application/services/workshop/WorkshopRunCompletion';
import { resolveWorkshopReplyLocations, type WorkshopReplyLocationsContext } from '@/application/services/workshop/locations/WorkshopReplyLocations';
import { workshopTrailerOutcomesFrameFor } from '@/application/services/workshop/trailerOutcomes/WorkshopTrailerOutcomesFrame';
import { projectWorkshopTranscript } from '@/application/services/workshop/transcript/WorkshopTranscript';
import { WorkshopLocationsProposalHandler } from '@handlers/domain/workshop/WorkshopLocationsProposalHandler';
import { decodeWorkshopLocationsProposal } from '@/utils/workshopReplyLocationsProposal';
import { extractWorkshopReplyControls, stripWorkshopReplyTrailersForRetention } from '@/utils/workshopReplyControls';
import { WORKSHOP_TRAILER_DROP_REASON_WORDS } from '@shared/constants/workshopTrailerOutcomeWords';
import { MessageType, type WorkshopLocationsProposalResultMessage, type WorkshopTurn } from '@messages';
import type { AnalysisResult } from '@/domain/models/AnalysisResult';
import { aliceChecker, EMPTY_SETTINGS } from '@/__tests__/application/services/contextPaths/aliceChecker';
import { WORKSHOP_LOCATIONS_CARD_LIMITS } from '@/application/services/workshop/locations/WorkshopLocationsProposalRecords';
import { ALICE_NAMES } from '@/__tests__/application/services/contextPaths/aliceProject';

const FIXTURE = JSON.stringify(require('../../../../fixtures/workshop-session-v2-before-locations-proposal.json'));
const HOST = { kind: 'host' } as const;

const frame = (groups: Record<string, string[]>): string =>
  `<prose-minion-locations-proposal>\n${Object.entries(groups)
    .map(([name, patterns]) => `  <group name="${name}">\n${patterns.map((pattern) => `    <pattern>${pattern}</pattern>`).join('\n')}\n  </group>`)
    .join('\n')}\n</prose-minion-locations-proposal>`;

let sent = 0;

/** The coordinator's serialized room operation, as a plain queue. */
function serialRoom() {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    runContextRefresh(operation: () => Promise<void>): Promise<void> {
      const run = tail.then(operation);
      tail = run.catch(() => undefined);
      return run;
    }
  };
}

function room() {
  let clock = 1_000;
  const session = new WorkshopSessionService(() => clock++);
  session.setExcerpt({ text: 'Alice was beginning to get very tired of sitting by her sister.', source: { kind: 'manual' } });
  return session;
}

async function replyWith(session: WorkshopSessionService, content: string, alice = aliceChecker(), log = jest.fn()) {
  const context = await resolveWorkshopReplyLocations(content, alice.checker, new AbortController().signal);
  sent += 1;
  const requestId = `loc-req-${sent}`;
  session.beginPersonaMessage(requestId, `Message ${sent}.`);
  const turn = completeWorkshopRun({
    session,
    requestId,
    label: 'Jill',
    result: { toolName: 'workshop-test', content, conversationId: 'host-conv', timestamp: new Date(0), replySource: 'provider' } as AnalysisResult,
    aborted: false,
    createsRetainedConversation: false,
    copy: workshopMessageCompletionCopy('Jill'),
    discardConversation: jest.fn(),
    readRetainedHistory: jest.fn(() => ({ messageCount: 2, contextSourceCount: 0 })),
    ...(context ? { locations: context } : {}),
    log,
    events: { streamCompleted: jest.fn(), turnCompleted: jest.fn(), status: jest.fn(), error: jest.fn(), widgetRecommendationRejected: jest.fn() }
  })!;
  return { turn, alice, log };
}

function conserved(turn: WorkshopTurn, frames: number): void {
  const side = turn.trailerOutcomes?.locations;
  expect(side).toBeDefined();
  expect(side!.cards + side!.dropped.reduce((sum, drop) => sum + drop.count, 0)).toBe(frames);
  expect(side!.cards).toBe(turn.locationsProposal ? 1 : 0);
}

describe('the trailer (D27)', () => {
  it('decodes groups and patterns, and refuses each malformed shape', () => {
    expect(decodeWorkshopLocationsProposal('<group name="characters"><pattern> Cast/**/* </pattern></group>'))
      .toEqual({ kind: 'proposal', proposal: { characters: ['Cast/**/*'] } });
    const faults: Array<[string, string]> = [
      ['', 'no-group'],
      ['<group name="people"><pattern>Cast/*</pattern></group>', 'unknown-group'],
      ['<group name="characters"><pattern>a</pattern></group><group name="characters"><pattern>b</pattern></group>', 'repeated-group'],
      ['<group name="characters"></group>', 'empty-group'],
      ['<group name="characters"><pattern> </pattern></group>', 'empty-pattern'],
      [`<group name="characters"><pattern>${'a'.repeat(201)}</pattern></group>`, 'pattern-too-long'],
      [`<group name="characters">${'<pattern>a</pattern>'.repeat(13)}</group>`, 'too-many-patterns'],
      ['stray <group name="characters"><pattern>a</pattern></group>', 'stray-text'],
      ['<group name="characters"><note>a</note></group>', 'unknown-element']
    ];
    for (const [inner, fault] of faults) {
      expect(decodeWorkshopLocationsProposal(inner)).toEqual({ kind: 'rejected', fault });
    }
  });

  it('keeps one a reply; a later frame is a duplicate', () => {
    const controls = extractWorkshopReplyControls(`Here.\n\n${frame({ characters: ['Cast/**/*'] })}\n${frame({ locations: ['Wonderland/**/*'] })}`, { memoryOpen: false });
    expect(controls.locations).toEqual({ proposal: { characters: ['Cast/**/*'] }, rejections: ['duplicate'] });
    expect(controls.redacted).toContain('[context paths proposal removed]');
    expect(controls.rest.trim()).toBe('Here.');
  });

  it('a reply of a proposal alone keeps the host line, in the ledger and in retention', async () => {
    const reply = frame({ characters: ['Cast/**/*'] });
    expect((await replyWith(room(), reply)).turn.content).toBe('Proposed context paths.');
    expect(stripWorkshopReplyTrailersForRetention(reply)).toBe('Proposed context paths.');
  });
});

describe('settlement and the outcome record (D27)', () => {
  it('a checked proposal commits a pending card with the reply, and the persona hears counts only', async () => {
    const session = room();
    const { turn, log } = await replyWith(session, `Try these.\n\n${frame({ characters: ['Cast/**/*', 'People/**/*'], locations: ['../Wonderland/**'] })}`);
    const card = turn.locationsProposal!;
    expect(card.state).toBe('pending');
    expect(card.kept).toEqual({ characters: ['Cast/**/*'] });
    expect(card.baselines.characters).toBe('characters/**/*');
    expect(card.view.groups.find((group) => group.group === 'characters')?.offer).toEqual({ offered: true });
    expect(turn.trailerOutcomes?.locations).toEqual({ cards: 1, dropped: [], patterns: { kept: 1, unmatched: 1, incomplete: 0, refused: 1 } });
    conserved(turn, 1);
    const line = workshopTrailerOutcomesFrameFor(session.readRoomLedger(), HOST)!;
    expect(line).toContain("Your last reply's context-paths proposal: shown as a card for the writer to review, with 1 pattern kept, 1 matching no file, 0 not checked completely and 1 refused.");
    const logged = log.mock.calls.map(([entry]) => entry).join('\n');
    for (const name of ALICE_NAMES) {
      expect(line).not.toContain(name);
      expect(logged).not.toContain(name);
    }
  });

  it('every pattern dropped is nothing-kept: no card', async () => {
    const session = room();
    const { turn } = await replyWith(session, frame({ characters: ['People/**/*', 'C:/Cast/**'] }));
    expect(turn.locationsProposal).toBeUndefined();
    expect(turn.trailerOutcomes?.locations?.dropped).toEqual([{ reason: 'nothing-kept', count: 1 }]);
    conserved(turn, 1);
    expect(workshopTrailerOutcomesFrameFor(session.readRoomLedger(), HOST))
      .toContain(`1 dropped (${WORKSHOP_TRAILER_DROP_REASON_WORDS['nothing-kept']})`);
  });

  it('an incomplete check is never zero matches: the card shows it, not offered', async () => {
    const alice = aliceChecker({ failingGlobs: ['Cast/**/*'] });
    const { turn } = await replyWith(room(), frame({ characters: ['Cast/**/*'] }), alice);
    expect(turn.locationsProposal?.view.groups.find((group) => group.group === 'characters')?.offer).toEqual({ offered: false, reason: 'incomplete' });
    expect(turn.trailerOutcomes?.locations?.patterns).toEqual({ kept: 0, unmatched: 0, incomplete: 1, refused: 0 });
  });

  it('no folder open, a malformed frame, a misplaced one, a context for another reply: each dropped and counted', async () => {
    const noFolder = await replyWith(room(), frame({ characters: ['Cast/**/*'] }), aliceChecker({ roots: {} }));
    expect(noFolder.turn.trailerOutcomes?.locations?.dropped).toEqual([{ reason: 'workspace-unavailable', count: 1 }]);
    const malformed = await replyWith(room(), '<prose-minion-locations-proposal><group name="people"><pattern>a</pattern></group></prose-minion-locations-proposal>');
    expect(malformed.turn.trailerOutcomes?.locations?.dropped).toEqual([{ reason: 'malformed', count: 1 }]);
    const misplaced = await replyWith(room(), `${frame({ characters: ['Cast/**/*'] })}\n\nAnd more prose after it.`);
    expect(misplaced.turn.trailerOutcomes?.locations?.dropped).toEqual([{ reason: 'misplaced', count: 1 }]);
    conserved(misplaced.turn, 1);

    const session = room();
    const other: WorkshopReplyLocationsContext = { reply: 'another reply', check: { kind: 'none' } };
    session.beginPersonaMessage('stale', 'Message.');
    const turn = completeWorkshopRun({
      session, requestId: 'stale', label: 'Jill',
      result: { toolName: 'workshop-test', content: frame({ characters: ['Cast/**/*'] }), conversationId: 'host-conv', timestamp: new Date(0), replySource: 'provider' } as AnalysisResult,
      aborted: false, createsRetainedConversation: false, copy: workshopMessageCompletionCopy('Jill'),
      discardConversation: jest.fn(), readRetainedHistory: jest.fn(() => ({ messageCount: 2, contextSourceCount: 0 })),
      locations: other, log: jest.fn(),
      events: { streamCompleted: jest.fn(), turnCompleted: jest.fn(), status: jest.fn(), error: jest.fn(), widgetRecommendationRejected: jest.fn() }
    })!;
    expect(turn.locationsProposal).toBeUndefined();
    expect(turn.trailerOutcomes?.locations?.dropped).toEqual([{ reason: 'workspace-unavailable', count: 1 }]);
  });
});

describe('the session codec (ADR 2026-07-30)', () => {
  it('reads the authentic session from before the change byte for byte', () => {
    expect(FIXTURE).not.toContain('locationsProposal');
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(FIXTURE)))).toBe(FIXTURE);
    expect(() => decodeWorkshopPersistedSessionCheckpoint(JSON.parse(FIXTURE))).not.toThrow();
  });

  it('round-trips a card, pending and answered, and refuses each malformed shape', async () => {
    const { turn } = await replyWith(room(), frame({ characters: ['Cast/**/*'] }));
    const base = JSON.parse(FIXTURE);
    const reply = base.workshop.turns.find((candidate: WorkshopTurn) => candidate.role === 'assistant' && candidate.participant === 'host');
    reply.locationsProposal = turn.locationsProposal;
    const pending = JSON.stringify(base);
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(pending)))).toBe(pending);
    reply.locationsProposal = { ...turn.locationsProposal, state: 'answered', answers: [{ group: 'characters', outcome: 'left', reason: 'changed' }] };
    const answered = JSON.stringify(base);
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(answered)))).toBe(answered);
    const broken: Array<(card: Record<string, unknown>) => void> = [
      (card) => { card.extra = 1; },
      (card) => { card.state = 'applied'; },
      (card) => { delete card.answers; },
      (card) => { (card.answers as Array<Record<string, unknown>>)[0].reason = 'because'; },
      (card) => { (card.baselines as Record<string, unknown>).characters = 7; },
      // PR #290 P1: what is drawn is what Apply writes.
      (card) => { (card.kept as Record<string, unknown>).characters = ['Wonderland/**/*']; },
      (card) => { (card.kept as Record<string, unknown>).themes = ['Cast/**/*']; },
      (card) => { (card.baselines as Record<string, unknown>).characters = 'Dramatis/**/*'; },
      (card) => {
        const groups = (card.view as { groups: unknown[] }).groups;
        groups[1] = groups[0];
      },
      (card) => { (card.answers as unknown[]).push({ group: 'characters', outcome: 'declined' }); },
      (card) => { card.answers = [{ group: 'themes', outcome: 'declined' }]; }
    ];
    for (const breakIt of broken) {
      const copy = JSON.parse(answered);
      breakIt(copy.workshop.turns.find((candidate: WorkshopTurn) => candidate.locationsProposal).locationsProposal);
      expect(() => parseWorkshopPersistedSession(copy)).toThrow();
    }
  });
});

describe('the transcript (D27)', () => {
  it('shows a card as its groups counted, never a pattern or a path', async () => {
    const session = room();
    await replyWith(session, `Try these.\n\n${frame({ characters: ['Cast/**/*'], locations: ['Wonderland/**/*'] })}`);
    const transcript = projectWorkshopTranscript(session.readRoomLedger(), { title: 'Alice', exportedAt: 0 } as never);
    const text = JSON.stringify(transcript);
    expect(text).toContain('Proposed context paths for 2 groups.');
    expect(text).not.toContain('Cast/');
    expect(text).not.toContain('Wonderland/');
  });
});

describe('the writer\'s Apply (D24, D27)', () => {
  async function handlerFor(groups: Record<string, string[]>, options: { alice?: ReturnType<typeof aliceChecker>; queue?: ReturnType<typeof serialRoom>; ledger?: (turns: readonly WorkshopTurn[]) => WorkshopTurn[] } = {}) {
    const session = room();
    const { turn, alice } = await replyWith(session, frame(groups), options.alice);
    const queue = options.queue ?? serialRoom();
    const posted: WorkshopLocationsProposalResultMessage[] = [];
    const effects = { postSessionState: jest.fn(), markDirty: jest.fn() };
    const lines: string[] = [];
    const seen = options.ledger;
    const handler = new WorkshopLocationsProposalHandler(
      seen
        ? {
          readRoomRevision: () => session.readRoomRevision(),
          readRoomLedger: () => seen(session.readRoomLedger()),
          answerLocationsProposal: (turnId, answers) => session.answerLocationsProposal(turnId, answers)
        }
        : session,
      { checker: alice.checker, settings: alice.settings },
      async (message) => { posted.push(message as WorkshopLocationsProposalResultMessage); },
      { appendLine: (line: string) => { lines.push(line); }, show: () => undefined, clear: () => undefined },
      effects,
      queue
    );
    const apply = (ticked: string[], revision = session.readRoomRevision()) => handler.handleApply({
      type: MessageType.WORKSHOP_APPLY_LOCATIONS_PROPOSAL,
      source: 'webview.workshop.locationsProposal',
      timestamp: 0,
      payload: { requestId: `r-${posted.length}`, roomRevision: revision, turnId: turn.id, groups: ticked as never }
    });
    return { session, turn, alice, posted, effects, apply, lines, queue };
  }

  it('a room replacement that starts during the recheck waits for the writes and the receipt (PR #290 P1)', async () => {
    const alice = aliceChecker();
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const recheck = alice.checker.recheck.bind(alice.checker);
    let rechecking!: () => void;
    const started = new Promise<void>((resolve) => { rechecking = resolve; });
    alice.checker.recheck = async (kept) => { rechecking(); await held; return recheck(kept); };
    const { session, turn, posted, apply, queue } = await handlerFor({ characters: ['Cast/**/*'] }, { alice });
    const applying = apply(['characters']);
    await started;
    // New, Open, Rewind and Branch replace the room through the same room operation.
    let seenAtReplacement: string | undefined;
    const replacing = queue.runContextRefresh(async () => {
      seenAtReplacement = session.readRoomLedger().find((candidate) => candidate.id === turn.id)?.locationsProposal?.state;
      session.reset();
    });
    release();
    await Promise.all([applying, replacing]);
    expect(alice.project.settings.writes).toEqual([['contextPaths.characters', 'Cast/**/*']]);
    // The receipt landed in the card's own room before that room was replaced.
    expect(seenAtReplacement).toBe('answered');
    expect(posted.at(-1)?.payload).toMatchObject({ outcome: 'done', groups: [{ group: 'characters', outcome: 'applied' }] });
  });

  it('an Apply that waits behind a room replacement writes nothing (PR #290 P1)', async () => {
    const queue = serialRoom();
    const { session, alice, posted, apply } = await handlerFor({ characters: ['Cast/**/*'] }, { queue });
    let finish!: () => void;
    const replacing = queue.runContextRefresh(() => new Promise<void>((resolve) => { finish = () => { session.reset(); resolve(); }; }));
    const applying = apply(['characters']);
    while (!finish) {
      await Promise.resolve();
    }
    finish();
    await Promise.all([replacing, applying]);
    expect(alice.project.settings.writes).toEqual([]);
    expect(posted.at(-1)?.payload.outcome).toBe('room-changed');
  });

  it('never applies a card whose parts disagree (PR #290 P1)', async () => {
    // A card that draws Cast/**/* and would write Wonderland/**/*.
    const ledger = (turns: readonly WorkshopTurn[]) => turns.map((candidate) => candidate.locationsProposal
      ? { ...candidate, locationsProposal: { ...candidate.locationsProposal, kept: { characters: ['Wonderland/**/*'] } } }
      : candidate);
    const { alice, posted, apply } = await handlerFor({ characters: ['Cast/**/*'] }, { ledger });
    await apply(['characters']);
    expect(alice.project.settings.writes).toEqual([]);
    expect(posted.at(-1)?.payload.outcome).toBe('unknown-card');
  });

  it('writes only the ticked groups at the user level; an offered group left unticked is declined', async () => {
    const { session, turn, alice, posted, apply, lines } = await handlerFor({ characters: ['Cast/**/*'], locations: ['Wonderland/**/*'] });
    await apply(['characters']);
    expect(alice.project.settings.writes).toEqual([['contextPaths.characters', 'Cast/**/*']]);
    expect(posted.at(-1)?.payload).toMatchObject({ outcome: 'done', groups: [
      { group: 'characters', outcome: 'applied' }, { group: 'locations', outcome: 'declined' }
    ] });
    const card = session.readRoomLedger().find((candidate) => candidate.id === turn.id)!.locationsProposal!;
    expect(card.state).toBe('answered');
    await apply(['locations']);
    expect(posted.at(-1)?.payload.outcome).toBe('answered');
    expect(alice.project.settings.writes).toHaveLength(1);
    for (const name of ALICE_NAMES) {
      expect(lines.join('\n')).not.toContain(name);
    }
  });

  it('Decline writes nothing; a group changed since is left with why; another room writes nothing', async () => {
    const declined = await handlerFor({ characters: ['Cast/**/*'] });
    await declined.apply([]);
    expect(declined.alice.project.settings.writes).toEqual([]);
    expect(declined.posted.at(-1)?.payload.groups).toEqual([{ group: 'characters', outcome: 'declined' }]);

    const changed = await handlerFor({ characters: ['Cast/**/*'] });
    changed.alice.project.settings.values['contextPaths.characters'] = 'Dramatis/**/*';
    await changed.apply(['characters']);
    expect(changed.alice.project.settings.writes).toEqual([]);
    expect(changed.posted.at(-1)?.payload.groups).toEqual([{ group: 'characters', outcome: 'left', reason: 'changed' }]);

    const stale = await handlerFor({ characters: ['Cast/**/*'] });
    await stale.apply(['characters'], stale.session.readRoomRevision() + 1);
    expect(stale.posted.at(-1)?.payload.outcome).toBe('room-changed');
    expect(stale.alice.project.settings.writes).toEqual([]);
  });

  it('a group the workspace sets is shown, not offered, and refused if sent', async () => {
    const session = room();
    const alice = aliceChecker({ levels: { 'contextPaths.characters': 'workspace' } });
    const { turn } = await replyWith(session, frame({ characters: ['Cast/**/*'] }), alice);
    expect(turn.locationsProposal?.view.groups.find((group) => group.group === 'characters')?.offer).toEqual({ offered: false, reason: 'workspace-set' });
    const posted: WorkshopLocationsProposalResultMessage[] = [];
    const handler = new WorkshopLocationsProposalHandler(session, { checker: alice.checker, settings: alice.settings },
      async (message) => { posted.push(message as WorkshopLocationsProposalResultMessage); },
      { appendLine: () => undefined, show: () => undefined, clear: () => undefined }, { postSessionState: jest.fn(), markDirty: jest.fn() },
      serialRoom());
    await handler.handleApply({ type: MessageType.WORKSHOP_APPLY_LOCATIONS_PROPOSAL, source: 'webview.workshop.locationsProposal', timestamp: 0,
      payload: { requestId: 'r', roomRevision: session.readRoomRevision(), turnId: turn.id, groups: ['characters'] } });
    expect(alice.project.settings.writes).toEqual([]);
    expect(posted[0].payload).toMatchObject({ outcome: 'done', groups: [] });
  });
});

describe('the card\'s bounds, producer and reader alike (PR #290 P2)', () => {
  const restores = (turn: WorkshopTurn): void => {
    const base = JSON.parse(FIXTURE);
    const reply = base.workshop.turns.find((candidate: WorkshopTurn) => candidate.role === 'assistant' && candidate.participant === 'host');
    reply.trailerOutcomes = turn.trailerOutcomes;
    if (turn.locationsProposal) {
      reply.locationsProposal = turn.locationsProposal;
    }
    const text = JSON.stringify(base);
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(text)))).toBe(text);
  };

  it('an over-long file path is clipped on the card, and the room restores', async () => {
    const deep = `Cast/${'Looking-Glass/'.repeat(80)}Alice.md`;
    const alice = aliceChecker({ roots: { '/alice': [deep] } });
    const { turn } = await replyWith(room(), frame({ characters: ['Cast/**/*'] }), alice);
    const examples = turn.locationsProposal!.view.groups.find((group) => group.group === 'characters')!.proposed!.examples;
    expect(deep.length).toBeGreaterThan(WORKSHOP_LOCATIONS_CARD_LIMITS.pathCharacters);
    expect(examples[0]).toHaveLength(WORKSHOP_LOCATIONS_CARD_LIMITS.pathCharacters);
    // The patterns Apply writes are untouched by the display bound.
    expect(turn.locationsProposal!.kept).toEqual({ characters: ['Cast/**/*'] });
    restores(turn);
  });

  it('an over-long setting value makes no card, counted as too-large, and the room restores', async () => {
    const long = Array.from({ length: 2_000 }, (_, index) => `Shelf-${index}/*`).join(',');
    expect(long.length).toBeGreaterThan(WORKSHOP_LOCATIONS_CARD_LIMITS.valueCharacters);
    const alice = aliceChecker({ settings: { ...EMPTY_SETTINGS, 'contextPaths.general': long } });
    const session = room();
    const { turn } = await replyWith(session, frame({ characters: ['Cast/**/*'] }), alice);
    expect(turn.locationsProposal).toBeUndefined();
    expect(turn.trailerOutcomes?.locations?.dropped).toEqual([{ reason: 'too-large', count: 1 }]);
    expect(workshopTrailerOutcomesFrameFor(session.readRoomLedger(), HOST))
      .toContain(`1 dropped (${WORKSHOP_TRAILER_DROP_REASON_WORDS['too-large']})`);
    restores(turn);
  });
});
