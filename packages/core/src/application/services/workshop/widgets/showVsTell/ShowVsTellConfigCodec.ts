/** Show vs. Tell's exact persisted authoring-state contract. */

import {
  SHOW_VS_TELL_GENERATION_PROTOCOL_VERSION,
  WorkshopShowVsTellDraft,
  WorkshopShowVsTellVariant
} from '@messages';
import { NARRATIVE_HANDLING_POSITIONS } from '@shared/constants/narrativeHandlingVocabulary';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { isWorkshopPersonaId } from '@shared/constants/workshopPersonas';
import {
  arrayOf,
  booleanAt,
  boundedArrayAt,
  boundedStringAt,
  enumAt,
  exactKeys,
  exactObject,
  numberAt,
  objectAt,
  shapeError
} from '@/application/services/workshop/persistedValidation';
import type {
  WorkshopWidgetDraftRecoveryResult
} from '@/application/services/workshop/widgets/WorkshopWidgetCheckpointRecoveryContracts';
import {
  SHOW_VS_TELL_CHANNELS,
  SHOW_VS_TELL_GROUPS,
  SHOW_VS_TELL_LENGTH_BUDGETS,
  SHOW_VS_TELL_POV_MODES
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellContinuum';
export {
  assertShowVsTellDraftIntegrity
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellConfigIntegrity';

export interface ShowVsTellDraftSummary {
  beatPreview: string;
  keptCount: number;
  directionCount: number;
}

/** Show vs. Tell has never shipped, so no checkpoint repairs exist. */
export type ShowVsTellCheckpointNormalization = never;

const CHANNEL_IDS = SHOW_VS_TELL_CHANNELS.map(({ id }) => id);
const GROUP_KINDS = SHOW_VS_TELL_GROUPS.map(({ kind }) => kind);
const LENGTH_BUDGET_IDS = SHOW_VS_TELL_LENGTH_BUDGETS.map(({ id }) => id);
const POV_MODE_IDS = SHOW_VS_TELL_POV_MODES.map(({ id }) => id);
const LINE_BREAK = /[\r\n\u2028\u2029]/;

/**
 * Host-derived variant and flag ids extend the workup id with short ordinal
 * suffixes; integrity then requires their exact derived values.
 */
const DERIVED_ID_CHARACTERS = PROMPT_BUDGETS.workshopWidgets.showVsTellWorkupIdCharacters + 40;

export function assertShowVsTellDraftCheckpointShape(value: unknown, path: string): void {
  assertShowVsTellDraftShape(value, path);
}

export function assertShowVsTellDraftShape(value: unknown, path: string): void {
  const budget = PROMPT_BUDGETS.workshopWidgets;
  const draft = exactObject(value, path, [
    'beat',
    'surroundingContext',
    'pov',
    'invariants',
    'channels',
    'lengthBudget',
    'position',
    'workup',
    'kept',
    'note'
  ]);

  assertBeatShape(draft.beat, `${path}.beat`);
  assertSurroundingContextShape(draft.surroundingContext, `${path}.surroundingContext`);

  const pov = exactObject(draft.pov, `${path}.pov`, ['mode', 'focalCharacter']);
  enumAt(pov.mode, `${path}.pov.mode`, POV_MODE_IDS);
  singleLineStringAt(
    pov.focalCharacter,
    `${path}.pov.focalCharacter`,
    budget.showVsTellPovFocalCharacterCharacters
  );

  const invariants = exactObject(
    draft.invariants,
    `${path}.invariants`,
    ['mustSurvive', 'mustNotChange']
  );
  boundedStringAt(
    invariants.mustSurvive,
    `${path}.invariants.mustSurvive`,
    budget.showVsTellMustSurviveCharacters,
    false
  );
  boundedStringAt(
    invariants.mustNotChange,
    `${path}.invariants.mustNotChange`,
    budget.showVsTellMustNotChangeCharacters
  );

  boundedArrayAt(draft.channels, `${path}.channels`, 1, CHANNEL_IDS.length, 'channels');
  arrayOf(draft.channels, `${path}.channels`, (channel, channelPath) =>
    enumAt(channel, channelPath, CHANNEL_IDS)
  );
  enumAt(draft.lengthBudget, `${path}.lengthBudget`, LENGTH_BUDGET_IDS);
  enumAt(draft.position, `${path}.position`, NARRATIVE_HANDLING_POSITIONS);

  if (draft.workup !== null) {
    assertShowVsTellWorkupShape(draft.workup, `${path}.workup`);
  }
  boundedArrayAt(draft.kept, `${path}.kept`, 0, budget.showVsTellVariants, 'kept variants');
  arrayOf(draft.kept, `${path}.kept`, (keptValue, keptPath) => {
    const kept = exactObject(keptValue, keptPath, ['variantId', 'carryMode']);
    boundedStringAt(kept.variantId, `${keptPath}.variantId`, DERIVED_ID_CHARACTERS, false);
    enumAt(kept.carryMode, `${keptPath}.carryMode`, ['direction', 'prose']);
  });
  singleLineStringAt(draft.note, `${path}.note`, budget.showVsTellNoteCharacters);
}

/** The beat and the note are single-line fields; an artifact line must not split. */
function singleLineStringAt(
  value: unknown,
  path: string,
  maximumCharacters: number,
  allowBlank = true
): void {
  boundedStringAt(value, path, maximumCharacters, allowBlank);
  if (LINE_BREAK.test(value as string)) {
    shapeError(path, 'a single line without line breaks');
  }
}

/** Shape of the one-or-none surrounding source; the host resolves its text later. */
export function assertShowVsTellSourceReferencesShape(value: unknown, path: string): void {
  const budget = PROMPT_BUDGETS.workshopWidgets;
  boundedArrayAt(value, path, 0, budget.showVsTellSourceReferences, 'source references');
  arrayOf(value, path, (referenceValue, referencePath) => {
    const reference = objectAt(referenceValue, referencePath);
    if (reference.kind === 'active-excerpt') {
      exactKeys(reference, referencePath, ['kind']);
      return;
    }
    if (reference.kind === 'context-attachment') {
      exactKeys(reference, referencePath, ['kind', 'attachmentId']);
      boundedStringAt(
        reference.attachmentId,
        `${referencePath}.attachmentId`,
        budget.showVsTellSourceReferenceCharacters,
        false
      );
      if (!/^ctx-[1-9]\d*$/.test(reference.attachmentId as string)) {
        shapeError(`${referencePath}.attachmentId`, 'a ctx-<n> attachment id');
      }
      return;
    }
    shapeError(`${referencePath}.kind`, 'active-excerpt | context-attachment');
  });
}

function assertSurroundingContextShape(value: unknown, path: string): void {
  const context = exactObject(value, path, ['sourceReferences']);
  assertShowVsTellSourceReferencesShape(context.sourceReferences, `${path}.sourceReferences`);
}

function assertBeatShape(value: unknown, path: string): void {
  const budget = PROMPT_BUDGETS.workshopWidgets;
  const beat = exactObject(value, path, ['text', 'provenance']);
  singleLineStringAt(beat.text, `${path}.text`, budget.showVsTellBeatCharacters, false);

  const provenance = objectAt(beat.provenance, `${path}.provenance`);
  if (provenance.kind === 'pasted') {
    exactKeys(provenance, `${path}.provenance`, ['kind']);
    return;
  }
  if (provenance.kind === 'persona-prefill') {
    exactKeys(provenance, `${path}.provenance`, ['kind', 'personaId', 'editedByWriter']);
    if (!isWorkshopPersonaId(provenance.personaId)) {
      shapeError(`${path}.provenance.personaId`, 'known Workshop persona id');
    }
    booleanAt(provenance.editedByWriter, `${path}.provenance.editedByWriter`);
    return;
  }
  if (provenance.kind === 'excerpt') {
    exactKeys(
      provenance,
      `${path}.provenance`,
      ['kind', 'relativePath'],
      ['startLine', 'endLine']
    );
    boundedStringAt(
      provenance.relativePath,
      `${path}.provenance.relativePath`,
      budget.showVsTellProvenancePathCharacters,
      false
    );
    if (provenance.startLine !== undefined) {
      numberAt(provenance.startLine, `${path}.provenance.startLine`);
    }
    if (provenance.endLine !== undefined) {
      numberAt(provenance.endLine, `${path}.provenance.endLine`);
    }
    return;
  }
  shapeError(`${path}.provenance.kind`, 'pasted | persona-prefill | excerpt');
}

/**
 * Exact settled-workup grammar. The response codec runs this, then
 * assertShowVsTellWorkupIntegrity, on the workup it assembles, so generation
 * can only settle a workup that persistence will accept.
 */
export function assertShowVsTellWorkupShape(value: unknown, path: string): void {
  const budget = PROMPT_BUDGETS.workshopWidgets;
  const workup = exactObject(
    value,
    path,
    ['workupId', 'generationProtocolVersion', 'groups']
  );
  boundedStringAt(workup.workupId, `${path}.workupId`, budget.showVsTellWorkupIdCharacters, false);
  numberAt(workup.generationProtocolVersion, `${path}.generationProtocolVersion`);
  if (workup.generationProtocolVersion !== SHOW_VS_TELL_GENERATION_PROTOCOL_VERSION) {
    shapeError(
      `${path}.generationProtocolVersion`,
      String(SHOW_VS_TELL_GENERATION_PROTOCOL_VERSION)
    );
  }
  boundedArrayAt(
    workup.groups,
    `${path}.groups`,
    GROUP_KINDS.length,
    GROUP_KINDS.length,
    'groups'
  );
  arrayOf(workup.groups, `${path}.groups`, (groupValue, groupPath) => {
    const group = exactObject(groupValue, groupPath, ['kind', 'variants']);
    enumAt(group.kind, `${groupPath}.kind`, GROUP_KINDS);
    boundedArrayAt(
      group.variants,
      `${groupPath}.variants`,
      budget.showVsTellVariantsPerGroupMinimum,
      budget.showVsTellVariantsPerGroup,
      'variants'
    );
    arrayOf(group.variants, `${groupPath}.variants`, assertVariantShape);
  });
}

function assertVariantShape(value: unknown, path: string): void {
  const budget = PROMPT_BUDGETS.workshopWidgets;
  const variant = exactObject(value, path, [
    'id',
    'prose',
    'channels',
    'gains',
    'costs',
    'direction',
    'invariantFlags'
  ]);
  boundedStringAt(variant.id, `${path}.id`, DERIVED_ID_CHARACTERS, false);
  boundedStringAt(variant.prose, `${path}.prose`, budget.showVsTellProseCharacters, false);
  boundedArrayAt(
    variant.channels,
    `${path}.channels`,
    1,
    budget.showVsTellChannelsPerVariant,
    'channels'
  );
  arrayOf(variant.channels, `${path}.channels`, (channel, channelPath) =>
    enumAt(channel, channelPath, CHANNEL_IDS)
  );
  boundedStringAt(variant.gains, `${path}.gains`, budget.showVsTellGainsCharacters, false);
  boundedStringAt(variant.costs, `${path}.costs`, budget.showVsTellCostsCharacters, false);
  boundedStringAt(
    variant.direction,
    `${path}.direction`,
    budget.showVsTellDirectionCharacters,
    false
  );
  boundedArrayAt(
    variant.invariantFlags,
    `${path}.invariantFlags`,
    0,
    budget.showVsTellFlagsPerVariant,
    'invariant flags'
  );
  arrayOf(variant.invariantFlags, `${path}.invariantFlags`, (flagValue, flagPath) => {
    const flag = exactObject(flagValue, flagPath, ['id', 'invariantField', 'kind', 'note']);
    boundedStringAt(flag.id, `${flagPath}.id`, DERIVED_ID_CHARACTERS, false);
    enumAt(flag.invariantField, `${flagPath}.invariantField`, [
      'must-survive',
      'must-not-change'
    ]);
    enumAt(flag.kind, `${flagPath}.kind`, ['advisory-risk', 'hard-conflict']);
    boundedStringAt(flag.note, `${flagPath}.note`, budget.showVsTellFlagNoteCharacters, false);
  });
}

function cloneVariant(variant: WorkshopShowVsTellVariant): WorkshopShowVsTellVariant {
  return {
    id: variant.id,
    prose: variant.prose,
    channels: [...variant.channels],
    gains: variant.gains,
    costs: variant.costs,
    direction: variant.direction,
    invariantFlags: variant.invariantFlags.map((flag) => ({ ...flag }))
  };
}

export function cloneShowVsTellDraft(draft: WorkshopShowVsTellDraft): WorkshopShowVsTellDraft {
  return {
    beat: {
      text: draft.beat.text,
      provenance: { ...draft.beat.provenance }
    },
    surroundingContext: {
      sourceReferences: draft.surroundingContext.sourceReferences.map(
        (reference) => ({ ...reference })
      )
    },
    pov: { ...draft.pov },
    invariants: { ...draft.invariants },
    channels: [...draft.channels],
    lengthBudget: draft.lengthBudget,
    position: draft.position,
    workup: draft.workup === null
      ? null
      : {
          workupId: draft.workup.workupId,
          generationProtocolVersion: draft.workup.generationProtocolVersion,
          groups: draft.workup.groups.map((group) => ({
            kind: group.kind,
            variants: group.variants.map(cloneVariant)
          }))
        },
    kept: draft.kept.map((kept) => ({
      variantId: kept.variantId,
      carryMode: kept.carryMode
    })),
    note: draft.note
  };
}

export function summarizeShowVsTellDraft(draft: WorkshopShowVsTellDraft): ShowVsTellDraftSummary {
  return {
    beatPreview: draft.beat.text.slice(0, PROMPT_BUDGETS.workshopWidgets.showVsTellBeatCharacters),
    keptCount: draft.kept.length,
    directionCount: draft.kept.filter((kept) => kept.carryMode === 'direction').length
  };
}

export function normalizeShowVsTellDraftForHydration(
  value: unknown
): WorkshopWidgetDraftRecoveryResult<
  WorkshopShowVsTellDraft,
  ShowVsTellCheckpointNormalization
> {
  assertShowVsTellDraftCheckpointShape(value, 'Show vs. Tell checkpoint draft');
  return {
    draft: cloneShowVsTellDraft(value as WorkshopShowVsTellDraft),
    normalizations: [],
    notices: []
  };
}
