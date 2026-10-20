/**
 * @jest-environment jsdom
 */

/**
 * Workshop context selector parity (Lightbox source picker, 2026-10-20).
 *
 * The selector's picker UI moved into a component the Lightbox shares. These
 * witnesses were written and their snapshots recorded against the Workshop's
 * own modal BEFORE that move, so the move is held to the DOM it replaced:
 * every step of a scripted session in each mode (attach, excerpt, message)
 * snapshots the dialog's markup and the ordered log of every callback the
 * modal made, with its arguments. A changed class, label, row, pill, total,
 * focus target or callback fails here.
 *
 * All file names are synthetic.
 */

import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { WorkshopContextSelectorModal } from '@components/workshop/WorkshopContextSelectorModal';
import { __resetOverlayFocusStateForTests } from '@hooks/useOverlayDismiss';

type ModalProps = React.ComponentProps<typeof WorkshopContextSelectorModal>;
type Entry = NonNullable<ModalProps['catalog']>[number];
type SearchResults = NonNullable<ModalProps['searchResults']>;

const CATALOG: Entry[] = [
  { group: 'characters', path: 'Characters/marlow.md', label: 'marlow', sizeBytes: 1200 },
  { group: 'characters', path: 'Characters/ishmael.md', label: 'ishmael', sizeBytes: 900 },
  { group: 'chapters', path: 'Chapters/01-the-river.md', label: '01 the river', sizeBytes: 18_400 },
  { group: 'chapters', path: 'Chapters/02-the-station.md', label: '02 the station', sizeBytes: 21_300 },
  { group: 'themes', path: 'Themes/rivers.md', label: 'rivers', sizeBytes: 700 },
  { group: 'manuscript', path: 'Manuscript/whole-draft.md', label: 'whole draft', sizeBytes: 250_000 }
];

/**
 * A callback argument as the log keeps it. A button wired straight to a
 * callback (`onClick={onClose}`) passes React's click event; the log keeps
 * that it was an event and its type, not its timestamp or target.
 */
const loggable = (arg: unknown): unknown =>
  typeof arg === 'object' && arg !== null && 'nativeEvent' in arg
    ? { event: (arg as unknown as { type: string }).type }
    : arg;

/** One mounted modal and the log of everything it called. */
function mount(overrides: Partial<ModalProps> = {}) {
  const calls: Array<[string, ...unknown[]]> = [];
  const record = (name: string) => jest.fn((...args: unknown[]) => {
    calls.push([name, ...args.map(loggable)]);
  });
  const props: ModalProps = {
    open: true,
    catalog: CATALOG,
    attachments: [],
    searchResults: null,
    remainingWords: 10_000,
    onSearch: record('onSearch'),
    onClearSearch: record('onClearSearch'),
    onConfirm: record('onConfirm'),
    onPickExcerpt: record('onPickExcerpt'),
    onExplore: record('onExplore'),
    onClose: record('onClose'),
    ...overrides
  };
  const opener = document.createElement('button');
  opener.textContent = 'Opener';
  document.body.appendChild(opener);
  opener.focus();
  const view = render(<WorkshopContextSelectorModal {...props} />);
  const rerender = (next: Partial<ModalProps>) => {
    Object.assign(props, next);
    view.rerender(<WorkshopContextSelectorModal {...props} />);
  };
  /** The dialog's markup, the focused element's label, and every call since the last step. */
  const step = () => {
    const snapshot = {
      dom: view.container.innerHTML,
      focused: document.activeElement === document.body
        ? 'body'
        : document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent ?? null,
      calls: calls.splice(0)
    };
    return snapshot;
  };
  return { props, view, rerender, step, opener };
}

const search = (value: string) =>
  fireEvent.change(screen.getByLabelText('Search configured resources'), { target: { value } });

