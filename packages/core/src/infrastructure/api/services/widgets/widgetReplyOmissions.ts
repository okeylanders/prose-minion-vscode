/**
 * The one tolerance a widget's reply codec has: a field whose empty value
 * means "nothing to report" may be left out.
 *
 * A model with no risk to flag often omits `invariantFlags` rather than
 * writing `[]`, and one with no dynamic to select omits the key rather than
 * writing `null`. Either way the reply says the same thing, so the codec reads
 * the omission as the empty value instead of discarding a usable reply.
 *
 * Nothing else is tolerated here. Each codec still names the field among its
 * optional keys, so unknown fields, wrong types and missing content fields
 * reject as before. Persisted widget configs stay exact: the host always
 * writes the field.
 */

/** The empty value a field takes when omitted. */
export type WidgetReplyEmptyValue = 'list' | 'null';

/**
 * Copies `object` with each listed field that is absent given its empty
 * value. A `null` where a list belongs is read as the empty list too. Each
 * field filled is reported to `onOmitted`, so a service can log how often a
 * model leaves it out.
 */
export function fillOmittedEmpties(
  object: Record<string, unknown>,
  empties: Readonly<Record<string, WidgetReplyEmptyValue>>,
  onOmitted?: (field: string) => void
): Record<string, unknown> {
  const filled: Record<string, unknown> = { ...object };
  for (const [field, empty] of Object.entries(empties)) {
    const absent = !Object.prototype.hasOwnProperty.call(object, field);
    if (!absent && !(empty === 'list' && object[field] === null)) {
      continue;
    }
    filled[field] = empty === 'list' ? [] : null;
    onOmitted?.(field);
  }
  return filled;
}
