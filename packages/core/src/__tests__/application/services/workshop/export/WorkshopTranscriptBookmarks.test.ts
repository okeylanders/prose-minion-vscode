/**
 * Bookmarks in transcript export (ADR 2026-11-03 D10). The projection marks
 * the turns the writer bookmarked and nothing else; JSON carries
 * `bookmarked: true` with `formatVersion` unchanged; Markdown and HTML show a
 * mark, the HTML's in export-only page rules. A bookmark's id and label never
 * reach a transcript. The last case runs the real export route over the live
 * room.
 */

import { MessageType } from '@messages';
import { projectWorkshopTranscript } from '@/application/services/workshop/transcript/WorkshopTranscript';
import {
  buildWorkshopTranscriptJsonDocument,
  WORKSHOP_TRANSCRIPT_JSON_FORMAT_VERSION
} from '@/application/services/workshop/export/WorkshopTranscriptJson';
import { renderWorkshopTranscriptMarkdown } from '@/application/services/workshop/export/WorkshopTranscriptMarkdown';
import { renderWorkshopTranscriptHtml } from '@/application/services/workshop/export/WorkshopTranscriptHtml';
import {
  WORKSHOP_TRANSCRIPT_HTML_CSS,
  WORKSHOP_TRANSCRIPT_MIRRORED_STYLES
} from '@/application/services/workshop/export/WorkshopTranscriptHtmlStyles';
import {
  dividerTurn,
  FIXTURE_EPOCH,
  fixtureTurn,
  writerTurn
} from '../transcript/workshopTranscriptFixtures';
import {
  createWorkshopRouteTestHarness,
  message
} from '../../../handlers/domain/workshop/WorkshopRouteTestHarness';

const turns = [
  dividerTurn('s-1', 'session_start', 'Session started'),
  writerTurn('u-1', { content: 'Is the dock scene too long?' }),
  fixtureTurn('a-1', { content: 'It runs a beat long.' }),
  fixtureTurn('c-1', {
    kind: 'tool_run',
    participant: 'tool',
    artifact: 'resource_read',
    personaId: undefined,
    personaLabel: undefined,
    toolLabel: 'Project Resources',
    capability: {
      operation: 'resource.read',
      status: 'success',
      requestSummary: 'notes/dock.md',
      requestedByPersonaId: 'jill',
      invokedBy: { kind: 'host' }
    },
    content: 'Evidence body.'
  }),
  writerTurn('u-2', { content: 'Cut it then.' }),
  fixtureTurn('a-2', { content: 'Cut.' })
];
const BOOKMARKED = new Set(['u-1', 'c-1', 'a-2']);

const transcript = (bookmarkedTurnIds?: ReadonlySet<string>) =>
  projectWorkshopTranscript(turns, { title: 'Dock scene', exportedAt: FIXTURE_EPOCH, bookmarkedTurnIds });

describe('bookmarks in the transcript export', () => {
  it('marks exactly the bookmarked turns in the projection', () => {
    const entries = transcript(BOOKMARKED).entries;

    expect(entries.map((entry) => [entry.turnId, entry.bookmarked === true])).toEqual([
      ['s-1', false],
      ['u-1', true],
      ['a-1', false],
      ['c-1', true],
      ['u-2', false],
      ['a-2', true]
    ]);
    expect(entries.filter((entry) => !entry.bookmarked).every((entry) => !('bookmarked' in entry))).toBe(true);
  });

  it('leaves a transcript without bookmarks exactly as it was', () => {
    expect(transcript(new Set())).toEqual(transcript());
    expect(JSON.stringify(transcript())).not.toContain('bookmark');
  });

  it('carries `bookmarked: true` in JSON, with the format version unchanged', () => {
    const document = buildWorkshopTranscriptJsonDocument(transcript(BOOKMARKED));

    expect(document.formatVersion).toBe(1);
    expect(WORKSHOP_TRANSCRIPT_JSON_FORMAT_VERSION).toBe(1);
    expect(document.entries.map((entry) => entry.bookmarked)).toEqual([
      undefined, true, undefined, true, undefined, true
    ]);
    expect(document.entries[1]).toEqual({
      kind: 'writer',
      timestamp: '2026-10-05T14:30:00.000Z',
      content: 'Is the dock scene too long?',
      attachments: [],
      bookmarked: true
    });
    expect(JSON.stringify(buildWorkshopTranscriptJsonDocument(transcript()))).not.toContain('bookmarked');
  });

  it('marks bookmarked turns in Markdown', () => {
    const markdown = renderWorkshopTranscriptMarkdown(transcript(BOOKMARKED));

    expect(markdown).toContain('### Writer · Bookmarked\n\nIs the dock scene too long?');
    expect(markdown).toContain('### Jill · Bookmarked\n\nCut.');
    expect(markdown).toContain('### Jill\n\nIt runs a beat long.');
    expect(markdown).toContain('_Bookmarked · Project Resources · notes/dock.md');
    expect(renderWorkshopTranscriptMarkdown(transcript())).not.toContain('Bookmarked');
  });

  it('marks bookmarked turns in HTML with export-only page rules', () => {
    const html = renderWorkshopTranscriptHtml(transcript(BOOKMARKED));

    expect(html.match(/class="pm-ws-export-bookmark"/g)).toHaveLength(3);
    expect(html).toMatch(/aria-label="Writer"><span class="pm-ws-export-bookmark">/);
    expect(html).toMatch(/Jill<\/span><span class="pm-ws-export-bookmark">/);
    expect(WORKSHOP_TRANSCRIPT_HTML_CSS).toContain('.pm-ws-export-bookmark {');
    // The mark's rules are the page's own, not a mirrored thread rule.
    expect(WORKSHOP_TRANSCRIPT_MIRRORED_STYLES.some(({ css }) => css.includes('pm-ws-export-bookmark'))).toBe(false);
    expect(renderWorkshopTranscriptHtml(transcript())).not.toContain('class="pm-ws-export-bookmark"');
  });

  it('marks what the writer bookmarked when the live room is exported, and never names the bookmark', async () => {
    const harness = createWorkshopRouteTestHarness();
    await harness.pin();
    await harness.router.route(message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Is the dock scene too long?' }) as never);
    const reply = harness.session.readRoomLedger().find((turn) => turn.participant === 'host')!;
    await harness.router.route(message(MessageType.WORKSHOP_SET_TURN_BOOKMARK, { turnId: reply.id, bookmarked: true }) as never);
    const [bookmark] = harness.session.getSnapshot().bookmarks;
    await harness.router.route(message(MessageType.WORKSHOP_RENAME_BOOKMARK, { bookmarkId: bookmark.id, label: 'LABEL-SENTINEL' }) as never);

    await harness.router.route(message(MessageType.WORKSHOP_EXPORT_SESSION, { format: 'json', title: 'Dock scene' }) as never);

    const written = harness.transcriptFiles.writeNew.mock.calls[0][2];
    const document = JSON.parse(written);
    expect(document.formatVersion).toBe(1);
    expect(document.entries.filter((entry: { bookmarked?: true }) => entry.bookmarked)).toEqual([
      expect.objectContaining({ kind: 'reply', speaker: 'Jill', bookmarked: true })
    ]);
    expect(written).not.toContain('LABEL-SENTINEL');
    expect(written).not.toContain(bookmark.id);
  });
});
