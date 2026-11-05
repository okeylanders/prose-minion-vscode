/**
 * File-edit cards in the session (ADR 2026-11-05 D8; epic Slice 3): an
 * optional, additive turn field with no `schemaVersion` change.
 *
 * - A persona reply's frames become pending cards; the bubble shows only its
 *   prose, and no log line carries a quote, a replacement, a passage, a why
 *   or a path.
 * - With the setting off, no card: the frame is stripped, dropped and counted.
 * - Cards round-trip through save and reopen, byte for byte, applied with
 *   what landed included; the codec refuses every malformed shape.
 * - The transcript projection (and export through it) shows each card's
 *   file, why and state, never an operation's text; recall and the turn
 *   preview, which read turns through `projectWorkshopTranscriptTurn`, show
 *   no card at all.
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
import { DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR, type WorkshopFileEditProposal } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { WORKSHOP_FILE_EDIT_ONLY_REPLY_LINE } from '@/utils/workshopReplyControls';
import {
  fileEditFrame,
  PASSAGE_SENTINEL,
  QUOTE_SENTINEL,
  sentinelFileEditFrame,
  WHY_SENTINEL,
  WITH_SENTINEL
} from '@/__tests__/application/services/workshop/fileEdits/fileEditFixtures';
import { ScriptedWorkshopRoom } from './ScriptedWorkshopRoom';
import { scriptedCheckpoint } from './WorkshopCoordinatorHarness';

const TEXT_SENTINELS = [QUOTE_SENTINEL, WITH_SENTINEL, PASSAGE_SENTINEL];
const SECRET_PATH = 'characters/zzq-secret-path.md';

function roomWithCards(open = true) {
  const room = new ScriptedWorkshopRoom().start();
  room.fileEditsOpen = open;
  room.hostMessage('Where is the cup?');
  const carded = room.hostMessage('Alice is ten now, right?', {
    reply: `Yes.\n\n${sentinelFileEditFrame(SECRET_PATH)}\n${fileEditFrame({ excerpt: true })}`
  });
  return { room, carded };
}

type Turns = Array<Record<string, unknown>>;
const checkpointWith = (mutate: (turns: Turns) => void) => {
  const checkpoint = scriptedCheckpoint('edits', roomWithCards().room) as unknown as { workshop: { turns: Turns } };
  mutate(checkpoint.workshop.turns);
  return JSON.stringify(checkpoint);
};
const card = (turns: Turns) => turns.find((turn) => turn.fileEditProposals)!;
const cards = (turns: Turns) => card(turns).fileEditProposals as Array<Record<string, unknown>>;

const APPLIED: Partial<WorkshopFileEditProposal> = {
  state: 'applied',
  landed: {
    target: { kind: 'resource', group: 'characters', path: SECRET_PATH },
    version: 7,
    ranges: [{ operations: [0], text: `Alice ${WITH_SENTINEL}` }, { operations: [1], text: `\n\nMore ${PASSAGE_SENTINEL}` }]
  },
  reason: 'Applied 2 of 2 changes.'
};

describe('file-edit cards on a reply', () => {
  it('each frame becomes a pending card in the order written; the bubble shows only the prose', () => {
    const { carded, room } = roomWithCards();
    expect(carded.content).toBe('Yes.');
    expect(carded.fileEditProposals).toEqual([{
      target: { kind: 'resource', group: 'characters', path: SECRET_PATH },
      operations: [
        { op: 'replace', find: `Alice ${QUOTE_SENTINEL}`, with: `Alice ${WITH_SENTINEL}` },
        { op: 'append', text: `More ${PASSAGE_SENTINEL}` }
      ],
      why: `Why ${WHY_SENTINEL}`,
      state: 'pending'
    }, {
      target: { kind: 'excerpt' },
      operations: [{ op: 'replace', find: 'Alice is seven', with: 'Alice is ten' }],
      why: 'Alice is ten now.',
      state: 'pending'
    }]);
    expect(carded.content).not.toContain('prose-minion-file-edit');
    const logs = room.log.join('\n');
    expect(logs).toContain('File edit proposal pending (target=characters; operations=replace,append)');
    expect(logs).toContain('File edit proposal pending (target=excerpt; operations=replace)');
    for (const sentinel of [...TEXT_SENTINELS, WHY_SENTINEL, 'zzq-secret-path']) {
      expect(logs).not.toContain(sentinel);
    }
  });

  it('a reply that was only a frame shows the host\'s line and no model', () => {
    const room = new ScriptedWorkshopRoom().start();
    room.fileEditsOpen = true;
    const turn = room.hostMessage('Fix her age.', { reply: fileEditFrame() });
    expect(turn.content).toBe(WORKSHOP_FILE_EDIT_ONLY_REPLY_LINE);
    expect(turn.model).toBeUndefined();
    expect(turn.fileEditProposals).toHaveLength(1);
  });

  it('with the setting off, no card: the frame is stripped, dropped and counted', () => {
    const { carded, room } = roomWithCards(false);
    expect(carded.content).toBe('Yes.');
    expect(carded.fileEditProposals).toBeUndefined();
    expect(room.log.filter((line) => line.includes('File edit proposal dropped (reason=file-edits-off)'))).toHaveLength(2);
  });

  it('past the cap, the extras are dropped and counted, never the reply', () => {
    const room = new ScriptedWorkshopRoom().start();
    room.fileEditsOpen = true;
    const cap = PROMPT_BUDGETS.workshopFileEdits.proposalsPerReply;
    const frames = Array.from({ length: cap + 1 }, (_, index) => fileEditFrame({ path: `characters/p${index}.md` })).join('\n');
    const turn = room.hostMessage('All of them.', { reply: `Here.\n\n${frames}` });
    expect(turn.content).toBe('Here.');
    expect(turn.fileEditProposals).toHaveLength(cap);
    expect(room.log.filter((line) => line.includes('File edit proposal dropped (reason=over-cap)'))).toHaveLength(1);
  });
});

describe('file-edit cards in the saved session', () => {
  it('round-trip through save and reopen, byte for byte, and hydrate as they were', () => {
    const { room, carded } = roomWithCards();
    const text = JSON.stringify(scriptedCheckpoint('edits', room));
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(text)))).toBe(text);
    const reopened = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text));
    expect(JSON.stringify(reopened.session)).toBe(text);
    expect(reopened.normalizations).toEqual([]);
    const session = new WorkshopSessionService(() => 9_000);
    session.hydrateCommittedState(reopened.session.workshop, { host: 'host-conversation' }, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR);
    expect(session.readRoomLedger().find((turn) => turn.id === carded.id)?.fileEditProposals).toEqual(carded.fileEditProposals);
  });

  it.each(['declined', 'stale', 'refused'] as const)('a %s card round-trips', (state) => {
    const text = checkpointWith((turns) => {
      cards(turns)[0].state = state;
      if (state !== 'declined') {
        cards(turns)[0].reason = 'The file changed since this was suggested.';
      }
    });
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(text)))).toBe(text);
  });

  it('an applied card round-trips with what landed', () => {
    const text = checkpointWith((turns) => { Object.assign(cards(turns)[0], APPLIED); });
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(text)))).toBe(text);
    expect(JSON.stringify(decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text)).session)).toBe(text);
  });

  describe('refused when malformed', () => {
    const first = (turns: Turns) => cards(turns)[0];
    const writer = (turns: Turns) => turns.find((turn) => turn.participant === 'writer')!;
    const ops = (turns: Turns) => first(turns).operations as Array<Record<string, unknown>>;
    it.each<[string, (turns: Turns) => void, RegExp]>([
      ['cards on a writer turn', (turns) => { writer(turns).fileEditProposals = cards(turns); }, /fileEditProposals must be a host or guest persona reply/],
      ['an empty list', (turns) => { card(turns).fileEditProposals = []; }, /fileEditProposals must be an array of 1–5/],
      ['more cards than a reply may carry', (turns) => {
        card(turns).fileEditProposals = Array.from({ length: 6 }, (_, index) => ({
          ...first(turns), target: { kind: 'resource', group: 'characters', path: `characters/p${index}.md` }
        }));
      }, /fileEditProposals must be an array of 1–5/],
      ['two cards for one file', (turns) => { cards(turns)[1] = { ...first(turns), target: { kind: 'resource', group: 'characters', path: SECRET_PATH.toUpperCase().replace('CHARACTERS', 'characters') } }; }, /\[1\]\.target must be a file no earlier card names/],
      ['an unknown field', (turns) => { first(turns).origin = 'persona'; }, /unknown field origin/],
      ['an unknown state', (turns) => { first(turns).state = 'saved'; }, /\.state must be pending/],
      ['an unknown target kind', (turns) => { first(turns).target = { kind: 'uri', uri: 'file:///a' }; }, /target\.kind must be resource \| excerpt/],
      ['an unknown group', (turns) => { first(turns).target = { kind: 'resource', group: 'secrets', path: 'a.md' }; }, /target must be a configured resource/],
      ['a traversing path', (turns) => { first(turns).target = { kind: 'resource', group: 'characters', path: '../a.md' }; }, /target must be a configured resource/],
      ['an absolute path', (turns) => { first(turns).target = { kind: 'resource', group: 'characters', path: '/etc/a.md' }; }, /target must be a configured resource/],
      ['an excerpt target with a path', (turns) => { cards(turns)[1].target = { kind: 'excerpt', path: 'a.md' }; }, /unknown field path/],
      ['no operations', (turns) => { first(turns).operations = []; }, /operations must be an array of 1–7/],
      ['an unknown operation', (turns) => { ops(turns)[0] = { op: 'delete', find: 'a' }; }, /\.op must be rewrite \| replace \| append \| prepend/],
      ['a rewrite beside others', (turns) => { ops(turns).push({ op: 'rewrite', text: 'All new.' }); }, /conflicting-operations/],
      ['two appends', (turns) => { ops(turns).push({ op: 'append', text: 'Again.' }); }, /repeated-element/],
      ['an empty find', (turns) => { ops(turns)[0].find = ''; }, /empty-find/],
      ['a why on two lines', (turns) => { first(turns).why = 'Alice\nis ten.'; }, /why must be one trimmed line/],
      ['a why past its bound', (turns) => { first(turns).why = 'a'.repeat(PROMPT_BUDGETS.workshopFileEdits.whyCharacters + 1); }, /why must be a string of at most/],
      ['an applied card with nothing landed', (turns) => { first(turns).state = 'applied'; }, /landed must be plain object/],
      ['a pending card with something landed', (turns) => { Object.assign(first(turns), APPLIED, { state: 'pending', reason: undefined }); delete first(turns).reason; }, /landed must be absent on a card that was not applied/],
      ['a pending card with a reason', (turns) => { first(turns).reason = 'Because.'; }, /reason must be absent on a pending or declined card/],
      ['a landed range naming no operation of the card', (turns) => {
        Object.assign(first(turns), APPLIED);
        ((first(turns).landed as Record<string, unknown>).ranges as Array<Record<string, unknown>>)[1].operations = [5];
      }, /ranges\[1\]\.operations must be indexes/],
      ['an operation in two ranges', (turns) => {
        Object.assign(first(turns), APPLIED);
        ((first(turns).landed as Record<string, unknown>).ranges as Array<Record<string, unknown>>)[1].operations = [0];
      }, /ranges\[1\]\.operations must be indexes/],
      ['a negative version', (turns) => {
        Object.assign(first(turns), APPLIED);
        (first(turns).landed as Record<string, unknown>).version = -1;
      }, /landed\.version must be a non-negative integer/]
    ])('%s', (_name, mutate, message) => {
      const text = checkpointWith(mutate);
      expect(() => parseWorkshopPersistedSession(JSON.parse(text))).toThrow(message);
      expect(() => decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text))).toThrow(message);
    });
  });
});

describe('file-edit cards in the transcript (one projection)', () => {
  const ledger = () => {
    const { room, carded } = roomWithCards();
    const turns = room.session.readRoomLedger().map((turn) => turn.id === carded.id
      ? { ...turn, fileEditProposals: [{ ...turn.fileEditProposals![0], ...APPLIED } as WorkshopFileEditProposal, turn.fileEditProposals![1]] }
      : turn);
    return { room, carded, turns };
  };

  it('a reply carries each card\'s file, why and state, and never an operation\'s text', () => {
    const { carded, turns } = ledger();
    const transcript = projectWorkshopTranscript(turns, { title: 'Edits', exportedAt: 0 });
    const reply = transcript.entries.find((entry) => entry.kind === 'reply' && entry.turnId === carded.id);
    expect(reply).toMatchObject({
      kind: 'reply',
      content: 'Yes.',
      fileEdits: [
        { target: { kind: 'resource', group: 'characters', path: SECRET_PATH }, why: `Why ${WHY_SENTINEL}`, state: 'applied' },
        { target: { kind: 'excerpt' }, why: 'Alice is ten now.', state: 'pending' }
      ]
    });
    const json = JSON.stringify(transcript);
    for (const sentinel of TEXT_SENTINELS) {
      expect(json).not.toContain(sentinel);
    }
    expect(json).not.toContain('Applied 2 of 2');
  });

  it.each([
    ['Markdown', renderWorkshopTranscriptMarkdown],
    ['JSON', renderWorkshopTranscriptJson],
    ['HTML', renderWorkshopTranscriptHtml]
  ] as const)('%s export shows the file, state and why, never the text', (_format, render) => {
    const { turns } = ledger();
    const out = render(projectWorkshopTranscript(turns, { title: 'Edits', exportedAt: 0 }));
    expect(out).toContain(WHY_SENTINEL);
    expect(out).toContain('zzq-secret-path.md');
    expect(out).toContain('applied');
    expect(out).toContain('pending');
    for (const sentinel of TEXT_SENTINELS) {
      expect(out).not.toContain(sentinel);
    }
    expect(out).not.toContain('prose-minion-file-edit');
  });

  it('recall and the turn preview see no card at all', () => {
    const { room, carded } = roomWithCards();
    expect(projectWorkshopTranscriptTurn(carded)).not.toHaveProperty('fileEdits');
    expect(JSON.stringify(workshopTurnPreview(carded))).not.toContain(WHY_SENTINEL);
    const document = JSON.stringify(buildWorkshopRecallDocument(scriptedCheckpoint('edits', room)));
    for (const sentinel of [...TEXT_SENTINELS, WHY_SENTINEL]) {
      expect(document).not.toContain(sentinel);
    }
  });
});
