/**
 * File-edit cards in the session (ADR 2026-11-05 D8, D10; epic Slice 3): an
 * optional, additive turn field with no `schemaVersion` change.
 *
 * - A persona reply's staged frames become cards; the bubble shows only its
 *   prose, and no log line carries a quote, a replacement, a passage, a why,
 *   a path or a URI.
 * - Cards round-trip through save and reopen, byte for byte, in every state,
 *   with outcomes and landed records; the codec refuses every malformed shape.
 * - `applying` round-trips in the file, and reads as `unknown` when the
 *   session is reopened (the read rule in hydration, not a normalization).
 * - The transcript projection (and export through it) shows each card's
 *   display path, why and state, never an operation's text or the URI;
 *   recall and the turn preview show no card at all.
 * Made-up text: Alice.
 */

import {
  decodeWorkshopPersistedSessionCheckpoint,
  parseWorkshopPersistedSession
} from '@/application/services/workshop/WorkshopPersistedSession';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { projectWorkshopTranscript, projectWorkshopTranscriptTurn } from '@/application/services/workshop/transcript/WorkshopTranscript';
import { renderWorkshopTranscriptMarkdown } from '@/application/services/workshop/export/WorkshopTranscriptMarkdown';
import { renderWorkshopTranscriptJson } from '@/application/services/workshop/export/WorkshopTranscriptJson';
import { renderWorkshopTranscriptHtml } from '@/application/services/workshop/export/WorkshopTranscriptHtml';
import { buildWorkshopRecallDocument } from '@/application/services/workshop/recall/WorkshopRecallDocument';
import { workshopTurnPreview } from '@/application/services/workshop/transcript/WorkshopTurnPreview';
import { resolveWorkshopReplyFileEdits } from '@/application/services/workshop/fileEdits/WorkshopReplyFileEditProposals';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  WORKSHOP_FILE_EDIT_REOPENED_APPLYING_REASON,
  type WorkshopFileEditProposal
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { WORKSHOP_FILE_EDIT_ONLY_REPLY_LINE } from '@/utils/workshopReplyControls';
import {
  fakeFileEditStaging,
  fileEditFrame,
  PASSAGE_SENTINEL,
  QUOTE_SENTINEL,
  sentinelFileEditFrame,
  URI_SENTINEL,
  WHY_SENTINEL,
  WITH_SENTINEL
} from '@/__tests__/application/services/workshop/fileEdits/fileEditFixtures';
import { ScriptedWorkshopRoom } from './ScriptedWorkshopRoom';
import { scriptedCheckpoint } from './WorkshopCoordinatorHarness';

const TEXT_SENTINELS = [QUOTE_SENTINEL, WITH_SENTINEL, PASSAGE_SENTINEL];
const SECRET_PATH = 'characters/zzq-secret-path.md';
const B = PROMPT_BUDGETS.workshopFileEdits;

async function reply(room: ScriptedWorkshopRoom, text: string, content: string, open = true) {
  room.fileEdits = await resolveWorkshopReplyFileEdits({
    reply: content,
    open,
    staging: fakeFileEditStaging({ refuse: (target) => target.kind === 'resource' && target.path.endsWith('refused.md') ? 'not-configured' : undefined })
  });
  return room.hostMessage(text, { reply: content });
}

async function roomWithCards() {
  const room = new ScriptedWorkshopRoom().start();
  room.hostMessage('Where is the cup?');
  const carded = await reply(room, 'Alice is ten now, right?',
    `Yes.\n\n${sentinelFileEditFrame(SECRET_PATH)}\n${fileEditFrame({ excerpt: true })}\n${fileEditFrame({ path: 'characters/refused.md' })}`);
  return { room, carded };
}

type Turns = Array<Record<string, unknown>>;
const checkpointWith = async (mutate: (turns: Turns) => void) => {
  const checkpoint = scriptedCheckpoint('edits', (await roomWithCards()).room) as unknown as { workshop: { turns: Turns } };
  mutate(checkpoint.workshop.turns);
  return JSON.stringify(checkpoint);
};
const card = (turns: Turns) => turns.find((turn) => turn.fileEditProposals)!;
const cards = (turns: Turns) => card(turns).fileEditProposals as Array<Record<string, unknown>>;
const first = (turns: Turns) => cards(turns)[0];

const LANDED = [
  { operation: 0, before: `Alice ${QUOTE_SENTINEL}`, after: `Alice ${WITH_SENTINEL}`, contextBefore: 'It was ', contextAfter: ' at tea.', versionAfter: 7 },
  { operation: 1, beforeSha256: 'b'.repeat(64), afterSha256: 'c'.repeat(64) }
];

