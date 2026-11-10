/**
 * PR #230 F-01: a staged identity is one contract between staging's output
 * and the session codec, enforced before a card is adopted, so no accepted
 * card ever makes a session unsaveable.
 *
 * Converted from the review's probe (`docs/pr-reviews/probes/pr-230-excerpt-
 * persistence-probe.test.ts.txt`), which asserted the defect. The staging
 * stub reproduces #229's `FileEditStagingService` excerpt output exactly: the
 * room's authorized `relativePath` and `sourceUri`, verbatim. Each case
 * completes a persona reply, then saves and reopens the full session:
 * - a POSIX colon filename and a nested path past the model's lookup bound
 *   are host display paths, so the staged identity round-trips;
 * - an ordinary chapter is the control;
 * - an identity past the display or URI bound, or on two lines, becomes a
 *   persistable `refused` card and the reply is kept;
 * - the model's own lookup path is still held to `resource.read`'s rule.
 * Made-up paths: Alice.
 */
import { pathToFileURL } from 'url';
import {
  decodeWorkshopPersistedSessionCheckpoint,
  parseWorkshopPersistedSession
} from '@/application/services/workshop/WorkshopPersistedSession';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { resolveWorkshopReplyFileEdits } from '@/application/services/workshop/fileEdits/WorkshopReplyFileEditProposals';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  WORKSHOP_FILE_EDIT_RECORD_LIMITS,
  WORKSHOP_FILE_EDIT_UNPERSISTABLE_IDENTITY_REASON
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { FileEditStaging } from '@/domain/models/FileEditStaging';
import { extractWorkshopReplyControls } from '@/utils/workshopReplyControls';
import { fileEditFrame } from '@/__tests__/application/services/workshop/fileEdits/fileEditFixtures';
import { ScriptedWorkshopRoom } from './ScriptedWorkshopRoom';
import { scriptedCheckpoint } from './WorkshopCoordinatorHarness';

/** #229's excerpt branch: the room's excerpt identity, returned as it is. */
function excerptStaging(room: ScriptedWorkshopRoom): FileEditStaging {
  return {
    resolve: async () => ({ kind: 'refused', reason: 'excerpt-not-a-file' }),
    stage: async () => {
      const source = room.session.getExcerpt()?.source;
      if (!source || source.kind !== 'file') {
        return { kind: 'refused', reason: 'excerpt-not-a-file' };
      }
      return {
        kind: 'staged',
        target: { kind: 'excerpt', documentUri: source.sourceUri, relativePath: source.relativePath },
        class: 'prose',
        baseline: { sha256: 'a'.repeat(64), length: 15 }
      };
    }
  };
}

async function roomWithExcerptCard(relativePath: string, documentUri = pathToFileURL(`/workspace/novel/${relativePath}`).toString()) {
  const room = new ScriptedWorkshopRoom().start();
  room.session.setExcerpt({ text: 'Alice is seven.', source: { kind: 'file', sourceUri: documentUri, relativePath } });
  room.hostMessage('Read this chapter.');
  // The room with its excerpt saves before any card exists.
  expect(() => parseWorkshopPersistedSession(scriptedCheckpoint('identity', room))).not.toThrow();
  const reply = `Her age changes here.\n\n${fileEditFrame({ excerpt: true })}`;
  room.fileEdits = await resolveWorkshopReplyFileEdits({ reply, open: true, staging: excerptStaging(room) });
  const turn = room.hostMessage('Change her age.', { reply });
  return { room, turn, documentUri };
}

/** Save the full session, read it back strictly, and reopen it. */
function saveAndReopen(room: ScriptedWorkshopRoom) {
  const text = JSON.stringify(scriptedCheckpoint('identity', room));
  expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(text)))).toBe(text);
  const reopened = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(text));
  const session = new WorkshopSessionService(() => 9_000);
  session.hydrateCommittedState(reopened.session.workshop, { host: 'host-conversation' }, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR);
  return session.readRoomLedger();
}

describe('a staged identity round-trips through save and reopen (PR #230 F-01)', () => {
  const nested = `${'nested/'.repeat(180)}chapter.md`;

  it.each([
    ['a POSIX colon filename', 'draft:one.md'],
    ['a nested path past the model lookup bound', nested],
    ['an ordinary chapter (control)', 'chapters/chapter-1.md']
  ])('%s keeps its identity, pending, and the reply', async (_name, relativePath) => {
    if (relativePath === nested) {
      expect(relativePath.length).toBeGreaterThan(PROMPT_BUDGETS.workshopResource.pathCharacters);
    }
    const { room, turn, documentUri } = await roomWithExcerptCard(relativePath);
    expect(turn.content).toBe('Her age changes here.');
    expect(turn.fileEditProposals?.[0]).toMatchObject({
      state: 'pending',
      class: 'prose',
      target: { kind: 'excerpt', documentUri, relativePath }
    });
    const reopened = saveAndReopen(room).find((entry) => entry.id === turn.id)!;
    expect(reopened.content).toBe('Her age changes here.');
    expect(reopened.fileEditProposals).toEqual(turn.fileEditProposals);
  });
});

describe('an identity a session cannot hold becomes a persistable refusal, and the reply is kept', () => {
  it.each([
    ['a display path past its bound', 'a/'.repeat(WORKSHOP_FILE_EDIT_RECORD_LIMITS.displayPathCharacters / 2) + 'x.md', undefined],
    ['a display path on two lines', 'chapters/one\ntwo.md', undefined],
    ['a URI past its bound', 'chapters/one.md', `file:///${'a'.repeat(WORKSHOP_FILE_EDIT_RECORD_LIMITS.documentUriCharacters)}`]
  ])('%s', async (_name, relativePath, documentUri) => {
    const { room, turn } = await roomWithExcerptCard(relativePath, documentUri);
    expect(turn.content).toBe('Her age changes here.');
    expect(turn.fileEditProposals).toEqual([expect.objectContaining({
      requested: { kind: 'excerpt' },
      state: 'refused',
      reason: WORKSHOP_FILE_EDIT_UNPERSISTABLE_IDENTITY_REASON
    })]);
    expect(turn.fileEditProposals?.[0]).not.toHaveProperty('target');
    const reopened = saveAndReopen(room).find((entry) => entry.id === turn.id)!;
    expect(reopened.content).toBe('Her age changes here.');
    expect(reopened.fileEditProposals).toEqual(turn.fileEditProposals);
  });
});

describe('the model\'s own lookup path keeps resource.read\'s rule', () => {
  it.each(['draft:one.md', '../secret.md', '/abs/alice.md', `chapters/${'a'.repeat(PROMPT_BUDGETS.workshopResource.pathCharacters)}`])(
    'a frame naming %s is refused before anything is staged', (path) => {
      const controls = extractWorkshopReplyControls(`Yes.\n\n${fileEditFrame({ group: 'chapters', path })}`, { memoryOpen: false, fileEditsOpen: true });
      expect(controls.fileEdits?.proposals).toEqual([]);
      expect(controls.fileEdits?.rejections).toEqual([expect.stringMatching(/^malformed:(invalid-path|path-too-long)$/)]);
    }
  );
});
