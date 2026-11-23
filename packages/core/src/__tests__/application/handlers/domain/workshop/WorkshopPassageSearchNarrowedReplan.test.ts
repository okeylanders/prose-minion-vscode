/**
 * A narrowed card replanned after one of its patterns stopped finding files
 * (ADR 2026-11-20 S53). Settlement checked that every pattern found a file;
 * the engine applies the same rule at every plan, so the card's price and
 * its Run both refuse in host words, and never search fewer files than the
 * card names. The real engine plans over the real resolver walking a
 * made-up *Alice* project, through the real routes and room; nothing is
 * sent to a model.
 */
/* eslint-disable @typescript-eslint/naming-convention -- made-up roots and setting keys, keyed by their paths and names. */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => (fn: () => Promise<unknown>) => fn()
}));

import { MessageType } from '@messages';
import { ContextResourceResolver } from '@/infrastructure/context/ContextResourceResolver';
import { PassageSearchService } from '@services/search/passage/PassageSearchService';
import { passageSearchRefusal } from '@services/search/passage/PassageSearchRefusals';
import { ProjectPassageSearchEngine } from '@/application/services/passageSearch/PassageSearchEngine';
import { PassageSearchScopeFiles } from '@/application/services/passageSearch/PassageSearchScopeFiles';
import type { WorkshopPassageSearchPorts } from '@handlers/domain/workshop/WorkshopPassageSearchHandler';
import { aliceProject } from '../../../services/contextPaths/aliceProject';
import { QUESTION, searchFrame } from './passageSearchRouteFixtures';
import { passageSearchRouteDriver } from './passageSearchRouteDriver';

const BOOK = ['Drafts/chapter-1.md', 'Drafts/chapter-1.2.md', 'Drafts/chapter-4.1.md', 'Drafts/chapter-4.2.md'];

function realPorts() {
  const files = [...BOOK];
  const alice = aliceProject({ roots: { '/alice': files }, settings: { 'contextPaths.chapters': 'Drafts/**' } });
  const resolver = new ContextResourceResolver(alice.settings, alice.fileSystem, alice.workspace, alice.log);
  const runInitial = jest.fn();
  const engine = { runInitial, getModel: jest.fn(() => 'placeholder/passage-model'), isProviderAvailable: jest.fn(() => true) };
  const manager = { ensureInitialized: jest.fn(async () => undefined), getEngine: jest.fn(() => engine) };
  const prompts = { loadPrompts: jest.fn(async (names: string[]) => `SYSTEM ${names.join(' + ')}`) };
  const prices = { facts: jest.fn(async () => ({ pricing: { promptUsdPerToken: 0.000001, completionUsdPerToken: 0.000004 } })) };
  const log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
  const scopeFiles = new PassageSearchScopeFiles({
    listing: resolver,
    fileSystem: { readFile: async () => new TextEncoder().encode('The Rabbit looked at his watch.'), stat: alice.fileSystem.stat },
    workspace: alice.workspace,
    editor: { currentSelection: () => undefined }
  });
  const ports: WorkshopPassageSearchPorts = {
    engine: new ProjectPassageSearchEngine(scopeFiles, new PassageSearchService(manager as never, prompts as never, prices, log as never), log as never),
    listing: resolver,
    reports: { save: jest.fn(async () => ({ status: 'saved' as const, filePath: 'prose-minion/reports/r.md', opened: true })) }
  };
  /** Every file one pattern found, gone from the project since the card was settled. */
  const remove = (prefix: string) => {
    for (let index = files.length - 1; index >= 0; index -= 1) {
      if (files[index].startsWith(prefix)) {
        files.splice(index, 1);
      }
    }
  };
  return { ports, remove, runInitial };
}

describe('a narrowed card whose pattern no longer finds a file', () => {
  it('prices while both patterns find files; once one finds none, Estimate and Run both refuse, and nothing is searched', async () => {
    const { ports, remove, runInitial } = realPorts();
    const frame = searchFrame(`<question>${QUESTION}</question>\n<group match="Drafts/chapter-4.*.md, Drafts/chapter-1*.md">chapters</group>`);
    const driver = await passageSearchRouteDriver({ passageSearch: ports }, undefined, frame);
    expect(driver.card.passageSearchRequest?.scopes).toEqual([
      { kind: 'group', group: 'chapters', match: ['Drafts/chapter-4.*.md', 'Drafts/chapter-1*.md'] }
    ]);
    const [priced] = await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_ESTIMATE);
    expect(priced).toEqual(expect.objectContaining({ action: 'estimate', outcome: 'done' }));
    expect(priced.estimate.files).toBe(4);

    remove('Drafts/chapter-1');
    const words = passageSearchRefusal('match-found-nothing').message;
    const [estimate] = await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_ESTIMATE);
    expect(estimate).toEqual(expect.objectContaining({ outcome: 'refused', reason: 'plan-refused', message: words }));
    const [run] = await driver.done(MessageType.WORKSHOP_PASSAGE_SEARCH_RUN, { planKey: priced.estimate.planKey });
    expect(run).toEqual(expect.objectContaining({ outcome: 'refused', reason: 'plan-refused', message: words }));
    expect(runInitial).not.toHaveBeenCalled();
    expect(await driver.view()).toEqual(expect.objectContaining({ status: 'pending' }));
  });
});
