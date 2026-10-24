/*
 * What the Slice 4J visual harness (harness.js) expects of each widget and
 * of each call's note, worked out from the board the host posted, kept apart
 * so the harness stays a readable size.
 *
 * Decision 49: a lens its call reads again keeps its reading on show, said
 * to be the earlier one, never a skeleton; a lens a call did not replace
 * keeps its reading under the quiet "Earlier reading" label with the reason;
 * a lens with nothing to keep shows a first read's states.
 * Decision 52: each call that failed, was stopped or was cut off is said
 * once, in a note under the run line, its whole message there and nowhere
 * else on the board; a widget of the call whose state is that message
 * points to the note in a short line.
 *
 * The words are read from the code that says them: the keep words and the
 * label from `lightboxProvenance.ts`, the Opinion's from `LightboxOpinion.tsx`,
 * the ceiling's prefix from `lightboxCallNotes.ts`. The short lines are the
 * slice's decided copy (decision 52), written here as the writer approved
 * them.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../../../packages/core/src');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const PROVENANCE = read('shared/constants/lightboxProvenance.ts');
const OPINION = read('presentation/webview/components/lightbox/LightboxOpinion.tsx');
const CEILING = read('shared/constants/lightboxCallNotes.ts');
const LABEL = /LIGHTBOX_EARLIER_LABEL = '([^']+)'/.exec(PROVENANCE)[1];
const KEEP = { reading: /reading: '([^']+)'/.exec(PROVENANCE)[1], kept: /kept: '([^']+)'/.exec(PROVENANCE)[1] };
const OPINION_KEEP = { reading: /reading: '([^']+)'/.exec(OPINION)[1], kept: /kept: '([^']+)'/.exec(OPINION)[1] };
const CEILING_PREFIX = /LIGHTBOX_CUT_REPLY_PREFIX = '([^']+)'/.exec(CEILING)[1];

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'G', 'F'];
const KINDS = {
  failed: { label: 'failed', short: 'failed', earlier: 'this call failed' },
  stopped: { label: 'stopped', short: 'was stopped', earlier: 'this call was stopped' },
  'cut-off': { label: 'cut off', short: 'was cut off at the output ceiling', earlier: 'this call was cut off' }
};

const groupOf = (board, id) => board.readings.find((group) => group.group === id);
const hasReading = (group, lens) => group.tiles.some((tile) => tile.lens === lens);

/** Each call that did not land, in run order; calls that did not land in the same words share one note. */
function callNotes(board) {
  const notes = [];
  for (const id of GROUPS) {
    const group = groupOf(board, id);
    let note;
    if (group.status === 'failed' || group.status === 'cancelled') {
      note = group.error ? { kind: group.status === 'failed' ? 'failed' : 'stopped', message: group.error } : undefined;
    } else if (group.status === 'ok') {
      const reasons = [...group.withheldBlocks.map((block) => block.reason), ...(group.earlierLenses || []).map((mark) => mark.reason)]
        .filter((reason) => reason.startsWith(CEILING_PREFIX));
      note = reasons.length > 0 ? { kind: 'cut-off', message: reasons.sort((a, b) => (a.includes(' finished.') ? 0 : 1) - (b.includes(' finished.') ? 0 : 1))[0] } : undefined;
    }
    if (!note) { continue; }
    const same = notes.find((entry) => entry.kind === note.kind && entry.message === note.message);
    if (same) { same.groups.push(id); } else { notes.push({ ...note, groups: [id] }); }
  }
  return notes.map((note) => ({
    ...note,
    label: `${note.groups.length > 1 ? 'Calls' : 'Call'} ${note.groups.join(', ')} · ${KINDS[note.kind].label}`
  }));
}

