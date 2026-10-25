/**
 * Proofread commands (Draft Edit Slice 1; ADR 2026-10-21 D5, D8).
 *
 * **Proofread and Flag** proofreads the active editor's selection, or its
 * whole document when nothing is selected, and shows each issue as a flag.
 * It never changes the text.
 * - The target is captured at the gesture, in one synchronous read: URI,
 *   version, text, and selection offsets (D5). The run never re-reads the
 *   active editor.
 * - Only Markdown and plain text are proofread. The editor menu offers the
 *   command only there; from the Command Palette, anything else is refused
 *   with a message, since the project hides no command there.
 * - A whole-file run over the confirmation threshold asks first, naming the
 *   word count and the number of model calls. Cancel sends nothing. A
 *   selection never asks.
 * - The run is cancellable from its progress notification. Its outcome is
 *   one notification, offering Open Settings when there is no key and Show
 *   Problems when flags were shown.
 *
 * **Clear Proofread Flags** clears the active document's flags, or every
 * document's when no editor is active. **Dismiss** (a code action) clears
 * one.
 *
 * This module never imports `vscode`: the composition root passes the host
 * as a port, so these rules are tested without a VS Code mock. Logs and
 * messages name paths, never the writer's text.
 */

import {
  DRAFT_EDIT_LANGUAGE_IDS,
  describeDraftEditOutcome,
  type DraftEditOutcome,
  type DraftEditPass,
  type DraftEditRunPlan,
  type DraftEditTarget
} from '@prose-minion/core';

export const PROOFREAD_FLAG_COMMAND = 'prose-minion.proofreadFlag';
export const PROOFREAD_CLEAR_COMMAND = 'prose-minion.clearProofreadFlags';
/** Internal: the Dismiss code action's command. Not contributed, so it never appears in the Command Palette. */
export const PROOFREAD_DISMISS_COMMAND = 'prose-minion.dismissProofreadIssue';

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
  /** A modal question with one action besides Cancel; true when the action was chosen. */
  confirm(message: string, action: string): PromiseLike<boolean>;
  /** Runs `task` under a cancellable progress notification; cancelling aborts the signal. */
  withProgress<T>(title: string, task: (signal: AbortSignal) => Promise<T>): PromiseLike<T>;
  showInformation(message: string, ...actions: string[]): PromiseLike<string | undefined>;
  showWarning(message: string, ...actions: string[]): PromiseLike<string | undefined>;
  executeCommand(command: string): void;
}

/** The parts of `DraftEditUseCase` the commands use. */
export interface ProofreadRunner {
  plan(target: DraftEditTarget): DraftEditRunPlan;
  run(target: DraftEditTarget, pass: DraftEditPass, signal?: AbortSignal): Promise<DraftEditOutcome>;
  dismiss(uri: string, issueId: string): void;
  clear(uri?: string): void;
}

export type ProofreadFlagCommandOutcome =
  | { readonly kind: 'refused'; readonly message: string }
  | { readonly kind: 'declined' }
  | { readonly kind: 'ran'; readonly outcome: DraftEditOutcome };

const FLAG_PASS: DraftEditPass = { kind: 'proofread', output: 'flag' };

export async function proofreadAndFlag(host: ProofreadCommandHost, runner: ProofreadRunner): Promise<ProofreadFlagCommandOutcome> {
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
    (signal) => runner.run(target, FLAG_PASS, signal)
  );
  present(host, outcome, editor.label);
  return { kind: 'ran', outcome };
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

function refuse(host: ProofreadCommandHost, message: string): ProofreadFlagCommandOutcome {
  void host.showWarning(message);
  return { kind: 'refused', message };
}
