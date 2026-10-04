/**
 * WorkshopNoticeModal — the paged "Workshop · beta" startup notice, in the
 * wide screenshot format from the 2026-07-27 design drop
 * (docs/design/pm-wk-notify.js + `Prose Minion - Notice Modal.html`). The
 * release's new features lead the tour (ADR 2026-09-30, Sprint 03 kickoff
 * decision 5): every machine sees the whole box again after a version bump,
 * so what changed comes first. Each release replaces the previous release's
 * `new` pages: a Workshop control worth teaching stays on as a `primer` (Rewind,
 * edit, and branch), and announcements of sidebar-wide tools retire.
 *
 * Layout is two columns: an annotated media well on the left (screenshots of
 * the real controls, with numbered call-out boxes and a matching legend) and
 * the copy on the right, over a docked footer carrying "Don't show again",
 * the pager, and Dismiss.
 *
 * The call-out boxes are positioned in PERCENTAGES of their figure, so a
 * re-shot screenshot of the same crop keeps its annotations. Boxes are
 * decorative (`aria-hidden`); the legend below the well is the accessible
 * description of what each number points at.
 *
 * Dismissal semantics are unchanged: the footer's checkbox applies to the
 * whole box and is honored only by Dismiss — closing via X/Escape/backdrop
 * never records anything, so the tour returns next launch.
 *
 * Content is deterministic presentation copy and lives HERE, not in shared
 * constants: the host only ever needs the version string and the screenshot
 * names (shared/constants/workshopNotices.ts).
 */

import * as React from 'react';
import { WorkshopNoticeShot } from '@shared/constants/workshopNotices';
import { Icon, IconName } from '@components/shared/Icon';
import { getNoticeShotUri } from '@utils/proseMinionAssets';
import { WorkshopModalShell } from './WorkshopModalShell';
import { WorkshopConfigureGuide } from './WorkshopConfigureGuide';

/** A numbered call-out, sized and placed as a percentage of its figure. */
interface NoticeCallout {
  label: string;
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  heightPercent: number;
}

interface NoticeFigure {
  kind: 'figure';
  shot: WorkshopNoticeShot;
  alt: string;
  /** Widest the figure is allowed to render, from the comp. */
  maxWidthPx: number;
  /** `aspect-ratio` for the figure box — also the visible crop when cropped. */
  ratio: string;
  /**
   * Image width as a percentage of the figure box. Present only for shots the
   * comp crops to their top-left region (the VS Code File menu), where the
   * source frame carries chrome the notice does not need.
   */
  cropWidthPercent?: number;
  callouts?: NoticeCallout[];
}

/** Three side-by-side thumbnails — the Conversation Controller's tabs. */
interface NoticeThumbRow {
  kind: 'thumbs';
  thumbs: Array<{ shot: WorkshopNoticeShot; alt: string; caption: string }>;
}

/**
 * A row of the thread's own action buttons, drawn inline because no screenshot
 * of them exists yet. Decorative, like a figure's call-outs: the legend is the
 * accessible description, keyed by each action's call-out label.
 */
interface NoticeActionRow {
  kind: 'actions';
  /** Where the row appears, e.g. "Under a reply". */
  caption: string;
  actions: ReadonlyArray<{ label: string; icon: IconName; callout?: string }>;
}

type NoticeMedia = NoticeFigure | NoticeThumbRow | NoticeActionRow;

/**
 * One legend row — the same "what does call-out N point at" data as
 * {@link NoticeCallout}, so it reads by property name too rather than by
 * position (PR #94 review, Parker).
 */
interface NoticeLegendRow {
  /** Matches the {@link NoticeCallout} label it explains. */
  label: string;
  /** The control's name, as it appears in the UI. */
  term: string;
  detail: string;
}

interface NoticePage {
  title: string;
  tag: 'new' | 'beta' | 'setup' | 'primer';
  body: React.ReactNode;
  /** A second, quieter paragraph under the body, set off like the guide note. */
  note?: React.ReactNode;
  /** Heading over the media well ("Where to look"). */
  wellTitle: string;
  media: readonly NoticeMedia[];
  legend: readonly NoticeLegendRow[];
  /**
   * Sentence pointing at the full project-configuration walkthrough. The
   * renderer owns ALL spacing: `lead` gets a space after it, and `trail`
   * continues the sentence immediately, so a closing period reads "Locations."
   * and a following clause needs no hand-typed leading space. An earlier
   * revision made spacing the caller's job and promptly shipped "Locations ."
   * (PR #94 review, Parker/Cal) — a contract no type could enforce.
   */
  guideLink?: {
    lead: string;
    label: string;
    /** Continues straight after the link: punctuation, or ` and then …`. */
    trail?: string;
  };
}

