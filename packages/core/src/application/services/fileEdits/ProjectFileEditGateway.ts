/**
 * ProjectFileEditGateway: the one way a persona's edit reaches a project
 * file (ADR 2026-11-05 D7, D13). It is built only in `extension.ts` and
 * reached through `CoreServices`. It calls no model: every check is a host
 * rule, tested without one. It applies a staged proposal (D4), with the
 * handler's claim already held:
 *
 * 1. **Re-authorize the identity.** It must lie inside a current workspace
 *    folder with no symbolic link, and a file must still be a catalog
 *    member in a fresh every-candidate read.
 * 2. **Recompute the class.** Prose wins if it changed.
 * 3. **Open the document** (not shown) and read the live snapshot. Its URI
 *    must name the identity.
 * 4. **Plan** with the shared planner, then check freshness (D6) and the
 *    class policy (D5).
 * 5. **The last dispatch boundary.** The caller's authority predicate
 *    (`stillCurrent()`: the claim, the room generation, the setting), the
 *    authority epoch taken at re-authorization, and the synchronous
 *    containment check run with nothing awaited before the applier's call.
 * 6. **Apply through `DraftEditApplier`** with the class's structure mode
 *    and a `beforeAttempt` the applier runs synchronously immediately before
 *    every `applyEdits`, its retry included: the same authority checks, then
 *    freshness, the insertion bounds and the ceiling on the live text. A
 *    refused attempt writes nothing more and makes no further attempt.
 * 7. **Report by operation**, from the applier's result. `host-failed`
 *    means nothing was written: a failure before any `applyEdits`, or a
 *    read-back that found nothing landed. A failure after the applier was
 *    let through to `applyEdits` may follow a landing, so it reads
 *    `unknown` (D8, amended 2026-11-06), unless the read-back settled it
 *    first: a failure to show the document keeps the result.
 * 8. **Show the document** when something landed and no editor shows it.
 *
 * **An intent narrows** (ADR 2026-11-10 D6). A proposal staged with
 * `intent: 'fixes'` is held to `FILE_EDIT_INTENT_POLICIES` on top of its
 * class policy: checked with the class policy in step 4 and again before
 * every attempt, and applied with no line-break change and the `strict`
 * structure mode. A breach is `more-than-a-fix`, and nothing is written.
 *
 * Nothing is ever saved. Logs carry ids, counts and fault kinds, never the
 * text, a quote, a path or a URI.
 */

import type { DraftEditApplier, DraftEditApplyResult, DraftEditEdit } from '@/application/services/draftEdit/DraftEditApplier';
import { DEFAULT_CONTEXT_GROUPS, type ContextResourceCandidate, type ContextResourceCandidateReader } from '@/domain/models/ContextGeneration';
import {
  FILE_EDIT_INTENT_POLICIES,
  FILE_EDIT_TARGET_POLICIES,
  type FileEditApplyOptions,
  type FileEditApplyOutcome,
  type FileEditApplyPort,
  type FileEditClassPolicy,
  type FileEditOperationOutcome,
  type FileEditPreview,
  type FileEditApplyRefusal,
  type FileEditOperationFault,
  type StagedFileEdit
} from '@/domain/models/FileEdit';
import type { DocumentEditor, DocumentSnapshot } from '@/platform/DocumentEditor';
import type { FileEditAuthorityEpoch } from '@/platform/FileEditAuthorityEpoch';
import type { FileSystem } from '@/platform/FileSystem';
import type { LogSink } from '@/platform/LogSink';
import type { Workspace } from '@/platform/Workspace';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { planTextEdits } from '@/utils/textEdits/planTextEdits';
import type { TextEditOperation } from '@/utils/textEdits/textEditOperations';
import { fileEditOutcomeMessage } from './fileEditCopy';
import { fileEditLandedRecords } from './fileEditLandedRecords';
import {
  classOf,
  containedWithoutLinks,
  fileEditBaseline,
  fileEditContent,
  fileEditSkipLeading,
  fsPathOf,
  insideWorkspace,
  liveTextFault,
  membershipsOf,
  sameDocument,
  samePath,
  type FileEditExcerptPort
} from './fileEditIdentity';
import { changedCharacters, freshnessFaults, intentFaults, passesRewriteCeiling, policyFaults, type OperationFault } from './fileEditPolicyChecks';

