/** @jest-environment jsdom */

/**
 * The Memory tab panel (Slice 4b-ui): every canvas state drawn, the mode
 * cards as a draft that unavailability never disables, the meters' values
 * for assistive technology, the buttons that act at once, and a tabpanel
 * that fits the strip's wiring (4b-wire registers it).
 */

import * as React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  WorkshopMemorySettingsPanel,
  type WorkshopMemorySettingsPanelProps
} from '@components/workshop/settings/WorkshopMemorySettingsPanel';
import { WORKSHOP_CONVERSATION_SETTINGS_TABS } from '@components/workshop/settings/workshopConversationSettingsTabs';
import { FULL_OVER, IN_BUDGET, LIST_OVER, TITLES_OVER } from '../../../hooks/domain/workshop/memory/workshopMemoryFixtures';
import { WORKSHOP_PROJECT_MEMORY_LIST_SIZES } from '@shared/constants/workshopProjectMemoryListSizes';

function renderPanel(overrides: Partial<WorkshopMemorySettingsPanelProps> = {}) {
  const props: WorkshopMemorySettingsPanelProps = {
    mode: 'ask',
    workspace: { kind: 'available' },
    estimate: IN_BUDGET,
    saved: 12,
    unreadable: [],
    conflicts: [],
    disabled: false,
    onSelectMode: jest.fn(),
    suggestions: 'sparingly',
    suggestionsDisabled: false,
    onSelectSuggestions: jest.fn(),
    onSelectListSize: jest.fn(),
    onOpenManager: jest.fn(),
    onOpenFolder: jest.fn(),
    explainerOpen: true,
    onToggleExplainer: jest.fn(),
    ...overrides
  };
  const ids = MEMORY_TAB;
  const view = render(
    <>
      <div role="tablist" aria-label="Conversation settings sections">
        <button type="button" role="tab" id={ids.tabElementId} aria-selected aria-controls={ids.panelElementId}>{ids.label}</button>
      </div>
      <div className={ids.panelClassName} role="tabpanel" id={ids.panelElementId} aria-labelledby={ids.tabElementId}>
        <WorkshopMemorySettingsPanel {...props} />
      </div>
    </>
  );
  return { props, view };
}

const MEMORY_TAB = WORKSHOP_CONVERSATION_SETTINGS_TABS.find((entry) => entry.id === 'memory')!;

const card = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });

