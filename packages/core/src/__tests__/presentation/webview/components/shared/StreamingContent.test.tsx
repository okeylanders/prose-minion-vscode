/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { CHROMATIC_PALETTE_FENCE_LANGUAGE } from '@shared/constants/chromaticPalettes';
import { MarkdownFencedBlocks } from '@components/shared/MarkdownRenderer';
import { StreamingContent } from '@components/shared/StreamingContent';
import { DICTIONARY_FENCED_BLOCKS } from '@components/dictionary/ChromaticPaletteBlock';

const STREAMED_ENTRY = [
  '# 🎨 Chromatic Palettes',
  '',
  '```pm-palette',
  'title: Warm Copper',
  'Copper | #B87333 | the reddish-orange of the bare metal',
  'Bronze | #CD7'
].join('\n');

const streamingProps = {
  isStreaming: true,
  isBuffering: false,
  chunkCount: 12,
  elapsedMs: 1500,
  chunksPerSecond: 8
};

describe('StreamingContent fenced blocks', () => {
  it('passes fencedBlocks through to MarkdownRenderer', () => {
    const renderFence = jest.fn((source: string) => <aside data-testid="fenced">{source.length}</aside>);
    const fencedBlocks: MarkdownFencedBlocks = { [CHROMATIC_PALETTE_FENCE_LANGUAGE]: { render: renderFence } };

    render(<StreamingContent {...streamingProps} content={STREAMED_ENTRY} fencedBlocks={fencedBlocks} />);

    expect(screen.getByTestId('fenced')).toBeTruthy();
    expect(renderFence).toHaveBeenCalledWith(
      'title: Warm Copper\nCopper | #B87333 | the reddish-orange of the bare metal\nBronze | #CD7'
    );
  });

  it('renders mid-stream palettes with the Dictionary registry', () => {
    render(<StreamingContent {...streamingProps} content={STREAMED_ENTRY} fencedBlocks={DICTIONARY_FENCED_BLOCKS} />);

    expect(screen.getByRole('figure', { name: 'Warm Copper' })).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('keeps the fence as a code block when no registry is passed', () => {
    const { container } = render(<StreamingContent {...streamingProps} content={STREAMED_ENTRY} />);

    expect(container.querySelector('.pm-palette')).toBeNull();
    expect(container.querySelector('pre code.language-pm-palette')).not.toBeNull();
  });

  it('does not render Markdown or fenced blocks before the first chunk', () => {
    const renderFence = jest.fn(() => null);

    render(
      <StreamingContent
        {...streamingProps}
        chunkCount={0}
        content=""
        fencedBlocks={{ [CHROMATIC_PALETTE_FENCE_LANGUAGE]: { render: renderFence } }}
      />
    );

    expect(renderFence).not.toHaveBeenCalled();
    expect(document.querySelector('.markdown-content')).toBeNull();
  });
});
