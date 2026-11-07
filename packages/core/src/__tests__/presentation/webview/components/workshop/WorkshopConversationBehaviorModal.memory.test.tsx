/** @jest-environment jsdom */

/**
 * Conversation settings with its Memory tab mounted (epic Slice 4b): the
 * tab in strip order, the mode as a fourth draft applied with the others,
 * the four-draft footer and the header's words, the apply waiting for the
 * host's mode, the manager and folder acting at once while every draft is
 * kept (PR #196 watchpoint 2), and an unavailable workspace leaving the
 * mode choosable.
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
import { IN_BUDGET } from '../../hooks/domain/workshop/memory/workshopMemoryFixtures';

type Props = React.ComponentProps<typeof WorkshopConversationBehaviorModal>;

function renderModal(overrides: Partial<Props> = {}) {
  const props: Props = {
    open: true,
    behavior: { ...DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR },
    writerProfile: { ...DEFAULT_WORKSHOP_WRITER_PROFILE },
    webResearch: { ...DEFAULT_WORKSHOP_WEB_RESEARCH_SETTINGS },
    projectMemoryMode: 'off',
    fileEditsMode: 'ask',
    memory: { workspace: { kind: 'available' }, estimate: IN_BUDGET, saved: 12, unreadable: [], conflicts: [] },
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

describe('Conversation settings · Memory', () => {
  it('sits between Pinned context and Advanced, and the copy covers memory', () => {
    renderModal();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Behavior', 'About you', 'Pinned context', 'Memory', 'Advanced']);
    expect(screen.getByText(/what they remember about this project/)).not.toBeNull();
    expect(screen.getByText('Applies the Behavior, About You, Memory, and Advanced drafts together. Pinned context saves as you change it and applies to new conversations. Memory and live web research take effect on your next message.')).not.toBeNull();
  });

  it('the mode is a draft until Apply, which sends it with the other three', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByRole('tab', { name: 'Memory' }));
    expect(screen.getByRole('tabpanel', { name: 'Memory' })).not.toBeNull();
    expect(card('Off').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(card('Save and tell me'));
    expect(card('Save and tell me').getAttribute('aria-pressed')).toBe('true');
    expect(props.onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Apply to next turn' }));
    expect(props.onApply).toHaveBeenCalledWith(
      DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
      DEFAULT_WORKSHOP_WRITER_PROFILE,
      DEFAULT_WORKSHOP_WEB_RESEARCH_SETTINGS,
      'auto',
      'ask'
    );
  });

  it('the apply settles only when the host holds the submitted mode', () => {
    const { props, rerender } = renderModal();
    fireEvent.click(screen.getByRole('tab', { name: 'Memory' }));
    fireEvent.click(card('Ask first'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply to next turn' }));
    expect(screen.getByText('Conversation settings are updating…')).not.toBeNull();
    rerender({ projectMemoryMode: 'off' });
    expect(props.onClose).not.toHaveBeenCalled();
    rerender({ projectMemoryMode: 'ask' });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('Manage memories… and Open memory folder act at once, and every draft is kept', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /Analyze/ }));
    fireEvent.click(screen.getByRole('tab', { name: 'Memory' }));
    fireEvent.click(card('Ask first'));
    fireEvent.click(screen.getByRole('button', { name: 'Manage memories…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open memory folder' }));
    expect(props.onOpenMemoryManager).toHaveBeenCalledTimes(1);
    expect(props.onOpenMemoryFolder).toHaveBeenCalledTimes(1);
    expect(props.onApply).not.toHaveBeenCalled();

    expect(card('Ask first').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: 'Behavior' }));
    expect(screen.getByRole('button', { name: /Analyze/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Apply to next turn' }));
    expect((props.onApply as jest.Mock).mock.calls[0][0].interactionMode).toBe('analysis');
    expect((props.onApply as jest.Mock).mock.calls[0][3]).toBe('ask');
  });

  it('a reopened modal starts from the host\'s mode, not an abandoned draft', () => {
    const { rerender } = renderModal({ projectMemoryMode: 'ask' });
    fireEvent.click(screen.getByRole('tab', { name: 'Memory' }));
    fireEvent.click(card('Off'));
    rerender({ open: false });
    rerender({ open: true });
    fireEvent.click(screen.getByRole('tab', { name: 'Memory' }));
    expect(card('Ask first').getAttribute('aria-pressed')).toBe('true');
  });

  it('an untouched mode follows a newer host mode while the modal is open (PR #236 F-02)', () => {
    const { props, rerender } = renderModal({ projectMemoryMode: 'off' });
    rerender({ projectMemoryMode: 'auto' });
    fireEvent.click(screen.getByRole('button', { name: /Analyze/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply to next turn' }));
    expect((props.onApply as jest.Mock).mock.calls[0][3]).toBe('auto');
  });

  it('control: a mode the writer picked keeps their choice through a newer host mode', () => {
    const { props, rerender } = renderModal({ projectMemoryMode: 'off' });
    fireEvent.click(screen.getByRole('tab', { name: 'Memory' }));
    fireEvent.click(card('Ask first'));
    rerender({ projectMemoryMode: 'auto' });
    expect(card('Ask first').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Apply to next turn' }));
    expect((props.onApply as jest.Mock).mock.calls[0][3]).toBe('ask');
  });

  it('an unavailable workspace leaves the mode choosable and applied', () => {
    const { props } = renderModal({
      memory: { workspace: { kind: 'unavailable', reason: 'no-workspace' }, saved: 0, unreadable: [], conflicts: [] }
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Memory' }));
    expect((screen.getByRole('button', { name: 'Manage memories…' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(card('Ask first'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply to next turn' }));
    expect((props.onApply as jest.Mock).mock.calls[0][3]).toBe('ask');
  });
});
