import { FileType } from '@/platform';
import {
  MessageType
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  message,
  createWorkshopHandlerTestHarness
} from './WorkshopHandlerTestHarness';
import type { WorkshopHandlerTestHarness } from './WorkshopHandlerTestHarness';

describe('WorkshopHandler routing — context owner', () => {
  let session: WorkshopHandlerTestHarness['session'];
  let log: WorkshopHandlerTestHarness['log'];
  let service: WorkshopHandlerTestHarness['service'];
  let contextAssistant: WorkshopHandlerTestHarness['contextAssistant'];
  let shell: WorkshopHandlerTestHarness['shell'];
  let fileSystem: WorkshopHandlerTestHarness['fileSystem'];
  let workspace: WorkshopHandlerTestHarness['workspace'];
  let router: WorkshopHandlerTestHarness['router'];
  let resourceFiles: WorkshopHandlerTestHarness['resourceFiles'];
  let resourceProviderFactory: WorkshopHandlerTestHarness['resourceProviderFactory'];
  let posted: WorkshopHandlerTestHarness['posted'];
  let pin: WorkshopHandlerTestHarness['pin'];
  let runProse: WorkshopHandlerTestHarness['runProse'];

  beforeEach(() => {
    ({
      session,
      log,
      service,
      contextAssistant,
      shell,
      fileSystem,
      workspace,
      router,
      resourceFiles,
      resourceProviderFactory,
      posted,
      pin,
      runProse
    } = createWorkshopHandlerTestHarness());
  });

  it('rejects an over-budget text note at attach time — nothing over-budget reaches a tool pass', async () => {
    await pin();
    const longNote = Array.from(
      { length: PROMPT_BUDGETS.contextAttachments.words + 1 },
      (_, index) => `note${index}`
    ).join(' ');
    await router.route(message(
      MessageType.WORKSHOP_ADD_CONTEXT_TEXT,
      { text: longNote }
    ) as any);

    expect(posted(MessageType.ERROR).at(-1).payload.message).toMatch(/won.t fit/i);
    expect(session.getContextAttachments()).toEqual([]);

    await runProse();
    expect(service.analyzeProse.mock.calls[0][1]).not.toContain('note0');
  });

  describe('Context Selector routes (Sprint 12 Phase 4)', () => {
    it('posts the display-safe configured catalog', async () => {
      await router.route(
        message(MessageType.WORKSHOP_REQUEST_CONTEXT_CATALOG, {}) as any
      );

      const catalog = posted(MessageType.WORKSHOP_CONTEXT_CATALOG).at(-1).payload;
      expect(catalog.entries).toEqual([
        { group: 'characters', path: 'Characters/raven.md', label: 'raven', sizeBytes: 120 },
        { group: 'themes', path: 'Themes/echoes.md', label: 'echoes', sizeBytes: 80 }
      ]);
      expect(JSON.stringify(catalog)).not.toContain('content');
    });

    it('content-searches under bounds and returns canonical refs', async () => {
      await router.route(
        message(MessageType.WORKSHOP_SEARCH_CONTEXT_RESOURCES, { query: 'marked token' }) as any
      );

      const results = posted(MessageType.WORKSHOP_CONTEXT_SEARCH_RESULTS).at(-1).payload;
      expect(results.matches).toEqual([{ group: 'characters', path: 'Characters/raven.md' }]);
      expect(results.bounded).toBe(false);
    });

    it('attaches selected resources with configuredResource provenance and blocks duplicates', async () => {
      const add = () => router.route(message(
        MessageType.WORKSHOP_ADD_CONTEXT_RESOURCES,
        { items: [{ group: 'characters', path: 'Characters/raven.md' }] }
      ) as any);

      await add();
      expect(session.getContextAttachments()).toEqual([
        expect.objectContaining({
          kind: 'file',
          label: 'raven.md',
          relativePath: 'Characters/raven.md',
          configuredResource: { group: 'characters', path: 'Characters/raven.md' }
        })
      ]);

      await add();
      expect(posted(MessageType.ERROR).at(-1).payload.message).toMatch(/already attached/i);
      expect(session.getContextAttachments()).toHaveLength(1);
    });

    it('rejects an oversized configured resource before loading it', async () => {
      resourceFiles[0].sizeBytes = PROMPT_BUDGETS.contextAttachments.fileBytes + 1;

      await router.route(message(
        MessageType.WORKSHOP_ADD_CONTEXT_RESOURCES,
        { items: [{ group: 'characters', path: 'Characters/raven.md' }] }
      ) as any);

      expect(session.getContextAttachments()).toEqual([]);
      expect(posted(MessageType.ERROR).at(-1).payload.message).toMatch(/too large to attach safely/i);
    });

    it('rejects unknown or malformed resource requests without attaching', async () => {
      await router.route(message(
        MessageType.WORKSHOP_ADD_CONTEXT_RESOURCES,
        { items: [{ group: 'characters', path: 'Characters/ghost.md' }, { group: 'nope', path: 'x' }] }
      ) as any);

      expect(session.getContextAttachments()).toEqual([]);
      expect(posted(MessageType.ERROR).at(-1).payload.message).toMatch(/no longer in the configured catalog/i);
    });
  });

  describe('Context wizard (Sprint 12 Phase 5)', () => {
    const runWizard = () =>
      router.route(message(MessageType.WORKSHOP_RUN_CONTEXT_WIZARD, {}) as any);

    it('requires an excerpt before it will read the project', async () => {
      await runWizard();
      expect(contextAssistant.generateContext).not.toHaveBeenCalled();
      expect(posted(MessageType.ERROR).at(-1).payload.message).toMatch(/set an excerpt first/i);
    });

    it('runs under its own streaming domain and lands results as wizard-tagged attachments', async () => {
      await pin();
      await runWizard();

      const started = posted(MessageType.STREAM_STARTED).at(-1).payload;
      const complete = posted(MessageType.STREAM_COMPLETE).at(-1).payload;
      expect(started.domain).toBe('workshop-context');
      expect(complete).toMatchObject({ domain: 'workshop-context', cancelled: false });

      const attachments = session.getContextAttachments();
      expect(attachments).toEqual([
        expect.objectContaining({ kind: 'text', origin: 'wizard', label: 'Wizard brief\u2026' }),
        expect.objectContaining({
          kind: 'file',
          origin: 'wizard',
          label: 'raven.md',
          configuredResource: { group: 'characters', path: 'Characters/raven.md' }
        })
      ]);
      expect(contextAssistant.generateContext).toHaveBeenCalledWith(
        expect.objectContaining({
          excerpt: 'A pinned excerpt.',
          sourceFileUri: 'file:///chapter-one.md'
        }),
        expect.objectContaining({ signal: expect.anything() })
      );
    });

    it('refuses a second run while one is in flight and reports a failed first run', async () => {
      await pin();
      let reject!: (reason: unknown) => void;
      contextAssistant.generateContext.mockReturnValueOnce(
        new Promise((_resolve, rejectRun) => { reject = rejectRun; })
      );

      const first = runWizard();
      await Promise.resolve();
      await runWizard();
      expect(posted(MessageType.ERROR).at(-1).payload.message).toMatch(/already running/i);

      reject(new Error('wizard provider failed'));
      await first;
      expect(posted(MessageType.ERROR).at(-1).payload.message).toMatch(/wizard failed/i);
    });

    it('attaches the brief FIRST so raw files never win the budget race', async () => {
      await pin();
      // A near-full budget: room for the 40-word brief, not the 8-word file.
      session.addContextAttachment({
        kind: 'text',
        origin: 'writer',
        label: 'Big note\u2026',
        words: PROMPT_BUDGETS.contextAttachments.words - 45,
        content: 'x'
      });
      contextAssistant.generateContext.mockResolvedValueOnce({
        toolName: 'context_assistant',
        content: Array.from({ length: 40 }, (_, index) => `brief${index}`).join(' '),
        timestamp: new Date(0),
        requestedResources: ['Characters/raven.md']
      });

      await runWizard();

      const labels = session.getContextAttachments().map((entry) => entry.label);
      expect(labels).toContain('Wizard brief\u2026');
      expect(labels).not.toContain('raven.md');
      expect(posted(MessageType.STATUS).at(-1).payload.message).toMatch(/1 didn.t fit/i);
    });

    it('says so when nothing fits instead of silently attaching nothing', async () => {
      await pin();
      contextAssistant.generateContext.mockResolvedValueOnce({
        toolName: 'context_assistant',
        content: '   ',
        timestamp: new Date(0),
        requestedResources: ['Characters/ghost.md']
      });

      await runWizard();

      expect(session.getContextAttachments()).toEqual([]);
      expect(posted(MessageType.STATUS).at(-1).payload.message).toMatch(/nothing new fit/i);
    });

    it('records resource-load failures and tells the writer they were not budget skips', async () => {
      await pin();
      contextAssistant.generateContext.mockResolvedValueOnce({
        toolName: 'context_assistant',
        content: 'Wizard brief body.',
        timestamp: new Date(0),
        requestedResources: ['Characters/raven.md']
      });
      resourceProviderFactory.createProvider.mockRejectedValueOnce(new Error('workspace unavailable'));

      await runWizard();

      expect(log.appendLine).toHaveBeenCalledWith(expect.stringMatching(/workspace unavailable/));
      expect(posted(MessageType.STATUS).at(-1).payload.message).toMatch(/couldn.t be loaded/i);
    });

    it('rejects an oversized wizard-requested resource before loading it', async () => {
      await pin();
      resourceFiles[0].sizeBytes = PROMPT_BUDGETS.contextAttachments.fileBytes + 1;

      await runWizard();

      expect(session.getContextAttachments()).toEqual([
        expect.objectContaining({ kind: 'text', origin: 'wizard', label: 'Wizard brief\u2026' })
      ]);
      expect(posted(MessageType.ERROR).at(-1).payload.message).toMatch(/too large to attach safely/i);
    });
  });

  describe('message attachments — one-shot thread-artifacts (Phase 6B)', () => {
    const attachRaven = () => router.route(message(
      MessageType.WORKSHOP_ATTACH_MESSAGE_RESOURCES,
      { items: [{ group: 'characters', path: 'Characters/raven.md' }] }
    ) as any);

    it('stages a configured resource with a ta-N id and a display-safe snapshot', async () => {
      await attachRaven();

      const pending = session.getSnapshot().pendingMessageAttachments;
      expect(pending).toHaveLength(1);
      expect(pending[0]).toMatchObject({
        id: 'ta-1',
        label: 'raven.md',
        configuredResource: { group: 'characters', path: 'Characters/raven.md' }
      });
      expect(pending[0]).not.toHaveProperty('content');
      expect(pending[0]).not.toHaveProperty('sourceUri');
    });

    it('rejects an oversized configured resource before staging a message attachment', async () => {
      resourceFiles[0].sizeBytes = PROMPT_BUDGETS.contextAttachments.fileBytes + 1;

      await attachRaven();

      expect(session.getSnapshot().pendingMessageAttachments).toEqual([]);
      expect(posted(MessageType.ERROR).at(-1).payload.message).toMatch(/too large to attach safely/i);
    });

    it('enforces the per-message item cap and the duplicate guard at staging time', async () => {
      resourceFiles.push(
        { group: 'themes', path: 'Themes/water.md', label: 'water', sizeBytes: 40, absolutePath: '/ws/Themes/water.md', content: 'Water motif.' },
        { group: 'themes', path: 'Themes/fire.md', label: 'fire', sizeBytes: 40, absolutePath: '/ws/Themes/fire.md', content: 'Fire motif.' }
      );

      await router.route(message(
        MessageType.WORKSHOP_ATTACH_MESSAGE_RESOURCES,
        {
          items: [
            { group: 'characters', path: 'Characters/raven.md' },
            { group: 'themes', path: 'Themes/echoes.md' },
            { group: 'themes', path: 'Themes/water.md' },
            { group: 'themes', path: 'Themes/fire.md' }
          ]
        }
      ) as any);
      expect(session.getSnapshot().pendingMessageAttachments).toHaveLength(3);
      expect(posted(MessageType.ERROR).at(-1).payload.message).toMatch(/at most 3/);

      await attachRaven();
      expect(posted(MessageType.ERROR).at(-1).payload.message).toMatch(/already attached/);
    });

    it('removes a staged artifact by id', async () => {
      await attachRaven();

      await router.route(message(
        MessageType.WORKSHOP_REMOVE_MESSAGE_ATTACHMENT,
        { id: 'ta-1' }
      ) as any);

      expect(session.getSnapshot().pendingMessageAttachments).toHaveLength(0);
    });
  });

  describe('Open Chat (Sprint 13A)', () => {
    const chooseOpen = () => router.route(
      message(MessageType.WORKSHOP_SET_SESSION_SCOPE, { scope: 'open' }) as any
    );

    const send = (text: string) => router.route(
      message(MessageType.WORKSHOP_SEND_MESSAGE, { text }) as any
    );

    const attachAvaFile = async () => {
      const content = 'Ava keeps watch at the door.';
      shell.pickFile = jest.fn().mockResolvedValue({
        fsPath: '/ws/Characters/ava.md',
        uri: 'file:///ws/Characters/ava.md'
      });
      fileSystem.stat = jest.fn().mockResolvedValue({ type: FileType.File, size: content.length });
      fileSystem.readFile = jest.fn().mockResolvedValue(new TextEncoder().encode(content));
      await router.route(message(MessageType.WORKSHOP_ADD_CONTEXT_FILE, {}) as any);
    };

    it('names a text note from its first line rather than a placeholder', async () => {
      await chooseOpen();
      await router.route(message(
        MessageType.WORKSHOP_ADD_CONTEXT_TEXT,
        { text: '# Kayla — running notes\n\nShe does not believe it.' }
      ) as any);

      expect(session.getSnapshot().contextAttachments[0].label).toBe('Kayla — running notes');
    });

    it('serves one attachment body on request instead of every snapshot', async () => {
      await chooseOpen();
      await router.route(message(
        MessageType.WORKSHOP_ADD_CONTEXT_TEXT,
        { text: 'Kayla picks at her cuff.' }
      ) as any);
      await router.route(message(
        MessageType.WORKSHOP_REQUEST_CONTEXT_ATTACHMENT,
        { id: 'ctx-1' }
      ) as any);

      expect(posted(MessageType.WORKSHOP_CONTEXT_ATTACHMENT_CONTENT).at(-1)?.payload).toEqual({
        id: 'ctx-1',
        content: 'Kayla picks at her cuff.',
        canOpenInEditor: false
      });
    });

    it('answers a request for a removed attachment with a reason, not silence', async () => {
      await chooseOpen();
      await router.route(message(
        MessageType.WORKSHOP_REQUEST_CONTEXT_ATTACHMENT,
        { id: 'ctx-9' }
      ) as any);

      expect(posted(MessageType.WORKSHOP_CONTEXT_ATTACHMENT_CONTENT).at(-1)?.payload)
        .toMatchObject({ id: 'ctx-9', canOpenInEditor: false, error: expect.any(String) });
    });

    it('saves a sheet edit and tells the room it happened', async () => {
      await chooseOpen();
      await router.route(message(
        MessageType.WORKSHOP_ADD_CONTEXT_TEXT,
        { text: '# Kayla\n\nFirst pass.' }
      ) as any);
      await send('Hold that thought.');
      await router.route(message(
        MessageType.WORKSHOP_UPDATE_CONTEXT_TEXT,
        { id: 'ctx-1', text: '# Kayla — revised\n\nSecond pass.' }
      ) as any);

      expect(session.getContextAttachment('ctx-1')).toMatchObject({
        label: 'Kayla — revised',
        content: '# Kayla — revised\n\nSecond pass.'
      });
      expect(session.getSnapshot().turns.at(-1)).toMatchObject({
        artifact: 'context_change',
        content: expect.stringContaining('Edited context: Kayla — revised')
      });
    });

    it('refuses to edit a project file’s session copy, and says why', async () => {
      await chooseOpen();
      await attachAvaFile();
      await router.route(message(
        MessageType.WORKSHOP_UPDATE_CONTEXT_TEXT,
        { id: 'ctx-1', text: 'Rewritten.' }
      ) as any);

      expect(session.getContextAttachment('ctx-1')?.content).not.toBe('Rewritten.');
      expect(posted(MessageType.ERROR).at(-1)?.payload.message)
        .toContain('stay in sync with the file on disk');
    });

    it('opens a file-backed attachment through the ShellService port', async () => {
      await chooseOpen();
      await attachAvaFile();
      await router.route(message(
        MessageType.WORKSHOP_OPEN_CONTEXT_ATTACHMENT_FILE,
        { id: 'ctx-1' }
      ) as any);

      expect(shell.openFileInEditor).toHaveBeenCalledWith(
        '/ws/Characters/ava.md',
        { beside: true }
      );
    });

    it('explains that a typed note has no file to open', async () => {
      await chooseOpen();
      await router.route(message(
        MessageType.WORKSHOP_ADD_CONTEXT_TEXT,
        { text: 'Kayla picks at her cuff.' }
      ) as any);
      await router.route(message(
        MessageType.WORKSHOP_OPEN_CONTEXT_ATTACHMENT_FILE,
        { id: 'ctx-1' }
      ) as any);

      expect(shell.openFileInEditor).not.toHaveBeenCalled();
      expect(posted(MessageType.ERROR).at(-1)?.payload.message).toContain('has no file to open');
    });
  });
});
