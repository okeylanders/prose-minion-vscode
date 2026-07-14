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
  WORKSHOP_TURN_ID_ATTRIBUTE,
  WorkshopTurnBubble
} from '@components/workshop/WorkshopTurnBubble';
import { WorkshopTurn } from '@messages';

const assistantTurn = (content: string): WorkshopTurn => ({
  id: 'turn-1',
  role: 'assistant',
  kind: 'tool_run',
  participant: 'tool',
  artifact: 'tool_report',
  toolId: 'prose',
  toolLabel: 'Prose',
  reportTurnId: 'turn-1',
  content,
  timestamp: 0,
  excerptVersion: 1
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
  it('requires an explicit click to promote a structured finding', () => {
    const onAddTodo = jest.fn();
    render(
      <WorkshopTurnBubble
        turn={{
          ...assistantTurn('Report.\n\n### Next steps\n- Tighten the opening.'),
          actionableFindings: [
            { key: 'finding-1', ordinal: 1, text: 'Tighten the opening.' }
          ]
        }}
        quickActionToolId="prose"
        onQuickAction={jest.fn()}
        onTalkDirectly={jest.fn()}
        onAddTodo={onAddTodo}
        onCopy={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(onAddTodo).not.toHaveBeenCalled();
    expect(document.querySelector(`[${WORKSHOP_TURN_ID_ATTRIBUTE}="turn-1"]`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(onAddTodo).toHaveBeenCalledWith('turn-1', 'finding-1');
  });

  it('shows already-promoted findings without adding them again', () => {
    render(
      <WorkshopTurnBubble
        turn={{
          ...assistantTurn('Report.'),
          actionableFindings: [
            { key: 'finding-1', ordinal: 1, text: 'Tighten the opening.' }
          ]
        }}
        quickActionToolId={null}
        promotedFindingKeys={new Set(['finding-1'])}
        onQuickAction={jest.fn()}
        onTalkDirectly={jest.fn()}
        onCopy={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /added/i }).hasAttribute('disabled')).toBe(true);
  });

  it('offers prioritized host proposals with an explicit Add all action', () => {
    const onAddTodo = jest.fn();
    render(
      <WorkshopTurnBubble
        turn={{
          ...assistantTurn('Here is the revision order.'),
          participant: 'host',
          artifact: 'persona_message',
          toolId: undefined,
          toolLabel: undefined,
          reportTurnId: undefined,
          personaId: 'jill',
          personaLabel: 'Jill',
          actionableFindings: [
            {
              key: 'finding-1', ordinal: 1, priority: 'high',
              text: 'Replace the beacon image.'
            },
            {
              key: 'finding-2', ordinal: 2, priority: 'medium',
              text: 'Audit the gravity metaphor.'
            }
          ]
        }}
        quickActionToolId={null}
        onQuickAction={jest.fn()}
        onTalkDirectly={jest.fn()}
        onAddTodo={onAddTodo}
        onCopy={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(screen.getByText('high')).toBeTruthy();
    expect(screen.getByText('medium')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add all' }));
    expect(onAddTodo.mock.calls).toEqual([
      ['turn-1', 'finding-1'],
      ['turn-1', 'finding-2']
    ]);
  });

  it('renders duplicate model numbers with stable positional labels and wires copy/save content', () => {
    const onCopy = jest.fn();
    const onSave = jest.fn();

    render(
      <WorkshopTurnBubble
        turn={assistantTurn(`### Variation 1 - First\nAlpha\n\n### Variation 1 - Second\nBeta`)}
        quickActionToolId="prose"
        quickActionsDisabled
        onQuickAction={jest.fn()}
        onTalkDirectly={jest.fn()}
        onCopy={onCopy}
        onSave={onSave}
      />
    );

    expect(screen.getByText('Variation 1')).toBeTruthy();
    expect(screen.getByText('Variation 2')).toBeTruthy();

    const copyButtons = screen.getAllByRole('button', { name: /copy/i });
    const saveButtons = screen.getAllByRole('button', { name: /save to notes/i });

    fireEvent.click(copyButtons[1]);
    fireEvent.click(saveButtons[0]);

    expect(onCopy).toHaveBeenCalledWith('Beta', expect.objectContaining({ id: 'turn-1' }));
    expect(onSave).toHaveBeenCalledWith('Alpha', expect.objectContaining({ id: 'turn-1' }));
  });

  it('renders persona replies as conversation, never as inherited tool variation cards', () => {
    render(
      <WorkshopTurnBubble
        turn={{
          ...assistantTurn('### Variation 1 - One\nA\n\n### Variation 2 - Two\nB'),
          kind: 'message',
          participant: 'host',
          artifact: 'persona_message',
          toolId: undefined,
          toolLabel: undefined,
          personaId: 'jill',
          personaLabel: 'Jill'
        }}
        quickActionToolId={null}
        onQuickAction={jest.fn()}
        onTalkDirectly={jest.fn()}
        onCopy={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(screen.getByText('Jill')).toBeTruthy();
    expect(screen.getByRole('button', { name: /copy/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /save to notes/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /rewrite/i })).toBeNull();
  });

  it('renders excerpt revisions as participant-neutral thread dividers', () => {
    render(
      <WorkshopTurnBubble
        turn={{
          id: 'revision-2',
          role: 'system',
          kind: 'divider',
          participant: 'session',
          artifact: 'excerpt_revision',
          excerptVersion: 2,
          content: 'Excerpt v2 pinned · chapter-two.md · retired: Cliché',
          timestamp: 2
        }}
        quickActionToolId={null}
        onQuickAction={jest.fn()}
        onTalkDirectly={jest.fn()}
        onCopy={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(screen.getByRole('separator').textContent).toContain('Excerpt v2 pinned');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders persona-requested dictionary evidence as a compact expandable artifact', () => {
    render(
      <WorkshopTurnBubble
        turn={{
          ...assistantTurn('# liminal\nThreshold-toned.'),
          artifact: 'dictionary_lookup',
          toolId: undefined,
          toolLabel: "Writer's Dictionary",
          reportTurnId: undefined,
          capability: {
            operation: 'dictionary.lookup',
            status: 'success',
            requestSummary: 'liminal',
            requestedByPersonaId: 'jill'
          }
        }}
        quickActionToolId={null}
        onQuickAction={jest.fn()}
        onTalkDirectly={jest.fn()}
        onCopy={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(screen.getByText("Writer's Dictionary · liminal · requested by Jill")).toBeTruthy();
    expect(screen.getByText('success')).toBeTruthy();
    expect(document.querySelector('details.pm-ws-capability-artifact')).toBeTruthy();
    expect(document.body.textContent).not.toContain('prose-minion-tool-call');
  });

  it('keeps full-entry timing and partial failures inspectable', () => {
    render(
      <WorkshopTurnBubble
        turn={{
          ...assistantTurn('# Full entry'),
          artifact: 'dictionary_full_entry',
          toolId: undefined,
          toolLabel: "Writer's Dictionary",
          reportTurnId: undefined,
          capability: {
            operation: 'dictionary.full-entry',
            status: 'partial',
            requestSummary: 'liminal',
            requestedByPersonaId: 'jill',
            metadata: {
              successCount: 14,
              totalBlocks: 15,
              totalDuration: 1_250,
              partialFailures: ['soundplay-rhyme']
            }
          }
        }}
        quickActionToolId={null}
        onQuickAction={jest.fn()}
        onTalkDirectly={jest.fn()}
        onCopy={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(screen.getByLabelText('Capability metadata').textContent).toContain('14/15');
    expect(screen.getByLabelText('Capability metadata').textContent).toContain('1.3s');
    expect(screen.getByLabelText('Capability metadata').textContent).toContain('soundplay-rhyme');
  });

  it('renders an analysis focus instead of repeating the tool label', () => {
    render(
      <WorkshopTurnBubble
        turn={{
          ...assistantTurn('The cup remains on the table.'),
          artifact: 'tool_report',
          toolId: 'continuity',
          toolLabel: 'Continuity',
          capability: {
            operation: 'analysis.run',
            status: 'success',
            requestSummary: 'Track the cup.',
            requestedByPersonaId: 'jill'
          }
        }}
        quickActionToolId={null}
        onQuickAction={jest.fn()}
        onTalkDirectly={jest.fn()}
        onCopy={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(screen.getByText('Continuity · Track the cup. · requested by Jill')).toBeTruthy();
    expect(document.body.textContent).not.toContain('Continuity · Continuity');
  });
});
