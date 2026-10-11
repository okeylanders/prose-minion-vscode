/**
 * Pure rules and derived state for the Show vs. Tell authoring controller.
 *
 * Everything here is a deterministic function of its arguments: notices,
 * beat intake normalization, keep ordering, and the payload projection. The
 * surrounding passage and context-source rules live beside this file in
 * `showVsTellSourceRules.ts`. The controller owns the state machine and the
 * transport-free effects; it composes these so each rule can be audited and
 * tested on its own.
 */

import type {
  SelectionDataPayload,
  WorkshopShowVsTellBeat,
  WorkshopShowVsTellCarryMode,
  WorkshopShowVsTellChannel,
  WorkshopShowVsTellDraft,
  WorkshopShowVsTellGenerationProgressPayload,
  WorkshopPersonaId,
  WorkshopShowVsTellPovMode,
  WorkshopShowVsTellRecommendationSeed
} from '@messages';
import type {
  WorkshopShowVsTellOpening
} from '@hooks/domain/workshop/controllers/useWorkshopWidgetOpening';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  SHOW_VS_TELL_CHANNELS,
  SHOW_VS_TELL_DEFAULTS
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellContinuum';
import {
  showVsTellWorkupVariants
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellDerivations';
import {
  buildShowVsTellArtifact
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellArtifact';
import {
  showVsTellCommitIssues,
  type ShowVsTellCommitIssueCode
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellCommitEligibility';
import type {
  ShowVsTellArtifactUsage,
  ShowVsTellCommitBlocker
} from '@components/workshop/widgets/showVsTell/showVsTellAuthoringTypes';

const BUDGET = PROMPT_BUDGETS.workshopWidgets;

export function createShowVsTellAuthoringDraft(): WorkshopShowVsTellDraft {
  return {
    beat: { text: '', provenance: { kind: 'pasted' } },
    surroundingContext: { writerText: '', sourceReferences: [] },
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

/**
 * The draft a persona recommendation opens: the seed's inputs and nothing
 * else. Anything the persona left out opens on the feature defaults (a blank
 * must survive declares no constraint, D3), and the draft carries no workup,
 * kept variants, or note. POV is plain writer input from here on (Q3), so
 * only the beat keeps persona custody. The seed's context text opens as the
 * writer's surrounding passage (D2).
 */
export function createShowVsTellSeededDraft(
  seed: WorkshopShowVsTellRecommendationSeed,
  personaId: WorkshopPersonaId
): WorkshopShowVsTellDraft {
  const fresh = createShowVsTellAuthoringDraft();
  return {
    ...fresh,
    beat: {
      text: seed.beatText,
      provenance: { kind: 'persona-prefill', personaId, editedByWriter: false }
    },
    surroundingContext: {
      writerText: seed.contextText ?? '',
      sourceReferences: seed.sourceReferences.map((reference) => ({ ...reference }))
    },
    pov: seed.pov ? { ...seed.pov } : fresh.pov,
    invariants: {
      mustSurvive: seed.mustSurvive ?? '',
      mustNotChange: seed.mustNotChange ?? ''
    },
    channels: seed.channels ? [...seed.channels] : fresh.channels,
    lengthBudget: seed.lengthBudget ?? fresh.lengthBudget,
    position: seed.position ?? fresh.position
  };
}

/** The one mapping from an opening to the draft the sheet starts with. */
export function createShowVsTellOpeningDraft(
  opening: WorkshopShowVsTellOpening | null
): WorkshopShowVsTellDraft {
  switch (opening?.kind) {
    case 'clone':
      return opening.config.draft;
    case 'seed':
      return createShowVsTellSeededDraft(opening.seed, opening.personaId);
    default:
      return createShowVsTellAuthoringDraft();
  }
}

const LINE_BREAK_RUN = /\s*(?:\r\n|[\r\n\u2028\u2029])+\s*/gu;

/** A beat, a focal character, and the note are single-line fields. */
export function collapseShowVsTellLineBreaks(text: string): string {
  return text.replace(LINE_BREAK_RUN, ' ');
}

export type ShowVsTellInputLabel =
  | 'beat'
  | 'surrounding passage'
  | 'context sources'
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
 * Toggles one channel. Any channel may be turned off, down to zero (D4: zero
 * means no emphasis), and the result is stored in the fixed channel order
 * whatever order the writer clicked.
 */
export function toggledShowVsTellChannels(
  channels: readonly WorkshopShowVsTellChannel[],
  channel: WorkshopShowVsTellChannel
): WorkshopShowVsTellChannel[] {
  const selected = channels.includes(channel);
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

/** `unspecified` names no focal character, so the character is blanked with it. */
export function withShowVsTellPovMode(
  draft: WorkshopShowVsTellDraft,
  mode: WorkshopShowVsTellPovMode
): WorkshopShowVsTellDraft {
  return mode === draft.pov.mode
    ? draft
    : {
        ...draft,
        pov: { mode, focalCharacter: mode === 'unspecified' ? '' : draft.pov.focalCharacter }
      };
}

/** Sets one kept variant's carry mode; an unkept variant leaves the draft as it was. */
export function withShowVsTellCarryMode(
  draft: WorkshopShowVsTellDraft,
  variantId: string,
  carryMode: WorkshopShowVsTellCarryMode
): WorkshopShowVsTellDraft {
  return {
    ...draft,
    kept: draft.kept.map((entry) => entry.variantId === variantId ? { ...entry, carryMode } : entry)
  };
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

/* eslint-disable @typescript-eslint/naming-convention -- Issue codes are stable domain literals. */
const ELIGIBILITY_BLOCKERS: Record<ShowVsTellCommitIssueCode, ShowVsTellCommitBlocker> = {
  'no-workup': 'no-workup',
  'no-keep': 'no-keep',
  // The sheet cannot produce these three; if one arrives the kept list no
  // longer describes the workup, which regenerating repairs.
  'kept-not-in-workup': 'artifact-compilation-failed',
  'kept-out-of-order': 'artifact-compilation-failed',
  'kept-duplicated': 'artifact-compilation-failed',
  'artifact-compilation-failed': 'artifact-compilation-failed',
  'over-artifact-budget': 'over-artifact-budget'
};
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Why Commit is unavailable, most important first. The draft's own gates come
 * from the commit-eligibility module the host validates with, so the button
 * is enabled exactly when the host would accept the draft.
 */
export function deriveShowVsTellCommitBlockers(input: {
  generating: boolean;
  commitPending: boolean;
  roomRunActive: boolean;
  toolTargetActive: boolean;
  draft: WorkshopShowVsTellDraft;
}): ShowVsTellCommitBlocker[] {
  const { generating, commitPending, roomRunActive, toolTargetActive, draft } = input;
  const blockers: ShowVsTellCommitBlocker[] = [];
  if (generating) {
    blockers.push('generation-in-flight');
  }
  if (commitPending) {
    blockers.push('commit-in-flight');
  }
  if (roomRunActive) {
    blockers.push('room-run-active');
  }
  if (toolTargetActive) {
    blockers.push('tool-target');
  }
  for (const issue of showVsTellCommitIssues(draft)) {
    const blocker = ELIGIBILITY_BLOCKERS[issue.code];
    if (!blockers.includes(blocker)) {
      blockers.push(blocker);
    }
  }
  return blockers;
}