export type { FileEditApplyOutcome, FileEditApplyState, FileEditOperationOutcome, FileEditPreview } from '@/domain/models/FileEdit';

/** Whether the applier was let through to `applyEdits`: set in `beforeAttempt`, immediately before the call. */
interface Dispatch {
  started: boolean;
}

type Resolution =
  | { readonly kind: 'refused'; readonly reason: FileEditApplyRefusal }
  | {
    readonly kind: 'resolved';
    readonly epoch: number;
    readonly fsPath: string;
    readonly policy: FileEditClassPolicy;
    readonly document: DocumentSnapshot;
  };

export interface ProjectFileEditGatewayDependencies {
  readonly candidates: ContextResourceCandidateReader;
  readonly excerpt: FileEditExcerptPort;
  readonly workspace: Pick<Workspace, 'workspaceFolders'>;
  readonly fileSystem: Pick<FileSystem, 'stat'>;
  readonly documents: Pick<DocumentEditor, 'open' | 'reveal'>;
  readonly applier: Pick<DraftEditApplier, 'apply'>;
  readonly epoch: FileEditAuthorityEpoch;
  readonly log: LogSink;
}

const EDIT_LABEL = 'Prose Minion: suggested edit';
const STALE_FAULTS: ReadonlySet<string> = new Set(['not-found', 'ambiguous', 'baseline-changed']);

export class ProjectFileEditGateway implements FileEditApplyPort {
  constructor(private readonly dependencies: ProjectFileEditGatewayDependencies) {}

  async apply(staged: StagedFileEdit, options: FileEditApplyOptions): Promise<FileEditApplyOutcome> {
    const dispatch: Dispatch = { started: false };
    let outcome: FileEditApplyOutcome;
    try {
      outcome = await this.run(staged, options, dispatch);
    } catch {
      // Before any `applyEdits`, nothing was written, and the card may be applied again; after one, a landing may have
      // followed, so it is not known (ADR D8, amended 2026-11-06).
      outcome = dispatch.started ? notKnown(staged) : whole(staged, 'refused', 'host-failed');
      this.dependencies.log.appendLine(`[FileEdit] apply threw turn=${staged.source.turnId} index=${staged.source.index} ` +
        `dispatched=${dispatch.started}`);
    }
    this.dependencies.log.appendLine(logLine(staged, outcome));
    return outcome;
  }

  /**
   * A rewrite's before and after for its card (D6, D9): the live content
   * the rewrite would replace, read through Apply's own resolution (steps
   * 1–3), only while the baseline holds; otherwise `stale`. It writes
   * nothing and logs counts only.
   */
  async preview(staged: StagedFileEdit): Promise<FileEditPreview> {
    let preview: FileEditPreview;
    try {
      preview = await this.readPreview(staged);
    } catch {
      preview = { kind: 'refused', reason: 'host-failed' };
    }
    this.dependencies.log.appendLine(`[FileEdit] preview turn=${staged.source.turnId} index=${staged.source.index} ` +
      `target=${staged.target.kind} result=${preview.kind}${preview.kind === 'refused' ? ` reason=${preview.reason}` : ''}`);
    return preview;
  }

  private async readPreview(staged: StagedFileEdit): Promise<FileEditPreview> {
    const rewrite = staged.operations.length === 1 && staged.operations[0].op === 'rewrite' ? staged.operations[0] : undefined;
    if (!rewrite) {
      return { kind: 'refused', reason: 'not-a-rewrite' };
    }
    const resolved = await this.resolve(staged);
    if (resolved.kind === 'refused') {
      return resolved;
    }
    const { document, fsPath } = resolved;
    const live = fileEditBaseline(document.text, fsPath);
    if (live.sha256 !== staged.baseline.sha256 || live.length !== staged.baseline.length) {
      return { kind: 'stale', reason: 'baseline-changed' };
    }
    return { kind: 'rewrite', before: fileEditContent(document.text, fsPath), after: rewrite.text };
  }

