/** Exact persisted and project-resource grammar for Lexical Gravity. */

import {
  LEXICAL_GRAVITY_LENS_VERSION,
  LEXICAL_GRAVITY_PREVIEW_VERSION,
  WorkshopLexicalGravityApplicationMode,
  WorkshopLexicalGravityDraft,
  WorkshopLexicalGravityEvidenceMode,
  WorkshopLexicalGravityLegacyLensV1,
  WorkshopLexicalGravityLens,
  WorkshopLexicalGravityReach,
  WorkshopLexicalGravityResolvedLens,
  WorkshopLexicalGravityRecommendationSeed,
  WorkshopLexicalGravityWidgetConfigSummary
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  arrayOf,
  booleanAt,
  boundedStringAt,
  enumAt,
  exactObject,
  numberAt,
  objectAt,
  optionalBooleanAt,
  optionalBoundedStringAt,
  optionalNumberAt,
  shapeError
} from '@/application/services/workshop/persistedValidation';
import type {
  WorkshopWidgetDraftRecoveryResult
} from '@/application/services/workshop/widgets/WorkshopWidgetCheckpointRecoveryContracts';
import {
  assertLexicalGravityLensRenderable,
  buildLegacyLexicalGravityDirectiveFrame
} from './LexicalGravityDirective';

export const LEXICAL_GRAVITY_WEIGHT = Object.freeze({
  minimum: 10,
  maximum: 100,
  step: 5
});

export const LEXICAL_GRAVITY_REACH = Object.freeze({
  minimum: 1,
  maximum: 3,
  values: [1, 2, 3] as const
});

export const LEXICAL_GRAVITY_APPLICATION_MODES = Object.freeze([
  'lexical',
  'interpret',
  'recompose'
] as const);

export const LEXICAL_GRAVITY_EVIDENCE_MODES = Object.freeze([
  'tell',
  'blend',
  'show'
] as const);

export const LEXICAL_GRAVITY_RECOVERY_NOTICE = Object.freeze({
  code: 'recovered-lexical-gravity-v1',
  message: 'Restored an older Lexical Gravity configuration in lexical-only mode. Its vocabulary, weight, reach, metaphor behavior, and saved preview were preserved. Lens Logic becomes available when you update the lens.'
});

export type LexicalGravityCheckpointNormalization =
  | 'defaulted-widget-lexical-gravity-evidence-mode'
  | 'recovered-widget-lexical-gravity-v1';

export function isLexicalGravityWeight(value: unknown): value is number {
  return Number.isSafeInteger(value)
    && (value as number) >= LEXICAL_GRAVITY_WEIGHT.minimum
    && (value as number) <= LEXICAL_GRAVITY_WEIGHT.maximum
    && (value as number) % LEXICAL_GRAVITY_WEIGHT.step === 0;
}

export function isLexicalGravityReach(value: unknown): value is 1 | 2 | 3 {
  return LEXICAL_GRAVITY_REACH.values.some((candidate) => candidate === value);
}

const BUDGET = PROMPT_BUDGETS.workshopWidgets;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function assertLexicalGravityLensShape(value: unknown, path: string): void {
  const item = exactObject(
    value,
    path,
    [
      'version', 'slug', 'name', 'source', 'logic', 'degrees', 'gradient', 'cliches',
      'substitutions', 'metaphor', 'sample'
    ],
    ['originQuery', 'variant', 'description']
  );
  if (item.version !== LEXICAL_GRAVITY_LENS_VERSION) {
    shapeError(`${path}.version`, String(LEXICAL_GRAVITY_LENS_VERSION));
  }
  boundedStringAt(item.slug, `${path}.slug`, BUDGET.lexicalLensSlugCharacters, false);
  if (!SLUG.test(item.slug as string)) {
    shapeError(`${path}.slug`, 'a lowercase kebab-case lens slug');
  }
  boundedStringAt(item.name, `${path}.name`, BUDGET.lexicalLensNameCharacters, false);
  enumAt(item.source, `${path}.source`, ['built-in', 'project']);
  optionalBoundedStringAt(
    item.originQuery,
    `${path}.originQuery`,
    BUDGET.lexicalBuildQueryCharacters,
    false
  );
  optionalBoundedStringAt(
    item.variant,
    `${path}.variant`,
    BUDGET.lexicalLensVariantCharacters,
    false
  );
  optionalBoundedStringAt(
    item.description,
    `${path}.description`,
    BUDGET.lexicalLensDescriptionCharacters,
    false
  );
  assertLexicalGravityLensLogicShape(item.logic, `${path}.logic`);
  assertLexicalGravityWordFieldShape(item, path);
  try {
    assertLexicalGravityLensRenderable(value as WorkshopLexicalGravityLens);
  } catch {
    shapeError(
      path,
      `a lens whose reach-3 directive fits within ${BUDGET.lexicalDirectiveCharacters} characters`
    );
  }
}

