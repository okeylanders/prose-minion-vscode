/**
 * The Pinned context tab in words (ADR 2026-11-04 D8; Slice 0d's approved
 * boards, `docs/design/workshop-pinned-context/Main.dc.html`). Pure: it takes
 * the host's last answer, the room's attachments and the run state, and
 * returns everything the panel draws. The host owns the list and its words;
 * this computes only what follows from the rows: the running sum against the
 * context limit, "In this conversation" (the shared match rule, ADR D4), the
 * missing count and the attachments that could be pinned.
 *
 * Lines 0d doesn't draw (the list `busy` or `io`, and a list that can't be
 * read while the tab loads) are this slice's additions, in the design's
 * voice; the slice doc records them.
 */

import type {
  ContextPathGroup
} from '@shared/types/context';
import type {
  WorkshopContextAttachmentSnapshot,
  WorkshopPinnedContextPayload
} from '@messages';
import { workshopPinnedContextMatches } from '@shared/constants/workshopPinnedContext';

export interface WorkshopPinnedContextTabInput {
  /** The host's last answer; absent until it answers. */
  answer?: WorkshopPinnedContextPayload;
  attachments: readonly WorkshopContextAttachmentSnapshot[];
  /** A reply or the Context wizard is running: Attach missing waits. */
  running: boolean;
  /** A change is waiting for the host: the list's own controls wait. */
  pending: boolean;
}

export interface WorkshopPinnedContextRowView {
  readonly path: string;
  readonly position: number;
  readonly name: string;
  readonly group?: ContextPathGroup;
  readonly here: boolean;
  /** Amber: why new conversations start without it. */
  readonly issue?: string;
  /** Quiet: a head slice, as the pill says it. */
  readonly note?: string;
  readonly wordsText: string;
  readonly upDisabled: boolean;
  readonly downDisabled: boolean;
  readonly openDisabled: boolean;
  readonly unpinDisabled: boolean;
}

export interface WorkshopPinnedContextMeterView {
  readonly value: number;
  readonly max: number;
  readonly percent: number;
  readonly full: boolean;
  readonly valueText: string;
  readonly left: string;
  readonly right: string;
}

export interface WorkshopPinnedContextTabView {
  readonly loading: boolean;
  readonly notice?: { readonly title: string; readonly text: string };
  readonly changed: boolean;
  readonly summary: {
    readonly name: string;
    readonly description: string;
    readonly meter?: WorkshopPinnedContextMeterView;
    readonly chips: readonly { readonly text: string; readonly quiet: boolean }[];
  };
  readonly more?: string;
  readonly showStartNote: boolean;
  readonly rows: readonly WorkshopPinnedContextRowView[];
  readonly showList: boolean;
  readonly locked: boolean;
  readonly pinAttached: { readonly ids: readonly string[]; readonly disabled: boolean };
  readonly attachMissing: { readonly show: boolean; readonly count: number; readonly disabled: boolean; readonly runningNote: boolean };
  readonly showSourceNote: boolean;
  readonly file: { readonly warn: boolean; readonly description: string; readonly openDisabled: boolean };
  /** Words pinned context has left, for the picker's estimate. */
  readonly remainingWords: number;
  /** The pinned paths, for the picker's "Pinned" rows. */
  readonly pinnedPaths: readonly string[];
}

const fmt = (value: number): string => value.toLocaleString('en-US');
const filesLabel = (count: number): string => `${count} ${count === 1 ? 'file' : 'files'}`;

const FILE_DESCRIPTION = 'The list, in order, saved in this project. You can read and edit it in VS Code; edits apply to the next new conversation.';

/** "Title. Rest of the words." → the first sentence bold, the rest after it. */
function splitNotice(words: string): { title: string; text: string } {
  const at = words.indexOf('. ');
  return at < 0 ? { title: words, text: '' } : { title: words.slice(0, at + 1), text: words.slice(at + 2) };
}

type Problem = 'missing' | 'unreadable' | 'over';

