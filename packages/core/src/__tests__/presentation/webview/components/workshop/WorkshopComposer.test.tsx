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

  it('shows the multiline keyboard hint', () => {
    renderComposer();

    expect(screen.getByText('Enter to send · Shift+Enter for a new line')).not.toBeNull();
  });
});
