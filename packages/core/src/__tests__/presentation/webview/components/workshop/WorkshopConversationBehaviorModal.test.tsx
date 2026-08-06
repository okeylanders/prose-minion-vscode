/** @jest-environment jsdom */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkshopConversationBehaviorModal } from '@components/workshop/WorkshopConversationBehaviorModal';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  DEFAULT_WORKSHOP_WEB_RESEARCH_SETTINGS,
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  WorkshopConversationBehavior,
  WorkshopWriterProfile
} from '@messages';

describe('WorkshopConversationBehaviorModal', () => {
  const renderModal = (
    overrides: Partial<React.ComponentProps<typeof WorkshopConversationBehaviorModal>> = {}
  ) => {
    const props: React.ComponentProps<typeof WorkshopConversationBehaviorModal> = {
      open: true,
      behavior: { ...DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR },
      writerProfile: { ...DEFAULT_WORKSHOP_WRITER_PROFILE },
      webResearch: { ...DEFAULT_WORKSHOP_WEB_RESEARCH_SETTINGS },
      isRunning: false,
      onApply: jest.fn(),
      onClose: jest.fn(),
      ...overrides
    };
    const view = render(<WorkshopConversationBehaviorModal {...props} />);
    return { props, view };
  };

  it('renders accessible Behavior, About you, and Advanced tabs with the approved scope', () => {
    renderModal();

    expect(screen.getByRole('heading', { name: 'Conversation settings' })).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Behavior' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'About you' }).getAttribute('aria-controls'))
      .toBe('pm-ws-profile-panel');
    expect(screen.getByRole('tab', { name: 'Advanced' }).getAttribute('aria-controls'))
      .toBe('pm-ws-advanced-panel');
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe('pm-ws-behavior-tab');
    expect(screen.getByText('Response style')).not.toBeNull();
    expect(screen.getByText('Relational depth')).not.toBeNull();
    expect(screen.getByText('Initiative')).not.toBeNull();
    expect(screen.getByRole('switch', { name: 'Use tools and widgets' })
      .getAttribute('aria-checked')).toBe('true');
  });

  it('lets the writer turn proactive tool and widget assistance off', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByRole('switch', { name: 'Use tools and widgets' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply to next turn' }));

    expect(props.onApply).toHaveBeenCalledWith(
      { ...DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR, proactiveAssistance: false },
      DEFAULT_WORKSHOP_WRITER_PROFILE,
      DEFAULT_WORKSHOP_WEB_RESEARCH_SETTINGS
    );
  });

  it('supports arrow-key tab navigation and moves focus', () => {
    renderModal();
    const behaviorTab = screen.getByRole('tab', { name: 'Behavior' });
    behaviorTab.focus();
    fireEvent.keyDown(behaviorTab, { key: 'ArrowRight' });

    const profileTab = screen.getByRole('tab', { name: 'About you' });
    expect(profileTab.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(profileTab);
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe('pm-ws-profile-tab');

    fireEvent.keyDown(profileTab, { key: 'ArrowRight' });
    const advancedTab = screen.getByRole('tab', { name: 'Advanced' });
    expect(advancedTab.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(advancedTab);

    fireEvent.keyDown(advancedTab, { key: 'ArrowRight' });
    expect(behaviorTab.getAttribute('aria-selected')).toBe('true');
  });

  it('edits profile fields locally and submits both complete drafts together', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /Analyze/ }));
    fireEvent.click(screen.getByRole('tab', { name: 'About you' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Share this profile with Workshop personas' }));
    fireEvent.change(screen.getByRole('textbox', { name: /How should the room address you/ }), {
      target: { value: '  Okey  ' }
    });
    fireEvent.change(screen.getByRole('textbox', { name: /What would you like the room to know/ }), {
      target: { value: '  I write fiction.  ' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply to next turn' }));

    expect(props.onApply).toHaveBeenCalledWith(
      expect.objectContaining({ interactionMode: 'analysis' }),
      { enabled: true, preferredAddress: 'Okey', bio: 'I write fiction.' },
      DEFAULT_WORKSHOP_WEB_RESEARCH_SETTINGS
    );
    expect(screen.getByText('Conversation settings are updating…')).not.toBeNull();
  });

  it('requires confirmation before clearing and stages an empty disabled profile', () => {
    const profile: WorkshopWriterProfile = {
      enabled: true,
      preferredAddress: 'Okey',
      bio: 'Writer.'
    };
    const { props } = renderModal({ writerProfile: profile });
    fireEvent.click(screen.getByRole('tab', { name: 'About you' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear profile…' }));
    expect(screen.getByText('Clear both fields and turn sharing off?')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply to next turn' }));

    expect(props.onApply).toHaveBeenCalledWith(
      DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
      DEFAULT_WORKSHOP_WRITER_PROFILE,
      DEFAULT_WORKSHOP_WEB_RESEARCH_SETTINGS
    );
  });

  it('waits for the host round-trip before closing', () => {
    const { props, view } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /Reserved/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply to next turn' }));
    const submitted: WorkshopConversationBehavior = {
      ...DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
      relationalDepth: 'reserved'
    };
    expect(props.onClose).not.toHaveBeenCalled();

    view.rerender(
      <WorkshopConversationBehaviorModal {...props} behavior={submitted} />
    );
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('releases a pending apply when the host rejects the update', () => {
    const { props, view } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /Analyze/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply to next turn' }));
    expect(screen.getByText('Conversation settings are updating…')).not.toBeNull();

    view.rerender(
      <WorkshopConversationBehaviorModal
        {...props}
        errorMessage="Could not change conversation settings."
      />
    );

    expect(screen.queryByText('Conversation settings are updating…')).toBeNull();
    expect((screen.getByRole('button', {
      name: 'Apply to next turn'
    }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('discards a cancelled draft and reseeds it when the modal reopens', () => {
    const { props, view } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /Analyze/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);

    view.rerender(<WorkshopConversationBehaviorModal {...props} open={false} />);
    view.rerender(<WorkshopConversationBehaviorModal {...props} open />);

    expect(screen.getByRole('button', { name: /Balanced/ }).getAttribute('aria-pressed'))
      .toBe('true');
    expect(screen.getByRole('button', { name: /Analyze/ }).getAttribute('aria-pressed'))
      .toBe('false');
  });

  it('counts the trimmed profile text that will be submitted', () => {
    renderModal();
    fireEvent.click(screen.getByRole('tab', { name: 'About you' }));
    fireEvent.change(screen.getByRole('textbox', { name: /How should the room address you/ }), {
      target: { value: '  Okey  ' }
    });

    expect(screen.getByText(`4 / 80`)).not.toBeNull();
  });

  it('keeps drafts intact when an unrelated session-state push re-allocates web research', () => {
    const { props, view } = renderModal();
    fireEvent.click(screen.getByRole('tab', { name: 'About you' }));
    fireEvent.change(screen.getByRole('textbox', { name: /How should the room address you/ }), {
      target: { value: 'Half-typed' }
    });

    view.rerender(
      <WorkshopConversationBehaviorModal {...props} webResearch={{ enabled: false }} />
    );

    expect(screen.getByRole('tab', { name: 'About you' }).getAttribute('aria-selected')).toBe('true');
    expect((screen.getByRole('textbox', {
      name: /How should the room address you/
    }) as HTMLInputElement).value).toBe('Half-typed');
  });

  it('submits the Advanced research draft with the other conversation settings', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByRole('tab', { name: 'Advanced' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Allow live web research' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply to next turn' }));

    expect(props.onApply).toHaveBeenCalledWith(
      DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
      DEFAULT_WORKSHOP_WRITER_PROFILE,
      { enabled: true }
    );
  });

  it('locks Apply during a response while leaving inspection and drafts available', () => {
    const { props } = renderModal({ isRunning: true });
    expect(screen.getByText(/A response is in progress/)).not.toBeNull();
    const apply = screen.getByRole('button', { name: 'Apply to next turn' }) as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Analyze/ }));
    expect(screen.getByRole('button', { name: /Analyze/ }).getAttribute('aria-pressed')).toBe('true');
    expect(props.onApply).not.toHaveBeenCalled();
  });
});