export function assertLexicalGravityLegacyLensV1Shape(
  value: unknown,
  path: string
): void {
  const item = exactObject(
    value,
    path,
    [
      'version', 'slug', 'name', 'source', 'degrees', 'gradient', 'cliches',
      'substitutions', 'metaphor', 'sample'
    ],
    ['originQuery', 'variant', 'description']
  );
  if (item.version !== 1) {
    shapeError(`${path}.version`, '1');
  }
  boundedStringAt(item.slug, `${path}.slug`, BUDGET.lexicalLensSlugCharacters, false);
  if (!SLUG.test(item.slug as string)) {
    shapeError(`${path}.slug`, 'a lowercase kebab-case lens slug');
  }
  boundedStringAt(item.name, `${path}.name`, BUDGET.lexicalLensNameCharacters, false);
  enumAt(item.source, `${path}.source`, ['built-in', 'project']);
  optionalBoundedStringAt(
    item.originQuery,
    `${path}.originQuery`,
    BUDGET.lexicalBuildQueryCharacters,
    false
  );
  optionalBoundedStringAt(
    item.variant,
    `${path}.variant`,
    BUDGET.lexicalLensVariantCharacters,
    false
  );
  optionalBoundedStringAt(
    item.description,
    `${path}.description`,
    BUDGET.lexicalLensDescriptionCharacters,
    false
  );
  assertLexicalGravityWordFieldShape(item, path);
  try {
    buildLegacyLexicalGravityDirectiveFrame(
      { id: 'pd-validation', revision: Number.MAX_SAFE_INTEGER },
      {
        resolvedLens: value as WorkshopLexicalGravityLegacyLensV1,
        weight: 100,
        reach: 3,
        metaphorPull: true
      }
    );
  } catch {
    shapeError(
      path,
      `a lens whose reach-3 directive fits within ${BUDGET.lexicalDirectiveCharacters} characters`
    );
  }
}

function assertLexicalGravityWordFieldShape(
  item: Record<string, unknown>,
  path: string
): void {
  const degrees = exactObject(item.degrees, `${path}.degrees`, ['1', '2', '3']);
  for (const degree of [1, 2, 3] as const) {
    const bucket = exactObject(
      degrees[String(degree)],
      `${path}.degrees.${degree}`,
      ['nouns', 'verbs', 'modifiers']
    );
    for (const part of ['nouns', 'verbs', 'modifiers'] as const) {
      assertUniqueBoundedStrings(
        bucket[part],
        `${path}.degrees.${degree}.${part}`,
        2,
        BUDGET.lexicalTermsPerBucket,
        BUDGET.lexicalTermCharacters
      );
    }
  }
  assertUniqueBoundedStrings(
    item.gradient,
    `${path}.gradient`,
    3,
    BUDGET.lexicalGradientTerms,
    BUDGET.lexicalTermCharacters
  );
  if (!Array.isArray(item.cliches) || item.cliches.length < 1 || item.cliches.length > BUDGET.lexicalCliches) {
    shapeError(`${path}.cliches`, `an array of 1–${BUDGET.lexicalCliches} contrasts`);
  }
  arrayOf(item.cliches, `${path}.cliches`, (entryValue, entryPath) => {
    const entry = exactObject(entryValue, entryPath, ['worn', 'fresh']);
    boundedStringAt(entry.worn, `${entryPath}.worn`, BUDGET.lexicalPhraseCharacters, false);
    boundedStringAt(entry.fresh, `${entryPath}.fresh`, BUDGET.lexicalPhraseCharacters, false);
  });
  const substitutions = exactObject(
    item.substitutions,
    `${path}.substitutions`,
    ['plan', 'conflict', 'agreement', 'turning', 'ending']
  );
  for (const key of ['plan', 'conflict', 'agreement', 'turning', 'ending']) {
    boundedStringAt(
      substitutions[key],
      `${path}.substitutions.${key}`,
      BUDGET.lexicalPhraseCharacters,
      false
    );
  }
  boundedStringAt(item.metaphor, `${path}.metaphor`, BUDGET.lexicalPhraseCharacters, false);
  boundedStringAt(item.sample, `${path}.sample`, BUDGET.lexicalSampleCharacters, false);
}

export function assertLexicalGravityDraftCheckpointShape(
  value: unknown,
  path: string
): void {
  const draft = objectAt(value, path);
  const resolvedLens = objectAt(draft.resolvedLens, `${path}.resolvedLens`);
  if (resolvedLens.version === 1) {
    if (draft.applicationMode !== undefined || draft.evidenceMode !== undefined) {
      assertLexicalGravityDraftShape(value, path);
    } else {
      assertLexicalGravityLegacyDraftV1Shape(value, path);
    }
    return;
  }
  if (draft.evidenceMode === undefined) {
    assertLexicalGravityPreEvidenceDraftShape(value, path);
    return;
  }
  assertLexicalGravityDraftShape(value, path);
}

