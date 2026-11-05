/** @jest-environment jsdom */

/**
 * The Pinned context tab (Pinned Context Slice 3; Slice 0d's approved
 * boards): every state, the template well's disclosure, the list well, a
 * moved row kept in view with its focus, and Add from project… in pin mode.
 * Presentational: it posts nothing. *Alice*, with made-up paths.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import {
  WorkshopPinnedContextSettingsPanel,
  type WorkshopPinnedContextSettingsPanelProps
} from '@components/workshop/settings/WorkshopPinnedContextSettingsPanel';
import { workshopPinnedContextTabView } from '@hooks/domain/workshop/pinnedContext/workshopPinnedContextTabView';
import type {
  ConfiguredResourceEntry,
  WorkshopContextAttachmentSnapshot,
  WorkshopPinnedContextEntryView,
  WorkshopPinnedContextPayload
} from '@messages';
import { pinnedContextPanelPropsStub } from './pinnedContextPanelPropsStub';

const BUDGET = 100_000;

const entry = (relativePath: string, words: number, extra: Partial<WorkshopPinnedContextEntryView> = {}): WorkshopPinnedContextEntryView => ({
  path: relativePath,
  label: relativePath.split('/').pop()!,
  words,
  state: 'ready',
  ...extra
});

const TEN = [
  entry('Brief/brief.md', 1850, { group: 'projectBrief' }),
  entry('Tone-And-Style/voice-and-tone.md', 2100, { group: 'general' }),
  entry('Characters/alice.md', 3400, { group: 'characters' }),
  entry('Characters/the-white-rabbit.md', 1900, { group: 'characters' }),
  entry('Characters/the-hatter.md', 2600, { group: 'characters' }),
  entry('Characters/the-queen-of-hearts.md', 2200, { group: 'characters' }),
  entry('Characters/the-cheshire-cat.md', 1700, { group: 'characters' }),
  entry('Locations/wonderland.md', 2900, { group: 'locations' }),
  entry('Things/tea-party-rules.md', 1400, { group: 'things' }),
  entry('Themes/curiosity-and-size.md', 3350, { group: 'themes' })
];

function payload(overrides: Partial<WorkshopPinnedContextPayload> = {}): WorkshopPinnedContextPayload {
  const entries = overrides.entries ?? TEN;
  return {
    requestId: 'req-1',
    platform: 'posix',
    availability: { available: true },
    file: { state: 'ok' },
    revision: 'rev-1',
    entries,
    totals: { words: entries.reduce((total, row) => total + (row.words ?? 0), 0), budgetWords: BUDGET, files: entries.length, maxFiles: 20 },
    ...overrides
  };
}

const attached = (relativePath: string, id = `ctx-${relativePath.length}`): WorkshopContextAttachmentSnapshot =>
  ({ id, kind: 'file', origin: 'writer', label: relativePath, words: 1, relativePath }) as WorkshopContextAttachmentSnapshot;

const ROOM = TEN.slice(0, 8).map((row, index) => attached(row.path, `ctx-${index + 1}`));

function renderPanel(answer: WorkshopPinnedContextPayload | undefined, options: {
  attachments?: WorkshopContextAttachmentSnapshot[];
  running?: boolean;
  pending?: boolean;
  props?: Partial<WorkshopPinnedContextSettingsPanelProps>;
} = {}) {
  const make = (next: WorkshopPinnedContextPayload | undefined, extra: Partial<WorkshopPinnedContextSettingsPanelProps> = {}) => pinnedContextPanelPropsStub({
    view: workshopPinnedContextTabView({
      ...(next ? { answer: next } : {}),
      attachments: options.attachments ?? ROOM,
      running: options.running ?? false,
      pending: options.pending ?? false
    }),
    ...(next ? { answer: next } : {}),
    ...options.props,
    ...extra
  });
  const props = make(answer);
  const view = render(<WorkshopPinnedContextSettingsPanel {...props} />);
  return {
    props,
    view,
    rerender: (next: WorkshopPinnedContextPayload | undefined, extra: Partial<WorkshopPinnedContextSettingsPanelProps> = {}) =>
      view.rerender(<WorkshopPinnedContextSettingsPanel {...props} {...make(next, extra)} />)
  };
}

const button = (name: string | RegExp) => screen.getByRole('button', { name });

describe('WorkshopPinnedContextSettingsPanel: 0d\'s states', () => {
  it('Listed: the summary, its meter and chips, the start note, the numbered rows and the actions', () => {
    const { props } = renderPanel(payload());
    expect(props.onRequestList).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Attached to every new conversation')).not.toBeNull();
    const meter = screen.getByRole('meter', { name: 'Pinned context' });
    expect(meter.getAttribute('aria-valuetext')).toBe('about 23,400 of 100,000 words');
    expect(screen.getByText('10 files')).not.toBeNull();
    expect(screen.getByText('8 in this conversation')).not.toBeNull();
    expect(screen.getByText(/New session and New session: full reset start with these files/)).not.toBeNull();
    expect(screen.getByText('Files, in order · 10')).not.toBeNull();

    const rows = within(screen.getByRole('list', { name: /Pinned files, in the order/ })).getAllByRole('listitem');
    expect(rows).toHaveLength(10);
    expect(within(rows[2]).getByText('alice.md')).not.toBeNull();
    expect(within(rows[2]).getByText('Characters')).not.toBeNull();
    expect(within(rows[2]).getByText('In this conversation')).not.toBeNull();
    expect(within(rows[9]).queryByText('In this conversation')).toBeNull();
    expect((within(rows[0]).getByRole('button', { name: 'Move brief.md up' }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(rows[9]).getByRole('button', { name: 'Move curiosity-and-size.md down' }) as HTMLButtonElement).disabled).toBe(true);

    expect(button('Attach missing to this conversation (2)')).not.toBeNull();
    expect(button(/Pin what’s attached now \(0\)/)).not.toBeNull();
    expect(screen.getByText('Pin files from this project only.')).not.toBeNull();
    expect(screen.getByText(/The list, in order, saved in this project/)).not.toBeNull();
  });

  it('Empty: nothing pinned yet, no meter, no list, and the file is made with the first pin', () => {
    renderPanel(payload({ entries: [], file: { state: 'absent' }, revision: 'absent' }), { attachments: [attached('Notes/garden.md', 'ctx-1')] });
    expect(screen.getByText('Nothing pinned yet')).not.toBeNull();
    expect(screen.queryByRole('meter')).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByText('The file is made when you pin the first file.')).not.toBeNull();
    expect((button('Open file') as HTMLButtonElement).disabled).toBe(true);
    expect((button(/Pin what’s attached now \(1\)/) as HTMLButtonElement).disabled).toBe(false);
  });

  it('Problems: a missing and an unreadable row in amber, counted above the well', () => {
    const entries = TEN.map((row) => row.path === 'Characters/the-cheshire-cat.md'
      ? { path: row.path, label: row.label, state: 'missing' as const, stateWords: 'Not found' }
      : row.path === 'Locations/wonderland.md'
        ? { path: row.path, label: row.label, group: row.group, state: 'unreadable' as const, stateWords: 'Can’t read: it’s larger than 5 MiB.' }
        : row);
    renderPanel(payload({ entries }));
    expect(screen.getByText('2 pinned files won’t attach: one isn’t there, and one can’t be read. New conversations start with the other 8. Nothing is unpinned for you.')).not.toBeNull();
    expect(screen.getByText('Not found. New conversations start without it. Unpin it, or put the file back.')).not.toBeNull();
    expect(screen.getByText('Can’t read: it’s larger than 5 MiB. New conversations start without it.')).not.toBeNull();
    expect((button('Open the-cheshire-cat.md') as HTMLButtonElement).disabled).toBe(true);
  });

  it('Over budget: the meter turns full, a row doesn\'t fit, and nothing is unpinned', () => {
    renderPanel(payload({ entries: [...TEN, entry('Manuscript/manuscript.md', 84_200, { group: 'manuscript' })] }));
    expect(screen.getByRole('meter').querySelector('.pm-ws-memory-meter-full')).not.toBeNull();
    expect(screen.getByText(/^Pinned context comes to about 107,600 of 100,000 words/)).not.toBeNull();
    expect(screen.getByText(/^Doesn’t fit: with the files above it/)).not.toBeNull();
  });

  it('Head-sliced: the row says what it attaches', () => {
    renderPanel(payload({ entries: [entry('Manuscript/draft.md', 99_000, { state: 'head-sliced', stateWords: 'Attached as its first 99,000 of 140,000 words', truncation: { keptWords: 99_000, totalWords: 140_000 } })] }));
    expect(screen.getByText('Attached as its first 99,000 of 140,000 words')).not.toBeNull();
  });

  it('Changed: the info line above the list', () => {
    renderPanel(payload({ action: 'unpin', ok: false, notice: { kind: 'changed' } }));
    expect(screen.getByText('Pinned context changed in another window.')).not.toBeNull();
    expect(screen.getByText(/This is the current list\./)).not.toBeNull();
  });

  it('Running: Attach missing waits and says why; pinning still works', () => {
    renderPanel(payload(), { running: true });
    const attach = button('Attach missing to this conversation (2)') as HTMLButtonElement;
    expect(attach.disabled).toBe(true);
    expect(document.getElementById(attach.getAttribute('aria-describedby')!)?.textContent)
      .toBe('Wait for the reply to finish to attach files to this conversation. Pinning and unpinning still work, and apply to new conversations.');
    expect((button('Unpin alice.md') as HTMLButtonElement).disabled).toBe(false);
    expect((button(/Add from project/) as HTMLButtonElement).disabled).toBe(false);
  });

  it('Unreadable: the notice with its reason, and only Open file works', () => {
    renderPanel(payload({ entries: [], revision: null, file: { state: 'unreadable', words: 'pinned-context.json can’t be read. It names one file twice (entry 4). Nothing is attached from it until it’s fixed. Fix it in the editor.' } }));
    expect(screen.getByText('pinned-context.json can’t be read.')).not.toBeNull();
    expect(screen.getByText('Nothing attaches until the file is fixed')).not.toBeNull();
    expect((button(/Add from project/) as HTMLButtonElement).disabled).toBe(true);
    expect((button(/Pin what’s attached now/) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: /Attach missing/ })).toBeNull();
    expect((button('Open file') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText('Open it to fix it. Prose Minion never rewrites a file it can’t read.')).not.toBeNull();
  });

  it.each([
    ['no-workspace', 'No folder is open, so there’s no project to pin files in. Open a single folder to use pinned context.'],
    ['multi-root', 'This workspace has several folders, so pinned context can’t tell which project it belongs to.']
  ] as const)('Unavailable (%s): the amber notice, and every action disabled', (reason, text) => {
    renderPanel(payload({ entries: [], revision: null, file: { state: 'absent' }, availability: { available: false, reason, words: `Pinned context isn’t available here. ${text}` } }));
    expect(screen.getByText('Pinned context isn’t available here.')).not.toBeNull();
    expect(screen.getByText(text)).not.toBeNull();
    expect(screen.getByText('Nothing attaches')).not.toBeNull();
    for (const name of [/Add from project/, /Pin what’s attached now/, 'Open file']) {
      expect((button(name) as HTMLButtonElement).disabled).toBe(true);
    }
    expect(screen.getByText('There’s no project folder to save it in.')).not.toBeNull();
  });

  it.each([
    ['busy', 'Pinned context is being changed in another window. Try again in a moment.', 'Pinned context is being changed in another window.'],
    ['io', 'pinned-context.json couldn’t be read. Try again, or check the project folder.', 'pinned-context.json couldn’t be read.']
  ] as const)('The list %s (Slice 2b\'s words): a notice, and the list\'s actions wait', (state, words, title) => {
    renderPanel(payload({ entries: [], revision: null, file: { state, words } }));
    expect(screen.getByText(title)).not.toBeNull();
    expect(screen.getByText('The list couldn’t be shown just now')).not.toBeNull();
    expect((button(/Add from project/) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows a refused change and Attach missing\'s result under the actions', () => {
    const { rerender } = renderPanel(payload({ action: 'unpin', ok: false, notice: { kind: 'refused', text: 'That file isn’t pinned any more. This is the current list.' } }));
    expect(screen.getByRole('alert').textContent).toContain('That file isn’t pinned any more.');
    rerender(payload({ action: 'attach-missing', ok: true, notice: { kind: 'done', text: 'Attached 2 pinned files to this conversation.' } }));
    expect(screen.getByText('Attached 2 pinned files to this conversation.')).not.toBeNull();
  });
});

describe('WorkshopPinnedContextSettingsPanel: the template well', () => {
  it('toggles, with aria-expanded and aria-controls true to its state', () => {
    const { props, rerender } = renderPanel(payload());
    const toggle = button(/Pinned context is a starting template\./);
    const body = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(body.hidden).toBe(false);
    expect(within(body).getByText('Change it')).not.toBeNull();

    fireEvent.click(toggle);
    expect(props.onToggleNote).toHaveBeenCalledTimes(1);
    rerender(payload(), { noteOpen: false });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(body.hidden).toBe(true);
    expect(screen.getByText('Each new conversation copies it once, then keeps its own.')).not.toBeNull();
  });

  it('heads every state, below any notice', () => {
    renderPanel(payload({ entries: [], revision: null, file: { state: 'absent' }, availability: { available: false, reason: 'no-workspace', words: 'Pinned context isn’t available here. No folder is open.' } }));
    const notice = screen.getByText('Pinned context isn’t available here.');
    const toggle = button(/Pinned context is a starting template\./);
    expect(notice.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('WorkshopPinnedContextSettingsPanel: the list well', () => {
  it('keeps one height from 6 rows to 20: the rows scroll inside a well capped at about six rows', () => {
    const sheet = fs.readFileSync(path.resolve(__dirname, '../../../../../../presentation/webview/styles/workshop/pinnedContext.css'), 'utf8');
    const rule = /\.pm-ws-pin-well\s*\{([^}]*)\}/.exec(sheet)?.[1] ?? '';
    expect(rule).toMatch(/max-height:\s*340px/);
    expect(rule).toMatch(/overflow-y:\s*auto/);

    for (const count of [6, 20]) {
      const entries = Array.from({ length: count }, (_, index) => entry(`Notes/note-${index}.md`, 10));
      const { view } = renderPanel(payload({ entries }));
      const well = view.container.querySelector('.pm-ws-pin-well')!;
      expect(well.querySelectorAll('li')).toHaveLength(count);
      expect(well.getAttribute('style')).toBeNull();
      view.unmount();
    }
  });

  it('scrolls a moved row into view and keeps the focus on its Move button', () => {
    const scrolled: Element[] = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) { scrolled.push(this); };
    try {
      const { props, rerender } = renderPanel(payload());
      const down = button('Move alice.md down');
      down.focus();
      fireEvent.click(down);
      expect(props.onMove).toHaveBeenCalledWith('Characters/alice.md', 'down');

      rerender(payload(), { pendingRequestIds: ['move-1'] }); // waiting: nothing moves yet
      const moved = [...TEN];
      [moved[2], moved[3]] = [moved[3], moved[2]];
      act(() => rerender(payload({ entries: moved, revision: 'rev-2' })));

      const row = screen.getByRole('button', { name: 'Move alice.md down' }).closest('li')!;
      expect(row.querySelector('.pm-ws-pin-pos')?.textContent).toBe('4');
      expect(scrolled).toContain(row);
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Move alice.md down' }));
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('names rows by their stored path in every action', () => {
    const { props } = renderPanel(payload());
    fireEvent.click(button('Unpin alice.md'));
    fireEvent.click(button('Open alice.md'));
    fireEvent.click(button('Open file'));
    fireEvent.click(button('Attach missing to this conversation (2)'));
    expect(props.onUnpin).toHaveBeenCalledWith('Characters/alice.md');
    expect(props.onOpenFile).toHaveBeenNthCalledWith(1, 'Characters/alice.md');
    expect(props.onOpenFile).toHaveBeenNthCalledWith(2);
    expect(props.onAttachMissing).toHaveBeenCalledTimes(1);
  });

  it('pins what\'s attached now by attachment id', () => {
    const { props } = renderPanel(payload(), { attachments: [...ROOM, attached('Notes/garden.md', 'ctx-12')] });
    fireEvent.click(button(/Pin what’s attached now \(1\)/));
    expect(props.onPinAttachments).toHaveBeenCalledWith(['ctx-12']);
  });
});

describe('WorkshopPinnedContextSettingsPanel: Add from project… in pin mode', () => {
  const catalog: ConfiguredResourceEntry[] = [
    { group: 'characters', path: 'Characters/alice.md', label: 'alice.md', sizeBytes: 20 * 1024 },
    { group: 'characters', path: 'Characters/the-caterpillar.md', label: 'the-caterpillar.md', sizeBytes: 9 * 1024 },
    { group: 'characters', path: 'Characters/the-duchess.md', label: 'the-duchess.md', sizeBytes: 8 * 1024 }
  ];

  const openPicker = (extra: Partial<WorkshopPinnedContextSettingsPanelProps> = {}) => {
    const panel = renderPanel(payload(), { props: { catalog, ...extra } });
    fireEvent.click(button(/Add from project/));
    expect(panel.props.onRequestCatalog).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /Characters/ }));
    return panel;
  };

  it('keeps pinned rows disabled and marked, offers the host\'s picker, and estimates against what\'s left', () => {
    const { props } = openPicker();
    expect(screen.getByText('Pin context')).not.toBeNull();
    const alice = screen.getByRole('checkbox', { name: /Characters\/alice\.md/ }) as HTMLButtonElement;
    expect(alice.disabled).toBe(true);
    expect(within(alice).getByText('Pinned')).not.toBeNull();
    expect(screen.getByText('opens the system picker; files in this project only')).not.toBeNull();

    fireEvent.click(screen.getByRole('checkbox', { name: /the-caterpillar/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /the-duchess/ }));
    expect(screen.getByText('2 files · ~2,901 words est.')).not.toBeNull();
    expect(button('Pin 2 files')).not.toBeNull();

    fireEvent.click(button(/Explore project folders/));
    expect(props.onPinPickedFile).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Pin context')).toBeNull();
  });

  it('keeps the picker open until the host answers: a refusal shows above its footer, a pin that lands closes it', () => {
    const { props, rerender } = openPicker();
    fireEvent.click(screen.getByRole('checkbox', { name: /the-duchess/ }));
    fireEvent.click(button('Pin 1 file'));
    expect(props.onPinResources).toHaveBeenCalledWith([{ group: 'characters', path: 'Characters/the-duchess.md' }]);

    rerender(payload(), { catalog, pendingRequestIds: ['pin-1'] });
    expect((button('Pinning…') as HTMLButtonElement).disabled).toBe(true);

    const refused = 'Can’t pin the-duchess.md: pinned context would come to about 104,000 of 100,000 words. Unpin another file, or shorten this one.';
    rerender(payload({ requestId: 'pin-1', action: 'pin-resources', ok: false, notice: { kind: 'refused', text: refused } }), { catalog });
    expect(within(screen.getByRole('dialog')).getByRole('alert').textContent).toBe(refused);
    // The refusal is the picker's; the tab doesn't repeat it.
    expect(screen.getAllByText(refused)).toHaveLength(1);

    fireEvent.click(button('Pin 1 file'));
    rerender(payload({ requestId: 'pin-1', action: 'pin-resources', ok: true }), { catalog });
    expect(screen.queryByText('Pin context')).toBeNull();
  });
});
