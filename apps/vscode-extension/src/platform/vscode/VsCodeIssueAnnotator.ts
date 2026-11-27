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
 * - **Related places** (Slice 3c part 4). A flag's `related` ranges (a
 *   continuity pair's earlier side) are its `relatedInformation`, which the
 *   Problems panel and the hover list under it, each a link to its place.
 *   They move with the flag through `shiftRanges`, and an edit touching one
 *   drops the flag.
 * - **Session-only.** A document's flags clear when it closes, on Clear, or
 *   when the next run replaces them; nothing is restored after a reload.
 * - **Code actions.** A flag with a replacement offers *Replace with '…'*,
 *   preferred only for a fix Proofread would make itself (a judgment call's
 *   suggestion is the writer's to choose). A document with any such fix
 *   offers *Fix all*. Each flag offers Dismiss, and Clear for its document.
 *   Every action is a command into core, which writes through its applier;
 *   none is a raw edit (D7).
 * - **One family per instance** (Slice 3c). Proofread's flags and Craft
 *   Flags' are two instances, each with its own collection, source and
 *   words (`VsCodeFlagFamily`), so neither replaces the other's flags, and
 *   the Problems panel filters them apart. An instance given no `replace`
 *   or `fixAll` command (Craft Flags) never offers that action.
 */
import * as vscode from 'vscode';
import { openTextTabUris } from './vscodeTextTabs';
import {
  DRAFT_EDIT_LANGUAGE_IDS,
  shiftRanges,
  type DocumentAnnotation,
  type IssueAnnotator,
  type ShownAnnotations
} from '@prose-minion/core';

/** Which flags an instance shows, and how it names them. */
export interface VsCodeFlagFamily {
  /** The diagnostic collection's name. */
  readonly collection: string;
  /** Each diagnostic's `source`, which the Problems panel filters by. */
  readonly source: string;
  /** The flags' name in the code actions' titles: "Dismiss this Proofread flag". */
  readonly noun: string;
  /** Families with different terminology can supply their own action titles. */
  readonly dismissTitle?: (message: string, index: number, count: number) => string;
  /** When supplied, Clear operates window-wide and receives no URI. */
  readonly clearAllTitle?: string;
  /** Workshop supports any file-backed excerpt. Draft Edit's passes run in prose languages. */
  readonly fileSelector?: vscode.DocumentFilter;
  /** Withdraw this family's marks when the writer closes the last tab showing their file. */
  readonly clearOnLastTabClose?: boolean;
}

export const PROOFREAD_FLAGS: VsCodeFlagFamily = { collection: 'prose-minion.draftEdit', source: 'Prose Minion', noun: 'Proofread' };
export const CRAFT_FLAGS: VsCodeFlagFamily = { collection: 'prose-minion.craftFlags', source: 'Prose Minion Craft', noun: 'Craft' };

export const WORKSHOP_HIGHLIGHTS: VsCodeFlagFamily = {
  collection: 'prose-minion.workshopHighlights',
  source: 'Prose Minion Workshop',
  noun: 'Workshop',
  dismissTitle: (message, index, count) => {
    const title = 'Dismiss this Workshop highlight';
    if (count === 1) { return title; }
    // The ordinal distinguishes identical notes or labels with the same shortened prefix.
    const prose = message.replace(/\s+/gu, ' ').trim();
    const label = prose.length > 80 ? `${prose.slice(0, 79)}…` : prose;
    return `${title} (${index + 1} of ${count}) · ${label}`;
  },
  clearAllTitle: 'Clear all Workshop highlights',
  fileSelector: { scheme: 'file' },
  clearOnLastTabClose: true
};

export const DRAFT_EDIT_DIAGNOSTIC_SOURCE = PROOFREAD_FLAGS.source;

export interface VsCodeIssueAnnotatorCommands {
  /** Invoked with `(uri, issueId)`. */
  readonly dismiss: string;
  /** Invoked with `(uri)`. */
  readonly clear: string;
  /** Invoked with `(uri, issueId)`: apply that flag's replacement. Absent: *Replace with* is never offered. */
  readonly replace?: string;
  /** Invoked with `(uri)`: apply every fix Proofread would make in the document. Absent: *Fix all* is never offered. */
  readonly fixAll?: string;
}

export class VsCodeIssueAnnotator implements IssueAnnotator, vscode.CodeActionProvider, vscode.Disposable {
  private readonly collection: vscode.DiagnosticCollection;
  /** Each document's shown annotations, at the document's current offsets. */
  private readonly shown = new Map<string, DocumentAnnotation[]>();
  private readonly subscriptions: vscode.Disposable[];

  constructor(private readonly commands: VsCodeIssueAnnotatorCommands, private readonly family: VsCodeFlagFamily = PROOFREAD_FLAGS) {
    this.collection = vscode.languages.createDiagnosticCollection(family.collection);
    this.subscriptions = [
      vscode.workspace.onDidChangeTextDocument((event) => this.follow(event)),
      vscode.workspace.onDidCloseTextDocument((document) => this.clear(document.uri.toString())),
      vscode.languages.registerCodeActionsProvider(
        family.fileSelector ?? DRAFT_EDIT_LANGUAGE_IDS.map((language) => ({ language })),
        this,
        { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
      )
    ];
    if (family.clearOnLastTabClose) {
      // The editor can retain a text model after closing its last tab. Keep all background tabs eligible.
      const prune = () => {
        if (!this.shown.size) { return; }
        const open = openTextTabUris();
        for (const uri of this.shown.keys()) {
          if (!open.has(uri)) { this.clear(uri); }
        }
      };
      this.subscriptions.push(vscode.window.tabGroups.onDidChangeTabs(prune), vscode.window.tabGroups.onDidChangeTabGroups(prune));
    }
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
    const matches = context.diagnostics.flatMap(diagnostic => {
      if (diagnostic.source !== this.family.source) {
        return [];
      }
      // Diagnostics come back as copies: match ours by code and place.
      const start = document.offsetAt(diagnostic.range.start);
      const end = document.offsetAt(diagnostic.range.end);
      const annotation = current.find((each) => each.start === start && each.end === end && each.code === diagnosticCode(diagnostic));
      return annotation ? [{ diagnostic, annotation }] : [];
    });
    for (const [index, { diagnostic, annotation }] of matches.entries()) {
      if (annotation.fix && this.commands.replace) {
        const replace = new vscode.CodeAction(replaceTitle(annotation.fix.replacement), vscode.CodeActionKind.QuickFix);
        replace.diagnostics = [diagnostic];
        replace.isPreferred = annotation.fix.preferred;
        replace.command = { title: replace.title, command: this.commands.replace, arguments: [uri, annotation.id] };
        actions.push(replace);
      }
      const title = this.family.dismissTitle?.(annotation.message, index, matches.length) ?? `Dismiss this ${this.family.noun} flag`;
      const dismiss = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
      dismiss.diagnostics = [diagnostic];
      dismiss.command = { title: dismiss.title, command: this.commands.dismiss, arguments: [uri, annotation.id] };
      actions.push(dismiss);
    }
    if (actions.length > 0) {
      if (this.commands.fixAll && current.some((annotation) => annotation.fix?.preferred)) {
        const fixAll = new vscode.CodeAction(`Fix all ${this.family.noun} issues in this file`, vscode.CodeActionKind.QuickFix);
        fixAll.command = { title: fixAll.title, command: this.commands.fixAll, arguments: [uri] };
        actions.push(fixAll);
      }
      const clear = new vscode.CodeAction(this.family.clearAllTitle ?? `Clear all ${this.family.noun} flags in this file`, vscode.CodeActionKind.QuickFix);
      clear.command = { title: clear.title, command: this.commands.clear, arguments: this.family.clearAllTitle ? [] : [uri] };
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
      diagnostic.source = this.family.source;
      diagnostic.code = annotation.code;
      if (annotation.related && annotation.related.length > 0) {
        diagnostic.relatedInformation = annotation.related.map((place) => new vscode.DiagnosticRelatedInformation(
          new vscode.Location(document.uri, new vscode.Range(document.positionAt(place.start), document.positionAt(place.end))),
          place.message
        ));
      }
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
