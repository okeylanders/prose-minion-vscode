/**
 * @jest-environment jsdom
 */

/**
 * WorkshopContextSelectorModal — Sprint 12 Phase 4. Behavior under test:
 * - category browse → drill-in → select → confirm posts canonical refs,
 * - name search filters client-side; the mode pill arms the host content
 *   search and merges its matches; category filter pills narrow results,
 * - already-attached files are disabled,
 * - the explore escape hatch routes to the host picker,
 * - no raw absolute path ever renders.
 */

import * as React from 'react';
import { fireEvent, render, screen, act } from '@testing-library/react';
import { WorkshopContextSelectorModal } from '@components/workshop/WorkshopContextSelectorModal';
import {
  WorkshopContextCatalogEntry,
  WorkshopContextSearchResultsPayload
} from '@messages';

const CATALOG: WorkshopContextCatalogEntry[] = [
  { group: 'characters', path: 'Characters/raven.md', label: 'raven', sizeBytes: 1200 },
  { group: 'characters', path: 'Characters/kayla.md', label: 'kayla', sizeBytes: 900 },
  { group: 'themes', path: 'Themes/echoes.md', label: 'echoes', sizeBytes: 700 }
];

const renderModal = (
  overrides: Partial<React.ComponentProps<typeof WorkshopContextSelectorModal>> = {}
) => {
  const props: React.ComponentProps<typeof WorkshopContextSelectorModal> = {
    open: true,
    catalog: CATALOG,
    attachments: [],
    searchResults: null,
    remainingWords: 10_000,
    onSearch: jest.fn(),
    onClearSearch: jest.fn(),
    onConfirm: jest.fn(),
    onExplore: jest.fn(),
    onClose: jest.fn(),
    ...overrides
  };
  return { ...render(<WorkshopContextSelectorModal {...props} />), props };
};

describe('WorkshopContextSelectorModal', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('browses categories, selects files, and confirms canonical refs in order', () => {
    const { props } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: /Characters/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Characters\/raven\.md/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Characters\/kayla\.md/ }));
    fireEvent.click(screen.getByRole('button', { name: /add 2 files/i }));

    expect(props.onConfirm).toHaveBeenCalledWith([
      { group: 'characters', path: 'Characters/raven.md' },
      { group: 'characters', path: 'Characters/kayla.md' }
    ]);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('disables files that are already attached', () => {
    renderModal({
      attachments: [{
        id: 'ctx-1',
        kind: 'file',
        origin: 'writer',
        label: 'raven.md',
        words: 200,
        relativePath: 'Characters/raven.md',
        configuredResource: { group: 'characters', path: 'Characters/raven.md' },
        addedAt: 1
      }]
    });

    fireEvent.click(screen.getByRole('button', { name: /Characters/ }));
    const row = screen.getByRole('checkbox', { name: /Characters\/raven\.md/ });
    expect((row as HTMLButtonElement).disabled).toBe(true);
    expect(row.textContent).toContain('attached');
  });

  it('filters by name instantly and only asks the host in names+content mode', () => {
    const { props } = renderModal();

    fireEvent.change(screen.getByLabelText('Search configured resources'), {
      target: { value: 'raven' }
    });
    act(() => { jest.advanceTimersByTime(500); });

    expect(screen.getByRole('checkbox', { name: /Characters\/raven\.md/ })).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: /Themes\/echoes\.md/ })).toBeNull();
    expect(props.onSearch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /names \+ content/i }));
    act(() => { jest.advanceTimersByTime(500); });
    expect(props.onSearch).toHaveBeenCalledWith('raven');
  });

  it('merges host content matches and narrows with category pills', () => {
    const searchResults: WorkshopContextSearchResultsPayload = {
      query: 'raven',
      matches: [{ group: 'themes', path: 'Themes/echoes.md' }],
      bounded: false
    };
    renderModal({ searchResults });

    fireEvent.change(screen.getByLabelText('Search configured resources'), {
      target: { value: 'raven' }
    });
    fireEvent.click(screen.getByRole('button', { name: /names \+ content/i }));

    // Name match + host content match, then narrowed to Themes only.
    expect(screen.getByRole('checkbox', { name: /Characters\/raven\.md/ })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /Themes\/echoes\.md/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Themes · 1$/ }));
    expect(screen.queryByRole('checkbox', { name: /Characters\/raven\.md/ })).toBeNull();
    expect(screen.getByRole('checkbox', { name: /Themes\/echoes\.md/ })).toBeTruthy();
  });

  it('excerpt mode picks ONE file immediately and keeps attached files selectable', () => {
    const onPickExcerpt = jest.fn();
    const { props } = renderModal({
      mode: 'excerpt',
      onPickExcerpt,
      attachments: [{
        id: 'ctx-1',
        kind: 'file',
        origin: 'writer',
        label: 'raven.md',
        words: 200,
        relativePath: 'Characters/raven.md',
        configuredResource: { group: 'characters', path: 'Characters/raven.md' },
        addedAt: 1
      }]
    });

    fireEvent.click(screen.getByRole('button', { name: /Characters/ }));
    const row = screen.getByRole('button', { name: /Characters\/raven\.md/ });
    expect((row as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(row);

    expect(onPickExcerpt).toHaveBeenCalledWith({ group: 'characters', path: 'Characters/raven.md' });
    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });

  it('routes the explore escape hatch to the host picker and closes', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /explore project folders/i }));
    expect(props.onExplore).toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });

  it('never renders an absolute path', () => {
    const { container } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /Characters/ }));
    expect(container.textContent).not.toMatch(/file:\/\/|\/Users\/|[A-Z]:\\/);
  });

  it('message mode confirms one-shot refs, caps by remaining slots, and marks staged files (Phase 6B)', () => {
    const { props } = renderModal({
      mode: 'message',
      pendingMessageAttachments: [
        { id: 'ta-1', label: 'echoes.md', words: 120, relativePath: 'Themes/echoes.md', configuredResource: { group: 'themes', path: 'Themes/echoes.md' } },
        { id: 'ta-2', label: 'kayla.md', words: 80, relativePath: 'Characters/kayla.md', configuredResource: { group: 'characters', path: 'Characters/kayla.md' } }
      ]
    });

    expect(screen.getByText('Attach to message')).toBeTruthy();
    expect(screen.getByText(/1 attachment slot left on this message/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Characters/ }));
    // Already-staged files read as attached and stay disabled in this mode.
    const kayla = screen.getByRole('checkbox', { name: /kayla/ }) as HTMLButtonElement;
    expect(kayla.disabled).toBe(true);

    fireEvent.click(screen.getByRole('checkbox', { name: /raven/ }));
    fireEvent.click(screen.getByRole('button', { name: /Attach 1 to message/ }));

    expect(props.onConfirm).toHaveBeenCalledWith([
      { group: 'characters', path: 'Characters/raven.md' }
    ]);
    expect(props.onClose).toHaveBeenCalled();
  });
});
