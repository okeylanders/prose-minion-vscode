/** @jest-environment jsdom */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  WorkshopSaveSessionManifest,
  WorkshopSaveSessionModal
} from '@components/workshop/WorkshopSaveSessionModal';
import { DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR } from '@messages';

const activeNamedSession = {
  sessionId: 'saved-room',
  title: 'Pentecost — auditorium beat',
  fileName: '20260723-103000-pentecost-auditorium-beat.json',
  kind: 'named' as const,
  startedAt: 1,
  updatedAt: 2,
  savedAt: 2,
  timezone: 'America/Chicago',
  hostPersonaId: 'jill' as const,
  participantPersonaIds: ['jill' as const],
  turnCount: 4,
  excerptWordCount: 1751
};

const manifest: WorkshopSaveSessionManifest = {
  excerptVersion: 2,
  excerptWordCount: 1751,
  turnCount: 4,
  hostLabel: 'Jill',
  guestCount: 0,
  contextAttachmentCount: 2,
  todoCount: 3,
  behavior: DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR
};

const renderModal = (
  overrides: Partial<React.ComponentProps<typeof WorkshopSaveSessionModal>> = {}
) => {
  const props: React.ComponentProps<typeof WorkshopSaveSessionModal> = {
    open: true,
    available: true,
    suggestedTitle: 'Untitled session — Jill — Jul 23',
    manifest,
    saving: false,
    onClose: jest.fn(),
    onSave: jest.fn(),
    ...overrides
  };
  return { props, view: render(<WorkshopSaveSessionModal {...props} />) };
};

describe('WorkshopSaveSessionModal', () => {
  it('shows the complete snapshot manifest and stable timestamped storage identity', () => {
    renderModal();

    expect(screen.getByRole('heading', { name: 'Save session' })).not.toBeNull();
    expect(screen.getByText('v2 · 1,751 words')).not.toBeNull();
    expect(screen.getByText('4 turns · complete')).not.toBeNull();
    expect(screen.getByText('Jill (host, solo)')).not.toBeNull();
    expect(screen.getByText('2 attachments')).not.toBeNull();
    expect(screen.getByText('3 items')).not.toBeNull();
    expect(screen.getByText(/YYYYMMDD-HHMMSS-untitled-session-jill-jul-23\.json/))
      .not.toBeNull();
  });

  it('submits the edited title from Enter or the primary action', () => {
    const { props } = renderModal();
    const input = screen.getByRole('textbox', { name: 'Session name' });
    fireEvent.change(input, { target: { value: '  Pentecost — auditorium beat  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(props.onSave).toHaveBeenCalledWith('Pentecost — auditorium beat');
  });

  it('updates the exact active named identity while still offering Save as new', () => {
    const { props } = renderModal({
      activeNamedSession,
      suggestedTitle: activeNamedSession.title
    });

    expect(screen.getByText(/already autosaves after each committed turn/)).not.toBeNull();
    expect(screen.getByText(/20260723-103000-pentecost-auditorium-beat\.json/))
      .not.toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'Session name' }), {
      target: { value: 'Pentecost — final pass' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update session' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save as new' }));

    expect(props.onSave).toHaveBeenNthCalledWith(
      1,
      'Pentecost — final pass',
      'saved-room'
    );
    expect(props.onSave).toHaveBeenNthCalledWith(2, 'Pentecost — final pass');
  });

  it('explains unavailable persistence and disables the name and save controls', () => {
    renderModal({ available: false, unavailableReason: 'multi-root' });

    expect(screen.getByRole('status').textContent).toContain('single-root workspace');
    expect((screen.getByRole('textbox', { name: 'Session name' }) as HTMLInputElement).disabled)
      .toBe(true);
    expect((screen.getByRole('button', { name: 'Save session' }) as HTMLButtonElement).disabled)
      .toBe(true);
  });

  it('does not close or resubmit while the checkpoint write is pending', () => {
    const { props } = renderModal({ saving: true });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Saving…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close Save session' }));

    expect(props.onClose).not.toHaveBeenCalled();
    expect(props.onSave).not.toHaveBeenCalled();
  });
});