  /** Steps 1–3: the identity re-authorized, the class recomputed, the document opened and read. */
  private async resolve(staged: StagedFileEdit): Promise<Resolution> {
    const { dependencies } = this;
    // 1. Re-authorize the recorded identity, under the epoch it is read at.
    const epoch = dependencies.epoch.current();
    const fsPath = fsPathOf(staged.target.documentUri);
    if (!fsPath) {
      return { kind: 'refused', reason: 'outside-workspace' };
    }
    let candidates: ContextResourceCandidate[];
    try {
      candidates = await dependencies.candidates.listCandidates(DEFAULT_CONTEXT_GROUPS);
    } catch {
      return { kind: 'refused', reason: 'catalog-unreadable' };
    }
    const memberships = membershipsOf(candidates, fsPath);
    if (staged.target.kind === 'file' && memberships.length === 0) {
      return { kind: 'refused', reason: 'no-longer-configured' };
    }
    if (!(await containedWithoutLinks(fsPath, dependencies.workspace, dependencies.fileSystem))) {
      return { kind: 'refused', reason: 'outside-workspace' };
    }
    // 2. Recompute the class: prose wins.
    const excerpt = await dependencies.excerpt.currentDocument();
    const isExcerptDocument = staged.target.kind === 'excerpt' || (excerpt !== undefined && samePath(excerpt.fsPath, fsPath));
    const kind = staged.class === 'prose' ? 'prose' : classOf(memberships, isExcerptDocument);

    // 3. Open the document; its URI must name the identity.
    const document = await dependencies.documents.open(staged.target.documentUri);
    if (!document) {
      return { kind: 'refused', reason: 'unreadable' };
    }
    if (!sameDocument(document.uri, staged.target.documentUri)) {
      return { kind: 'refused', reason: 'identity-changed' };
    }
    const textFault = liveTextFault(document.text, PROMPT_BUDGETS.workshopFileEdits.fileBytes);
    if (textFault) {
      return { kind: 'refused', reason: textFault };
    }
    return { kind: 'resolved', epoch, fsPath, policy: FILE_EDIT_TARGET_POLICIES[kind], document };
  }

