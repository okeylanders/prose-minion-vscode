/**
 * Who owns a committed thread artifact, as the session codec checks it
 * (PR #151 F-05). A room's artifact belongs to a widget commit or to a
 * message attachment, never both, and each owner's kind is checked whatever
 * else references the artifact: a widget's artifact carries its widget's
 * kind, a Lightbox tile's carries `lightbox-tile`, and a file's carries none.
 * Rooms are built through the scripted room (the production session and its
 * completion boundary), then edited as persisted JSON.
 */

import type { WorkshopLightboxTile } from '@messages';
import { parseWorkshopSessionStateV1 } from '@/application/services/workshop/WorkshopSessionStateV1';
import { workshopLightboxTileAttachmentInput } from '@/application/services/workshop/WorkshopLightboxTileAttachment';
import { ScriptedWorkshopRoom } from './session/ScriptedWorkshopRoom';

/* eslint-disable @typescript-eslint/no-explicit-any -- persisted sessions are edited as plain JSON. */
type Persisted = Record<string, any>;

const TILE: WorkshopLightboxTile = {
  origin: 'lightbox',
  boardId: 'board-1',
  tileId: 'tile-c-spark-1',
  kindLabel: 'Open door',
  lensLabel: 'Spark',
  title: 'The empty jar',
  claim: 'What if the jar came back, full this time, when Alice least needs it?',
  points: [],
  quotes: [{ paragraph: 5, text: 'she took down a jar from one of the shelves as she passed' }],
  sourceLabel: 'Drafts/alice-chapter-1.md'
};

const persisted = (room: ScriptedWorkshopRoom): Persisted => JSON.parse(JSON.stringify(room.session.exportCommittedState()));
const widgetRoom = (): Persisted => {
  const room = new ScriptedWorkshopRoom().start();
  room.hostWidgetCommit();
  return persisted(room);
};
const attachmentRoom = (attachment: { label: string; content: string; input?: ReturnType<typeof workshopLightboxTileAttachmentInput> }): Persisted => {
  const room = new ScriptedWorkshopRoom().start();
  room.hostMessage('Look at this.', { attachment });
  return persisted(room);
};
const fileRoom = () => attachmentRoom({ label: 'notes.md', content: 'The jar was empty.' });
const tileRoom = () => {
  const input = workshopLightboxTileAttachmentInput(TILE);
  return attachmentRoom({ label: input.label, content: input.content, input });
};
const widgetTurn = (state: Persisted) => state.turns.find((turn: Persisted) => turn.widgetCommit?.rail === 'thread-artifact');
const artifactOf = (state: Persisted, id: string) => state.threadArtifacts.find((artifact: Persisted) => artifact.id === id);

describe('thread artifact provenance in the session codec (PR #151 F-05)', () => {
  it('refuses a widget artifact also referenced as a message attachment, even with a recognized wrong kind', () => {
    const state = widgetRoom();
    const turn = widgetTurn(state);
    const artifactId = turn.widgetCommit.artifactId as string;
    expect(() => parseWorkshopSessionStateV1(state)).not.toThrow();
    turn.messageAttachments = [{ id: artifactId, label: 'Gesture Playground', words: 6 }];
    artifactOf(state, artifactId).kind = 'widget:show-vs-tell';
    expect(() => parseWorkshopSessionStateV1(state)).toThrow(/referenced both as a message attachment and as a widget artifact/);
  });

  it('refuses dual ownership even when the kind is its widget\'s own', () => {
    const state = widgetRoom();
    const turn = widgetTurn(state);
    turn.messageAttachments = [{ id: turn.widgetCommit.artifactId, label: 'Gesture Playground', words: 6 }];
    expect(artifactOf(state, turn.widgetCommit.artifactId).kind).toBe('widget:gesture-playground');
    expect(() => parseWorkshopSessionStateV1(state)).toThrow(/referenced both as a message attachment and as a widget artifact/);
  });

  it('keeps a valid widget artifact, and refuses its wrong or missing widget kind', () => {
    const state = widgetRoom();
    const artifactId = widgetTurn(state).widgetCommit.artifactId as string;
    expect(parseWorkshopSessionStateV1(state).threadArtifacts).toEqual([
      expect.objectContaining({ id: artifactId, kind: 'widget:gesture-playground' })
    ]);
    const wrong = JSON.parse(JSON.stringify(state));
    artifactOf(wrong, artifactId).kind = 'widget:show-vs-tell';
    expect(() => parseWorkshopSessionStateV1(wrong)).toThrow(/wrong widget kind/);
    const tile = JSON.parse(JSON.stringify(state));
    artifactOf(tile, artifactId).kind = 'lightbox-tile';
    expect(() => parseWorkshopSessionStateV1(tile)).toThrow(/wrong widget kind/);
    const none = JSON.parse(JSON.stringify(state));
    delete artifactOf(none, artifactId).kind;
    expect(() => parseWorkshopSessionStateV1(none)).toThrow(/no widget kind/);
  });

  it('keeps a file attachment\'s artifact with no kind, and refuses one given a kind', () => {
    const state = fileRoom();
    const [artifact] = parseWorkshopSessionStateV1(state).threadArtifacts ?? [];
    expect(artifact).toEqual(expect.objectContaining({ id: 'ta-1' }));
    expect(artifact.kind).toBeUndefined();
    for (const kind of ['lightbox-tile', 'widget:gesture-playground']) {
      const given = JSON.parse(JSON.stringify(state));
      given.threadArtifacts[0].kind = kind;
      expect(() => parseWorkshopSessionStateV1(given)).toThrow(/wrong attachment kind/);
    }
  });

  it('keeps a Lightbox tile\'s artifact as kind lightbox-tile, and refuses a widget kind or none', () => {
    const state = tileRoom();
    expect(parseWorkshopSessionStateV1(state).threadArtifacts).toEqual([
      expect.objectContaining({ id: 'ta-1', kind: 'lightbox-tile' })
    ]);
    const widget = JSON.parse(JSON.stringify(state));
    widget.threadArtifacts[0].kind = 'widget:gesture-playground';
    expect(() => parseWorkshopSessionStateV1(widget)).toThrow(/wrong attachment kind/);
    const none = JSON.parse(JSON.stringify(state));
    delete none.threadArtifacts[0].kind;
    expect(() => parseWorkshopSessionStateV1(none)).toThrow(/wrong attachment kind/);
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */
