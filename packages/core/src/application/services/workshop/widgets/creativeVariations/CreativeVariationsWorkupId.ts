/** Host-minted identity for one complete Creative Variations generation attempt. */

import { randomUUID } from 'node:crypto';

export type CreativeVariationsUuidFactory = () => string;
export type CreativeVariationsWorkupIdFactory = () => string;

const CREATIVE_VARIATIONS_WORKUP_ID_PATTERN =
  /^cvw-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isCreativeVariationsWorkupId(value: string): boolean {
  return CREATIVE_VARIATIONS_WORKUP_ID_PATTERN.test(value);
}

export function createCreativeVariationsWorkupIdFactory(
  uuidFactory: CreativeVariationsUuidFactory = randomUUID
): CreativeVariationsWorkupIdFactory {
  return () => `cvw-${uuidFactory()}`;
}
