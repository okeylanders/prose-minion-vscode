import { ContextBudgetSnapshot, ModelOption } from '@shared/types';

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

/**
 * Deterministic identity color slot for a participant label. Conversation ids
 * never reach the webview, so the label is the only stable identity — a hash
 * keeps each participant's dot color steady across renders and reloads.
 */
export const participantDotIndex = (label: string): number => {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 31 + label.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 5;
};

export const formatCompactTokens = (tokens: number): string => {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(tokens >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(tokens >= 100_000 ? 0 : 1).replace(/\.0$/, '')}K`;
  return tokens.toLocaleString();
};
