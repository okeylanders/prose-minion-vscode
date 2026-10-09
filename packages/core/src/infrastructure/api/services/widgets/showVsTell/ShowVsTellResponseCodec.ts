/**
 * Strict provider-response boundary for Show vs. Tell generation.
 *
 * This module parses the model's closed wire protocol exactly (sentinels, key
 * sets, JSON types) and assembles the workup with host-derived ids. Every
 * semantic rule (counts, group membership and order, lengths, direction
 * shorter than prose, normalized duplicates, flag grammar) lives in the shared
 * workup gate that persistence also runs, so a workup can never settle at
 * generation and fail at reopen, or the reverse.
 */

import {
  SHOW_VS_TELL_GENERATION_PROTOCOL_VERSION,
  type WorkshopShowVsTellInvariants,
  type WorkshopShowVsTellWorkup
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  arrayOf,
  exactObject,
  numberAt,
  shapeError,
  stringAt
} from '@/application/services/workshop/persistedValidation';
import {
  assertShowVsTellWorkupShape
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellConfigCodec';
import {
  assertShowVsTellWorkupIntegrity
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellConfigIntegrity';
import {
  showVsTellFlagId,
  showVsTellVariantId
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellDerivations';
import {
  isShowVsTellWorkupId
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellWorkupId';

export const SHOW_VS_TELL_RESPONSE_START = '===SHOW_VS_TELL_V1===';
export const SHOW_VS_TELL_RESPONSE_END = '===END_SHOW_VS_TELL_V1===';

const RESPONSE_PATH = 'Show vs. Tell response';

export interface ShowVsTellResponseContext {
  /** Host-minted for this attempt; the model never supplies an id. */
  workupId: string;
  invariants: WorkshopShowVsTellInvariants;
}

export function decodeShowVsTellResponse(
  content: string,
  context: ShowVsTellResponseContext
): WorkshopShowVsTellWorkup {
  if (!isShowVsTellWorkupId(context.workupId)) {
    throw new Error('Show vs. Tell workup id must be a host-minted svtw-<UUID> id');
  }
  const ceiling = PROMPT_BUDGETS.workshopWidgets.showVsTellResponseCharacters;
  if (content.length > ceiling) {
    throw new Error(`Show vs. Tell response exceeds ${ceiling} characters`);
  }
  const normalized = content.replace(/\r\n?/g, '\n').trim();
  requireUniqueMarker(normalized, SHOW_VS_TELL_RESPONSE_START);
  requireUniqueMarker(normalized, SHOW_VS_TELL_RESPONSE_END);
  const lines = normalized.split('\n');
  if (lines[0] !== SHOW_VS_TELL_RESPONSE_START) {
    throw new Error('Show vs. Tell opening sentinel must be the first line');
  }
  if (lines[lines.length - 1] !== SHOW_VS_TELL_RESPONSE_END) {
    throw new Error('Show vs. Tell closing sentinel must be the final line');
  }
  const jsonText = lines.slice(1, -1).join('\n').trim();
  if (jsonText.length === 0) {
    throw new Error('Show vs. Tell response JSON is empty');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(
      `Show vs. Tell response JSON is invalid: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const workup = assembleWorkup(parsed, context.workupId);
  assertShowVsTellWorkupShape(workup, 'Show vs. Tell workup');
  const settled = workup as WorkshopShowVsTellWorkup;
  assertShowVsTellWorkupIntegrity(settled, context.invariants, 'Show vs. Tell workup');
  return settled;
}

/**
 * Wire-level extraction only: exact keys and JSON types. Ids are derived here,
 * after parsing and never from the model, from group and variant order.
 */
function assembleWorkup(parsed: unknown, workupId: string): unknown {
  const root = exactObject(parsed, RESPONSE_PATH, ['version', 'groups']);
  numberAt(root.version, `${RESPONSE_PATH}.version`);
  if (root.version !== SHOW_VS_TELL_GENERATION_PROTOCOL_VERSION) {
    shapeError(`${RESPONSE_PATH}.version`, String(SHOW_VS_TELL_GENERATION_PROTOCOL_VERSION));
  }

  let ordinal = 0;
  const groups: unknown[] = [];
  arrayOf(root.groups, `${RESPONSE_PATH}.groups`, (groupValue, groupPath) => {
    const group = exactObject(groupValue, groupPath, ['kind', 'variants']);
    stringAt(group.kind, `${groupPath}.kind`);
    const variants: unknown[] = [];
    arrayOf(group.variants, `${groupPath}.variants`, (variantValue, variantPath) => {
      ordinal += 1;
      const id = showVsTellVariantId(workupId, ordinal);
      const variant = exactObject(variantValue, variantPath, [
        'prose',
        'channels',
        'gains',
        'costs',
        'direction',
        'invariantFlags'
      ]);
      stringAt(variant.prose, `${variantPath}.prose`);
      stringAt(variant.gains, `${variantPath}.gains`);
      stringAt(variant.costs, `${variantPath}.costs`);
      stringAt(variant.direction, `${variantPath}.direction`);
      const channels: unknown[] = [];
      arrayOf(variant.channels, `${variantPath}.channels`, (channel, channelPath) => {
        stringAt(channel, channelPath);
        channels.push(channel);
      });
      const invariantFlags: unknown[] = [];
      arrayOf(variant.invariantFlags, `${variantPath}.invariantFlags`, (flagValue, flagPath) => {
        const flag = exactObject(flagValue, flagPath, ['invariantField', 'kind', 'note']);
        stringAt(flag.invariantField, `${flagPath}.invariantField`);
        stringAt(flag.kind, `${flagPath}.kind`);
        stringAt(flag.note, `${flagPath}.note`);
        invariantFlags.push({
          id: showVsTellFlagId(id, invariantFlags.length + 1),
          invariantField: flag.invariantField,
          kind: flag.kind,
          note: flag.note
        });
      });
      variants.push({
        id,
        prose: variant.prose,
        channels,
        gains: variant.gains,
        costs: variant.costs,
        direction: variant.direction,
        invariantFlags
      });
    });
    groups.push({ kind: group.kind, variants });
  });

  return {
    workupId,
    generationProtocolVersion: SHOW_VS_TELL_GENERATION_PROTOCOL_VERSION,
    groups
  };
}

function requireUniqueMarker(content: string, marker: string): void {
  if (content.split(marker).length !== 2) {
    throw new Error(`Show vs. Tell response must contain exactly one ${marker}`);
  }
}