export function assertLexicalGravityDraftShape(value: unknown, path: string): void {
  const draft = exactObject(
    value,
    path,
    [
      'lensSlug', 'applicationMode', 'evidenceMode', 'weight', 'reach',
      'metaphorPull', 'resolvedLens'
    ],
    ['preview']
  );
  assertLexicalGravityDraftControls(draft, path);
  enumAt(draft.evidenceMode, `${path}.evidenceMode`, LEXICAL_GRAVITY_EVIDENCE_MODES);
  const lens = objectAt(draft.resolvedLens, `${path}.resolvedLens`);
  if (lens.version === 1) {
    if (draft.applicationMode !== 'lexical') {
      shapeError(`${path}.applicationMode`, 'lexical for a recovered v1 lens');
    }
    assertLexicalGravityLegacyLensV1Shape(lens, `${path}.resolvedLens`);
  } else {
    assertLexicalGravityLensShape(lens, `${path}.resolvedLens`);
  }
  if ((lens.slug as string) !== draft.lensSlug) {
    shapeError(`${path}.resolvedLens.slug`, 'the selected lensSlug');
  }
  if (draft.preview !== undefined) {
    assertCurrentLexicalGravityPreview(draft, path);
  }
}

function assertLexicalGravityDraftControls(
  draft: Record<string, unknown>,
  path: string
): void {
  boundedStringAt(
    draft.lensSlug,
    `${path}.lensSlug`,
    BUDGET.lexicalLensSlugCharacters,
    false
  );
  enumAt(
    draft.applicationMode,
    `${path}.applicationMode`,
    LEXICAL_GRAVITY_APPLICATION_MODES
  );
  numberAt(draft.weight, `${path}.weight`);
  if (!isLexicalGravityWeight(draft.weight)) {
    shapeError(
      `${path}.weight`,
      `an integer from ${LEXICAL_GRAVITY_WEIGHT.minimum}–${LEXICAL_GRAVITY_WEIGHT.maximum} in ${LEXICAL_GRAVITY_WEIGHT.step}-point steps`
    );
  }
  numberAt(draft.reach, `${path}.reach`);
  if (!isLexicalGravityReach(draft.reach)) {
    shapeError(`${path}.reach`, LEXICAL_GRAVITY_REACH.values.join(', '));
  }
  booleanAt(draft.metaphorPull, `${path}.metaphorPull`);
}

function assertCurrentLexicalGravityPreview(
  draft: Record<string, unknown>,
  path: string
): void {
  const preview = exactObject(
    draft.preview,
    `${path}.preview`,
    [
      'version', 'configKey', 'sourceText', 'semanticPositions',
      'selectedDynamicId', 'openEntailment', 'text'
    ]
  );
  if (preview.version !== LEXICAL_GRAVITY_PREVIEW_VERSION) {
    shapeError(`${path}.preview.version`, String(LEXICAL_GRAVITY_PREVIEW_VERSION));
  }
  boundedStringAt(preview.configKey, `${path}.preview.configKey`, 256, false);
  boundedStringAt(
    preview.sourceText,
    `${path}.preview.sourceText`,
    BUDGET.lexicalSampleCharacters,
    false
  );
  const lens = draft.resolvedLens as WorkshopLexicalGravityResolvedLens;
  if (draft.applicationMode === 'lexical') {
    if (!Array.isArray(preview.semanticPositions) || preview.semanticPositions.length !== 0) {
      shapeError(`${path}.preview.semanticPositions`, 'an empty array in lexical mode');
    }
    if (preview.selectedDynamicId !== null) {
      shapeError(`${path}.preview.selectedDynamicId`, 'null in lexical mode');
    }
  } else {
    assertLexicalGravitySemanticPositions(
      preview.semanticPositions,
      `${path}.preview.semanticPositions`,
      lens as WorkshopLexicalGravityLens
    );
    assertSelectedDynamic(
      preview.selectedDynamicId,
      `${path}.preview.selectedDynamicId`,
      lens as WorkshopLexicalGravityLens
    );
  }
  if (
    (preview.semanticPositions as unknown[]).length === 0
    && preview.selectedDynamicId !== null
  ) {
    shapeError(
      `${path}.preview.selectedDynamicId`,
      'null when no semantic positions are declared'
    );
  }
  assertNullableBoundedString(
    preview.openEntailment,
    `${path}.preview.openEntailment`,
    BUDGET.lexicalPreviewEntailmentCharacters
  );
  if (preview.openEntailment !== null && preview.selectedDynamicId === null) {
    shapeError(
      `${path}.preview.openEntailment`,
      'null when no lens dynamic is selected'
    );
  }
  if (draft.applicationMode === 'lexical' && preview.openEntailment !== null) {
    shapeError(`${path}.preview.openEntailment`, 'null in lexical mode');
  }
  boundedStringAt(
    preview.text,
    `${path}.preview.text`,
    BUDGET.lexicalPreviewCharacters,
    false
  );
  const expected = lexicalGravityConfigKey({
    lensSlug: draft.lensSlug as string,
    applicationMode: draft.applicationMode as WorkshopLexicalGravityApplicationMode,
    evidenceMode: draft.evidenceMode as WorkshopLexicalGravityEvidenceMode,
    weight: draft.weight as number,
    reach: draft.reach as 1 | 2 | 3,
    metaphorPull: draft.metaphorPull as boolean
  });
  if (preview.configKey !== expected) {
    shapeError(`${path}.preview.configKey`, 'the current six-value config key');
  }
}

