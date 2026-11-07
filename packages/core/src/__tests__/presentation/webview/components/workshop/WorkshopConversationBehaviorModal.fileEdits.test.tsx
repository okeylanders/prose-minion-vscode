/** @jest-environment jsdom */

/**
 * Conversation settings' Suggested file edits row (ADR 2026-11-05 D11; epic
 * Slice 4c), on the Behavior tab, as the Memory tab's mode: the host's mode
 * selected, a draft until Apply, sent with the other drafts, the apply
 * waiting for the host's mode, a reopened modal starting from the host's
 * mode, and both cards locked while an apply is pending.
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkshopConversationBehaviorModal } from '@components/workshop/WorkshopConversationBehaviorModal';
import { pinnedContextPanelPropsStub } from './settings/pinnedContextPanelPropsStub';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  DEFAULT_WORKSHOP_WEB_RESEARCH_SETTINGS,
  DEFAULT_WORKSHOP_WRITER_PROFILE
} from '@messages';

type Props = React.ComponentProps<typeof WorkshopConversationBehaviorModal>;

function renderModal(overrides: Partial<Props> = {}) {
  const props: Props = {
    open: true,
    behavior: { ...DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR },
    writerProfile: { ...DEFAULT_WORKSHOP_WRITER_PROFILE },
    webResearch: { ...DEFAULT_WORKSHOP_WEB_RESEARCH_SETTINGS },
    projectMemoryMode: 'off',
    fileEditsMode: 'ask',
    memory: { workspace: { kind: 'available' }, saved: 0, unreadable: [], conflicts: [] },
    isRunning: false,
    onApply: jest.fn(),
    onOpenMemoryManager: jest.fn(),
    onOpenMemoryFolder: jest.fn(),
    pinnedContext: pinnedContextPanelPropsStub(),
    memoryExplainerOpen: true,
    onToggleMemoryExplainer: jest.fn(),
    onClose: jest.fn(),
    ...overrides
  };
  const view = render(<WorkshopConversationBehaviorModal {...props} />);
  return { props, rerender: (next: Partial<Props>) => view.rerender(<WorkshopConversationBehaviorModal {...props} {...next} />) };
}

const card = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });
const applied = (props: Props) => (props.onApply as jest.Mock).mock.calls[0];

describe('Conversation settings · Suggested file edits', () => {
  it('sits on the Behavior tab with Off and Ask first, the host\'s mode selected, and says what it does', () => {
    renderModal();
    expect(screen.getByText('Suggested file edits')).not.toBeNull();
    expect(card('Off').getAttribute('aria-pressed')).toBe('false');
    expect(card('Ask first').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Personas may propose edits to notes and chapters; nothing changes until you press Apply.')).not.toBeNull();
  });

  it('is a draft until Apply, which sends it with the others', () => {
    const { props } = renderModal();
    fireEvent.click(card('Off'));
    expect(card('Off').getAttribute('aria-pressed')).toBe('true');
    expect(props.onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Apply to next turn' }));
    expect(props.onApply).toHaveBeenCalledWith(
      DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
      DEFAULT_WORKSHOP_WRITER_PROFILE,
      DEFAULT_WORKSHOP_WEB_RESEARCH_SETTINGS,
      undefined,
      'off'
    );
  });

  it('an untouched row sends nothing, so Apply never changes it, and the apply settles on Behavior alone', () => {
    const { props, rerender } = renderModal({ fileEditsMode: 'off' });
    fireEvent.click(screen.getByRole('button', { name: /Analyze/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply to next turn' }));
    expect(applied(props)[0].interactionMode).toBe('analysis');
    expect(applied(props)[3]).toBeUndefined();
    expect(applied(props)[4]).toBeUndefined();
    // Settlement compares only what was submitted: a host mode that moved meanwhile does not hold it open.
    rerender({ fileEditsMode: 'ask', projectMemoryMode: 'ask', behavior: { ...DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR, interactionMode: 'analysis' } });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('a single picked mode: settlement waits for that mode only', () => {
    const { props, rerender } = renderModal({ fileEditsMode: 'ask', projectMemoryMode: 'off' });
    fireEvent.click(card('Off'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply to next turn' }));
    expect(applied(props)[3]).toBeUndefined();
    expect(applied(props)[4]).toBe('off');
    // The memory mode moving does not settle it, nor hold it open; the picked mode arriving does.
    rerender({ fileEditsMode: 'ask', projectMemoryMode: 'auto' });
    expect(props.onClose).not.toHaveBeenCalled();
    rerender({ fileEditsMode: 'off', projectMemoryMode: 'auto' });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('the apply settles only when the host holds the submitted mode, and the cards are locked meanwhile', () => {
    const { props, rerender } = renderModal();
    fireEvent.click(card('Off'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply to next turn' }));
    expect(screen.getByText('Conversation settings are updating…')).not.toBeNull();
    expect((card('Ask first') as HTMLButtonElement).disabled).toBe(true);
    rerender({ fileEditsMode: 'ask' });
    expect(props.onClose).not.toHaveBeenCalled();
    rerender({ fileEditsMode: 'off' });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('a reopened modal starts from the host\'s mode, not an abandoned draft', () => {
    const { rerender } = renderModal({ fileEditsMode: 'ask' });
    fireEvent.click(card('Off'));
    rerender({ open: false });
    rerender({ open: true });
    expect(card('Ask first').getAttribute('aria-pressed')).toBe('true');
  });

  it('an untouched row shows a newer host mode while the modal is open, and Apply sends nothing for it (PR #236 F-02)', () => {
    const { props, rerender } = renderModal({ fileEditsMode: 'ask' });
    rerender({ fileEditsMode: 'off' });
    expect(card('Off').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /Analyze/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply to next turn' }));
    expect(applied(props)[4]).toBeUndefined();
  });

  it('control: a row the writer picked keeps their choice through a newer host mode, and other drafts are kept', () => {
    const { props, rerender } = renderModal({ fileEditsMode: 'ask' });
    fireEvent.click(screen.getByRole('button', { name: /Analyze/ }));
    fireEvent.click(card('Ask first'));
    rerender({ fileEditsMode: 'off' });
    expect(card('Ask first').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Apply to next turn' }));
    expect(applied(props)[0].interactionMode).toBe('analysis');
    expect(applied(props)[4]).toBe('ask');
  });

  it('a change in VS Code Settings while the modal is closed is the next draft', () => {
    const { rerender } = renderModal({ open: false });
    rerender({ open: false, fileEditsMode: 'off' });
    rerender({ open: true, fileEditsMode: 'off' });
    expect(card('Off').getAttribute('aria-pressed')).toBe('true');
  });
});
