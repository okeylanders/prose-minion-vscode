/**
 * @jest-environment jsdom
 */

/**
 * WorkshopConversationBehaviorModal tests (ADR 2026-07-20 §11).
 *
 * Behavior under test:
 * - the four sections render with the approved copy (exact subtitle),
 * - cards and switches edit a LOCAL draft (aria-pressed / aria-checked),
 * - Apply submits the COMPLETE draft once, then waits in a pending state
 *   until the host round-trips the committed object (close on match),
 * - while a response streams Apply locks with the busy note but inspection
 *   stays available,
 * - Cancel discards without applying; reopening reseeds from committed state,
 * - future rows (cross-session preferences, room memory) are honestly inert.
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkshopConversationBehaviorModal } from '@components/workshop/WorkshopConversationBehaviorModal';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  WorkshopConversationBehavior
} from '@messages';

describe('WorkshopConversationBehaviorModal', () => {
  const renderModal = (
    overrides: Partial<React.ComponentProps<typeof WorkshopConversationBehaviorModal>> = {}
  ) => {
    const props = {
      open: true,
      behavior: { ...DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR },
      isRunning: false,
      onApply: jest.fn(),
      onClose: jest.fn(),
      ...overrides
    };
    const view = render(<WorkshopConversationBehaviorModal {...props} />);
    return { props, view };
  };

  it('renders all four sections with the approved header copy', () => {
    renderModal();

    expect(screen.getByText('Workshop · Room settings')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Conversation behavior' })).not.toBeNull();
    // The subtitle is the ADR's exact scope sentence — tools are NOT governed.
    expect(
      screen.getByText(
        'Choose how Workshop personas respond. Applies to Jill and invited personas; tools are unchanged.'
      )
    ).not.toBeNull();

    for (const section of ['Response style', 'Persona expression', 'Adaptation', 'Room memory']) {
      expect(screen.getByText(section)).not.toBeNull();
    }
    expect(
      screen.getByText('What you ask for always wins — “analyze this” gets analysis in any style.')
    ).not.toBeNull();
    expect(
      screen.getByText('Identity and craft expertise remain present in both states.')
    ).not.toBeNull();
  });

  it('selecting mode and expression cards edits the draft (committed props untouched)', () => {
    const { props } = renderModal();

    expect(screen.getByRole('button', { name: /Balanced/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /Analyze/ }));
    expect(screen.getByRole('button', { name: /Analyze/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Balanced/ }).getAttribute('aria-pressed')).toBe('false');

    expect(screen.getByRole('button', { name: /Full/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /Subtle/ }));
    expect(screen.getByRole('button', { name: /Subtle/ }).getAttribute('aria-pressed')).toBe('true');

    // Draft only — nothing was applied.
    expect(props.onApply).not.toHaveBeenCalled();
  });

  it('adaptation switches flip in the draft', () => {
    renderModal();

    const react = screen.getByRole('switch', { name: 'React to each message' });
    const carry = screen.getByRole('switch', { name: 'Carry cues through this session' });
    expect(react.getAttribute('aria-checked')).toBe('true');
    expect(carry.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(react);
    expect(react.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(carry);
    expect(carry.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(react);
    expect(react.getAttribute('aria-checked')).toBe('true');
  });

  it('Apply submits the COMPLETE edited object once, waits pending, and closes on the host round-trip', () => {
    const { props, view } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: /Analyze/ }));
    fireEvent.click(screen.getByRole('button', { name: /Subtle/ }));
    fireEvent.click(screen.getByRole('switch', { name: 'Carry cues through this session' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply to next turn' }));

    const submitted: WorkshopConversationBehavior = {
      interactionMode: 'analysis',
      expressionLevel: 'subtle',
      reactToCurrentMessage: true,
      carryCuesThroughSession: false
    };
    expect(props.onApply).toHaveBeenCalledTimes(1);
    expect(props.onApply).toHaveBeenCalledWith(submitted);

    // Pending: no optimistic close — the modal reports the in-flight change
    // and locks its controls until the committed object round-trips.
    expect(screen.getByText('Conversation style is updating…')).not.toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Apply to next turn' }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: /Balanced/ }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(props.onClose).not.toHaveBeenCalled();

    // Host commits: the snapshot's behavior now deep-equals the submission.
    view.rerender(
      <WorkshopConversationBehaviorModal {...props} behavior={{ ...submitted }} />
    );
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('while a response streams, Apply locks with the busy note but inspection stays open', () => {
    const { props } = renderModal({ isRunning: true });

    expect(
      screen.getByText('A response is in progress — changes are available when it finishes.')
    ).not.toBeNull();
    const apply = screen.getByRole('button', { name: 'Apply to next turn' }) as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    fireEvent.click(apply);
    expect(props.onApply).not.toHaveBeenCalled();

    // Inspection allowed: cards still respond while Apply is the only lock.
    fireEvent.click(screen.getByRole('button', { name: /Analyze/ }));
    expect(screen.getByRole('button', { name: /Analyze/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('releases a pending Apply when the host rejects the change', () => {
    const { props, view } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: /Analyze/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply to next turn' }));
    expect(screen.getByText('Conversation style is updating…')).not.toBeNull();

    view.rerender(
      <WorkshopConversationBehaviorModal
        {...props}
        errorMessage="Could not change conversation behavior."
      />
    );

    expect(screen.queryByText('Conversation style is updating…')).toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Apply to next turn' }) as HTMLButtonElement).disabled
    ).toBe(false);
  });

  it('Cancel discards the draft without applying; reopening reseeds from the committed object', () => {
    const { props, view } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: /Converse/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onApply).not.toHaveBeenCalled();

    // Close-and-reopen: the abandoned draft never survives the shell.
    view.rerender(<WorkshopConversationBehaviorModal {...props} open={false} />);
    view.rerender(<WorkshopConversationBehaviorModal {...props} open={true} />);
    expect(screen.getByRole('button', { name: /Balanced/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Converse/ }).getAttribute('aria-pressed')).toBe('false');
  });

  it('future rows are visibly disabled and non-interactive (never a dead consent toggle)', () => {
    renderModal();

    const future = screen.getByRole('switch', {
      name: 'Remember stable preferences across sessions'
    }) as HTMLButtonElement;
    expect(future.disabled).toBe(true);
    expect(future.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(future);
    expect(future.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Future')).not.toBeNull();

    // Room memory: a dashed placeholder row, not a control of any kind.
    expect(screen.getByText('Coming later')).not.toBeNull();
    expect(screen.getByText('Shared history and continuity')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Shared history and continuity/ })).toBeNull();
    expect(screen.queryByRole('switch', { name: /Shared history and continuity/ })).toBeNull();
  });
});