function assertLexicalGravityPreEvidenceDraftShape(value: unknown, path: string): void {
  const draft = exactObject(
    value,
    path,
    ['lensSlug', 'applicationMode', 'weight', 'reach', 'metaphorPull', 'resolvedLens'],
    ['preview']
  );
  assertLexicalGravityDraftControls(draft, path);
  assertLexicalGravityLensShape(draft.resolvedLens, `${path}.resolvedLens`);
  if ((draft.resolvedLens as WorkshopLexicalGravityLens).slug !== draft.lensSlug) {
    shapeError(`${path}.resolvedLens.slug`, 'the selected lensSlug');
  }
  if (draft.preview !== undefined) {
    const preview = exactObject(
      draft.preview,
      `${path}.preview`,
      [
        'version', 'configKey', 'sourceText', 'semanticPositions',
        'selectedDynamicId', 'openEntailment', 'text'
      ]
    );
    if (preview.version !== LEXICAL_GRAVITY_PREVIEW_VERSION) {
      shapeError(`${path}.preview.version`, String(LEXICAL_GRAVITY_PREVIEW_VERSION));
    }
    const migrated = {
      ...draft,
      evidenceMode: 'blend',
      preview: {
        ...preview,
        configKey: lexicalGravityConfigKey({
          lensSlug: draft.lensSlug as string,
          applicationMode: draft.applicationMode as WorkshopLexicalGravityApplicationMode,
          evidenceMode: 'blend',
          weight: draft.weight as number,
          reach: draft.reach as WorkshopLexicalGravityReach,
          metaphorPull: draft.metaphorPull as boolean
        })
      }
    };
    assertCurrentLexicalGravityPreview(migrated, path);
    const expectedLegacyKey = lexicalGravityPreEvidenceConfigKey(draft as {
      lensSlug: string;
      applicationMode: WorkshopLexicalGravityApplicationMode;
      weight: number;
      reach: WorkshopLexicalGravityReach;
      metaphorPull: boolean;
    });
    if (preview.configKey !== expectedLegacyKey) {
      shapeError(`${path}.preview.configKey`, 'the prior five-value config key');
    }
  }
}

function assertLexicalGravityLegacyDraftV1Shape(value: unknown, path: string): void {
  const draft = exactObject(
    value,
    path,
    ['lensSlug', 'weight', 'reach', 'metaphorPull', 'resolvedLens'],
    ['preview']
  );
  assertLexicalGravityDraftControls(
    { ...draft, applicationMode: 'lexical' },
    path
  );
  assertLexicalGravityLegacyLensV1Shape(draft.resolvedLens, `${path}.resolvedLens`);
  if ((draft.resolvedLens as WorkshopLexicalGravityLegacyLensV1).slug !== draft.lensSlug) {
    shapeError(`${path}.resolvedLens.slug`, 'the selected lensSlug');
  }
  if (draft.preview !== undefined) {
    const preview = exactObject(
      draft.preview,
      `${path}.preview`,
      ['configKey', 'text'],
      ['sourceText']
    );
    boundedStringAt(preview.configKey, `${path}.preview.configKey`, 256, false);
    optionalBoundedStringAt(
      preview.sourceText,
      `${path}.preview.sourceText`,
      BUDGET.lexicalSampleCharacters,
      false
    );
    boundedStringAt(
      preview.text,
      `${path}.preview.text`,
      BUDGET.lexicalPreviewCharacters,
      false
    );
    const expected = lexicalGravityLegacyV1ConfigKey(draft as {
      lensSlug: string;
      weight: number;
      reach: WorkshopLexicalGravityReach;
      metaphorPull: boolean;
    });
    if (preview.configKey !== expected) {
      shapeError(`${path}.preview.configKey`, 'the Lexical Gravity v1 config key');
    }
  }
}

