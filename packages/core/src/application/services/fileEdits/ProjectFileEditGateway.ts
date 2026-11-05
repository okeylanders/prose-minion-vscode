/**
 * ProjectFileEditGateway — the one way a persona's edit reaches a project
 * file (ADR 2026-11-05 D4–D6, D11). Built only in `extension.ts`, reached
 * through `CoreServices`. Model-free: everything here is a host rule, tested
 * without a model.
 *
 * 1. **Takes a source-agnostic request** (`FileEditRequest`): a target, its
 *    operations, and where it came from.
 * 2. **Resolves the target fresh** (`resolveFileEditTarget`): a catalog key in
 *    a fresh catalog, or the room's excerpt at its version; inside the
 *    workspace, a text file, under the size bound.
 * 3. **Opens the document** if it is not open (`DocumentEditor.open`, which
 *    does not show it) and reads the live buffer, then checks it again: text,
 *    under the bound, and, for the excerpt, still holding the excerpt's text.
 * 4. **Plans against the live text** with the shared planner, under the
 *    target's policy (`FILE_EDIT_TARGET_POLICIES`), plus the prose checks.
 *    Nothing is awaited between the read and the apply.
 * 5. **Applies through `DraftEditApplier`** with the policy's rules: its
 *    version guard, protected regions, line-break and Markdown-structure
 *    checks and read-back all apply unchanged. Nothing is ever saved.
 * 6. **Reports what landed**, by operation, from the applier's result, and
 *    shows a document the writer could not see once something landed in it.
 *
 * Logs carry ids, counts and fault kinds, never a path, the file's text or a
 * quote.
 */

import type { DraftEditApplier, DraftEditApplyResult, DraftEditEdit, DraftEditRefusal } from '@/application/services/draftEdit/DraftEditApplier';
import {
  FILE_EDIT_TARGET_POLICIES,
  type FileEditApplyOptions,
  type FileEditOperationFault,
  type FileEditRefusal,
  type FileEditRequest
} from '@/domain/models/FileEdit';
import type { DocumentEditor, DocumentSnapshot } from '@/platform/DocumentEditor';
import type { LogSink } from '@/platform/LogSink';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { markdownFrontMatterEnd } from '@/utils/draftEdit/markdownBlockRegions';
import { planTextEdits } from '@/utils/textEdits/planTextEdits';
import type { TextEditOperation } from '@/utils/textEdits/textEditOperations';
import { fileEditFaultMessage, fileEditRefusalMessage } from './fileEditCopy';
import { fileEditPolicyFaults } from './fileEditPolicyChecks';
import { resolveFileEditTarget, type FileEditTargetDependencies } from './fileEditTargets';

/** What became of one operation, read back from the applier's result. */
export type FileEditOperationLanding =
  | { readonly index: number; readonly landing: 'applied' | 'not-applied' | 'unknown' }
  | { readonly index: number; readonly landing: 'refused'; readonly reason: DraftEditRefusal };

export type FileEditOutcome =
  | { readonly kind: 'refused'; readonly reason: FileEditRefusal; readonly message: string }
  /** Nothing applied: an operation faulted against the live text (a quote not there once makes the card stale). */
  | {
      readonly kind: 'not-planned';
      readonly faults: ReadonlyArray<{ readonly index: number; readonly fault: FileEditOperationFault }>;
      readonly message: string;
    }
  | {
      readonly kind: 'settled';
      /** The applier's last answer. */
      readonly host: DraftEditApplyResult['outcome'];
      /** Every operation, in the order given. */
      readonly operations: readonly FileEditOperationLanding[];
      /** The document after, while it is open. */
      readonly document?: { readonly uri: string; readonly version: number };
      /** Whether the document was shown because no editor showed it. */
      readonly revealed: boolean;
      readonly message: string;
    };

export interface ProjectFileEditGatewayDependencies extends FileEditTargetDependencies {
  readonly documents: Pick<DocumentEditor, 'open' | 'reveal'>;
  readonly applier: Pick<DraftEditApplier, 'apply'>;
  readonly log: LogSink;
}

