import * as vscode from 'vscode';
import {
  WORKSHOP_PROBLEMS_BOUNDS,
  workshopProblemTextPrefix,
  type WorkshopProblemRow,
  type WorkshopProblemsPage,
  type WorkshopProblemsReader
} from '@prose-minion/core';

function problemSeverity(value: vscode.DiagnosticSeverity): WorkshopProblemRow['severity'] {
  switch (value) {
    case vscode.DiagnosticSeverity.Error: return 'error';
    case vscode.DiagnosticSeverity.Warning: return 'warning';
    case vscode.DiagnosticSeverity.Information: return 'information';
    case vscode.DiagnosticSeverity.Hint: return 'hint';
  }
}

function liveQuote(document: vscode.TextDocument | undefined, range: vscode.Range): Pick<WorkshopProblemRow, 'quote' | 'quoteTruncated'> {
  if (!document || range.isEmpty || !document.validateRange(range).isEqual(range)) { return {}; }
  const start = document.offsetAt(range.start);
  const end = document.offsetAt(range.end);
  const limit = WORKSHOP_PROBLEMS_BOUNDS.quoteCharacters;
  if (end - start <= limit) { return { quote: document.getText(range) }; }

  // Read just the prefix and one character of lookahead, even for a file-wide diagnostic.
  const prefix = document.getText(new vscode.Range(range.start, document.positionAt(start + limit + 1)));
  return { quote: workshopProblemTextPrefix(prefix, limit), quoteTruncated: true };
}

function problemRow(diagnostic: vscode.Diagnostic, document: vscode.TextDocument | undefined): WorkshopProblemRow {
  const { source, message, range } = diagnostic;
  const bounds = WORKSHOP_PROBLEMS_BOUNDS;
  return {
    severity: problemSeverity(diagnostic.severity),
    startLine: range.start.line + 1, startColumn: range.start.character + 1,
    endLine: range.end.line + 1, endColumn: range.end.character + 1,
    ...(source ? { source: workshopProblemTextPrefix(source, bounds.sourceCharacters) } : {}),
    ...(source && source.length > bounds.sourceCharacters ? { sourceTruncated: true } : {}),
    message: workshopProblemTextPrefix(message, bounds.messageCharacters),
    ...(message.length > bounds.messageCharacters ? { messageTruncated: true } : {}),
    ...liveQuote(document, range)
  };
}

/** The caller authorizes the path. Sample the window's published Problems and the matching buffer together. */
export class VsCodeWorkshopProblemsReader implements WorkshopProblemsReader {
  async read(fsPath: string, start: number): Promise<WorkshopProblemsPage> {
    const uri = vscode.Uri.file(fsPath);
    const diagnostics = vscode.languages.getDiagnostics(uri);
    const key = uri.toString();
    const document = vscode.workspace.textDocuments.find(doc => !doc.isClosed && doc.uri.toString() === key);
    // Page the published list before projecting text. Other publishers' fixes, URLs and related files stay outside the read.
    const page = diagnostics.slice(start - 1, start - 1 + WORKSHOP_PROBLEMS_BOUNDS.rowsPerPage);
    return { total: diagnostics.length, problems: page.map(diagnostic => problemRow(diagnostic, document)) };
  }
}
