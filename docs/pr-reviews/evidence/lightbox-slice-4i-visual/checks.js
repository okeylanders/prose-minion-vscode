/*
 * Checks the Slice 4I visual harness (harness.js) makes after PR #166's
 * review and the writer's decision 47, kept apart so the harness stays a
 * readable size:
 * - a control's price and name (F-01): an approximate total, never a cap,
 *   the Opinion's input bound said apart;
 * - the Opinion kept while a new one is weighed, and after a failed call
 *   (decision 47): its body still drawn, said to be the earlier one, no
 *   skeleton.
 */
const fs = require('fs');
const path = require('path');

// The frame's words for a kept Opinion, read from the component that says them.
const OPINION_SOURCE = fs.readFileSync(
  path.join(__dirname, '../../../../packages/core/src/presentation/webview/components/lightbox/LightboxOpinion.tsx'), 'utf8'
);
const KEEP = {
  reading: /reading: '([^']+)'/.exec(OPINION_SOURCE)[1],
  kept: /kept: '([^']+)'/.exec(OPINION_SOURCE)[1]
};

/** What a control's price and name may say (PR #166 F-01): approximate, never a cap; the Opinion's input bound said apart. */
function priceFaults(control, where) {
  const out = [];
  if (control.cost && !/^(≈ \$\d+\.\d\d|< \$0\.01)$/.test(control.cost)) { out.push(`${where}: priced "${control.cost}", not an approximate total`); }
  if (/up to|at most|max/i.test(`${control.cost ?? ''} ${control.name ?? ''} ${control.title ?? ''}`)) { out.push(`${where}: says its price is a maximum: "${control.name}"`); }
  if (control.group === 'F' && control.cost && !(control.name ?? '').endsWith(` · ${control.cost} · input at digest limit`)) {
    out.push(`${where}: the Opinion's name does not say its input is at the digest limit: "${control.name}"`);
  }
  if (control.title !== (control.reason ?? control.name)) { out.push(`${where}: its tooltip is "${control.title}"`); }
  return out;
}

/** What the Opinion's frame shows: its view, its notes, a skeleton. Runs in the page. */
function opinionProbe() {
  const frame = document.querySelector('section.pm-lb-opinion');
  const clean = (value) => (value ?? '').replace(/\s+/g, ' ').trim();
  return frame
    ? {
      view: clean(frame.querySelector('.pm-lb-op-body .pm-lb-op-head')?.textContent) || null,
      notes: [...frame.querySelectorAll('.pm-lb-reading-notice')].map((note) => clean(note.textContent)),
      skeleton: Boolean(frame.querySelector('.pm-lb-skeleton'))
    }
    : null;
}

/** The Opinion kept (decision 47): `reading` while the new one is weighed, `failed` after its call failed with `error`. */
function opinionKeptFaults(seen, want) {
  if (!seen) {
    return ['the Opinion is not on the board'];
  }
  const out = [];
  if (!seen.view) { out.push('the earlier Opinion is not drawn'); }
  if (seen.skeleton) { out.push('the Opinion shows a skeleton in place of the earlier one'); }
  const note = want.state === 'reading' ? KEEP.reading : `${KEEP.kept} ${want.error}`;
  if (!seen.notes.includes(note)) { out.push(`the Opinion's notes are ${JSON.stringify(seen.notes)}, not "${note}"`); }
  return out;
}

module.exports = { priceFaults, opinionProbe, opinionKeptFaults };
