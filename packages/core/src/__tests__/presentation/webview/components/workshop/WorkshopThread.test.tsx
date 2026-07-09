/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('marked', () => {
  const marked = Object.assign(jest.fn((content: string) => content), {
    setOptions: jest.fn()
  });
  return { marked };
});

import { WorkshopThread } from '@components/workshop/WorkshopThread';
import { WorkshopTurn } from '@messages';

const assistantTurn = (
  id: string,
  content: string,
  toolId?: WorkshopTurn['toolId']
): WorkshopTurn => ({
  id,
  role: 'assistant',
  kind: toolId ? 'tool_run' : 'message',
  toolId,
  toolLabel: toolId,
  content,
  timestamp: 0
});

describe('WorkshopThread quick-action scope', () => {
  const noop = jest.fn();

  it('falls back to selectedToolId when the visible snapshot no longer carries a tool turn', () => {
    render(
      <WorkshopThread
        turns={[assistantTurn('turn-1', 'Follow-up response')]}
        selectedToolId="prose"
        onQuickAction={noop}
        onCopyVariation={noop}
        onSaveVariation={noop}
      />
    );

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Rewrite for flow' }).disabled)
      .toBe(false);
  });

  it('disables quick actions from stale tool turns after the session moves to another lens', () => {
    render(
      <WorkshopThread
        turns={[
          assistantTurn('turn-1', 'Old dialogue response', 'dialogue'),
          assistantTurn('turn-2', 'Current gestures response', 'gestures')
        ]}
        selectedToolId="gestures"
        onQuickAction={noop}
        onCopyVariation={noop}
        onSaveVariation={noop}
      />
    );

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Generate 3 tighter variations' }).disabled)
      .toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Vary the gesture' }).disabled)
      .toBe(false);
  });
});