describe('file-edit cards on a reply', () => {
  it('each staged frame becomes a card in the order written; the bubble shows only the prose', async () => {
    const { carded, room } = await roomWithCards();
    expect(carded.content).toBe('Yes.');
    expect(carded.fileEditProposals?.map((proposal) => [proposal.state, proposal.target?.kind ?? null, proposal.class ?? null])).toEqual([
      ['pending', 'file', 'notes'],
      ['pending', 'excerpt', 'prose'],
      ['refused', null, null]
    ]);
    expect(carded.fileEditProposals?.[2]).toMatchObject({ requested: { kind: 'resource', path: 'characters/refused.md' }, reason: 'not-configured' });
    expect(carded.content).not.toContain('prose-minion-file-edit');
    const logs = room.log.join('\n');
    for (const sentinel of [...TEXT_SENTINELS, WHY_SENTINEL, URI_SENTINEL, 'zzq-secret-path']) {
      expect(logs).not.toContain(sentinel);
    }
  });

  it('a reply that was only a frame shows the host\'s line and no model', async () => {
    const room = new ScriptedWorkshopRoom().start();
    const turn = await reply(room, 'Fix her age.', fileEditFrame());
    expect(turn.content).toBe(WORKSHOP_FILE_EDIT_ONLY_REPLY_LINE);
    expect(turn.model).toBeUndefined();
    expect(turn.fileEditProposals).toHaveLength(1);
  });

  it('with the setting off, no card: the frame is stripped, dropped and counted', async () => {
    const room = new ScriptedWorkshopRoom().start();
    const turn = await reply(room, 'Fix her age.', `Yes.\n\n${fileEditFrame()}`, false);
    expect(turn.content).toBe('Yes.');
    expect(turn.fileEditProposals).toBeUndefined();
    expect(room.log.filter((line) => line.includes('File edit proposal dropped (reason=file-edits-off)'))).toHaveLength(1);
  });

  it('a reply nothing staged still has its frames stripped, and counted as not staged', () => {
    const room = new ScriptedWorkshopRoom().start();
    const turn = room.hostMessage('Fix her age.', { reply: `Yes.\n\n${fileEditFrame()}` });
    expect(turn.content).toBe('Yes.');
    expect(turn.fileEditProposals).toBeUndefined();
    expect(room.log.some((line) => line.includes('File edit proposal dropped (reason=not-staged)'))).toBe(true);
  });
});

