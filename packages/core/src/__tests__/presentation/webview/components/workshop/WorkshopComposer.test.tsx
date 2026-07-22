/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkshopComposer } from '@components/workshop/WorkshopComposer';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  WorkshopMessageAttachmentSnapshot
} from '@messages';

describe('WorkshopComposer', () => {
  const renderComposer = (
    overrides: Partial<React.ComponentProps<typeof WorkshopComposer>> = {}
  ) => {
    const props = {
      canMessage: true,
      hasConversation: true,
      recipientLabel: 'Choreography',
      isRunning: false,
      sessionReady: true,
      conversationBehavior: { ...DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR },
      messageAttachments: [] as WorkshopMessageAttachmentSnapshot[],
      onSend: jest.fn(),
      onCancel: jest.fn(),
      onOpenContext: jest.fn(),
      onAttachToMessage: jest.fn(),
      onRemoveMessageAttachment: jest.fn(),
      onOpenTools: jest.fn(),
      onOpenConversationSettings: jest.fn(),
      ...overrides
    };
    render(<WorkshopComposer {...props} />);
    return props;
  };

  it('sends a multiline pasted draft on Enter and clears it afterward', () => {
    const { onSend } = renderComposer();
    const composer = screen.getByRole('textbox', { name: 'Message Choreography' });
    fireEvent.change(composer, { target: { value: 'First point\nSecond point' } });
    fireEvent.keyDown(composer, { key: 'Enter' });

    expect(onSend).toHaveBeenCalledWith('First point\nSecond point');
    expect((composer as HTMLTextAreaElement).value).toBe('');
  });

  it('keeps Shift+Enter available for a newline instead of sending', () => {
    const { onSend } = renderComposer();
    const composer = screen.getByRole('textbox', { name: 'Message Choreography' });
    fireEvent.change(composer, { target: { value: 'First point\n' } });
    fireEvent.keyDown(composer, { key: 'Enter', shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
    expect((composer as HTMLTextAreaElement).value).toBe('First point\n');
  });

  it('shows the multiline keyboard hint below the text entry with Shift+Enter accented', () => {
    renderComposer();

    const hint = document.querySelector('.pm-ws-composer-hint');
    expect(hint?.textContent).toBe('Enter to send · Shift+Enter for a new line');
    // The accent span is the point: the one binding writers must learn.
    expect(hint?.querySelector('.pm-ws-hint-key')?.textContent).toBe('Shift+Enter');
    // Placement contract (composer-messaging v2): the hint is learn-once
    // chrome in the quiet zone — it FOLLOWS the text entry in document order.
    const form = document.querySelector('form.pm-ws-composer');
    expect(form && hint
      ? form.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING
      : 0).toBeTruthy();
  });

  it('shows the committed room behavior beside Tools and opens its modal', () => {
    const { onOpenConversationSettings } = renderComposer({
      conversationBehavior: {
        interactionMode: 'conversational',
        expressionLevel: 'subtle',
        relationalDepth: 'attuned',
        carryCuesThroughSession: false
      }
    });

    const behavior = screen.getByRole('button', {
      name: 'Conversation settings: Converse, subtle, Attuned'
    });
    expect(behavior.textContent).toContain('Converse');
    expect(behavior.textContent).toContain('SUBTLE');
    expect(behavior.getAttribute('title')).toContain('Attuned');
    fireEvent.click(behavior);
    expect(onOpenConversationSettings).toHaveBeenCalledTimes(1);
  });

  it('offers standing context and message attachment as two explicit menu choices (Phase 6B)', () => {
    const { onOpenContext, onAttachToMessage, onOpenTools } = renderComposer({
      recipientLabel: 'Jill'
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add context' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Add to standing context/ }));
    expect(onOpenContext).toHaveBeenCalledTimes(1);
    expect(onAttachToMessage).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Add context' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Attach to this message/ }));
    expect(onAttachToMessage).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Tools' }));
    expect(onOpenTools).toHaveBeenCalledTimes(1);
  });

  it('renders staged message attachments as removable pills with one-shot copy (Phase 6B)', () => {
    const { onRemoveMessageAttachment } = renderComposer({
      messageAttachments: [
        {
          id: 'ta-1',
          label: 'ch-04.md',
          words: 2140,
          relativePath: 'chapters/ch-04.md',
          configuredResource: { group: 'chapters', path: 'chapters/ch-04.md' }
        },
        {
          id: 'ta-2',
          label: 'notes.md',
          words: 10000,
          truncation: { keptWords: 10000, totalWords: 18240 }
        }
      ]
    });

    const pills = document.querySelectorAll('.pm-ws-comp-attachment');
    expect(pills).toHaveLength(2);
    expect(pills[0].textContent).toContain('ch-04.md');
    expect(pills[0].textContent).toContain('2,140 words');
    expect(pills[1].textContent).toContain('head slice');
    expect(document.querySelector('.pm-ws-comp-attachment-hint')?.textContent)
      .toContain('rides the next message only');

    fireEvent.click(screen.getByRole('button', { name: 'Remove ch-04.md from this message' }));
    expect(onRemoveMessageAttachment).toHaveBeenCalledWith('ta-1');
  });
});
