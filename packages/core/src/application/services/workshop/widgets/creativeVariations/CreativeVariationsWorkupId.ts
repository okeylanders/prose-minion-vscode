/** Host-minted identity for one complete Creative Variations generation attempt. */

import { randomUUID } from 'node:crypto';

export type CreativeVariationsUuidFactory = () => string;
export type CreativeVariationsWorkupIdFactory = () => string;

export function createCreativeVariationsWorkupIdFactory(
  uuidFactory: CreativeVariationsUuidFactory = randomUUID
): CreativeVariationsWorkupIdFactory {
  return () => `cvw-${uuidFactory()}`;
}
