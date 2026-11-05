/**
 * @jest-environment jsdom
 */

/**
 * WorkshopMemorySheet (Slice 0d, "The sheet"; ADR 2026-11-04 D5): its three
 * modes, the codec's counters, "Don't replace", "Always load in full" with
 * the host's numbers, and the refused edit, which disables Save changes.
 * The UI never says "pin". *Alice*.
 */

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { WorkshopMemoryDraft } from '@messages';
import { WorkshopMemorySheet } from '@components/workshop/memory/WorkshopMemorySheet';
import type { WorkshopMemorySheetState } from '@hooks/domain/workshop/useWorkshopProjectMemory';

const DRAFT: WorkshopMemoryDraft = {
  title: 'The Rabbit\'s watch runs backward',
  kind: 'canon',
  summary: 'From chapter 3 on, the White Rabbit\'s watch runs backward.',
  body: 'We settled this while working the tea-party scene.',
  supersedes: ['mem-1a9e04'],
  pinned: false
};

const sheet = (overrides: Partial<WorkshopMemorySheetState> = {}): WorkshopMemorySheetState => ({
  mode: 'card',
  turnId: 'turn-4-assistant-1008',
  draft: DRAFT,
  replaces: [{ id: 'mem-1a9e04', title: 'The Rabbit\'s watch stops at six' }],
  loading: false,
  saving: false,
  sourceLabel: 'Jill',
  ...overrides
});

const renderSheet = (state: WorkshopMemorySheetState | null, handlers: Partial<React.ComponentProps<typeof WorkshopMemorySheet>> = {}) => {
  const props = { onChange: jest.fn(), onDropReplaced: jest.fn(), onSubmit: jest.fn(), onClose: jest.fn(), ...handlers };
  render(<WorkshopMemorySheet sheet={state} {...props} />);
  return props;
};

describe('WorkshopMemorySheet', () => {
  it('renders nothing without a sheet', () => {
    const { container } = render(<WorkshopMemorySheet sheet={null} onChange={jest.fn()} onDropReplaced={jest.fn()} onSubmit={jest.fn()} onClose={jest.fn()} />);
    expect(container.textContent).toBe('');
  });

  it('a card\'s edit: the fields with the codec\'s counters, the kinds, Replaces, the source and the room line', () => {
    const props = renderSheet(sheet());
    expect(screen.getByRole('heading', { name: 'Save to project memory' })).toBeTruthy();
    expect(screen.getByText('32 / 120')).toBeTruthy();
    expect(screen.getByText(/\/ 8,000/)).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Canon/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText(/From Jill's reply in this conversation/)).toBeTruthy();
    expect(screen.getByText('Saving tells the room: "Saved to project memory: The Rabbit\'s watch runs backward".')).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: /Decision/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Don\'t replace The Rabbit\'s watch stops at six' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Always load in full' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save to memory' }));
    expect(props.onChange).toHaveBeenCalledWith({ kind: 'decision' });
    expect(props.onDropReplaced).toHaveBeenCalledWith('mem-1a9e04');
    expect(props.onChange).toHaveBeenCalledWith({ pinned: true });
    expect(props.onSubmit).toHaveBeenCalled();
  });

  it('offers six kind cards, in the writer\'s order, each with its description (Slice 6a)', () => {
    renderSheet(sheet());
    expect(screen.getAllByRole('radio').map((card) => card.textContent)).toEqual([
      'DecisionA choice the project made.',
      'CanonA fact of the story.',
      'ThemeWhat the story is about.',
      'IdeaA possibility, not chosen yet.',
      'Open threadA question to come back to.',
      'PreferenceHow you like to work.'
    ]);
  });

  it('picks Theme and Idea like any other kind', () => {
    const props = renderSheet(sheet());
    fireEvent.click(screen.getByRole('radio', { name: /^Theme/ }));
    fireEvent.click(screen.getByRole('radio', { name: /^Idea/ }));
    expect(props.onChange).toHaveBeenCalledWith({ kind: 'theme' });
    expect(props.onChange).toHaveBeenCalledWith({ kind: 'idea' });
  });

  it('"Always load in full" reads the host\'s numbers', () => {
    renderSheet(sheet({ estimate: { thisTokens: 60, totalTokens: 4_360, budgetTokens: 5_000, refused: false } }));
    expect(screen.getByText(
      'Every conversation starts with this memory\'s whole note, not just its summary. This one adds about 60 tokens; memories loaded in full would come to about 4,360 of 5,000.'
    )).toBeTruthy();
  });

  it('a refused edit shows the refusal under the note and disables Save changes', () => {
    const props = renderSheet(sheet({
      mode: 'memory',
      memoryId: 'mem-7f3c2a',
      draft: { ...DRAFT, pinned: true },
      estimate: { thisTokens: 1_400, totalTokens: 5_302, budgetTokens: 5_000, refused: true }
    }));
    expect(screen.getByRole('heading', { name: 'Edit memory' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe(
      'Can\'t save this edit: this memory loads in full, and the longer note would bring memories loaded in full to about 5,300 of 5,000 tokens. ' +
      'Shorten the note, or turn off Always load in full here or on another memory.'
    );
    const save = screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(save);
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('waits for a title and summary, and shows a field\'s fault once typed', () => {
    const { rerender } = render(
      <WorkshopMemorySheet sheet={sheet({ mode: 'new', draft: { ...DRAFT, title: '', summary: '' }, replaces: [] })} onChange={jest.fn()} onDropReplaced={jest.fn()} onSubmit={jest.fn()} onClose={jest.fn()} />
    );
    expect((screen.getByRole('button', { name: 'Save to memory' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(
      <WorkshopMemorySheet sheet={sheet({ mode: 'new', draft: { ...DRAFT, summary: 'two\nlines' }, replaces: [] })} onChange={jest.fn()} onDropReplaced={jest.fn()} onSubmit={jest.fn()} onClose={jest.fn()} />
    );
    expect(screen.getByRole('alert').textContent).toBe('A memory\'s summary is one line.');
  });

  it('shows the host\'s refusal, and holds the draft while saving', () => {
    renderSheet(sheet({ saving: true, error: 'Another window is editing that memory. Try again in a moment.' }));
    expect(screen.getByText('Another window is editing that memory. Try again in a moment.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Saving…' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Escape closes the sheet, but not while it saves (PR #200 F-05)', () => {
    const saving = renderSheet(sheet({ saving: true }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(saving.onClose).not.toHaveBeenCalled();
    cleanup();
    const idle = renderSheet(sheet());
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(idle.onClose).toHaveBeenCalledTimes(1);
  });

  it('never says pin', () => {
    const { baseElement } = render(
      <WorkshopMemorySheet sheet={sheet()} onChange={jest.fn()} onDropReplaced={jest.fn()} onSubmit={jest.fn()} onClose={jest.fn()} />
    );
    expect(baseElement.textContent?.toLowerCase()).not.toMatch(/\bpin/);
  });
});
