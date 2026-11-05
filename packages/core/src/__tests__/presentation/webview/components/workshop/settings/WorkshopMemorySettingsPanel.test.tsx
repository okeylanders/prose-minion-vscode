/** @jest-environment jsdom */

/**
 * The Memory tab panel (Slice 4b-ui): every canvas state drawn, the mode
 * cards as a draft that unavailability never disables, the meters' values
 * for assistive technology, the buttons that act at once, and a tabpanel
 * that fits the strip's wiring (4b-wire registers it).
 */

import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  WorkshopMemorySettingsPanel,
  type WorkshopMemorySettingsPanelProps
} from '@components/workshop/settings/WorkshopMemorySettingsPanel';
import { WORKSHOP_CONVERSATION_SETTINGS_TABS } from '@components/workshop/settings/workshopConversationSettingsTabs';
import { FULL_OVER, IN_BUDGET, LIST_OVER } from '../../../hooks/domain/workshop/memory/workshopMemoryFixtures';

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
    onOpenManager: jest.fn(),
    onOpenFolder: jest.fn(),
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
    expect(WORKSHOP_CONVERSATION_SETTINGS_TABS.map((entry) => entry.label)).toEqual(['Behavior', 'About you', 'Memory', 'Advanced']);
  });

  it('on, with memories: the well, the cards, the start-of-conversation row and its meters', () => {
    renderPanel();
    const well = screen.getByRole('region', { name: 'Memory isn’t context.' });
    expect(within(well).getByText('Every conversation in this project')).not.toBeNull();
    expect(within(well).getByText('Kept small: about 7,000 tokens in all')).not.toBeNull();
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

  it('the list over its budget: the amber meter and the searchable line', () => {
    renderPanel({ estimate: LIST_OVER, saved: 40 });
    const list = screen.getAllByRole('meter')[1];
    expect(list.firstElementChild?.className).toBe('pm-ws-memory-meter-fill pm-ws-memory-meter-full');
    expect(screen.getByRole('status').textContent).toBe('12 more are searchable. Personas find them with memory search when the conversation needs them.');
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

  it('never says pin', () => {
    const { view } = renderPanel({ estimate: FULL_OVER });
    expect(view.container.textContent).not.toMatch(/\bpin/i);
  });
});
