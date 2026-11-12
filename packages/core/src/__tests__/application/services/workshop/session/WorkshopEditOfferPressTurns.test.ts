/**
 * A press and its answer in the saved session and the transcript (ADR
 * 2026-11-10 D3, D8; epic Slice 2), over the scripted room: the real
 * session, the answer's own completion, the session codec and the one
 * transcript projection.
 *
 * - The three optional keys and a card's `intent` round-trip byte for byte;
 *   each malformed shape is refused, and no "used" state can be stored.
 * - The transcript includes the request turn as an event holding its host
 *   sentence, and the answer as the persona's reply: the host's line with
 *   the source reply's time, and its cards as any reply's cards are shown.
 *   Recall reads the same projection.
 * Made-up text: Alice.
 */

import {
  decodeWorkshopPersistedSessionCheckpoint,
  parseWorkshopPersistedSession
} from '@/application/services/workshop/WorkshopPersistedSession';
import { projectWorkshopTranscript, projectWorkshopTranscriptTurn } from '@/application/services/workshop/transcript/WorkshopTranscript';
import { renderWorkshopTranscriptMarkdown } from '@/application/services/workshop/export/WorkshopTranscriptMarkdown';
import { renderWorkshopTranscriptJson } from '@/application/services/workshop/export/WorkshopTranscriptJson';
import { renderWorkshopTranscriptHtml } from '@/application/services/workshop/export/WorkshopTranscriptHtml';
import { buildWorkshopRecallDocument } from '@/application/services/workshop/recall/WorkshopRecallDocument';
import { editOfferFrame, fakeFileEditStaging, fileEditFrame, URI_SENTINEL } from '@/__tests__/application/services/workshop/fileEdits/fileEditFixtures';
import { ScriptedWorkshopRoom } from './ScriptedWorkshopRoom';
import { scriptedCheckpoint } from './WorkshopCoordinatorHarness';

const CHAPTER = 'chapters/down-the-rabbit-hole.md';
const QUOTE_SENTINEL = 'ZZQ-QUOTE';
const SAID = 'Two slips in the chapter, and the Rabbit\'s line would land harder cut short.';
const OFFERS = `${editOfferFrame({ kind: 'fixes', count: 2 })}\n${editOfferFrame({ kind: 'rewrites' })}`;
const FIXES = fileEditFrame({
  group: 'chapters', path: CHAPTER, why: 'The two slips.',
  body: [`<find>begining ${QUOTE_SENTINEL}</find>`, `<replace-with>beginning ${QUOTE_SENTINEL}</replace-with>`]
});
const NONE = '<prose-minion-no-file-edit><why>The chapter already reads beginning.</why></prose-minion-no-file-edit>';

type Turns = Array<Record<string, any>>;

async function pressedRoom() {
  const staging = fakeFileEditStaging();
  const room = new ScriptedWorkshopRoom().start();
  const source = await room.withStagedReply(`${SAID}\n\n${OFFERS}`, staging, (reply) => room.hostMessage('Read the first page for slips.', { reply }));
  const proposed = (await room.editOfferPress(source, 'fixes', `Here they are.\n\n${FIXES}`, staging))!;
  const none = (await room.editOfferPress(source, 'rewrites', NONE, staging))!;
  return { room, source, proposed, none };
}

async function checkpointWith(mutate: (turns: Turns) => void): Promise<string> {
  const { room } = await pressedRoom();
  const checkpoint = JSON.parse(JSON.stringify(scriptedCheckpoint('pressed', room)));
  mutate(checkpoint.workshop.turns);
  return JSON.stringify(checkpoint);
}
const request = (turns: Turns) => turns.find((turn) => turn.editOfferRequest)!;
const answers = (turns: Turns) => turns.filter((turn) => turn.editOfferAnswer);

