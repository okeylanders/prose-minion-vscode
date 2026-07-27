/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { WorkshopNoticeModal } from '@components/workshop/WorkshopNoticeModal';
import { WORKSHOP_NOTICE_SHOTS } from '@shared/constants/workshopNotices';

describe('WorkshopNoticeModal', () => {
  afterEach(() => {
    cleanup();
    delete window.proseMinonAssets;
  });

  const renderModal = () => {
    const props = { open: true, onClose: jest.fn(), onDismiss: jest.fn() };
    render(<WorkshopNoticeModal {...props} />);
    return props;
  };

  /** The copy column — where the page prose lives, as opposed to the legend. */
  const copy = () => document.querySelector('.pm-ws-notice-page') as HTMLElement;
  /** The media well's legend, which repeats the control names as call-outs. */
  const legend = () => document.querySelector('.pm-ws-notice-legend') as HTMLElement;

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
    expect(within(copy()).getByText(/Prose Minion Settings/)).toBeTruthy();
    expect(within(copy()).getByText(/individual chapter files/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Notice 6' }));
    expect(screen.getByText('Agents can work with your project')).toBeTruthy();
    expect(screen.getByText(/do not need to attach every file by hand/)).toBeTruthy();
    expect(next.disabled).toBe(true);
  });

  it('explains host choice, model guidance, conversation settings, and persona-run tools', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Notice 3' }));
    expect(screen.getByText('Choose a host, then invite guests')).toBeTruthy();
    expect(within(copy()).getByText('Gemini 3.6 Flash')).toBeTruthy();
    expect(within(copy()).getByText('GPT-5.6 Terra')).toBeTruthy();
    expect(within(copy()).getByText('GPT-5.6 Sol')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Notice 4' }));
    expect(within(copy()).getByText(/Conversation Controller/)).toBeTruthy();
    expect(within(copy()).getByText(/About you/)).toBeTruthy();
    expect(within(copy()).getByText(/clickable citation pill/)).toBeTruthy();
    expect(within(copy()).getByText(/do not apply to direct instrument threads/)).toBeTruthy();
    /* The web-research privacy disclosure is shipped copy the comp omits; it
       must survive a design re-pull. */
    expect(within(copy()).getByText(/comfortable sharing/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Notice 5' }));
    expect(screen.getByText('Tools — run them directly, or ask a persona')).toBeTruthy();
    expect(within(copy()).getByText(/specific line, variation, or question/)).toBeTruthy();
  });

  describe('annotated screenshots', () => {
    it('renders the host-resolved screenshot URIs with alt text', () => {
      window.proseMinonAssets = {
        noticeShots: Object.fromEntries(
          WORKSHOP_NOTICE_SHOTS.map((name) => [name, `https://webview.test/${name}.png`])
        )
      };
      renderModal();

      const shots = screen.getAllByRole('img') as HTMLImageElement[];
      expect(shots.length).toBeGreaterThan(0);
      expect(shots.map((img) => img.getAttribute('src'))).toContain(
        'https://webview.test/header-cluster.png'
      );
      /* Every screenshot describes itself — the call-out boxes are decorative. */
      shots.forEach((img) => expect(img.getAttribute('alt')).toBeTruthy());
    });

    it('renders one call-out per legend row, positioned in percentages', () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Notice 3' }));

      const callouts = Array.from(document.querySelectorAll('.pm-ws-notice-callout'));
      expect(callouts).toHaveLength(4);
      expect(callouts.map((node) => node.textContent)).toEqual(['1', '2', '3', '4']);
      expect((callouts[0] as HTMLElement).style.left).toBe('6.4%');
      expect((callouts[0] as HTMLElement).style.width).toBe('18.9%');
      /* Decorative: the legend below the well carries the meaning. */
      callouts.forEach((node) => expect(node.getAttribute('aria-hidden')).toBe('true'));

      const rows = within(legend()).getAllByRole('listitem');
      expect(rows).toHaveLength(4);
      expect(rows[3].textContent).toContain('Invite guest');
    });

    it('survives a host that never stamped the screenshots', () => {
      renderModal();
      const shots = screen.getAllByRole('img') as HTMLImageElement[];
      expect(shots.length).toBeGreaterThan(0);
      shots.forEach((img) => expect(img.getAttribute('src')).toBe(''));
      /* The tour still pages — a missing asset costs a picture, not the box. */
      fireEvent.click(screen.getByRole('button', { name: 'Notice 4' }));
      expect(screen.getByText("Set the room's conversation style")).toBeTruthy();
    });

    it('shows the Conversation Controller tabs as three captioned thumbnails', () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Notice 4' }));

      const captions = Array.from(document.querySelectorAll('.pm-ws-notice-thumb figcaption'));
      expect(captions.map((node) => node.textContent)).toEqual([
        'Behavior',
        'About you',
        'Advanced'
      ]);
    });
  });

  describe('project-configuration guide', () => {
    it('is reachable from the setup notice and returns to the same page', () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Notice 2' }));

      fireEvent.click(screen.getByRole('button', { name: /How to configure your project/ }));

      const guide = screen.getByRole('dialog', { name: 'How to configure your project' });
      expect(within(guide).getByText(/never guesses at your folder layout/)).toBeTruthy();
      /* Full-surface: the notice steps aside rather than stacking. */
      expect(screen.queryByText('Start with an open project folder')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: /Back to the tour/ }));
      expect(screen.getByText(/2 \/ 6/)).toBeTruthy();
      expect(screen.getByText('Start with an open project folder')).toBeTruthy();
    });

    it('is reachable from the agents notice too', () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Notice 6' }));

      fireEvent.click(screen.getByRole('button', { name: /Project Resource Locations/ }));

      expect(screen.getByRole('dialog', { name: 'How to configure your project' })).toBeTruthy();
    });

    it('keeps "Don\'t show again" checked across a trip through the guide', () => {
      const { onDismiss } = renderModal();
      fireEvent.click(screen.getByRole('checkbox'));
      fireEvent.click(screen.getByRole('button', { name: 'Notice 2' }));

      fireEvent.click(screen.getByRole('button', { name: /How to configure your project/ }));
      fireEvent.click(screen.getByRole('button', { name: /Back to the tour/ }));

      expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('true');
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
      expect(onDismiss).toHaveBeenCalledWith(true);
    });

    it('closes on Escape without touching the notice dismissal', () => {
      const { onClose, onDismiss } = renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Notice 2' }));
      fireEvent.click(screen.getByRole('button', { name: /How to configure your project/ }));

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(screen.queryByRole('dialog', { name: 'How to configure your project' })).toBeNull();
      expect(screen.getByText('Start with an open project folder')).toBeTruthy();
      expect(onClose).not.toHaveBeenCalled();
      expect(onDismiss).not.toHaveBeenCalled();
    });
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
