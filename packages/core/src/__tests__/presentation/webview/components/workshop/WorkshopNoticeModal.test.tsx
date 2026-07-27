/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WorkshopNoticeModal } from '@components/workshop/WorkshopNoticeModal';

describe('WorkshopNoticeModal', () => {
  afterEach(cleanup);

  const renderModal = () => {
    const props = { open: true, onClose: jest.fn(), onDismiss: jest.fn() };
    render(<WorkshopNoticeModal {...props} />);
    return props;
  };

  it('opens on page one of six with prev disabled', () => {
    renderModal();
    expect(screen.getByText(/1 \/ 6/)).toBeTruthy();
    expect(screen.getByText('Welcome to the Workshop beta')).toBeTruthy();
    expect(screen.getByText(/never changes project files on its own/)).toBeTruthy();
    const prev = screen.getByRole('button', { name: 'Previous notice' }) as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
  });

  it('pages with arrows and dots, disabling next on the last page', () => {
    renderModal();
    const next = screen.getByRole('button', { name: 'Next notice' }) as HTMLButtonElement;
    fireEvent.click(next);
    expect(screen.getByText(/2 \/ 6/)).toBeTruthy();
    expect(screen.getByText('Start with an open project folder')).toBeTruthy();
    expect(screen.getByText(/Prose Minion Settings/)).toBeTruthy();
    expect(screen.getByText(/individual chapter files/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Notice 6' }));
    expect(screen.getByText('Agents can work with your project')).toBeTruthy();
    expect(screen.getByText(/do not need to attach every file by hand/)).toBeTruthy();
    expect(next.disabled).toBe(true);
  });

  it('explains host choice, model guidance, conversation settings, and persona-run tools', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Notice 3' }));
    expect(screen.getByText('Choose a host, then invite guests')).toBeTruthy();
    expect(screen.getByText('Gemini 3.6 Flash')).toBeTruthy();
    expect(screen.getByText('GPT-5.6 Terra')).toBeTruthy();
    expect(screen.getByText('GPT-5.6 Sol')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Notice 4' }));
    expect(screen.getByText(/Conversation Controller/)).toBeTruthy();
    expect(screen.getByText(/About you/)).toBeTruthy();
    expect(screen.getByText(/clickable citation pill/)).toBeTruthy();
    expect(screen.getByText(/do not apply to direct instrument threads/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Notice 5' }));
    expect(screen.getByText('Tools — run them directly, or ask a persona')).toBeTruthy();
    expect(screen.getByText(/specific line, variation, or question/)).toBeTruthy();
  });

  it('dismisses WITHOUT recording when the checkbox is unchecked', () => {
    const { onDismiss } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledWith(false);
  });

  it('dismisses WITH recording when "Don\'t show again" is checked', () => {
    const { onDismiss } = renderModal();
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(checkbox.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledWith(true);
  });

  it('plain close invokes onClose and never records a dismissal', () => {
    const { onClose, onDismiss } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Close notices' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