/** What a lens's widget must say, from the host's board. */
function expectedLens(board, lenses, lens) {
  const id = lenses[lens].group;
  const group = groupOf(board, id);
  const reading = hasReading(group, lens);
  const words = lens === 'opinion' ? OPINION_KEEP : KEEP;
  const note = callNotes(board).find((entry) => entry.groups.includes(id));
  const points = (reason) => note && reason !== undefined && (reason === note.message || (note.kind === 'cut-off' && reason.startsWith(CEILING_PREFIX)));
  if (group.status === 'running' && (group.pending || []).includes(lens)) {
    return reading ? { state: 'reanalyzing', text: words.reading } : { state: 'reading' };
  }
  const mark = reading ? (group.earlierLenses || []).find((entry) => entry.lens === lens) : undefined;
  if (mark) {
    return {
      state: 'earlier',
      text: points(mark.reason) ? `${LABEL} · ${KINDS[note.kind].earlier}: see its note by the run line.` : `${LABEL} ${words.kept} ${mark.reason}`,
      note: points(mark.reason) ? note : undefined
    };
  }
  if (!reading && note && (group.status === 'failed' || group.status === 'cancelled') && !group.lenses.includes(lens)) {
    return { state: 'pointer', text: `Call ${id} ${KINDS[note.kind].short}: see its note by the run line. Analyze to try again.`, note };
  }
  return { state: reading ? 'latest' : 'none' };
}

/** How many lenses on the board show an earlier reading. */
const earlierCount = (board) => board.readings.reduce((sum, group) =>
  sum + (group.earlierLenses || []).filter((mark) => hasReading(group, mark.lens)).length, 0);

/** What every widget of the board shows, read from the DOM. Runs in the page. */
function widgetProbe() {
  const clean = (value) => (value ?? '').replace(/\s+/g, ' ').trim();
  const described = (element) => (element.getAttribute('aria-describedby') || '').split(' ').filter(Boolean)
    .map((id) => clean(document.getElementById(id)?.textContent));
  const notesOf = (area) => ({
    live: [...area.querySelectorAll('.pm-lb-reading-notice.is-live')].map((note) => clean(note.textContent)),
    earlier: [...area.querySelectorAll('.pm-lb-earlier-note')].map((note) => clean(note.textContent)),
    pointer: [...area.querySelectorAll('.pm-lb-call-line')].map((note) => clean(note.textContent)),
    skeleton: Boolean(area.querySelector('.pm-lb-skeleton')),
    links: [...area.querySelectorAll('.pm-lb-call-link')].map((link) => link.getAttribute('aria-label')),
    text: clean(area.textContent)
  });
  const frames = [...document.querySelectorAll('section.pm-lb-tile, section.pm-lb-spark-lane')]
    .map((frame) => {
      const button = frame.querySelector('.pm-lb-tile-head .pm-lb-call-button, .pm-lb-spark-head .pm-lb-call-button');
      return button ? { lens: button.getAttribute('data-lens'), title: frame.getAttribute('aria-label'), describedBy: described(frame), ...notesOf(frame) } : null;
    })
    .filter(Boolean);
  const headline = document.querySelector('.pm-lb-headline-row');
  if (headline) {
    const state = document.querySelector('.pm-lb-headline-state');
    frames.push({ lens: 'headline', title: 'Headline', describedBy: state ? described(state) : [], ...notesOf(state ?? headline), text: clean(`${headline.textContent} ${state?.textContent ?? ''}`) });
  }
  const tension = document.querySelector('.pm-lb-tension-row');
  if (tension) {
    const kept = document.querySelector('.pm-lb-tension-kept');
    const area = document.createElement('div');
    area.append(tension.cloneNode(true), ...(kept ? [kept.cloneNode(true)] : []));
    frames.push({ lens: 'tension', title: 'Tension line', describedBy: [], ...notesOf(area) });
  }
  return {
    frames,
    notes: [...document.querySelectorAll('.pm-lb-call-notes > .pm-lb-call-note')].map((note) => ({
      text: clean(note.textContent), role: note.getAttribute('role'), id: note.id, focusable: note.tabIndex === -1
    })),
    body: clean(document.body.textContent),
    runNote: clean(document.querySelector('.pm-lb-run-note')?.textContent)
  };
}