const COMPOSER_CONTROLS_ALT = 'The Workshop composer control bar';

const PAGES: readonly NoticePage[] = [
  {
    title: 'New: prompt caching, with a cache clock',
    tag: 'new',
    body: (
      <>
        Workshop now asks Claude, and supported Alibaba/Qwen routes, to cache retained
        conversations, so later turns can reuse what the model has already read. Other providers
        keep their own caching. Once the provider reports cache activity, a clock beside the
        composer estimates how much of the cache window is left. It is an estimate, not a
        promise: the <b>cached</b> count on a reply is what shows real reuse. For Claude, choose a
        five-minute (default) or one-hour cache in Prose Minion Settings under <b>General</b>.
      </>
    ),
    note: (
      <>
        Cache writes cost more than ordinary input, and one-hour writes cost more than five-minute
        writes. Pick the window that fits how long you pause between messages.
      </>
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'figure',
        shot: 'composer-cache-clock',
        alt: 'The Workshop composer, showing Est. Cache Time Remaining: 30 min',
        maxWidthPx: 460,
        ratio: '1144 / 376',
        callouts: [
          { label: '1', leftPercent: 35.5, topPercent: 50.3, widthPercent: 36.7, heightPercent: 13.8 }
        ]
      },
      {
        kind: 'figure',
        shot: 'reply-cached-badge',
        alt: 'A reply header: 125,922 processed, 118,842 cached',
        maxWidthPx: 320,
        ratio: '525 / 100',
        callouts: [
          { label: '2', leftPercent: 51.1, topPercent: 20.1, widthPercent: 42, heightPercent: 59.8 }
        ]
      },
      {
        kind: 'figure',
        shot: 'settings-cache-duration',
        alt: 'The Claude Cache Duration setting, set to 1 hour',
        maxWidthPx: 420,
        ratio: '1174 / 286',
        callouts: [
          { label: '3', leftPercent: 3.1, topPercent: 20.5, widthPercent: 37, heightPercent: 38.3 }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'Est. Cache Time Remaining', detail: 'time left in the estimated cache window; not a guaranteed hit.' },
      { label: '2', term: 'cached', detail: 'prompt tokens the provider reported reading from cache.' },
      { label: '3', term: 'Claude Cache Duration', detail: 'five minutes (default) or one hour, in General settings.' }
    ]
  },
  {
    title: 'New: room for more context',
    tag: 'new',
    body: (
      <>
        Standing context now holds up to <b>100,000 words</b>, and a single message can carry up
        to <b>seven attachments</b> of up to 10,000 words each. When you change standing context,
        Workshop sends only what you added, changed, or removed, not the whole list again. Your
        model still needs room for the excerpt, the conversation, and its reply: if a send is
        estimated to overflow a known model&rsquo;s window, Workshop stops before sending and gives
        you your draft back.
      </>
    ),
    note: (
      <>
        Sessions saved by this version can&rsquo;t be opened by earlier versions of Prose Minion.
        If you sync sessions through Git, update Prose Minion on every machine first.
      </>
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'figure',
        shot: 'attach-menu',
        alt: 'The composer + menu: Attach to this message, or Add to standing context',
        maxWidthPx: 260,
        ratio: '544 / 409',
        callouts: [
          { label: '1', leftPercent: 7.4, topPercent: 9.8, widthPercent: 85.3, heightPercent: 32.8 },
          { label: '2', leftPercent: 7.4, topPercent: 43.6, widthPercent: 85.3, heightPercent: 26.1 }
        ]
      },
      {
        kind: 'figure',
        shot: 'message-attachment-slots',
        alt: 'The message attachment picker: 1 of 7 remaining slots',
        maxWidthPx: 180,
        ratio: '301 / 136',
        callouts: [
          { label: '3', leftPercent: 8, topPercent: 38, widthPercent: 84, heightPercent: 43.2 }
        ]
      },
      {
        kind: 'figure',
        shot: 'context-intake-meter',
        alt: 'The context meter: 37,342 of 100,000 words, Attachment intake limit',
        maxWidthPx: 360,
        ratio: '682 / 256',
        callouts: [
          { label: '4', leftPercent: 52.5, topPercent: 10.2, widthPercent: 45.7, heightPercent: 23 }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'Attach to this message', detail: 'files ride one message, then become history.' },
      { label: '2', term: 'Add to standing context', detail: 'stays with every message for the whole session.' },
      { label: '3', term: 'Remaining slots', detail: 'up to seven attachments per message, 10,000 words each.' },
      { label: '4', term: 'Attachment intake limit', detail: '100,000 words of standing context.' }
    ]
  },
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
    ),
    wellTitle: 'What you are looking at',
    media: [
      {
        kind: 'figure',
        shot: 'header-cluster',
        alt: 'The Workshop header, with the host chip and the model picker',
        maxWidthPx: 520,
        ratio: '884 / 150'
      },
      {
        kind: 'figure',
        shot: 'composer-controls',
        alt: COMPOSER_CONTROLS_ALT,
        maxWidthPx: 560,
        ratio: '1320 / 338'
      }
    ],
    legend: []
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
    ),
    wellTitle: 'Where to do it',
    media: [
      {
        kind: 'figure',
        shot: 'vscode-open-folder',
        alt: 'The VS Code File menu, with Open Folder highlighted',
        /* Narrower than the comp's 216/400 so this page's two tall shots both
           fit the media well without scrolling — they point at two separate
           places, and hiding the second behind a scroll defeats the picture. */
        maxWidthPx: 180,
        ratio: '797 / 1217',
        cropWidthPercent: 161.3,
        callouts: [
          { label: '1', leftPercent: 23.2, topPercent: 26.4, widthPercent: 68.4, heightPercent: 4.8 }
        ]
      },
      {
        kind: 'figure',
        shot: 'sidebar-settings-gear',
        alt: 'The Prose Minion sidebar header, with the settings gear highlighted',
        maxWidthPx: 340,
        ratio: '882 / 446',
        callouts: [
          { label: '2', leftPercent: 91.3, topPercent: 7.4, widthPercent: 5.2, heightPercent: 13.2 }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'File → Open Folder…', detail: 'point VS Code at the project root before anything else.' },
      { label: '2', term: 'Settings gear', detail: 'top-right of the Prose Minion sidebar; opens Project Resource Locations.' }
    ],
    guideLink: {
      lead: 'Then follow',
      label: 'How to configure your project',
      trail: ' for the whole walkthrough.'
    }
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
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'figure',
        shot: 'header-cluster',
        alt: 'The Workshop header, with the host chip and the model picker highlighted',
        maxWidthPx: 520,
        ratio: '884 / 150',
        callouts: [
          { label: '1', leftPercent: 6.4, topPercent: 19, widthPercent: 18.9, heightPercent: 52 },
          { label: '2', leftPercent: 67, topPercent: 19, widthPercent: 31.4, heightPercent: 52 }
        ]
      },
      {
        kind: 'figure',
        shot: 'talking-to-rail',
        alt: 'The "Talking to" rail above the composer, with the invite-guest chip',
        maxWidthPx: 340,
        ratio: '516 / 140',
        callouts: [
          { label: '3', leftPercent: 22.9, topPercent: 33, widthPercent: 24.8, heightPercent: 45 },
          { label: '4', leftPercent: 48.4, topPercent: 33, widthPercent: 41.9, heightPercent: 45 }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'Host chip', detail: 'set before the conversation begins.' },
      { label: '2', term: 'Model picker', detail: 'Gemini 3.6 Flash, GPT-5.6 Terra, GPT-5.6 Sol.' },
      { label: '3', term: 'Talking to', detail: 'who is currently in the room.' },
      { label: '4', term: 'Invite guest', detail: 'add a focused specialist beside the host.' }
    ]
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
        when it helps; search queries may use active room context and run through OpenRouter and
        search providers, so enable it only for material you are comfortable sharing. Their
        replies show each source as a clickable citation pill. These
        conversation controls do not apply to direct instrument threads.
      </>
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'figure',
        shot: 'composer-controls',
        alt: 'The composer control bar, with the Conversation Controller chip highlighted',
        maxWidthPx: 560,
        ratio: '1320 / 338',
        callouts: [
          { label: '1', leftPercent: 32.4, topPercent: 52.5, widthPercent: 28.7, heightPercent: 22 }
        ]
      },
      {
        kind: 'thumbs',
        thumbs: [
          {
            shot: 'controller-behavior',
            alt: 'The Behavior tab: mode, expression, and depth',
            caption: 'Behavior'
          },
          {
            shot: 'controller-about-you',
            alt: 'The About you tab: preferred name and writer profile',
            caption: 'About you'
          },
          {
            shot: 'controller-advanced',
            alt: 'The Advanced tab: live web research',
            caption: 'Advanced'
          }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'Conversation Controller', detail: 'the diamond chip in the composer bar; three tabs inside.' }
    ]
  },
  {
    title: 'Tools — run them directly, or ask a persona',
    tag: 'primer',
    body: (
      <>
        Run any analysis tool directly against a pinned excerpt and its report lands
        visibly in the thread. Or ask your host or a guest to run an isolated analysis on a
        specific line, variation, or question from the conversation. Just ask: the persona can
        decide when a tool would help and bring the useful result back into the room. Direct tool
        runs unlock when an excerpt is set.
      </>
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'figure',
        shot: 'composer-controls',
        alt: 'The composer control bar, with Tools and the attach button highlighted',
        maxWidthPx: 560,
        ratio: '1320 / 338',
        callouts: [
          { label: '1', leftPercent: 77.2, topPercent: 52.5, widthPercent: 11.2, heightPercent: 22 },
          { label: '2', leftPercent: 3.5, topPercent: 52.5, widthPercent: 6, heightPercent: 22 }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'Tools', detail: 'analysis tools; enabled once an excerpt is pinned.' },
      { label: '2', term: '+', detail: 'pin the excerpt and attach project context.' }
    ]
  },
  {
    title: 'Rewind, edit, and branch',
    tag: 'primer',
    body: (
      <>
        Replies and your own messages have actions underneath. <b>Rewind to here</b> returns
        the room to a reply: the thread, and what every participant remembers, go back to that
        point, and everything after it is removed. On a message you sent, <b>Edit from here</b>{' '}
        removes it and everything after it, then puts it back in the composer (or reopens its
        widget) so you can change it and send it again. <b>Branch from here</b> leaves this
        conversation as it is and opens a new saved session that starts from that point, so you
        can try another direction. Save the session before you branch. Your excerpt and context
        always stay as they are now.
      </>
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'actions',
        caption: 'Under a reply',
        actions: [
          { label: 'Copy', icon: 'copy' },
          { label: 'Rewind to here', icon: 'history', callout: '1' },
          { label: 'Branch from here', icon: 'branch', callout: '3' }
        ]
      },
      {
        kind: 'actions',
        caption: 'Under a message you sent',
        actions: [
          { label: 'Edit from here', icon: 'history', callout: '2' },
          { label: 'Branch from here', icon: 'branch' }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'Rewind to here', detail: 'keep this reply; remove everything after it.' },
      { label: '2', term: 'Edit from here', detail: 'your message comes back to edit and send again.' },
      { label: '3', term: 'Branch from here', detail: 'a new saved session from this point; this one stays.' }
    ]
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
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'figure',
        shot: 'composer-controls',
        alt: 'The composer control bar, with Widgets highlighted',
        maxWidthPx: 560,
        ratio: '1320 / 338',
        callouts: [
          { label: '1', leftPercent: 63.8, topPercent: 52.5, widthPercent: 12.4, heightPercent: 22 }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'Widgets', detail: 'a preview browser; nothing launches yet.' }
    ],
    guideLink: {
      lead: 'Project-file reading depends on the paths set in',
      label: 'Project Resource Locations',
      trail: '.'
    }
  }
];

