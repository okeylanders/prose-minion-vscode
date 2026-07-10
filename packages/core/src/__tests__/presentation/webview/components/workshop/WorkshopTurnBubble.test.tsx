/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('marked', () => {
  const marked = Object.assign(jest.fn((content: string) => content), {
    setOptions: jest.fn()
  });
  return { marked };
});

import {
  parseVariations,
  WorkshopTurnBubble
} from '@components/workshop/WorkshopTurnBubble';
import { WorkshopTurn } from '@messages';

const assistantTurn = (content: string): WorkshopTurn => ({
  id: 'turn-1',
  role: 'assistant',
  kind: 'tool_run',
  toolId: 'prose',
  toolLabel: 'Prose',
  content,
  timestamp: 0
});

describe('parseVariations', () => {
  it('parses the prompted three-variation markdown shape', () => {
    const parsed = parseVariations(`Intro text.

### Variation 1 - Sharper
First version.

### Variation 2 - Softer
Second version.

### Variation 3 - Stranger
Third version.`);

    expect(parsed?.intro).toBe('Intro text.');
    expect(parsed?.variations).toEqual([
      { number: '1', label: 'Sharper', content: 'First version.' },
      { number: '2', label: 'Softer', content: 'Second version.' },
      { number: '3', label: 'Stranger', content: 'Third version.' }
    ]);
  });

  it('accepts small heading/label drift but requires at least two non-empty sections', () => {
    expect(parseVariations(`## Variation 1: One\nA\n\n#### Variation 2\nB`)?.variations)
      .toHaveLength(2);
    expect(parseVariations('### Variation 1 - One\nA')).toBeNull();
    expect(parseVariations('### Variation 1 - One\nA\n\n### Variation 2 - Two\n   ')).toBeNull();
  });
});

describe('WorkshopTurnBubble variation cards', () => {
  it('renders duplicate model numbers with stable positional labels and wires copy/save content', () => {
    const onCopyVariation = jest.fn();
    const onSaveVariation = jest.fn();

    render(
      <WorkshopTurnBubble
        turn={assistantTurn(`### Variation 1 - First\nAlpha\n\n### Variation 1 - Second\nBeta`)}
        quickActionToolId="prose"
        quickActionsDisabled
        onQuickAction={jest.fn()}
        onCopyVariation={onCopyVariation}
        onSaveVariation={onSaveVariation}
      />
    );

    expect(screen.getByText('Variation 1')).toBeTruthy();
    expect(screen.getByText('Variation 2')).toBeTruthy();

    const copyButtons = screen.getAllByRole('button', { name: /copy/i });
    const saveButtons = screen.getAllByRole('button', { name: /save to notes/i });

    fireEvent.click(copyButtons[1]);
    fireEvent.click(saveButtons[0]);

    expect(onCopyVariation).toHaveBeenCalledWith('Beta', 'prose');
    expect(onSaveVariation).toHaveBeenCalledWith('Alpha', 'prose');
  });

  it('renders persona replies as conversation, never as inherited tool variation cards', () => {
    render(
      <WorkshopTurnBubble
        turn={{
          ...assistantTurn('### Variation 1 - One\nA\n\n### Variation 2 - Two\nB'),
          kind: 'message',
          toolId: undefined,
          toolLabel: undefined,
          personaId: 'jill',
          personaLabel: 'Jill'
        }}
        quickActionToolId={null}
        onQuickAction={jest.fn()}
        onCopyVariation={jest.fn()}
        onSaveVariation={jest.fn()}
      />
    );

    expect(screen.getByText('Jill')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /copy/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /rewrite/i })).toBeNull();
  });
});