describe('file-edit cards in the saved session', () => {
  it('round-trip through save and reopen, byte for byte, and hydrate as they were', async () => {
    const { room, carded } = await roomWithCards();
    const text = JSON.stringify(scriptedCheckpoint('edits', room));
    expect(text).toContain(URI_SENTINEL);
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(text)))).toBe(text);
    const reopened = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text));
    expect(JSON.stringify(reopened.session)).toBe(text);
    expect(reopened.normalizations).toEqual([]);
    const session = new WorkshopSessionService(() => 9_000);
    session.hydrateCommittedState(reopened.session.workshop, { host: 'host-conversation' }, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR);
    expect(session.readRoomLedger().find((turn) => turn.id === carded.id)?.fileEditProposals).toEqual(carded.fileEditProposals);
  });

  it.each<[string, Record<string, unknown>]>([
    ['declined', { state: 'declined' }],
    ['stale', { state: 'stale', reason: 'quote-not-found' }],
    ['refused by policy', { state: 'refused', reason: 'rewrite-ceiling' }],
    ['applied, with what landed', { state: 'applied', outcomes: ['landed', 'landed'], landed: LANDED }],
    ['partial', { state: 'partial', reason: 'some-unticked', outcomes: ['landed', 'not-applied'], landed: [LANDED[0]] }],
    ['unknown, nothing known to have landed', { state: 'unknown', outcomes: ['unknown', 'unknown'] }],
    ['unknown, before any outcome', { state: 'unknown', reason: 'preview-closed' }],
    ['applying', { state: 'applying' }]
  ])('a %s card round-trips', async (_name, fields) => {
    const text = await checkpointWith((turns) => { Object.assign(first(turns), fields); });
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(text)))).toBe(text);
    expect(JSON.stringify(decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text)).session)).toBe(text);
  });

  it('a card found applying reads as unknown when the session is reopened, every outcome unknown', async () => {
    const text = await checkpointWith((turns) => { first(turns).state = 'applying'; });
    const reopened = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text));
    // The file keeps what was written; no normalization repairs it.
    expect(reopened.normalizations).toEqual([]);
    expect(JSON.stringify(reopened.session)).toContain('"applying"');
    const session = new WorkshopSessionService(() => 9_000);
    session.hydrateCommittedState(reopened.session.workshop, { host: 'host-conversation' }, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR);
    const proposals = session.readRoomLedger().find((turn) => turn.fileEditProposals)!.fileEditProposals!;
    expect(proposals[0]).toMatchObject({ state: 'unknown', reason: WORKSHOP_FILE_EDIT_REOPENED_APPLYING_REASON, outcomes: ['unknown', 'unknown'] });
    expect(proposals[1].state).toBe('pending');
    // What it saves next holds the settled state, never `applying`.
    expect(JSON.stringify(session.exportCommittedState())).not.toContain('"applying"');
  });

  describe('refused when malformed', () => {
    const writer = (turns: Turns) => turns.find((turn) => turn.participant === 'writer')!;
    const ops = (turns: Turns) => first(turns).operations as Array<Record<string, unknown>>;
    const target = (turns: Turns) => first(turns).target as Record<string, unknown>;
    it.each<[string, (turns: Turns) => void, RegExp]>([
      ['cards on a writer turn', (turns) => { writer(turns).fileEditProposals = cards(turns); }, /fileEditProposals must be a host or guest persona reply/],
      ['an empty list', (turns) => { card(turns).fileEditProposals = []; }, /fileEditProposals must be an array of 1–5/],
      ['two cards requesting one file', (turns) => { cards(turns)[2].requested = { kind: 'resource', group: 'characters', path: SECRET_PATH.replace('zzq', 'ZZQ') }; }, /\[2\]\.requested must be a file no earlier card names/],
      ['an unknown field', (turns) => { first(turns).origin = 'persona'; }, /unknown field origin/],
      ['an unknown state', (turns) => { first(turns).state = 'saved'; }, /\.state must be pending/],
      ['an auto mode smuggled in as a state', (turns) => { first(turns).state = 'auto'; }, /\.state must be pending/],
      ['a requested group unknown', (turns) => { first(turns).requested = { kind: 'resource', group: 'secrets', path: 'a.md' }; }, /requested must be a configured resource/],
      ['a requested path that traverses', (turns) => { first(turns).requested = { kind: 'resource', group: 'characters', path: '../a.md' }; }, /requested must be a configured resource/],
      ['a target without its baseline', (turns) => { delete first(turns).baseline; }, /must be target, class and baseline together/],
      ['no target on a pending card', (turns) => { delete first(turns).target; delete first(turns).class; delete first(turns).baseline; }, /target must be present, or the card refused at staging/],
      ['a refused card with no target and no reason', (turns) => { delete cards(turns)[2].reason; }, /\[2\]\.target must be present, or the card refused at staging with its reason/],
      ['a file identity for an excerpt request', (turns) => { (cards(turns)[1].target as Record<string, unknown>).kind = 'file'; }, /\[1\]\.target\.kind must be excerpt/],
      ['a target with no documentUri', (turns) => { delete target(turns).documentUri; }, /missing field documentUri|documentUri/],
      ['an absolute display path', (turns) => { target(turns).relativePath = '/etc/a.md'; }, /relativePath must be a workspace-relative path/],
      ['an unknown class', (turns) => { first(turns).class = 'poetry'; }, /\.class must be prose \| notes/],
      ['a baseline that is no hash', (turns) => { (first(turns).baseline as Record<string, unknown>).sha256 = 'abc'; }, /baseline\.sha256 must be a SHA-256/],
      ['no operations', (turns) => { first(turns).operations = []; }, /operations must be an array of 1–10/],
      ['an unknown operation', (turns) => { ops(turns)[0] = { op: 'delete', find: 'a' }; }, /\.op must be rewrite \| replace \| append \| prepend/],
      ['a rewrite beside others', (turns) => { ops(turns).push({ op: 'rewrite', text: 'All new.' }); }, /conflicting-operations/],
      ['an append past its bound', (turns) => { ops(turns)[1].text = 'a'.repeat(B.insertCharacters + 1); }, /text must be a string of at most/],
      ['a why on two lines', (turns) => { first(turns).why = 'Alice\nis ten.'; }, /why must be one trimmed line/],
      ['a pending card with a reason', (turns) => { first(turns).reason = 'Because.'; }, /reason must be absent on a pending, applying, applied or declined card/],
      ['an applied card with no outcomes', (turns) => { first(turns).state = 'applied'; }, /outcomes must be one outcome per operation/],
      ['a pending card with outcomes', (turns) => { first(turns).outcomes = ['landed', 'landed']; }, /outcomes must be absent on a card that has not settled/],
      ['outcomes that do not match the operations', (turns) => { Object.assign(first(turns), { state: 'unknown', outcomes: ['unknown'] }); }, /outcomes must be an array containing exactly 2/],
      ['an applied card with an operation not landed', (turns) => { Object.assign(first(turns), { state: 'applied', outcomes: ['landed', 'not-applied'], landed: [LANDED[0]] }); }, /every operation landed on an applied card/],
      ['a partial card where everything landed', (turns) => { Object.assign(first(turns), { state: 'partial', outcomes: ['landed', 'landed'], landed: LANDED }); }, /some operations, not all, landed/],
      ['landed operations with no records', (turns) => { Object.assign(first(turns), { state: 'applied', outcomes: ['landed', 'landed'] }); }, /landed must be one record per landed operation/],
      ['a record for an operation that did not land', (turns) => { Object.assign(first(turns), { state: 'partial', outcomes: ['landed', 'not-applied'], landed: [LANDED[1]] }); }, /operation must be a landed operation no other record names/],
      ['a record\'s before past revertCharacters', (turns) => {
        Object.assign(first(turns), { state: 'applied', outcomes: ['landed', 'landed'], landed: [{ ...LANDED[0], before: 'a'.repeat(B.revertCharacters + 1) }, LANDED[1]] });
      }, /before must be a string of at most/],
      ['a record\'s context past its bound', (turns) => {
        Object.assign(first(turns), { state: 'applied', outcomes: ['landed', 'landed'], landed: [{ ...LANDED[0], contextAfter: 'a'.repeat(B.landedContextCharacters + 1) }, LANDED[1]] });
      }, /contextAfter must be a string of at most/],
      ['a hashed record that is not a hash', (turns) => {
        Object.assign(first(turns), { state: 'applied', outcomes: ['landed', 'landed'], landed: [LANDED[0], { ...LANDED[1], afterSha256: 'nope' }] });
      }, /afterSha256 must be a SHA-256/]
    ])('%s', async (_name, mutate, message) => {
      const text = await checkpointWith(mutate);
      expect(() => parseWorkshopPersistedSession(JSON.parse(text))).toThrow(message);
      expect(() => decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text))).toThrow(message);
    });
  });
});

