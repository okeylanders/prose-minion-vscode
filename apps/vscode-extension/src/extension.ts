/**
 * Extension entry point
 * Follows Clean Architecture principles:
 * - Dependency injection for services
 * - Separation of concerns
 * - Clear boundaries between layers
 */

/**
 * SPRINT 05 REFACTOR: ProseAnalysisService facade removed
 * Services now injected directly into ProseToolsViewProvider
 */

import * as vscode from 'vscode';
import * as path from 'node:path';
import { ProseToolsViewProvider } from './application/providers/ProseToolsViewProvider';
import { WorkshopPanelProvider } from './application/providers/WorkshopPanelProvider';
import { LightboxPanelProvider } from './application/providers/LightboxPanelProvider';
// Core services + the Platform port type — imported via the public barrel only
// (ADR 2026-06-16 monorepo boundary; enforced by eslint no-restricted-imports).
import {
  Platform,
  SecretStorageService,
  ResourceLoaderService,
  AIResourceManager,
  AIResourceRefresh,
  StandardsService,
  ToolOptionsProvider,
  ProseStatsService,
  StyleFlagsService,
  WordFrequencyService,
  AssistantToolService,
  DictionaryService,
  DictionaryHistoryStore,
  ContextAssistantService,
  WordSearchService,
  CategorySearchService,
  TextSourceResolver,
  ContextResourceResolver,
  AccountBalanceService,
  OpenRouterAccountClient,
  WorkshopSessionService,
  WorkshopRoomDeliveryService,
  RunWorkshopToolSidePass,
  WorkshopAnalysisSidePass,
  WorkshopPersonaCapabilityFactory,
  WorkshopContextIntakeService,
  WorkshopConversationSettingsService,
  WorkshopWriterProfileService,
  WorkshopSessionTimeService,
  WorkshopSessionStore,
  WorkshopSessionPersistenceCoordinator,
  WorkshopTranscriptRecallService,
  WorkshopTranscriptExportService,
  WorkshopTranscriptExportStore,
  GesturePlaygroundService,
  CreativeVariationsService,
  ShowVsTellService,
  LexicalGravityModelService,
  LexicalGravityLensRepository,
  RejectedModelResponseRecoveryStore,
  RejectedModelResponseRecoveryShellPresenter,
  WorkshopStandingDirectiveService,
  LightboxService,
  LightboxReadingRunner,
  LightboxContextShelf,
  LightboxWriterBaseline,
  LightboxBoardStore,
  LightboxBoardLibrary,
  ProofreadService,
  DraftEditUseCase,
  DraftEditApplier,
  CraftFlagsService,
  CraftFlagsUseCase,
  liveCatalogPrices,
  liveCatalogReasoning,
  LightboxSetSourcePayload,
  CoreServices,
  WORKSHOP_CONVERSATION_BEHAVIOR_SETTING,
  WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION,
  coerceWorkshopConversationBehavior,
  toInclusiveLineRange,
} from '@prose-minion/core';
// VS Code adapters (app-local; the composition root wires them into the ports)
import { VsCodeSettingsStore } from './platform/vscode/VsCodeSettingsStore';
import { VsCodeFileSystem } from './platform/vscode/VsCodeFileSystem';
import { VsCodeWorkspace } from './platform/vscode/VsCodeWorkspace';
import { VsCodeShellService } from './platform/vscode/VsCodeShellService';
import { VsCodeEditorContext } from './platform/vscode/VsCodeEditorContext';
import { VsCodeDocumentEditor } from './platform/vscode/VsCodeDocumentEditor';
import { CRAFT_FLAGS, VsCodeIssueAnnotator } from './platform/vscode/VsCodeIssueAnnotator';
import { OpenFileInLightboxHost, openFileInLightbox } from './application/commands/openFileInLightbox';
import { shutDownExtension, type ExtensionShutdownParts } from './application/extensionShutdown';
import {
  PROOFREAD_CLEAR_COMMAND,
  PROOFREAD_DISMISS_COMMAND,
  PROOFREAD_FIX_ALL_COMMAND,
  PROOFREAD_FIX_COMMAND,
  PROOFREAD_FLAG_COMMAND,
  PROOFREAD_REPLACE_COMMAND,
  ProofreadCommandHost,
  ProofreadEditorSnapshot,
  clearProofreadFlags,
  dismissProofreadIssue,
  fixAllProofreadIssues,
  proofreadAndFix,
  proofreadAndFlag,
  replaceProofreadIssue
} from './application/commands/proofreadCommands';
import {
  CRAFT_FLAGS_CLEAR_COMMAND,
  CRAFT_FLAGS_COMMAND,
  CRAFT_FLAGS_DISMISS_COMMAND,
  clearCraftFlags,
  dismissCraftFlag,
  runCraftFlags,
  type CraftFlagsCommandHost
} from './application/commands/craftFlagsCommands';

