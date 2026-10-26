/**
 * Proofread commands (Draft Edit Slices 1 and 2; ADR 2026-10-21 D5, D7, D8).
 *
 * **Proofread and Flag** proofreads the active editor's selection, or its
 * whole document when nothing is selected, and shows each issue as a flag.
 * It never changes the text. **Proofread and Fix** does the same, then
 * applies the safe fixes as one undoable change, through Refactor Preview
 * unless the writer chose otherwise (`proseMinion.proofread.fixReview`), and
 * flags the rest. VS Code lists the fixes unticked, so its progress line says
 * how to take them all.
 * - The target is captured at the gesture, in one synchronous read: URI,
 *   version, text, and selection offsets (D5). The run never re-reads the
 *   active editor.
 * - Only Markdown and plain text are proofread. The editor menu offers the
 *   command only there; from the Command Palette, anything else is refused
 *   with a message, since the project hides no command there.
 * - The writer's spelling convention (`proseMinion.proofread.spellingConvention`)
 *   is read at the gesture too, and goes with the pass (Slice 3). `auto`, or
 *   a value outside the list, names none.
 * - A whole-file run over the confirmation threshold asks first, naming the
 *   word count and the number of model calls. Cancel sends nothing. A
 *   selection never asks.
 * - The run is cancellable from its progress notification. Its outcome is
 *   one notification, offering Open Settings when there is no key and Show
 *   Problems when flags were shown.
 *
 * **Clear Proofread Flags** clears the active document's flags, or every
 * document's when no editor is active. The code actions, commands into core
 * and never raw edits: **Dismiss** clears one flag; **Replace with '…'**
 * applies one fix at once (choosing it is the review); **Fix all** applies
 * every fix Proofread would make itself, reviewed as the setting says.
 *
 * This module never imports `vscode`: the composition root passes the host
 * as a port, so these rules are tested without a VS Code mock. Logs and
 * messages name paths, never the writer's text.
 */

import {
  DRAFT_EDIT_LANGUAGE_IDS,
  describeDraftEditOutcome,
  describeQuickFixOutcome,
  isProofreadSpellingConvention,
  type DocumentSnapshot,
  type DraftEditOutcome,
  type DraftEditPass,
  type DraftEditQuickFixOutcome,
  type DraftEditQuickFixRequest,
  type DraftEditReview,
  type DraftEditRunHooks,
  type DraftEditRunPlan,
  type DraftEditTarget
} from '@prose-minion/core';

export const PROOFREAD_FLAG_COMMAND = 'prose-minion.proofreadFlag';
export const PROOFREAD_FIX_COMMAND = 'prose-minion.proofreadFix';
export const PROOFREAD_CLEAR_COMMAND = 'prose-minion.clearProofreadFlags';
/** Internal: the code actions' commands. Not contributed, so they never appear in the Command Palette. */
export const PROOFREAD_DISMISS_COMMAND = 'prose-minion.dismissProofreadIssue';
export const PROOFREAD_REPLACE_COMMAND = 'prose-minion.applyProofreadIssue';
export const PROOFREAD_FIX_ALL_COMMAND = 'prose-minion.fixAllProofreadIssues';

export const OPEN_SETTINGS_COMMAND = 'prose-minion.openSettingsOverlay';
export const SHOW_PROBLEMS_COMMAND = 'workbench.actions.view.problems';

const OPEN_SETTINGS = 'Open Settings';
const SHOW_PROBLEMS = 'Show Problems';
const PROOFREAD = 'Proofread';

/** The active editor's document as the command reads it, captured in one synchronous read. */
export interface ProofreadEditorSnapshot {
  readonly uri: string;
  readonly version: number;
  readonly text: string;
  readonly languageId: string;
  /** A workspace-relative path, or the untitled document's name. */
  readonly label: string;
  /** The selection in `text` offsets; absent when nothing is selected. */
  readonly selection?: { readonly start: number; readonly end: number };
}

