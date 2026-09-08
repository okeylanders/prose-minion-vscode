/** Full checkpoint equality for optimistic named-session writes, not timestamp ordering. */
import { isDeepStrictEqual } from 'util';
import {
  decodeWorkshopPersistedSessionCheckpoint,
  WorkshopPersistedSessionV2
} from '@/application/services/workshop/WorkshopPersistedSession';

export function hasSameWorkshopCheckpoint(
  left: WorkshopPersistedSessionV2,
  right: WorkshopPersistedSessionV2
): boolean {
  // Compare the same decoded JSON contract on both sides, including archives and
  // metadata. Property order and omitted undefined members are not file edits.
  const normalize = (value: WorkshopPersistedSessionV2): unknown =>
    JSON.parse(JSON.stringify(decodeWorkshopPersistedSessionCheckpoint(value).session));
  return isDeepStrictEqual(normalize(left), normalize(right));
}
