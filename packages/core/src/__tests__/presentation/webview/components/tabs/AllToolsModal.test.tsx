/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AllToolsModal } from '@components/tabs/AllToolsModal';

describe('AllToolsModal Craft Steering', () => {
  afterEach(cleanup);

  const renderModal = (disabled = false) => {
    const props = {
      open: true,
      disabled,
      onClose: jest.fn(),
      onDialogue: jest.fn(),
      onProse: jest.fn(),
      onWritingTool: jest.fn()
    };
    render(<AllToolsModal {...props} />);
    return props;
  };

  it('launches Craft Steering from the sidebar picker and closes it', () => {
    const { onWritingTool, onDialogue, onProse, onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /Craft Steering/ }));

    expect(onWritingTool).toHaveBeenCalledTimes(1);
    expect(onWritingTool).toHaveBeenCalledWith('craft-steering');
    expect(onDialogue).not.toHaveBeenCalled();
    expect(onProse).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('requires an excerpt before launching Craft Steering', () => {
    const { onWritingTool, onClose } = renderModal(true);
    const card = screen.getByRole('button', { name: /Craft Steering/ }) as HTMLButtonElement;
    expect(card.disabled).toBe(true);
    expect(card.title).toBe('Add an excerpt first');
    fireEvent.click(card);

    expect(onWritingTool).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
