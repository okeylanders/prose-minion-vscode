/**
 * @jest-environment jsdom
 */

/**
 * `focusAfterOverlaysClose` (PR #187 F-01): an action that closes the last
 * overlay can send focus somewhere on purpose, and the opener restore yields
 * to it. A destination that takes no focus leaves the opener restore to run,
 * and an ordinary close is unchanged.
 */

import * as React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  __resetOverlayFocusStateForTests,
  focusAfterOverlaysClose,
  useOverlayDismiss
} from '@hooks/useOverlayDismiss';

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const Page: React.FC<{ destination?: () => boolean }> = ({ destination }) => {
  const [open, setOpen] = React.useState(false);
  const close = () => setOpen(false);
  const closeButtonRef = useOverlayDismiss({ open, onClose: close });
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Opener</button>
      <button type="button" tabIndex={-1}>Destination</button>
      {open ? (
        <div role="dialog" aria-label="Sheet">
          <button type="button" ref={closeButtonRef} onClick={close}>Close</button>
          <button
            type="button"
            onClick={() => {
              if (destination) {
                focusAfterOverlaysClose(destination);
              }
              close();
            }}
          >
            Go
          </button>
        </div>
      ) : null}
    </>
  );
};

const settle = () => act(async () => {
  await Promise.resolve();
  await Promise.resolve();
});

describe('focusAfterOverlaysClose', () => {
  afterEach(() => {
    cleanup();
    __resetOverlayFocusStateForTests();
  });

  const openFromOpener = async () => {
    const opener = screen.getByRole('button', { name: 'Opener' });
    opener.focus();
    fireEvent.click(opener);
    await settle();
    return opener;
  };

  it('sends focus to the destination instead of the opener', async () => {
    const destination = jest.fn(() => {
      screen.getByRole('button', { name: 'Destination' }).focus();
      return true;
    });
    render(<Page destination={destination} />);
    await openFromOpener();

    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    await settle();

    expect(destination).toHaveBeenCalledTimes(1);
    // It ran after the overlay was gone.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Destination' }));
  });

  it('restores the opener when the destination takes no focus', async () => {
    const destination = jest.fn(() => false);
    render(<Page destination={destination} />);
    const opener = await openFromOpener();

    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    await settle();

    expect(destination).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(opener);
  });

  it('runs once: a later ordinary close restores the opener', async () => {
    const destination = jest.fn(() => {
      screen.getByRole('button', { name: 'Destination' }).focus();
      return true;
    });
    render(<Page destination={destination} />);
    await openFromOpener();
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    await settle();

    const opener = await openFromOpener();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await settle();

    expect(destination).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(opener);
  });

  it('runs at once when no overlay is open', () => {
    const destination = jest.fn(() => true);
    focusAfterOverlaysClose(destination);
    expect(destination).toHaveBeenCalledTimes(1);
  });
});
