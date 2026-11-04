/**
 * The model a stamped reply's header names (Workshop Wayfinding ADR
 * 2026-11-03 D8 and D10, amended 2026-11-04): "Jill · Opus 5.5".
 *
 * The caller writes it after the participant with the thread's middle dot,
 * " · ". This is the one rule the thread's bubble header and the Markdown
 * and HTML export headers call, so the two can name a reply's model
 * differently only where their label lookups differ, never by rule. It lives in `shared/`
 * because the export cannot import `presentation/` and the webview cannot
 * import `application/`.
 *
 * | Stamp                                  | Model text                  |
 * |----------------------------------------|-----------------------------|
 * | none                                   | nothing                     |
 * | the provider named no model            | the requested label         |
 * | served exactly the requested model     | the requested label         |
 * | served others, not the requested model | served labels "via" request |
 * | served the requested model and others  | served labels, no "via"     |
 *
 * Scope plays no part: a dictionary card follows the same rule as a reply.
 *
 * Labels come from the caller's lookup; the raw id is the fallback. Model ids
 * and catalog names are external text, so every run of whitespace (a newline
 * included) reads as one space. A header is one line on every side, and a
 * Markdown heading can never be broken by a label.
 *
 * Never call this for a turn's projected entry, a room frame, provider
 * history or recall: the header is a rendering, and those carry no model.
 */

import type { WorkshopTurnModel } from '@messages';

/** A model's display name, or undefined (or blank) for its raw id. */
export type WorkshopModelLabelLookup = (modelId: string) => string | undefined;

export function workshopTurnModelLabel(
  model: WorkshopTurnModel | undefined,
  modelLabel: WorkshopModelLabelLookup
): string | undefined {
  if (!model) {
    return undefined;
  }
  const name = (modelId: string): string => oneLine(modelLabel(modelId)) || oneLine(modelId);
  const requested = model.requestedModelId;
  const served = [...new Set(model.servedModelIds)];
  if (served.length === 0 || (served.length === 1 && served[0] === requested)) {
    return name(requested);
  }
  const servedText = served.map(name).join(', ');
  return served.includes(requested) ? servedText : `${servedText} via ${name(requested)}`;
}

function oneLine(text: string | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}
