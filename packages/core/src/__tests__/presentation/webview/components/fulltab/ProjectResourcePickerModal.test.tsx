/**
 * @jest-environment jsdom
 */

/**
 * ProjectResourcePickerModal (2026-10-20): the "Choose from project" picker
 * the Workshop's context selector and the Lightbox share. Every host effect
 * is a callback, so these drive it with mocks only:
 * - browse by category, drill in and back;
 * - single selection picks on click and closes; multiple selection toggles,
 *   disables what the caller calls attached and hands the caller's footer the
 *   selection;
 * - name search here, content search after the debounce, merged only when
 *   the host's answer is for the query on screen, with category pills;
 * - the escape hatch; overlay registration, Escape on the top overlay only,
 *   and focus.
 * File names are synthetic.
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import {
  ProjectResourcePickerModal,
  ProjectResourcePickerModalProps,
  projectResourceKey
} from '@components/fulltab/ProjectResourcePickerModal';
import { WorkshopModalShell } from '@components/workshop/WorkshopModalShell';
import { __resetOverlayFocusStateForTests, isAnyOverlayOpen } from '@hooks/useOverlayDismiss';
import type { ConfiguredResourceEntry } from '@messages';

const CATALOG: ConfiguredResourceEntry[] = [
  { group: 'chapters', path: 'Chapters/01-the-lamp.md', label: '01 the lamp', sizeBytes: 9_000 },
  { group: 'chapters', path: 'Chapters/02-the-gate.md', label: '02 the gate', sizeBytes: 8_000 },
  { group: 'characters', path: 'Characters/the-keeper.md', label: 'the keeper', sizeBytes: 600 }
];

const COPY = { eyebrow: 'Pick something', description: 'One line about it.', exploreNote: 'opens the system picker' };

const common = () => ({
  open: true,
  copy: COPY,
  closeLabel: 'Close picker',
  catalog: CATALOG,
  searchResults: null,
  onSearch: jest.fn(),
  onClearSearch: jest.fn(),
  onExplore: jest.fn(),
  onClose: jest.fn()
});

const single = (overrides: Partial<ProjectResourcePickerModalProps> = {}) => {
  const props = { ...common(), selection: 'single', pickHint: 'Click a file to pick it', onPick: jest.fn(), ...overrides } as
    Extract<ProjectResourcePickerModalProps, { selection: 'single' }>;
  return { props, ...render(<ProjectResourcePickerModal {...props} />) };
};

const search = (value: string) =>
  fireEvent.change(screen.getByLabelText('Search configured resources'), { target: { value } });

describe('ProjectResourcePickerModal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    __resetOverlayFocusStateForTests();
  });
  afterEach(() => {
    jest.useRealTimers();
    __resetOverlayFocusStateForTests();
  });

  it('browses by category and picks one file on click (single selection)', () => {
    const { props } = single();

    expect(screen.getByRole('heading', { name: 'Choose from project' })).not.toBeNull();
    expect(screen.getByText('Pick something')).not.toBeNull();
    expect(screen.getByText('Click a file to pick it')).not.toBeNull();
    const chapters = screen.getByRole('button', { name: /Chapters & Scenes/ });
    expect(chapters.textContent).toContain('2 files · 16.6 KB');
    fireEvent.click(chapters);
    expect(screen.getByText('Chapters & Scenes', { selector: '.pm-ws-ctxsel-crumb' })).not.toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /02-the-gate\.md/ }));
    expect(props.onPick).toHaveBeenCalledWith({ group: 'chapters', path: 'Chapters/02-the-gate.md' });
    expect(props.onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    expect(screen.getByRole('button', { name: /Characters/ })).not.toBeNull();
  });

  it('toggles rows, disables attached ones and hands the footer the selection (multiple selection)', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    const renderFooter = jest.fn(({ selected, confirm, close }) => (
      <div>
        <span>{selected.map((entry: ConfiguredResourceEntry) => entry.path).join(', ') || 'none'}</span>
        <button type="button" onClick={confirm}>Take them</button>
        <button type="button" onClick={close}>Never mind</button>
      </div>
    ));
    render(
      <ProjectResourcePickerModal
        {...common()}
        selection="multiple"
        isAttached={(entry) => entry.path === 'Chapters/01-the-lamp.md'}
        onConfirm={onConfirm}
        onClose={onClose}
        renderFooter={renderFooter}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Chapters & Scenes/ }));
    const lamp = screen.getByRole('checkbox', { name: /01-the-lamp/ }) as HTMLButtonElement;
    expect(lamp.disabled).toBe(true);
    expect(lamp.textContent).toContain('attached');
    fireEvent.click(screen.getByRole('checkbox', { name: /02-the-gate/ }));
    fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    fireEvent.click(screen.getByRole('button', { name: /Characters/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /the-keeper/ }));
    expect(screen.getByText('Chapters/02-the-gate.md, Characters/the-keeper.md')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    expect(screen.getByRole('button', { name: /Chapters & Scenes/ }).textContent).toContain('1 selected');

    fireEvent.click(screen.getByRole('button', { name: 'Take them' }));
    expect(onConfirm).toHaveBeenCalledWith([
      { group: 'chapters', path: 'Chapters/02-the-gate.md' },
      { group: 'characters', path: 'Characters/the-keeper.md' }
    ]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('matches names here, asks the host for content after the debounce, and merges only the current query\'s answer', () => {
    const { props, rerender } = single();

    search('gate');
    act(() => { jest.advanceTimersByTime(1000); });
    expect(props.onSearch).not.toHaveBeenCalled();
    expect(screen.getAllByRole('button', { name: /\.md/ })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Names + content' }));
    act(() => { jest.advanceTimersByTime(349); });
    expect(props.onSearch).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(1); });
    expect(props.onSearch).toHaveBeenCalledWith('gate');

    const answer = { query: 'gate', matches: [{ group: 'characters' as const, path: 'Characters/the-keeper.md' }], bounded: true };
    rerender(<ProjectResourcePickerModal {...props} searchResults={{ ...answer, query: 'gat' }} />);
    expect(screen.getAllByRole('button', { name: /\.md/ })).toHaveLength(1);
    rerender(<ProjectResourcePickerModal {...props} searchResults={answer} />);
    expect(screen.getAllByRole('button', { name: /\.md/ })).toHaveLength(2);
    expect(screen.getByRole('status').textContent).toContain('Content search stopped at its safety bounds');
    fireEvent.click(screen.getByRole('button', { name: /^Characters · 1$/ }));
    expect(screen.getAllByRole('button', { name: /\.md/ }).map((row) => row.textContent))
      .toEqual([expect.stringContaining('Characters/the-keeper.md')]);

    search('');
    expect(props.onClearSearch).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Chapters & Scenes/ })).not.toBeNull();
  });

  it('says what an empty, unreadable or loading catalog means', () => {
    const { props, rerender } = single({ catalog: null });
    expect(screen.getByText('Reading your configured resource folders…')).not.toBeNull();
    rerender(<ProjectResourcePickerModal {...props} catalog={[]} />);
    expect(screen.getByText(/No configured resource folders found/)).not.toBeNull();
    rerender(<ProjectResourcePickerModal {...props} catalog={[]} catalogUnreadable />);
    expect(screen.getByText('Could not read your configured resource folders. Use Explore below.')).not.toBeNull();
  });

  it('hands the escape hatch to the caller, then closes', () => {
    const order: string[] = [];
    single({ onExplore: () => order.push('explore'), onClose: () => order.push('close') });

    const explore = screen.getByRole('button', { name: /Explore project folders/ });
    expect(explore.textContent).toBe('Explore project folders… opens the system picker');
    fireEvent.click(explore);
    expect(order).toEqual(['explore', 'close']);
  });

  it('joins the overlay stack: focus starts on its close button, Escape closes only the top overlay, and focus returns', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const onClose = jest.fn();
    const { props, rerender } = single({ onClose });

    expect(isAnyOverlayOpen()).toBe(true);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close picker');

    // Another overlay on top takes Escape; the picker stays.
    const onTopClose = jest.fn();
    const withTop = (topOpen: boolean) => (
      <>
        <ProjectResourcePickerModal {...props} />
        <WorkshopModalShell open={topOpen} titleId="top" closeLabel="Close top" onClose={onTopClose}>
          <h2 id="top">Top</h2>
          <WorkshopModalShell.CloseButton />
        </WorkshopModalShell>
      </>
    );
    rerender(withTop(true));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onTopClose).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    rerender(withTop(false));
    act(() => { jest.runAllTimers(); });

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<ProjectResourcePickerModal {...props} open={false} />);
    act(() => { jest.runAllTimers(); });
    expect(isAnyOverlayOpen()).toBe(false);
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('keys a resource by group and path, and renders only the paths it is given', () => {
    expect(projectResourceKey({ group: 'chapters', path: 'a.md' })).not.toBe(projectResourceKey({ group: 'themes', path: 'a.md' }));
    const { container } = single();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Characters/ }));
    expect(container.textContent).not.toMatch(/file:\/\/|\/Users\/|[A-Z]:\\/);
  });
});
