/**
 * Slices 2 and 3 together (ADR 2026-11-05 D4, D10; Astra's combined-stack
 * gate, first part): a persona's frame is staged through the real
 * `FileEditStagingService` (over `FakeDocuments` and fake host ports),
 * becomes a pending card on a completed reply, and survives a full session
 * save and reopen with its identity, class and baseline intact. A note, a
 * chapter, and a note that is the room's excerpt document (an alias, so
 * prose). Made-up paths: *Alice*.
 */
import {
  decodeWorkshopPersistedSessionCheckpoint,
  parseWorkshopPersistedSession
} from '@/application/services/workshop/WorkshopPersistedSession';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { resolveWorkshopReplyFileEdits } from '@/application/services/workshop/fileEdits/WorkshopReplyFileEditProposals';
import { FileEditStagingService } from '@/application/services/fileEdits/FileEditStagingService';
import { fileEditBaseline } from '@/application/services/fileEdits/fileEditIdentity';
import { DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR, type WorkshopTurn } from '@messages';
import { fileEditFrame } from '@/__tests__/application/services/workshop/fileEdits/fileEditFixtures';
import { ScriptedWorkshopRoom } from '../workshop/session/ScriptedWorkshopRoom';
import { scriptedCheckpoint } from '../workshop/session/WorkshopCoordinatorHarness';
import { FakeDocuments } from '../draftEdit/fakeDocuments';
import { candidate, hostFakes, ports, ROOT, uriOf } from './fileEditFixtures';

const NOTE = `${ROOT}/characters/alice.md`;
const CHAPTER = `${ROOT}/chapters/one.md`;
const SCENE = `${ROOT}/drafts/scene.md`;
const NOTE_TEXT = '---\ntitle: Alice\n---\n\nAlice is seven.\n';
const CHAPTER_TEXT = 'Alice is seven, and the Rabbit is late.\n';
const SCENE_TEXT = 'Alice is seven in this scene.\n';

/** The real staging service over one host: the note open in an editor, the others on disk. */
function realStaging(excerpt?: { fsPath: string; relativePath: string }) {
  const fakes = hostFakes({
    candidates: [
      candidate('characters', 'characters/alice.md'),
      candidate('chapters', 'chapters/one.md'),
      candidate('general', 'drafts/scene.md')
    ],
    files: { [CHAPTER]: CHAPTER_TEXT, [SCENE]: SCENE_TEXT },
    ...(excerpt ? { excerpt } : {})
  });
  const open = new FakeDocuments(NOTE_TEXT, uriOf(NOTE));
  return new FileEditStagingService({ ...ports(fakes), documents: open });
}

async function replyWithCard(frame: string, excerpt?: { fsPath: string; relativePath: string }): Promise<ScriptedWorkshopRoom> {
  const room = new ScriptedWorkshopRoom().start();
  if (excerpt) {
    room.session.setExcerpt({ text: SCENE_TEXT, source: { kind: 'file', sourceUri: uriOf(excerpt.fsPath), relativePath: excerpt.relativePath } });
  }
  room.hostMessage('Read this.');
  const reply = `Her age changes here.\n\n${frame}`;
  room.fileEdits = await resolveWorkshopReplyFileEdits({ reply, open: true, staging: realStaging(excerpt) });
  room.hostMessage('Change her age.', { reply });
  return room;
}

/** Save the full session, read it back strictly, and reopen it. */
function saveAndReopen(room: ScriptedWorkshopRoom): readonly WorkshopTurn[] {
  const text = JSON.stringify(scriptedCheckpoint('staging', room));
  expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(text)))).toBe(text);
  const reopened = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text));
  const session = new WorkshopSessionService(() => 9_000);
  session.hydrateCommittedState(reopened.session.workshop, { host: 'host-conversation' }, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR);
  return session.readRoomLedger();
}

const cardOf = (turns: readonly WorkshopTurn[]) => turns.flatMap((turn) => turn.fileEditProposals ?? [])[0];

describe('real staging, a completed reply, then save and reopen', () => {
  it('a note: staged from its open buffer as notes, pending after reopen', async () => {
    const room = await replyWithCard(fileEditFrame({ group: 'characters', path: 'characters/alice.md' }));
    const card = cardOf(saveAndReopen(room));
    expect(card).toMatchObject({
      state: 'pending',
      class: 'notes',
      target: { kind: 'file', documentUri: uriOf(NOTE), relativePath: 'characters/alice.md' },
      baseline: fileEditBaseline(NOTE_TEXT, NOTE)
    });
  });

  it('a chapter: staged from the file as prose, pending after reopen', async () => {
    const room = await replyWithCard(fileEditFrame({ group: 'chapters', path: 'chapters/one.md' }));
    const card = cardOf(saveAndReopen(room));
    expect(card).toMatchObject({
      state: 'pending',
      class: 'prose',
      target: { kind: 'file', documentUri: uriOf(CHAPTER), relativePath: 'chapters/one.md' },
      baseline: fileEditBaseline(CHAPTER_TEXT, CHAPTER)
    });
  });

  it('an excerpt alias: a general file that is the room\'s excerpt stages as prose, by its key or as <excerpt/>', async () => {
    const excerpt = { fsPath: SCENE, relativePath: 'drafts/scene.md' };
    const byKey = cardOf(saveAndReopen(await replyWithCard(fileEditFrame({ group: 'general', path: 'drafts/scene.md' }), excerpt)));
    expect(byKey).toMatchObject({
      state: 'pending',
      class: 'prose',
      target: { kind: 'file', documentUri: uriOf(SCENE), relativePath: 'drafts/scene.md' },
      baseline: fileEditBaseline(SCENE_TEXT, SCENE)
    });
    const asExcerpt = cardOf(saveAndReopen(await replyWithCard(fileEditFrame({ excerpt: true }), excerpt)));
    expect(asExcerpt).toMatchObject({
      state: 'pending',
      class: 'prose',
      target: { kind: 'excerpt', documentUri: uriOf(SCENE), relativePath: 'drafts/scene.md' }
    });
  });

  it('a refusal at staging is a refused card that still saves and reopens', async () => {
    const card = cardOf(saveAndReopen(await replyWithCard(fileEditFrame({ group: 'characters', path: 'characters/hatter.md' }))));
    expect(card).toMatchObject({ state: 'refused', reason: 'not-configured' });
  });
});
