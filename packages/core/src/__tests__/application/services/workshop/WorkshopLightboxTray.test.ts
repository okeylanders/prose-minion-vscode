/**
 * The Lightbox's tray, read from the Workshop session (Lightbox Slice 4):
 * it lists only tiles the Workshop staged, hears every change to the
 * pending attachments after the change (never inside it), and a tile
 * leaves when it is removed, sent, or its room is replaced.
 */

import type { WorkshopLightboxTile } from '@messages';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { workshopLightboxTray } from '@/application/services/workshop/WorkshopLightboxTray';
import { workshopLightboxTileAttachmentInput } from '@/application/services/workshop/WorkshopLightboxTileAttachment';

const tile = (tileId: string): WorkshopLightboxTile => ({
  origin: 'lightbox',
  boardId: 'board-1',
  tileId,
  kindLabel: 'Motif',
  lensLabel: 'Theme & motif',
  title: 'Falling',
  claim: 'The fall is long enough to think in.',
  points: [],
  quotes: [{ paragraph: 6, text: 'Down, down, down.' }],
  sourceLabel: 'Drafts/alice-chapter-1.md'
});

const tick = () => Promise.resolve();

describe('workshopLightboxTray', () => {
  it('lists staged tiles only, and hears each change on a microtask after it', async () => {
    const session = new WorkshopSessionService(() => 1);
    const tray = workshopLightboxTray(session);
    const heard = jest.fn();
    const unsubscribe = tray.subscribe(heard);

    session.addMessageAttachment(workshopLightboxTileAttachmentInput(tile('tile-a-motif-1')));
    session.addMessageAttachment({ label: 'notes.md', words: 3, content: 'Some notes here.', sourceUri: 'file:///notes.md' });
    expect(heard).not.toHaveBeenCalled();
    await tick();
    expect(heard).toHaveBeenCalledTimes(2);
    expect(tray.read()).toEqual([{ boardId: 'board-1', tileId: 'tile-a-motif-1', label: 'Lightbox Motif: Falling' }]);

    // A refusal changes nothing, so nothing is heard.
    session.addMessageAttachment(workshopLightboxTileAttachmentInput(tile('tile-a-motif-1')));
    await tick();
    expect(heard).toHaveBeenCalledTimes(2);

    session.removeMessageAttachment('ta-1');
    await tick();
    expect(heard).toHaveBeenCalledTimes(3);
    expect(tray.read()).toEqual([]);

    unsubscribe();
    session.addMessageAttachment(workshopLightboxTileAttachmentInput(tile('tile-a-motif-2')));
    await tick();
    expect(heard).toHaveBeenCalledTimes(3);
  });

  it('empties when the tile is sent or the room is replaced, and survives a listener that throws', async () => {
    const session = new WorkshopSessionService(() => 1);
    const tray = workshopLightboxTray(session);
    const failing = jest.fn(() => {
      throw new Error('listener failed');
    });
    const heard = jest.fn();
    tray.subscribe(failing);
    tray.subscribe(heard);

    session.addMessageAttachment(workshopLightboxTileAttachmentInput(tile('tile-a-motif-1')));
    session.commitMessageAttachments(['ta-1']);
    await tick();
    expect(tray.read()).toEqual([]);
    expect(heard).toHaveBeenCalledTimes(2);

    session.addMessageAttachment(workshopLightboxTileAttachmentInput(tile('tile-a-motif-2')));
    const saved = session.exportCommittedState();
    session.reset();
    await tick();
    expect(tray.read()).toEqual([]);
    expect(heard).toHaveBeenCalledTimes(4);

    // Opening a room that holds a tile brings it back into the tray.
    session.hydrateCommittedState(saved, {}, session.getConversationBehavior());
    await tick();
    expect(tray.read()).toEqual([expect.objectContaining({ tileId: 'tile-a-motif-2' })]);
    expect(heard).toHaveBeenCalledTimes(5);
    expect(failing).toHaveBeenCalledTimes(5);
  });
});