/** What is wrong with the widgets and notes the page shows, against the host's board. */
function keepFaults(probe, board, lenses) {
  const out = [];
  const count = (text, part) => text.split(part).length - 1;
  const notes = callNotes(board);
  const shown = probe.notes.map((note) => note.text);
  const want = notes.map((note) => `${note.label} ${note.message}`);
  if (JSON.stringify(shown) !== JSON.stringify(want)) { out.push(`the call notes are ${JSON.stringify(shown)}, not ${JSON.stringify(want)}`); }
  for (const note of notes) {
    const role = note.kind === 'stopped' ? 'status' : 'alert';
    const seen = probe.notes.find((entry) => entry.text === `${note.label} ${note.message}`);
    if (seen && seen.role !== role) { out.push(`${note.label}: role "${seen.role}", not "${role}"`); }
    if (seen && !seen.focusable) { out.push(`${note.label}: the note cannot take the focus a widget's line sends`); }
    const times = count(probe.body, note.message);
    if (times !== 1) { out.push(`${note.label}: its message stands ${times} times on the board, not once`); }
  }
  for (const frame of probe.frames) {
    if (!lenses[frame.lens]) { continue; }
    const want = expectedLens(board, lenses, frame.lens);
    const where = `${frame.title} (${frame.lens})`;
    const group = groupOf(board, lenses[frame.lens].group);
    // Drawn: some words of the lens's tiles (a title, a claim, a trait's value) stand in its widget.
    const words = (value) => (typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(words)
      : value && typeof value === 'object' ? Object.entries(value).filter(([key]) => key !== 'id').flatMap(([, entry]) => words(entry)) : []);
    const drawn = group.tiles.filter((tile) => tile.lens === frame.lens)
      .some((tile) => words(tile).some((value) => value.length >= 16 && frame.text.includes(value.slice(0, 40))));
    switch (want.state) {
      case 'reanalyzing':
        if (!frame.live.includes(want.text)) { out.push(`${where}: read again, it says ${JSON.stringify(frame.live)}, not "${want.text}"`); }
        if (frame.skeleton) { out.push(`${where}: a skeleton in place of its earlier reading`); }
        if (!drawn && frame.lens !== 'tension') { out.push(`${where}: its earlier reading is not drawn while it is read again`); }
        break;
      case 'earlier':
        if (!frame.earlier.includes(want.text)) { out.push(`${where}: its earlier note is ${JSON.stringify(frame.earlier)}, not "${want.text}"`); }
        if (!drawn && frame.lens !== 'tension') { out.push(`${where}: its earlier reading is not drawn`); }
        if (want.note && frame.lens !== 'tension' && !frame.describedBy.includes(`${want.note.label} ${want.note.message}`)) {
          out.push(`${where}: not described by its call's note`);
        }
        break;
      case 'pointer':
        if (!frame.pointer.some((line) => line.endsWith(want.text))) { out.push(`${where}: its short line is ${JSON.stringify(frame.pointer)}, not "${want.text}"`); }
        if (frame.lens !== 'tension' && !frame.describedBy.includes(`${want.note.label} ${want.note.message}`)) {
          out.push(`${where}: not described by its call's note`);
        }
        break;
      case 'reading':
        if (!frame.skeleton && frame.lens !== 'tension' && frame.lens !== 'headline') { out.push(`${where}: read for the first time, it shows no skeleton`); }
        break;
      default:
        if (frame.earlier.length > 0 || frame.live.length > 0) { out.push(`${where}: a reading that is its latest is said to be earlier: ${JSON.stringify([...frame.earlier, ...frame.live])}`); }
        if (frame.pointer.length > 0) { out.push(`${where}: points to a call note it has none of: ${JSON.stringify(frame.pointer)}`); }
    }
    for (const note of notes) {
      if (frame.text.includes(note.message)) { out.push(`${where}: repeats ${note.label}'s message`); }
    }
    for (const link of frame.links) {
      if (!/^see its note: Calls? [A-G](, [A-G])* · (failed|stopped|cut off)$/.test(link ?? '')) { out.push(`${where}: its note link is named "${link}"`); }
    }
  }
  const kept = earlierCount(board);
  if (kept > 0 && !probe.runNote.includes(`${kept} earlier reading${kept === 1 ? '' : 's'} kept`)) {
    out.push(`the run note says "${probe.runNote}", not that ${kept} earlier readings are kept`);
  }
  return out;
}

module.exports = { callNotes, expectedLens, earlierCount, widgetProbe, keepFaults };
