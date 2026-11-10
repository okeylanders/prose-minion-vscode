/**
 * Alternative versions in the saved session and the transcript (ADR
 * 2026-11-10, second addendum; epic Slice 3b), over the scripted room: the
 * real session, the answer's own completion, the session codec and the one
 * transcript projection.
 *
 * - An offer's `options`, and a press's and an answer's `option`, round-trip
 *   byte for byte; each malformed shape is refused; the webview's
 *   `optionStatuses` can never be stored.
 * - **The transcript's decision:** the request and answer lines name the
 *   chosen version (declared, bounded text, as a card's why is); `editOffers`
 *   stay omitted, so a version nobody pressed is nowhere in it.
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
import { editOfferFrame, fakeFileEditStaging, fileEditFrame } from '@/__tests__/application/services/workshop/fileEdits/fileEditFixtures';
import { ScriptedWorkshopRoom } from './ScriptedWorkshopRoom';
import { scriptedCheckpoint } from './WorkshopCoordinatorHarness';

const CHAPTER = 'chapters/down-the-rabbit-hole.md';
const SAID = 'Three ways the Rabbit\'s line could go, each written out above.';
const LABELS = ['The breathless one', 'The curt one', 'The muttered one'];
const OFFER = editOfferFrame({ kind: 'rewrites', extra: LABELS.map((label) => `<option>${label}</option>`) });
const REWRITE = fileEditFrame({
  group: 'chapters', path: CHAPTER, why: 'The curt version.',
  body: ['<find>Oh dear! Oh dear! I shall be late!</find>', '<replace-with>Late.</replace-with>']
});
const NONE = '<prose-minion-no-file-edit><why>The line already reads that way.</why></prose-minion-no-file-edit>';

type Turns = Array<Record<string, any>>;

async function pressedRoom() {
  const staging = fakeFileEditStaging();
  const room = new ScriptedWorkshopRoom().start();
  const source = await room.withStagedReply(`${SAID}\n\n${OFFER}`, staging, (reply) => room.hostMessage('How might the Rabbit say it?', { reply }));
  const proposed = (await room.editOfferPress(source, 'rewrites', REWRITE, staging, 1))!;
  const none = (await room.editOfferPress(source, 'rewrites', NONE, staging, 2))!;
  return { room, source, proposed, none };
}

async function checkpointWith(mutate: (turns: Turns) => void): Promise<string> {
  const { room } = await pressedRoom();
  const checkpoint = JSON.parse(JSON.stringify(scriptedCheckpoint('versions', room)));
  mutate(checkpoint.workshop.turns);
  return JSON.stringify(checkpoint);
}
const reply = (turns: Turns) => turns.find((turn) => turn.editOffers)!;
const request = (turns: Turns) => turns.find((turn) => turn.editOfferRequest)!;
const answers = (turns: Turns) => turns.filter((turn) => turn.editOfferAnswer);

describe('alternative versions in the saved session', () => {
  it('round-trips the labels and each press\'s option, byte for byte, with nothing to normalize', async () => {
    const { room, source, proposed, none } = await pressedRoom();
    const text = JSON.stringify(scriptedCheckpoint('versions', room));
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(text)))).toBe(text);
    const reopened = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text));
    expect(JSON.stringify(reopened.session)).toBe(text);
    expect(reopened.normalizations).toEqual([]);
    const turns = reopened.session.workshop.turns;
    expect(turns.find((turn) => turn.id === source.id)?.editOffers).toEqual([expect.objectContaining({ kind: 'rewrites', options: LABELS })]);
    expect(turns.filter((turn) => turn.editOfferRequest).map((turn) => turn.editOfferRequest)).toEqual([
      { sourceTurnId: source.id, kind: 'rewrites', option: 1 },
      { sourceTurnId: source.id, kind: 'rewrites', option: 2 }
    ]);
    expect(turns.find((turn) => turn.id === proposed.id)?.editOfferAnswer).toEqual({ sourceTurnId: source.id, kind: 'rewrites', option: 1, outcome: 'proposed' });
    expect(turns.find((turn) => turn.id === none.id)?.editOfferAnswer).toEqual({
      sourceTurnId: source.id, kind: 'rewrites', option: 2, outcome: 'none', why: 'The line already reads that way.'
    });
  });

  it('reads one option, and the most a frame may hold', async () => {
    for (const options of [['Only one'], ['a', 'b', 'c', 'd'], ['x'.repeat(40)]]) {
      const text = await checkpointWith((turns) => { reply(turns).editOffers[0].options = options; });
      expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(text)))).toBe(text);
    }
  });

  describe('refused when malformed', () => {
    it.each<[string, (turns: Turns) => void, RegExp]>([
      ['no options at all in the list', (turns) => { reply(turns).editOffers[0].options = []; }, /editOffers\[0\]\.options/],
      ['a fifth option', (turns) => { reply(turns).editOffers[0].options = ['a', 'b', 'c', 'd', 'e']; }, /editOffers\[0\]\.options/],
      ['an empty label', (turns) => { reply(turns).editOffers[0].options = ['Version 1', '']; }, /editOffers\[0\]\.options/],
      ['a label past its bound', (turns) => { reply(turns).editOffers[0].options = ['x'.repeat(41)]; }, /editOffers\[0\]\.options/],
      ['a label on two lines', (turns) => { reply(turns).editOffers[0].options = ['Version\n1']; }, /editOffers\[0\]\.options/],
      ['an untrimmed label', (turns) => { reply(turns).editOffers[0].options = [' Version 1']; }, /editOffers\[0\]\.options/],
      ['two labels alike but for case', (turns) => { reply(turns).editOffers[0].options = ['Version 1', 'VERSION 1']; }, /editOffers\[0\]\.options/],
      ['a label that is no string', (turns) => { reply(turns).editOffers[0].options = [1]; }, /editOffers\[0\]\.options/],
      ['options that are no list', (turns) => { reply(turns).editOffers[0].options = 'Version 1'; }, /editOffers\[0\]\.options/],
      ['options on a fixes offer', (turns) => { reply(turns).editOffers[0].kind = 'fixes'; }, /editOffers\[0\]\.options must be on a rewrites offer/],
      ['stored option statuses', (turns) => { reply(turns).editOffers[0].optionStatuses = [{ state: 'open' }]; }, /unknown field optionStatuses/],
      ['a request option that is no index', (turns) => { request(turns).editOfferRequest.option = 'Version 2'; }, /editOfferRequest\.option/],
      ['a negative request option', (turns) => { request(turns).editOfferRequest.option = -1; }, /editOfferRequest\.option/],
      ['a request option past the bound', (turns) => { request(turns).editOfferRequest.option = 4; }, /editOfferRequest\.option/],
      ['a fractional request option', (turns) => { request(turns).editOfferRequest.option = 1.5; }, /editOfferRequest\.option/],
      ['a request option on a fixes press', (turns) => { request(turns).editOfferRequest.kind = 'fixes'; }, /editOfferRequest\.option must be on a rewrites press/],
      ['a request that carries the label', (turns) => { request(turns).editOfferRequest.label = 'The curt one'; }, /unknown field label/],
      ['an answer option past the bound', (turns) => { answers(turns)[0].editOfferAnswer.option = 9; }, /editOfferAnswer\.option/],
      ['an answer option on a fixes answer', (turns) => { answers(turns)[0].editOfferAnswer.kind = 'fixes'; }, /editOfferAnswer\.option must be on a rewrites press/]
    ])('%s', async (_name, mutate, expected) => {
      const text = await checkpointWith(mutate);
      expect(() => parseWorkshopPersistedSession(JSON.parse(text))).toThrow(expected);
      expect(() => decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text))).toThrow(expected);
    });
  });
});

describe('alternative versions in the transcript (one projection)', () => {
  it('the request event and the answer name the chosen version', async () => {
    const { room, proposed, none } = await pressedRoom();
    const turn = room.session.readRoomLedger().find((each) => each.editOfferRequest)!;
    expect(projectWorkshopTranscriptTurn(turn)).toEqual({
      kind: 'event', turnId: turn.id, timestamp: turn.timestamp, text: 'Asked Jill for an edit · The curt one, from that reply.'
    });
    const transcript = projectWorkshopTranscript(room.session.readRoomLedger(), { title: 'Versions', exportedAt: 0 });
    expect(transcript.entries.find((each) => 'turnId' in each && each.turnId === proposed.id)).toMatchObject({
      kind: 'reply',
      speaker: 'Jill',
      content: `Suggested The curt one as an edit to ${CHAPTER}, from the 2:02 pm reply.`,
      fileEdits: [{ path: CHAPTER, why: 'The curt version.', state: 'pending' }]
    });
    expect(transcript.entries.find((each) => 'turnId' in each && each.turnId === none.id)).toMatchObject({
      kind: 'reply', content: 'Jill found nothing to change for The muttered one: The line already reads that way.'
    });
  });

  it('omits editOffers: a version nobody pressed, the keys and the indexes are nowhere in it', async () => {
    const { room } = await pressedRoom();
    const text = JSON.stringify(projectWorkshopTranscript(room.session.readRoomLedger(), { title: 'Versions', exportedAt: 0 }));
    for (const absent of ['The breathless one', 'editOffers', 'options', 'optionStatuses', 'editOfferRequest', 'editOfferAnswer', '"option"']) {
      expect(text).not.toContain(absent);
    }
  });

  it.each([
    ['Markdown', renderWorkshopTranscriptMarkdown],
    ['JSON', renderWorkshopTranscriptJson],
    ['HTML', renderWorkshopTranscriptHtml]
  ] as const)('%s export shows both lines with the version, and not the one nobody pressed', async (_format, render) => {
    const { room } = await pressedRoom();
    const out = render(projectWorkshopTranscript(room.session.readRoomLedger(), { title: 'Versions', exportedAt: 0 }));
    expect(out).toContain('Asked Jill for an edit · The curt one, from that reply.');
    expect(out).toContain('Suggested The curt one as an edit to');
    expect(out).not.toContain('The breathless one');
    expect(out).not.toContain('prose-minion-');
  });

  it('recall reads the same projection', async () => {
    const { room } = await pressedRoom();
    const document = JSON.stringify(buildWorkshopRecallDocument(scriptedCheckpoint('versions', room)));
    expect(document).toContain('Asked Jill for an edit · The curt one, from that reply.');
    expect(document).not.toContain('The breathless one');
  });
});