let proseToolsViewProvider: ProseToolsViewProvider | undefined;
let workshopPanelProvider: WorkshopPanelProvider | undefined;
let lightboxPanelProvider: LightboxPanelProvider | undefined;
let workshopSessionPersistenceCoordinator: WorkshopSessionPersistenceCoordinator | undefined;
let lightboxBoardLibrary: LightboxBoardLibrary | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Create output channel for logging
  const outputChannel = vscode.window.createOutputChannel('Prose Minion');
  context.subscriptions.push(outputChannel);

  const extensionInfo = context.extension.packageJSON as { version: string };

  outputChannel.appendLine('=== Prose Minion Extension Activated ===');
  outputChannel.appendLine(`>>> Version ${extensionInfo.version} <<<`);
  outputChannel.appendLine(`Extension URI: ${context.extensionUri.fsPath}`);

  // vscode.window.showInformationMessage('Prose Minion extension activated!');

  // Platform ports (ADR 2026-06-16). Assembled once at the composition root: the
  // VS Code adapters translate to the vscode-free port shapes; the structural
  // ports (log, secrets) are the native vscode objects passed directly.
  const editorContext = new VsCodeEditorContext();
  context.subscriptions.push(editorContext);
  // Draft Edit's flags (ADR 2026-10-21 D7): diagnostics whose code actions call back into the commands below.
  const issueAnnotator = new VsCodeIssueAnnotator({
    dismiss: PROOFREAD_DISMISS_COMMAND,
    clear: PROOFREAD_CLEAR_COMMAND,
    replace: PROOFREAD_REPLACE_COMMAND,
    fixAll: PROOFREAD_FIX_ALL_COMMAND
  });
  context.subscriptions.push(issueAnnotator);
  // Craft Flags' own flags (Slice 3c): a second collection and source, with Dismiss and Clear only.
  const craftAnnotator = new VsCodeIssueAnnotator({ dismiss: CRAFT_FLAGS_DISMISS_COMMAND, clear: CRAFT_FLAGS_CLEAR_COMMAND }, CRAFT_FLAGS);
  context.subscriptions.push(craftAnnotator);
  // Draft Edit's runs follow their open document's edits, and end when it closes (PR #171 F-03, F-04);
  // a review held when its document closes is logged, since VS Code gives no way to end it (PR #172 F-02, F-06).
  const documentEditor = new VsCodeDocumentEditor(outputChannel);
  context.subscriptions.push(documentEditor);
  const platform: Platform = {
    log: outputChannel,
    secrets: context.secrets,
    settings: new VsCodeSettingsStore(),
    globalState: context.globalState,
    fileSystem: new VsCodeFileSystem(),
    workspace: new VsCodeWorkspace(context.extensionUri),
    shell: new VsCodeShellService(),
    editor: editorContext,
    documents: documentEditor,
    annotations: issueAnnotator,
    craftAnnotations: craftAnnotator
  };

  // SPRINT 01: Initialize infrastructure layer (dependency injection)
  const secretsService = new SecretStorageService(platform.secrets);

  // SPRINT 01: Create resource services (foundation)
  const resourceLoader = new ResourceLoaderService(platform.workspace.extensionPath, platform.fileSystem, outputChannel);
  // Built before the AI resource manager: the Workshop composite tool catalog
  // (Sprint 12 Phase 6) resolves configured resources through this factory.
  const contextResourceResolver = new ContextResourceResolver(
    platform.settings,
    platform.fileSystem,
    platform.workspace,
    outputChannel
  );
  const aiResourceManager = new AIResourceManager(resourceLoader, secretsService, platform.settings, contextResourceResolver, outputChannel);
  // Lifecycle starts once at the composition root. Services only bind to the
  // manager-owned generation; none may rebuild all model scopes on startup.
  // Fire-and-forget, but never unobserved: the manager resets on rejection
  // and the next use retries, so this log is the only trace of a bad start.
  aiResourceManager.ensureInitialized().catch(error => {
    outputChannel.appendLine(`[extension] Initial AI resource build failed: ${error instanceof Error ? error.message : String(error)}`);
  });
  // The manager's key and model subscriptions live as long as the extension,
  // not a webview: the Proofread command uses it with none open (PR #171 F-01).
  const aiResourceRefresh = new AIResourceRefresh(aiResourceManager, secretsService, platform.settings, outputChannel);
  context.subscriptions.push(
    aiResourceRefresh,
    vscode.workspace.onDidChangeConfiguration(event => aiResourceRefresh.handleConfigurationChange(section => event.affectsConfiguration(section)))
  );
  const standardsService = new StandardsService(platform.workspace.extensionPath, platform.fileSystem, platform.settings, outputChannel);
  const toolOptions = new ToolOptionsProvider(platform.settings);

  // SPRINT 02: Create measurement services
  const proseStatsService = new ProseStatsService(platform.fileSystem, platform.workspace, outputChannel);
  const styleFlagsService = new StyleFlagsService();
  const wordFrequencyService = new WordFrequencyService(toolOptions, outputChannel);

  // SPRINT 03: Create analysis services
  const assistantToolService = new AssistantToolService(
    aiResourceManager,
    resourceLoader,
    toolOptions,
    WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION,
    outputChannel
  );
  const dictionaryService = new DictionaryService(
    aiResourceManager,
    resourceLoader,
    toolOptions,
    outputChannel
  );
  // One shared ledger for every webview's Dictionary tab (ADR 2026-10-14).
  const dictionaryHistoryStore = new DictionaryHistoryStore(
    platform.fileSystem,
    platform.workspace,
    outputChannel
  );
  const contextAssistantService = new ContextAssistantService(
    aiResourceManager,
    resourceLoader,
    toolOptions,
    platform.settings,
    platform.fileSystem,
    platform.workspace,
    outputChannel
  );

  // SPRINT 04: Create search service
  const wordSearchService = new WordSearchService(
    toolOptions,
    platform.fileSystem,
    platform.workspace,
    outputChannel
  );

  // Shared infrastructure that previously leaked into MessageHandler. Build it
  // once here so extension.ts remains the single composition root.
  const textSourceResolver = new TextSourceResolver(
    platform.fileSystem,
    platform.workspace,
    platform.settings,
    platform.editor,
    outputChannel
  );
  const categorySearchService = new CategorySearchService(
    aiResourceManager,
    wordSearchService,
    platform.fileSystem,
    platform.workspace.extensionPath,
    outputChannel
  );
  const accountBalanceService = new AccountBalanceService(
    new OpenRouterAccountClient(secretsService, outputChannel),
    outputChannel
  );
  // The balance service is shared by BOTH webview surfaces, so its lifecycle
  // belongs here, not to any single MessageHandler's dispose (which would
  // strip the surviving surface's refresh listeners).
  context.subscriptions.push({ dispose: () => accountBalanceService.dispose() });

  // Workshop session aggregate (ADR 2026-07-03): one instance, owned by the
  // composition root, so the thread survives panel close/reopen and webview
  // reloads — reload-safety lives HERE, not in React state.
  const workshopSessionService = new WorkshopSessionService(
    Date.now,
    coerceWorkshopConversationBehavior(
      platform.settings.get<unknown>(
        WORKSHOP_CONVERSATION_BEHAVIOR_SETTING.section,
        WORKSHOP_CONVERSATION_BEHAVIOR_SETTING.key
      )
    )
  );
  const workshopRoomDeliveryService = new WorkshopRoomDeliveryService(
    workshopSessionService
  );
  const workshopAnalysisSidePass = new WorkshopAnalysisSidePass(
    assistantToolService,
    workshopSessionService,
    outputChannel
  );
  const workshopWriterProfileService = new WorkshopWriterProfileService(
    platform.settings,
    outputChannel
  );
  const workshopConversationSettingsService = new WorkshopConversationSettingsService(
    workshopSessionService,
    assistantToolService,
    platform.settings,
    outputChannel,
    workshopWriterProfileService
  );
  const workshopStandingDirectiveService = new WorkshopStandingDirectiveService(
    workshopSessionService,
    workshopConversationSettingsService
  );
  const workshopContextIntakeService = new WorkshopContextIntakeService(
    contextResourceResolver,
    platform.fileSystem,
    platform.workspace
  );
  const workshopSessionTimeService = new WorkshopSessionTimeService();
  const workshopSessionStore = new WorkshopSessionStore(
    platform.fileSystem,
    platform.workspace,
    outputChannel
  );
  workshopSessionPersistenceCoordinator = new WorkshopSessionPersistenceCoordinator(
    workshopSessionService,
    assistantToolService,
    workshopConversationSettingsService,
    workshopSessionTimeService,
    workshopSessionStore,
    outputChannel,
    {
      ensureAssistantReady: () => aiResourceManager.ensureInitialized()
    }
  );
  // Session recall reads the writer's other saved sessions through the
  // store's read-only methods; the coordinator tells it which room is live
  // and whether the workspace still holds (ADR 2026-10-05 §2, §9). Only the
  // persona capability factory consumes it, so it needs no CoreServices
  // field and no route.
  const workshopTranscriptRecallService = new WorkshopTranscriptRecallService(
    workshopSessionStore,
    workshopSessionPersistenceCoordinator,
    outputChannel
  );
  // Persona capabilities are minted per turn by this factory, after the
  // store, the coordinator, and the recall service built from them.
  const workshopPersonaCapabilityFactory = new WorkshopPersonaCapabilityFactory(
    dictionaryService,
    workshopAnalysisSidePass,
    contextResourceResolver,
    workshopSessionService,
    outputChannel,
    workshopTranscriptRecallService
  );
  const workshopToolSidePass = new RunWorkshopToolSidePass(
    assistantToolService,
    workshopAnalysisSidePass,
    workshopSessionService,
    workshopRoomDeliveryService,
    workshopPersonaCapabilityFactory,
    outputChannel,
    workshopWriterProfileService,
    () => workshopConversationSettingsService.getWebResearch().enabled
  );
  // Workshop handlers must not observe or mutate the fresh in-memory aggregate
  // until rolling recovery has either completed or deliberately fallen back.
  // Otherwise a fast webview message can race hydration and lose committed work.
  await workshopSessionPersistenceCoordinator.initialize();
  // Transcript export reads the live room's full ledger and writes write-once
  // documents under prose-minion/exports.
  const workshopTranscriptExportService = new WorkshopTranscriptExportService(
    workshopSessionService,
    new WorkshopTranscriptExportStore(platform.fileSystem, platform.workspace)
  );

  // Conversation Widgets (ADR 2026-07-22): Gesture Playground's one
  // quality-first model call, routed through the manager-owned `widget` scope.
  const rejectedModelResponseRecovery = new RejectedModelResponseRecoveryStore(
    platform.fileSystem,
    platform.workspace,
    path.join(context.globalStorageUri.fsPath, 'recovery'),
    outputChannel
  );
  const rejectedModelResponseRecoveryPresenter = new RejectedModelResponseRecoveryShellPresenter(
    platform.shell,
    outputChannel
  );
  const gesturePlaygroundService = new GesturePlaygroundService(
    aiResourceManager,
    resourceLoader.getPromptLoader(),
    rejectedModelResponseRecovery,
    rejectedModelResponseRecoveryPresenter,
    outputChannel
  );
  const creativeVariationsService = new CreativeVariationsService(
    aiResourceManager,
    resourceLoader.getPromptLoader(),
    rejectedModelResponseRecovery,
    rejectedModelResponseRecoveryPresenter,
    outputChannel
  );
  const showVsTellService = new ShowVsTellService(
    aiResourceManager,
    resourceLoader.getPromptLoader(),
    rejectedModelResponseRecovery,
    rejectedModelResponseRecoveryPresenter,
    outputChannel
  );
  const lexicalGravityModelService = new LexicalGravityModelService(
    aiResourceManager,
    resourceLoader.getPromptLoader(),
    rejectedModelResponseRecovery,
    rejectedModelResponseRecoveryPresenter,
    outputChannel
  );
  const lexicalGravityLensRepository = new LexicalGravityLensRepository(
    platform.fileSystem,
    platform.workspace,
    outputChannel
  );

  // Lightbox boards (ADR 2026-10-19 D5, D12): the counted board from the same
  // measurement services the Metrics tab uses, kept in memory per source.
  // The writer's own average (Slice 4B): their other configured chapters,
  // measured with the board's own detectors, bounded and cached; no model.
  const lightboxWriterBaseline = new LightboxWriterBaseline({
    catalog: workshopContextIntakeService,
    fileSystem: platform.fileSystem,
    outputChannel
  });
  const lightboxService = new LightboxService(
    proseStatsService,
    wordFrequencyService,
    styleFlagsService,
    standardsService,
    {},
    lightboxWriterBaseline
  );
  // Lightbox readings (Slice 2B, D6–D9): the assistant model scope, one
  // active run per board, unusable paid bodies quarantined for recovery.
  const lightboxReadingRunner = new LightboxReadingRunner(
    aiResourceManager,
    resourceLoader.getPromptLoader(),
    rejectedModelResponseRecovery,
    rejectedModelResponseRecoveryPresenter,
    outputChannel
  );
  context.subscriptions.push({ dispose: () => lightboxReadingRunner.dispose() });
  const lightboxContextShelf = new LightboxContextShelf();
  // Saved boards (Slice 5A, ADR 2026-10-19 D12 addendum): prose-minion/boards
  // in the workspace's one folder, the reload pointer in its workspace state.
  const lightboxBoardStore = new LightboxBoardStore(
    platform.fileSystem,
    platform.workspace,
    outputChannel,
    { memory: context.workspaceState }
  );
  lightboxBoardLibrary = new LightboxBoardLibrary({
    service: lightboxService,
    store: lightboxBoardStore,
    runs: lightboxReadingRunner,
    textSourceResolver,
    workspace: platform.workspace,
    outputChannel
  });
  const boardLibrary = lightboxBoardLibrary;
  context.subscriptions.push({ dispose: () => boardLibrary.dispose() });

  // Draft Edit (ADR 2026-10-21): the Proofread pass on the manager-owned
  // `proofread` scope, the applier (the one door to the writer's document),
  // and the one run per document that places its flags or makes its fixes.
  // Built here and used by the editor commands below; it joins CoreServices
  // when a webview handler first needs it (the Workshop, Slice 4). Both passes
  // read the live catalog's reasoning marks at reasoning off (PR #181 F-01).
  const reasoningCatalog = liveCatalogReasoning(outputChannel);
  const proofreadService = new ProofreadService(
    aiResourceManager,
    resourceLoader.getPromptLoader(),
    reasoningCatalog,
    rejectedModelResponseRecovery,
    rejectedModelResponseRecoveryPresenter,
    outputChannel
  );
  const draftEdit = new DraftEditUseCase(
    proofreadService,
    platform.documents,
    platform.annotations,
    new DraftEditApplier(platform.documents),
    outputChannel
  );
  // Craft Flags (Slice 3c): one call per category on the manager-owned `craft` scope, priced from the live
  // catalog before a run; its run takes no applier, so it only ever flags.
  const craftFlags = new CraftFlagsUseCase(
    new CraftFlagsService(
      aiResourceManager,
      resourceLoader.getPromptLoader(),
      liveCatalogPrices(outputChannel),
      reasoningCatalog,
      rejectedModelResponseRecovery,
      rejectedModelResponseRecoveryPresenter,
      outputChannel
    ),
    platform.documents,
    platform.craftAnnotations,
    outputChannel
  );

  const coreServices: CoreServices = {
    assistantToolService,
    dictionaryService,
    dictionaryHistoryStore,
    contextAssistantService,
    proseStatsService,
    styleFlagsService,
    wordFrequencyService,
    wordSearchService,
    standardsService,
    aiResourceManager,
    aiResourceRefresh,
    secretsService,
    textSourceResolver,
    categorySearchService,
    accountBalanceService,
    workshopSessionService,
    workshopRoomDeliveryService,
    workshopPersonaCapabilityFactory,
    workshopToolSidePass,
    workshopContextIntakeService,
    workshopConversationSettingsService,
    workshopWriterProfileService,
    workshopSessionTimeService,
    workshopSessionPersistenceCoordinator,
    workshopTranscriptExportService,
    gesturePlaygroundService,
    creativeVariationsService,
    showVsTellService,
    lexicalGravityModelService,
    lexicalGravityLensRepository,
    workshopStandingDirectiveService,
    lightboxService,
    lightboxReadingRunner,
    lightboxContextShelf,
    lightboxBoardStore,
    lightboxBoardLibrary
  };

  // Migrate API key from settings to SecretStorage if needed
  void migrateApiKeyToSecrets(secretsService, outputChannel);

  // Initialize application layer
  proseToolsViewProvider = new ProseToolsViewProvider(
    context.extensionUri,
    coreServices,
    outputChannel,
    platform,
    {
      openWorkshop: () => workshopPanelProvider?.openOrReveal(),
      openLightbox: () => lightboxPanelProvider?.openOrReveal()
    }
  );

  // Register webview provider
  console.log('Registering webview provider:', ProseToolsViewProvider.viewType);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ProseToolsViewProvider.viewType,
      proseToolsViewProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    )
  );
  console.log('Webview provider registered successfully');

  // Workshop editor-tab surface (ADR 2026-07-03, Sprint 1: shell only).
  // Same CoreServices bundle as the sidebar — the provider constructs nothing.
  workshopPanelProvider = new WorkshopPanelProvider(
    context.extensionUri,
    coreServices,
    outputChannel,
    platform,
    {
      openAssistantSettings: () => {
        void vscode.commands.executeCommand('prose-minion.openSettingsOverlay');
      }
    }
  );
  context.subscriptions.push(
    workshopPanelProvider,
    vscode.window.registerWebviewPanelSerializer(
      WorkshopPanelProvider.viewType,
      workshopPanelProvider
    )
  );

  // Lightbox editor-tab surface (ADR 2026-10-19 D1): the same CoreServices
  // bundle again, and its own serializer so a reload restores the tab.
  lightboxPanelProvider = new LightboxPanelProvider(
    context.extensionUri,
    coreServices,
    outputChannel,
    platform,
    {
      openAssistantSettings: () => {
        void vscode.commands.executeCommand('prose-minion.openSettingsOverlay');
      },
      // ADR 2026-10-19 D11: a handoff enters the Workshop only through the
      // Workshop panel's own message path; the Workshop decides what arrives.
      handOffToWorkshop: (handoff) => {
        switch (handoff.kind) {
          case 'lexical-gravity-seed':
            return workshopPanelProvider?.seedLexicalGravityBuild(handoff.seed)
              ?? Promise.resolve({ opened: false, reason: 'unavailable' });
          case 'tile':
            return workshopPanelProvider?.stageLightboxTile(handoff.tile)
              ?? Promise.resolve({ opened: false, reason: 'unavailable' });
        }
      },
      // The tray's "Open Workshop →" (Slice 4): reveal it; nothing is sent.
      openWorkshop: () => workshopPanelProvider?.openOrReveal()
    }
  );
  context.subscriptions.push(
    lightboxPanelProvider,
    vscode.window.registerWebviewPanelSerializer(
      LightboxPanelProvider.viewType,
      lightboxPanelProvider
    )
  );

  const focusToolsView = () => {
    void vscode.commands.executeCommand('prose-minion.toolsView.focus');
  };

  const getSelectionPayload = () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active text editor');
      return undefined;
    }

    const selection = editor.selection;
    const text = editor.document.getText(selection);

    if (!text) {
      vscode.window.showWarningMessage('No text selected');
      return undefined;
    }

    const uri = editor.document.uri;
    const relativePath = vscode.workspace.asRelativePath(uri, false);
    const lineRange = toInclusiveLineRange({
      startLine: selection.start.line,
      endLine: selection.end.line,
      endCharacter: selection.end.character
    });

    return { text, uri, relativePath, lineRange };
  };

  const sendSelection = (
    target: 'assistant' | 'dictionary',
    payload: { text: string; uri: vscode.Uri; relativePath: string },
    autoRun?: boolean
  ) => {
    proseToolsViewProvider?.sendSelectionToWebview({
      text: payload.text,
      sourceUri: payload.uri.toString(),
      relativePath: payload.relativePath,
      target,
      autoRun
    });
    focusToolsView();
  };

  const handleAssistantSelection = () => {
    const payload = getSelectionPayload();
    if (!payload) {
      return;
    }
    sendSelection('assistant', payload);
  };

  // Workshop seeding (Sprint 3): same selection-payload path as the sidebar's
  // assistant command, but the destination is the Workshop panel's session —
  // seedExcerpt routes WORKSHOP_SET_EXCERPT through the panel's own
  // MessageHandler, so guards and provenance match a webview pin exactly.
  const handleWorkshopSelection = () => {
    const payload = getSelectionPayload();
    if (!payload) {
      return;
    }
    workshopPanelProvider?.seedExcerpt({
      text: payload.text,
      source: {
        kind: 'editor-selection',
        sourceUri: payload.uri.toString(),
        relativePath: payload.relativePath,
        startLine: payload.lineRange.startLine,
        endLine: payload.lineRange.endLine
      }
    });
  };

  // Lightbox seeding. seedSource boards through the panel's own
  // MessageHandler, into the same handler code as the webview's own requests.
  // A whole file (a menu's URI, or the active editor's) goes through
  // openFileInLightbox, which refuses untitled, non-disk and non-text sources
  // before anything is sent, and takes the shared service's source request
  // before VS Code loads the document (PR #152 F-01).
  const openFileInLightboxHost: OpenFileInLightboxHost<vscode.Uri> = {
    toUri: (value) => (value instanceof vscode.Uri ? value : undefined),
    activeDocument: () => vscode.window.activeTextEditor?.document,
    openTextDocument: (uri) => vscode.workspace.openTextDocument(uri),
    asRelativePath: (uri) => vscode.workspace.asRelativePath(uri, false),
    beginSourceRequest: () => lightboxService.beginSourceRequest(),
    seedSource: (payload, ticket) => lightboxPanelProvider?.seedSource(payload, ticket) ?? false,
    showWarning: (message) => void vscode.window.showWarningMessage(message),
    showInformation: (message) => void vscode.window.showInformationMessage(message),
    log: (line) => outputChannel.appendLine(line)
  };
  const handleOpenFileInLightbox = (target?: unknown) => openFileInLightbox(target, openFileInLightboxHost);

  // The selection when there is one; with nothing selected, the active file.
  const handleLightboxSelection = () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active text editor');
      return;
    }
    const selection = editor.selection;
    const text = editor.document.getText(selection);
    if (!text) {
      void handleOpenFileInLightbox();
      return;
    }
    const uri = editor.document.uri;
    const lineRange = toInclusiveLineRange({
      startLine: selection.start.line,
      endLine: selection.end.line,
      endCharacter: selection.end.character
    });
    const payload: LightboxSetSourcePayload = {
      sourceUri: uri.toString(),
      relativePath: vscode.workspace.asRelativePath(uri, false),
      text,
      startLine: lineRange.startLine,
      endLine: lineRange.endLine
    };
    lightboxPanelProvider?.seedSource(payload);
  };

  // Proofread (Draft Edit Slices 1 to 3): the target is captured at the
  // gesture, in one synchronous read of the editor (ADR 2026-10-21 D5).
  const readProofreadDocument = (document: vscode.TextDocument, selection?: vscode.Selection): ProofreadEditorSnapshot => ({
    uri: document.uri.toString(),
    version: document.version,
    text: document.getText(),
    languageId: document.languageId,
    label: document.isUntitled ? document.fileName : vscode.workspace.asRelativePath(document.uri, false),
    ...(!selection || selection.isEmpty ? {} : { selection: { start: document.offsetAt(selection.start), end: document.offsetAt(selection.end) } })
  });
  const proofreadCommandHost: ProofreadCommandHost = {
    activeEditor: () => {
      const editor = vscode.window.activeTextEditor;
      return editor ? readProofreadDocument(editor.document, editor.selection) : undefined;
    },
    document: (uri) => {
      const document = vscode.workspace.textDocuments.find((each) => each.uri.toString() === uri);
      return document && !document.isClosed ? readProofreadDocument(document) : undefined;
    },
    fixReview: () =>
      vscode.workspace.getConfiguration('proseMinion').get<string>('proofread.fixReview') === 'apply' ? 'apply' : 'preview',
    spellingConvention: () => vscode.workspace.getConfiguration('proseMinion').get<string>('proofread.spellingConvention'),
    wordList: () => vscode.workspace.getConfiguration('proseMinion').get<unknown>('proofread.wordList'),
    proofreadReasoning: () => vscode.workspace.getConfiguration('proseMinion').get<unknown>('proofread.reasoning'),
    confirm: async (message, action) =>
      (await vscode.window.showWarningMessage(message, { modal: true }, action)) === action,
    withProgress: (title, task) => vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title, cancellable: true },
      (progress, token) => {
        const controller = new AbortController();
        token.onCancellationRequested(() => controller.abort());
        return task(controller.signal, (message) => progress.report({ message }));
      }
    ),
    showInformation: (message, ...actions) => vscode.window.showInformationMessage(message, ...actions),
    showWarning: (message, ...actions) => vscode.window.showWarningMessage(message, ...actions),
    executeCommand: (command) => void vscode.commands.executeCommand(command)
  };
  // Craft Flags (Slice 3c): Proofread's editor and window, and its own categories, read at the gesture.
  const craftFlagsCommandHost: CraftFlagsCommandHost = {
    ...proofreadCommandHost,
    craftFlagCategories: () => vscode.workspace.getConfiguration('proseMinion').get<unknown>('craftFlags.categories'),
    craftFlagsReasoning: () => vscode.workspace.getConfiguration('proseMinion').get<unknown>('craftFlags.reasoning')
  };

  const handleWordLookupSelection = () => {
    const payload = getSelectionPayload();
    if (!payload) {
      return;
    }
    vscode.window.showInformationMessage(`Running dictionary lookup for word/phrase "${payload.text}"...`);
    sendSelection('dictionary', payload, true);
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('prose-minion.assistantSelection', handleAssistantSelection),
    vscode.commands.registerCommand('prose-minion.analyzeSelection', handleAssistantSelection),
    vscode.commands.registerCommand('prose-minion.wordLookupSelection', handleWordLookupSelection),
    vscode.commands.registerCommand('prose-minion.showOutputChannel', () => {
      outputChannel.appendLine('[Command] Showing Prose Minion output channel');
      outputChannel.show(true);
    }),
    vscode.commands.registerCommand('prose-minion.openSettingsOverlay', () => {
      focusToolsView();
      proseToolsViewProvider?.openSettings();
    }),
    vscode.commands.registerCommand('prose-minion.openWorkshop', () => {
      workshopPanelProvider?.openOrReveal();
    }),
    vscode.commands.registerCommand('prose-minion.workshopSelection', handleWorkshopSelection),
    vscode.commands.registerCommand('prose-minion.openLightbox', () => {
      lightboxPanelProvider?.openOrReveal();
    }),
    vscode.commands.registerCommand('prose-minion.lightboxSelection', handleLightboxSelection),
    vscode.commands.registerCommand('prose-minion.openFileInLightbox', handleOpenFileInLightbox),
    vscode.commands.registerCommand(PROOFREAD_FLAG_COMMAND, () => proofreadAndFlag(proofreadCommandHost, draftEdit)),
    vscode.commands.registerCommand(PROOFREAD_FIX_COMMAND, () => proofreadAndFix(proofreadCommandHost, draftEdit)),
    vscode.commands.registerCommand(PROOFREAD_REPLACE_COMMAND, (uri?: unknown, issueId?: unknown) =>
      replaceProofreadIssue(proofreadCommandHost, draftEdit, uri, issueId)),
    vscode.commands.registerCommand(PROOFREAD_FIX_ALL_COMMAND, (uri?: unknown) =>
      fixAllProofreadIssues(proofreadCommandHost, draftEdit, uri)),
    vscode.commands.registerCommand(PROOFREAD_CLEAR_COMMAND, (uri?: unknown) => clearProofreadFlags(proofreadCommandHost, draftEdit, uri)),
    vscode.commands.registerCommand(PROOFREAD_DISMISS_COMMAND, (uri?: unknown, issueId?: unknown) => dismissProofreadIssue(draftEdit, uri, issueId)),
    vscode.commands.registerCommand(CRAFT_FLAGS_COMMAND, () => runCraftFlags(craftFlagsCommandHost, craftFlags)),
    vscode.commands.registerCommand(CRAFT_FLAGS_CLEAR_COMMAND, (uri?: unknown) => clearCraftFlags(craftFlagsCommandHost, craftFlags, uri)),
    vscode.commands.registerCommand(CRAFT_FLAGS_DISMISS_COMMAND, (uri?: unknown, issueId?: unknown) => dismissCraftFlag(craftFlags, uri, issueId))
  );
}

