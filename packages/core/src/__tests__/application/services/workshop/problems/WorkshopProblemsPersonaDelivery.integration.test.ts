import { createRecallRunHarness, recallCall } from '@/__tests__/application/services/workshop/recall/workshopRecallRunHarness';
import type { WorkshopProblemRow, WorkshopProblemsPorts } from '@/application/services/workshop/problems/WorkshopProblemsPort';
import { projectWorkshopTranscriptTurn } from '@/application/services/workshop/transcript/WorkshopTranscript';

const pinnedSource = { kind: 'file', sourceUri: 'file:///previous-location/chapter.md', relativePath: 'chapter.md' } as const;
const authorizedPath = '/current-project/drafts/chapter.md';
const hostNote = 'Jill · Echoes: Quieted footfall.';
const guestNote = 'Revised punctuation from the language server.';
const bufferQuote = 'Their footsteps fell into step.';
const readExcerpt = recallCall('problems.read', '<group>excerpt</group>');
const location = { startLine: 9, startColumn: 3, endLine: 9, endColumn: 34 };

// Each call sees what this editor currently publishes at the resolved path.
const fixture = () => {
  const authorizeExcerptReread = jest.fn(async () => ({
    kind: 'authorized' as const, fsPath: authorizedPath, source: pinnedSource
  }));
  let published: WorkshopProblemRow[] = [
    { ...location, source: 'Prose Minion', severity: 'information', message: hostNote, quote: bufferQuote }
  ];
  const read = jest.fn(async (path: string, start: number) => {
    if (path !== authorizedPath) {
      throw new Error('Unexpected file');
    }
    return { total: published.length, problems: published.slice(start - 1) };
  });
  const problems: WorkshopProblemsPorts = { intake: { authorizeExcerptReread }, reader: { read } };
  const room = createRecallRunHarness({ problems });
  return { room, authorizeExcerptReread, read, publish: (rows: WorkshopProblemRow[]) => { published = rows; } };
};

describe('Problems from the file to the invoking Workshop persona', () => {
  it('delivers current evidence privately through XML and native calls and saves the counts for each read', async () => {
    const { room, authorizeExcerptReread, read, publish } = fixture();
    try {
      await room.coordinator.initialize();
      room.session.setExcerpt({ text: 'Earlier pinned version.', source: pinnedSource });

      const hostReply = await room.host('host-read', 'Read the file Problems.', [
        readExcerpt,
        'I checked the annotations.'
      ]);
      expect(hostReply.content).toBe('I checked the annotations.');
      expect(room.sent).toHaveLength(2);
      expect(room.sent[0]).not.toContain(hostNote);
      for (const field of [hostNote, bufferQuote, 'Prose Minion', 'information']) {
        expect(room.sent[1]).toContain(field);
      }
      const evidence = room.client.createChatCompletion.mock.calls.at(-1)![0].at(-1).content;
      for (const [field, value] of Object.entries(location)) {
        expect(evidence).toContain(`"${field}":${value}`);
      }
      expect(authorizeExcerptReread).toHaveBeenCalledWith(pinnedSource);
      expect(read.mock.calls).toEqual([[authorizedPath, 1]]);

      // A different publisher now owns the only mark. A guest gets a fresh query.
      publish([{ ...location, source: 'Grammar Server', severity: 'warning', message: guestNote }]);
      const coldGuest = room.delivery.prepareJoinSnapshot({ kind: 'personaGuest', personaId: 'margot' }, '');
      expect(coldGuest.map(turn => turn.id)).toContain(hostReply.id);
      expect(JSON.stringify(coldGuest)).not.toContain(hostNote);
      expect(JSON.stringify(coldGuest)).not.toContain(bufferQuote);

      const guestReply = await room.join('margot', 'guest-read', 'What is marked now?', [
        { toolCalls: [{ name: 'problems_read', arguments: JSON.stringify({ group: 'excerpt', start: 1 }) }] },
        'I checked the current file.'
      ]);
      expect(guestReply.content).toBe('I checked the current file.');
      expect(room.sent).toHaveLength(4);
      expect(room.sent[2]).not.toContain(guestNote);
      expect(room.sent[3]).toContain(guestNote);
      expect(room.sent[3]).toContain('Grammar Server');
      expect(room.sent[3]).not.toContain(hostNote);
      expect(read.mock.calls).toEqual([[authorizedPath, 1], [authorizedPath, 1]]);

      const hostCatchUp = room.delivery.prepare({ kind: 'host' });
      expect(hostCatchUp.frame).toContain(guestReply.content);
      expect(hostCatchUp.frame).not.toContain(guestNote);

      const saved = await room.coordinator.saveNamed('Current file Problems');
      const checkpoint = await room.store.readNamed(saved.sessionId);
      const turns = checkpoint!.workshop.turns;
      const receipts = turns.filter(turn => turn.capability?.operation === 'problems.read');
      expect(receipts.map(turn => turn.capability?.invokedBy)).toEqual([
        { kind: 'host' }, { kind: 'personaGuest', personaId: 'margot' }
      ]);
      for (const receipt of receipts) {
        expect(receipt).toMatchObject({
          artifact: 'problems_read', toolLabel: 'File Problems', content: 'Read 1 of 1 problem.',
          capability: { status: 'success', requestSummary: '1 of 1 problem' }
        });
        expect(receipt.capability?.metadata).toEqual({ diagnosticCount: 1, shownCount: 1 });
      }
      const transcript = JSON.stringify(turns.map(projectWorkshopTranscriptTurn));
      const logs = (room.log.appendLine as jest.Mock).mock.calls.flat().join('\n');
      for (const output of [JSON.stringify(turns), transcript, logs]) {
        for (const privateText of [hostNote, bufferQuote, guestNote]) {
          expect(output).not.toContain(privateText);
        }
      }
    } finally {
      room.dispose();
    }
  });

  it('rereads the file after Problems are cleared during a retained conversation', async () => {
    const { room, read, publish } = fixture();
    try {
      await room.coordinator.initialize();
      room.session.setExcerpt({ text: 'Earlier pinned version.', source: pinnedSource });
      await room.host('first', 'What is marked?', [readExcerpt, 'There is one annotation.']);
      publish([]);
      await room.host('later', 'Check again.', [readExcerpt, 'There are no annotations now.']);

      // This persona can remember its earlier read. The latest result describes the empty live snapshot.
      const latest = room.client.createChatCompletion.mock.calls.at(-1)![0].at(-1).content;
      expect(latest).toContain('no currently published Problems');
      expect(latest).not.toContain(hostNote);
      expect(latest).not.toContain(bufferQuote);
      expect(read.mock.calls).toEqual([[authorizedPath, 1], [authorizedPath, 1]]);
      const cards = room.session.readRoomLedger().filter(turn => turn.capability?.operation === 'problems.read');
      expect(cards.map(turn => turn.capability?.metadata)).toEqual([
        { diagnosticCount: 1, shownCount: 1 }, { diagnosticCount: 0, shownCount: 0 }
      ]);
    } finally {
      room.dispose();
    }
  });
});
