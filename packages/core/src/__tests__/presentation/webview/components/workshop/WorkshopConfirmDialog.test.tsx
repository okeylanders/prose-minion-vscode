/** @jest-environment jsdom */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkshopConfirmDialog } from '@components/workshop/WorkshopConfirmDialog';

const renderDialog = (
  overrides: Partial<React.ComponentProps<typeof WorkshopConfirmDialog>> = {}
) => {
  const props: React.ComponentProps<typeof WorkshopConfirmDialog> = {
    open: true,
    title: 'Start a new session?',
    body: 'The pinned excerpt and standing context stay; the thread resets.',
    confirmLabel: 'New session',
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
    ...overrides
  };
  render(<WorkshopConfirmDialog {...props} />);
  return props;
};

describe('WorkshopConfirmDialog', () => {
  it('renders nothing while closed', () => {
    renderDialog({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('confirms the state-replacing action', () => {
    const props = renderDialog();
    expect(screen.getByRole('heading', { name: 'Start a new session?' })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'New session' }));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  it('cancels from the Cancel button and Escape', () => {
    const props = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(props.onCancel).toHaveBeenCalledTimes(2);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });
});