const EDIT_LABEL = 'Prose Minion: suggested edit';

export class ProjectFileEditGateway {
  constructor(private readonly dependencies: ProjectFileEditGatewayDependencies) {}

  async apply(request: FileEditRequest, options: FileEditApplyOptions): Promise<FileEditOutcome> {
    const outcome = await this.run(request, options);
    this.dependencies.log.appendLine(logLine(request, outcome));
    return outcome;
  }

  private async run(request: FileEditRequest, options: FileEditApplyOptions): Promise<FileEditOutcome> {
    if (request.operations.length === 0) {
      return refused('no-operations');
    }
    const resolution = await resolveFileEditTarget(request.target, this.dependencies);
    if (resolution.kind === 'refused') {
      return refused(resolution.reason);
    }
    const { target } = resolution;
    const document = await this.dependencies.documents.open(target.locator);
    if (!document) {
      return refused('unreadable');
    }
    const fault = liveTextRefusal(document, target.excerptText);
    if (fault) {
      return refused(fault);
    }

    // From here to the apply nothing is awaited: the plan is placed in the text the applier checks.
    const policy = FILE_EDIT_TARGET_POLICIES[target.kind];
    const operations = request.operations.map((operation) => inLineEndings(operation, document.text));
    const plan = planTextEdits(document.text, operations, {
      allowsRewrite: policy.allowsRewrite,
      skipLeading: document.languageId === 'markdown' ? markdownFrontMatterEnd(document.text) : 0,
      separator: usesCrlf(document.text) ? '\r\n\r\n' : '\n\n'
    });
    if (plan.kind === 'faulted') {
      return notPlanned(plan.faults);
    }
    const policyFaults = fileEditPolicyFaults(document.text, operations, plan.operations, policy);
    if (policyFaults.length > 0) {
      return notPlanned(policyFaults);
    }
    const edits: DraftEditEdit[] = plan.edits.map((edit, index) => ({
      id: `edit-${index}`,
      start: edit.start,
      end: edit.end,
      original: document.text.slice(edit.start, edit.end),
      replacement: edit.text,
      label: EDIT_LABEL
    }));
    const result = await this.dependencies.applier.apply({
      document,
      edits,
      review: options.review,
      policy: {
        allowsNewlineChanges: policy.allowsNewlineChanges,
        preservesMarkdownStructure: policy.preservesMarkdownStructure,
        paragraphsMayMergeOrSplit: policy.paragraphsMayMergeOrSplit
      }
    });

    const landings = landingsByOperation(request.operations.length, plan.edits.map((edit) => edit.operations), result);
    const landed = result.applied.length > 0 && result.settled !== undefined;
    const revealed = landed ? await this.dependencies.documents.reveal((result.settled as NonNullable<DraftEditApplyResult['settled']>).snapshot.uri) : false;
    return {
      kind: 'settled',
      host: result.outcome,
      operations: landings,
      ...(result.settled ? { document: { uri: result.settled.snapshot.uri, version: result.settled.snapshot.version } } : {}),
      revealed,
      message: settledMessage(result, landings)
    };
  }
}

/** The live buffer, checked again: text, under the bound, and still holding the excerpt. */
function liveTextRefusal(document: DocumentSnapshot, excerptText: string | undefined): FileEditRefusal | undefined {
  if (document.text.includes('\u0000')) {
    return 'not-text';
  }
  if (Buffer.byteLength(document.text, 'utf8') > PROMPT_BUDGETS.workshopFileEdits.fileBytes) {
    return 'too-large';
  }
  if (excerptText !== undefined && !document.text.includes(inLineEndingsOf(excerptText, document.text))) {
    return 'excerpt-stale';
  }
  return undefined;
}

function usesCrlf(text: string): boolean {
  return text.includes('\r\n');
}

/** A model writes `\n`; in a document that ends its lines with `\r\n`, so does the edit. */
function inLineEndingsOf(value: string, text: string): string {
  return usesCrlf(text) ? value.replace(/\r?\n/g, '\r\n') : value;
}

