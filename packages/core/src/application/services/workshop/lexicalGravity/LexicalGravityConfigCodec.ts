/** Exact persisted and project-resource grammar for Lexical Gravity. */

import {
  WorkshopLexicalGravityDraft,
  WorkshopLexicalGravityLens,
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
  optionalBooleanAt,
  optionalBoundedStringAt,
  optionalNumberAt,
  shapeError
} from '@/application/services/workshop/persistedValidation';
import {
  cloneLexicalGravityDraft,
  cloneLexicalGravityLens,
  lexicalGravityConfigKey
} from './LexicalGravityLenses';

const BUDGET = PROMPT_BUDGETS.workshopWidgets;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function assertLexicalGravityLensShape(value: unknown, path: string): void {
  const item = exactObject(
    value,
    path,
    [
      'version', 'slug', 'name', 'source', 'degrees', 'gradient', 'cliches',
      'substitutions', 'metaphor', 'sample'
    ],
    ['variant', 'description']
  );
  if (item.version !== 1) {shapeError(`${path}.version`, '1');}
  boundedStringAt(item.slug, `${path}.slug`, BUDGET.lexicalLensSlugCharacters, false);
  if (!SLUG.test(item.slug as string)) {
    shapeError(`${path}.slug`, 'a lowercase kebab-case lens slug');
  }
  boundedStringAt(item.name, `${path}.name`, BUDGET.lexicalLensNameCharacters, false);
  enumAt(item.source, `${path}.source`, ['built-in', 'project']);
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

export function assertLexicalGravityDraftShape(value: unknown, path: string): void {
  const draft = exactObject(
    value,
    path,
    ['lensSlug', 'weight', 'reach', 'metaphorPull', 'resolvedLens'],
    ['preview']
  );
  boundedStringAt(
    draft.lensSlug,
    `${path}.lensSlug`,
    BUDGET.lexicalLensSlugCharacters,
    false
  );
  numberAt(draft.weight, `${path}.weight`);
  if (
    !Number.isSafeInteger(draft.weight)
    || (draft.weight as number) < 10
    || (draft.weight as number) > 100
    || (draft.weight as number) % 5 !== 0
  ) {
    shapeError(`${path}.weight`, 'an integer from 10–100 in five-point steps');
  }
  numberAt(draft.reach, `${path}.reach`);
  if (draft.reach !== 1 && draft.reach !== 2 && draft.reach !== 3) {
    shapeError(`${path}.reach`, '1, 2, or 3');
  }
  booleanAt(draft.metaphorPull, `${path}.metaphorPull`);
  assertLexicalGravityLensShape(draft.resolvedLens, `${path}.resolvedLens`);
  if ((draft.resolvedLens as WorkshopLexicalGravityLens).slug !== draft.lensSlug) {
    shapeError(`${path}.resolvedLens.slug`, 'the selected lensSlug');
  }
  if (draft.preview !== undefined) {
    const preview = exactObject(draft.preview, `${path}.preview`, ['configKey', 'text']);
    boundedStringAt(preview.configKey, `${path}.preview.configKey`, 256, false);
    boundedStringAt(
      preview.text,
      `${path}.preview.text`,
      BUDGET.lexicalPreviewCharacters,
      false
    );
    const expected = lexicalGravityConfigKey({
      lensSlug: draft.lensSlug as string,
      weight: draft.weight as number,
      reach: draft.reach as 1 | 2 | 3,
      metaphorPull: draft.metaphorPull as boolean
    });
    if (preview.configKey !== expected) {
      shapeError(`${path}.preview.configKey`, 'the current four-value config key');
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
  if (seed.weight !== undefined && (
    !Number.isSafeInteger(seed.weight)
    || (seed.weight as number) < 10
    || (seed.weight as number) > 100
    || (seed.weight as number) % 5 !== 0
  )) {
    shapeError(`${path}.weight`, 'an integer from 10–100 in five-point steps');
  }
  optionalNumberAt(seed.reach, `${path}.reach`);
  if (seed.reach !== undefined && seed.reach !== 1 && seed.reach !== 2 && seed.reach !== 3) {
    shapeError(`${path}.reach`, '1, 2, or 3');
  }
  optionalBooleanAt(seed.metaphorPull, `${path}.metaphorPull`);
}

export function validateLexicalGravityDraft(
  value: unknown
): WorkshopLexicalGravityDraft {
  assertLexicalGravityDraftShape(value, 'Lexical Gravity draft');
  return cloneLexicalGravityDraft(value as WorkshopLexicalGravityDraft);
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
  'lensName' | 'weight' | 'reach' | 'metaphorPull'
> {
  return {
    lensName: draft.resolvedLens.name,
    weight: draft.weight,
    reach: draft.reach,
    metaphorPull: draft.metaphorPull
  };
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
