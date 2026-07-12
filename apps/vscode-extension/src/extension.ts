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
import { ProseToolsViewProvider } from './application/providers/ProseToolsViewProvider';
import { WorkshopPanelProvider } from './application/providers/WorkshopPanelProvider';
// Core services + the Platform port type — imported via the public barrel only
// (ADR 2026-06-16 monorepo boundary; enforced by eslint no-restricted-imports).
import {
  Platform,
  SecretStorageService,
  ResourceLoaderService,
  AIResourceManager,
  StandardsService,
  ToolOptionsProvider,
  ProseStatsService,
  StyleFlagsService,
  WordFrequencyService,
  AssistantToolService,
  DictionaryService,
  ContextAssistantService,
  WordSearchService,
  CategorySearchService,
  TextSourceResolver,
  AccountBalanceService,
  OpenRouterAccountClient,
  WorkshopSessionService,
  RunWorkshopToolSidePass,
  CoreServices,
} from '@prose-minion/core';
// VS Code adapters (app-local; the composition root wires them into the ports)
import { VsCodeSettingsStore } from './platform/vscode/VsCodeSettingsStore';
import { VsCodeFileSystem } from './platform/vscode/VsCodeFileSystem';
import { VsCodeWorkspace } from './platform/vscode/VsCodeWorkspace';
import { VsCodeShellService } from './platform/vscode/VsCodeShellService';
import { VsCodeEditorContext } from './platform/vscode/VsCodeEditorContext';

let proseToolsViewProvider: ProseToolsViewProvider | undefined;
let workshopPanelProvider: WorkshopPanelProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
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
  const platform: Platform = {
    log: outputChannel,
    secrets: context.secrets,
    settings: new VsCodeSettingsStore(),
    fileSystem: new VsCodeFileSystem(),
    workspace: new VsCodeWorkspace(context.extensionUri),
    shell: new VsCodeShellService(),
    editor: new VsCodeEditorContext()
  };

  // SPRINT 01: Initialize infrastructure layer (dependency injection)
  const secretsService = new SecretStorageService(platform.secrets);

  // SPRINT 01: Create resource services (foundation)
  const resourceLoader = new ResourceLoaderService(platform.workspace.extensionPath, platform.fileSystem, outputChannel);
  const aiResourceManager = new AIResourceManager(resourceLoader, secretsService, platform.settings, outputChannel);
  // Lifecycle starts once at the composition root. Services only bind to the
  // manager-owned generation; none may rebuild all model scopes on startup.
  // Fire-and-forget, but never unobserved: the manager resets on rejection
  // and the next use retries, so this log is the only trace of a bad start.
  aiResourceManager.ensureInitialized().catch(error => {
    outputChannel.appendLine(`[extension] Initial AI resource build failed: ${error instanceof Error ? error.message : String(error)}`);
  });
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
    outputChannel
  );
  const dictionaryService = new DictionaryService(
    aiResourceManager,
    resourceLoader,
    toolOptions,
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
  const workshopSessionService = new WorkshopSessionService();
  const workshopToolSidePass = new RunWorkshopToolSidePass(
    assistantToolService,
    workshopSessionService,
    outputChannel
  );

  const coreServices: CoreServices = {
    assistantToolService,
    dictionaryService,
    contextAssistantService,
    proseStatsService,
    styleFlagsService,
    wordFrequencyService,
    wordSearchService,
    standardsService,
    aiResourceManager,
    secretsService,
    textSourceResolver,
    categorySearchService,
    accountBalanceService,
    workshopSessionService,
    workshopToolSidePass
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
      openWorkshop: () => workshopPanelProvider?.openOrReveal()
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
    platform
  );
  context.subscriptions.push(workshopPanelProvider);

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

    return { text, uri, relativePath };
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
      sourceUri: payload.uri.toString(),
      relativePath: payload.relativePath
    });
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
    vscode.commands.registerCommand('prose-minion.workshopSelection', handleWorkshopSelection)
  );
}

export function deactivate(): void {
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