describe('Workshop context selector parity (recorded before the shared picker)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    __resetOverlayFocusStateForTests();
  });
  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = '';
    __resetOverlayFocusStateForTests();
  });

  it('attach mode: browse, drill in, select, search both ways, filter, totals and confirm', () => {
    const { rerender, step } = mount({
      attachments: [{
        id: 'ctx-1',
        kind: 'file',
        origin: 'writer',
        label: 'ishmael.md',
        words: 150,
        relativePath: 'Characters/ishmael.md',
        configuredResource: { group: 'characters', path: 'Characters/ishmael.md' },
        addedAt: 1
      }, {
        id: 'ctx-2',
        kind: 'text',
        origin: 'wizard',
        label: 'A brief',
        words: 40,
        content: 'A brief.',
        addedAt: 2
      }]
    });
    expect(step()).toMatchSnapshot('opened');

    fireEvent.click(screen.getByRole('button', { name: /Characters/ }));
    expect(step()).toMatchSnapshot('characters');
    fireEvent.click(screen.getByRole('checkbox', { name: /marlow/ }));
    expect(step()).toMatchSnapshot('one selected');
    fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    fireEvent.click(screen.getByRole('button', { name: /Chapters/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /01-the-river/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /02-the-station/ }));
    expect(step()).toMatchSnapshot('three selected');
    fireEvent.click(screen.getByRole('checkbox', { name: /02-the-station/ }));
    fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    expect(step()).toMatchSnapshot('browse with selection counts');

    search('r');
    act(() => { jest.advanceTimersByTime(500); });
    expect(step()).toMatchSnapshot('names search');
    fireEvent.click(screen.getByRole('button', { name: /^Chapters & Scenes · / }));
    expect(step()).toMatchSnapshot('names search, chapters pill');

    search('river');
    fireEvent.click(screen.getByRole('button', { name: /names \+ content/i }));
    act(() => { jest.advanceTimersByTime(349); });
    expect(step()).toMatchSnapshot('content search before the debounce');
    act(() => { jest.advanceTimersByTime(1); });
    expect(step()).toMatchSnapshot('content search asked');
    const results: SearchResults = {
      query: 'river',
      matches: [
        { group: 'characters', path: 'Characters/marlow.md' },
        { group: 'manuscript', path: 'Manuscript/whole-draft.md' }
      ],
      bounded: true
    };
    rerender({ searchResults: results });
    expect(step()).toMatchSnapshot('content results merged, bounded');
    fireEvent.click(screen.getByRole('button', { name: /^Manuscript · / }));
    expect(step()).toMatchSnapshot('content results, manuscript pill');
    rerender({ searchResults: { ...results, query: 'rive' } });
    expect(step()).toMatchSnapshot('stale results for another query');

    search('zzz');
    act(() => { jest.advanceTimersByTime(500); });
    rerender({ searchResults: { query: 'zzz', matches: [], bounded: false } });
    expect(step()).toMatchSnapshot('no content matches');
    fireEvent.click(screen.getByRole('button', { name: /^Names$/ }));
    expect(step()).toMatchSnapshot('no name matches');

    search('');
    expect(step()).toMatchSnapshot('search cleared');

    rerender({ remainingWords: 100 });
    expect(step()).toMatchSnapshot('over the remaining budget');
    fireEvent.click(screen.getByRole('button', { name: /Add 2 files/ }));
    expect(step()).toMatchSnapshot('confirmed');
  });

  it('attach mode: the escape hatch, Cancel, and an empty or loading catalog', () => {
    const { rerender, step } = mount();
    fireEvent.click(screen.getByRole('button', { name: /Explore project folders/ }));
    expect(step()).toMatchSnapshot('explored');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(step()).toMatchSnapshot('cancelled');
    rerender({ catalog: null });
    expect(step()).toMatchSnapshot('loading');
    rerender({ catalog: [] });
    expect(step()).toMatchSnapshot('no configured folders');
    rerender({ open: false });
    expect(step()).toMatchSnapshot('closed');
  });

  it('excerpt mode: one click picks, attached files stay selectable, and search picks too', () => {
    const { step } = mount({
      mode: 'excerpt',
      attachments: [{
        id: 'ctx-1',
        kind: 'file',
        origin: 'writer',
        label: 'marlow.md',
        words: 150,
        relativePath: 'Characters/marlow.md',
        configuredResource: { group: 'characters', path: 'Characters/marlow.md' },
        addedAt: 1
      }]
    });
    expect(step()).toMatchSnapshot('opened');
    fireEvent.click(screen.getByRole('button', { name: /Characters/ }));
    expect(step()).toMatchSnapshot('characters');
    fireEvent.click(screen.getByRole('button', { name: /marlow/ }));
    expect(step()).toMatchSnapshot('picked from browse');

    search('station');
    act(() => { jest.advanceTimersByTime(500); });
    expect(step()).toMatchSnapshot('names search');
    fireEvent.click(screen.getByRole('button', { name: /02-the-station/ }));
    expect(step()).toMatchSnapshot('picked from search');

    fireEvent.click(screen.getByRole('button', { name: /Explore project folders/ }));
    expect(step()).toMatchSnapshot('explored');
  });

  it('message mode: staged files, the slot count, the cap and confirm', () => {
    const { rerender, step } = mount({
      mode: 'message',
      attachments: [{
        id: 'ctx-1',
        kind: 'file',
        origin: 'writer',
        label: 'marlow.md',
        words: 150,
        relativePath: 'Characters/marlow.md',
        configuredResource: { group: 'characters', path: 'Characters/marlow.md' },
        addedAt: 1
      }],
      pendingMessageAttachments: [
        { id: 'ta-1', label: 'rivers.md', words: 120, relativePath: 'Themes/rivers.md', configuredResource: { group: 'themes', path: 'Themes/rivers.md' } },
        { id: 'ta-2', label: 'ishmael.md', words: 80, relativePath: 'Characters/ishmael.md' },
        ...['one', 'two', 'three', 'four'].map((name, index) => ({
          id: `ta-${index + 3}`,
          label: `${name}.md`,
          words: 80,
          relativePath: `Notes/${name}.md`
        }))
      ]
    });
    expect(step()).toMatchSnapshot('opened');
    fireEvent.click(screen.getByRole('button', { name: /Characters/ }));
    expect(step()).toMatchSnapshot('characters');
    fireEvent.click(screen.getByRole('checkbox', { name: /marlow/ }));
    fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    fireEvent.click(screen.getByRole('button', { name: /Chapters/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /01-the-river/ }));
    expect(step()).toMatchSnapshot('over the cap');
    fireEvent.click(screen.getByRole('checkbox', { name: /01-the-river/ }));
    expect(step()).toMatchSnapshot('within the cap');
    fireEvent.click(screen.getByRole('button', { name: /Attach 1/ }));
    expect(step()).toMatchSnapshot('confirmed');

    rerender({ pendingMessageAttachments: [] });
    expect(step()).toMatchSnapshot('nothing staged');
    fireEvent.click(screen.getByRole('button', { name: /Explore project folders/ }));
    expect(step()).toMatchSnapshot('explored');
  });

  it.each(['attach', 'excerpt', 'message'] as const)(
    '%s mode: focus lands on the close button, Escape closes it, and focus returns on close',
    (mode) => {
      const { rerender, step, opener } = mount({ mode });
      expect(step()).toMatchSnapshot('opened');
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(step()).toMatchSnapshot('escape');
      rerender({ open: false });
      act(() => { jest.runAllTimers(); });
      return Promise.resolve().then(() => {
        expect(document.activeElement).toBe(opener);
      });
    }
  );
});