/** What the composition root provides: VS Code's editor and window. */
export interface ProofreadCommandHost {
  activeEditor(): ProofreadEditorSnapshot | undefined;
  /** An open document by URI, read the same way, for a code action. */
  document(uri: string): ProofreadEditorSnapshot | undefined;
  /** How Fix's fixes reach the document: `proseMinion.proofread.fixReview`. */
  fixReview(): 'preview' | 'apply';
  /** `proseMinion.proofread.spellingConvention`, as the writer set it. */
  spellingConvention(): string | undefined;
  /** A modal question with one action besides Cancel; true when the action was chosen. */
  confirm(message: string, action: string): PromiseLike<boolean>;
  /** Runs `task` under a cancellable progress notification; cancelling aborts the signal, `report` replaces its line. */
  withProgress<T>(title: string, task: (signal: AbortSignal, report: (message: string) => void) => Promise<T>): PromiseLike<T>;
  showInformation(message: string, ...actions: string[]): PromiseLike<string | undefined>;
  showWarning(message: string, ...actions: string[]): PromiseLike<string | undefined>;
  executeCommand(command: string): void;
}

/** The parts of `DraftEditUseCase` the commands use. */
export interface ProofreadRunner {
  plan(target: DraftEditTarget): DraftEditRunPlan;
  run(target: DraftEditTarget, pass: DraftEditPass, signal?: AbortSignal, hooks?: DraftEditRunHooks): Promise<DraftEditOutcome>;
  applyShown(document: DocumentSnapshot, request: DraftEditQuickFixRequest, review: DraftEditReview): Promise<DraftEditQuickFixOutcome>;
  dismiss(uri: string, issueId: string): void;
  clear(uri?: string): void;
}

export type ProofreadCommandOutcome =
  | { readonly kind: 'refused'; readonly message: string }
  | { readonly kind: 'declined' }
  | { readonly kind: 'ran'; readonly outcome: DraftEditOutcome };

/** Refactor Preview's own words: VS Code lists the fixes unticked. */
export const REVIEW_HINT = 'Review the fixes in Refactor Preview: tick the file to take them all, or tick them one by one, then Apply. Discard keeps them as flags.';

export function proofreadAndFlag(host: ProofreadCommandHost, runner: ProofreadRunner): Promise<ProofreadCommandOutcome> {
  return proofreadActiveEditor(host, runner, { kind: 'proofread', output: 'flag', ...spellingOf(host) });
}

export function proofreadAndFix(host: ProofreadCommandHost, runner: ProofreadRunner): Promise<ProofreadCommandOutcome> {
  return proofreadActiveEditor(host, runner, { kind: 'proofread', output: 'fix', review: reviewOf(host), ...spellingOf(host) });
}

/** *Replace with '…'*: one shown fix, applied at once. */
export function replaceProofreadIssue(
  host: ProofreadCommandHost,
  runner: ProofreadRunner,
  uri: unknown,
  issueId: unknown
): Promise<DraftEditQuickFixOutcome | undefined> {
  return typeof issueId === 'string' ? quickFix(host, runner, uri, { issueIds: [issueId] }, 'direct') : Promise.resolve(undefined);
}

/** *Fix all*: every shown fix Proofread would make itself, reviewed as the setting says. */
export function fixAllProofreadIssues(host: ProofreadCommandHost, runner: ProofreadRunner, uri: unknown): Promise<DraftEditQuickFixOutcome | undefined> {
  return quickFix(host, runner, uri, 'all-fixes', reviewOf(host));
}

