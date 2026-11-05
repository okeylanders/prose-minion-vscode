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
import { WorkshopTextSheet } from '@components/workshop/WorkshopTextSheet';
import type {
  WorkshopTextSheetMode
} from '@hooks/domain/workshop/controllers/useWorkshopContextSheet';
import { formatReadInTime } from '@utils/workshop/contextSources';
import { WorkshopTurnBubble } from '@components/workshop/WorkshopTurnBubble';
import type { WorkshopTurn } from '@messages';
// The preview's projection, so the sheet is tested against what the host sends.
import { workshopTurnPreview } from '@/application/services/workshop/transcript/WorkshopTurnPreview';

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

describe('WorkshopTextSheet — the Read in reader (Wayfinding Slice 2)', () => {
  const deliveredAt = Date.UTC(2026, 10, 3, 15, 14);
  const readInMode: WorkshopTextSheetMode = {
    kind: 'read-in',
    label: 'rabbit.md',
    group: 'characters',
    path: 'characters/rabbit.md',
    participantLabel: 'Jill',
    deliveredAt
  };

  it('names who read it and when, and renders the file as it is now', () => {
    renderSheet({ mode: readInMode, value: '# The Rabbit\n\nHe checks his watch.', canOpenInEditor: true });

    expect(screen.getByText('Read in by Jill')).toBeTruthy();
    expect(screen.getByText(`Read in at ${formatReadInTime(deliveredAt)} · read-only`)).toBeTruthy();
    expect(screen.getByText(/The file as it is now\. Jill read it at/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'The Rabbit' })).toBeTruthy();
    expect(screen.getByText('characters/rabbit.md')).toBeTruthy();
  });

  it('is read-only: no Apply, and the source cannot be edited', () => {
    renderSheet({ mode: readInMode, value: 'Down the hole.' });
    expect(screen.queryByRole('button', { name: /save changes|apply|add to context/i })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Source' }));
    expect(screen.getByRole('textbox', { name: 'Source: rabbit.md' })).toHaveProperty('readOnly', true);
  });

  it('offers Close and Open beside, and Open beside asks the host', () => {
    const onOpenInEditor = jest.fn();
    const { props } = renderSheet({ mode: readInMode, value: 'Down the hole.', canOpenInEditor: true, onOpenInEditor });

    fireEvent.click(screen.getByRole('button', { name: /open beside/i }));
    expect(onOpenInEditor).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /open in editor tab/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('says it is loading the file while the host answers', () => {
    renderSheet({ mode: readInMode, value: undefined, loading: true });
    expect(screen.getByRole('status').textContent).toContain('Loading the file…');
    expect(screen.queryByRole('button', { name: /open beside/i })).toBeNull();
  });

  it('shows a refusal as an alert, with no content and no Open beside', () => {
    renderSheet({
      mode: readInMode,
      value: undefined,
      error: 'That file is not one of the configured project resources in its group.'
    });
    expect(screen.getByRole('alert').textContent).toContain('not one of the configured project resources');
    expect(screen.queryByRole('button', { name: /open beside/i })).toBeNull();
  });

  it('reports truncation rather than hiding it', () => {
    renderSheet({ mode: readInMode, value: 'The start of a long file.', truncated: true, canOpenInEditor: true });
    expect(screen.getByRole('note').textContent).toContain('Showing the start of the file only');
  });

  it('says nothing about truncation for a whole file', () => {
    renderSheet({ mode: readInMode, value: 'A short file.', canOpenInEditor: true });
    expect(screen.queryByRole('note')).toBeNull();
  });
});

describe('WorkshopTextSheet — the reader\'s provenance (Wayfinding Slice 3)', () => {
  const deliveredAt = Date.UTC(2026, 10, 3, 15, 14);
  const readInMode: WorkshopTextSheetMode = {
    kind: 'read-in',
    label: 'rabbit.md',
    group: 'characters',
    path: 'characters/rabbit.md',
    participantLabel: 'Jill',
    deliveredAt,
    turnId: 'turn-4-assistant-1'
  };
  const RABBIT = ['# The Rabbit', 'Checks his watch.', 'Late for the Duchess.', 'Wears a waistcoat.', 'Carries gloves.']
    .join('\n');
  let scrollIntoView: jest.Mock;

  beforeEach(() => {
    scrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  afterEach(() => {
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  });

  const lineItems = () => Array.from(document.querySelectorAll<HTMLElement>('.pm-ws-readin-lines-list > li'));

  it('opens on the numbered lines, marking the lines read with the band', () => {
    renderSheet({ mode: readInMode, value: RABBIT, lineRange: { start: 2, end: 4 }, canOpenInEditor: true });

    expect(screen.getByRole('tab', { name: 'Source' }).getAttribute('aria-selected')).toBe('true');
    const region = screen.getByRole('region', { name: 'characters/rabbit.md, lines 2–4 read by Jill' });
    expect(region).toBeTruthy();
    const read = Array.from(document.querySelectorAll<HTMLElement>('.pm-ws-readin-line-read'))
      .map((line) => line.dataset.line);
    expect(read).toEqual(['2', '3', '4']);
    expect(screen.getByText(`Read at ${formatReadInTime(deliveredAt)} · lines 2–4`)).toBeTruthy();
    // The read-only textarea gives way to the lines.
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('puts the end-of-read marker right after the last line read', () => {
    renderSheet({ mode: readInMode, value: RABBIT, lineRange: { start: 2, end: 4 } });

    const items = lineItems();
    const marker = items.findIndex((item) => item.classList.contains('pm-ws-readin-line-marker'));
    expect(items[marker].textContent).toBe('End of Jill\'s read · line 4');
    expect(items[marker - 1].dataset.line).toBe('4');
    expect(items[marker + 1].dataset.line).toBe('5');
  });

  it('scrolls to the first line read when it opens', () => {
    renderSheet({ mode: readInMode, value: RABBIT, lineRange: { start: 3, end: 4 } });

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    expect((scrollIntoView.mock.contexts[0] as HTMLElement).dataset.line).toBe('3');
  });

  it('scrolls once the lines are on screen, not while the body is still loading, and only once', () => {
    const { rerender, props } = renderSheet({ mode: readInMode, value: undefined, loading: true });
    expect(scrollIntoView).not.toHaveBeenCalled();

    rerender(<WorkshopTextSheet {...props} value={RABBIT} loading={false} lineRange={{ start: 3, end: 4 }} />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect((scrollIntoView.mock.contexts[0] as HTMLElement).closest('[hidden]')).toBeNull();

    // Back and forth between tabs keeps the writer's own scroll position.
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Source' }));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('leaves the marker out when the text no longer reaches the last line read', () => {
    renderSheet({ mode: readInMode, value: 'One line now.', lineRange: { start: 1, end: 64 } });

    expect(document.querySelector('.pm-ws-readin-line-marker')).toBeNull();
    expect(document.querySelectorAll('.pm-ws-readin-line-read')).toHaveLength(1);
  });

  it('says when the file has changed since it was read', () => {
    renderSheet({ mode: readInMode, value: RABBIT, lineRange: { start: 2, end: 4 }, changedSinceRead: true });

    expect(screen.getByRole('note').textContent)
      .toBe(' This file has changed since Jill read it. You’re seeing it as it is now.');
  });

  it('shows no banner for an unchanged file, or one whose change is unknown', () => {
    const { rerender, props } = renderSheet({ mode: readInMode, value: RABBIT, changedSinceRead: false });
    expect(screen.queryByRole('note')).toBeNull();
    rerender(<WorkshopTextSheet {...props} changedSinceRead={undefined} />);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('keeps the rendered read, as before, for a row with no line range', () => {
    renderSheet({ mode: readInMode, value: RABBIT });

    expect(screen.getByRole('tab', { name: 'Preview' }).getAttribute('aria-selected')).toBe('true');
    expect(document.querySelector('.pm-ws-readin-lines')).toBeNull();
  });

  it('moves focus to the lines, not the hidden source, when Source is chosen', () => {
    jest.useFakeTimers();
    try {
      renderSheet({ mode: readInMode, value: RABBIT, lineRange: { start: 2, end: 4 } });
      fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));
      fireEvent.click(screen.getByRole('tab', { name: 'Source' }));
      jest.runOnlyPendingTimers();
      expect(document.activeElement).toBe(screen.getByRole('region', { name: /lines 2–4 read by Jill/ }));
    } finally {
      jest.useRealTimers();
    }
  });

  it('offers "Show where it was read" only when given a way to show it', () => {
    const onShowWhereRead = jest.fn();
    const { rerender, props } = renderSheet({ mode: readInMode, value: RABBIT, onShowWhereRead });

    fireEvent.click(screen.getByRole('button', { name: 'Show where it was read' }));
    expect(onShowWhereRead).toHaveBeenCalledTimes(1);

    rerender(<WorkshopTextSheet {...props} onShowWhereRead={undefined} />);
    expect(screen.queryByRole('button', { name: 'Show where it was read' })).toBeNull();
  });
});

describe('WorkshopTextSheet — turn preview (ADR 2026-11-03 D6)', () => {
  const mode = { kind: 'turn-preview' as const, turnId: 'turn-0', requestId: 'ws-preview-1' };
  const turn = { kind: 'reply' as const, speaker: 'Jill', content: 'An older reply.', timestamp: 0 };

  it('is titled by the label it was opened with, else the speaker once the host answers', () => {
    const { rerender } = render(
      <WorkshopTextSheet open mode={{ ...mode, label: 'Jill · An older reply' }} loading onApply={jest.fn()} onClose={jest.fn()} />
    );
    expect(screen.getByRole('heading', { name: 'Jill · An older reply' })).toBeTruthy();
    expect(screen.getByText('Loading the message…')).toBeTruthy();

    rerender(<WorkshopTextSheet open mode={mode} value="An older reply." turnPreview={turn} onApply={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByRole('heading', { name: 'Jill' })).toBeTruthy();
    expect(screen.getByText(`Jill · ${formatReadInTime(0)}`)).toBeTruthy();
    expect(screen.getByText('Outside the loaded window')).toBeTruthy();
  });

  it('is read-only, and says when the reply stopped at the token limit', () => {
    render(
      <WorkshopTextSheet
        open
        mode={mode}
        value="An older reply."
        turnPreview={{ ...turn, truncated: true }}
        onApply={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: /Apply|Save/ })).toBeNull();
    expect(screen.getByText(/stopped at the max-token limit/)).toBeTruthy();
  });
});

describe('WorkshopTextSheet — a private turn\'s preview names who heard it (PR #189 N-01)', () => {
  const writer: WorkshopTurn = {
    id: 'turn-7-user-1', role: 'user', kind: 'message', participant: 'writer',
    artifact: 'direct_tool_message', toolId: 'prose', toolLabel: 'Prose',
    content: 'Why the pacing flag?', timestamp: 0, excerptVersion: 1
  };
  const reply: WorkshopTurn = {
    id: 'turn-8-assistant-1', role: 'assistant', kind: 'message', participant: 'tool',
    artifact: 'direct_tool_response', toolId: 'prose', toolLabel: 'Prose',
    content: 'Three long sentences in a row.', timestamp: 0, excerptVersion: 1
  };
  const noop = () => undefined;

  it.each([['the writer\'s message', writer], ['the instrument\'s reply', reply]])(
    'shows %s with the label its bubble shows in the window',
    (_label, turn) => {
      const bubble = render(
        <WorkshopTurnBubble turn={turn} quickActionToolId={null} onQuickAction={noop} onTalkDirectly={noop} onCopy={noop} onSave={noop} />
      );
      const inWindow = bubble.container.querySelector('.pm-ws-private-thread-label')?.textContent?.trim();
      bubble.unmount();
      expect(inWindow).toBe('Private · you + Prose');

      const preview = workshopTurnPreview(turn)!;
      expect(preview.privateWith).toBe('Prose');
      const sheet = render(
        <WorkshopTextSheet
          open
          mode={{ kind: 'turn-preview', turnId: turn.id, requestId: 'ws-preview-1' }}
          value={preview.content}
          turnPreview={preview}
          onApply={jest.fn()}
          onClose={jest.fn()}
        />
      );
      expect(sheet.container.querySelector('.pm-ws-private-thread-label')?.textContent?.trim()).toBe(inWindow);
    }
  );

  it('says nothing of privacy for a room-visible turn', () => {
    const { container } = render(
      <WorkshopTextSheet
        open
        mode={{ kind: 'turn-preview', turnId: 'turn-0', requestId: 'ws-preview-1' }}
        value="A room reply."
        turnPreview={{ kind: 'reply', speaker: 'Jill', content: 'A room reply.', timestamp: 0 }}
        onApply={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(container.querySelector('.pm-ws-private-thread-label')).toBeNull();
  });
});
