/** @jest-environment jsdom */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkshopSessionsModal } from '@components/workshop/WorkshopSessionsModal';
import { WorkshopSessionSummary } from '@messages';

const current: WorkshopSessionSummary = {
  sessionId: 'current-id',
  title: 'Working room',
  fileName: 'current.json',
  kind: 'current',
  startedAt: 1,
  updatedAt: 2,
  timezone: 'America/Chicago',
  hostPersonaId: 'jill',
  participantPersonaIds: ['jill'],
  turnCount: 7,
  excerptWordCount: 812,
  excerptLabel: 'chapter-five.md',
  excerptIdentity: 'chapters:Drafts/chapter-five.md',
  preview: 'The cup was still warm.'
};

const named: WorkshopSessionSummary = {
  ...current,
  sessionId: 'named-id',
  title: 'Cup continuity pass',
  fileName: '20260723-103000-cup-continuity-pass.json',
  kind: 'named',
  savedAt: 2
};

const renderModal = (
  overrides: Partial<React.ComponentProps<typeof WorkshopSessionsModal>> = {}
) => {
  const props: React.ComponentProps<typeof WorkshopSessionsModal> = {
    open: true,
    available: true,
    current,
    sessions: [named],
    truncated: false,
    searchTruncated: false,
    pending: false,
    error: undefined,
    query: '',
    mutationsDisabled: false,
    onClose: jest.fn(),
    onQueryChange: jest.fn(),
    onRefresh: jest.fn(),
    onSave: jest.fn(),
    onOpen: jest.fn(),
    onRename: jest.fn(),
    onDuplicate: jest.fn(),
    onReveal: jest.fn(),
    onDelete: jest.fn(),
    ...overrides
  };
  return { props, view: render(<WorkshopSessionsModal {...props} />) };
};

describe('WorkshopSessionsModal', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('explains why persistence is unavailable without rendering file actions', () => {
    renderModal({ available: false, unavailableReason: 'multi-root' });

    expect(screen.getByRole('status').textContent).toContain('multi-root workspace');
    expect(screen.queryByRole('button', { name: 'Save session' })).toBeNull();
  });

  it('shows a browser read failure without hiding the recoverable current room', () => {
    renderModal({ error: 'session directory is unreadable' });

    expect(screen.getByRole('alert').textContent)
      .toContain('Could not load sessions: session directory is unreadable');
    expect(screen.getByText('Working room')).not.toBeNull();
  });

  it('discloses when content search was bounded for a very large session', () => {
    renderModal({ searchTruncated: true });

    expect(screen.getByRole('status').textContent)
      .toContain('Content search is bounded for very large sessions');
  });

  it('renders the snapshot manifest and groups by stable excerpt identity without exposing it', () => {
    renderModal();

    expect(screen.getByText('Excerpt · 812 words')).not.toBeNull();
    expect(screen.getByText('Transcript · 7 turns')).not.toBeNull();
    expect(screen.getAllByText(/Jill · 7 turns/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Excerpt' }));
    expect(screen.getByText('chapter-five.md')).not.toBeNull();
    expect(screen.queryByText('chapters:Drafts/chapter-five.md')).toBeNull();
  });

  it('disables state-changing actions during a run while leaving reveal available', () => {
    renderModal({ mutationsDisabled: true });

    expect((screen.getByRole('button', { name: 'Save session' }) as HTMLButtonElement).disabled)
      .toBe(true);
    expect((screen.getByRole('button', { name: 'Open' }) as HTMLButtonElement).disabled)
      .toBe(true);
    expect((screen.getByRole('button', { name: /Rename Cup continuity pass/ }) as HTMLButtonElement).disabled)
      .toBe(true);
    expect((screen.getByRole('button', { name: /Duplicate Cup continuity pass/ }) as HTMLButtonElement).disabled)
      .toBe(true);
    expect((screen.getByRole('button', { name: /Delete Cup continuity pass/ }) as HTMLButtonElement).disabled)
      .toBe(true);
    expect((screen.getByRole('button', { name: /Reveal Cup continuity pass file/ }) as HTMLButtonElement).disabled)
      .toBe(false);
  });

  it('routes save, open, rename, duplicate, reveal, and confirmed delete', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const { props } = renderModal();

    fireEvent.change(screen.getByRole('textbox', { name: 'Session name' }), {
      target: { value: 'A deliberate title' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save session' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    fireEvent.click(screen.getByRole('button', { name: /Rename Cup continuity pass/ }));
    const rename = screen.getByRole('textbox', { name: 'Rename session' });
    fireEvent.change(rename, { target: { value: 'Continuity, repaired' } });
    fireEvent.blur(rename);

    fireEvent.click(screen.getByRole('button', { name: /Duplicate Cup continuity pass/ }));
    fireEvent.click(screen.getByRole('button', { name: /Reveal Cup continuity pass file/ }));
    fireEvent.click(screen.getByRole('button', { name: /Delete Cup continuity pass/ }));

    expect(props.onSave).toHaveBeenCalledWith('A deliberate title');
    expect(props.onOpen).toHaveBeenCalledWith('named-id');
    expect(props.onRename).toHaveBeenCalledWith('named-id', 'Continuity, repaired');
    expect(props.onDuplicate).toHaveBeenCalledWith('named-id');
    expect(props.onReveal).toHaveBeenCalledWith('named-id');
    expect(props.onDelete).toHaveBeenCalledWith('named-id');
  });
});
