/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkshopInviteGuestModal } from '@components/workshop/WorkshopInviteGuestModal';
import { defaultWorkshopGuestOpening } from '@shared/constants/workshopPersonas';

describe('WorkshopInviteGuestModal', () => {
  const renderModal = (overrides: Partial<React.ComponentProps<typeof WorkshopInviteGuestModal>> = {}) => {
    const onInvite = jest.fn();
    const onClose = jest.fn();
    render(
      <WorkshopInviteGuestModal
        open
        hostPersonaId="jill"
        livePersonaGuestIds={[]}
        onClose={onClose}
        onInvite={onInvite}
        {...overrides}
      />
    );
    return { onInvite, onClose };
  };

  const launchButton = () =>
    screen.getByRole('button', { name: /Read in |Select a persona/ }) as HTMLButtonElement;

  it('selects a card without inviting; the footer owns the commit', () => {
    const { onInvite } = renderModal();

    expect(launchButton().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /^Felix/ }));

    // Selection made no provider call and the modal stays open.
    expect(onInvite).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).not.toBeNull();
    expect(screen.getByRole('button', { name: /^Felix/ }).getAttribute('aria-pressed')).toBe('true');

    const launch = launchButton();
    expect(launch.textContent).toContain('Read in Felix');
    expect(launch.disabled).toBe(false);
  });

  it('locks the host and live guests with a stated reason', () => {
    const { onInvite } = renderModal({ livePersonaGuestIds: ['felix'] });

    const hostCard = screen.getByRole('button', { name: /^Jill/ });
    expect(hostCard.getAttribute('aria-disabled')).toBe('true');
    expect(hostCard.textContent).toContain('Host');
    expect(hostCard.getAttribute('title')).toContain('hosting this room');

    const guestCard = screen.getByRole('button', { name: /^Felix/ });
    expect(guestCard.getAttribute('aria-disabled')).toBe('true');
    expect(guestCard.textContent).toContain('In the room');

    fireEvent.click(hostCard);
    fireEvent.click(guestCard);
    expect(onInvite).not.toHaveBeenCalled();
    expect(launchButton().disabled).toBe(true);
  });

  it('states room capacity on otherwise-eligible cards when the room is full', () => {
    renderModal({ livePersonaGuestIds: ['felix', 'margot'] });

    const card = screen.getByRole('button', { name: /^Wren/ });
    expect(card.getAttribute('aria-disabled')).toBe('true');
    expect(card.textContent).toContain('Room full');
    fireEvent.click(card);
    expect(launchButton().disabled).toBe(true);
  });

  it('rewrites an untouched default per persona and never overwrites writer edits', () => {
    renderModal();
    const opening = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(opening.value).toBe(defaultWorkshopGuestOpening());
    expect(opening.value).not.toMatch(/excerpt/i);

    fireEvent.click(screen.getByRole('button', { name: /^Felix/ }));
    expect(opening.value).toBe(defaultWorkshopGuestOpening('felix'));
    expect(opening.value).toContain('Felix');
    expect(opening.value).not.toMatch(/excerpt/i);

    fireEvent.change(opening, { target: { value: 'Felix, sing me the paragraph rhythm.' } });
    fireEvent.click(screen.getByRole('button', { name: /^Margot/ }));
    expect(opening.value).toBe('Felix, sing me the paragraph rhythm.');
  });

  it('flags the default opening and flips to Personalized once edited', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /^Felix/ }));
    expect(screen.getByRole('button', { name: 'Default message' })).not.toBeNull();

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Felix, read the beats out loud.' }
    });
    expect(screen.queryByRole('button', { name: 'Default message' })).toBeNull();
    expect(screen.getByText('Personalized')).not.toBeNull();
  });

  it('soft-confirms an untouched default: first press arms an announced hint, second invites', () => {
    const { onInvite } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /^Felix/ }));

    fireEvent.click(launchButton());
    expect(onInvite).not.toHaveBeenCalled();
    // The hint's announcement contract, not just its text (review #18): the
    // instruction must live in a `role="status"` region.
    const statusRegions = screen.getAllByRole('status');
    expect(statusRegions.some((region) =>
      /sending the default opening/.test(region.textContent ?? '')
    )).toBe(true);

    fireEvent.click(launchButton());
    expect(onInvite).toHaveBeenCalledTimes(1);
    expect(onInvite).toHaveBeenCalledWith('felix', defaultWorkshopGuestOpening('felix'));
  });

  it('still treats text typed back to the exact default as boilerplate (review #4)', () => {
    const { onInvite } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /^Felix/ }));
    const opening = screen.getByRole('textbox') as HTMLTextAreaElement;

    // One keystroke and a backspace: the box again holds the literal default.
    fireEvent.change(opening, { target: { value: `${defaultWorkshopGuestOpening('felix')}x` } });
    fireEvent.change(opening, { target: { value: defaultWorkshopGuestOpening('felix') } });

    expect(screen.getByRole('button', { name: 'Default message' })).not.toBeNull();
    fireEvent.click(launchButton());
    expect(onInvite).not.toHaveBeenCalled();
    fireEvent.click(launchButton());
    expect(onInvite).toHaveBeenCalledWith('felix', defaultWorkshopGuestOpening('felix'));
  });

  it('clears a selection whose card becomes locked before launch (review #9)', () => {
    const onInvite = jest.fn();
    const props = {
      open: true,
      hostPersonaId: 'jill' as const,
      onClose: jest.fn(),
      onInvite
    };
    const { rerender } = render(
      <WorkshopInviteGuestModal {...props} livePersonaGuestIds={[]} />
    );
    fireEvent.click(screen.getByRole('button', { name: /^Felix/ }));
    expect(launchButton().textContent).toContain('Read in Felix');

    // Felix joins the room out from under the open modal.
    rerender(<WorkshopInviteGuestModal {...props} livePersonaGuestIds={['felix']} />);

    const launch = launchButton();
    expect(launch.textContent).toContain('Select a persona');
    expect(launch.disabled).toBe(true);
    fireEvent.click(launch);
    expect(onInvite).not.toHaveBeenCalled();
  });

  it('disarms the soft confirm on any edit and invites a personalized opening in one press', () => {
    const { onInvite } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /^Felix/ }));
    fireEvent.click(launchButton());

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Felix, where does the tempo drag?' }
    });
    expect(screen.queryByText(/sending the default opening/)).toBeNull();

    fireEvent.click(launchButton());
    expect(onInvite).toHaveBeenCalledTimes(1);
    expect(onInvite).toHaveBeenCalledWith('felix', 'Felix, where does the tempo drag?');
  });

  it('never invites with an empty opening', () => {
    const { onInvite } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /^Felix/ }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });

    expect(launchButton().disabled).toBe(true);
    fireEvent.click(launchButton());
    expect(onInvite).not.toHaveBeenCalled();
  });

  it('closes on Escape, discarding the selection', () => {
    const { onClose, onInvite } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /^Felix/ }));
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
    expect(onInvite).not.toHaveBeenCalled();
  });

  it('keeps More info a separate control that never changes selection', () => {
    const onMoreInfo = jest.fn();
    renderModal({ onMoreInfo });

    fireEvent.click(screen.getByRole('button', { name: 'More info about Felix' }));
    expect(onMoreInfo).toHaveBeenCalledWith('felix');
    expect(screen.getByRole('button', { name: /^Felix/ }).getAttribute('aria-pressed')).toBe('false');
    expect(launchButton().disabled).toBe(true);
  });
});
