/** Strict provider-response boundary for Creative Variations generation. */

import {
  CREATIVE_VARIATIONS_GENERATION_PROTOCOL_VERSION,
  type WorkshopCreativeVariationCard,
  type WorkshopCreativeVariationsInvariants,
  type WorkshopCreativeVariationsRequestedCount,
  type WorkshopCreativeVariationsWorkup
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  arrayOf,
  boundedArrayAt,
  boundedStringAt,
  enumAt,
  exactObject,
  numberAt,
  shapeError
} from '@/application/services/workshop/persistedValidation';
import {
  computeCreativeVariationsTextualOverlap
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsDistinctness';
import {
  isCreativeVariationsWorkupId
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsWorkupId';
import {
  creativeVariationsFlagId
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsDerivations';

export const CREATIVE_VARIATIONS_RESPONSE_START = '===CREATIVE_VARIATIONS_V1===';
export const CREATIVE_VARIATIONS_RESPONSE_END = '===END_CREATIVE_VARIATIONS_V1===';

export interface CreativeVariationsResponseContext {
  workupId: string;
  subjectText: string;
  invariants: WorkshopCreativeVariationsInvariants;
  requestedCount: WorkshopCreativeVariationsRequestedCount;
}

export function decodeCreativeVariationsResponse(
  content: string,
  context: CreativeVariationsResponseContext
): WorkshopCreativeVariationsWorkup {
  const budget = PROMPT_BUDGETS.workshopWidgets;
  if (!isCreativeVariationsWorkupId(context.workupId)) {
    throw new Error('Creative Variations workup id must be a host-minted cvw-<UUID> id');
  }
  if (content.length > budget.creativeResponseCharacters) {
    throw new Error(
      `Creative Variations response exceeds ${budget.creativeResponseCharacters} characters`
    );
  }
  const normalized = content.replace(/\r\n?/g, '\n').trim();
  requireUniqueMarker(normalized, CREATIVE_VARIATIONS_RESPONSE_START);
  requireUniqueMarker(normalized, CREATIVE_VARIATIONS_RESPONSE_END);
  const lines = normalized.split('\n');
  if (lines[0] !== CREATIVE_VARIATIONS_RESPONSE_START) {
    throw new Error('Creative Variations opening sentinel must be the first line');
  }
  if (lines[lines.length - 1] !== CREATIVE_VARIATIONS_RESPONSE_END) {
    throw new Error('Creative Variations closing sentinel must be the final line');
  }
  const jsonText = lines.slice(1, -1).join('\n').trim();
  if (jsonText.length === 0) {
    throw new Error('Creative Variations response JSON is empty');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(
      `Creative Variations response JSON is invalid: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  const root = exactObject(parsed, 'Creative Variations response', ['version', 'cards']);
  numberAt(root.version, 'Creative Variations response.version');
  if (root.version !== CREATIVE_VARIATIONS_GENERATION_PROTOCOL_VERSION) {
    shapeError(
      'Creative Variations response.version',
      String(CREATIVE_VARIATIONS_GENERATION_PROTOCOL_VERSION)
    );
  }
  boundedArrayAt(
    root.cards,
    'Creative Variations response.cards',
    context.requestedCount,
    context.requestedCount,
    'cards'
  );

  const cards: WorkshopCreativeVariationCard[] = [];
  arrayOf(root.cards, 'Creative Variations response.cards', (value, path) => {
    cards.push(decodeCard(value, path, cards.length + 1, context));
  });
  return {
    workupId: context.workupId,
    generationProtocolVersion: CREATIVE_VARIATIONS_GENERATION_PROTOCOL_VERSION,
    cards,
    overlap: computeCreativeVariationsTextualOverlap(context.subjectText, cards)
  };
}

function decodeCard(
  value: unknown,
  path: string,
  expectedPosition: number,
  context: CreativeVariationsResponseContext
): WorkshopCreativeVariationCard {
  const budget = PROMPT_BUDGETS.workshopWidgets;
  const card = exactObject(
    value,
    path,
    ['position', 'approach', 'direction', 'prose', 'tradeoff', 'invariantFlags']
  );
  numberAt(card.position, `${path}.position`);
  if (card.position !== expectedPosition) {
    shapeError(`${path}.position`, `contiguous position ${expectedPosition}`);
  }
  boundedStringAt(card.approach, `${path}.approach`, budget.creativeApproachCharacters, false);
  boundedStringAt(card.direction, `${path}.direction`, budget.creativeDirectionCharacters, false);
  boundedStringAt(card.prose, `${path}.prose`, budget.creativeProseCharacters, false);
  const tradeoff = exactObject(card.tradeoff, `${path}.tradeoff`, ['gain', 'cost']);
  boundedStringAt(tradeoff.gain, `${path}.tradeoff.gain`, budget.creativeTradeoffCharacters, false);
  boundedStringAt(tradeoff.cost, `${path}.tradeoff.cost`, budget.creativeTradeoffCharacters, false);
  boundedArrayAt(
    card.invariantFlags,
    `${path}.invariantFlags`,
    0,
    budget.creativeFlagsPerCard,
    'invariant flags'
  );
  const invariantFlags: WorkshopCreativeVariationCard['invariantFlags'] = [];
  arrayOf(card.invariantFlags, `${path}.invariantFlags`, (flagValue, flagPath) => {
    const flag = exactObject(
      flagValue,
      flagPath,
      ['invariantField', 'kind', 'note']
    );
    enumAt(flag.invariantField, `${flagPath}.invariantField`, [
      'must-survive',
      'must-not-change'
    ]);
    enumAt(flag.kind, `${flagPath}.kind`, ['advisory-risk', 'hard-conflict']);
    boundedStringAt(flag.note, `${flagPath}.note`, budget.creativeFlagNoteCharacters, false);
    const invariantField = flag.invariantField as 'must-survive' | 'must-not-change';
    const kind = flag.kind as 'advisory-risk' | 'hard-conflict';
    const declared = invariantField === 'must-survive'
      ? context.invariants.mustSurvive
      : context.invariants.mustNotChange;
    if (declared.trim().length === 0) {
      shapeError(`${flagPath}.invariantField`, 'a writer-declared nonblank invariant field');
    }
    if (kind === 'hard-conflict' && invariantField !== 'must-not-change') {
      shapeError(`${flagPath}.kind`, 'hard-conflict only against must-not-change');
    }
    invariantFlags.push({
      id: creativeVariationsFlagId(
        context.workupId,
        expectedPosition,
        invariantFlags.length + 1
      ),
      invariantField,
      kind,
      note: flag.note as string
    });
  });
  return {
    position: expectedPosition,
    approach: card.approach as string,
    direction: card.direction as string,
    prose: card.prose as string,
    tradeoff: {
      gain: tradeoff.gain as string,
      cost: tradeoff.cost as string
    },
    invariantFlags
  };
}

function requireUniqueMarker(content: string, marker: string): void {
  if (content.split(marker).length !== 2) {
    throw new Error(`Creative Variations response must contain exactly one ${marker}`);
  }
}
