/**
 * Pure rules and derived state for the Show vs. Tell authoring controller.
 *
 * Everything here is a deterministic function of its arguments: notices,
 * intake normalization, source and blocker derivation, keep ordering, and the
 * payload projection. The controller owns the state machine and the
 * transport-free effects; it composes these so each rule can be audited and
 * tested on its own.
 */

import type {
  SelectionDataPayload,
  WorkshopContextAttachmentSnapshot,
  WorkshopExcerptSnapshot,
  WorkshopShowVsTellBeat,
  WorkshopShowVsTellChannel,
  WorkshopShowVsTellDraft,
  WorkshopShowVsTellGenerationProgressPayload
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  SHOW_VS_TELL_CHANNELS,
  SHOW_VS_TELL_DEFAULTS
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellContinuum';
import {
  showVsTellSourceReferenceKey,
  showVsTellWorkupVariants
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellDerivations';
import {
  buildShowVsTellArtifact
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellArtifact';
import type {
  ShowVsTellArtifactUsage,
  ShowVsTellAvailableSource,
  ShowVsTellCommitBlocker,
  ShowVsTellGenerateBlocker
} from '@components/workshop/widgets/showVsTell/showVsTellAuthoringTypes';

const BUDGET = PROMPT_BUDGETS.workshopWidgets;

export function createShowVsTellAuthoringDraft(): WorkshopShowVsTellDraft {
  return {
    beat: { text: '', provenance: { kind: 'pasted' } },
    surroundingContext: { sourceReferences: [] },
    pov: { ...SHOW_VS_TELL_DEFAULTS.pov },
    invariants: { mustSurvive: '', mustNotChange: '' },
    channels: [...SHOW_VS_TELL_DEFAULTS.channels],
    lengthBudget: SHOW_VS_TELL_DEFAULTS.lengthBudget,
    position: SHOW_VS_TELL_DEFAULTS.position,
    workup: null,
    kept: [],
    note: ''
  };
}

const LINE_BREAK_RUN = /\s*(?:\r\n|[\r\n\u2028\u2029])+\s*/gu;

/** A beat, a focal character, and the note are single-line fields. */
export function collapseShowVsTellLineBreaks(text: string): string {
  return text.replace(LINE_BREAK_RUN, ' ');
}

export type ShowVsTellInputLabel =
  | 'beat'
  | 'surrounding passage source'
  | 'point of view'
  | '“Must survive” constraint'
  | '“Must not change” constraint'
  | 'channels'
  | 'length budget'
  | 'widget model'
  | 'room';

export function changedWorkNotice(
  label: ShowVsTellInputLabel,
  hadActiveGeneration: boolean,
  hadSettledWork: boolean
): string | null {
  if (hadSettledWork) {
    return `Generated workup cleared because the ${label} changed.`;
  }
  return hadActiveGeneration
    ? `Generation cancelled because the ${label} changed.`
    : null;
}

export function generationDetail(progress: WorkshopShowVsTellGenerationProgressPayload): string {
  switch (progress.stage) {
    case 'requesting':
      return 'Requesting the workup';
    case 'workup':
      return `Receiving the workup · ${progress.outputCharacters.toLocaleString()} characters`;
    case 'validating':
      return 'Validating the closed response';
  }
}

export function sameBeat(left: WorkshopShowVsTellBeat, right: WorkshopShowVsTellBeat): boolean {
  if (left.text !== right.text || left.provenance.kind !== right.provenance.kind) {
    return false;
  }
  if (left.provenance.kind === 'excerpt' && right.provenance.kind === 'excerpt') {
    return left.provenance.relativePath === right.provenance.relativePath
      && left.provenance.startLine === right.provenance.startLine
      && left.provenance.endLine === right.provenance.endLine;
  }
  if (left.provenance.kind === 'persona-prefill' && right.provenance.kind === 'persona-prefill') {
    return left.provenance.personaId === right.provenance.personaId
      && left.provenance.editedByWriter === right.provenance.editedByWriter;
  }
  return true;
}

export const hasSettledWork = (draft: WorkshopShowVsTellDraft): boolean =>
  draft.workup !== null || draft.kept.length > 0;


/**
 * A selection becomes a beat: line breaks collapse to spaces, and the text is
 * shortened to the beat budget with a visible notice. Display-safe provenance:
 * the editor URI is dropped; the relative path and line range stay. Clipboard
 * intake carries no range and is recorded as pasted.
 */
export function beatFromSelection(
  payload: Pick<
    SelectionDataPayload,
    'content' | 'sourceUri' | 'relativePath' | 'startLine' | 'endLine'
  >
): { beat: WorkshopShowVsTellBeat; notice: string | null } {
  const collapsed = collapseShowVsTellLineBreaks(payload.content).trim();
  const limit = BUDGET.showVsTellBeatCharacters;
  const provenance = payload.sourceUri && payload.relativePath
    ? {
        kind: 'excerpt' as const,
        relativePath: payload.relativePath,
        ...(payload.startLine !== undefined ? { startLine: payload.startLine } : {}),
        ...(payload.endLine !== undefined ? { endLine: payload.endLine } : {})
      }
    : { kind: 'pasted' as const };
  return {
    beat: { text: collapsed.slice(0, limit).trim(), provenance },
    notice: collapsed.length > limit
      ? `That selection was longer than ${limit} characters, so the beat holds its first ${limit}. A beat is one line — use Creative Variations for a passage.`
      : null
  };
}

/**
 * The beat after the writer edits its text. Editing seeded text follows
 * Creative Variations' provenance-flip rule: an excerpt-seeded beat becomes
 * pasted, and a persona-prepared one records that the writer changed it.
 */
export function beatWithEditedText(beat: WorkshopShowVsTellBeat, text: string): WorkshopShowVsTellBeat {
  const provenance = beat.provenance;
  return {
    text,
    provenance: provenance.kind === 'excerpt'
      ? { kind: 'pasted' }
      : provenance.kind === 'persona-prefill'
        ? { ...provenance, editedByWriter: true }
        : provenance
  };
}

/**
 * Toggles one channel. The last selected channel cannot be turned off (the
 * same array comes back), and the result is stored in the fixed channel order
 * whatever order the writer clicked.
 */
export function toggledShowVsTellChannels(
  channels: readonly WorkshopShowVsTellChannel[],
  channel: WorkshopShowVsTellChannel
): WorkshopShowVsTellChannel[] {
  const selected = channels.includes(channel);
  if (selected && channels.length === 1) {
    return channels as WorkshopShowVsTellChannel[];
  }
  const wanted = selected
    ? channels.filter((candidate) => candidate !== channel)
    : [...channels, channel];
  return SHOW_VS_TELL_CHANNELS
    .map((descriptor) => descriptor.id)
    .filter((id) => wanted.includes(id));
}

/**
 * Toggles one kept variant. A newly kept variant carries direction only, kept
 * variants are stored in workup order, and a variant outside the workup is
 * ignored (the same draft comes back).
 */
export function toggledShowVsTellKeep(
  draft: WorkshopShowVsTellDraft,
  variantId: string
): WorkshopShowVsTellDraft {
  const variants = draft.workup ? showVsTellWorkupVariants(draft.workup) : [];
  if (!variants.some((variant) => variant.id === variantId)) {
    return draft;
  }
  const kept = draft.kept.some((entry) => entry.variantId === variantId)
    ? draft.kept.filter((entry) => entry.variantId !== variantId)
    : [...draft.kept, { variantId, carryMode: SHOW_VS_TELL_DEFAULTS.carryMode }];
  const order = new Map(variants.map((variant, index) => [variant.id, index]));
  return {
    ...draft,
    kept: [...kept].sort(
      (left, right) => (order.get(left.variantId) ?? 0) - (order.get(right.variantId) ?? 0)
    )
  };
}

/** The room sources a writer may ground the beat on: the active excerpt and each attachment. */
export function deriveShowVsTellAvailableSources(
  activeExcerpt: WorkshopExcerptSnapshot | null,
  contextAttachments: readonly WorkshopContextAttachmentSnapshot[]
): ShowVsTellAvailableSource[] {
  return [
    ...(activeExcerpt
      ? [{
          reference: { kind: 'active-excerpt' } as const,
          label: 'Active excerpt',
          detail: activeExcerpt.source.kind === 'manual'
            ? `Pasted Workshop passage · version ${activeExcerpt.version}`
            : `${activeExcerpt.source.relativePath} · version ${activeExcerpt.version}`
        }]
      : []),
    ...contextAttachments.map((attachment) => ({
      reference: { kind: 'context-attachment' as const, attachmentId: attachment.id },
      label: attachment.label,
      detail: `${attachment.kind === 'file' ? attachment.relativePath ?? 'Project file' : 'Workshop text'} · ${attachment.words.toLocaleString()} words`
    }))
  ];
}

/** Why Generate is unavailable: a blank beat or must survive, or a source the room no longer offers. */
export function deriveShowVsTellGenerateBlockers(
  draft: WorkshopShowVsTellDraft,
  availableSources: readonly ShowVsTellAvailableSource[]
): ShowVsTellGenerateBlocker[] {
  const blockers: ShowVsTellGenerateBlocker[] = [];
  if (draft.beat.text.trim().length === 0) {
    blockers.push('beat-required');
  }
  if (draft.invariants.mustSurvive.trim().length === 0) {
    blockers.push('must-survive-required');
  }
  const reference = draft.surroundingContext.sourceReferences[0];
  if (
    reference !== undefined
    && !availableSources.some((source) =>
      showVsTellSourceReferenceKey(source.reference) === showVsTellSourceReferenceKey(reference))
  ) {
    blockers.push('source-unavailable');
  }
  return blockers;
}

export interface ShowVsTellArtifactProjection {
  usage: ShowVsTellArtifactUsage | null;
  error: unknown | null;
}

/**
 * The meter's value: the same pure projection the host re-checks with. No
 * usage until a variant is kept; a kept variant outside the workup surfaces as
 * `error` so the controller can block rather than miscount.
 */
export function projectShowVsTellArtifact(
  draft: WorkshopShowVsTellDraft
): ShowVsTellArtifactProjection {
  if (draft.kept.length === 0) {
    return { usage: null, error: null };
  }
  try {
    const text = buildShowVsTellArtifact(draft);
    return {
      usage: { text, characters: text.length, budget: BUDGET.showVsTellArtifactCharacters },
      error: null
    };
  } catch (error) {
    return { usage: null, error };
  }
}

/** Why Commit is unavailable, most important first; `commit-not-wired` ends the list until Slice 4. */
export function deriveShowVsTellCommitBlockers(input: {
  generating: boolean;
  draft: WorkshopShowVsTellDraft;
  projection: ShowVsTellArtifactProjection;
}): ShowVsTellCommitBlocker[] {
  const { generating, draft, projection } = input;
  const blockers: ShowVsTellCommitBlocker[] = [];
  if (generating) {
    blockers.push('generation-in-flight');
  }
  if (!draft.workup) {
    blockers.push('no-workup');
  } else if (draft.kept.length === 0) {
    blockers.push('no-keep');
  }
  if (projection.error !== null) {
    blockers.push('artifact-compilation-failed');
  }
  if (projection.usage && projection.usage.characters > projection.usage.budget) {
    blockers.push('over-artifact-budget');
  }
  // Slice 4 wires the commit route and removes this entry.
  blockers.push('commit-not-wired');
  return blockers;
}
