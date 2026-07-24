/**
 * Session-scoped temporal awareness for Workshop personas.
 *
 * Notices are prepared before a persona turn and committed only after the
 * response succeeds. A failed/cancelled attempt therefore cannot consume the
 * notice that the next successful turn still needs to see.
 */

import { WorkshopPersonaId } from '@messages';
import { isWorkshopPersonaId } from '@shared/constants/workshopPersonas';
import { buildWorkshopTimeContextFrame } from './WorkshopPromptBuilder';

export type WorkshopPersonaConversationKey =
  | 'host'
  | `guest:${WorkshopPersonaId}`;

export type WorkshopTimeNoticeReason =
  | 'session_start'
  | 'session_resume'
  | 'hourly';

export interface WorkshopPersonaTimeNoticeV1 {
  conversationKey: WorkshopPersonaConversationKey;
  notifiedAt: string;
}

export interface WorkshopSessionTemporalStateV1 {
  schemaVersion: 1;
  startedAt: string;
  timezone: string;
  lastActivityAt: string;
  personaNotices: WorkshopPersonaTimeNoticeV1[];
}

/** Includes transient delivery intent needed to roll back a failed session swap. */
export interface WorkshopSessionTimeRuntimeState {
  temporal: WorkshopSessionTemporalStateV1;
  pendingResumeKeys: WorkshopPersonaConversationKey[];
}

export interface WorkshopPreparedTimeNotice {
  conversationKey: WorkshopPersonaConversationKey;
  observedAt: string;
  reason: WorkshopTimeNoticeReason;
  frame: string;
}

export interface WorkshopSessionTimeOptions {
  now?: () => Date;
  timezone?: string;
}

const NOTICE_INTERVAL_MS = 60 * 60 * 1_000;

const isValidDateString = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

const normalizeDate = (value: Date | string): string => {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error(`Invalid Workshop session timestamp: ${String(value)}`);
  }
  return date.toISOString();
};

function assertExactKeys(
  value: object,
  label: string,
  expected: readonly string[]
): void {
  const actual = Object.keys(value);
  const expectedKeys = new Set(expected);
  const unknown = actual.find((key) => !expectedKeys.has(key));
  if (unknown) {
    throw new Error(`${label} contains unknown field ${unknown}.`);
  }
  const missing = expected.find((key) => !Object.prototype.hasOwnProperty.call(value, key));
  if (missing) {
    throw new Error(`${label} is missing required field ${missing}.`);
  }
}

function assertTimezone(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Workshop session timezone must be a non-empty IANA timezone.');
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date(0));
  } catch {
    throw new Error(`Invalid Workshop session timezone: ${value}`);
  }
}

export const workshopGuestConversationKey = (
  personaId: WorkshopPersonaId
): WorkshopPersonaConversationKey => `guest:${personaId}`;

export const isWorkshopPersonaConversationKey = (
  value: unknown
): value is WorkshopPersonaConversationKey => {
  if (value === 'host') {
    return true;
  }
  if (typeof value !== 'string' || !value.startsWith('guest:')) {
    return false;
  }
  return isWorkshopPersonaId(value.slice('guest:'.length));
};

export function parseWorkshopSessionTemporalStateV1(
  state: unknown
): WorkshopSessionTemporalStateV1 {
  if (!state || typeof state !== 'object') {
    throw new Error('Workshop temporal state must be an object.');
  }
  assertExactKeys(
    state,
    'Workshop temporal state',
    ['schemaVersion', 'startedAt', 'timezone', 'lastActivityAt', 'personaNotices']
  );
  const candidate = state as Partial<WorkshopSessionTemporalStateV1>;
  if (candidate.schemaVersion !== 1) {
    throw new Error(`Unsupported Workshop temporal schema: ${String(candidate.schemaVersion)}`);
  }
  if (!isValidDateString(candidate.startedAt)) {
    throw new Error('Workshop temporal state has an invalid startedAt timestamp.');
  }
  if (!isValidDateString(candidate.lastActivityAt)) {
    throw new Error('Workshop temporal state has an invalid lastActivityAt timestamp.');
  }
  assertTimezone(candidate.timezone);
  if (!Array.isArray(candidate.personaNotices)) {
    throw new Error('Workshop temporal state personaNotices must be an array.');
  }

  const seenKeys = new Set<WorkshopPersonaConversationKey>();
  const personaNotices = candidate.personaNotices.map((notice) => {
    if (
      !notice ||
      typeof notice !== 'object' ||
      !isWorkshopPersonaConversationKey(notice.conversationKey) ||
      !isValidDateString(notice.notifiedAt)
    ) {
      throw new Error('Workshop temporal state contains an invalid persona notice.');
    }
    assertExactKeys(
      notice,
      'Workshop temporal state persona notice',
      ['conversationKey', 'notifiedAt']
    );
    if (seenKeys.has(notice.conversationKey)) {
      throw new Error(`Duplicate Workshop persona notice: ${notice.conversationKey}`);
    }
    seenKeys.add(notice.conversationKey);
    return {
      conversationKey: notice.conversationKey,
      notifiedAt: normalizeDate(notice.notifiedAt)
    };
  });

  return {
    schemaVersion: 1,
    startedAt: normalizeDate(candidate.startedAt),
    timezone: candidate.timezone,
    lastActivityAt: normalizeDate(candidate.lastActivityAt),
    personaNotices
  };
}

export class WorkshopSessionTimeService {
  private readonly now: () => Date;
  private state: WorkshopSessionTemporalStateV1;
  private readonly pendingResumeKeys = new Set<WorkshopPersonaConversationKey>();

