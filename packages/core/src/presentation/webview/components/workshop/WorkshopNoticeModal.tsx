/**
 * WorkshopNoticeModal — the six-page "Workshop · beta" startup notice from the
 * 2026-07-26 design drop (docs/design/pm-wk-notify.js). Paged with arrows and
 * a dot pager; the footer's "Don't show again" checkbox applies to the whole
 * box and is honored only by the Dismiss button — closing via X/Escape/
 * backdrop never records anything, so the tour returns next launch.
 *
 * Content is deterministic presentation copy and lives HERE, not in shared
 * constants: the host only ever needs the version string
 * (shared/constants/workshopNotices.ts) to answer "should this show?".
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { WorkshopModalShell } from './WorkshopModalShell';

interface NoticePage {
  title: string;
  tag: 'beta' | 'setup' | 'primer';
  body: React.ReactNode;
}

const PAGES: readonly NoticePage[] = [
  {
    title: 'Welcome to the Workshop beta',
    tag: 'beta',
    body: (
      <>
        The Workshop is a conversation space for working with a host, focused guests, and
        analysis instruments. It is still settling, so this short tour points to the controls
        that matter most. You decide when to send a message, run a tool, attach context, or apply
        text; Prose Minion never changes project files on its own.
      </>
    )
  },
  {
    title: 'Start with an open project folder',
    tag: 'setup',
    body: (
      <>
        Open your writing project folder in VS Code. Then use the <b>Prose Minion Settings</b>{' '}
        gear in the sidebar to tell the extension where character sheets, locations, project
        notes, drafts, and manuscript chapters live. For the best results, split drafts and
        manuscripts into individual chapter files so assistants can find and read the right
        material without treating a whole novel as one document.
      </>
    )
  },
  {
    title: 'Choose a host, then invite guests',
    tag: 'primer',
    body: (
      <>
        Every session has a <b>host</b>. Jill is the default, but you can choose a different host
        before the conversation begins. You can also invite <b>guest personas</b> with focused
        specialties such as rhythm &amp; pacing, continuity, dialogue, or voice &amp; POV; they work
        beside the host, never replace it. For especially distinctive persona voices and strong
        judgment about when to read project resources or run another analysis, try <b>Gemini 3.6
        Flash</b>. <b>GPT-5.6 Terra</b> and <b>GPT-5.6 Sol</b> are also excellent choices.
      </>
    )
  },
  {
    title: 'Set the room\'s conversation style',
    tag: 'primer',
    body: (
      <>
        Find the diamond-shaped <b>Conversation Controller</b> chip in the composer controls.
        The <b>Behavior</b> tab sets how host and guest personas respond: <b>mode</b> (how opinionated),{' '}
        <b>expression</b> (how much they say), and <b>depth</b> (how far they read into things).
        Those choices are per-session, stay visible, and never change silently. The <b>About
        you</b> tab lets you choose how the room addresses you and share a short writer profile
        as background context. In <b>Advanced</b>, you can let personas research the live web
        when it helps; their replies show each source as a clickable citation pill. These
        conversation controls do not apply to direct instrument threads.
      </>
    )
  },
  {
    title: 'Tools — run them directly, or ask a persona',
    tag: 'primer',
    body: (
      <>
        Run any of the fourteen analyses directly against a pinned excerpt and its report lands
        visibly in the thread. Or ask your host or a guest to run an isolated analysis on a
        specific line, variation, or question from the conversation. Just ask: the persona can
        decide when a tool would help and bring the useful result back into the room. Direct tool
        runs unlock when an excerpt is set.
      </>
    )
  },
  {
    title: 'Agents can work with your project',
    tag: 'primer',
    body: (
      <>
        With project paths configured, hosts and guests can <b>find and read relevant project
        files</b> when the conversation calls for them — you do not need to attach every file by
        hand. They can also use the dictionary, run analyses, and inspect a particular variation
        without derailing the main conversation. The <b>Widgets</b> browser is a preview of tools
        still to come; it does not launch widgets yet.
      </>
    )
  }
];

interface WorkshopNoticeModalProps {
  open: boolean;
  /** Plain close (X/Escape/backdrop) — never records a dismissal. */
  onClose: () => void;
  /** The Dismiss button — records host-side only when the checkbox is on. */
  onDismiss: (dontShowAgain: boolean) => void;
}

export const WorkshopNoticeModal: React.FC<WorkshopNoticeModalProps> = ({
  open,
  onClose,
  onDismiss
}) => {
  const [index, setIndex] = React.useState(0);
  const [dontShowAgain, setDontShowAgain] = React.useState(false);

  /* Every open starts the tour from page one with the checkbox clear. */
  React.useEffect(() => {
    if (open) {
      setIndex(0);
      setDontShowAgain(false);
    }
  }, [open]);

  const page = PAGES[index];

  return (
    <WorkshopModalShell
      open={open}
      titleId="pm-ws-notice-title"
      closeLabel="Close notices"
      className="pm-ws-notice-modal"
      onClose={onClose}
    >
      <div className="pm-ws-notice">
        <WorkshopModalShell.CloseButton />
        <div className="pm-ws-notice-eyebrow">
          <span className="pm-ws-eyebrow">Workshop</span>
          <span className="pm-ws-notice-beta">beta</span>
        </div>
        <div className="pm-ws-notice-page">
          <span className="pm-ws-notice-counter">
            {index + 1} / {PAGES.length} · {page.tag}
          </span>
          <h2 id="pm-ws-notice-title">{page.title}</h2>
          <p>{page.body}</p>
        </div>
        <div className="pm-ws-notice-nav">
          <button
            type="button"
            className="pm-ws-notice-arrow pm-ws-notice-arrow-prev"
            aria-label="Previous notice"
            disabled={index === 0}
            onClick={() => setIndex((current) => Math.max(0, current - 1))}
          >
            <Icon name="chevDown" size={14} />
          </button>
          <div className="pm-ws-notice-dots">
            {PAGES.map((_entry, dotIndex) => (
              <button
                key={dotIndex}
                type="button"
                className={`pm-ws-notice-dot${dotIndex === index ? ' pm-ws-notice-dot-on' : ''}`}
                aria-label={`Notice ${dotIndex + 1}`}
                aria-current={dotIndex === index}
                onClick={() => setIndex(dotIndex)}
              />
            ))}
          </div>
          <button
            type="button"
            className="pm-ws-notice-arrow pm-ws-notice-arrow-next"
            aria-label="Next notice"
            disabled={index === PAGES.length - 1}
            onClick={() => setIndex((current) => Math.min(PAGES.length - 1, current + 1))}
          >
            <Icon name="chevDown" size={14} />
          </button>
        </div>
        <div className="pm-ws-notice-foot">
          <button
            type="button"
            role="checkbox"
            aria-checked={dontShowAgain}
            className={`pm-ws-notice-dsa${dontShowAgain ? ' pm-ws-notice-dsa-on' : ''}`}
            onClick={() => setDontShowAgain((current) => !current)}
          >
            <span className="pm-ws-notice-dsa-box" aria-hidden="true">
              <Icon name="check" size={9} />
            </span>
            Don&rsquo;t show again{' '}
            <span className="pm-ws-notice-dsa-all">· applies to all {PAGES.length} notices in this box</span>
          </button>
          <button
            type="button"
            className="pm-ws-notice-dismiss"
            onClick={() => onDismiss(dontShowAgain)}
          >
            Dismiss
          </button>
        </div>
      </div>
    </WorkshopModalShell>
  );
};