export function assertLexicalGravityRecommendationSeedShape(
  value: unknown,
  path: string
): void {
  const seed = exactObject(
    value,
    path,
    [],
    ['lensSlug', 'weight', 'reach', 'metaphorPull']
  );
  optionalBoundedStringAt(
    seed.lensSlug,
    `${path}.lensSlug`,
    BUDGET.lexicalLensSlugCharacters,
    false
  );
  optionalNumberAt(seed.weight, `${path}.weight`);
  if (seed.weight !== undefined && !isLexicalGravityWeight(seed.weight)) {
    shapeError(
      `${path}.weight`,
      `an integer from ${LEXICAL_GRAVITY_WEIGHT.minimum}–${LEXICAL_GRAVITY_WEIGHT.maximum} in ${LEXICAL_GRAVITY_WEIGHT.step}-point steps`
    );
  }
  optionalNumberAt(seed.reach, `${path}.reach`);
  if (seed.reach !== undefined && !isLexicalGravityReach(seed.reach)) {
    shapeError(`${path}.reach`, LEXICAL_GRAVITY_REACH.values.join(', '));
  }
  optionalBooleanAt(seed.metaphorPull, `${path}.metaphorPull`);
}

export function validateLexicalGravityDraft(
  value: unknown
): WorkshopLexicalGravityDraft {
  assertLexicalGravityDraftShape(value, 'Lexical Gravity draft');
  return cloneLexicalGravityDraft(value as WorkshopLexicalGravityDraft);
}

export function normalizeLexicalGravityDraftForHydration(
  value: unknown
): WorkshopWidgetDraftRecoveryResult<
  WorkshopLexicalGravityDraft,
  LexicalGravityCheckpointNormalization
> {
  assertLexicalGravityDraftCheckpointShape(value, 'Lexical Gravity checkpoint draft');
  const checkpoint = value as Record<string, unknown>;
  const lens = checkpoint.resolvedLens as WorkshopLexicalGravityResolvedLens;
  if (
    lens.version === 1
    && checkpoint.applicationMode === undefined
    && checkpoint.evidenceMode === undefined
  ) {
    const preview = checkpoint.preview as {
      configKey: string;
      text: string;
      sourceText?: string;
    } | undefined;
    const draft: WorkshopLexicalGravityDraft = {
      lensSlug: checkpoint.lensSlug as string,
      applicationMode: 'lexical',
      evidenceMode: 'blend',
      weight: checkpoint.weight as number,
      reach: checkpoint.reach as WorkshopLexicalGravityReach,
      metaphorPull: checkpoint.metaphorPull as boolean,
      resolvedLens: cloneLexicalGravityResolvedLens(lens),
      preview: preview?.sourceText
        ? {
            version: LEXICAL_GRAVITY_PREVIEW_VERSION,
            configKey: lexicalGravityConfigKey({
              lensSlug: checkpoint.lensSlug as string,
              applicationMode: 'lexical',
              evidenceMode: 'blend',
              weight: checkpoint.weight as number,
              reach: checkpoint.reach as WorkshopLexicalGravityReach,
              metaphorPull: checkpoint.metaphorPull as boolean
            }),
            sourceText: preview.sourceText,
            semanticPositions: [],
            selectedDynamicId: null,
            openEntailment: null,
            text: preview.text
          }
        : undefined
    };
    assertLexicalGravityDraftShape(draft, 'Recovered Lexical Gravity draft');
    return {
      draft,
      normalizations: [
        'recovered-widget-lexical-gravity-v1',
        'defaulted-widget-lexical-gravity-evidence-mode'
      ],
      notices: [LEXICAL_GRAVITY_RECOVERY_NOTICE]
    };
  }
  if (checkpoint.evidenceMode === undefined) {
    const oldDraft = checkpoint as unknown as Omit<
      WorkshopLexicalGravityDraft,
      'evidenceMode'
    >;
    const draft = {
      ...oldDraft,
      evidenceMode: 'blend' as const,
      preview: oldDraft.preview
        ? {
            ...oldDraft.preview,
            configKey: lexicalGravityConfigKey({
              lensSlug: oldDraft.lensSlug,
              applicationMode: oldDraft.applicationMode,
              evidenceMode: 'blend',
              weight: oldDraft.weight,
              reach: oldDraft.reach,
              metaphorPull: oldDraft.metaphorPull
            })
          }
        : undefined
    } as WorkshopLexicalGravityDraft;
    assertLexicalGravityDraftShape(draft, 'Recovered Lexical Gravity draft');
    return {
      draft: cloneLexicalGravityDraft(draft),
      normalizations: ['defaulted-widget-lexical-gravity-evidence-mode'],
      notices: []
    };
  }
  return {
    draft: cloneLexicalGravityDraft(value as WorkshopLexicalGravityDraft),
    normalizations: [],
    notices: []
  };
}