/** "2 pinned files won't attach: one isn't there, and one can't be read. …" */
function problemsLine(problems: readonly Problem[], attaching: number): string {
  const count = (kind: Problem) => problems.filter((problem) => problem === kind).length;
  if (problems.length === 1) {
    const it = { missing: 'it isn’t there', unreadable: 'it can’t be read', over: 'it doesn’t fit' }[problems[0]];
    return `1 pinned file won’t attach: ${it}. New conversations start with the other ${attaching}. Nothing is unpinned for you.`;
  }
  const number = (value: number) => (value === 1 ? 'one' : String(value));
  const parts = [
    count('missing') > 0 ? `${number(count('missing'))} ${count('missing') === 1 ? 'isn’t' : 'aren’t'} there` : '',
    count('unreadable') > 0 ? `${number(count('unreadable'))} can’t be read` : '',
    count('over') > 0 ? `${number(count('over'))} ${count('over') === 1 ? 'doesn’t' : 'don’t'} fit` : ''
  ].filter(Boolean);
  const listed = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
  return `${problems.length} pinned files won’t attach: ${listed}. New conversations start with the other ${attaching}. Nothing is unpinned for you.`;
}

export function workshopPinnedContextTabView({ answer, attachments, running, pending }: WorkshopPinnedContextTabInput): WorkshopPinnedContextTabView {
  const budget = answer?.totals.budgetWords ?? 0;
  const unavailable = answer !== undefined && !answer.availability.available;
  const fileBroken = answer?.file.state === 'unreadable';
  const fileBusy = answer?.file.state === 'busy' || answer?.file.state === 'io';
  const locked = answer === undefined || unavailable || fileBroken || fileBusy;
  const entries = locked ? [] : answer.entries;
  const empty = !locked && entries.length === 0;

  let used = 0;
  let total = 0;
  let hereCount = 0;
  let missingCount = 0;
  const problems: Problem[] = [];
  const rows = entries.map((entry, index): WorkshopPinnedContextRowView => {
    const words = entry.words ?? 0;
    let issue: string | undefined;
    if (entry.state === 'missing') {
      issue = 'Not found. New conversations start without it. Unpin it, or put the file back.';
      problems.push('missing');
    } else if (entry.state === 'unreadable') {
      issue = `${entry.stateWords ?? 'Can’t read it.'} New conversations start without it.`;
      problems.push('unreadable');
    } else {
      total += words;
      if (used + words > budget) {
        issue = `Doesn’t fit: with the files above it, it would pass the ${fmt(budget)}-word context limit, so new conversations start without it.`;
        problems.push('over');
      } else {
        used += words;
      }
    }
    // The current room, from its own attachments: what it holds is its own copy, whatever the source's
    // health now or how a future room's template fits (PR #210 F04). The warnings above are the template's.
    const here = attachments.some((attachment) => workshopPinnedContextMatches(entry, attachment, answer!.platform));
    hereCount += here ? 1 : 0;
    // Readable files the room lacks; the room's own budget guard decides each at attach time.
    missingCount += !here && (entry.state === 'ready' || entry.state === 'head-sliced') ? 1 : 0;
    return {
      path: entry.path,
      position: index + 1,
      name: entry.label,
      ...(entry.group && entry.state !== 'missing' ? { group: entry.group } : {}),
      here,
      ...(issue ? { issue } : {}),
      ...(entry.state === 'head-sliced' && entry.stateWords ? { note: entry.stateWords } : {}),
      wordsText: entry.state === 'ready' || entry.state === 'head-sliced' ? `${fmt(words)} words` : '—',
      upDisabled: pending || index === 0,
      downDisabled: pending || index === entries.length - 1,
      openDisabled: pending || entry.state === 'missing',
      unpinDisabled: pending
    };
  });

  const pinnable = locked
    ? []
    : attachments.filter((attachment) =>
        attachment.kind === 'file'
        && (attachment.configuredResource !== undefined || attachment.relativePath !== undefined)
        && !entries.some((entry) => workshopPinnedContextMatches(entry, attachment, answer.platform)));

  const notice = answer === undefined
    ? undefined
    : !answer.availability.available
      ? splitNotice(answer.availability.words)
      : answer.file.state === 'unreadable' || answer.file.state === 'busy' || answer.file.state === 'io'
        ? splitNotice(answer.file.words)
        : undefined;

  const over = total > budget;
  const summary = answer === undefined
    ? { name: 'Reading pinned context…', description: 'The list is read from this project as the tab opens.', chips: [] }
    : unavailable
      ? { name: 'Nothing attaches', description: 'New conversations in this workspace start without pinned context.', chips: [{ text: 'unavailable', quiet: true }] }
      : fileBroken
        ? {
            name: 'Nothing attaches until the file is fixed',
            description: 'New conversations start without pinned context while pinned-context.json can’t be read. The files listed in it stay pinned.',
            chips: [{ text: 'file can’t be read', quiet: true }]
          }
        : fileBusy
          ? {
              name: 'The list couldn’t be shown just now',
              description: 'Nothing was changed. Close Conversation settings and open it again in a moment.',
              chips: [{ text: 'try again', quiet: true }]
            }
          : empty
            ? {
                name: 'Nothing pinned yet',
                description: 'Add files from your project, or pin what’s attached to this conversation now. Pinned files are attached to every new conversation in this project.',
                chips: [{ text: '0 files', quiet: true }]
              }
            : {
                name: 'Attached to every new conversation',
                description: `Pinned files are context: sent in full, and counted toward the ${fmt(budget)}-word context limit with anything else you attach. Each new conversation reads them as they are when it starts.`,
                meter: {
                  value: total,
                  max: budget,
                  percent: Math.min(100, Math.round((total / Math.max(1, budget)) * 100)),
                  full: over,
                  valueText: `about ${fmt(total)} of ${fmt(budget)} words`,
                  left: `Pinned · ${filesLabel(rows.length)}${problems.length > 0 ? ` · ${problems.length} won’t attach` : ''}`,
                  right: `about ${fmt(total)} of ${fmt(budget)} words`
                },
                chips: [
                  { text: filesLabel(rows.length), quiet: false },
                  { text: `≈ ${fmt(total)} words`, quiet: false },
                  { text: `${hereCount} in this conversation`, quiet: false }
                ]
              };

  const more = locked || problems.length === 0
    ? undefined
    : over
      ? `Pinned context comes to about ${fmt(total)} of ${fmt(budget)} words, probably because a file grew or the list was edited outside this tab. New conversations attach the files that fit, in order. Unpin a file to make room. Nothing is unpinned for you.`
      : problemsLine(problems, rows.length - problems.length);

  const showList = !locked && rows.length > 0;
  return {
    loading: answer === undefined,
    ...(notice ? { notice } : {}),
    changed: answer?.notice?.kind === 'changed',
    summary,
    ...(more ? { more } : {}),
    showStartNote: answer !== undefined && !unavailable && !fileBroken,
    rows,
    showList,
    locked,
    pinAttached: { ids: pinnable.map((attachment) => attachment.id), disabled: locked || pending || pinnable.length === 0 },
    attachMissing: { show: showList, count: missingCount, disabled: running || pending || missingCount === 0, runningNote: showList && running },
    showSourceNote: answer !== undefined && !unavailable && !fileBroken,
    file: {
      warn: fileBroken,
      description: unavailable
        ? 'There’s no project folder to save it in.'
        : fileBroken
          ? 'Open it to fix it. Prose Minion never rewrites a file it can’t read.'
          : answer?.file.state === 'absent'
            ? 'The file is made when you pin the first file.'
            : FILE_DESCRIPTION,
      openDisabled: answer === undefined || unavailable || answer.file.state === 'absent' || pending
    },
    remainingWords: Math.max(0, budget - total),
    pinnedPaths: entries.map((entry) => entry.path)
  };
}
