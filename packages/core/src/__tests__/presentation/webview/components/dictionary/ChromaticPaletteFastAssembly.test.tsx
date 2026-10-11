/** @jest-environment jsdom */

/**
 * PR #142 review F-01: Fast Generate concatenates independently generated
 * blocks, and the Dictionary renderer replaces palette fences with components.
 * A palette block whose fence never closes (a token-limited response or a
 * forgotten delimiter) must not absorb the Topic & Related Lexicon block that
 * follows it, either in the raw entry or on screen.
 *
 * Real DictionaryService (real prompt files, mocked engine) → real
 * MarkdownRenderer with the Dictionary's fenced-block registry.
 */

jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import * as fs from 'fs';
import * as path from 'path';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { DictionaryService } from '@/infrastructure/api/services/dictionary/DictionaryService';
import { MarkdownRenderer } from '@components/shared/MarkdownRenderer';
import { DICTIONARY_FENCED_BLOCKS } from '@components/dictionary/ChromaticPaletteBlock';
import { findUnterminatedFence } from '@/utils/markdownFences';

const PROMPT_ROOT = path.resolve(__dirname, '../../../../../../resources/system-prompts');
const TOPIC_BODY = 'A COMPLETE INDEPENDENT TOPIC APPENDIX MUST REMAIN VISIBLE.';
const TOPIC_RESPONSE = `# 📂 Topic & Related Lexicon\n\n${TOPIC_BODY}`;

function paletteResponse(delimiter: string, closed: boolean, swatch = 'Copper | #B87333 | The reddish-orange of polished copper'): string {
  const fence = [`${delimiter}pm-palette`, 'title: Warm Copper', 'kind: literal', swatch];
  return ['# 🎨 Chromatic Palettes', '', ...fence, ...(closed ? [delimiter] : [])].join('\n');
}

async function generateFastEntry(palette: string, finishReason: 'stop' | 'length') {
  const loadPrompts = jest.fn(async (paths: string[]) =>
    paths.map((file) => fs.readFileSync(path.join(PROMPT_ROOT, file), 'utf8')).join('\n\n'));
  const runInitial = jest.fn().mockImplementation(async ({ toolName }: { toolName: string }) => ({
    content: toolName === 'dictionary-fast-chromatic-palettes'
      ? palette
      : toolName === 'dictionary-fast-topic-related-lexicon'
        ? TOPIC_RESPONSE
        : `# ${toolName.replace('dictionary-fast-', '')}`,
    finishReason: toolName === 'dictionary-fast-chromatic-palettes' ? finishReason : 'stop'
  }));
  const outputChannel = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
  const service = new DictionaryService(
    { ensureInitialized: async () => undefined, getEngine: () => ({ runInitial }) } as never,
    { getPromptLoader: () => ({ loadPrompts }) } as never,
    {} as never,
    outputChannel
  );
  const entry = await service.generateParallelDictionary('copper', undefined, {
    includePalettes: true,
    includeEncyclopedia: true
  });
  return { entry, outputChannel };
}

describe('Fast Generate keeps sibling blocks out of an unclosed palette fence (F-01)', () => {
  const delimiters = ['```', '````', '~~~', '~~~~'];

  describe.each(delimiters)('with %s fences', (delimiter) => {
    it.each([
      ['closed (control)', true, 'stop'],
      ['unclosed after a normal stop', false, 'stop'],
      ['unclosed after the token limit', false, 'length']
    ] as const)('%s: renders the palette and the following Topic section', async (_label, closed, finishReason) => {
      const { entry, outputChannel } = await generateFastEntry(paletteResponse(delimiter, closed), finishReason);

      expect(entry.metadata).toMatchObject({ successCount: 17, totalBlocks: 17, partialFailures: [] });
      // The raw entry Copy and Save carry: Topic sits outside every fence.
      const topicStart = entry.result.indexOf('# 📂 Topic & Related Lexicon');
      expect(topicStart).toBeGreaterThan(entry.result.indexOf('# 🎨 Chromatic Palettes'));
      expect(findUnterminatedFence(entry.result.slice(0, topicStart))).toBeUndefined();
      expect(entry.result).toContain(TOPIC_BODY);
      const closedFenceLogs = outputChannel.appendLine.mock.calls
        .filter(([line]) => String(line).startsWith('[DictionaryService] Closed an unterminated fence'));
      expect(closedFenceLogs).toEqual(closed
        ? []
        : [['[DictionaryService] Closed an unterminated fence in block "chromatic-palettes"']]);

      render(<MarkdownRenderer content={entry.result} fencedBlocks={DICTIONARY_FENCED_BLOCKS} />);

      expect(screen.getByRole('img', { name: 'Copper, #B87333, rgb(184, 115, 51)' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: '📂 Topic & Related Lexicon' })).toBeTruthy();
      expect(screen.getByText(TOPIC_BODY)).toBeTruthy();
    });

    it('unclosed with no valid swatch: keeps the fence as readable code and Topic visible', async () => {
      const { entry } = await generateFastEntry(
        paletteResponse(delimiter, false, 'Copper | not-a-color | the reddish-orange of polished copper'),
        'length'
      );

      render(<MarkdownRenderer content={entry.result} fencedBlocks={DICTIONARY_FENCED_BLOCKS} />);

      expect(screen.queryByRole('img')).toBeNull();
      expect(document.querySelector('pre code')?.textContent).toContain('Copper | not-a-color');
      expect(screen.getByText(TOPIC_BODY)).toBeTruthy();
    });
  });
});