  constructor(options: WorkshopSessionTimeOptions = {}) {
    this.now = options.now ?? (() => new Date());
    const now = normalizeDate(this.now());
    const timezone =
      options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
    assertTimezone(timezone);
    this.state = {
      schemaVersion: 1,
      startedAt: now,
      timezone,
      lastActivityAt: now,
      personaNotices: []
    };
  }

  /** Start a truly new session. Webview reconstruction must not call this. */
  reset(): void {
    const now = normalizeDate(this.now());
    this.state = {
      schemaVersion: 1,
      startedAt: now,
      timezone: this.state.timezone,
      lastActivityAt: now,
      personaNotices: []
    };
    this.pendingResumeKeys.clear();
  }

  /**
   * Restore persisted time state and queue one resume notice for every
   * retained persona conversation. The notice applies on that persona's next
   * turn; hydration itself never manufactures a model-history message.
   */
  hydrate(
    state: unknown,
    restoredPersonaKeys: readonly WorkshopPersonaConversationKey[]
  ): void {
    const validated = parseWorkshopSessionTemporalStateV1(state);
    const uniqueKeys = new Set(restoredPersonaKeys);
    for (const key of uniqueKeys) {
      if (!isWorkshopPersonaConversationKey(key)) {
        throw new Error(`Invalid restored Workshop persona key: ${String(key)}`);
      }
    }
    this.state = validated;
    this.pendingResumeKeys.clear();
    uniqueKeys.forEach((key) => this.pendingResumeKeys.add(key));
  }

  exportState(): WorkshopSessionTemporalStateV1 {
    return {
      ...this.state,
      personaNotices: this.state.personaNotices.map((notice) => ({ ...notice }))
    };
  }

  /** Snapshot durable state plus queued resume delivery for transaction rollback. */
  exportRuntimeState(): WorkshopSessionTimeRuntimeState {
    return {
      temporal: this.exportState(),
      pendingResumeKeys: [...this.pendingResumeKeys]
    };
  }

  /** Restore a prior in-memory transaction boundary without losing queued notices. */
  restoreRuntimeState(state: WorkshopSessionTimeRuntimeState): void {
    if (
      !state ||
      typeof state !== 'object' ||
      !Array.isArray(state.pendingResumeKeys)
    ) {
      throw new Error('Workshop time runtime state is invalid.');
    }
    this.hydrate(state.temporal, state.pendingResumeKeys);
  }

  describeVisibleMarker(kind: 'start' | 'resume'): string {
    const observedAt = normalizeDate(this.now());
    const formatter = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'full',
      timeStyle: 'long',
      timeZone: this.state.timezone
    });
    if (kind === 'start') {
      return `Session started ${formatter.format(new Date(this.state.startedAt))} (${this.state.timezone}).`;
    }
    const elapsedMs = Math.max(0, Date.parse(observedAt) - Date.parse(this.state.startedAt));
    const elapsedHours = Math.floor(elapsedMs / (60 * 60 * 1_000));
    const elapsedMinutes = Math.floor(elapsedMs / 60_000) % 60;
    const elapsed = elapsedHours > 0
      ? `${elapsedHours}h ${elapsedMinutes}m`
      : `${elapsedMinutes}m`;
    return `Session resumed ${formatter.format(new Date(observedAt))} (${this.state.timezone}) after ${elapsed}.`;
  }

  /**
   * Return the trusted time frame due on this persona's next turn. Call
   * `commitNotice` only after the matching response has committed.
   */
  prepareNotice(
    conversationKey: WorkshopPersonaConversationKey
  ): WorkshopPreparedTimeNotice | undefined {
    const observedAt = normalizeDate(this.now());
    const prior = this.state.personaNotices.find(
      (notice) => notice.conversationKey === conversationKey
    );
    const reason: WorkshopTimeNoticeReason | undefined =
      this.pendingResumeKeys.has(conversationKey)
        ? 'session_resume'
        : prior === undefined
          ? 'session_start'
          : Date.parse(observedAt) - Date.parse(prior.notifiedAt) >= NOTICE_INTERVAL_MS
            ? 'hourly'
            : undefined;

    if (!reason) {
      return undefined;
    }
    return {
      conversationKey,
      observedAt,
      reason,
      frame: buildWorkshopTimeContextFrame({
        reason,
        sessionStartedAt: this.state.startedAt,
        observedAt,
        timezone: this.state.timezone
      })
    };
  }

  commitNotice(notice: WorkshopPreparedTimeNotice): void {
    if (!isWorkshopPersonaConversationKey(notice.conversationKey)) {
      throw new Error(`Invalid Workshop time notice key: ${String(notice.conversationKey)}`);
    }
    const notifiedAt = normalizeDate(notice.observedAt);
    const notices = this.state.personaNotices.filter(
      (entry) => entry.conversationKey !== notice.conversationKey
    );
    notices.push({ conversationKey: notice.conversationKey, notifiedAt });
    notices.sort((left, right) => left.conversationKey.localeCompare(right.conversationKey));
    this.state = {
      ...this.state,
      lastActivityAt: this.laterTimestamp(this.state.lastActivityAt, notifiedAt),
      personaNotices: notices
    };
    this.pendingResumeKeys.delete(notice.conversationKey);
  }

  touch(at: Date | string = this.now()): void {
    const observedAt = normalizeDate(at);
    this.state = {
      ...this.state,
      lastActivityAt: this.laterTimestamp(this.state.lastActivityAt, observedAt)
    };
  }

  private laterTimestamp(left: string, right: string): string {
    return Date.parse(right) > Date.parse(left) ? right : left;
  }
}
