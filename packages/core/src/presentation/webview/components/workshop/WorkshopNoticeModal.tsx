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
    title: 'Welcome — this is a Beta experience',
    tag: 'beta',
    body: (
      <>
        The Workshop is new and still settling. There&rsquo;s no written guide yet — this tour is
        it, so feel free to explore: nothing here spends anything until you explicitly press a
        button that says so, and nothing you try can damage your project files.
      </>
    )
  },
  {
    title: 'Works best with a project folder configured',
    tag: 'setup',
    body: (
      <>
        Point the <b>Open Folder</b> setting (see the Settings tab) at your project, organized the
        way the browse-project modal expects: <b>Characters</b>, <b>Locations &amp; Settings</b>,{' '}
        <b>Themes</b>, <b>Project Brief materials</b>, and individual files per chapter. Once
        configured, assistants can read those files as context — and the category picker maps
        straight onto your folders.
      </>
    )
  },
  {
    title: 'Assistants — a host, and guests',
    tag: 'primer',
    body: (
      <>
        Every session has a <b>host</b> (Jill by default — a warm developmental partner) and you
        can invite <b>guest personas</b>, each with a narrow specialty: rhythm &amp; pacing,
        continuity, dialogue, voice &amp; POV, and more. Guests read beside your host, never
        replace it.
      </>
    )
  },
  {
    title: 'The conversation controller',
    tag: 'primer',
    body: (
      <>
        The chip beside the composer sets how the room responds: <b>mode</b> (how opinionated),{' '}
        <b>expression</b> (how much it says), and <b>depth</b> (how far it reads into things).
        It&rsquo;s per-session, visible at all times, and never changes silently.
      </>
    )
  },
  {
    title: 'Tools — one run, one visible result',
    tag: 'primer',
    body: (
      <>
        Fourteen analyses (dialogue &amp; beats, prose, cliché, show &amp; tell…) run <b>once</b>{' '}
        on your excerpt with your context attached. Each result lands in the thread as a visible
        event — nothing runs in the background. Tools unlock when an excerpt is set.
      </>
    )
  },
  {
    title: 'Agents can do real work',
    tag: 'primer',
    body: (
      <>
        With a configured project, assistants can <b>run analyses</b>, <b>read project files</b>{' '}
        you attach, <b>use the dictionary</b>, and <b>run isolated tools on specific
        variations</b> — a one-off pass on one option without touching the conversation. Widgets
        go further: play first, and only what you deliberately bring back ever reaches the room.
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
            {PAGES.map((entry, dotIndex) => (
              <button
                key={entry.title}
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
