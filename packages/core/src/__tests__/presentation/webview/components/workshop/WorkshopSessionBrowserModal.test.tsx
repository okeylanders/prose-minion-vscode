/** @jest-environment jsdom */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkshopSessionBrowserModal } from '@components/workshop/WorkshopSessionBrowserModal';
import { WorkshopSessionSummary } from '@messages';

const summary = (
  overrides: Partial<WorkshopSessionSummary> = {}
): WorkshopSessionSummary => ({
  sessionId: 'current-id',
  title: 'Pentecost — auditorium beat',
  fileName: 'current.json',
  kind: 'current',
  startedAt: Date.now() - 3_600_000,
  updatedAt: Date.now(),
  timezone: 'America/Chicago',
  hostPersonaId: 'jill',
  participantPersonaIds: ['jill'],
  turnCount: 14,
  excerptWordCount: 2015,
  excerptLabel: 'Drafts/chapter-5.8.md',
  excerptIdentity: 'chapters:Drafts/chapter-5.8.md',
  preview: 'Give one speaker a gesture instead of a word right before the group exits.',
  ...overrides
});

const current = summary();
const named = summary({
  sessionId: 'named-id',
  title: 'Kayla — blackout scene',
  fileName: '20260723-103000-kayla-blackout-scene.json',
  kind: 'named',
  savedAt: Date.now() - 86_400_000,
  updatedAt: Date.now() - 86_400_000,
  hostPersonaId: 'margot',
  participantPersonaIds: ['margot'],
  excerptLabel: 'Drafts/chapter-6.md',
  excerptIdentity: 'chapters:Drafts/chapter-6.md'
});

const renderModal = (
  overrides: Partial<React.ComponentProps<typeof WorkshopSessionBrowserModal>> = {}
) => {
  const props: React.ComponentProps<typeof WorkshopSessionBrowserModal> = {
    open: true,
    available: true,
    current,
    sessions: [named],
    truncated: false,
    searchTruncated: false,
    pending: false,
    query: '',
    mutationsDisabled: false,
    onClose: jest.fn(),
    onQueryChange: jest.fn(),
    onRefresh: jest.fn(),
    onNewSession: jest.fn(),
    onOpen: jest.fn(),
    onRename: jest.fn(),
    onDuplicate: jest.fn(),
    onReveal: jest.fn(),
    onDelete: jest.fn(),
    ...overrides
  };
  return { props, view: render(<WorkshopSessionBrowserModal {...props} />) };
};

describe('WorkshopSessionBrowserModal', () => {
  it('renders the full browser with an always-visible named-session Open action', () => {
    renderModal();

    expect(screen.getByRole('heading', { name: 'Open a prior session' })).not.toBeNull();
    expect(screen.getByRole('searchbox', {
      name: 'Search session names and content'
    })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Open' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'New session' })).not.toBeNull();
  });

  it('uses each saved host persona focus icon in session history', () => {
    const { view } = renderModal();
    const jillGlyph = view.container.querySelector('[data-persona-id="jill"]');
    const margotGlyph = view.container.querySelector('[data-persona-id="margot"]');

    expect(jillGlyph?.getAttribute('data-focus-icon')).toBe('sparkle');
    expect(margotGlyph?.getAttribute('data-focus-icon')).toBe('eye');
  });

  it('groups named sessions by Date or Excerpt without exposing stable excerpt identity', () => {
    renderModal();

    expect(screen.getByText(/This week|Earlier/)).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Excerpt' }));
    expect(screen.getAllByText('Drafts/chapter-6.md').length).toBeGreaterThan(0);
    expect(screen.queryByText('chapters:Drafts/chapter-6.md')).toBeNull();
  });

  it('routes search, open, file actions, and a confirmed delete', () => {
    const { props } = renderModal();
    fireEvent.change(screen.getByRole('searchbox', {
      name: 'Search session names and content'
    }), { target: { value: 'blackout' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent.click(screen.getByRole('button', { name: /Duplicate Kayla/ }));
    fireEvent.click(screen.getByRole('button', { name: /Reveal Kayla/ }));
    fireEvent.click(screen.getByRole('button', { name: /Delete Kayla/ }));
    fireEvent.click(screen.getByRole('button', { name: /Confirm delete Kayla/ }));

    expect(props.onQueryChange).toHaveBeenCalledWith('blackout');
    expect(props.onOpen).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'named-id' }));
    expect(props.onDuplicate).toHaveBeenCalledWith('named-id');
    expect(props.onReveal).toHaveBeenCalledWith('named-id');
    expect(props.onDelete).toHaveBeenCalledWith('named-id');
  });

  it('supports inline rename and Escape cancellation', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /Rename Kayla/ }));
    const rename = screen.getByRole('textbox', { name: 'Rename session' });
    fireEvent.change(rename, { target: { value: 'Kayla — lights out' } });
    fireEvent.blur(rename);
    expect(props.onRename).toHaveBeenCalledWith('named-id', 'Kayla — lights out');

    fireEvent.click(screen.getByRole('button', { name: /Rename Kayla/ }));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Rename session' }), {
      key: 'Escape'
    });
    expect(props.onRename).toHaveBeenCalledTimes(1);
  });

  it('disables room-changing actions during a run while leaving reveal available', () => {
    renderModal({ mutationsDisabled: true });

    expect((screen.getByRole('button', { name: 'Open' }) as HTMLButtonElement).disabled)
      .toBe(true);
    expect((screen.getByRole('button', { name: /Rename Kayla/ }) as HTMLButtonElement).disabled)
      .toBe(true);
    expect((screen.getByRole('button', { name: /Duplicate Kayla/ }) as HTMLButtonElement).disabled)
      .toBe(true);
    expect((screen.getByRole('button', { name: /Delete Kayla/ }) as HTMLButtonElement).disabled)
      .toBe(true);
    expect((screen.getByRole('button', { name: /Reveal Kayla/ }) as HTMLButtonElement).disabled)
      .toBe(false);
  });
});
