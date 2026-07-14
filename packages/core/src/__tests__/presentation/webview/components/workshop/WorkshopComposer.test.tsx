/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkshopComposer } from '@components/workshop/WorkshopComposer';

describe('WorkshopComposer', () => {
  const renderComposer = (onSend = jest.fn()) => {
    render(
      <WorkshopComposer
        canMessage
        hasConversation
        recipientLabel="Choreography"
        isRunning={false}
        sessionReady
        onSend={onSend}
        onCancel={jest.fn()}
        onOpenContext={jest.fn()}
        onOpenTools={jest.fn()}
      />
    );
    return onSend;
  };

  it('sends a multiline pasted draft on Enter and clears it afterward', () => {
    const onSend = renderComposer();
    const composer = screen.getByRole('textbox', { name: 'Message Choreography' });
    fireEvent.change(composer, { target: { value: 'First point\nSecond point' } });
    fireEvent.keyDown(composer, { key: 'Enter' });

    expect(onSend).toHaveBeenCalledWith('First point\nSecond point');
    expect((composer as HTMLTextAreaElement).value).toBe('');
  });

  it('keeps Shift+Enter available for a newline instead of sending', () => {
    const onSend = renderComposer();
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

  it('keeps context and tool browsing on separate explicit buttons', () => {
    const onOpenContext = jest.fn();
    const onOpenTools = jest.fn();
    render(
      <WorkshopComposer
        canMessage
        hasConversation
        recipientLabel="Jill"
        isRunning={false}
        sessionReady
        onSend={jest.fn()}
        onCancel={jest.fn()}
        onOpenContext={onOpenContext}
        onOpenTools={onOpenTools}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add project context' }));
    expect(onOpenContext).toHaveBeenCalledTimes(1);
    expect(onOpenTools).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Tools' }));
    expect(onOpenTools).toHaveBeenCalledTimes(1);
  });
});
