import {
  contextBudgetTone,
  contextBudgetView,
  formatCompactTokens,
  participantDotIndex
} from '@utils/contextBudget';
import { ContextBudgetSnapshot, ModelOption } from '@shared/types';

const snapshot = (contextTokens: number): ContextBudgetSnapshot => ({
  modelId: 'model/a',
  contextTokens,
  promptTokens: contextTokens,
  completionTokens: 0,
  peakPromptTokensThisTurn: contextTokens,
  requestedMaxOutputTokens: 100,
  callsThisTurn: 1,
  turnProcessedTokens: contextTokens + 1,
  contextCompression: 'unknown',
  measuredAt: 1
});
const liveModel: ModelOption = {
  id: 'model/a',
  label: 'Model A',
  contextLength: 1100,
  liveDataAvailable: true
};

describe('context budget formatting', () => {
  it.each([
    [69, 'normal'], [70, 'watch'], [84, 'watch'], [85, 'high'],
    [94, 'high'], [95, 'critical']
  ])('uses the locked threshold at %s%%', (percent, tone) => {
    expect(contextBudgetTone(percent)).toBe(tone);
  });

  it('subtracts the requested output reserve from live model context', () => {
    expect(contextBudgetView(snapshot(700), liveModel)).toEqual({
      usableInputTokens: 1000,
      utilizationPercent: 70,
      tone: 'watch'
    });
  });

  it('does not invent a denominator for missing or fallback catalog metadata', () => {
    expect(contextBudgetView(snapshot(700), undefined)).toEqual({ tone: 'unknown' });
    expect(contextBudgetView(snapshot(700), { ...liveModel, liveDataAvailable: false })).toEqual({ tone: 'unknown' });
  });

  it('formats compact token values without relabeling their meaning', () => {
    expect(formatCompactTokens(38_181)).toBe('38.2K');
    expect(formatCompactTokens(190_000)).toBe('190K');
  });

  it('assigns each participant label a stable identity-dot slot', () => {
    const jill = participantDotIndex('Jill context');
    expect(jill).toBe(participantDotIndex('Jill context'));
    expect(jill).toBeGreaterThanOrEqual(0);
    expect(jill).toBeLessThan(5);
    expect(participantDotIndex('')).toBe(0);
  });
});
