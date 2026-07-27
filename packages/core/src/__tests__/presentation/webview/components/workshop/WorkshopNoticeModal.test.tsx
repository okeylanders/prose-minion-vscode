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
    expect(screen.getByText('Welcome — this is a Beta experience')).toBeTruthy();
    const prev = screen.getByRole('button', { name: 'Previous notice' }) as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
  });

  it('pages with arrows and dots, disabling next on the last page', () => {
    renderModal();
    const next = screen.getByRole('button', { name: 'Next notice' }) as HTMLButtonElement;
    fireEvent.click(next);
    expect(screen.getByText(/2 \/ 6/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Notice 6' }));
    expect(screen.getByText('Agents can do real work')).toBeTruthy();
    expect(next.disabled).toBe(true);
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
