/**
 * XML's character references in a trailer's attribute value (ADR 2026-11-20
 * S53), decoded as the capability codec's XML parser decodes text, so a
 * name escaped the same way reads the same in a reply trailer and in a
 * capability call (`Arts &amp; Crafts/*.md` is `Arts & Crafts/*.md` in both).
 * Pure, and bounded: one pass, each reference at most 8 digits.
 *
 * - The five predefined entities: `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`.
 * - Numeric references, `&#NNN;` and `&#xHHH;`, for a character XML allows
 *   (tab, line feed, carriage return, and U+0020 onward but surrogates and
 *   U+FFFE/U+FFFF). Whatever such a character is, the caller's own rules
 *   still judge it (a line feed is a control character there).
 * - Anything else, a bare `&` included, stays as written: the parser would
 *   refuse it, and a trailer is read leniently, but nothing is ever decoded
 *   from it.
 */

const PREDEFINED: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'' };

const REFERENCE = /&(?:(amp|lt|gt|quot|apos)|#([0-9]{1,8})|#x([0-9a-fA-F]{1,8}));/g;

function isXmlCharacter(code: number): boolean {
  return code === 0x9 || code === 0xa || code === 0xd
    || (code >= 0x20 && code <= 0xd7ff)
    || (code >= 0xe000 && code <= 0xfffd)
    || (code >= 0x10000 && code <= 0x10ffff);
}

/** `value` with its well-formed character references decoded, and nothing else changed. */
export function decodeXmlCharacterReferences(value: string): string {
  return value.replace(REFERENCE, (written: string, named?: string, decimal?: string, hex?: string) => {
    if (named) {
      return PREDEFINED[named];
    }
    const code = decimal !== undefined ? Number.parseInt(decimal, 10) : Number.parseInt(hex!, 16);
    return isXmlCharacter(code) ? String.fromCodePoint(code) : written;
  });
}