async function quickFix(
  host: ProofreadCommandHost,
  runner: ProofreadRunner,
  uri: unknown,
  request: DraftEditQuickFixRequest,
  review: DraftEditReview
): Promise<DraftEditQuickFixOutcome | undefined> {
  const document = typeof uri === 'string' ? host.document(uri) : undefined;
  if (!document) {
    return undefined;
  }
  const outcome = await runner.applyShown(
    { uri: document.uri, version: document.version, text: document.text, languageId: document.languageId },
    request,
    review
  );
  const summary = describeQuickFixOutcome(outcome, document.label);
  if (!summary.quiet) {
    void (summary.level === 'warning' ? host.showWarning(summary.message) : host.showInformation(summary.message));
  }
  return outcome;
}

async function proofreadActiveEditor(host: ProofreadCommandHost, runner: ProofreadRunner, pass: DraftEditPass): Promise<ProofreadCommandOutcome> {
  const editor = host.activeEditor();
  if (!editor) {
    return refuse(host, 'Open a Markdown or plain-text file to proofread.');
  }
  if (!DRAFT_EDIT_LANGUAGE_IDS.includes(editor.languageId)) {
    return refuse(host, 'Proofread reads Markdown and plain-text files.');
  }
  const target: DraftEditTarget = {
    uri: editor.uri,
    version: editor.version,
    text: editor.text,
    languageId: editor.languageId,
    relativePath: editor.label,
    ...(editor.selection ? { range: editor.selection } : {})
  };

  const plan = runner.plan(target);
  if (plan.needsConfirmation) {
    const words = plan.words.toLocaleString('en-US');
    const proceed = await host.confirm(
      `Proofread all ${words} words of ${editor.label}? That is ${plan.chunks} requests to your Proofread model.`,
      PROOFREAD
    );
    if (!proceed) {
      return { kind: 'declined' };
    }
  }

  const outcome = await host.withProgress(
    `Proofreading ${editor.label}${editor.selection ? ' (selection)' : ''}…`,
    (signal, report) => runner.run(target, pass, signal, { onReview: () => report(REVIEW_HINT) })
  );
  present(host, outcome, editor.label);
  return { kind: 'ran', outcome };
}

function reviewOf(host: ProofreadCommandHost): DraftEditReview {
  return host.fixReview() === 'apply' ? 'direct' : 'preview';
}

/** The convention the writer named, if any: `auto` leaves it to the passage. */
function spellingOf(host: ProofreadCommandHost): Pick<DraftEditPass, 'spelling'> {
  const spelling = host.spellingConvention();
  return isProofreadSpellingConvention(spelling) ? { spelling } : {};
}

/** Clear the active document's flags, or every document's when no editor is active. */
export function clearProofreadFlags(host: ProofreadCommandHost, runner: ProofreadRunner, uri?: unknown): void {
  runner.clear(typeof uri === 'string' ? uri : host.activeEditor()?.uri);
}

/** The Dismiss code action: `(uri, issueId)`. */
export function dismissProofreadIssue(runner: ProofreadRunner, uri: unknown, issueId: unknown): void {
  if (typeof uri === 'string' && typeof issueId === 'string') {
    runner.dismiss(uri, issueId);
  }
}

function present(host: ProofreadCommandHost, outcome: DraftEditOutcome, label: string): void {
  const summary = describeDraftEditOutcome(outcome, label);
  if (outcome.kind === 'unconfigured') {
    void host.showWarning(summary.message, OPEN_SETTINGS).then((choice) => {
      if (choice === OPEN_SETTINGS) {
        host.executeCommand(OPEN_SETTINGS_COMMAND);
      }
    });
    return;
  }
  const actions = summary.hasFlags ? [SHOW_PROBLEMS] : [];
  const shown = summary.level === 'warning'
    ? host.showWarning(summary.message, ...actions)
    : host.showInformation(summary.message, ...actions);
  void shown.then((choice) => {
    if (choice === SHOW_PROBLEMS) {
      host.executeCommand(SHOW_PROBLEMS_COMMAND);
    }
  });
}

function refuse(host: ProofreadCommandHost, message: string): ProofreadCommandOutcome {
  void host.showWarning(message);
  return { kind: 'refused', message };
}
