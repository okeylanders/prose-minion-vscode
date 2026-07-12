/** @jest-environment jsdom */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ContextBriefPanel } from '@components/workshop/ContextBriefPanel';

describe('ContextBriefPanel', () => {
  it('shows the persisted brief and its pending-delivery state', () => {
    render(
      <ContextBriefPanel
        value="Mara is hiding her identity."
        pendingDelivery
        onSave={jest.fn()}
      />
    );

    expect(screen.getByLabelText<HTMLTextAreaElement>('Workshop context brief').value)
      .toBe('Mara is hiding her identity.');
    expect(screen.getByText('5 / 10,000 words')).toBeTruthy();
    expect(screen.getByText('Shared with your next host message.')).toBeTruthy();
  });

  it('warns honestly above the prompt budget and saves the full session brief', () => {
    const onSave = jest.fn();
    const longBrief = Array.from({ length: 10_001 }, (_, index) => `word${index}`).join(' ');
    render(<ContextBriefPanel value="" pendingDelivery={false} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText('Workshop context brief'), {
      target: { value: longBrief }
    });
    expect(screen.getByText(/will receive the first 10,000 words/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save brief' }));
    expect(onSave).toHaveBeenCalledWith(longBrief);
  });

  it('clears through the typed empty-brief route', () => {
    const onSave = jest.fn();
    render(<ContextBriefPanel value="Existing brief" pendingDelivery={false} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(onSave).toHaveBeenCalledWith(undefined);
  });

  it('preserves keystrokes typed while a saved value is round-tripping', () => {
    const onSave = jest.fn();
    const { rerender } = render(
      <ContextBriefPanel value="" pendingDelivery={false} onSave={onSave} />
    );
    const textarea = screen.getByLabelText<HTMLTextAreaElement>('Workshop context brief');

    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save brief' }));
    fireEvent.change(textarea, { target: { value: 'Hello world' } });
    rerender(
      <ContextBriefPanel value="Hello" pendingDelivery={false} onSave={onSave} />
    );

    expect(textarea.value).toBe('Hello world');
  });
});
