/**
 * Guard the start-of-conversation list size (Everyday Conveniences, Round
 * Two, item C; ADR 2026-11-17 D9, D10, D12) against drift between its
 * parts: the closed table, the manifest's setting, the Memory tab's row,
 * and the neutral `<page>` module.
 *
 * - **The manifest's enum is the code's list,** in its order, with the
 *   code's default, application scope, and each description's token
 *   figures read from the table.
 * - **The tab's row is the table's:** one card per size, each stating its
 *   own row's tokens, never a literal.
 * - **`pinnedTokens` is one number** at every size.
 * - **The page module is neutral:** it imports no capability family.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  DEFAULT_WORKSHOP_PROJECT_MEMORY_LIST_SIZE,
  WORKSHOP_MEMORY_LIST_SIZE_SETTING,
  WORKSHOP_PROJECT_MEMORY_LIST_SIZE_IDS,
  WORKSHOP_PROJECT_MEMORY_LIST_SIZES
} from '@shared/constants/workshopProjectMemoryListSizes';
import {
  WORKSHOP_MEMORY_LIST_SIZE_APPLIES,
  WORKSHOP_MEMORY_LIST_SIZE_LABEL,
  workshopMemoryListSizeView
} from '@hooks/domain/workshop/memory/workshopMemoryListSizeView';

const CORE_ROOT = path.resolve(__dirname, '../../..');
const SRC_ROOT = path.join(CORE_ROOT, 'src');
const number = (value: number): string => value.toLocaleString('en-US');

describe('proseMinion.workshop.memory.listSize in the manifest', () => {
  const manifest = JSON.parse(fs.readFileSync(path.resolve(CORE_ROOT, '../../apps/vscode-extension/package.json'), 'utf8')) as {
    contributes: { configuration: { properties: Record<string, Record<string, unknown>> } | Array<{ properties: Record<string, Record<string, unknown>> }> };
  };
  const configuration = manifest.contributes.configuration;
  const properties = Array.isArray(configuration)
    ? Object.assign({}, ...configuration.map((section) => section.properties)) as Record<string, Record<string, unknown>>
    : configuration.properties;
  const key = `${WORKSHOP_MEMORY_LIST_SIZE_SETTING.section}.${WORKSHOP_MEMORY_LIST_SIZE_SETTING.key}`;
  const setting = properties[key];

  it('is the closed list, in its order, with the code\'s default, for every project', () => {
    expect(key).toBe('proseMinion.workshop.memory.listSize');
    expect(setting).toMatchObject({ type: 'string', scope: 'application', default: DEFAULT_WORKSHOP_PROJECT_MEMORY_LIST_SIZE });
    expect(setting.enum).toEqual([...WORKSHOP_PROJECT_MEMORY_LIST_SIZE_IDS]);
    // The project-memory mode it sits beside is application-scoped too.
    expect(properties['proseMinion.workshop.projectMemory'].scope).toBe('application');
  });

  it('states each size\'s tokens from the table, and no other number', () => {
    const descriptions = setting.enumDescriptions as string[];
    expect(descriptions).toHaveLength(WORKSHOP_PROJECT_MEMORY_LIST_SIZE_IDS.length);
    WORKSHOP_PROJECT_MEMORY_LIST_SIZE_IDS.forEach((size, index) => {
      const row = WORKSHOP_PROJECT_MEMORY_LIST_SIZES[size];
      expect(descriptions[index]).toBe(
        `Up to ${number(row.catalogTokens)} tokens of titles and summaries, then up to ${number(row.titleTokens)} tokens of titles alone.`
      );
    });
  });

  it('says in the description when a change applies, and that load-in-full keeps its own budget', () => {
    const description = setting.markdownDescription as string;
    expect(description).toContain('A change applies from the next conversation; an open conversation keeps the list it started with.');
    expect(description).toContain(`keep their own ${number(PROMPT_BUDGETS.workshopProjectMemory.pinnedTokens)} tokens at every size`);
    expect(description.match(/\d[\d,]*/g)).toEqual([number(PROMPT_BUDGETS.workshopProjectMemory.pinnedTokens)]);
  });
});