  private async run(staged: StagedFileEdit, options: FileEditApplyOptions, dispatch: Dispatch): Promise<FileEditApplyOutcome> {
    const { dependencies } = this;
    if (staged.operations.length === 0) {
      return whole(staged, 'refused', 'no-operations');
    }
    const resolved = await this.resolve(staged);
    if (resolved.kind === 'refused') {
      return whole(staged, 'refused', resolved.reason);
    }
    const { epoch, fsPath, document } = resolved;
    // An intent only narrows its class's policy (ADR 2026-11-10 D6).
    const intent = staged.intent ? FILE_EDIT_INTENT_POLICIES[staged.intent] : undefined;
    const policy: FileEditClassPolicy = intent
      ? { ...resolved.policy, allowsRewrite: false, allowsNewlineChanges: intent.allowsNewlineChanges, structure: intent.structure }
      : resolved.policy;

    // From here to the applier's call nothing is awaited.
    // 4. Plan, then freshness and the policy.
    const operations = staged.operations.map((operation) => inLineEndings(operation, document.text));
    // The intent's policy reads only the operations, so it is checked before the plan: a rewrite it refuses is its fault.
    const beyondIntent = intentFaults(operations, intent);
    if (beyondIntent.length > 0) {
      return faulted(staged, beyondIntent);
    }
    const plan = planTextEdits(document.text, operations, {
      allowsRewrite: policy.allowsRewrite,
      skipLeading: fileEditSkipLeading(document.text, fsPath),
      separator: usesCrlf(document.text) ? '\r\n\r\n' : '\n\n'
    });
    if (plan.kind === 'faulted') {
      return faulted(staged, plan.faults);
    }
    const faults = [
      ...freshnessFaults(document.text, fsPath, operations, staged.baseline),
      ...policyFaults(document.text, fsPath, document.languageId, operations, policy)
    ];
    if (faults.length > 0) {
      return faulted(staged, faults);
    }
    const edits: DraftEditEdit[] = plan.edits.map((edit, index) => ({
      id: `edit-${index}`,
      start: edit.start,
      end: edit.end,
      original: document.text.slice(edit.start, edit.end),
      replacement: edit.text,
      label: EDIT_LABEL
    }));
    // Each replace's change is fixed; where it stands moves with its edit.
    const changes = new Map(operations.flatMap((operation, index) =>
      operation.op === 'replace' ? [[index, changedCharacters(operation.find, operation.with)] as const] : []));
    const replacesIn = (placed: ReadonlyArray<{ readonly id: string; readonly start: number; readonly end: number }>) =>
      placed.flatMap((edit) => (plan.edits[Number(edit.id.slice('edit-'.length))]?.operations ?? [])
        .filter((index) => changes.has(index))
        .map((index) => ({ start: edit.start, end: edit.end, changed: changes.get(index) as number })));
    if (!passesRewriteCeiling(document.text, replacesIn(edits), policy.ceiling)) {
      return faulted(staged, [...changes.keys()].map((index) => ({ index, fault: 'rewrite-ceiling' as const })));
    }

    // 5. The last dispatch boundary: authority, synchronously.
    const authority = (): FileEditApplyRefusal | undefined => {
      if (!options.stillCurrent()) {
        return 'superseded';
      }
      if (dependencies.epoch.current() !== epoch) {
        return 'authority-changed';
      }
      return insideWorkspace(fsPath, dependencies.workspace) ? undefined : 'outside-workspace';
    };
    const refusal = authority();
    if (refusal) {
      return whole(staged, 'refused', refusal);
    }

    // 6. Apply; before every attempt, authority and then the text, on the live document.
    const result = await dependencies.applier.apply({
      document,
      edits,
      review: options.review,
      policy: { allowsNewlineChanges: policy.allowsNewlineChanges, structure: policy.structure },
      beforeAttempt: (live, moved) => {
        const lost = authority();
        if (lost) {
          return lost;
        }
        const fault = freshnessFaults(live.text, fsPath, operations, staged.baseline)[0]
          ?? policyFaults(live.text, fsPath, live.languageId, operations, policy)[0]
          ?? intentFaults(operations, intent)[0];
        if (fault) {
          return fault.fault;
        }
        if (!passesRewriteCeiling(live.text, replacesIn(moved), policy.ceiling)) {
          return 'rewrite-ceiling';
        }
        // The applier calls `applyEdits` next, synchronously: from here a failure may follow a landing.
        dispatch.started = true;
        return undefined;
      }
    });

    // 7. Report; 8. show.
    const reported = report(staged, plan.edits.map((edit) => edit.operations), result);
    const landedOperations = new Set(reported.operations.flatMap(({ index, outcome }) => outcome === 'landed' ? [index] : []));
    const landed = landedOperations.size > 0;
    // The read-back has settled what landed; showing the document cannot change that, so its failure keeps the result
    // (PR #236 N-01). Only a throw before this point, whose landing the read-back did not settle, reads `unknown`.
    const revealed = landed && result.settled ? await this.reveal(staged, result.settled.snapshot.uri) : false;
    return {
      ...reported,
      ...(landed
        ? { landed: fileEditLandedRecords(document.text, plan.edits, plan.operations, landedOperations, result.settled?.snapshot.version) }
        : {}),
      ...(result.settled ? { document: { uri: result.settled.snapshot.uri, version: result.settled.snapshot.version } } : {}),
      revealed,
      message: fileEditOutcomeMessage(reported.state, reported.reason, reported.operations.map(({ outcome }) => outcome))
    };
  }

  /** Step 8: show the document. A failure is logged (ids only) and reads as not shown. */
  private async reveal(staged: StagedFileEdit, uri: string): Promise<boolean> {
    try {
      return await this.dependencies.documents.reveal(uri);
    } catch {
      this.dependencies.log.appendLine(`[FileEdit] reveal failed turn=${staged.source.turnId} index=${staged.source.index}`);
      return false;
    }
  }
}

function usesCrlf(text: string): boolean {
  return text.includes('\r\n');
}

/** A model writes `\n`; in a document whose lines end `\r\n`, so does the edit. */
function inLineEndings(operation: TextEditOperation, text: string): TextEditOperation {
  if (!usesCrlf(text)) {
    return operation;
  }
  const crlf = (value: string) => value.replace(/\r?\n/g, '\r\n');
  return operation.op === 'replace'
    ? { op: 'replace', find: crlf(operation.find), with: crlf(operation.with) }
    : { ...operation, text: crlf(operation.text) };
}

/** One state for the whole proposal: every operation shares it. */
function whole(staged: StagedFileEdit, state: 'refused' | 'stale', reason: FileEditApplyRefusal | FileEditOperationFault): FileEditApplyOutcome {
  return {
    state,
    reason,
    operations: staged.operations.map((_, index) => ({ index, outcome: state, reason })),
    revealed: false,
    message: fileEditOutcomeMessage(state, reason)
  };
}

