/** @jest-environment jsdom */

/**
 * "Rename board…" (Lightbox Slice 5A.2): the name sheet, in the Workshop's
 * Save-session frame. It starts from the board's name and follows the host's
 * name until the writer types (PR #164 F-04); Rename and Enter send only an
 * edit, checked by the one name rule; Cancel, Escape and the close button
 * send nothing. Its path note names the board's file, or says the name waits
 * for the board's next save; session-only, that the name lasts the session.
 * Names are made up.
 */

import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { LightboxBoardNameModal, type LightboxBoardNameModalProps } from '@components/lightbox/LightboxBoardNameModal';
import { LIGHTBOX_BOARD_NAME_FAULTS } from '@shared/constants/lightboxBoardName';
import { __resetOverlayFocusStateForTests } from '@hooks/useOverlayDismiss';

const FILE = 'drafts-alice-1-md-9b099095/2026-10-23T14-08-00-000Z.board.json';
const NAME = 'alice-1 - 10/23/2026 2:08 PM';

function renderSheet(overrides: Partial<LightboxBoardNameModalProps> = {}) {
  const props: LightboxBoardNameModalProps = {
    open: true, name: NAME, fileId: FILE, sessionOnly: false, onRename: jest.fn(), onClose: jest.fn(), ...overrides
  };
  const view = render(<LightboxBoardNameModal {...props} />);
  return { props, rerender: (next: Partial<LightboxBoardNameModalProps>) => view.rerender(<LightboxBoardNameModal {...props} {...next} />) };
}
const field = () => screen.getByRole('textbox', { name: 'Board name' }) as HTMLInputElement;

beforeEach(() => {
  __resetOverlayFocusStateForTests();
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('LightboxBoardNameModal', () => {
  it('starts from the board\'s name, focused and selected, and names its file', () => {
    renderSheet();
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(screen.getByRole('dialog', { name: 'Rename board' })).not.toBeNull();
    expect(field().value).toBe(NAME);
    expect(field().maxLength).toBe(120);
    expect(document.activeElement).toBe(field());
    expect(screen.getByText(FILE).closest('span')?.textContent).toBe(`prose-minion/boards/${FILE}`);
  });

  it('renames with Enter or Rename, trimmed, then closes', () => {
    const { props } = renderSheet();
    fireEvent.change(field(), { target: { value: '  3.2.1 - after the cut - model B ' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(props.onRename).toHaveBeenCalledWith('3.2.1 - after the cut - model B');
    expect(props.onClose).toHaveBeenCalledTimes(1);

    const second = renderSheet({ name: 'model A' });
    fireEvent.change(screen.getAllByRole('textbox', { name: 'Board name' })[1], { target: { value: 'model C' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Rename' })[1]);
    expect(second.props.onRename).toHaveBeenCalledWith('model C');
  });

  it('sends nothing for an untouched name, or one back to the name standing now, and follows the host until the writer types (PR #164 F-04)', () => {
    const { props, rerender } = renderSheet();
    // The answer to an earlier rename lands while the sheet is open.
    rerender({ name: 'model A' });
    expect(field().value).toBe('model A');
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    expect(props.onRename).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalledTimes(1);

    fireEvent.change(field(), { target: { value: 'model A ' } });
    rerender({ name: 'model B' });
    expect(field().value).toBe('model A ');
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(props.onRename).toHaveBeenCalledWith('model A');
  });

  it('keeps a name the rule refuses, with the rule\'s words, and sends nothing', () => {
    const { props } = renderSheet();
    fireEvent.change(field(), { target: { value: '3.2.1\tafter the cut' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(screen.getByRole('alert').textContent).toBe(LIGHTBOX_BOARD_NAME_FAULTS['not-one-line']);
    expect(field().getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(field(), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    expect(screen.getByRole('alert').textContent).toBe('A board needs a name. Cancel keeps the one it has.');
    expect(props.onRename).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('closes on Cancel, Escape and the close button, sending nothing', () => {
    const { props } = renderSheet();
    fireEvent.change(field(), { target: { value: 'model D' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Close Rename board' }));
    expect(props.onClose).toHaveBeenCalledTimes(3);
    expect(props.onRename).not.toHaveBeenCalled();
  });

  it('says a board no file holds yet takes the name with its next save, and that a session-only name lasts the session', () => {
    renderSheet({ fileId: undefined, name: '' });
    expect(screen.getByText(/Not in a saved file yet/)).not.toBeNull();
    expect(field().value).toBe('');

    renderSheet({ fileId: undefined, sessionOnly: true });
    expect(screen.getByRole('status').textContent).toContain('the name lasts as long as the session');
    expect(screen.getByText('Not saved: no single folder is open.')).not.toBeNull();
  });
});