export function validateLexicalGravityLens(
  value: unknown
): WorkshopLexicalGravityLens {
  assertLexicalGravityLensShape(value, 'Lexical Gravity lens');
  return cloneLexicalGravityLens(value as WorkshopLexicalGravityLens);
}

export function summarizeLexicalGravityDraft(
  draft: WorkshopLexicalGravityDraft
): Pick<
  WorkshopLexicalGravityWidgetConfigSummary,
  'lensName' | 'lensVariant' | 'applicationMode' | 'evidenceMode' | 'weight' | 'reach' | 'metaphorPull'
> {
  return {
    lensName: draft.resolvedLens.name,
    lensVariant: draft.resolvedLens.variant,
    applicationMode: draft.applicationMode,
    evidenceMode: draft.evidenceMode,
    weight: draft.weight,
    reach: draft.reach,
    metaphorPull: draft.metaphorPull
  };
}

export function cloneLexicalGravityLens(
  source: WorkshopLexicalGravityLens
): WorkshopLexicalGravityLens {
  const cloneBucket = (bucket: WorkshopLexicalGravityLens['degrees'][1]) => ({
    nouns: [...bucket.nouns],
    verbs: [...bucket.verbs],
    modifiers: [...bucket.modifiers]
  });
  return {
    ...source,
    logic: {
      premise: source.logic.premise,
      attention: {
        foregrounds: [...source.logic.attention.foregrounds],
        backgrounds: [...source.logic.attention.backgrounds]
      },
      axes: source.logic.axes.map((axis) => ({
        ...axis,
        poles: [...axis.poles] as [string, string]
      })),
      roles: source.logic.roles.map((role) => ({ ...role })),
      dynamics: source.logic.dynamics.map((dynamic) => ({ ...dynamic })),
      guardrails: [...source.logic.guardrails]
    },
    degrees: {
      1: cloneBucket(source.degrees[1]),
      2: cloneBucket(source.degrees[2]),
      3: cloneBucket(source.degrees[3])
    },
    gradient: [...source.gradient],
    cliches: source.cliches.map((entry) => ({ ...entry })),
    substitutions: { ...source.substitutions }
  };
}

export function cloneLexicalGravityResolvedLens(
  source: WorkshopLexicalGravityResolvedLens
): WorkshopLexicalGravityResolvedLens {
  if (source.version === LEXICAL_GRAVITY_LENS_VERSION) {
    return cloneLexicalGravityLens(source);
  }
  const cloneBucket = (bucket: WorkshopLexicalGravityLegacyLensV1['degrees'][1]) => ({
    nouns: [...bucket.nouns],
    verbs: [...bucket.verbs],
    modifiers: [...bucket.modifiers]
  });
  return {
    ...source,
    degrees: {
      1: cloneBucket(source.degrees[1]),
      2: cloneBucket(source.degrees[2]),
      3: cloneBucket(source.degrees[3])
    },
    gradient: [...source.gradient],
    cliches: source.cliches.map((entry) => ({ ...entry })),
    substitutions: { ...source.substitutions }
  };
}

export function cloneLexicalGravityDraft(
  draft: WorkshopLexicalGravityDraft
): WorkshopLexicalGravityDraft {
  const common = {
    lensSlug: draft.lensSlug,
    evidenceMode: draft.evidenceMode,
    weight: draft.weight,
    reach: draft.reach,
    metaphorPull: draft.metaphorPull,
    resolvedLens: cloneLexicalGravityResolvedLens(draft.resolvedLens),
    preview: draft.preview ? {
      ...draft.preview,
      semanticPositions: draft.preview.semanticPositions.map((position) => ({ ...position }))
    } : undefined
  };
  if (draft.applicationMode === 'lexical') {
    return { ...common, applicationMode: 'lexical' };
  }
  return {
    ...common,
    applicationMode: draft.applicationMode,
    resolvedLens: cloneLexicalGravityLens(draft.resolvedLens)
  };
}

export function lexicalGravityConfigKey(input: {
  lensSlug: string;
  applicationMode: WorkshopLexicalGravityApplicationMode;
  evidenceMode: WorkshopLexicalGravityEvidenceMode;
  weight: number;
  reach: WorkshopLexicalGravityReach;
  metaphorPull: boolean;
}): string {
  return `${input.lensSlug}|${input.applicationMode}|${input.evidenceMode}|${input.weight}|${input.reach}|${input.metaphorPull ? 1 : 0}`;
}

