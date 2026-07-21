/**
 * @jest-environment jsdom
 */

/**
 * ContextPanel — Sprint 12 attachment list. Behavior under test:
 * - two-button empty state (no textarea, no Save brief),
 * - inline add-text flow posts the note and resets,
 * - pills render label/size, wizard origin gets the wand treatment, remove
 *   posts the id,
 * - the aggregate meter reflects usage and tone thresholds.
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ContextPanel } from '@components/workshop/ContextPanel';
import { WorkshopContextAttachmentSnapshot } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

const attachment = (
  overrides: Partial<WorkshopContextAttachmentSnapshot> = {}
): WorkshopContextAttachmentSnapshot => ({
  id: 'ctx-1',
  kind: 'file',
  origin: 'writer',
  label: 'character-sheet-raven.md',
  words: 1_240,
  relativePath: 'Characters/Raven/character-sheet-raven.md',
  addedAt: 1,
  ...overrides
});

const renderPanel = (overrides: Partial<React.ComponentProps<typeof ContextPanel>> = {}) => {
  const props: React.ComponentProps<typeof ContextPanel> = {
    attachments: [],
    pendingDelivery: false,
    isRunning: false,
    onAddText: jest.fn(),
    onAddFile: jest.fn(),
    onRemove: jest.fn(),
    wizardRunning: false,
    onRunWizard: jest.fn(),
    onCancelWizard: jest.fn(),
    ...overrides
  };
  return { ...render(<ContextPanel {...props} />), props };
};

describe('ContextPanel', () => {
  it('opens with two intent buttons and an honest zero meter', () => {
    renderPanel();

    expect(screen.getByRole('button', { name: /add text/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /add from project/i })).toBeTruthy();
    expect(screen.queryByLabelText('Context text')).toBeNull();
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('adds a text note through the inline flow', () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /add text/i }));
    fireEvent.change(screen.getByLabelText('Context text'), {
      target: { value: '  Prom happens Friday.  ' }
    });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    expect(props.onAddText).toHaveBeenCalledWith('Prom happens Friday.');
    expect(screen.queryByLabelText('Context text')).toBeNull();
  });

  it('routes the file button to the host', () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /add from project/i }));
    expect(props.onAddFile).toHaveBeenCalled();
  });

  it('renders pills with label and size, and remove posts the id', () => {
    const { props } = renderPanel({
      attachments: [
        attachment(),
        attachment({ id: 'ctx-2', kind: 'text', origin: 'wizard', label: 'Timeline notes…', words: 412 })
      ]
    });

    expect(screen.getByText('2 attachments')).toBeTruthy();
    expect(screen.getByText('character-sheet-raven.md')).toBeTruthy();
    expect(screen.getByText('412 words')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Remove character-sheet-raven.md' }));
    expect(props.onRemove).toHaveBeenCalledWith('ctx-1');
  });

  it('sums the meter across attachments and warns near the cap', () => {
    const nearCap = Math.ceil(PROMPT_BUDGETS.contextAttachments.words * 0.8);
    const { container } = renderPanel({
      attachments: [
        attachment({ words: nearCap - 2_000 }),
        attachment({ id: 'ctx-2', words: 2_000 })
      ]
    });

    expect(screen.getByText(nearCap.toLocaleString())).toBeTruthy();
    expect(container.querySelector('.pm-ws-meter-warn')).toBeTruthy();
    expect(screen.getByText(/getting close to the cap/)).toBeTruthy();
  });

  it('lets the writer read a text note by expanding its pill', () => {
    renderPanel({
      attachments: [attachment({
        id: 'ctx-2',
        kind: 'text',
        origin: 'wizard',
        label: 'Wizard brief…',
        words: 320,
        relativePath: undefined,
        content: 'Genre: YA supernatural. Nate is learning to read the marks.'
      })]
    });

    fireEvent.click(screen.getByRole('button', { name: 'Wizard brief…' }));
    expect(screen.getByRole('note').textContent).toContain('Nate is learning to read the marks.');
    fireEvent.click(screen.getByRole('button', { name: 'Wizard brief…' }));
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('offers the Context wizard and swaps it for a cancellable status row while running', () => {
    const { props, rerender } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /context wizard/i }));
    expect(props.onRunWizard).toHaveBeenCalled();

    rerender(<ContextPanel {...props} wizardRunning />);
    expect(screen.getByRole('status').textContent).toContain('Wizard');
    fireEvent.click(screen.getByRole('button', { name: /cancel the context wizard/i }));
    expect(props.onCancelWizard).toHaveBeenCalled();
  });

  it('notes pending delivery to the next host message', () => {
    renderPanel({ attachments: [attachment()], pendingDelivery: true });
    expect(screen.getByText('Shared with your next host message.')).toBeTruthy();
  });
});
