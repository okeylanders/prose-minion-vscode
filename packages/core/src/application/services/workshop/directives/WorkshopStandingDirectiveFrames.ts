/** Deterministic prompt frames for session-owned standing prose directives. */

import {
  WorkshopLexicalGravityDraft,
  WorkshopStandingDirectiveSnapshot,
  WorkshopWidgetConfigSnapshot
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { neutralizeReservedPersonaPromptDelimiters } from '@/utils/workshopPromptFrames';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type { WorkshopSessionStateV1 } from '@/application/services/workshop/WorkshopSessionStateV1';

export interface WorkshopStandingDirectiveRendering {
  directive: WorkshopStandingDirectiveSnapshot;
  config: WorkshopWidgetConfigSnapshot;
}

const quote = (value: string, maximum = 48): string =>
  neutralizeReservedPersonaPromptDelimiters(value.trim().slice(0, maximum));

const terms = (values: readonly string[]): string =>
  values.slice(0, 5).map((value) => quote(value, 32)).join(', ');

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
  const frame = [
    `<prose-directive id="${directive.id}" family="lexical-gravity" revision="${directive.revision}">`,
    'This is a standing passage-prose directive. Keep it dormant during analysis, critique, planning, and ordinary conversation. Apply it only when you compose or revise story prose for the writer.',
    `Lens: ${quote(lens.name, 80)}${lens.variant ? ` — ${quote(lens.variant, 120)}` : ''}.`,
    `Weight: ${draft.weight}/100. Let this field influence diction and imagery at that intensity without making every sentence announce the lens.`,
    `Reach: ${draft.reach}/3. Draw only from vocabulary degrees 1 through ${draft.reach}.`,
    `Metaphor pull: ${draft.metaphorPull ? `on — use ${quote(lens.metaphor, 160)} as an available conceptual pressure, never a mandatory comparison` : 'off — prefer lexical influence over explicit comparison'}.`,
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

export function renderWorkshopStandingDirective(
  input: WorkshopStandingDirectiveRendering
): string {
  const { directive, config } = input;
  if (
    directive.family === 'lexical-gravity'
    && directive.widgetId === 'lexical-gravity'
    && config.widgetId === 'lexical-gravity'
  ) {
    return buildLexicalGravityDirectiveFrame(directive, config.draft);
  }
  throw new Error(`No standing directive renderer registered for ${directive.family}`);
}

export function renderWorkshopStandingDirectiveFrames(
  session: WorkshopSessionService,
  replacement?: WorkshopStandingDirectiveRendering,
  omitFamily = replacement?.directive.family
): string[] {
  const renderings = session.getStandingDirectives()
    .filter((directive) => directive.family !== omitFamily)
    .map((directive): WorkshopStandingDirectiveRendering => {
      const config = session.getWidgetConfig(directive.widgetConfigId);
      if (!config) {
        throw new Error(`Standing directive ${directive.id} has no widget config`);
      }
      return { directive, config };
    });
  if (replacement) {renderings.push(replacement);}
  return renderings.map(renderWorkshopStandingDirective);
}

export function renderWorkshopStandingDirectiveFramesFromState(
  state: WorkshopSessionStateV1
): string[] {
  return (state.standingDirectives ?? []).map((directive) => {
    const config = (state.widgetConfigs ?? []).find(
      (candidate) => candidate.id === directive.widgetConfigId
    );
    if (!config) {
      throw new Error(`Standing directive ${directive.id} has no widget config`);
    }
    return renderWorkshopStandingDirective({ directive, config });
  });
}
