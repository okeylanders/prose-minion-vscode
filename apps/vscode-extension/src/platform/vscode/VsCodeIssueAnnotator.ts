/**
 * VsCodeIssueAnnotator - VS Code adapter for the `IssueAnnotator` port
 * (ADR 2026-10-21 D3, D7).
 *
 * Draft Edit's flags are diagnostics: squiggles, the Problems panel, and F8,
 * with `source: 'Prose Minion'` and a stable `code` (e.g. `proofread.tense`).
 * They never change the document.
 *
 * - **Version-checked.** A `show` for a version the document has moved past
 *   is refused, so a flag is never drawn on moved text.
 * - **Kept on their text.** VS Code does not move diagnostics for us. Every
 *   document change runs through core's `shiftRanges`: a flag after the edit
 *   moves with its text; a flag the edit touches is dropped, because its text
 *   is no longer what was flagged.
 * - **Session-only.** A document's flags clear when it closes, on Clear, or
 *   when the next run replaces them; nothing is restored after a reload.
 * - **Code actions.** A flag with a replacement offers *Replace with '…'*,
 *   preferred only for a fix Proofread would make itself (a judgment call's
 *   suggestion is the writer's to choose). A document with any such fix
 *   offers *Fix all*. Each flag offers Dismiss, and Clear for its document.
 *   Every action is a command into core, which writes through its applier;
 *   none is a raw edit (D7).
 */
import * as vscode from 'vscode';
import {
  DRAFT_EDIT_LANGUAGE_IDS,
  shiftRanges,
  type DocumentAnnotation,
  type IssueAnnotator,
  type ShownAnnotations
} from '@prose-minion/core';

export const DRAFT_EDIT_DIAGNOSTIC_SOURCE = 'Prose Minion';

export interface VsCodeIssueAnnotatorCommands {
  /** Invoked with `(uri, issueId)`. */
  readonly dismiss: string;
  /** Invoked with `(uri)`. */
  readonly clear: string;
  /** Invoked with `(uri, issueId)`: apply that flag's replacement. */
  readonly replace: string;
  /** Invoked with `(uri)`: apply every fix Proofread would make in the document. */
  readonly fixAll: string;
}

export class VsCodeIssueAnnotator implements IssueAnnotator, vscode.CodeActionProvider, vscode.Disposable {
  private readonly collection = vscode.languages.createDiagnosticCollection('prose-minion.draftEdit');
  /** Each document's shown annotations, at the document's current offsets. */
  private readonly shown = new Map<string, DocumentAnnotation[]>();
  private readonly subscriptions: vscode.Disposable[];