describe('WorkshopMemorySettingsPanel', () => {
  it('sits in a tabpanel labelled by its tab, with ids no other tab uses', () => {
    renderPanel();
    expect(screen.getByRole('tabpanel', { name: 'Memory' })).not.toBeNull();
    const used = WORKSHOP_CONVERSATION_SETTINGS_TABS.flatMap((entry) => [entry.tabElementId, entry.panelElementId]);
    expect(new Set(used).size).toBe(used.length);
    expect(WORKSHOP_CONVERSATION_SETTINGS_TABS.map((entry) => entry.label)).toEqual(['Behavior', 'About you', 'Pinned context', 'Memory', 'Advanced']);
  });

  it('on, with memories: the well, the cards, the start-of-conversation row and its meters', () => {
    renderPanel();
    const well = screen.getByRole('region', { name: 'Memory isn’t context.' });
    expect(within(well).getByText('Every conversation in this project')).not.toBeNull();
    expect(within(well).getByText('Kept small: up to 9,000 tokens in all')).not.toBeNull();
    expect(within(well).getByText('Much larger: up to 100,000 words')).not.toBeNull();

    expect(card('Ask first').getAttribute('aria-pressed')).toBe('true');
    expect(within(card('Ask first')).getByText('Recommended')).not.toBeNull();
    expect(card('Off').getAttribute('aria-pressed')).toBe('false');

    expect(screen.getByText('Every memory’s title and summary')).not.toBeNull();
    expect(['12 memories', '2 in full', '≈ 1,800 tokens'].every((text) => screen.queryByText(text))).toBe(true);
    const [full, list] = screen.getAllByRole('meter');
    expect(full.getAttribute('aria-label')).toBe('Loaded in full');
    expect(full.getAttribute('aria-valuenow')).toBe('1104');
    expect(full.getAttribute('aria-valuemax')).toBe('5000');
    expect(full.getAttribute('aria-valuetext')).toBe('Loaded in full: 2, about 1,100 of 5,000 tokens');
    expect(list.getAttribute('aria-valuetext')).toBe('Titles and summaries: all 10 fit, about 700 of 2,000 tokens');
    expect(screen.getByText('prose-minion/memory/')).not.toBeNull();
  });

  it('the mode cards send the draft; the buttons act at once', () => {
    const { props } = renderPanel();
    fireEvent.click(card('Save and tell me'));
    expect(props.onSelectMode).toHaveBeenCalledWith('auto');
    fireEvent.click(screen.getByRole('button', { name: 'Manage memories…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open memory folder' }));
    expect(props.onOpenManager).toHaveBeenCalledTimes(1);
    expect(props.onOpenFolder).toHaveBeenCalledTimes(1);
  });

  it('Suggest notes: three choices beside the mode, the host\'s level selected, and Save and tell me\'s limit under them', () => {
    renderPanel({ suggestions: 'readily' });
    const group = screen.getByRole('group', { name: 'Suggest notes' });
    const choices = within(group).getAllByRole('button');
    expect(choices.map((choice) => choice.querySelector('.pm-ws-behavior-card-name')?.textContent)).toEqual(['Sparingly', 'Readily', 'Aggressively']);
    expect(choices.map((choice) => choice.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
    expect(screen.getByText(`With Save and tell me, at most ${PROMPT_BUDGETS.workshopProjectMemory.autoSavesPerRoom} notes are saved in one conversation; the rest wait as cards.`)).not.toBeNull();
    expect(screen.getByText('This choice is saved as soon as you make it, for all your projects.')).not.toBeNull();
    expect(screen.queryByText('Personas suggest no notes while project memory is off.')).toBeNull();
    // It sits after the mode cards and before the start-of-conversation row.
    const rules = [...document.querySelectorAll('.pm-ws-tools-modal-rule')].map((rule) => rule.textContent);
    expect(rules).toEqual(['Project memory', 'Suggest notes', 'At the start of each conversation', 'List at the start of each conversation', 'Your memories']);
  });

  it('Suggest notes saves at once: a choice calls out with its level, and the mode draft is untouched', () => {
    const { props } = renderPanel({ suggestions: 'sparingly' });
    fireEvent.click(card('Aggressively'));
    expect(props.onSelectSuggestions).toHaveBeenCalledTimes(1);
    expect(props.onSelectSuggestions).toHaveBeenCalledWith('aggressively');
    expect(props.onSelectMode).not.toHaveBeenCalled();
    // The level already held asks for nothing.
    fireEvent.click(card('Sparingly'));
    expect(props.onSelectSuggestions).toHaveBeenCalledTimes(1);
  });

  it('Suggest notes locks while a response runs, without locking the mode cards; memory off is said, never a lock', () => {
    const { props } = renderPanel({ suggestionsDisabled: true });
    expect((card('Readily') as HTMLButtonElement).disabled).toBe(true);
    expect((card('Off') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(card('Readily'));
    expect(props.onSelectSuggestions).not.toHaveBeenCalled();

    cleanup();
    renderPanel({ mode: 'off' });
    expect(screen.getByText('Personas suggest no notes while project memory is off.')).not.toBeNull();
    expect((card('Readily') as HTMLButtonElement).disabled).toBe(false);
  });

  it('an apply in flight locks the cards, not the buttons', () => {
    renderPanel({ disabled: true });
    expect((card('Off') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Manage memories…' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('off: nothing loads, no meters, the manager still open to the writer', () => {
    renderPanel({ mode: 'off' });
    expect(screen.getByText('Nothing loads while memory is off')).not.toBeNull();
    expect(screen.getByText('12 saved')).not.toBeNull();
    expect(screen.queryAllByRole('meter')).toHaveLength(0);
    expect((screen.getByRole('button', { name: 'Manage memories…' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('no memories yet: the help line and the folder line', () => {
    renderPanel({ saved: 0, estimate: undefined });
    expect(screen.getByText('No memories yet')).not.toBeNull();
    expect(screen.getByText('One Markdown file per memory. The folder is made when the first memory is saved, or when you open it.')).not.toBeNull();
  });

  it('the list over its budget: the amber meter, and a third meter for the notes shown by title', () => {
    renderPanel({ estimate: LIST_OVER, saved: 40 });
    const meters = screen.getAllByRole('meter');
    expect(meters.map((meter) => meter.getAttribute('aria-label'))).toEqual(['Loaded in full', 'Titles and summaries', 'Titles only']);
    expect(meters[1].firstElementChild?.className).toBe('pm-ws-memory-meter-fill pm-ws-memory-meter-full');
    expect(meters[2].firstElementChild?.className).toBe('pm-ws-memory-meter-fill');
    expect([meters[2].getAttribute('aria-valuenow'), meters[2].getAttribute('aria-valuemax'), meters[2].getAttribute('aria-valuetext')])
      .toEqual(['312', '2000', 'Titles only: all 12 fit, about 310 of 2,000 tokens']);
    expect(screen.getByText('Titles only · all 12 fit')).not.toBeNull();
    // Every note in effect is shown in some form: no "searchable" line.
    expect(screen.queryByRole('status')).toBeNull();

    cleanup();
    renderPanel({ estimate: TITLES_OVER, saved: 40 });
    expect(screen.getAllByRole('meter')[2].firstElementChild?.className).toBe('pm-ws-memory-meter-fill pm-ws-memory-meter-full');
    expect(screen.getByRole('status').textContent).toBe('4 more are searchable. Personas find them with memory search when the conversation needs them.');
  });

  it('List at the start of each conversation: three sizes with their tokens, the host\'s size selected, and when it applies', () => {
    renderPanel({ listSize: 'larger' });
    const group = screen.getByRole('group', { name: 'List at the start of each conversation' });
    const choices = within(group).getAllByRole('button');
    expect(choices.map((choice) => choice.querySelector('.pm-ws-behavior-card-name')?.textContent)).toEqual(['Standard', 'Larger', 'Largest']);
    expect(choices.map((choice) => choice.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
    expect(choices.map((choice) => choice.querySelector('.pm-ws-behavior-card-desc')?.textContent)).toEqual([
      'Up to 2,000 tokens of titles and summaries, then up to 2,000 of titles alone.',
      'Up to 5,000 tokens of titles and summaries, then up to 3,000 of titles alone.',
      'Up to 10,000 tokens of titles and summaries, then up to 4,000 of titles alone.'
    ]);
    // The one line under it, directly after the cards.
    expect(group.nextElementSibling?.textContent).toBe('Applies from the next conversation.');
    expect(screen.getByText('An open conversation keeps the list it started with. This choice is saved as soon as you make it, for all your projects.')).not.toBeNull();
  });

  it('the list size reads Standard until the host says otherwise, and the meters state the size\'s own budgets', () => {
    renderPanel();
    expect(card('Standard').getAttribute('aria-pressed')).toBe('true');

    cleanup();
    const largest = WORKSHOP_PROJECT_MEMORY_LIST_SIZES.largest;
    renderPanel({ estimate: TITLES_OVER, saved: 40, listSize: 'largest', budgets: { ...largest, contextWords: 100_000 } });
    expect(card('Largest').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByRole('meter').map((meter) => meter.getAttribute('aria-valuemax'))).toEqual(['5000', '10000', '4000']);
    expect(screen.getByText('Kept small: up to 19,000 tokens in all')).not.toBeNull();
  });

  it('the list size saves at once: a choice calls out with its size, and neither draft nor level is touched', () => {
    const { props } = renderPanel({ listSize: 'standard' });
    fireEvent.click(card('Largest'));
    expect(props.onSelectListSize).toHaveBeenCalledTimes(1);
    expect(props.onSelectListSize).toHaveBeenCalledWith('largest');
    expect(props.onSelectMode).not.toHaveBeenCalled();
    expect(props.onSelectSuggestions).not.toHaveBeenCalled();
    // The size already held asks for nothing.
    fireEvent.click(card('Standard'));
    expect(props.onSelectListSize).toHaveBeenCalledTimes(1);
  });

  it('the list size locks while a response runs or an apply is pending, and with memory off it still chooses', () => {
    const { props } = renderPanel({ suggestionsDisabled: true });
    expect((card('Larger') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(card('Larger'));
    expect(props.onSelectListSize).not.toHaveBeenCalled();

    cleanup();
    const off = renderPanel({ mode: 'off' });
    expect((card('Larger') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(card('Larger'));
    expect(off.props.onSelectListSize).toHaveBeenCalledWith('larger');
  });

  it('set to load in full, over its budget: the requested figure apart from the loaded one', () => {
    renderPanel({ estimate: FULL_OVER });
    expect(screen.getByText('Set to load in full · 4 · 1 doesn’t fit')).not.toBeNull();
    expect(screen.getByText('about 5,600 requested · 4,400 of 5,000 loaded')).not.toBeNull();
    expect(screen.getByText('3 of 4 in full')).not.toBeNull();
    expect(screen.getByText('≈ 5,200 tokens at the start')).not.toBeNull();
    expect(screen.getAllByRole('meter')[0].getAttribute('aria-valuenow')).toBe('4410');
  });

  it('unreadable files: each with its reason, and Show in manager opens the manager', () => {
    const { props } = renderPanel({
      unreadable: [
        { entryKey: 'k1', fileName: 'rabbit-watch-runs-backward-7f3c2a.md', reason: 'unclosed-frontmatter' },
        { entryKey: 'k2', fileName: 'tea-party-seating-1a9e04.md', reason: 'invalid-value', key: 'kind' }
      ]
    });
    expect(screen.getByText('2 files can’t be read')).not.toBeNull();
    const items = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(items).toEqual([
      'rabbit-watch-runs-backward-7f3c2a.md · no closing --- line',
      'tea-party-seating-1a9e04.md · “kind” isn’t one Memory knows'
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Show in manager' }));
    expect(props.onOpenManager).toHaveBeenCalledTimes(1);
  });

  it.each(['no-workspace', 'multi-root'] as const)('unavailable (%s): the notice first, the buttons disabled with the reason, the cards still choosable', (reason) => {
    const { props } = renderPanel({ workspace: { kind: 'unavailable', reason }, estimate: undefined });
    const notice = screen.getAllByRole('status')[0];
    expect(notice.textContent).toContain('Project memory isn’t available here.');
    // The notice comes before the well (decision 15).
    const well = screen.getByRole('region', { name: 'Memory isn’t context.' });
    expect(notice.compareDocumentPosition(well) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    for (const name of ['Manage memories…', 'Open memory folder']) {
      const button = screen.getByRole('button', { name }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      expect(document.getElementById(button.getAttribute('aria-describedby') ?? '')?.textContent).toContain('Open a single folder');
    }
    expect((card('Save and tell me') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(card('Save and tell me'));
    expect(props.onSelectMode).toHaveBeenCalledWith('auto');
    expect(screen.getByText('Nothing loads')).not.toBeNull();
  });

  it('the well’s head is its disclosure: it names the table it shows, and folds it away (Slice 6 live pass)', () => {
    const { props, view } = renderPanel();
    const head = screen.getByRole('button', { name: /^Memory isn’t context\. They reach personas differently\./ });
    expect(head.getAttribute('aria-expanded')).toBe('true');
    const table = document.getElementById(head.getAttribute('aria-controls') ?? '')!;
    expect(table.tagName).toBe('DL');
    expect(table.hidden).toBe(false);
    fireEvent.click(head);
    expect(props.onToggleExplainer).toHaveBeenCalledTimes(1);

    view.rerender(
      <WorkshopMemorySettingsPanel {...props} explainerOpen={false} />
    );
    const folded = screen.getByRole('button', { name: /^Memory isn’t context\./ });
    expect(folded.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById(folded.getAttribute('aria-controls') ?? '')!.hidden).toBe(true);
    // Folded, the well keeps its name and its place before the cards.
    expect(screen.getByRole('region', { name: 'Memory isn’t context.' })).not.toBeNull();
  });

  it('never says pin', () => {
    const { view } = renderPanel({ estimate: FULL_OVER });
    expect(view.container.textContent).not.toMatch(/\bpin/i);
  });
});
