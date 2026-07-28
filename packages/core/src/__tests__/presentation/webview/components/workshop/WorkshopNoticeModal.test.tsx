/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { WorkshopNoticeModal } from '@components/workshop/WorkshopNoticeModal';
import { WORKSHOP_NOTICE_SHOTS } from '@shared/constants/workshopNotices';
import { __resetOverlayFocusStateForTests } from '@hooks/useOverlayDismiss';

describe('WorkshopNoticeModal', () => {
  afterEach(() => {
    cleanup();
    delete window.proseMinionAssets;
    __resetOverlayFocusStateForTests();
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
      window.proseMinionAssets = {
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

    /**
     * Deliberate deviation from the comp, fenced so a design re-pull cannot
     * "correct" it back (PR #94 review, Bria). The comp sizes these two shots
     * 216/400px, at which they do not both fit the media well — and this page
     * points at two SEPARATE places, so pushing the second below a scroll is
     * the one outcome the pictures exist to prevent.
     */
    it('keeps the setup page narrow enough that both shots fit without scrolling', () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Notice 2' }));

      const figures = Array.from(
        document.querySelectorAll('.pm-ws-notice-figure')
      ) as HTMLElement[];
      expect(figures.map((figure) => figure.style.maxWidth)).toEqual(['180px', '340px']);

      /* The declared ratios are what turn those widths into heights — the
         cropped shot has an absolutely-positioned image and would otherwise
         collapse to nothing. 180×(1217/797) + 340×(446/882) ≈ 447px, inside the
         well's 470px cap. */
      expect(figures.map((figure) => figure.style.getPropertyValue('--pm-notice-ratio'))).toEqual([
        '797 / 1217',
        '882 / 446'
      ]);
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

    it('is reachable from the agents notice and returns to the LAST page', () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Notice 6' }));

      fireEvent.click(screen.getByRole('button', { name: /Project Resource Locations/ }));
      expect(screen.getByRole('dialog', { name: 'How to configure your project' })).toBeTruthy();

      /* The boundary page is where an index-reset or PAGES.length - 1 off-by-one
         hides while passing on an interior page (PR #94 review, Cal). */
      fireEvent.click(screen.getByRole('button', { name: /Back to the tour/ }));
      expect(screen.getByText(/6 \/ 6/)).toBeTruthy();
      expect(screen.getByText('Agents can work with your project')).toBeTruthy();
      const next = screen.getByRole('button', { name: 'Next notice' }) as HTMLButtonElement;
      expect(next.disabled).toBe(true);
    });

    /**
     * The guide-link sentence had a "Locations ." spacing bug that only a
     * full-textContent assertion catches — a loose regex on the button name
     * passes either way (PR #94 review, Cal/Parker).
     */
    it('renders the guide-link sentences with correct spacing and punctuation', () => {
      renderModal();

      fireEvent.click(screen.getByRole('button', { name: 'Notice 2' }));
      expect(document.querySelector('.pm-ws-notice-guide-note')?.textContent).toBe(
        'Then follow How to configure your project for the whole walkthrough.'
      );

      fireEvent.click(screen.getByRole('button', { name: 'Notice 6' }));
      expect(document.querySelector('.pm-ws-notice-guide-note')?.textContent).toBe(
        'Project-file reading depends on the paths set in Project Resource Locations.'
      );
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

    /**
     * The notice shell and the guide each manage focus. React flushes every
     * effect cleanup before any setup, so the closing overlay used to hand page
     * focus back before the opening one captured it — focus visibly left the
     * dialog on each trip and the return target was corrupted (PR #94 review,
     * Sam). Focus must stay inside the overlays for the whole round trip, and
     * come back to the real opener only at the end.
     */
    it('never hands focus back to the page mid-handoff', async () => {
      const opener = document.createElement('button');
      opener.textContent = 'Open the Workshop';
      document.body.appendChild(opener);
      opener.focus();
      const openerFocus = jest.spyOn(opener, 'focus');

      const { unmount } = render(
        <WorkshopNoticeModal open onClose={jest.fn()} onDismiss={jest.fn()} />
      );
      fireEvent.click(screen.getByRole('button', { name: 'Notice 2' }));

      fireEvent.click(screen.getByRole('button', { name: /How to configure your project/ }));
      await Promise.resolve();
      expect(openerFocus).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /Back to the tour/ }));

      fireEvent.click(screen.getByRole('button', { name: /Back to the tour/ }));
      await Promise.resolve();
      expect(openerFocus).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close notices' }));

      /* Only when the last overlay goes away does the page get focus back. */
      unmount();
      await Promise.resolve();
      expect(openerFocus).toHaveBeenCalledTimes(1);

      opener.remove();
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