function lexicalGravityPreEvidenceConfigKey(input: {
  lensSlug: string;
  applicationMode: WorkshopLexicalGravityApplicationMode;
  weight: number;
  reach: WorkshopLexicalGravityReach;
  metaphorPull: boolean;
}): string {
  return `${input.lensSlug}|${input.applicationMode}|${input.weight}|${input.reach}|${input.metaphorPull ? 1 : 0}`;
}

function lexicalGravityLegacyV1ConfigKey(input: {
  lensSlug: string;
  weight: number;
  reach: WorkshopLexicalGravityReach;
  metaphorPull: boolean;
}): string {
  return `${input.lensSlug}|${input.weight}|${input.reach}|${input.metaphorPull ? 1 : 0}`;
}

function assertUniqueBoundedStrings(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
  maximumCharacters: number
): void {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    shapeError(path, `an array of ${minimum}–${maximum} strings`);
  }
  const seen = new Set<string>();
  arrayOf(value, path, (item, itemPath) => {
    boundedStringAt(item, itemPath, maximumCharacters, false);
    const key = (item as string).toLocaleLowerCase('en-US');
    if (seen.has(key)) {shapeError(path, 'strings without duplicates');}
    seen.add(key);
  });
}

function assertLexicalGravityLensLogicShape(value: unknown, path: string): void {
  const logic = exactObject(
    value,
    path,
    ['premise', 'attention', 'axes', 'roles', 'dynamics', 'guardrails']
  );
  boundedStringAt(
    logic.premise,
    `${path}.premise`,
    BUDGET.lexicalLogicPremiseCharacters,
    false
  );
  const attention = exactObject(
    logic.attention,
    `${path}.attention`,
    ['foregrounds', 'backgrounds']
  );
  assertUniqueBoundedStrings(
    attention.foregrounds,
    `${path}.attention.foregrounds`,
    BUDGET.lexicalAttentionItemsMinimum,
    BUDGET.lexicalAttentionItems,
    BUDGET.lexicalAttentionItemCharacters
  );
  assertUniqueBoundedStrings(
    attention.backgrounds,
    `${path}.attention.backgrounds`,
    BUDGET.lexicalAttentionItemsMinimum,
    BUDGET.lexicalAttentionItems,
    BUDGET.lexicalAttentionItemCharacters
  );
  assertLogicAxes(logic.axes, `${path}.axes`);
  assertLogicRoles(logic.roles, `${path}.roles`);
  assertLogicDynamics(logic.dynamics, `${path}.dynamics`);
  assertUniqueBoundedStrings(
    logic.guardrails,
    `${path}.guardrails`,
    BUDGET.lexicalLogicGuardrailsMinimum,
    BUDGET.lexicalLogicGuardrails,
    BUDGET.lexicalGuardrailCharacters
  );
}

function assertLogicAxes(value: unknown, path: string): void {
  assertCollectionLength(
    value,
    path,
    BUDGET.lexicalLogicAxesMinimum,
    BUDGET.lexicalLogicAxes,
    'axes'
  );
  const ids = new Set<string>();
  arrayOf(value, path, (axisValue, axisPath) => {
    const axis = exactObject(axisValue, axisPath, ['id', 'name', 'poles']);
    assertLogicId(axis.id, `${axisPath}.id`, ids);
    boundedStringAt(
      axis.name,
      `${axisPath}.name`,
      BUDGET.lexicalLogicNameCharacters,
      false
    );
    if (!Array.isArray(axis.poles) || axis.poles.length !== 2) {
      shapeError(`${axisPath}.poles`, 'a two-string tuple');
    }
    const poles = axis.poles as unknown[];
    boundedStringAt(
      poles[0],
      `${axisPath}.poles[0]`,
      BUDGET.lexicalAxisPoleCharacters,
      false
    );
    boundedStringAt(
      poles[1],
      `${axisPath}.poles[1]`,
      BUDGET.lexicalAxisPoleCharacters,
      false
    );
    if ((poles[0] as string).toLocaleLowerCase('en-US')
      === (poles[1] as string).toLocaleLowerCase('en-US')) {
      shapeError(`${axisPath}.poles`, 'two distinct strings');
    }
  });
}

function assertLogicRoles(value: unknown, path: string): void {
  assertCollectionLength(
    value,
    path,
    BUDGET.lexicalLogicRolesMinimum,
    BUDGET.lexicalLogicRoles,
    'roles'
  );
  const ids = new Set<string>();
  arrayOf(value, path, (roleValue, rolePath) => {
    const role = exactObject(roleValue, rolePath, ['id', 'name', 'description']);
    assertLogicId(role.id, `${rolePath}.id`, ids);
    boundedStringAt(
      role.name,
      `${rolePath}.name`,
      BUDGET.lexicalLogicNameCharacters,
      false
    );
    boundedStringAt(
      role.description,
      `${rolePath}.description`,
      BUDGET.lexicalRoleDescriptionCharacters,
      false
    );
  });
}

