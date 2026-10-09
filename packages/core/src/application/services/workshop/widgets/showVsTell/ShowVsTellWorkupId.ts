/** Host-minted identity for one complete Show vs. Tell generation attempt. */

import { randomUUID } from 'node:crypto';

export type ShowVsTellUuidFactory = () => string;
export type ShowVsTellWorkupIdFactory = () => string;

const SHOW_VS_TELL_WORKUP_ID_PATTERN =
  /^svtw-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isShowVsTellWorkupId(value: string): boolean {
  return SHOW_VS_TELL_WORKUP_ID_PATTERN.test(value);
}

/** Every full generation attempt mints a fresh id; cancelled or failed ids are never reused. */
export function createShowVsTellWorkupIdFactory(
  uuidFactory: ShowVsTellUuidFactory = randomUUID
): ShowVsTellWorkupIdFactory {
  return () => `svtw-${uuidFactory()}`;
}
