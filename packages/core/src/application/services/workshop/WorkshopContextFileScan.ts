/**
 * The check a context refresh makes of each file-backed attachment: is the
 * file still authorized, does it still read, and does it read differently?
 * A room's open and a manual Refresh both run it, inside the room operation
 * they already run in; this module adds no ordering of its own and checks the
 * files one after another, as before.
 *
 * **One catalog per scan.** Every file's authorization shares the scan's
 * `WorkshopIntakeCatalogScope`, so the project's catalog is built once per
 * scan, not once per attachment (tech debt 2026-11-18). Each file's own
 * checks (containment, no symbolic link, the load's bounds) still run per
 * file.
 *
 * The scan writes one log line, counts and milliseconds only: never a path,
 * a label or a file's text.
 */

import type { LogSink } from '@/platform';
import type {
  WorkshopContextAttachment,
  WorkshopContextFileRefreshInput
} from '@/application/services/workshop/WorkshopSessionRecords';
import type { WorkshopContextIntakeService } from '@/application/services/workshop/WorkshopContextIntakeService';
import { workshopIntakeCatalogScope } from '@/application/services/workshop/WorkshopIntakeCatalogScope';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { WorkshopExcerptSource } from '@messages';

export type WorkshopContextFileScanIntake = Pick<
  WorkshopContextIntakeService,
  'openCatalog' | 'authorizeExcerptReread' | 'loadFile' | 'boundText'
>;

export interface WorkshopContextFileScanResult {
  readonly updates: Array<WorkshopContextFileRefreshInput & { label: string }>;
  /** The writer's words for each file that could not be checked: label and reason, for the status line. */
  readonly failures: string[];
  readonly truncated: string[];
}

/** The scan's one log line: counts and duration, never a path or a name. */
export function workshopContextFileScanLogLine(
  origin: 'manual' | 'session-open',
  counts: { checked: number; changed: number; refused: number },
  milliseconds: number
): string {
  return `[WorkshopContextHandler] Context scan (${origin}): ${counts.checked} checked, `
    + `${counts.changed} changed, ${counts.refused} refused, ${milliseconds} ms`;
}

export async function scanWorkshopContextFiles(
  intake: WorkshopContextFileScanIntake,
  log: LogSink,
  origin: 'manual' | 'session-open',
  attachments: readonly WorkshopContextAttachment[],
  contextWordsUsed: number,
  now: () => number = Date.now
): Promise<WorkshopContextFileScanResult> {
  const started = now();
  const scope = workshopIntakeCatalogScope(intake);
  let provisionalWords = contextWordsUsed;
  const updates: WorkshopContextFileScanResult['updates'] = [];
  const failures: string[] = [];
  const truncated: string[] = [];

  for (const attachment of attachments) {
    if (!attachment.sourceUri) {
      failures.push(`${attachment.label} (source unavailable)`);
      continue;
    }
    const source: Extract<WorkshopExcerptSource, { kind: 'file' }> = {
      kind: 'file',
      sourceUri: attachment.sourceUri,
      relativePath: attachment.relativePath ?? attachment.label,
      ...(attachment.configuredResource
        ? { configuredResource: { ...attachment.configuredResource } }
        : {})
    };
    const authorization = await intake.authorizeExcerptReread(source, scope);
    if (authorization.kind === 'refused') {
      failures.push(`${attachment.label} (${authorization.message})`);
      continue;
    }
    const loaded = await intake.loadFile(
      authorization.fsPath,
      authorization.source.relativePath,
      {
        maxBytes: PROMPT_BUDGETS.contextAttachments.fileBytes,
        maxWords: PROMPT_BUDGETS.contextAttachments.words
      },
      'attach'
    );
    if (loaded.kind === 'refused') {
      failures.push(`${attachment.label} (${loaded.refusal.message})`);
      continue;
    }

    // The refreshed attachment takes the old one's slot in the aggregate.
    // A changed file can therefore grow only into genuinely free capacity.
    const availableWords = PROMPT_BUDGETS.contextAttachments.words
      - (provisionalWords - attachment.words);
    const totalWords = loaded.file.truncation?.totalWords ?? loaded.file.words;
    const bounded = intake.boundText(loaded.file.text, availableWords, totalWords);
    if (bounded.text === attachment.content) {
      continue;
    }
    provisionalWords = provisionalWords - attachment.words + bounded.words;
    if (bounded.truncation) {
      truncated.push(
        `${attachment.label} (${bounded.truncation.keptWords.toLocaleString('en-US')} of ${bounded.truncation.totalWords.toLocaleString('en-US')} words)`
      );
    }
    updates.push({
      id: attachment.id,
      label: attachment.label,
      content: bounded.text,
      words: bounded.words,
      truncation: bounded.truncation,
      sourceUri: authorization.source.sourceUri,
      relativePath: authorization.source.relativePath,
      configuredResource: authorization.source.configuredResource
    });
  }

  log.appendLine(workshopContextFileScanLogLine(
    origin,
    { checked: attachments.length, changed: updates.length, refused: failures.length },
    Math.max(0, Math.round(now() - started))
  ));
  return { updates, failures, truncated };
}