const NoticeCallouts: React.FC<{ callouts?: readonly NoticeCallout[] }> = ({ callouts }) => (
  <>
    {(callouts ?? []).map((callout) => (
      <span
        key={callout.label}
        className="pm-ws-notice-callout"
        aria-hidden="true"
        style={{
          left: `${callout.leftPercent}%`,
          top: `${callout.topPercent}%`,
          width: `${callout.widthPercent}%`,
          height: `${callout.heightPercent}%`
        }}
      >
        <i>{callout.label}</i>
      </span>
    ))}
  </>
);

const NoticeActions: React.FC<{ row: NoticeActionRow }> = ({ row }) => (
  <div className="pm-ws-notice-actions" aria-hidden="true">
    <span className="pm-ws-notice-actions-caption">{row.caption}</span>
    <span className="pm-ws-notice-actions-row">
      {row.actions.map((action) => (
        <span
          key={action.label}
          className={`pm-ws-notice-action${action.callout ? ' pm-ws-notice-action-called' : ''}`}
        >
          {action.callout && <i>{action.callout}</i>}
          <Icon name={action.icon} size={13} /> {action.label}
        </span>
      ))}
    </span>
  </div>
);

const NoticeMediaWell: React.FC<{ media: readonly NoticeMedia[] }> = ({ media }) => (
  <>
    {media.map((entry, index) =>
      entry.kind === 'actions' ? (
        <NoticeActions row={entry} key={`actions-${index}`} />
      ) : entry.kind === 'thumbs' ? (
        <div className="pm-ws-notice-thumbs" key={`thumbs-${index}`}>
          {entry.thumbs.map((thumb) => (
            <figure className="pm-ws-notice-thumb" key={thumb.shot}>
              <span className="pm-ws-notice-thumb-frame">
                <img src={getNoticeShotUri(thumb.shot)} alt={thumb.alt} />
              </span>
              <figcaption>{thumb.caption}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <figure
          className="pm-ws-notice-figure"
          key={`${entry.shot}-${index}`}
          /* The ratio arrives as a custom property and the stylesheet turns it
             into `aspect-ratio`, so the figure reserves its box before the
             image decodes without the component hand-writing layout rules. */
          style={
            {
              '--pm-notice-ratio': entry.ratio,
              maxWidth: `${entry.maxWidthPx}px`
            } as React.CSSProperties
          }
        >
          <img
            src={getNoticeShotUri(entry.shot)}
            alt={entry.alt}
            /* A cropped shot is absolutely placed and over-wide, so the figure
               box shows only its top-left region. */
            className={entry.cropWidthPercent ? 'pm-ws-notice-figure-crop' : undefined}
            style={entry.cropWidthPercent ? { width: `${entry.cropWidthPercent}%` } : undefined}
          />
          <NoticeCallouts callouts={entry.callouts} />
        </figure>
      )
    )}
  </>
);

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
  const [guideOpen, setGuideOpen] = React.useState(false);

  /* Every open starts the tour from page one with the checkbox clear. */
  React.useEffect(() => {
    if (open) {
      setIndex(0);
      setDontShowAgain(false);
      setGuideOpen(false);
    }
  }, [open]);

  const page = PAGES[index];
  const closeGuide = React.useCallback(() => setGuideOpen(false), []);

  return (
    <>
      {/* The guide takes the whole surface, so the notice steps aside while it
          is up — its page and checkbox state survive, because this component
          stays mounted and only the shell unmounts. */}
      <WorkshopModalShell
        open={open && !guideOpen}
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
          <div className="pm-ws-notice-body">
            <div className="pm-ws-notice-well">
              <div className="pm-ws-notice-well-title">{page.wellTitle}</div>
              {/* `key` on the scroller, not just its children: it is one DOM
                  node across a page change, so without this a writer who
                  scrolled the setup page's tall figures lands on the next
                  notice already scrolled past its lead screenshot, with nothing
                  saying to scroll up (PR #94 review, Sam). */}
              <div className="pm-ws-notice-media" key={`media-${index}`}>
                <NoticeMediaWell media={page.media} />
              </div>
              {page.legend.length > 0 && (
                <ul className="pm-ws-notice-legend">
                  {page.legend.map((row) => (
                    <li key={row.label}>
                      <span className="pm-ws-notice-legend-num">{row.label}</span>
                      <span>
                        <b>{row.term}</b> — {row.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="pm-ws-notice-page">
              <span className="pm-ws-notice-counter">
                <b>
                  {index + 1} / {PAGES.length}
                </b>{' '}
                · {page.tag}
              </span>
              <h2 id="pm-ws-notice-title">{page.title}</h2>
              <p>{page.body}</p>
              {page.note && <p className="pm-ws-notice-note">{page.note}</p>}
              {page.guideLink && (
                <p className="pm-ws-notice-guide-note">
                  {`${page.guideLink.lead} `}
                  <button
                    type="button"
                    className="pm-ws-notice-guide-link"
                    onClick={() => setGuideOpen(true)}
                  >
                    <Icon name="doc" size={13} />
                    {page.guideLink.label}
                  </button>
                  {page.guideLink.trail}
                </p>
              )}
            </div>
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
              <button
                type="button"
                className="pm-ws-notice-dismiss"
                onClick={() => onDismiss(dontShowAgain)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </WorkshopModalShell>
      <WorkshopConfigureGuide open={open && guideOpen} onClose={closeGuide} />
    </>
  );
};