describe('a press and its answer in the saved session (D3, D8)', () => {
  it('round-trips the three keys and a card\'s intent, byte for byte, with nothing to normalize', async () => {
    const { room, source, proposed, none } = await pressedRoom();
    const text = JSON.stringify(scriptedCheckpoint('pressed', room));
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(text)))).toBe(text);
    const reopened = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text));
    expect(JSON.stringify(reopened.session)).toBe(text);
    expect(reopened.normalizations).toEqual([]);
    const turns = reopened.session.workshop.turns;
    expect(turns.filter((turn) => turn.editOfferRequest).map((turn) => turn.editOfferRequest)).toEqual([
      { sourceTurnId: source.id, kind: 'fixes' },
      { sourceTurnId: source.id, kind: 'rewrites' }
    ]);
    expect(turns.find((turn) => turn.id === proposed.id)).toMatchObject({
      editOfferAnswer: { sourceTurnId: source.id, kind: 'fixes', outcome: 'proposed' },
      fileEditProposals: [{ intent: 'fixes', state: 'pending' }]
    });
    expect(turns.find((turn) => turn.id === none.id)?.editOfferAnswer).toEqual({
      sourceTurnId: source.id, kind: 'rewrites', outcome: 'none', why: 'The chapter already reads beginning.'
    });
  });

  it('a none answer with no why, and a card with no intent, read too', async () => {
    const text = await checkpointWith((turns) => {
      delete answers(turns)[1].editOfferAnswer.why;
      delete answers(turns)[0].fileEditProposals[0].intent;
    });
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(text)))).toBe(text);
  });

  describe('refused when malformed', () => {
    const reply = (turns: Turns) => turns.find((turn) => turn.editOffers)!;
    it.each<[string, (turns: Turns) => void, RegExp]>([
      ['a request on a persona\'s reply', (turns) => { reply(turns).editOfferRequest = { sourceTurnId: 't', kind: 'fixes' }; }, /editOfferRequest must be a writer turn/],
      ['a request with no source', (turns) => { delete request(turns).editOfferRequest.sourceTurnId; }, /editOfferRequest/],
      ['a request of an unknown kind', (turns) => { request(turns).editOfferRequest.kind = 'both'; }, /editOfferRequest\.kind must be fixes \| rewrites/],
      ['a request that carries text', (turns) => { request(turns).editOfferRequest.text = 'begining'; }, /unknown field text/],
      ['a request that carries a path', (turns) => { request(turns).editOfferRequest.path = CHAPTER; }, /unknown field path/],
      ['an answer on a writer turn', (turns) => { request(turns).editOfferAnswer = { sourceTurnId: 't', kind: 'fixes', outcome: 'none' }; }, /editOfferAnswer must be a host or guest persona reply/],
      ['an answer of an unknown outcome', (turns) => { answers(turns)[0].editOfferAnswer.outcome = 'used'; }, /editOfferAnswer\.outcome must be proposed \| none/],
      ['an answer with no kind', (turns) => { delete answers(turns)[0].editOfferAnswer.kind; }, /editOfferAnswer/],
      ['a why on an answer that proposed', (turns) => { answers(turns)[0].editOfferAnswer.why = 'Because.'; }, /editOfferAnswer\.why must be absent on an answer that proposed edits/],
      ['a why on two lines', (turns) => { answers(turns)[1].editOfferAnswer.why = 'One.\nTwo.'; }, /editOfferAnswer\.why/],
      ['a why past its bound', (turns) => { answers(turns)[1].editOfferAnswer.why = 'a'.repeat(201); }, /editOfferAnswer\.why/],
      ['a stored used flag on an answer', (turns) => { answers(turns)[0].editOfferAnswer.used = true; }, /unknown field used/],
      ['a stored status on the offer', (turns) => { reply(turns).editOffers[0].status = { state: 'answered' }; }, /unknown field status/],
      ['an unknown intent on a card', (turns) => { answers(turns)[0].fileEditProposals[0].intent = 'everything'; }, /intent must be fixes \| rewrites/]
    ])('%s', async (_name, mutate, expected) => {
      const text = await checkpointWith(mutate);
      expect(() => parseWorkshopPersistedSession(JSON.parse(text))).toThrow(expected);
      expect(() => decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text))).toThrow(expected);
    });
  });
});

describe('a press and its answer in the transcript (one projection, D8)', () => {
  it('includes the request turn as an event holding its host sentence, never as the writer\'s words', async () => {
    const { room } = await pressedRoom();
    const turn = room.session.readRoomLedger().find((each) => each.editOfferRequest)!;
    expect(projectWorkshopTranscriptTurn(turn)).toEqual({
      kind: 'event', turnId: turn.id, timestamp: turn.timestamp,
      text: 'Asked Jill to suggest the fixes from their reply as file edits.'
    });
  });

  it('includes the answer as the persona\'s reply: the host line with the source reply\'s time, and its cards by path, why and state', async () => {
    const { room, proposed, none } = await pressedRoom();
    const transcript = projectWorkshopTranscript(room.session.readRoomLedger(), { title: 'Slips', exportedAt: 0 });
    const entry = transcript.entries.find((each) => 'turnId' in each && each.turnId === proposed.id);
    expect(entry).toMatchObject({
      kind: 'reply',
      speaker: 'Jill',
      content: `Suggested 1 fix to ${CHAPTER}, from the 2:02 pm reply.`,
      fileEdits: [{ path: CHAPTER, why: 'The two slips.', state: 'pending' }]
    });
    expect(transcript.entries.find((each) => 'turnId' in each && each.turnId === none.id)).toMatchObject({
      kind: 'reply', content: 'Jill found nothing to change: The chapter already reads beginning.'
    });
    // The keys themselves, the persona's prose and an operation's text are never carried.
    const text = JSON.stringify(transcript);
    for (const absent of ['editOfferRequest', 'editOfferAnswer', 'sourceTurnId', 'intent', 'Here they are.', QUOTE_SENTINEL, URI_SENTINEL]) {
      expect(text).not.toContain(absent);
    }
  });

  it.each([
    ['Markdown', renderWorkshopTranscriptMarkdown],
    ['JSON', renderWorkshopTranscriptJson],
    ['HTML', renderWorkshopTranscriptHtml]
  ] as const)('%s export shows both host lines, and none of the answer\'s prose or quotes', async (_format, render) => {
    const { room } = await pressedRoom();
    const out = render(projectWorkshopTranscript(room.session.readRoomLedger(), { title: 'Slips', exportedAt: 0 }));
    expect(out).toContain('Asked Jill to suggest the fixes from their reply as file edits.');
    expect(out).toContain('from the 2:02 pm reply.');
    expect(out).toContain('The two slips.');
    for (const absent of ['Here they are.', QUOTE_SENTINEL, URI_SENTINEL, 'prose-minion-']) {
      expect(out).not.toContain(absent);
    }
  });

  it('recall reads the same projection: the host sentence and line, never a quote', async () => {
    const { room } = await pressedRoom();
    const document = JSON.stringify(buildWorkshopRecallDocument(scriptedCheckpoint('pressed', room)));
    expect(document).toContain('Asked Jill to suggest the fixes from their reply as file edits.');
    expect(document).toContain('from the 2:02 pm reply.');
    for (const absent of ['Here they are.', QUOTE_SENTINEL, URI_SENTINEL]) {
      expect(document).not.toContain(absent);
    }
  });
});
