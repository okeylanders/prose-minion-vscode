/**
 * The turn preview (ADR 2026-11-03 D6) reads a turn only through the
 * transcript projection: every turn of a room that touches each projection
 * rule previews as its entry says, with only the fields the preview names,
 * and nothing host-private (attachment details, widget payloads, capability
 * evidence, a context change's details) ever appears.
 */

import { workshopTurnPreview } from '@/application/services/workshop/transcript/WorkshopTurnPreview';
import { projectWorkshopTranscriptTurn } from '@/application/services/workshop/transcript/WorkshopTranscript';
import { representativeRoom } from './workshopTranscriptFixtures';

const PREVIEW_KEYS = ['content', 'kind', 'privateWith', 'speaker', 'timestamp', 'truncated'];
const turnById = (id: string) => representativeRoom().find((turn) => turn.id === id)!;

describe('workshopTurnPreview', () => {
  it('previews every turn the transcript keeps, as its entry says, and nothing it omits', () => {
    for (const turn of representativeRoom()) {
      const entry = projectWorkshopTranscriptTurn(turn);
      const preview = workshopTurnPreview(turn);
      if (!entry) {
        expect(preview).toBeUndefined();
        continue;
      }
      expect(preview).toBeDefined();
      expect(Object.keys(preview!).every((key) => PREVIEW_KEYS.includes(key))).toBe(true);
      expect(preview!.kind).toBe(entry.kind);
      expect(preview!.content).toBe(entry.kind === 'event' ? entry.text : entry.content);
      expect(preview!.timestamp).toBe(entry.timestamp);
    }
  });

  it('names the writer as the thread does and a reply by its speaker, keeping truncation', () => {
    expect(workshopTurnPreview(turnById('u-1'))).toEqual({
      kind: 'writer',
      speaker: 'You',
      content: 'Does the dock scene earn its length?\nBe blunt.',
      timestamp: turnById('u-1').timestamp
    });
    expect(workshopTurnPreview(turnById('a-2'))).toMatchObject({
      kind: 'reply',
      speaker: 'Felix',
      content: 'The hands are doing too much.',
      truncated: true
    });
    expect(workshopTurnPreview(turnById('a-1'))).not.toHaveProperty('truncated');
  });

  it('shows a capability card by its request, never its evidence', () => {
    const preview = workshopTurnPreview(turnById('cap-1'));

    expect(preview).toMatchObject({ kind: 'event', speaker: 'Session' });
    expect(JSON.stringify(preview)).not.toContain('EVIDENCE');
  });

  it('carries no attachment, widget or context detail on any path', () => {
    const previews = JSON.stringify(representativeRoom().map(workshopTurnPreview));

    expect(previews).not.toContain('drafts/chapter-3.md');
    expect(previews).not.toContain('wc-1');
    expect(previews).not.toContain('secret-notes');
    expect(previews).not.toContain('EVIDENCE');
  });
});
