/**
 * Reading a Workshop trailer frame's inside as elements (ADR 2026-11-04 D6;
 * ADR 2026-11-05 D2). Pure, shared by the project-memory proposal codec and
 * the file-edit codec, so both read their frames by one rule:
 *
 * - each element is `<name>…</name>`, alone: anything between elements but
 *   whitespace is `stray-text`;
 * - a name outside the format's closed list is `unknown-element`, unless the
 *   caller refuses it by name first (memory's provenance keys);
 * - an element with no closing tag is `unclosed-element`;
 * - a name the format lists as empty may also be written `<name/>`, and holds
 *   nothing (a file edit's `<excerpt/>`).
 *
 * Elements come back in the order written, their content untrimmed; what
 * each may hold is the codec's.
 */

/** One element of a frame, in the order written: its name and what it holds, untrimmed. */
export interface WorkshopTrailerElement {
  readonly name: string;
  readonly content: string;
}

export const WORKSHOP_TRAILER_READ_FAULTS = ['stray-text', 'unknown-element', 'unclosed-element'] as const;
export type WorkshopTrailerReadFault = typeof WORKSHOP_TRAILER_READ_FAULTS[number];

export interface WorkshopTrailerFormat<F extends string> {
  /** Every element name the format reads, lower-case. */
  readonly elements: readonly string[];
  /** Names the format writes self-closed (`<name/>`); each may also be written open and empty. */
  readonly empty?: readonly string[];
  /** A fault for a name refused before the closed list is read, or undefined. */
  readonly refuse?: (name: string) => F | undefined;
}

export type WorkshopTrailerRead<F extends string> =
  | { readonly kind: 'elements'; readonly elements: readonly WorkshopTrailerElement[] }
  | { readonly kind: 'fault'; readonly fault: WorkshopTrailerReadFault | F };

const OPENING = /<([a-z][a-z0-9-]*)\s*(\/?)>/iy;

/** A frame's inside (between its opening and closing tags), as elements or the fault that stops reading it. */
export function readWorkshopTrailerElements<F extends string = never>(
  inner: string,
  format: WorkshopTrailerFormat<F>
): WorkshopTrailerRead<F> {
  const elements: WorkshopTrailerElement[] = [];
  let at = 0;
  while (true) {
    while (at < inner.length && /\s/.test(inner[at])) {
      at += 1;
    }
    if (at >= inner.length) {
      return { kind: 'elements', elements };
    }
    OPENING.lastIndex = at;
    const opening = OPENING.exec(inner);
    if (!opening) {
      return fault('stray-text');
    }
    const name = opening[1].toLowerCase();
    const refused = format.refuse?.(name);
    if (refused) {
      return fault(refused);
    }
    if (!format.elements.includes(name)) {
      return fault('unknown-element');
    }
    const contentStart = at + opening[0].length;
    if (opening[2] === '/') {
      if (!format.empty?.includes(name)) {
        // Only an empty element may close itself; any other reads as text.
        return fault('stray-text');
      }
      elements.push({ name, content: '' });
      at = contentStart;
      continue;
    }
    const close = new RegExp(`</${name}\\s*>`, 'i').exec(inner.slice(contentStart));
    if (!close) {
      return fault('unclosed-element');
    }
    elements.push({ name, content: inner.slice(contentStart, contentStart + close.index) });
    at = contentStart + close.index + close[0].length;
  }
}

function fault<F extends string>(value: WorkshopTrailerReadFault | F): WorkshopTrailerRead<F> {
  return { kind: 'fault', fault: value };
}
