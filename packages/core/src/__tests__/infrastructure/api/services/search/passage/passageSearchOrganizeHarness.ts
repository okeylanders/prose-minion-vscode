/**
 * The organizing pass's test host: the real organizer and the real service
 * over one stand-in engine, prompt loader, price port and log. No provider
 * is reached. Texts adapt *Alice's Adventures in Wonderland*.
 */
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { PassageSearchResult } from '@services/search/passage/PassageSearchContracts';
import { PassageSearchModelOrganizer } from '@services/search/passage/PassageSearchModelOrganizer';
import type { PassageSearchOrganizePlan } from '@services/search/passage/PassageSearchOrganizer';
import type { PassageSearchModelFacts } from '@services/search/passage/PassageSearchPrices';
import { PassageSearchService } from '@services/search/passage/PassageSearchService';
import { instanceOf, resultOf } from '@/__tests__/infrastructure/api/services/search/passage/passageSearchFixtures';

export const USAGE = { promptTokens: 100, completionTokens: 20, totalTokens: 120, costUsd: 0.001 };
export const organize = PROMPT_BUDGETS.passageSearch.organize;
export const PRICING = { promptUsdPerToken: 0.000001, completionUsdPerToken: 0.000004 };

export type Reply = { content: string; finishReason?: string; cancelled?: boolean } | Error | (() => { content: string; cancelled?: boolean });

export interface HostOptions {
  engine?: boolean;
  facts?: PassageSearchModelFacts | Error;
}

export function createHost(replies: Reply[] = [], options: HostOptions = {}) {
  const queue = [...replies];
  const state = { facts: options.facts, engine: options.engine !== false };
  const runInitial = jest.fn(async (_request: Record<string, any>) => {
    const next = queue.shift();
    if (!next) {
      throw new Error('no reply queued');
    }
    if (next instanceof Error) {
      throw next;
    }
    const reply = typeof next === 'function' ? next() : next;
    return { usedGuides: [], requestedResources: [], artifacts: [], finishReason: 'stop', usage: USAGE, cancelled: false, ...reply };
  });
  const engine = { runInitial, getModel: jest.fn(() => 'another/model-by-now') };
  const manager = {
    ensureInitialized: jest.fn(async () => undefined),
    getEngine: jest.fn(() => (state.engine ? engine : undefined))
  };
  const promptLoader = { loadPrompts: jest.fn(async (files: string[]) => `SYSTEM ${files.join(' + ')}`) };
  const prices = {
    facts: jest.fn(async () => {
      if (state.facts instanceof Error) {
        throw state.facts;
      }
      return state.facts ?? { pricing: PRICING };
    })
  };
  const log = { appendLine: jest.fn() };
  const organizer = new PassageSearchModelOrganizer(manager as never, promptLoader as never, prices, log as never);
  const service = new PassageSearchService(manager as never, promptLoader as never, prices, log as never, organizer);
  const logged = (): string => log.appendLine.mock.calls.map(([line]) => String(line)).join('\n');
  return { organizer, service, runInitial, manager, promptLoader, prices, log, logged, state };
}

export const RESULT = resultOf([
  instanceOf(1, { line: 3, quote: '“Oh dear! Oh dear! I shall be late!” it said to itself.', note: 'The Rabbit says outright that it will be late.', label: 'says it aloud' }),
  instanceOf(2, { line: 5, quote: 'took a watch out of its waistcoat-pocket', note: 'It takes out its watch.' }),
  instanceOf(3, { line: 9, quote: 'glanced at its watch again', note: 'It checks the time once more.', displayPath: 'chapters/2.md', file: 'f2' })
], { ended: 'stopped' });

export const ANALYSIS_REPLY = JSON.stringify({
  headline: 'The Rabbit frets aloud once and reaches for its watch twice.',
  sections: [
    { title: 'Aloud', claims: [{ text: 'It cries "I shall be late!" to itself.', cites: [1] }] },
    { title: 'The watch', claims: [{ text: 'It "took a watch out of its waistcoat-pocket", then "glanced at its watch again".', cites: [2, 3] }] }
  ]
});
export const ok = (content: string = ANALYSIS_REPLY): { content: string } => ({ content });

export async function planOf(organizer: PassageSearchModelOrganizer, result: PassageSearchResult = RESULT): Promise<PassageSearchOrganizePlan> {
  const outcome = await organizer.plan(result);
  if (outcome.kind !== 'planned') {
    throw new Error(`expected a plan, got: ${outcome.message}`);
  }
  return outcome.plan;
}

