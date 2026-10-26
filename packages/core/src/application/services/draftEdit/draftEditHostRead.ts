/**
 * What host code reads of the whole document for a Proofread run, before
 * any model is asked (ADR 2026-10-21, Amendment 2026-10-26: Slice 3b):
 *
 * - the narration baseline, sent beside each chunk (part 1);
 * - the keys of the writer's accepted words, the backstop that drops a
 *   `spelling` or `wrong-word` finding on one (part 2);
 * - the name variants, as host issues (part 2). A selection run reads the
 *   whole document but keeps only those inside its selection.
 *
 * Everything is read from the gesture's snapshot, as the model's findings
 * are, so both follow the writer's edits the same way. Logs name the run,
 * never the text.
 */

import type { LogSink } from '@/platform';
import type { DraftEditPass, DraftEditTarget } from '@/domain/models/DraftEdit';
import type { ProofreadHostCategory } from '@/domain/models/ProofreadIssue';
import { findProtectedRegions } from '@/utils/draftEdit/protectedRegions';
import { findNameVariants, type NameVariant } from '@/utils/proofread/nameConsistency';
import { measureNarrationBaseline, type NarrationBaseline } from '@/utils/proofread/narrationBaseline';
import { proofreadWordListKeys } from '@/utils/proofread/proofreadWordList';

/** An issue host code found, placed in the gesture's snapshot; placement gives it an id. */
export interface DraftEditHostFinding {
  readonly category: ProofreadHostCategory;
  readonly start: number;
  readonly end: number;
  readonly original: string;
  readonly replacement?: string;
  readonly explanation: string;
}

export interface DraftEditHostRead {
  /** The whole document's narration; absent when nothing is clear, or the tagger could not load. */
  readonly narration?: NarrationBaseline;
  /** The writer's accepted words, as compared (`proofreadWordKey`). */
  readonly accepted: ReadonlySet<string>;
  /** Host issues inside the run's region, in order. */
  readonly findings: readonly DraftEditHostFinding[];
}

export function readWholeDocument(target: DraftEditTarget, pass: DraftEditPass, log: LogSink, label: string): DraftEditHostRead {
  const protectedRegions = findProtectedRegions(target.text, target.languageId);
  const accepted = proofreadWordListKeys(pass.wordList ?? []);
  const region = target.range ?? { start: 0, end: target.text.length };
  const names = findNameVariants(target.text, protectedRegions, accepted);
  if (names.kind === 'stopped') {
    log.appendLine(`[DraftEdit] Proofread ${label}: no name check (${names.names} capitalized words are too many to compare)`);
  }
  const findings = (names.kind === 'checked' ? names.variants : [])
    .filter((variant) => variant.start >= region.start && variant.end <= region.end)
    .map(nameFinding);
  const narration = narrationOf(target.text, protectedRegions, log, label);
  return { ...(narration ? { narration } : {}), accepted, findings };
}

function nameFinding(variant: NameVariant): DraftEditHostFinding {
  const uses = variant.variantUses === 1 ? 'once' : 'twice';
  return {
    category: 'name',
    start: variant.start,
    end: variant.end,
    original: variant.variant,
    replacement: variant.name,
    explanation: `“${variant.variant}” appears ${uses} in this document, and “${variant.name}” ${variant.nameUses} times.`
      + ` If “${variant.variant}” is another name, add it to the Proofread word list.`
  };
}

/** A hint beside every chunk. A tagger that fails to load sends none, and the run goes on. */
function narrationOf(text: string, protectedRegions: ReturnType<typeof findProtectedRegions>, log: LogSink, label: string): NarrationBaseline | undefined {
  try {
    const narration = measureNarrationBaseline(text, protectedRegions);
    return narration.tense || narration.person ? narration : undefined;
  } catch (error) {
    log.appendLine(`[DraftEdit] Proofread ${label}: no narration baseline (${error instanceof Error ? error.message : String(error)})`);
    return undefined;
  }
}
