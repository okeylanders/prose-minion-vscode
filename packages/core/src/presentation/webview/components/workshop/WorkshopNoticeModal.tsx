/**
 * WorkshopNoticeModal — the paged "Workshop · beta" startup notice, in the
 * wide screenshot format from the 2026-07-27 design drop
 * (docs/design/pm-wk-notify.js + `Prose Minion - Notice Modal.html`). The
 * release's new features lead the tour (ADR 2026-09-30, Sprint 03 kickoff
 * decision 5): every machine sees the whole box again after a version bump,
 * so what changed comes first. The tour is also the writer's full guide, so
 * a previous release's `new` pages never retire: they stay on as `primer`
 * pages right after the newest, newest release first and in their original
 * order, ahead of the standing tour.
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
    title: 'New: Find a recurring moment with Passage Search',
    tag: 'new',
    body: (
      <>
        In the sidebar, open <b>Search → Passage Search</b> and ask a question such as
        “Where does the White Rabbit worry about being late?” Choose the active file, a selection,
        a configured group, or a project path or pattern. Press <b>Estimate</b> to see the
        number of calls, approximate cost, and model. <b>Run</b> starts the search.
      </>
    ),
    note: (
      <>
        Each match quotes your manuscript. Select its file and line to read it in place.
        Turn on <b>Organize the results</b> before estimating to include one more call for
        an analysis. Its numbered citations jump to the passages behind each claim. Copy
        the report or save it as Markdown.
      </>
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'figure',
        shot: 'passage-search-estimate',
        alt: 'A question about the White Rabbit, Organize the results checked, Estimate and Run, and a five-call estimate for four files',
        maxWidthPx: 440,
        ratio: '1074 / 584',
        callouts: [
          { label: '1', leftPercent: 3.9, topPercent: 46.8, widthPercent: 16.2, heightPercent: 14.9 }
        ]
      },
      {
        kind: 'figure',
        shot: 'passage-search-results',
        alt: 'Two passages where the White Rabbit fears being late, each with its quoted line and a link to the chapter',
        maxWidthPx: 440,
        ratio: '1014 / 330',
        callouts: [
          { label: '2', leftPercent: 6.1, topPercent: 10.6, widthPercent: 60.4, heightPercent: 10.6 }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'Estimate', detail: 'check the planned calls and price before running.' },
      { label: '2', term: 'File and line', detail: 'open the manuscript at the quoted passage.' }
    ]
  },
  {
    title: 'New: Run a Passage Search from the Workshop',
    tag: 'new',
    body: (
      <>
        Ask a persona to trace a gesture or motif across drafts. Its card names the question
        and where it would look. It can search the room’s excerpt, a configured file, or a
        group narrowed by a pattern. Review the model, calls, and estimated cost, then choose{' '}
        <b>Run</b> or <b>Cancel</b>. If the plan changes, you get a fresh estimate to approve.
      </>
    ),
    note: (
      <>
        When every planned read finishes and the room is free, the results go back to the
        persona for a reply. If you stop early or a read is incomplete, choose whether to{' '}
        <b>send partial results</b>, inspect them with <b>Open report</b>, or discard them.
        The persona’s reply is a separate model request.
      </>
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'figure',
        shot: 'workshop-passage-search-proposal',
        alt: 'Jill’s proposed Passage Search, narrowed to the opening chapters, with its five-call estimate, Run, and Cancel',
        maxWidthPx: 480,
        ratio: '1344 / 424',
        callouts: [
          { label: '1', leftPercent: 2.2, topPercent: 77.5, widthPercent: 6.9, heightPercent: 15.8 }
        ]
      },
      {
        kind: 'figure',
        shot: 'workshop-passage-search-partial',
        alt: 'A stopped search with two matches from two of four reads, and the choices Send partial results to Jill, Open report, and Discard',
        maxWidthPx: 480,
        ratio: '1344 / 292',
        callouts: [
          { label: '2', leftPercent: 2.2, topPercent: 67, widthPercent: 25.7, heightPercent: 22.9 }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'Run', detail: 'approve the search described on this card.' },
      { label: '2', term: 'Send partial results', detail: 'let the persona work with the passages found so far.' }
    ]
  },
  {
    title: 'New: Close to-dos across Workshop sessions',
    tag: 'new',
    body: (
      <>
        After revising a chapter, ask your host or a guest to go through its open to-dos.
        A persona can mark them <b>Done</b> or <b>Dismissed</b> in the current conversation
        and in saved sessions. The receipt under the reply names each to-do, its session,
        and what changed. <b>Undo</b> reopens an item from that receipt while the change
        still applies.
      </>
    ),
    note: (
      <>
        If a window leaves a named session mid-save, close any other window using that
        workspace. Open <b>Sessions</b>, choose <b>Recover…</b> on the affected session,
        and confirm. Recovery keeps available unsaved work in a separate local recovery session.
      </>
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'figure',
        shot: 'todo-status-receipt',
        alt: 'Jill’s receipt marks the key reminder Done in this session and the Rabbit’s second entrance Dismissed in Hall of Doors, with an Undo button for each',
        maxWidthPx: 480,
        ratio: '1440 / 644',
        callouts: [
          { label: '1', leftPercent: 4.4, topPercent: 41.5, widthPercent: 65.5, heightPercent: 22.8 },
          { label: '2', leftPercent: 86.5, topPercent: 57.3, widthPercent: 8.2, heightPercent: 6.9 }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'Receipt', detail: 'see the new status and which session holds the to-do.' },
      { label: '2', term: 'Undo', detail: 'reopen this item in the room where the persona closed it.' }
    ]
  },
  {
    title: 'New: Ask what changed in a draft',
    tag: 'new',
    body: (
      <>
        Ask “How has this ending changed since the last commit?” In a trusted Git workspace,
        a host or guest can look up commits for the excerpt’s file or a configured project file.
        It can compare two commits, or a commit with the draft saved on disk. Save your
        editor changes first if you want them included.
      </>
    ),
    note: (
      <>
        The comparison lines up paragraphs and marks the words you added or cut. After the
        persona replies, select the file history entry under <b>Material → Read in</b> to
        jump to its comparison card.
      </>
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'figure',
        shot: 'history-compare',
        alt: 'An expanded File History card comparing a commit with the saved draft, with “waited” struck out beside “knelt” and “cold” replaced by “warm”',
        maxWidthPx: 480,
        ratio: '1440 / 840',
        callouts: [
          { label: '1', leftPercent: 4.2, topPercent: 14.9, widthPercent: 66, heightPercent: 7.2 },
          { label: '2', leftPercent: 4.2, topPercent: 67.7, widthPercent: 90, heightPercent: 11.4 }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'File History', detail: 'the file and revisions the persona compared.' },
      { label: '2', term: 'Changed words', detail: 'read an edit in its surrounding paragraph.' }
    ]
  },
  {
    title: 'New: Set up context paths from your folders',
    tag: 'new',
    body: (
      <>
        Open <b>Settings → Context Resource Paths</b> and choose <b>Suggest from my folders</b>.
        One helper-model request uses your folder and file names to suggest patterns for
        chapters, characters, and other project material. You can also ask a Workshop
        persona to check patterns with you and propose them on a card.
      </>
    ),
    note: (
      <>
        Review the match counts and example files. Tick the groups you want and press{' '}
        <b>Apply</b> to write those groups to your user settings, which apply across projects.
        Groups with workspace overrides show up with their checkboxes disabled.
      </>
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'figure',
        shot: 'context-paths-review',
        alt: 'The folder suggestion review with Characters checked, Locations & Settings unchecked, example files, and Apply',
        maxWidthPx: 460,
        ratio: '1152 / 918',
        callouts: [
          { label: '1', leftPercent: 2.7, topPercent: 10.7, widthPercent: 30.1, heightPercent: 9.3 },
          { label: '2', leftPercent: 2.5, topPercent: 37.1, widthPercent: 93, heightPercent: 23.6 },
          { label: '3', leftPercent: 3, topPercent: 88.6, widthPercent: 10.1, heightPercent: 8 }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'Suggest from my folders', detail: 'ask for patterns based on file and folder names.' },
      { label: '2', term: 'Characters', detail: 'check the new pattern against the example files.' },
      { label: '3', term: 'Apply', detail: 'write the patterns for just the groups you ticked.' }
    ]
  },
  {
    title: 'See what fills a persona’s context',
    tag: 'primer',
    body: (
      <>
        Open a persona&rsquo;s <b>context</b> row above the composer and look under{' '}
        <b>By part</b>. A bar and a table split the total into the persona&rsquo;s instructions,
        its tool-use instructions, project memory, to-dos, room notes, your excerpt and
        attachments, what the persona asked to read, and the conversation itself. A part with an
        underlined name opens to its pieces, so you can see whether a long conversation or one
        large file is taking the room.
      </>
    ),
    note: (
      <>
        Most parts are estimates, and the table says which. <b>Conversation</b> is the rest of
        the total the provider measured. Before a reply has been measured, after opening or
        rewinding a conversation for instance, the panel shows the parts it knows and leaves the
        shares out. Nothing here changes what is sent.
      </>
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'figure',
        shot: 'context-by-part',
        alt: 'The By part summary of Jill’s context: a bar in eight colored segments, and a table of each part’s tokens, share, and how it was measured, with Excerpt and context opened to three pieces',
        maxWidthPx: 480,
        ratio: '1732 / 636',
        callouts: [
          { label: '1', leftPercent: 1.6, topPercent: 10.6, widthPercent: 96.8, heightPercent: 7.8 },
          { label: '2', leftPercent: 1.6, topPercent: 53.6, widthPercent: 60, heightPercent: 24.8 },
          { label: '3', leftPercent: 1.6, topPercent: 83.6, widthPercent: 60, heightPercent: 6.6 }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'The bar', detail: 'one segment per part, sized by its share.' },
      { label: '2', term: 'A part, opened', detail: 'press an underlined name to see its pieces.' },
      { label: '3', term: 'Conversation', detail: 'the rest of the measured total.' }
    ]
  },
  {
    title: 'Earlier turns, and bookmarks that jump to them',
    tag: 'primer',
    body: (
      <>
        A long conversation shows its most recent turns. Choose <b>Show earlier turns</b> at the
        top of the thread to load older messages in place, a page at a time, each with its usual
        actions. A bookmark marked <b>Earlier in thread</b> now does the walking for you: open it
        from the <b>Notes</b> tab and the Workshop loads the pages it needs and scrolls to the
        message.
      </>
    ),
    note: (
      <>
        A bookmark more than about 300 turns back opens in the read-only reader instead. Press{' '}
        <b>Escape</b> to stop a jump; pages already loaded stay. Earlier turns are not kept when
        the window reloads or the conversation is replaced, and nothing about them changes what
        the personas remember.
      </>
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'figure',
        shot: 'earlier-turns-control',
        alt: 'The top of a Workshop thread: a Show earlier turns button reading 212 not shown, over the line They’re kept in full: export, bookmarks and the personas still have them, then the oldest message on screen',
        maxWidthPx: 440,
        ratio: '1376 / 294',
        callouts: [
          { label: '1', leftPercent: 33, topPercent: 7.4, widthPercent: 34, heightPercent: 26 }
        ]
      },
      {
        kind: 'figure',
        shot: 'bookmarks-earlier-in-thread',
        alt: 'The Notes tab’s Bookmarks list: three bookmarks, the first two tagged Earlier in thread, and All bookmarks',
        maxWidthPx: 300,
        ratio: '702 / 548',
        callouts: [
          { label: '2', leftPercent: 5.4, topPercent: 15.6, widthPercent: 82, heightPercent: 25 }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'Show earlier turns', detail: 'loads the page before the oldest turn on screen.' },
      { label: '2', term: 'Earlier in thread', detail: 'a bookmark outside what is shown; opening it loads its way there.' }
    ]
  },
  {
    title: 'Type @ to attach a project file',
    tag: 'primer',
    body: (
      <>
        Type <b>@</b> in the composer and a few letters of a file&rsquo;s name. A list of your
        configured project files opens above the composer: move with the arrow keys and press{' '}
        <b>Enter</b> or <b>Tab</b> to pick one, or choose <b>Browse project&hellip;</b> for the
        full picker. The file is staged as a pill above the composer and goes with your next
        message only.
      </>
    ),
    note: (
      <>
        The pill is what gets sent. The <b>@</b> text a pick leaves in your message is ordinary
        text: deleting it keeps the pill, and removing the pill keeps the text.{' '}
        <b>Escape</b> closes the list and keeps what you typed. The list shows files from the
        resource locations in sidebar settings.
      </>
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'figure',
        shot: 'composer-at-mention',
        alt: 'The Workshop composer with @chap typed and a Files list above it: four chapter files, the second highlighted, then Browse project',
        maxWidthPx: 480,
        ratio: '1716 / 622',
        callouts: [
          { label: '1', leftPercent: 1, topPercent: 17.6, widthPercent: 98, heightPercent: 10.8 },
          { label: '2', leftPercent: 1, topPercent: 45.4, widthPercent: 22, heightPercent: 10.6 }
        ]
      },
      {
        kind: 'figure',
        shot: 'composer-at-mention-pill',
        alt: 'The composer after a pick: a pill for 02-the-pool-of-tears.md, 2,134 words, marked rides the next message only, and the file’s @ text in the message',
        maxWidthPx: 480,
        ratio: '1716 / 334',
        callouts: [
          { label: '3', leftPercent: 0.4, topPercent: 2.4, widthPercent: 30.6, heightPercent: 19.6 }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'The file list', detail: 'narrows as you type; Enter or Tab picks the highlighted file.' },
      { label: '2', term: 'Browse project…', detail: 'opens the project picker for this message.' },
      { label: '3', term: 'The pill', detail: 'the file that will go with your next message.' }
    ]
  },
  {
    title: 'Memory controls, and answers about Prose Minion',
    tag: 'primer',
    body: (
      <>
        The <b>Memory</b> tab of conversation settings has two choices.{' '}
        <b>Suggest notes</b> sets how readily personas offer a memory note:{' '}
        <b>Sparingly</b>, <b>Readily</b>, or <b>Aggressively</b>.{' '}
        <b>List at the start of each conversation</b> sets how much of your memory each new
        conversation starts with: <b>Standard</b>, <b>Larger</b>, or <b>Largest</b>. You can also
        ask a persona how Prose Minion works. It can search the built-in help for features,
        commands, and settings, and it can list and read your Lexical Gravity lenses to explain
        what one does.
      </>
    ),
    note: (
      <>
        Both memory choices are saved as soon as you make them. The list size applies from the
        next conversation. A persona&rsquo;s help answers come from the reference bundled with
        this version, and a look-up shows as a card in the thread. Personas are also told when a
        note or edit they proposed did not reach you as a card.
      </>
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'figure',
        shot: 'memory-suggest-notes',
        alt: 'The Suggest notes row of the Memory tab: Sparingly selected, then Readily and Aggressively',
        maxWidthPx: 480,
        ratio: '1848 / 362',
        callouts: [
          { label: '1', leftPercent: 0.8, topPercent: 16, widthPercent: 98.4, heightPercent: 50 }
        ]
      },
      {
        kind: 'figure',
        shot: 'help-read-card',
        alt: 'A Prose Minion Help card in the thread, requested by Jill, and Jill’s reply explaining where the Suggest notes setting is',
        maxWidthPx: 440,
        ratio: '1736 / 916',
        callouts: [
          { label: '2', leftPercent: 2.6, topPercent: 10.2, widthPercent: 94.8, heightPercent: 10.2 }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'Suggest notes', detail: 'how readily personas offer a memory note.' },
      { label: '2', term: 'Prose Minion Help', detail: 'the section of the built-in help the persona read before answering.' }
    ]
  },
  {
    title: 'Selected Text on a message',
    tag: 'primer',
    body: (
      <>
        Ask about a few lines without changing your excerpt. Turn on{' '}
        <b>Include selected text</b> beside the composer, and whatever you select in the editor
        shows above it as a <b>Selected Text</b> pill, with its file, lines, and word count. It
        follows your selection until you send, then goes with that one message. Or right-click a
        selection and choose <b>Prose Minion</b> &rarr; <b>Add Selection to Workshop Message</b>{' '}
        to attach it by hand. The persona reads those lines as a selection, apart from the
        excerpt.
      </>
    ),
    note: (
      <>
        The toggle starts off and is remembered. A selection over 5,000 words is cut to its first
        5,000, and the pill says so before you send. The message carries the selection shown on
        the pill. If that selection is no longer available or the room has changed, the message
        is held back and your draft returned. <b>Send Selection to Workshop</b> is now
        named <b>Send to New Workshop Excerpt</b>.
      </>
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'figure',
        shot: 'selected-text-composer',
        alt: 'The Workshop composer with a Selected Text pill above it, naming a chapter file, lines 14 to 19 and 96 words, and the Include selected text toggle turned on',
        maxWidthPx: 480,
        ratio: '1886 / 370',
        callouts: [
          { label: '1', leftPercent: 1, topPercent: 3.8, widthPercent: 55.3, heightPercent: 18.6 },
          { label: '2', leftPercent: 6.8, topPercent: 61.7, widthPercent: 17.6, heightPercent: 22.6 }
        ]
      },
      {
        kind: 'figure',
        shot: 'selected-text-sent',
        alt: 'A sent Workshop message with its Selected Text pill above the bubble',
        maxWidthPx: 480,
        ratio: '1896 / 284',
        callouts: [
          { label: '3', leftPercent: 61.2, topPercent: 4.9, widthPercent: 38.1, heightPercent: 22.2 }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'Selected Text', detail: 'the editor’s selection, attached to your next message.' },
      { label: '2', term: 'Include selected text', detail: 'on: the pill follows what you select. Off: the current selection is not attached automatically.' },
      { label: '3', term: 'On the sent message', detail: 'the pill stays with the message it went with.' }
    ]
  },
  {
    title: 'Bigger reads, a folding rail, and Re-read from file',
    tag: 'primer',
    body: (
      <>
        Ask a persona to compare chapters and it can now read up to ten files in one go, shown as
        one card. Each read is fitted to the room left in the model&rsquo;s context window: a long
        file stops early and the persona can ask for the rest, instead of the turn failing. The
        side pane now folds away: press <b>Side pane</b> in the header, or the arrow on the rail,
        and it collapses to a strip of icons with its counts. And when a new conversation keeps a
        chapter from the last one, <b>Re-read from file</b> picks up the edits you made since;
        choosing <b>Continue</b> on a carried chapter re-reads it for you.
      </>
    ),
    note: (
      <>
        A conversation begun before this version keeps reading one file a call. In a narrow
        window the side pane starts folded and opens over the conversation. Re-read is offered
        for a chapter chosen as a file, not for pasted or selected text.
      </>
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'figure',
        shot: 'multi-file-read-card',
        alt: 'A Project Resources card in the thread: 3 files, two named and one more, requested by Jill, success',
        maxWidthPx: 480,
        ratio: '1684 / 186',
        callouts: [
          { label: '1', leftPercent: 1.9, topPercent: 51.9, widthPercent: 76.4, heightPercent: 29.9 }
        ]
      },
      {
        kind: 'figure',
        shot: 'rail-collapsed',
        alt: 'The Workshop with its side pane folded to a strip: an arrow, then the Material and Notes icons with their counts, beside the conversation',
        maxWidthPx: 400,
        ratio: '1120 / 416',
        callouts: [
          { label: '2', leftPercent: 0, topPercent: 4.3, widthPercent: 10, heightPercent: 76 }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'Project Resources', detail: 'one card for the whole read, naming its files.' },
      { label: '2', term: 'The strip', detail: 'Material and Notes with their counts; the arrow opens the pane again.' }
    ]
  },
  {
    title: 'Search your Dictionary history',
    tag: 'primer',
    body: (
      <>
        In the sidebar&rsquo;s Dictionary, open <b>Lookup history</b> and type in the new search
        box. It narrows the list as you type, matching each lookup&rsquo;s word, its context, and
        the file it came from. Tick <b>Also search definitions</b> to look inside the saved
        entries too: each result then shows the line that matched. Opening a result restores the
        lookup without generating it again.
      </>
    ),
    note: (
      <>
        Search reads your saved history only and asks no model. The arrows beside the Dictionary
        heading still step through the whole history, not just the matches.
      </>
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'figure',
        shot: 'dictionary-history-search',
        alt: 'The Dictionary’s Lookup history popup searched for sweet, with Also search definitions ticked, 3 of 8 matching, and the first result showing the matching line of its definition',
        maxWidthPx: 340,
        ratio: '960 / 668',
        callouts: [
          { label: '1', leftPercent: 2.1, topPercent: 27.5, widthPercent: 95.8, heightPercent: 13.7 },
          { label: '2', leftPercent: 2.1, topPercent: 40.4, widthPercent: 30, heightPercent: 8.1 },
          { label: '3', leftPercent: 5, topPercent: 78.4, widthPercent: 84, heightPercent: 12.9 }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'Search', detail: 'words, context, and file names, as you type.' },
      { label: '2', term: 'Also search definitions', detail: 'looks inside each saved entry.' },
      { label: '3', term: 'In the definition', detail: 'the line that matched, under its lookup.' }
    ]
  },
  {
    title: 'Suggested edits you apply',
    tag: 'primer',
    body: (
      <>
        A persona can now suggest an edit to a file in your project: a note, a chapter, or the
        excerpt&rsquo;s document. Each one arrives as a card under the reply, with every change
        shown against your text. <b>Apply</b> lands it as one change you can undo,{' '}
        <b>Review in editor&hellip;</b> opens it in VS Code&rsquo;s Refactor Preview first, and{' '}
        <b>Decline</b> sets it aside. The file is never saved for you. When a reply names small
        fixes or writes out a rewrite, chips in its footer ask its author for exactly those edits:
        one for the fixes, and one for each version of a rewrite.
      </>
    ),
    note: (
      <>
        Unasked, a persona keeps its edits to your chapters small; a larger rewrite comes only
        from a chip you pressed. Turn suggestions off under <b>Suggested file edits</b> on the
        Behavior tab of conversation settings.
      </>
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'figure',
        shot: 'reply-edit-offers',
        alt: 'The foot of a reply from Jill: its action row, then As edits with a 3 fixes chip and a chip for each rewrite, On the bank and In her head',
        maxWidthPx: 480,
        ratio: '1768 / 340',
        callouts: [
          { label: '1', leftPercent: 10, topPercent: 64.1, widthPercent: 8.1, heightPercent: 22.4 },
          { label: '2', leftPercent: 17.7, topPercent: 64.1, widthPercent: 22.3, heightPercent: 22.4 }
        ]
      },
      {
        kind: 'figure',
        shot: 'file-edit-card',
        alt: 'A suggested edit card for a chapter file: three Replace changes shown against the text, then Apply, Review in editor, and Decline',
        maxWidthPx: 480,
        ratio: '1684 / 544',
        callouts: [
          { label: '3', leftPercent: 2, topPercent: 25.6, widthPercent: 46, heightPercent: 46.3 },
          { label: '4', leftPercent: 2, topPercent: 80.9, widthPercent: 33.2, heightPercent: 13.2 }
        ]
      }
    ],
    legend: [
      { label: '1', term: '3 fixes', detail: 'asks the reply’s author for the small fixes it named, as a card.' },
      { label: '2', term: 'One chip per version', detail: 'asks for that written-out rewrite as an edit.' },
      { label: '3', term: 'Replace', detail: 'each change, shown against your text.' },
      { label: '4', term: 'Apply · Review in editor… · Decline', detail: 'nothing changes in the file until you choose.' }
    ]
  },
  {
    title: 'Project Memory',
    tag: 'primer',
    body: (
      <>
        Give the Workshop a memory of your project. Turn it on in conversation settings, on the{' '}
        <b>Memory</b> tab. With <b>Ask first</b>, a persona can suggest a note under its reply, and
        it is saved only when you choose <b>Save</b>. With <b>Save and tell me</b>, personas save
        what&rsquo;s worth keeping and say so in the thread. Save any message yourself with{' '}
        <b>Save to memory&hellip;</b>: the sheet opens at once, and a helper drafts its title,
        summary, and kind while you look. Later conversations in this project start knowing every
        memory&rsquo;s title and summary, and a persona opens the full note when it needs it.
      </>
    ),
    note: (
      <>
        Memories are Markdown files in <b>prose-minion/memory/</b>. Browse, edit, archive,
        or delete them from <b>Sessions</b> &rarr; <b>Memory&hellip;</b>. A suggested note that
        speaks of you near a personal word is held as a card for you to decide, and is never saved
        on its own. Project Memory is off until you turn it on.
      </>
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'figure',
        shot: 'memory-suggested-card',
        alt: 'A Suggested for project memory card under a reply, kind Canon, with its title, summary, and Save, Edit, and Dismiss',
        maxWidthPx: 480,
        ratio: '1684 / 352',
        callouts: [
          { label: '1', leftPercent: 2, topPercent: 70.5, widthPercent: 25, heightPercent: 20.4 }
        ]
      },
      {
        kind: 'figure',
        shot: 'memory-sheet-draft',
        alt: 'The Save to project memory sheet with its title, the Canon kind, and its summary filled in',
        maxWidthPx: 480,
        ratio: '2080 / 882',
        callouts: [
          { label: '2', leftPercent: 2.1, topPercent: 40.4, widthPercent: 95.8, heightPercent: 57.6 }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'Save · Edit… · Dismiss', detail: 'a suggested memory waits until you decide.' },
      { label: '2', term: 'Title, kind, and summary', detail: 'drafted for you; anything you type first is kept, and the note is never changed.' }
    ]
  },
  {
    title: 'Pinned context',
    tag: 'primer',
    body: (
      <>
        Stop attaching the same files to every conversation. Open conversation settings, choose
        the <b>Pinned context</b> tab, and pin the files most conversations need: characters,
        places, the project brief. Every new conversation in this project then starts with them
        attached, in your order, read as they are at that moment. In the Context panel a pinned
        file carries a pin. After the start, a conversation&rsquo;s context is its own: removing a
        file there doesn&rsquo;t unpin it, and unpinning doesn&rsquo;t remove it from conversations
        already under way.
      </>
    ),
    note: (
      <>
        <b>New session</b> and <b>New session: full reset</b> start with the pinned files;{' '}
        <b>full reset, empty context</b> starts with none. Opening, branching, or rewinding a
        saved session leaves its context as it was. The list is a file in your project,{' '}
        <b>prose-minion/pinned-context.json</b>, of up to 50 files.
      </>
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'figure',
        shot: 'pinned-context-tab',
        alt: 'The Pinned context tab: Attached to every new conversation, 4 files and about 2,814 words, and the first two pinned files with their order arrows, Open, and Unpin',
        maxWidthPx: 480,
        ratio: '1840 / 710',
        callouts: [
          { label: '1', leftPercent: 75.6, topPercent: 6.5, widthPercent: 22.3, heightPercent: 9 },
          { label: '2', leftPercent: 76.8, topPercent: 66, widthPercent: 20.6, heightPercent: 28.1 }
        ]
      },
      {
        kind: 'figure',
        shot: 'context-pinned-pills',
        alt: 'The Workshop Context panel: 3 attachments, 3 pinned, and three files each marked with a pin',
        maxWidthPx: 300,
        ratio: '694 / 384',
        callouts: [
          { label: '3', leftPercent: 3.5, topPercent: 42, widthPercent: 65.9, heightPercent: 53.9 }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'Files and words', detail: 'pinned files count toward the 100,000-word context limit.' },
      { label: '2', term: 'Arrows · Open · Unpin', detail: 'set the order, read a file, or take it off the list.' },
      { label: '3', term: 'Pin', detail: 'marks the pinned files attached to this conversation.' }
    ]
  },
  {
    title: 'Bookmarks, reactions, and a two-tab rail',
    tag: 'primer',
    body: (
      <>
        The rail now has two tabs: <b>Material</b> holds the excerpt, the context, and what a
        persona read in, and <b>Notes</b> holds your to-dos and bookmarks. <b>Bookmark</b> any
        message, then open <b>Sessions</b> &rarr; <b>Bookmarks&hellip;</b> to browse every
        bookmark in this conversation and in your saved sessions. Preview one, open its session at
        the bookmark, or choose <b>Remember this</b> to save it as a project memory. Ask a persona
        what you bookmarked, and it can look. Each reply&rsquo;s header now names the model that
        wrote it. And you can react: pick an emoji under a reply, and its author hears of it with
        your next message.
      </>
    ),
    note: (
      <>
        Now and then a persona reacts to your message too, at most once a reply. Turn that off
        with the <b>Workshop &rsaquo; Reactions: Personas</b> setting. A reaction never starts a
        model call on its own.
      </>
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'figure',
        shot: 'bookmarks-screen',
        alt: 'The Bookmarks screen: two bookmarks from this conversation with Remember this, Preview, and Show in thread, then one from a saved session with Open session and Open at bookmark',
        maxWidthPx: 480,
        ratio: '2360 / 906',
        callouts: [
          { label: '1', leftPercent: 67.4, topPercent: 25.1, widthPercent: 10.8, heightPercent: 10.6 },
          { label: '2', leftPercent: 83.4, topPercent: 83.9, widthPercent: 11.9, heightPercent: 10.6 }
        ]
      },
      {
        kind: 'figure',
        shot: 'reaction-palette',
        alt: 'The reaction palette open under a reply, in Warm, Curious, and Negative groups, and Jill’s heart on the corner of the writer’s message',
        maxWidthPx: 360,
        ratio: '1234 / 744',
        callouts: [
          { label: '3', leftPercent: 52.7, topPercent: 15.9, widthPercent: 33.1, heightPercent: 68.8 },
          { label: '4', leftPercent: 86.3, topPercent: 17.8, widthPercent: 11, heightPercent: 10.7 }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'Remember this', detail: 'saves the bookmarked message as a project memory, with its source.' },
      { label: '2', term: 'Open at bookmark', detail: 'opens the saved session at that message.' },
      { label: '3', term: 'Add reaction', detail: 'warm, curious, or negative; press yours again to remove it.' },
      { label: '4', term: 'A persona’s reaction', detail: 'sits on the corner of your own message.' }
    ]
  },
  {
    title: 'Lightbox',
    tag: 'primer',
    body: (
      <>
        Hold a chapter up to the light. Choose <b>Open File in Lightbox</b> from the editor&rsquo;s
        title bar or the Explorer, or select a passage and choose <b>Open Selection in Lightbox</b>{' '}
        from the editor&rsquo;s <b>Prose Minion</b> menu. The chapter opens on a board in its own
        tab, measured by code with no model and no cost: a paragraph ribbon, the numbers, top
        words, repeated phrases, and every sentence behind a count. Readings come only when you
        press <b>Run AI analyses</b>, and its estimated price shows first. Each reading cites a
        quote that code checks against your chapter, and a claim whose quote isn&rsquo;t found is
        withheld.
      </>
    ),
    note: (
      <>
        Pin a reading and choose <b>Bring to Workshop</b> to stage its claim and checked quotes
        above this composer. Nothing is sent until you send it.
      </>
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'figure',
        shot: 'lightbox-run-line',
        alt: 'The top of a Lightbox board: One chapter, held up to the light, the Measured and Read legend, and 6 calls, est. $0.28 beside Run AI analyses',
        maxWidthPx: 480,
        ratio: '1520 / 520',
        callouts: [
          { label: '1', leftPercent: 29.6, topPercent: 64.2, widthPercent: 65.4, heightPercent: 10.4 },
          { label: '2', leftPercent: 2, topPercent: 80.4, widthPercent: 39.6, heightPercent: 16.2 }
        ]
      },
      {
        kind: 'figure',
        shot: 'lightbox-checked-evidence',
        alt: 'A pinned reading’s evidence, checked against the text: three quotes with their paragraph numbers, each found verbatim',
        maxWidthPx: 280,
        ratio: '582 / 544',
        callouts: [
          { label: '3', leftPercent: 3.8, topPercent: 10.7, widthPercent: 92.4, heightPercent: 29 }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'Measured · Read', detail: 'solid tiles are counted by code; dashed tiles are a model’s reading.' },
      { label: '2', term: 'Run AI analyses', detail: 'reads the chapter with the lenses you turned on; its price shows first.' },
      { label: '3', term: 'Evidence', detail: 'each quote is checked against your chapter; one not found is withheld.' }
    ]
  },
  {
    title: 'Proofread and Craft Flags',
    tag: 'primer',
    body: (
      <>
        Right-click a Markdown or plain-text file and open the <b>Prose Minion</b> menu.{' '}
        <b>Proofread and Flag</b> marks spelling, punctuation, and consistency slips, and shifts in
        tense or person, in the editor and the Problems panel, with a quick fix where one is safe.
        By default, <b>Proofread and Fix</b> opens its fixes in VS Code&rsquo;s Refactor Preview:
        tick the ones to keep, then <b>Apply</b>. They land as one change you can undo, and the
        file is never saved for you. <b>Craft Flags</b> leaves line notes on clichés, register,
        gestures, and continuity, and shows its estimated cost before it sends anything.
      </>
    ),
    note: (
      <>
        Tense, agreement, and other judgment calls are only ever flagged, and Craft Flags never
        edits your text. Proofread has its own model; Craft Flags follows the Workshop&rsquo;s until
        you choose one.
      </>
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'figure',
        shot: 'draft-edit-menu',
        alt: 'The editor’s right-click Prose Minion menu: Open File in Lightbox, Proofread and Flag, Proofread and Fix, and Craft Flags',
        maxWidthPx: 420,
        ratio: '1106 / 268',
        callouts: [
          { label: '1', leftPercent: 72.3, topPercent: 32.8, widthPercent: 27.1, heightPercent: 35.1 },
          { label: '2', leftPercent: 72.3, topPercent: 76.5, widthPercent: 27.1, heightPercent: 18.7 }
        ]
      },
      {
        kind: 'figure',
        shot: 'proofread-refactor-preview',
        alt: 'Refactor Preview with two Proofread fixes, each with a tick box, above Apply and Discard',
        maxWidthPx: 440,
        ratio: '1000 / 275',
        callouts: [
          { label: '3', leftPercent: 5.8, topPercent: 30.9, widthPercent: 5.4, heightPercent: 30.5 },
          { label: '4', leftPercent: 3.8, topPercent: 79.6, widthPercent: 8.4, heightPercent: 16 }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'Proofread and Flag · Fix', detail: 'the whole file, or your selection.' },
      { label: '2', term: 'Craft Flags', detail: 'line notes, priced before anything is sent.' },
      { label: '3', term: 'Tick', detail: 'the fixes to keep.' },
      { label: '4', term: 'Apply', detail: 'one change you can undo; the file is not saved.' }
    ]
  },
  {
    title: 'Show vs. Tell Playground',
    tag: 'primer',
    body: (
      <>
        A Workshop widget for one beat. Open it from <b>Widgets</b>, paste or select a told beat,
        add the passage around it, and pick a point on a five-position continuum from{' '}
        <b>State it</b> to <b>Inhabit</b>. The readout under it shows what each position gains
        and costs, and no bar is a score. One generation returns four groups of alternatives:
        told cleanly, shown as evidence, shown from inside, and mixed. Keep the ones worth
        using, as prose or as a short direction, and commit them to the thread. Nothing is
        inserted into your manuscript: commit hands directions to the room.
      </>
    ),
    note: (
      <>
        Your host or a guest can suggest a beat to try and prefill the sheet, but only you
        generate, keep, and commit.
      </>
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'figure',
        shot: 'show-vs-tell-continuum',
        alt: 'The Show vs. Tell continuum with Hinge selected, its tradeoff line, and the seven-row tradeoff readout',
        maxWidthPx: 480,
        ratio: '1460 / 668',
        callouts: [
          { label: '1', leftPercent: 38.6, topPercent: 16.4, widthPercent: 22.6, heightPercent: 27.5 },
          { label: '2', leftPercent: 0.4, topPercent: 49, widthPercent: 98.4, heightPercent: 29 }
        ]
      },
      {
        kind: 'figure',
        shot: 'show-vs-tell-kept-variant',
        alt: 'A kept Shown as evidence variant with its direction, gains, costs, and Commit as: prose variant or direction only',
        maxWidthPx: 480,
        ratio: '1484 / 492',
        callouts: [
          { label: '3', leftPercent: 1.6, topPercent: 4.5, widthPercent: 7.6, heightPercent: 21 },
          { label: '4', leftPercent: 2.4, topPercent: 81, widthPercent: 42, heightPercent: 11 }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'Continuum', detail: 'five named positions, State it to Inhabit; Hinge is the default.' },
      { label: '2', term: 'Tradeoff readout', detail: 'what a position gains and costs; no model call, and no bar is a score.' },
      { label: '3', term: 'Keep', detail: 'the variants worth carrying into the room.' },
      { label: '4', term: 'Commit as', detail: 'the variant itself as prose, or only its direction.' }
    ]
  },
  {
    title: 'Chromatic Palettes',
    tag: 'primer',
    body: (
      <>
        Dictionary entries can now end with named color palettes. Each palette has a strip of
        its colors, and each swatch has a name, a short definition, and its hex value. A palette
        is <b>literal</b> when it shows colors the word names or implies (a pigment, a metal, a
        light) and <b>evocative</b> when it carries the word&rsquo;s mood. Turn palettes on or off
        with the <b>Chromatic Palettes</b> switch beside Topic &amp; Related Lexicon in the
        sidebar&rsquo;s <b>Dictionary</b> tab. It starts on and remembers your choice for both
        standard and Fast lookups.
      </>
    ),
    note: (
      <>
        When a host or guest looks up a word for you in the Workshop, palettes are left out. Hex
        values are approximations, not paint or Pantone matches.
      </>
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'figure',
        shot: 'dictionary-palette-switch',
        alt: 'The Chromatic Palettes switch in the Dictionary tab, turned on',
        maxWidthPx: 420,
        ratio: '748 / 228',
        callouts: [
          { label: '1', leftPercent: 75.5, topPercent: 33, widthPercent: 19.5, heightPercent: 33 }
        ]
      },
      {
        kind: 'figure',
        shot: 'dictionary-palette-entry',
        alt: 'The start of a Chromatic Palettes section: the Madder Dye Vat palette, with Alizarin Crimson and Madder Lake swatches',
        maxWidthPx: 320,
        ratio: '680 / 620',
        callouts: [
          { label: '2', leftPercent: 3.8, topPercent: 17.5, widthPercent: 89.2, heightPercent: 20.5 },
          { label: '3', leftPercent: 3.8, topPercent: 39, widthPercent: 89.2, heightPercent: 28.5 }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'Chromatic Palettes', detail: 'the switch beside Topic & Related Lexicon; on by default.' },
      { label: '2', term: 'Palette', detail: 'a title, literal or evocative, and a strip of its colors.' },
      { label: '3', term: 'Swatch', detail: 'a named color with a short definition and its hex value.' }
    ]
  },
  {
    title: 'Export a conversation',
    tag: 'primer',
    body: (
      <>
        Use <b>Sessions &rarr; Export&hellip;</b> to save a Workshop conversation as a file:{' '}
        <b>Markdown</b> to paste into another agent or your notes, <b>JSON</b> for scripts, or{' '}
        <b>styled HTML</b> to share or print to PDF. It holds your messages and every reply,
        including older turns the thread no longer shows. Files land in{' '}
        <b>prose-minion/exports/</b>, and an earlier export is never replaced: if the name is
        taken, a number is added. Markdown and JSON open beside the Workshop; HTML opens in your
        browser.
      </>
    ),
    note: (
      <>
        Exports leave out the excerpt text, context and attachment contents, widget payloads,
        tool evidence, and token usage. Attachments and widgets appear by name only.
      </>
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'figure',
        shot: 'sessions-menu-export',
        alt: 'The Sessions menu, opened from the session name, with Export… highlighted',
        maxWidthPx: 280,
        ratio: '692 / 530',
        callouts: [
          { label: '1', leftPercent: 15.6, topPercent: 1.9, widthPercent: 69.1, heightPercent: 16.9 },
          { label: '2', leftPercent: 4.6, topPercent: 78.5, widthPercent: 90.8, heightPercent: 16.6 }
        ]
      },
      {
        kind: 'figure',
        shot: 'export-transcript-formats',
        alt: 'Export transcript: Markdown, JSON, and Styled HTML, the export name, and its path under prose-minion/exports',
        maxWidthPx: 480,
        ratio: '1428 / 586',
        callouts: [
          { label: '3', leftPercent: 1.5, topPercent: 10.5, widthPercent: 96.9, heightPercent: 41.6 },
          { label: '4', leftPercent: 1.7, topPercent: 82.7, widthPercent: 96.6, heightPercent: 14.5 }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'Sessions menu', detail: 'opens from the session name in the header.' },
      { label: '2', term: 'Export…', detail: 'saves this conversation as a file.' },
      { label: '3', term: 'Format', detail: 'Markdown, JSON, or styled HTML.' },
      { label: '4', term: 'prose-minion/exports/', detail: 'where the file lands; an earlier export is never replaced.' }
    ]
  },
  {
    title: 'Personas can read your saved sessions',
    tag: 'primer',
    body: (
      <>
        Ask about earlier work, like a decision from last week or a to-do still open, and your
        host or a guest can look it up in the other sessions you&rsquo;ve saved by name in this
        project. They can list and search those sessions, read the turns that matter, and find
        to-dos. Each look-up shows in the thread as a <b>Session Recall</b> card, and the reply
        names the session and turns it used. They&rsquo;re reading saved records, not
        remembering, so check the cited turns before relying on an answer. Attachment contents,
        widget payloads, and hidden tool evidence stay out.
      </>
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'figure',
        shot: 'recall-card-and-reply',
        alt: 'A Session Recall card reading turns 12-19 of a saved session, above Jill’s reply citing that session and turns 14–17',
        maxWidthPx: 460,
        ratio: '1168 / 762',
        callouts: [
          { label: '1', leftPercent: 5.5, topPercent: 16.4, widthPercent: 79.8, heightPercent: 13.6 },
          { label: '2', leftPercent: 2, topPercent: 65.1, widthPercent: 78.6, heightPercent: 6.8 }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'Session Recall', detail: 'what a persona looked up, and in which saved session.' },
      { label: '2', term: 'Citation', detail: 'the reply names the session and turns, so you can check them.' }
    ]
  },
  {
    title: 'Prompt caching, with a cache clock',
    tag: 'primer',
    body: (
      <>
        Workshop asks Claude, and supported Alibaba/Qwen routes, to cache retained
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
    title: 'Room for more context',
    tag: 'primer',
    body: (
      <>
        Standing context holds up to <b>100,000 words</b>, and a single message can carry up
        to <b>seven attachments</b> of up to 10,000 words each. When you change standing context,
        Workshop sends only what you added, changed, or removed, not the whole list again. Your
        model still needs room for the excerpt, the conversation, and its reply: if a send is
        estimated to overflow a known model&rsquo;s window, Workshop stops before sending and gives
        you your draft back.
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
    title: 'Rewind, edit, and branch',
    tag: 'primer',
    body: (
      <>
        Replies and your own messages have actions underneath. <b>Rewind to here</b> returns
        the room to a reply: the thread, and what every participant remembers, go back to that
        point, and everything after it is removed. On a message you sent, <b>Edit from here</b>{' '}
        removes it and everything after it, then puts it back in the composer (or reopens its
        widget) so you can change it and send it again. <b>Branch from here</b> leaves this
        tab open and opens the saved branch in a new Workshop tab. Branch from a writer message
        to edit it in the new tab’s composer, or reopen its widget there. Save the session before you branch. Your excerpt and context
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
      { label: '3', term: 'Branch from here', detail: 'open a saved branch in a new Workshop tab.' }
    ]
  },
  {
    title: 'Craft Steering',
    tag: 'primer',
    /* "creative variations" stays lower case on purpose: in title case it is a
       Workshop widget's name, which the feature-boundary guard in
       boundaries.test.ts reserves for that widget's own family. */
    body: (
      <>
        An analysis tool under <b>Craft &amp; Voice</b>, inspired by Ursula K. Le Guin&rsquo;s{' '}
        <i>Steering the Craft</i>. It listens to sound, rhythm, and how each sentence carries you
        into the next. The report names what to preserve, audits sound and narrative control, and
        traces the handoffs between sentences. Its sample revisions and creative variations each
        explain what they gain and what they cost. Pauses, repetition, and fragments you meant
        are judged by their effect, not smoothed away. Run it from{' '}
        <b>Tools</b> on a pinned excerpt, or ask your host or a guest to run it on a passage from
        the conversation.
      </>
    ),
    note: (
      <>
        Craft Steering is in the sidebar&rsquo;s Writing Tools too, under Craft &amp; Voice.
      </>
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'figure',
        shot: 'composer-controls',
        alt: 'The composer control bar, with Tools highlighted',
        maxWidthPx: 560,
        ratio: '1320 / 338',
        callouts: [
          { label: '1', leftPercent: 77.2, topPercent: 52.5, widthPercent: 11.2, heightPercent: 22 }
        ]
      },
      {
        kind: 'figure',
        shot: 'tools-craft-steering',
        alt: 'The Tools picker, with the Craft Steering card selected',
        maxWidthPx: 460,
        ratio: '1242 / 364',
        callouts: [
          { label: '2', leftPercent: 2.7, topPercent: 9.3, widthPercent: 46.9, heightPercent: 81.4 }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'Tools', detail: 'runs a tool directly on the pinned excerpt.' },
      { label: '2', term: 'Craft Steering', detail: 'under Craft & Voice; one run, and the report lands in the thread.' }
    ]
  },
  {
    title: 'Topic & Related Lexicon',
    tag: 'primer',
    body: (
      <>
        Dictionary entries can end with an encyclopedia entry: the topics a word belongs to,
        related vocabulary, examples for your writing, and possible reference books for each
        topic. Turn it on or off with the <b>Topic &amp; Related Lexicon</b> switch above the
        lookup buttons in the sidebar&rsquo;s <b>Dictionary</b> tab. It starts on and remembers
        your choice for both standard and Fast lookups.
      </>
    ),
    note: (
      <>
        When a host or guest looks up a word for you in the Workshop, the encyclopedia entry is
        left out.
      </>
    ),
    wellTitle: 'Where to look',
    media: [
      {
        kind: 'figure',
        shot: 'dictionary-topic-switch',
        alt: 'The Topic & Related Lexicon switch in the Dictionary tab, turned on',
        maxWidthPx: 420,
        ratio: '948 / 208',
        callouts: [
          { label: '1', leftPercent: 80.6, topPercent: 32.2, widthPercent: 16, heightPercent: 35.6 }
        ]
      },
      {
        kind: 'figure',
        shot: 'dictionary-topic-entry',
        alt: 'The start of a Topic & Related Lexicon entry for "fricative"',
        maxWidthPx: 360,
        ratio: '964 / 696',
        callouts: [
          { label: '2', leftPercent: 4.4, topPercent: 4.9, widthPercent: 52.9, heightPercent: 10.3 }
        ]
      }
    ],
    legend: [
      { label: '1', term: 'Topic & Related Lexicon', detail: 'the switch above the lookup buttons; on by default.' },
      { label: '2', term: 'Encyclopedia entry', detail: 'added at the end: topics, related vocabulary, examples, and possible reference books.' }
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
      { label: '2', term: 'Settings gear', detail: 'open Settings and scroll to Context Resource Paths.' }
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
    title: 'Agents can work with your project',
    tag: 'primer',
    body: (
      <>
        With project paths configured, hosts and guests can <b>find and read relevant project
        files</b> when the conversation calls for them — you do not need to attach every file by
        hand. They can also use the dictionary, run analyses, and inspect a particular variation
        without derailing the main conversation. The <b>Widgets</b> browser opens the widgets that
        are ready now and previews the ones still to come.
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
      { label: '1', term: 'Widgets', detail: 'ready-now widgets open here; the rest are previews.' }
    ],
    guideLink: {
      lead: 'Project-file reading depends on the paths set in',
      label: 'Context Resource Paths',
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
