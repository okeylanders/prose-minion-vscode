/** Lexical Gravity's standing-frame rendering and writer-facing vocabulary. */

import {
  WorkshopLexicalGravityDraft,
  WorkshopLexicalGravityLens,
  WorkshopLexicalGravityStandingDirectiveSummary,
  WorkshopLexicalGravityWidgetConfigSnapshot,
  WorkshopStandingDirectiveSnapshot
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { neutralizeReservedPersonaPromptDelimiters } from '@/utils/workshopPromptFrames';

const quote = (value: string, maximum = 48): string =>
  neutralizeReservedPersonaPromptDelimiters(value.trim().slice(0, maximum));

const terms = (values: readonly string[]): string =>
  values.slice(0, 5).map((value) => quote(value, 32)).join(', ');

const logicItems = (values: readonly string[]): string =>
  values.map((value) => quote(value, 240).replace(/[.!?]+$/u, '')).join('; ');

const SUBSTITUTION_KEYS = ['plan', 'conflict', 'agreement', 'turning', 'ending'] as const;

export function buildLexicalGravityDirectiveFrame(
  directive: Pick<WorkshopStandingDirectiveSnapshot, 'id' | 'revision'>,
  draft: WorkshopLexicalGravityDraft
): string {
  const lens = draft.resolvedLens;
  const degreeLines = ([1, 2, 3] as const)
    .filter((degree) => degree <= draft.reach)
    .map((degree) => {
      const bucket = lens.degrees[degree];
      return `Degree ${degree}: nouns [${terms(bucket.nouns)}]; verbs [${terms(bucket.verbs)}]; modifiers [${terms(bucket.modifiers)}].`;
    });
  const substitutionLines = SUBSTITUTION_KEYS.map(
    (ordinary) => `${ordinary} → ${quote(lens.substitutions[ordinary], 64)}`
  );
  const clicheLines = lens.cliches.slice(0, 4).map(
    ({ worn, fresh }) => `${quote(worn, 64)} → ${quote(fresh, 64)}`
  );
  const axisLines = lens.logic.axes.map(
    ({ id, name, poles }) =>
      `Axis ${quote(id, 64)} (${quote(name, 80)}): ${quote(poles[0], 100)} ↔ ${quote(poles[1], 100)}.`
  );
  const roleLines = lens.logic.roles.map(
    ({ id, name, description }) =>
      `Role ${quote(id, 64)} (${quote(name, 80)}): ${quote(description, 240)}`
  );
  const dynamicLines = lens.logic.dynamics.map(
    ({ id, operation, movement, entailment, narrativeAffordance }) =>
      `Dynamic ${quote(id, 64)} (${quote(operation, 80)}): ${quote(movement, 200)}. Entails: ${quote(entailment, 360)} Affords: ${quote(narrativeAffordance, 360)}`
  );
  const frame = [
    `<prose-directive id="${directive.id}" family="lexical-gravity" revision="${directive.revision}">`,
    'This is a standing passage-prose directive. Keep it dormant during analysis, critique, planning, and ordinary conversation. Apply it only when you compose or revise story prose for the writer.',
    `Lens: ${quote(lens.name, 80)}${lens.variant ? ` — ${quote(lens.variant, 120)}` : ''}.`,
    `Interpretive premise: ${quote(lens.logic.premise, 400)}`,
    `Foreground attention: ${logicItems(lens.logic.attention.foregrounds)}.`,
    `Background attention: ${logicItems(lens.logic.attention.backgrounds)}.`,
    ...axisLines,
    ...roleLines,
    ...dynamicLines,
    `Guardrails: ${logicItems(lens.logic.guardrails)}.`,
    'Application order: preserve facts, viewpoint, voice, and requested meaning; position only existing passage elements in fitting roles or axes; select at most one useful dynamic for a local beat; let its entailment sharpen a real concern or open pressure; only then realize the move through lexical choices.',
    'If no honest semantic mapping exists, keep the influence subtle or do nothing. Never invent a prop, secret, intention, or plot event to demonstrate the lens.',
    `Weight: ${draft.weight}/100. Let the interpretive grammar influence prose at that strength or frequency without forcing it into every sentence.`,
    `Reach: ${draft.reach}/3. Draw only from vocabulary degrees 1 through ${draft.reach}.`,
    `Metaphor pull: ${draft.metaphorPull ? `on — use ${quote(lens.metaphor, 240)} as an available conceptual pressure, never a mandatory comparison` : 'off — avoid explicit cross-domain comparison; the interpretive grammar remains active'}.`,
    ...degreeLines,
    `Gradient: ${terms(lens.gradient)}.`,
    `Useful substitutions: ${substitutionLines.join('; ')}.`,
    `Avoid the worn form when the fresh alternative fits: ${clicheLines.join('; ')}.`,
    'Preserve character voice, scene facts, clarity, and the writer\'s requested meaning. The directive bends choices; it does not overwrite the story.',
    '</prose-directive>'
  ].join('\n');
  if (frame.length > PROMPT_BUDGETS.workshopWidgets.lexicalDirectiveCharacters) {
    throw new Error('Lexical Gravity directive exceeds its prompt budget');
  }
  return frame;
}

export function assertLexicalGravityLensRenderable(
  lens: WorkshopLexicalGravityLens
): void {
  buildLexicalGravityDirectiveFrame(
    { id: 'pd-validation', revision: Number.MAX_SAFE_INTEGER },
    {
      lensSlug: lens.slug,
      weight: 100,
      reach: 3,
      metaphorPull: true,
      resolvedLens: lens
    }
  );
}

export function formatLexicalGravityDraft(draft: WorkshopLexicalGravityDraft): string {
  return formatLexicalGravitySummary({
    lensName: draft.resolvedLens.name,
    lensVariant: draft.resolvedLens.variant,
    weight: draft.weight,
    reach: draft.reach,
    metaphorPull: draft.metaphorPull
  });
}

export function formatLexicalGravitySummary(
  summary: Pick<
    WorkshopLexicalGravityStandingDirectiveSummary,
    'lensName' | 'lensVariant' | 'weight' | 'reach' | 'metaphorPull'
  >
): string {
  return `${summary.lensName}${summary.lensVariant ? ` — ${summary.lensVariant}` : ''} · ${summary.weight}% · ${summary.reach}°${summary.metaphorPull ? ' · metaphor' : ''}`;
}

export function lexicalGravityMarkerContent(
  action: 'installed' | 'shifted' | 'removed',
  previousConfig?: WorkshopLexicalGravityWidgetConfigSnapshot,
  currentConfig?: WorkshopLexicalGravityWidgetConfigSnapshot
): string {
  if (action === 'removed') {
    return 'Lexical Gravity removed — the passage stops gravitating';
  }
  if (!currentConfig) {
    throw new Error('Lexical Gravity directive has no lexical configuration');
  }
  if (action === 'installed') {
    return `Lexical Gravity installed — ${formatLexicalGravityDraft(currentConfig.draft)}`;
  }
  if (!previousConfig) {
    throw new Error('Lexical Gravity shift has no prior lexical configuration');
  }
  return `shifted — ${formatLexicalGravityDraft(previousConfig.draft)} → ${formatLexicalGravityDraft(currentConfig.draft)}`;
}
