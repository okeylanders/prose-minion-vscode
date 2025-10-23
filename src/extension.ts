/**
 * Extension entry point
 * Follows Clean Architecture principles:
 * - Dependency injection for services
 * - Separation of concerns
 * - Clear boundaries between layers
 */

import * as vscode from 'vscode';
import { ProseToolsViewProvider } from './application/providers/ProseToolsViewProvider';
import { ProseAnalysisService } from './infrastructure/api/ProseAnalysisService';

let proseToolsViewProvider: ProseToolsViewProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
  // Create output channel for logging
  const outputChannel = vscode.window.createOutputChannel('Prose Minion');
  context.subscriptions.push(outputChannel);

  outputChannel.appendLine('=== Prose Minion Extension Activated ===');
  outputChannel.appendLine(`Extension URI: ${context.extensionUri.fsPath}`);

  console.log('Prose Minion extension is now active');
  vscode.window.showInformationMessage('Prose Minion extension activated!');

  // Initialize infrastructure layer (dependency injection)
  const proseAnalysisService = new ProseAnalysisService(context.extensionUri, outputChannel);

  // Initialize application layer
  proseToolsViewProvider = new ProseToolsViewProvider(
    context.extensionUri,
    proseAnalysisService,
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

  // Register command for analyzing selected text
  context.subscriptions.push(
    vscode.commands.registerCommand('prose-minion.analyzeSelection', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active text editor');
        return;
      }

      const selection = editor.selection;
      const text = editor.document.getText(selection);

      if (!text) {
        vscode.window.showWarningMessage('No text selected');
        return;
      }

      // Send selected text to webview
      const uri = editor.document.uri;
      const relativePath = vscode.workspace.asRelativePath(uri, false);

      proseToolsViewProvider?.sendSelectionToWebview({
        text,
        sourceUri: uri.toString(),
        relativePath
      });

      // Show the webview panel
      vscode.commands.executeCommand('prose-minion.toolsView.focus');
    })
  );

  // Listen for selection changes (optional - for real-time updates)
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(event => {
      const editor = event.textEditor;
      const text = editor.document.getText(event.selections[0]);
      if (text && text.length > 0 && text.length < 10000) {
        // Only send reasonable-sized selections
        const uri = editor.document.uri;
        const relativePath = vscode.workspace.asRelativePath(uri, false);

        proseToolsViewProvider?.sendSelectionToWebview({
          text,
          sourceUri: uri.toString(),
          relativePath
        });
      }
    })
  );
}

export function deactivate(): void {
  console.log('Prose Minion extension is now deactivated');
}