  constructor(private readonly commands: VsCodeIssueAnnotatorCommands) {
    this.subscriptions = [
      vscode.workspace.onDidChangeTextDocument((event) => this.follow(event)),
      vscode.workspace.onDidCloseTextDocument((document) => this.clear(document.uri.toString())),
      vscode.languages.registerCodeActionsProvider(
        DRAFT_EDIT_LANGUAGE_IDS.map((language) => ({ language })),
        this,
        { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
      )
    ];
  }

  show(uri: string, version: number, annotations: readonly DocumentAnnotation[]): boolean {
    const document = openDocument(uri);
    if (!document || document.version !== version) {
      return false;
    }
    this.shown.set(uri, [...annotations]);
    this.render(document);
    return true;
  }

  remove(uri: string, ids: readonly string[]): void {
    const current = this.shown.get(uri);
    if (!current) {
      return;
    }
    const withdrawn = new Set(ids);
    this.shown.set(uri, current.filter((annotation) => !withdrawn.has(annotation.id)));
    const document = openDocument(uri);
    if (document) {
      this.render(document);
    }
  }

  clear(uri?: string): void {
    if (uri === undefined) {
      this.shown.clear();
      this.collection.clear();
      return;
    }
    this.shown.delete(uri);
    this.collection.delete(vscode.Uri.parse(uri));
  }

  current(uri: string): ShownAnnotations | undefined {
    const document = openDocument(uri);
    const annotations = this.shown.get(uri);
    // Every change event re-places them before anything else runs, so they sit at the document's version now.
    return document && annotations ? { version: document.version, annotations: [...annotations] } : undefined;
  }

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const uri = document.uri.toString();
    const current = this.shown.get(uri) ?? [];
    const actions: vscode.CodeAction[] = [];
    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== DRAFT_EDIT_DIAGNOSTIC_SOURCE) {
        continue;
      }
      // Diagnostics come back as copies: match ours by code and place.
      const start = document.offsetAt(diagnostic.range.start);
      const end = document.offsetAt(diagnostic.range.end);
      const annotation = current.find((each) => each.start === start && each.end === end && each.code === diagnosticCode(diagnostic));
      if (!annotation) {
        continue;
      }
      if (annotation.fix) {
        const replace = new vscode.CodeAction(replaceTitle(annotation.fix.replacement), vscode.CodeActionKind.QuickFix);
        replace.diagnostics = [diagnostic];
        replace.isPreferred = annotation.fix.preferred;
        replace.command = { title: replace.title, command: this.commands.replace, arguments: [uri, annotation.id] };
        actions.push(replace);
      }
      const dismiss = new vscode.CodeAction('Dismiss this Proofread flag', vscode.CodeActionKind.QuickFix);
      dismiss.diagnostics = [diagnostic];
      dismiss.command = { title: dismiss.title, command: this.commands.dismiss, arguments: [uri, annotation.id] };
      actions.push(dismiss);
    }
    if (actions.length > 0) {
      if (current.some((annotation) => annotation.fix?.preferred)) {
        const fixAll = new vscode.CodeAction('Fix all Proofread issues in this file', vscode.CodeActionKind.QuickFix);
        fixAll.command = { title: fixAll.title, command: this.commands.fixAll, arguments: [uri] };
        actions.push(fixAll);
      }
      const clear = new vscode.CodeAction('Clear all Proofread flags in this file', vscode.CodeActionKind.QuickFix);
      clear.command = { title: clear.title, command: this.commands.clear, arguments: [uri] };
      actions.push(clear);
    }
    return actions;
  }

  dispose(): void {
    this.subscriptions.forEach((subscription) => subscription.dispose());
    this.collection.dispose();
    this.shown.clear();
  }

  private follow(event: vscode.TextDocumentChangeEvent): void {
    const uri = event.document.uri.toString();
    const current = this.shown.get(uri);
    if (!current || event.contentChanges.length === 0) {
      return;
    }
    this.shown.set(uri, shiftRanges(current, event.contentChanges.map((change) => ({
      offset: change.rangeOffset,
      length: change.rangeLength,
      text: change.text
    }))));
    this.render(event.document);
  }

  private render(document: vscode.TextDocument): void {
    const annotations = this.shown.get(document.uri.toString()) ?? [];
    this.collection.set(document.uri, annotations.map((annotation) => {
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(document.positionAt(annotation.start), document.positionAt(annotation.end)),
        annotation.message,
        annotation.severity === 'warning' ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Information
      );
      diagnostic.source = DRAFT_EDIT_DIAGNOSTIC_SOURCE;
      diagnostic.code = annotation.code;
      return diagnostic;
    }));
  }
}

/** "Replace with 'the'"; a deletion reads as one, and a long replacement is cut so the menu stays one line. */
function replaceTitle(replacement: string): string {
  if (replacement.length === 0) {
    return 'Delete it';
  }
  const shown = replacement.length > 40 ? `${replacement.slice(0, 39)}…` : replacement;
  return `Replace with “${shown.replace(/\s+/g, ' ')}”`;
}

function openDocument(uri: string): vscode.TextDocument | undefined {
  return vscode.workspace.textDocuments.find((document) => document.uri.toString() === uri);
}

function diagnosticCode(diagnostic: vscode.Diagnostic): string | undefined {
  const code = diagnostic.code;
  if (code === undefined) {
    return undefined;
  }
  return typeof code === 'object' ? String(code.value) : String(code);
}
