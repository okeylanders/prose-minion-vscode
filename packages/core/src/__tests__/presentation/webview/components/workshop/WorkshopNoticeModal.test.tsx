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

  it('opens on the newest notice, page one of thirteen, with prev disabled', () => {
    renderModal();
    expect(screen.getByText(/1 \/ 13/)).toBeTruthy();
    expect(screen.getByText('New: export a conversation')).toBeTruthy();
    const prev = screen.getByRole('button', { name: 'Previous notice' }) as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
  });

  /* ADR 2026-09-30, Sprint 03 kickoff decision 5: the release's new pages lead. */
  it('introduces transcript export first: three formats, saved under prose-minion/exports', () => {
    renderModal();

    expect(screen.getByText(/1 \/ 13/).parentElement?.textContent).toBe('1 / 13 · new');
    expect(within(copy()).getByText('Sessions → Export…')).toBeTruthy();
    expect(within(copy()).getByText('Markdown')).toBeTruthy();
    expect(within(copy()).getByText('JSON')).toBeTruthy();
    expect(within(copy()).getByText('styled HTML')).toBeTruthy();
    expect(within(copy()).getByText(/older turns the thread no longer shows/)).toBeTruthy();
    expect(within(copy()).getByText('prose-minion/exports/')).toBeTruthy();
    expect(within(copy()).getByText(/an earlier export is never replaced/)).toBeTruthy();
    /* What an export omits mirrors the dialog's own disclosure. */
    expect(document.querySelector('.pm-ws-notice-note')?.textContent).toBe(
      'Exports leave out the excerpt text, context and attachment contents, widget payloads, ' +
      'tool evidence, and token usage. Attachments and widgets appear by name only.'
    );

    const callouts = Array.from(document.querySelectorAll('.pm-ws-notice-callout'));
    expect(callouts.map((node) => node.textContent)).toEqual(['1', '2', '3', '4']);
    expect(within(legend()).getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      '1Sessions menu — opens from the session name in the header.',
      '2Export… — saves this conversation as a file.',
      '3Format — Markdown, JSON, or styled HTML.',
      '4prose-minion/exports/ — where the file lands; an earlier export is never replaced.'
    ]);
  });

  it('introduces session recall second as reading saved records, with the upgrade warning', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Notice 2' }));

    expect(screen.getByText(/2 \/ 13/).parentElement?.textContent).toBe('2 / 13 · new');
    expect(screen.getByText('New: personas can read your saved sessions')).toBeTruthy();
    expect(within(copy()).getByText(/other sessions you’ve saved by\s+name in this project/)).toBeTruthy();
    expect(within(copy()).getByText(/list and search those sessions, read the turns that matter/)).toBeTruthy();
    expect(within(copy()).getByText('Session Recall')).toBeTruthy();
    /* Recall reads saved records; the copy must not promise memory. */
    expect(within(copy()).getByText(/reading saved records, not\s+remembering/)).toBeTruthy();
    expect(within(copy()).getByText(/check the cited turns/)).toBeTruthy();
    expect(within(copy()).queryByText(/remembers/)).toBeNull();
    expect(document.querySelector('.pm-ws-notice-note')?.textContent).toBe(
      'Updating: sessions that contain recall activity can’t be opened by earlier versions of ' +
      'Prose Minion. If you sync sessions through Git, update every machine first. Also fixed: ' +
      'adding a guest persona’s finding to the To-do List no longer stops the session from saving.'
    );

    const callouts = Array.from(document.querySelectorAll('.pm-ws-notice-callout'));
    expect(callouts.map((node) => node.textContent)).toEqual(['1', '2']);
    expect(within(legend()).getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      '1Session Recall — what a persona looked up, and in which saved session.',
      '2Citation — the reply names the session and turns, so you can check them.'
    ]);
  });

  /* The tour is the writer's full guide: earlier releases' pages stay on as primers. */
  it('keeps Craft Steering as a primer, pointing at Tools and its Craft & Voice card', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Notice 6' }));

    expect(screen.getByText(/6 \/ 13/).parentElement?.textContent).toBe('6 / 13 · primer');
    expect(screen.getByText('Craft Steering', { selector: 'h2' })).toBeTruthy();
    expect(within(copy()).getByText('Steering the Craft')).toBeTruthy();
    expect(within(copy()).getByText(/judged by their effect, not smoothed away/)).toBeTruthy();
    /* Persona-run analysis is part of the feature, not just the picker. */
    expect(within(copy()).getByText(/ask your host or a guest to run it/)).toBeTruthy();
    expect(document.querySelector('.pm-ws-notice-note')?.textContent).toBe(
      'Craft Steering is in the sidebar’s Writing Tools too, under Craft & Voice.'
    );

    const callouts = Array.from(document.querySelectorAll('.pm-ws-notice-callout'));
    expect(callouts.map((node) => node.textContent)).toEqual(['1', '2']);
    expect(within(legend()).getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      '1Tools — runs a tool directly on the pinned excerpt.',
      '2Craft Steering — under Craft & Voice; one run, and the report lands in the thread.'
    ]);
  });

  it('keeps Topic & Related Lexicon as a primer, and says personas leave it out', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Notice 7' }));

    expect(screen.getByText(/7 \/ 13/).parentElement?.textContent).toBe('7 / 13 · primer');
    expect(screen.getByText('Topic & Related Lexicon', { selector: 'h2' })).toBeTruthy();
    expect(within(copy()).getByText(/Dictionary entries can end with an encyclopedia entry/)).toBeTruthy();
    expect(within(copy()).getByText(/possible reference books for each\s+topic/)).toBeTruthy();
    expect(within(copy()).getByText(/It starts on and remembers\s+your choice for both standard and Fast lookups/)).toBeTruthy();
    expect(document.querySelector('.pm-ws-notice-note')?.textContent).toBe(
      'When a host or guest looks up a word for you in the Workshop, the encyclopedia entry is left out.'
    );

    const callouts = Array.from(document.querySelectorAll('.pm-ws-notice-callout'));
    expect(callouts.map((node) => node.textContent)).toEqual(['1', '2']);
    expect(within(legend()).getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      '1Topic & Related Lexicon — the switch above the lookup buttons; on by default.',
      '2Encyclopedia entry — added at the end: topics, related vocabulary, examples, and possible reference books.'
    ]);
  });

  it('keeps the larger context budgets as a primer, without the v2.8.0 upgrade note', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Notice 4' }));

    expect(screen.getByText(/4 \/ 13/).parentElement?.textContent).toBe('4 / 13 · primer');
    expect(screen.getByText('Room for more context')).toBeTruthy();
    expect(within(copy()).getByText('100,000 words')).toBeTruthy();
    expect(within(copy()).getByText('seven attachments')).toBeTruthy();
    expect(within(copy()).getByText(/sends only what you added, changed, or removed/)).toBeTruthy();
    expect(within(copy()).getByText(/stops before sending and gives\s+you your draft back/)).toBeTruthy();
    expect(document.querySelector('.pm-ws-notice-note')).toBeNull();

    expect(within(legend()).getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      '1Attach to this message — files ride one message, then become history.',
      '2Add to standing context — stays with every message for the whole session.',
      '3Remaining slots — up to seven attachments per message, 10,000 words each.',
      '4Attachment intake limit — 100,000 words of standing context.'
    ]);
  });

  it('keeps prompt caching as a primer: the clock is an estimate, the cached count is evidence', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Notice 3' }));

    expect(screen.getByText(/3 \/ 13/).parentElement?.textContent).toBe('3 / 13 · primer');
    expect(screen.getByText('Prompt caching, with a cache clock')).toBeTruthy();
    expect(within(copy()).getByText(/supported Alibaba\/Qwen routes/)).toBeTruthy();
    expect(within(copy()).getByText(/Other providers\s+keep their own caching/)).toBeTruthy();
    expect(within(copy()).getByText(/It is an estimate, not a\s+promise/)).toBeTruthy();
    expect(within(copy()).getByText(/five-minute \(default\) or one-hour cache/)).toBeTruthy();
    expect(document.querySelector('.pm-ws-notice-note')?.textContent).toBe(
      'Cache writes cost more than ordinary input, and one-hour writes cost more than five-minute ' +
      'writes. Pick the window that fits how long you pause between messages.'
    );

    const callouts = Array.from(document.querySelectorAll('.pm-ws-notice-callout'));
    expect(callouts.map((node) => node.textContent)).toEqual(['1', '2', '3']);
    expect(within(legend()).getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      '1Est. Cache Time Remaining — time left in the estimated cache window; not a guaranteed hit.',
      '2cached — prompt tokens the provider reported reading from cache.',
      '3Claude Cache Duration — five minutes (default) or one hour, in General settings.'
    ]);
  });

  /* Newest release first; earlier releases' pages follow it, newest release
     first and in their original order, ahead of the standing tour. */
  it('orders the tour newest first, then earlier releases, then the standing tour', () => {
    renderModal();
    const titles = Array.from({ length: 13 }, (_, index) => {
      fireEvent.click(screen.getByRole('button', { name: `Notice ${index + 1}` }));
      return copy().querySelector('h2')?.textContent;
    });
    expect(titles).toEqual([
      'New: export a conversation',
      'New: personas can read your saved sessions',
      'Prompt caching, with a cache clock',
      'Room for more context',
      'Rewind, edit, and branch',
      'Craft Steering',
      'Topic & Related Lexicon',
      'Welcome to the Workshop beta',
      'Start with an open project folder',
      'Choose a host, then invite guests',
      "Set the room's conversation style",
      'Tools — run them directly, or ask a persona',
      'Agents can work with your project'
    ]);
  });

  /* Every page title after the two lead pages drops "New:". */
  it('marks only the two lead pages as new', () => {
    renderModal();
    const tags = Array.from({ length: 13 }, (_, index) => {
      fireEvent.click(screen.getByRole('button', { name: `Notice ${index + 1}` }));
      return screen.getByText(new RegExp(`^${index + 1} / 13`)).parentElement?.textContent;
    });
    expect(tags.filter((tag) => tag?.endsWith('· new'))).toEqual(['1 / 13 · new', '2 / 13 · new']);
  });

  it('keeps rewind, edit, and branch as a primer, without the old release note', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Notice 5' }));

    expect(screen.getByText(/5 \/ 13/).parentElement?.textContent).toBe('5 / 13 · primer');
    expect(screen.getByText('Rewind, edit, and branch')).toBeTruthy();
    expect(within(copy()).getByText('Rewind to here')).toBeTruthy();
    expect(within(copy()).getByText('Edit from here')).toBeTruthy();
    expect(within(copy()).getByText('Branch from here')).toBeTruthy();
    expect(within(copy()).getByText(/Save the session before you branch/)).toBeTruthy();
    expect(within(copy()).getByText(/excerpt and context\s+always stay as they are now/)).toBeTruthy();
    expect(document.querySelector('.pm-ws-notice-note')).toBeNull();
  });

  it('draws the thread\'s own actions, called out to match the legend', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Notice 5' }));

    const rows = Array.from(document.querySelectorAll('.pm-ws-notice-actions'));
    expect(rows.map((row) => row.querySelector('.pm-ws-notice-actions-caption')?.textContent))
      .toEqual(['Under a reply', 'Under a message you sent']);
    /* Decorative, like a figure's call-outs: the legend carries the meaning. */
    rows.forEach((row) => expect(row.getAttribute('aria-hidden')).toBe('true'));
    const called = Array.from(document.querySelectorAll('.pm-ws-notice-action-called'));
    expect(called.map((node) => node.textContent)).toEqual([
      '1 Rewind to here',
      '3 Branch from here',
      '2 Edit from here'
    ]);
    expect(within(legend()).getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      '1Rewind to here — keep this reply; remove everything after it.',
      '2Edit from here — your message comes back to edit and send again.',
      '3Branch from here — a new saved session from this point; this one stays.'
    ]);
  });

  it('pages with arrows and dots, disabling next on the last page', () => {
    renderModal();
    const next = screen.getByRole('button', { name: 'Next notice' }) as HTMLButtonElement;
    fireEvent.click(next);
    expect(screen.getByText(/2 \/ 13/)).toBeTruthy();
    expect(screen.getByText('New: personas can read your saved sessions')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Notice 8' }));
    expect(screen.getByText(/8 \/ 13/)).toBeTruthy();
    expect(screen.getByText('Welcome to the Workshop beta')).toBeTruthy();
    expect(screen.getByText(/never changes project files on its own/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Notice 9' }));
    expect(screen.getByText(/9 \/ 13/)).toBeTruthy();
    expect(screen.getByText('Start with an open project folder')).toBeTruthy();
    expect(within(copy()).getByText(/Prose Minion Settings/)).toBeTruthy();
    expect(within(copy()).getByText(/individual chapter files/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Notice 13' }));
    expect(screen.getByText('Agents can work with your project')).toBeTruthy();
    expect(screen.getByText(/do not need to attach every file by hand/)).toBeTruthy();
    /* Widgets ship; the browser no longer claims nothing launches. */
    expect(within(copy()).getByText(/opens the widgets that\s+are ready now/)).toBeTruthy();
    expect(within(legend()).getByText(/ready-now widgets open here/)).toBeTruthy();
    expect(next.disabled).toBe(true);
  });

  it('explains host choice, model guidance, conversation settings, and persona-run tools', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Notice 10' }));
    expect(screen.getByText('Choose a host, then invite guests')).toBeTruthy();
    expect(within(copy()).getByText('Gemini 3.6 Flash')).toBeTruthy();
    expect(within(copy()).getByText('GPT-5.6 Terra')).toBeTruthy();
    expect(within(copy()).getByText('GPT-5.6 Sol')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Notice 11' }));
    expect(within(copy()).getByText(/Conversation Controller/)).toBeTruthy();
    expect(within(copy()).getByText(/About you/)).toBeTruthy();
    expect(within(copy()).getByText(/clickable citation pill/)).toBeTruthy();
    expect(within(copy()).getByText(/do not apply to direct instrument threads/)).toBeTruthy();
    /* The web-research privacy disclosure is shipped copy the comp omits; it
       must survive a design re-pull. */
    expect(within(copy()).getByText(/comfortable sharing/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Notice 12' }));
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
      fireEvent.click(screen.getByRole('button', { name: 'Notice 8' }));

      const shots = screen.getAllByRole('img') as HTMLImageElement[];
      expect(shots.length).toBeGreaterThan(0);
      expect(shots.map((img) => img.getAttribute('src'))).toContain(
        'https://webview.test/header-cluster.png'
      );
      /* Every screenshot describes itself — the call-out boxes are decorative. */
      shots.forEach((img) => expect(img.getAttribute('alt')).toBeTruthy());
    });

    it.each([
      ['Notice 1', ['sessions-menu-export', 'export-transcript-formats']],
      ['Notice 2', ['recall-card-and-reply']],
      ['Notice 3', ['composer-cache-clock', 'reply-cached-badge', 'settings-cache-duration']],
      ['Notice 4', ['attach-menu', 'message-attachment-slots', 'context-intake-meter']],
      ['Notice 6', ['composer-controls', 'tools-craft-steering']],
      ['Notice 7', ['dictionary-topic-switch', 'dictionary-topic-entry']]
    ])('shows the feature screenshots on %s', (dot, names) => {
      window.proseMinionAssets = {
        noticeShots: Object.fromEntries(
          WORKSHOP_NOTICE_SHOTS.map((name) => [name, `https://webview.test/${name}.png`])
        )
      };
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: dot }));

      const shots = screen.getAllByRole('img') as HTMLImageElement[];
      expect(shots.map((img) => img.getAttribute('src'))).toEqual(
        names.map((name) => `https://webview.test/${name}.png`)
      );
      shots.forEach((img) => expect(img.getAttribute('alt')).toBeTruthy());
    });

    it('renders one call-out per legend row, positioned in percentages', () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Notice 10' }));

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
      fireEvent.click(screen.getByRole('button', { name: 'Notice 8' }));
      const shots = screen.getAllByRole('img') as HTMLImageElement[];
      expect(shots.length).toBeGreaterThan(0);
      shots.forEach((img) => expect(img.getAttribute('src')).toBe(''));
      /* The tour still pages — a missing asset costs a picture, not the box. */
      fireEvent.click(screen.getByRole('button', { name: 'Notice 11' }));
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
      fireEvent.click(screen.getByRole('button', { name: 'Notice 9' }));

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
      fireEvent.click(screen.getByRole('button', { name: 'Notice 11' }));

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
      fireEvent.click(screen.getByRole('button', { name: 'Notice 9' }));

      fireEvent.click(screen.getByRole('button', { name: /How to configure your project/ }));

      const guide = screen.getByRole('dialog', { name: 'How to configure your project' });
      expect(within(guide).getByText(/never guesses at your folder layout/)).toBeTruthy();
      /* Full-surface: the notice steps aside rather than stacking. */
      expect(screen.queryByText('Start with an open project folder')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: /Back to the tour/ }));
      expect(screen.getByText(/9 \/ 13/)).toBeTruthy();
      expect(screen.getByText('Start with an open project folder')).toBeTruthy();
    });

    it('is reachable from the agents notice and returns to the LAST page', () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Notice 13' }));

      fireEvent.click(screen.getByRole('button', { name: /Project Resource Locations/ }));
      expect(screen.getByRole('dialog', { name: 'How to configure your project' })).toBeTruthy();

      /* The boundary page is where an index-reset or PAGES.length - 1 off-by-one
         hides while passing on an interior page (PR #94 review, Cal). */
      fireEvent.click(screen.getByRole('button', { name: /Back to the tour/ }));
      expect(screen.getByText(/13 \/ 13/)).toBeTruthy();
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

      fireEvent.click(screen.getByRole('button', { name: 'Notice 9' }));
      expect(document.querySelector('.pm-ws-notice-guide-note')?.textContent).toBe(
        'Then follow How to configure your project for the whole walkthrough.'
      );

      fireEvent.click(screen.getByRole('button', { name: 'Notice 13' }));
      expect(document.querySelector('.pm-ws-notice-guide-note')?.textContent).toBe(
        'Project-file reading depends on the paths set in Project Resource Locations.'
      );
    });

    it('keeps "Don\'t show again" checked across a trip through the guide', () => {
      const { onDismiss } = renderModal();
      fireEvent.click(screen.getByRole('checkbox'));
      fireEvent.click(screen.getByRole('button', { name: 'Notice 9' }));

      fireEvent.click(screen.getByRole('button', { name: /How to configure your project/ }));
      fireEvent.click(screen.getByRole('button', { name: /Back to the tour/ }));

      expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('true');
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
      expect(onDismiss).toHaveBeenCalledWith(true);
    });

    it('closes on Escape without touching the notice dismissal', () => {
      const { onClose, onDismiss } = renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Notice 9' }));
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
      fireEvent.click(screen.getByRole('button', { name: 'Notice 9' }));

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
