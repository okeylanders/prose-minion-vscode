import {
  WorkshopTranscriptExportRefusedError,
  WorkshopTranscriptExportService
} from '@/application/services/workshop/export/WorkshopTranscriptExportService';
import { WORKSHOP_SNAPSHOT_TURN_WINDOW } from '@/application/services/workshop/WorkshopSessionService';
import { FIXTURE_EPOCH, fixtureTurn, writerTurn } from '@/__tests__/application/services/workshop/transcript/workshopTranscriptFixtures';

const files = () => ({
  writeNew: jest.fn(async (stem: string, extension: string, _content: string) => ({
    absolutePath: `/workspace/prose-minion/exports/${stem}.${extension}`,
    relativePath: `prose-minion/exports/${stem}.${extension}`
  }))
});

describe('WorkshopTranscriptExportService', () => {
  it('exports the whole ledger, including turns outside the webview snapshot window', async () => {
    const turns = Array.from({ length: WORKSHOP_SNAPSHOT_TURN_WINDOW + 50 }, (_, index) =>
      index % 2 === 0
        ? writerTurn(`u-${index}`, { content: `writer line ${index}` })
        : fixtureTurn(`a-${index}`, { content: `reply line ${index}` })
    );
    const disk = files();
    const service = new WorkshopTranscriptExportService(
      { readRoomLedger: () => turns },
      disk,
      () => FIXTURE_EPOCH
    );

    const result = await service.export({ format: 'json', title: 'Marathon' });

    const document = JSON.parse(disk.writeNew.mock.calls[0][2]);
    expect(result.messageCount).toBe(WORKSHOP_SNAPSHOT_TURN_WINDOW + 50);
    expect(document.entries[0].content).toBe('writer line 0');
    expect(document.entries).toHaveLength(WORKSHOP_SNAPSHOT_TURN_WINDOW + 50);
  });

  it.each([
    ['markdown', 'md', '# Dock scene'],
    ['json', 'json', '"format": "prose-minion.workshop-transcript"'],
    ['html', 'html', '<!doctype html>']
  ] as const)('renders %s to a .%s file', async (format, extension, marker) => {
    const disk = files();
    const service = new WorkshopTranscriptExportService(
      { readRoomLedger: () => [writerTurn('u-1', { content: 'Hello.' })] },
      disk,
      () => FIXTURE_EPOCH
    );

    const result = await service.export({ format, title: '  Dock scene  ' });

    expect(disk.writeNew).toHaveBeenCalledWith('dock-scene', extension, expect.stringContaining(marker));
    expect(result).toEqual({
      format,
      title: 'Dock scene',
      absolutePath: `/workspace/prose-minion/exports/dock-scene.${extension}`,
      relativePath: `prose-minion/exports/dock-scene.${extension}`,
      messageCount: 1
    });
  });

  it('refuses a room whose thread holds only dividers', async () => {
    const service = new WorkshopTranscriptExportService(
      {
        readRoomLedger: () => [fixtureTurn('s-1', {
          role: 'system',
          kind: 'divider',
          participant: 'session',
          artifact: 'session_start',
          content: 'Session started'
        })]
      },
      files()
    );

    await expect(service.export({ format: 'markdown', title: 'Empty' }))
      .rejects.toBeInstanceOf(WorkshopTranscriptExportRefusedError);
  });
});