function assertLogicDynamics(value: unknown, path: string): void {
  assertCollectionLength(
    value,
    path,
    BUDGET.lexicalLogicDynamicsMinimum,
    BUDGET.lexicalLogicDynamics,
    'dynamics'
  );
  const ids = new Set<string>();
  arrayOf(value, path, (dynamicValue, dynamicPath) => {
    const dynamic = exactObject(
      dynamicValue,
      dynamicPath,
      ['id', 'operation', 'movement', 'entailment', 'narrativeAffordance']
    );
    assertLogicId(dynamic.id, `${dynamicPath}.id`, ids);
    boundedStringAt(
      dynamic.operation,
      `${dynamicPath}.operation`,
      BUDGET.lexicalLogicNameCharacters,
      false
    );
    boundedStringAt(
      dynamic.movement,
      `${dynamicPath}.movement`,
      BUDGET.lexicalDynamicMovementCharacters,
      false
    );
    boundedStringAt(
      dynamic.entailment,
      `${dynamicPath}.entailment`,
      BUDGET.lexicalDynamicEntailmentCharacters,
      false
    );
    boundedStringAt(
      dynamic.narrativeAffordance,
      `${dynamicPath}.narrativeAffordance`,
      BUDGET.lexicalDynamicAffordanceCharacters,
      false
    );
  });
}

function assertLogicId(value: unknown, path: string, ids: Set<string>): void {
  boundedStringAt(value, path, BUDGET.lexicalLogicIdCharacters, false);
  const id = value as string;
  if (!SLUG.test(id)) {shapeError(path, 'a lowercase kebab-case id');}
  if (ids.has(id)) {shapeError(path, 'a unique id');}
  ids.add(id);
}

function assertCollectionLength(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
  label: string
): void {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    shapeError(path, `an array of ${minimum}–${maximum} ${label}`);
  }
}

function assertLexicalGravitySemanticPositions(
  value: unknown,
  path: string,
  lens: WorkshopLexicalGravityLens
): void {
  if (!Array.isArray(value) || value.length > BUDGET.lexicalPreviewPositions) {
    shapeError(path, `an array of 0–${BUDGET.lexicalPreviewPositions} mappings`);
  }
  const roleIds = new Set(lens.logic.roles.map(({ id }) => id));
  const axisIds = new Set(lens.logic.axes.map(({ id }) => id));
  arrayOf(value, path, (positionValue, positionPath) => {
    const position = exactObject(
      positionValue,
      positionPath,
      ['element', 'roleId', 'axisId', 'axisPosition', 'significance']
    );
    boundedStringAt(
      position.element,
      `${positionPath}.element`,
      BUDGET.lexicalPreviewElementCharacters,
      false
    );
    boundedStringAt(
      position.roleId,
      `${positionPath}.roleId`,
      BUDGET.lexicalLogicIdCharacters,
      false
    );
    if (!roleIds.has(position.roleId as string)) {
      shapeError(`${positionPath}.roleId`, 'an id declared by the selected lens');
    }
    assertNullableBoundedString(
      position.axisId,
      `${positionPath}.axisId`,
      BUDGET.lexicalLogicIdCharacters
    );
    assertNullableBoundedString(
      position.axisPosition,
      `${positionPath}.axisPosition`,
      BUDGET.lexicalPreviewAxisPositionCharacters
    );
    if ((position.axisId === null) !== (position.axisPosition === null)) {
      shapeError(
        position.axisId === null
          ? `${positionPath}.axisPosition`
          : `${positionPath}.axisId`,
        'null unless both axis fields are present'
      );
    }
    if (position.axisId !== null && !axisIds.has(position.axisId as string)) {
      shapeError(`${positionPath}.axisId`, 'an id declared by the selected lens');
    }
    boundedStringAt(
      position.significance,
      `${positionPath}.significance`,
      BUDGET.lexicalPreviewSignificanceCharacters,
      false
    );
  });
}

function assertSelectedDynamic(
  value: unknown,
  path: string,
  lens: WorkshopLexicalGravityLens
): void {
  assertNullableBoundedString(value, path, BUDGET.lexicalLogicIdCharacters);
  if (
    value !== null
    && !lens.logic.dynamics.some(({ id }) => id === value)
  ) {
    shapeError(path, 'an id declared by the selected lens or null');
  }
}

function assertNullableBoundedString(
  value: unknown,
  path: string,
  maximumCharacters: number
): void {
  if (value !== null) {
    boundedStringAt(value, path, maximumCharacters, false);
  }
}
