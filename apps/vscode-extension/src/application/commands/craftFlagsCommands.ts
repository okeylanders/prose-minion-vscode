/**
 * Craft Flags commands (Draft Edit Slice 3c; ADR 2026-10-21, Amendment
 * 2026-10-26: Slice 3c).
 *
 * **Craft Flags** reads the active editor's document, whole, and flags line
 * notes in it: clichés, in part 1. It never changes the text.
 * - The target is captured at the gesture, in one synchronous read (D5), as
 *   Proofread's is. A selection narrows the flags shown; the chapter is still
 *   read for context, unless it is over the word ceiling, when the
 *   selection is read alone. A whole file over the ceiling is refused.
 * - Every run confirms first, naming the words read, the requests, the model
 *   and the price ("≈ $0.06"), an estimate, never a cap. Cancel sends
 *   nothing.
 * - The run is cancellable from its progress notification. Its outcome is
 *   one notification, offering Open Settings when there is no key and Show
 *   Problems when flags were shown.
 *
 * **Clear Craft Flags** clears the active document's Craft Flags, or every
 * document's when no editor is active. The **Dismiss** code action clears
 * one. Neither touches Proofread's flags.
 *
 * This module never imports `vscode`: the composition root passes the same
 * host port Proofread's commands use. Messages name paths, never the text.
 */

import {
  CRAFT_FLAG_CATEGORIES,
  DRAFT_EDIT_LANGUAGE_IDS,
  describeCraftFlagsOutcome,
  describeCraftFlagsPlan,
  type CraftFlagsOutcome,
  type CraftFlagsPass,
  type CraftFlagsRunPlan,
  type DraftEditTarget
} from '@prose-minion/core';
import { OPEN_SETTINGS_COMMAND, SHOW_PROBLEMS_COMMAND, type ProofreadCommandHost } from './proofreadCommands';

export const CRAFT_FLAGS_COMMAND = 'prose-minion.craftFlags';
export const CRAFT_FLAGS_CLEAR_COMMAND = 'prose-minion.clearCraftFlags';
/** Internal: the Dismiss code action's command. Not contributed, so it never appears in the Command Palette. */
export const CRAFT_FLAGS_DISMISS_COMMAND = 'prose-minion.dismissCraftFlag';

const OPEN_SETTINGS = 'Open Settings';
const SHOW_PROBLEMS = 'Show Problems';
const RUN = 'Run Craft Flags';

/** The parts of the host Craft Flags uses: the same editor and window as Proofread's. */
export type CraftFlagsCommandHost = Pick<
  ProofreadCommandHost,
  'activeEditor' | 'confirm' | 'withProgress' | 'showInformation' | 'showWarning' | 'executeCommand'
>;

/** The parts of `CraftFlagsUseCase` the commands use. */
export interface CraftFlagsRunner {
  plan(target: DraftEditTarget, pass: CraftFlagsPass): Promise<CraftFlagsRunPlan>;
  run(target: DraftEditTarget, pass: CraftFlagsPass, signal?: AbortSignal): Promise<CraftFlagsOutcome>;
  dismiss(uri: string, issueId: string): void;
  clear(uri?: string): void;
}

export type CraftFlagsCommandOutcome =
  | { readonly kind: 'refused'; readonly message: string }
  | { readonly kind: 'declined' }
  | { readonly kind: 'ran'; readonly outcome: CraftFlagsOutcome };

export async function runCraftFlags(host: CraftFlagsCommandHost, runner: CraftFlagsRunner): Promise<CraftFlagsCommandOutcome> {
  const editor = host.activeEditor();
  if (!editor) {
    return refuse(host, 'Open a Markdown or plain-text file for Craft Flags.');
  }
  if (!DRAFT_EDIT_LANGUAGE_IDS.includes(editor.languageId)) {
    return refuse(host, 'Craft Flags reads Markdown and plain-text files.');
  }
  const target: DraftEditTarget = {
    uri: editor.uri,
    version: editor.version,
    text: editor.text,
    languageId: editor.languageId,
    relativePath: editor.label,
    ...(editor.selection ? { range: editor.selection } : {})
  };
  const pass: CraftFlagsPass = { kind: 'craft', categories: [...CRAFT_FLAG_CATEGORIES] };

  const plan = await runner.plan(target, pass);
  if (plan.kind !== 'ready') {
    present(host, plan, editor.label);
    return { kind: 'ran', outcome: plan };
  }
  if (!(await host.confirm(describeCraftFlagsPlan(plan, editor.label), RUN))) {
    return { kind: 'declined' };
  }
  const outcome = await host.withProgress(
    `Craft Flags: reading ${editor.label}${editor.selection ? ' (selection)' : ''}…`,
    (signal) => runner.run(target, pass, signal)
  );
  present(host, outcome, editor.label);
  return { kind: 'ran', outcome };
}

/** Clear the active document's Craft Flags, or every document's when no editor is active. */
export function clearCraftFlags(host: CraftFlagsCommandHost, runner: CraftFlagsRunner, uri?: unknown): void {
  runner.clear(typeof uri === 'string' ? uri : host.activeEditor()?.uri);
}

/** The Dismiss code action: `(uri, issueId)`. */
export function dismissCraftFlag(runner: CraftFlagsRunner, uri: unknown, issueId: unknown): void {
  if (typeof uri === 'string' && typeof issueId === 'string') {
    runner.dismiss(uri, issueId);
  }
}

function present(host: CraftFlagsCommandHost, outcome: CraftFlagsOutcome, label: string): void {
  const summary = describeCraftFlagsOutcome(outcome, label);
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

function refuse(host: CraftFlagsCommandHost, message: string): CraftFlagsCommandOutcome {
  void host.showWarning(message);
  return { kind: 'refused', message };
}
