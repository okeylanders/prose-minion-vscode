import { ContextBudgetSnapshot, ModelOption } from '@shared/types';
import { WORKSHOP_PERSONA_CATALOG } from '@shared/constants/workshopPersonas';

export type ContextBudgetTone = 'normal' | 'watch' | 'high' | 'critical' | 'unknown';

export interface ContextBudgetView {
  usableInputTokens?: number;
  /** Whole percent; tone derives from this same value so label and color never disagree. */
  utilizationPercent?: number;
  tone: ContextBudgetTone;
}

export const contextBudgetTone = (utilizationPercent: number | undefined): ContextBudgetTone => {
  if (utilizationPercent === undefined) return 'unknown';
  if (utilizationPercent >= 95) return 'critical';
  if (utilizationPercent >= 85) return 'high';
  if (utilizationPercent >= 70) return 'watch';
  return 'normal';
};

export const contextBudgetView = (
  snapshot: ContextBudgetSnapshot,
  model: ModelOption | undefined
): ContextBudgetView => {
  const contextLength = model?.liveDataAvailable === false ? undefined : model?.contextLength;
  if (!contextLength) return { tone: 'unknown' };
  const usableInputTokens = contextLength - snapshot.requestedMaxOutputTokens;
  if (usableInputTokens <= 0) return { tone: 'unknown' };
  const utilizationPercent = Math.round((snapshot.contextTokens / usableInputTokens) * 100);
  return {
    usableInputTokens,
    utilizationPercent,
    tone: contextBudgetTone(utilizationPercent)
  };
};

const PARTICIPANT_IDENTITY_COLOR_COUNT = WORKSHOP_PERSONA_CATALOG.length;
const PERSONA_IDENTITY_COLOR_INDEX: ReadonlyMap<string, number> = new Map(
  WORKSHOP_PERSONA_CATALOG.map((persona, index) => [persona.id, index])
);

/**
 * Deterministic identity color slot. Canonical Workshop personas receive
 * collision-free roster slots; other participant kinds retain a stable hash.
 */
export const participantIdentityColorIndex = (identity: string): number => {
  const personaIndex = PERSONA_IDENTITY_COLOR_INDEX.get(identity);
  if (personaIndex !== undefined) return personaIndex;

  let hash = 0;
  for (let i = 0; i < identity.length; i += 1) {
    hash = (hash * 31 + identity.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % PARTICIPANT_IDENTITY_COLOR_COUNT;
};

export const formatCompactTokens = (tokens: number): string => {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(tokens >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(tokens >= 100_000 ? 0 : 1).replace(/\.0$/, '')}K`;
  return tokens.toLocaleString();
};
