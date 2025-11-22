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
import { SecretStorageService } from './infrastructure/secrets/SecretStorageService';
// SPRINT 01: Import resource services
import { ResourceLoaderService } from './infrastructure/api/services/resources/ResourceLoaderService';
import { AIResourceManager } from './infrastructure/api/services/resources/AIResourceManager';
import { StandardsService } from './infrastructure/api/services/resources/StandardsService';
import { ToolOptionsProvider } from './infrastructure/api/services/shared/ToolOptionsProvider';
// SPRINT 02: Import measurement services
import { ProseStatsService } from './infrastructure/api/services/measurement/ProseStatsService';
import { StyleFlagsService } from './infrastructure/api/services/measurement/StyleFlagsService';
import { WordFrequencyService } from './infrastructure/api/services/measurement/WordFrequencyService';
// SPRINT 03: Import analysis services
import { AssistantToolService } from './infrastructure/api/services/analysis/AssistantToolService';
import { DictionaryService } from './infrastructure/api/services/dictionary/DictionaryService';
import { ContextAssistantService } from './infrastructure/api/services/analysis/ContextAssistantService';
// SPRINT 04: Import search service
import { WordSearchService } from './infrastructure/api/services/search/WordSearchService';

let proseToolsViewProvider: ProseToolsViewProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
  // Create output channel for logging
  const outputChannel = vscode.window.createOutputChannel('Prose Minion');
  context.subscriptions.push(outputChannel);

  outputChannel.appendLine('=== Prose Minion Extension Activated ===');
  outputChannel.appendLine('>>> Version 1.2.4 <<<');
  outputChannel.appendLine(`Extension URI: ${context.extensionUri.fsPath}`);

  console.log('Prose Minion extension is now active');
  vscode.window.showInformationMessage('Prose Minion extension activated!');

  // SPRINT 01: Initialize infrastructure layer (dependency injection)
  const secretsService = new SecretStorageService(context.secrets);

  // SPRINT 01: Create resource services (foundation)
  const resourceLoader = new ResourceLoaderService(context.extensionUri, outputChannel);
  const aiResourceManager = new AIResourceManager(resourceLoader, secretsService, outputChannel);
  const standardsService = new StandardsService(context.extensionUri, outputChannel);
  const toolOptions = new ToolOptionsProvider();

  // SPRINT 02: Create measurement services
  const proseStatsService = new ProseStatsService(outputChannel);
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
    outputChannel
  );

  // SPRINT 04: Create search service
  const wordSearchService = new WordSearchService(
    toolOptions,
    outputChannel
  );

  // SPRINT 05: ProseAnalysisService facade removed
  // Services now passed directly to ProseToolsViewProvider

  // Migrate API key from settings to SecretStorage if needed
  void migrateApiKeyToSecrets(secretsService, outputChannel);

  // Initialize application layer
  proseToolsViewProvider = new ProseToolsViewProvider(
    context.extensionUri,
    // SPRINT 05: Inject all services directly
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
    outputChannel
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
    payload: { text: string; uri: vscode.Uri; relativePath: string }
  ) => {
    proseToolsViewProvider?.sendSelectionToWebview({
      text: payload.text,
      sourceUri: payload.uri.toString(),
      relativePath: payload.relativePath,
      target
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

  const handleWordLookupSelection = () => {
    const payload = getSelectionPayload();
    if (!payload) {
      return;
    }
    sendSelection('dictionary', payload);
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('prose-minion.assistantSelection', handleAssistantSelection),
    vscode.commands.registerCommand('prose-minion.analyzeSelection', handleAssistantSelection),
    vscode.commands.registerCommand('prose-minion.wordLookupSelection', handleWordLookupSelection),
    vscode.commands.registerCommand('prose-minion.openSettingsOverlay', () => {
      focusToolsView();
      proseToolsViewProvider?.openSettings();
    })
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