/** A failure after `applyEdits` was called: whether anything landed is not known, operation by operation. */
function notKnown(staged: StagedFileEdit): FileEditApplyOutcome {
  return {
    state: 'unknown',
    operations: staged.operations.map((_, index) => ({ index, outcome: 'unknown' })),
    revealed: false,
    message: fileEditOutcomeMessage('unknown')
  };
}

/** Nothing written: stale when any operation is no longer fresh, else refused. */
function faulted(staged: StagedFileEdit, faults: ReadonlyArray<OperationFault | { readonly index: number; readonly fault: string }>): FileEditApplyOutcome {
  const stale = faults.find(({ fault }) => STALE_FAULTS.has(fault));
  const first = stale ?? faults[0];
  const state = stale ? 'stale' : 'refused';
  const byIndex = new Map<number, string>();
  faults.forEach(({ index, fault }) => byIndex.set(index, byIndex.get(index) ?? fault));
  return {
    state,
    reason: first.fault,
    operations: staged.operations.map((_, index) => byIndex.has(index)
      ? { index, outcome: STALE_FAULTS.has(byIndex.get(index) as string) ? 'stale' : 'refused', reason: byIndex.get(index) }
      : { index, outcome: 'not-applied' }),
    revealed: false,
    message: fileEditOutcomeMessage(state, first.fault)
  };
}

/** Each operation's outcome from its edit's, and the card's state from them. */
function report(
  staged: StagedFileEdit,
  editOperations: ReadonlyArray<readonly number[]>,
  result: DraftEditApplyResult
): Pick<FileEditApplyOutcome, 'state' | 'reason' | 'operations'> {
  const byEdit = new Map<string, FileEditOperationOutcome['outcome']>();
  result.applied.forEach((id) => byEdit.set(id, 'landed'));
  result.notApplied.forEach(({ id }) => byEdit.set(id, 'not-applied'));
  result.unknown.forEach((id) => byEdit.set(id, 'unknown'));
  const refusals = new Map(result.refused.map(({ id, reason }) => [id, reason]));
  const operations = staged.operations.map((_, index): FileEditOperationOutcome => {
    const id = `edit-${editOperations.findIndex((members) => members.includes(index))}`;
    const refusal = refusals.get(id);
    if (refusal) {
      return { index, outcome: 'refused', reason: refusal };
    }
    const established = byEdit.get(id);
    if (result.outcome === 'before-attempt' && established === 'not-applied') {
      // The refused attempt applies only to edits still waiting for it; what earlier attempts established stands (PR #229 F-03).
      return { index, outcome: STALE_FAULTS.has(result.beforeAttempt ?? '') ? 'stale' : 'refused', reason: result.beforeAttempt };
    }
    return { index, outcome: established ?? 'unknown' };
  });
  const landed = operations.filter(({ outcome }) => outcome === 'landed').length;
  if (landed === operations.length) {
    return { state: 'applied', operations };
  }
  if (landed > 0) {
    return { state: 'partial', operations };
  }
  if (operations.some(({ outcome }) => outcome === 'unknown') || result.outcome === 'closed') {
    return { state: 'unknown', operations };
  }
  if (result.outcome === 'before-attempt') {
    return { state: STALE_FAULTS.has(result.beforeAttempt ?? '') ? 'stale' : 'refused', reason: result.beforeAttempt, operations };
  }
  switch (result.outcome) {
    case 'declined':
    case 'submitted':
      // A discarded preview, or one with nothing ticked: nothing was written.
      return { state: 'declined', operations };
    case 'stale':
    case 'changed':
      return { state: 'stale', reason: 'document-changed', operations };
    case 'failed':
      // The read-back found nothing landed and nothing unknown (both checked above): nothing was written.
      return { state: 'refused', reason: 'host-failed', operations };
    default: {
      const refusal = operations.find(({ outcome }) => outcome === 'refused');
      return { state: 'refused', reason: refusal?.reason ?? 'refused', operations };
    }
  }
}

function logLine(staged: StagedFileEdit, outcome: FileEditApplyOutcome): string {
  const landed = outcome.operations.filter(({ outcome: each }) => each === 'landed').length;
  return `[FileEdit] apply turn=${staged.source.turnId} index=${staged.source.index} target=${staged.target.kind} class=${staged.class} ` +
    `operations=${staged.operations.length} state=${outcome.state}${outcome.reason ? ` reason=${outcome.reason}` : ''} ` +
    `landed=${landed} revealed=${outcome.revealed}`;
}