describe('file-edit cards in the transcript (one projection)', () => {
  const ledger = async () => {
    const { room, carded } = await roomWithCards();
    const turns = room.session.readRoomLedger().map((turn) => turn.id === carded.id
      ? {
        ...turn,
        fileEditProposals: [
          { ...turn.fileEditProposals![0], state: 'applied', outcomes: ['landed', 'landed'], landed: LANDED } as WorkshopFileEditProposal,
          ...turn.fileEditProposals!.slice(1)
        ]
      }
      : turn);
    return { room, carded, turns };
  };

  it('a reply carries each card\'s display path, why and state, never an operation\'s text or the URI', async () => {
    const { carded, turns } = await ledger();
    const transcript = projectWorkshopTranscript(turns, { title: 'Edits', exportedAt: 0 });
    const entry = transcript.entries.find((line) => line.kind === 'reply' && line.turnId === carded.id);
    expect(entry).toMatchObject({
      kind: 'reply',
      content: 'Yes.',
      fileEdits: [
        { path: SECRET_PATH, why: `Why ${WHY_SENTINEL}`, state: 'applied' },
        { path: 'chapters/chapter-1.md', why: 'Alice is ten now.', state: 'pending' },
        { path: 'characters/refused.md', why: 'Alice is ten now.', state: 'refused' }
      ]
    });
    const json = JSON.stringify(transcript);
    for (const sentinel of [...TEXT_SENTINELS, URI_SENTINEL]) {
      expect(json).not.toContain(sentinel);
    }
  });

  it.each([
    ['Markdown', renderWorkshopTranscriptMarkdown],
    ['JSON', renderWorkshopTranscriptJson],
    ['HTML', renderWorkshopTranscriptHtml]
  ] as const)('%s export shows the display path, state and why, never the text or the URI', async (_format, render) => {
    const out = render(projectWorkshopTranscript((await ledger()).turns, { title: 'Edits', exportedAt: 0 }));
    expect(out).toContain(WHY_SENTINEL);
    expect(out).toContain('zzq-secret-path.md');
    expect(out).toContain('applied');
    expect(out).toContain('refused');
    for (const sentinel of [...TEXT_SENTINELS, URI_SENTINEL]) {
      expect(out).not.toContain(sentinel);
    }
    expect(out).not.toContain('prose-minion-file-edit');
  });

  it('recall and the turn preview see no card at all', async () => {
    const { room, carded } = await roomWithCards();
    expect(projectWorkshopTranscriptTurn(carded)).not.toHaveProperty('fileEdits');
    expect(JSON.stringify(workshopTurnPreview(carded))).not.toContain(WHY_SENTINEL);
    const document = JSON.stringify(buildWorkshopRecallDocument(scriptedCheckpoint('edits', room)));
    for (const sentinel of [...TEXT_SENTINELS, WHY_SENTINEL, URI_SENTINEL]) {
      expect(document).not.toContain(sentinel);
    }
  });
});

