/**
 * @jest-environment jsdom
 */

/**
 * WorkshopTextSheet — Sprint 13A §5–§7. One sheet, five cases.
 *
 * Behavior under test:
 * - live word count and Apply disabled at zero words (and at no change),
 * - Edit│Preview tabs, with Preview rendering markdown read-only,
 * - per-case kicker/copy, including the retained-conversation reassurance and
 *   the wizard's session-only promise,
 * - project files open as a READ with the editor-tab escape hatch,
 * - a refused apply keeps the draft on screen (the caller closes, not the sheet).
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  WorkshopTextSheet,
  WorkshopTextSheetMode
} from '@components/workshop/WorkshopTextSheet';

const renderSheet = (
  overrides: Partial<React.ComponentProps<typeof WorkshopTextSheet>> = {}
) => {
  const props: React.ComponentProps<typeof WorkshopTextSheet> = {
    open: true,
    mode: { kind: 'context-new' },
    value: '',
    onApply: jest.fn(),
    onClose: jest.fn(),
    ...overrides
  };
  return { ...render(<WorkshopTextSheet {...props} />), props };
};

const excerptMode = (retained = false): WorkshopTextSheetMode =>
  ({ kind: 'excerpt', retainedConversation: retained });

describe('WorkshopTextSheet — authoring', () => {
  it('counts words live and refuses to apply an empty note', () => {
    renderSheet();
    const apply = screen.getByRole('button', { name: /add to context/i });
    expect((apply as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByRole('textbox', { name: 'Edit: Add a text note' }), {
      target: { value: 'Five words typed right here.' }
    });

    expect(screen.getAllByText('5 words').length).toBeGreaterThan(0);
    expect((apply as HTMLButtonElement).disabled).toBe(false);
  });

  it('applies the draft verbatim', () => {
    const { props } = renderSheet();
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit: Add a text note' }), {
      target: { value: '# Kayla\n\nShe picks at her cuff.' }
    });
    fireEvent.click(screen.getByRole('button', { name: /add to context/i }));

    expect(props.onApply).toHaveBeenCalledWith('# Kayla\n\nShe picks at her cuff.');
  });

  it('renders the preview as formatted markdown, read-only', () => {
    const { container } = renderSheet({ value: '# Kayla\n\nShe **lies** here.' });
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));

    const preview = container.querySelector('.pm-ws-text-sheet-preview');
    expect(preview?.querySelector('h1')?.textContent).toBe('Kayla');
    expect(preview?.querySelector('strong')?.textContent).toBe('lies');
    expect(screen.getByText(/Markdown rendered as the room will read it/)).toBeTruthy();
  });

  it('says nothing is previewable rather than rendering an empty box', () => {
    renderSheet();
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    expect(screen.getByText('Nothing to preview yet.')).toBeTruthy();
  });

  it('keeps Save disabled until the writer actually changes something', () => {
    renderSheet({
      mode: { kind: 'context-text', label: 'Kayla — running notes' },
      value: 'She does not believe it.'
    });
    const save = screen.getByRole('button', { name: /save changes/i }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.change(screen.getByRole('textbox', { name: 'Edit: Kayla — running notes' }), {
      target: { value: 'She does not believe it, and neither does he.' }
    });
    expect(save.disabled).toBe(false);
  });
});

describe('WorkshopTextSheet — per-case copy', () => {
  it('reassures that a mid-conversation excerpt keeps the conversation', () => {
    renderSheet({ mode: excerptMode(true), value: '' });

    expect(screen.getByText('Add excerpt to this conversation')).toBeTruthy();
    expect(screen.getByText(/stays exactly where it is/)).toBeTruthy();
  });

  it('uses the plain set-excerpt framing before a conversation exists', () => {
    renderSheet({ mode: excerptMode(false), value: '' });

    expect(screen.getByText('Set excerpt')).toBeTruthy();
    expect(screen.getByText(/matches your editor selection/)).toBeTruthy();
  });

  it('promises a wizard edit is session-only and leaves the file alone', () => {
    renderSheet({
      mode: { kind: 'context-wizard', label: 'kayla-voice-guide.md' },
      value: 'Clipped sentences under pressure.'
    });

    expect(screen.getByText('Context · Wizard suggestion')).toBeTruthy();
    expect(screen.getByText(/session only — the source file is untouched/)).toBeTruthy();
  });

  it('cross-links the excerpt sheet to the project picker', () => {
    const onChooseFromProject = jest.fn();
    renderSheet({ mode: excerptMode(false), onChooseFromProject });

    fireEvent.click(screen.getByRole('button', { name: /choose from project/i }));
    expect(onChooseFromProject).toHaveBeenCalled();
  });
});

describe('WorkshopTextSheet — project files', () => {
  const fileMode: WorkshopTextSheetMode = {
    kind: 'context-file',
    label: 'character-ava.md',
    relativePath: 'Characters/character-ava.md'
  };

  it('opens on the rendered read and offers no way to save', () => {
    renderSheet({ mode: fileMode, value: '# Ava\n\nShe keeps watch.' });

    expect((screen.getByRole('tab', { name: 'Preview' }) as HTMLElement)
      .getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('button', { name: /save changes/i })).toBeNull();
    expect(screen.getByText(/edit the file itself/i)).toBeTruthy();
  });

  it('keeps the source visible but not editable', () => {
    renderSheet({ mode: fileMode, value: '# Ava' });
    // A file opens on the rendered read, so reach the source the way a writer
    // does. The Edit panel is `hidden` until selected — deliberately, so a
    // screen reader is offered one panel and not both — and an accessible
    // query must not be able to see it before then.
    expect(screen.queryByRole('textbox', { name: 'Source: character-ava.md' })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Source' }));
    expect(screen.getByRole('textbox', { name: 'Source: character-ava.md' }))
      .toHaveProperty('readOnly', true);
  });

  it('routes the editor-tab escape hatch when the host can open the file', () => {
    const onOpenInEditor = jest.fn();
    renderSheet({ mode: fileMode, value: '# Ava', canOpenInEditor: true, onOpenInEditor });

    fireEvent.click(screen.getByRole('button', { name: /open in editor tab/i }));
    expect(onOpenInEditor).toHaveBeenCalled();
  });

  it('hides the editor-tab affordance for something with no file behind it', () => {
    renderSheet({ mode: { kind: 'context-text', label: 'Kayla' }, value: 'Note.' });
    expect(screen.queryByRole('button', { name: /open in editor tab/i })).toBeNull();
  });
});

describe('WorkshopTextSheet — pending and failed bodies', () => {
  it('says the body is loading rather than showing an empty editor', () => {
    renderSheet({ mode: { kind: 'context-text', label: 'Kayla' }, value: undefined, loading: true });
    expect(screen.getByRole('status').textContent).toContain('Loading the attached text');
  });

  it('surfaces a host-side reason the body could not be produced', () => {
    renderSheet({
      mode: { kind: 'context-text', label: 'Kayla' },
      value: undefined,
      error: 'That context attachment is no longer attached to this session.'
    });
    expect(screen.getByRole('alert').textContent).toContain('no longer attached');
  });
});

/**
 * Sprint 13A: moving excerpt authoring into the sheet must not drop Sprint 12's
 * verified-provenance round trip — the claim is earned by a paste and forfeited
 * by an edit.
 */
describe('WorkshopTextSheet — verified excerpt provenance', () => {
  const excerptFile: WorkshopTextSheetMode = { kind: 'excerpt', retainedConversation: false };

  it('reports a paste so the host can verify it against the editor selection', () => {
    const onPasteText = jest.fn();
    renderSheet({ mode: excerptFile, onPasteText });

    fireEvent.paste(screen.getByRole('textbox', { name: 'Edit: Paste or type the passage' }), {
      clipboardData: { getData: () => 'Pasted passage.' }
    });

    expect(onPasteText).toHaveBeenCalledWith('Pasted passage.');
  });

  it('shows the claim only while the draft still matches it', () => {
    renderSheet({
      mode: excerptFile,
      verified: { text: 'Pasted passage.', note: 'chapters/05.md' }
    });
    const textarea = screen.getByRole('textbox', { name: 'Edit: Paste or type the passage' });

    fireEvent.change(textarea, { target: { value: 'Pasted passage.' } });
    expect(screen.getByRole('status').textContent).toContain('chapters/05.md');

    fireEvent.change(textarea, { target: { value: 'Pasted passage. Edited.' } });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