export async function deactivate(): Promise<void> {
  // Producers stop first, then what they owe is awaited (`shutDownExtension`; PR #183 F-03).
  const parts: ExtensionShutdownParts = {
    workshopPanel: workshopPanelProvider,
    lightboxPanel: lightboxPanelProvider,
    workshopSessions: workshopSessionPersistenceCoordinator,
    lightboxBoards: lightboxBoardLibrary
  };
  workshopPanelProvider = undefined;
  lightboxPanelProvider = undefined;
  workshopSessionPersistenceCoordinator = undefined;
  lightboxBoardLibrary = undefined;
  await shutDownExtension(parts);
  console.log('Prose Minion extension is now deactivated');
}

/**
 * Migrate API key from settings to SecretStorage
 * This is a one-time migration for users upgrading from the settings-based approach
 */
async function migrateApiKeyToSecrets(
  secretsService: SecretStorageService,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  try {
    // Check if key already exists in SecretStorage
    const existingKey = await secretsService.getApiKey();
    if (existingKey) {
      outputChannel.appendLine('[Migration] API key already exists in SecretStorage, skipping migration');
      return;
    }

    // Check if old setting has a value
    const config = vscode.workspace.getConfiguration('proseMinion');
    const oldKey = config.get<string>('openRouterApiKey');

    if (oldKey && oldKey.trim().length > 0) {
      // Migrate to SecretStorage
      await secretsService.setApiKey(oldKey.trim());
      outputChannel.appendLine('[Migration] API key migrated to SecretStorage');

      // Clear old setting
      await config.update('openRouterApiKey', undefined, vscode.ConfigurationTarget.Global);
      outputChannel.appendLine('[Migration] Cleared old API key setting');

      // Show notification to user
      vscode.window.showInformationMessage(
        'Your API key has been migrated to secure storage for better security.'
      );
    } else {
      outputChannel.appendLine('[Migration] No API key found in settings, no migration needed');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`[Migration] Error during API key migration: ${message}`);
    // Don't show error to user as migration is not critical
  }
}