describe('the table', () => {
  it('moves pinnedTokens at no size, and grows every other budget with the size', () => {
    const rows = WORKSHOP_PROJECT_MEMORY_LIST_SIZE_IDS.map((size) => WORKSHOP_PROJECT_MEMORY_LIST_SIZES[size]);
    expect(new Set(rows.map((row) => row.pinnedTokens))).toEqual(new Set([PROMPT_BUDGETS.workshopProjectMemory.pinnedTokens]));
    for (const field of ['catalogTokens', 'catalogEntries', 'titleTokens'] as const) {
      const values = rows.map((row) => row[field]);
      expect([field, [...values].sort((left, right) => left - right)]).toEqual([field, values]);
      expect([field, new Set(values).size]).toEqual([field, values.length]);
    }
  });

  it('is frozen: a row cannot be moved at run time', () => {
    expect(Object.isFrozen(WORKSHOP_PROJECT_MEMORY_LIST_SIZES)).toBe(true);
    expect(WORKSHOP_PROJECT_MEMORY_LIST_SIZE_IDS.every((size) => Object.isFrozen(WORKSHOP_PROJECT_MEMORY_LIST_SIZES[size]))).toBe(true);
  });
});

describe('the Memory tab\'s row', () => {
  it('draws one card per size, in the list\'s order, each with its own row\'s tokens', () => {
    const view = workshopMemoryListSizeView('larger');
    expect(view.label).toBe('List at the start of each conversation');
    expect(WORKSHOP_MEMORY_LIST_SIZE_LABEL).toBe(view.label);
    expect(view.cards.map((card) => [card.size, card.name, card.selected])).toEqual([
      ['standard', 'Standard', false], ['larger', 'Larger', true], ['largest', 'Largest', false]
    ]);
    for (const card of view.cards) {
      const row = WORKSHOP_PROJECT_MEMORY_LIST_SIZES[card.size];
      expect(card.description).toBe(`Up to ${number(row.catalogTokens)} tokens of titles and summaries, then up to ${number(row.titleTokens)} of titles alone.`);
    }
    expect(view.cards[0].description).toBe('Up to 2,000 tokens of titles and summaries, then up to 2,000 of titles alone.');
  });

  it('says when the choice applies, first', () => {
    const view = workshopMemoryListSizeView('standard');
    expect(WORKSHOP_MEMORY_LIST_SIZE_APPLIES).toBe('Applies from the next conversation.');
    expect(view.notes).toEqual([
      'Applies from the next conversation.',
      'An open conversation keeps the list it started with. This choice is saved as soon as you make it, for all your projects.'
    ]);
  });
});

describe('the <page> module is neutral (ADR 2026-11-17 D10)', () => {
  const source = fs.readFileSync(path.join(SRC_ROOT, 'application/services/workshop/WorkshopCapabilityPaging.ts'), 'utf8');
  const imports = [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1]);

  it('imports only the budgets: no capability family, codec, session or host module', () => {
    expect(imports).toEqual(['@shared/constants/promptBudgets']);
  });

  it('is the one place a <page> is parsed: the memory codec reads it through workshopCapabilityPage', () => {
    const codec = fs.readFileSync(path.join(SRC_ROOT, 'application/services/workshop/memory/WorkshopProjectMemoryXmlCodec.ts'), 'utf8');
    expect(codec).toContain('workshopCapabilityPage(written)');
    // No second page pattern, and no page ceiling, in the family's own codec.
    expect(codec).not.toMatch(/\[1-9\]|pageDigits|maxPage|Number\(/);
  });

  it('reads its only bound from PROMPT_BUDGETS', () => {
    expect(source).toContain('PROMPT_BUDGETS.workshopCapabilityPaging.pageDigits');
    expect(source.replace(/\/\*[\s\S]*?\*\//g, '').match(/\b\d{2,}\b/g)).toEqual(['32']);
  });
});
