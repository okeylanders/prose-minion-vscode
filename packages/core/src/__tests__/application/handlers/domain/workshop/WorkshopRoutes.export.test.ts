import { MessageType, WorkshopSessionActionResultMessage } from '@messages';
import {
  createWorkshopRouteTestHarness,
  message
} from './WorkshopRouteTestHarness';
import type { WorkshopRouteTestHarness } from './WorkshopRouteTestHarness';

describe('Workshop composed routing — transcript export', () => {
  let harness: WorkshopRouteTestHarness;

  const exportResults = () =>
    harness.posted(MessageType.WORKSHOP_SESSION_ACTION_RESULT)
      .map((entry) => (entry as WorkshopSessionActionResultMessage).payload)
      .filter((payload) => payload.action === 'export');

  const exportAs = (payload: unknown) =>
    harness.router.route(message(MessageType.WORKSHOP_EXPORT_SESSION, payload) as never);

  const holdConversation = async () => {
    await harness.pin();
    await harness.router.route(
      message(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Is the dock scene too long?' }) as never
    );
  };

  beforeEach(() => {
    harness = createWorkshopRouteTestHarness();
  });

  it('writes the full ledger as Markdown, opens it in the editor, and reports the path', async () => {
    await holdConversation();

    await exportAs({ format: 'markdown', title: 'Dock scene' });

    expect(harness.transcriptFiles.writeNew).toHaveBeenCalledTimes(1);
    const [stem, extension, content] = harness.transcriptFiles.writeNew.mock.calls[0];
    expect([stem, extension]).toEqual(['dock-scene', 'md']);
    expect(content).toContain('# Dock scene');
    expect(content).toContain('### Writer\n\nIs the dock scene too long?');
    expect(content).not.toContain('A pinned excerpt.');
    expect(harness.shell.openFileInEditor).toHaveBeenCalledWith(
      '/workspace/prose-minion/exports/dock-scene.md'
    );
    expect(exportResults()).toEqual([{
      action: 'export',
      ok: true,
      message: 'Exported “Dock scene” as Markdown to prose-minion/exports/dock-scene.md.'
    }]);
  });

  it('opens a styled HTML export in the default application instead of the editor', async () => {
    const openFileInDefaultApp = jest.fn().mockResolvedValue(undefined);
    harness.shell.openFileInDefaultApp = openFileInDefaultApp;
    await holdConversation();

    await exportAs({ format: 'html', title: 'Dock scene' });

    expect(harness.transcriptFiles.writeNew.mock.calls[0][1]).toBe('html');
    expect(harness.transcriptFiles.writeNew.mock.calls[0][2]).toContain('<body data-pm-surface="workshop">');
    expect(openFileInDefaultApp).toHaveBeenCalledWith('/workspace/prose-minion/exports/dock-scene.html');
    expect(harness.shell.openFileInEditor).not.toHaveBeenCalled();
    expect(exportResults()[0]).toMatchObject({ ok: true });
  });

  it('still reports success when the host cannot open the written file', async () => {
    harness.shell.openFileInEditor = jest.fn().mockRejectedValue(new Error('no editor'));
    await holdConversation();

    await exportAs({ format: 'json', title: 'Dock scene' });

    expect(exportResults()[0]).toMatchObject({ ok: true });
    expect(harness.log.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('Exported but could not open')
    );
  });

  it('refuses an empty room without writing anything', async () => {
    await exportAs({ format: 'markdown', title: 'Nothing yet' });

    expect(harness.transcriptFiles.writeNew).not.toHaveBeenCalled();
    expect(exportResults()).toEqual([{
      action: 'export',
      ok: false,
      message: 'There are no messages in this session to export yet.'
    }]);
  });

  it.each([
    [{ format: 'pdf', title: 'Dock scene' }, 'Choose Markdown, JSON, or styled HTML for the export.'],
    [{ format: 'markdown', title: '   ' }, 'Name the export before saving it.'],
    [{ format: 'markdown', title: 'x'.repeat(161) }, 'Keep the export name under 160 characters.'],
    [undefined, 'Choose Markdown, JSON, or styled HTML for the export.']
  ])('refuses a malformed request %#', async (payload, refusal) => {
    await holdConversation();

    await exportAs(payload);

    expect(harness.transcriptFiles.writeNew).not.toHaveBeenCalled();
    expect(exportResults()).toEqual([{ action: 'export', ok: false, message: refusal }]);
  });

  it('waits out a room replacement rather than export a room mid-swap', async () => {
    await holdConversation();
    harness.persistence.isSessionOperationPending.mockReturnValue(true);

    await exportAs({ format: 'markdown', title: 'Dock scene' });

    expect(harness.transcriptFiles.writeNew).not.toHaveBeenCalled();
    expect(exportResults()).toEqual([{
      action: 'export',
      ok: false,
      message: 'Wait for the current session change to finish before exporting.'
    }]);
  });

  it('surfaces a disk failure as the action result', async () => {
    harness.transcriptFiles.writeNew.mockRejectedValueOnce(
      new Error('Open a workspace folder before exporting a Workshop transcript.')
    );
    await holdConversation();

    await exportAs({ format: 'markdown', title: 'Dock scene' });

    expect(exportResults()).toEqual([{
      action: 'export',
      ok: false,
      message: 'Open a workspace folder before exporting a Workshop transcript.'
    }]);
  });
});