function inLineEndings(operation: TextEditOperation, text: string): TextEditOperation {
  if (!usesCrlf(text)) {
    return operation;
  }
  return operation.op === 'replace'
    ? { op: 'replace', find: inLineEndingsOf(operation.find, text), with: inLineEndingsOf(operation.with, text) }
    : { ...operation, text: inLineEndingsOf(operation.text, text) };
}

/** Each operation's landing: its edit's, which every operation joined into that edit shares. */
function landingsByOperation(
  count: number,
  editOperations: ReadonlyArray<readonly number[]>,
  result: DraftEditApplyResult
): FileEditOperationLanding[] {
  const byEdit = new Map<string, FileEditOperationLanding['landing'] | DraftEditRefusal>();
  result.applied.forEach((id) => byEdit.set(id, 'applied'));
  result.notApplied.forEach(({ id }) => byEdit.set(id, 'not-applied'));
  result.unknown.forEach((id) => byEdit.set(id, 'unknown'));
  const refusals = new Map(result.refused.map(({ id, reason }) => [id, reason]));
  const landings: FileEditOperationLanding[] = [];
  for (let index = 0; index < count; index += 1) {
    const edit = editOperations.findIndex((operations) => operations.includes(index));
    const id = `edit-${edit}`;
    const reason = refusals.get(id);
    landings.push(reason
      ? { index, landing: 'refused', reason }
      : { index, landing: (byEdit.get(id) as 'applied' | 'not-applied' | 'unknown' | undefined) ?? 'unknown' });
  }
  return landings;
}

function settledMessage(result: DraftEditApplyResult, landings: readonly FileEditOperationLanding[]): string {
  const applied = landings.filter(({ landing }) => landing === 'applied').length;
  if (applied === landings.length) {
    return 'Applied. The file is not saved yet.';
  }
  if (applied > 0) {
    return `Applied ${applied} of ${landings.length} changes. The file is not saved yet.`;
  }
  const refusal = landings.find((landing): landing is Extract<FileEditOperationLanding, { landing: 'refused' }> => landing.landing === 'refused');
  if (refusal && result.outcome === 'nothing') {
    return applierRefusalMessage(refusal.reason);
  }
  switch (result.outcome) {
    case 'declined':
      return 'The review was discarded; nothing changed.';
    case 'stale':
    case 'changed':
      return 'The file changed while this was being applied; nothing changed.';
    case 'closed':
      return 'The file closed before the change landed.';
    default:
      return 'The editor did not apply the change.';
  }
}

function applierRefusalMessage(reason: DraftEditRefusal): string {
  switch (reason) {
    case 'protected':
      return 'This would change protected text (front matter, code, links or markup); nothing changed.';
    case 'markup':
      return 'This would change the passage’s Markdown structure; nothing changed.';
    case 'line-break':
      return 'This would change a line break; nothing changed.';
    case 'changed':
      return 'The file changed since this was suggested.';
    case 'overlapping':
      return 'The suggested changes overlap, so none was made.';
  }
}

function refused(reason: FileEditRefusal): FileEditOutcome {
  return { kind: 'refused', reason, message: fileEditRefusalMessage(reason) };
}

function notPlanned(faults: ReadonlyArray<{ readonly index: number; readonly fault: FileEditOperationFault }>): FileEditOutcome {
  return { kind: 'not-planned', faults, message: fileEditFaultMessage(faults) };
}

function logLine(request: FileEditRequest, outcome: FileEditOutcome): string {
  const target = request.target.kind === 'resource' ? `group=${request.target.group}` : 'excerpt';
  const head = `[FileEdit] turn=${request.source.turnId} index=${request.source.index} ${target} operations=${request.operations.length}`;
  switch (outcome.kind) {
    case 'refused':
      return `${head} refused=${outcome.reason}`;
    case 'not-planned':
      return `${head} not-planned=${[...new Set(outcome.faults.map(({ fault }) => fault))].join(',')}`;
    case 'settled':
      return `${head} host=${outcome.host} applied=${outcome.operations.filter(({ landing }) => landing === 'applied').length}` +
        ` revealed=${outcome.revealed}`;
  }
}
