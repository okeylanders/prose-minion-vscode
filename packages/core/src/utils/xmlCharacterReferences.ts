/**
 * XML's character references in a trailer's attribute value (ADR 2026-11-20
 * S53), decoded as the capability codec's XML parser decodes text, so a
 * name escaped the same way reads the same in a reply trailer and in a
 * capability call (`Arts &amp; Crafts/*.md` is `Arts & Crafts/*.md` in both).
 * Pure, and bounded: one pass, each reference at most
 * `REFERENCE_DIGITS` digits as written.
 *
 * - The five predefined entities: `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`.
 * - Numeric references, `&#NNN;` and `&#xHHH;`, with any leading zeros the
 *   parser accepts (`&#0000000065;` is `A`), for a character XML allows
 *   (tab, line feed, carriage return, and U+0020 onward but surrogates and
 *   U+FFFE/U+FFFF). The bound is on the value: past U+10FFFF, or outside
 *   those ranges, the reference stays as written. Whatever such a character
 *   is, the caller's own rules still judge it (a line feed is a control
 *   character there).
 * - Anything else, a bare `&` included, stays as written: the parser would
 *   refuse it, and a trailer is read leniently, but nothing is ever decoded
 *   from it.
 */

const PREDEFINED: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'' };

/**
 * The most digits a numeric reference may be written with, leading zeros
 * included, so a reference's text stays bounded. A longer one stays as
 * written. It is far past the parser's own need (U+10FFFF is seven decimal
 * digits, six hex), so padding is never what refuses a reference.
 */
const REFERENCE_DIGITS = 64;

const REFERENCE = new RegExp(
  `&(?:(amp|lt|gt|quot|apos)|#([0-9]{1,${REFERENCE_DIGITS}})|#x([0-9a-fA-F]{1,${REFERENCE_DIGITS}}));`,
  'g'
);

/** The most significant digits a code point up to U+10FFFF needs: 1114111, 10FFFF. */
const SIGNIFICANT_DIGITS = { decimal: 7, hex: 6 } as const;

function isXmlCharacter(code: number): boolean {
  return code === 0x9 || code === 0xa || code === 0xd
    || (code >= 0x20 && code <= 0xd7ff)
    || (code >= 0xe000 && code <= 0xfffd)
    || (code >= 0x10000 && code <= 0x10ffff);
}

/** The value `digits` writes, leading zeros aside; none when it needs more digits than any code point. */
function codePointOf(digits: string, radix: 10 | 16, significant: number): number | undefined {
  const value = digits.replace(/^0+(?=.)/, '');
  return value.length > significant ? undefined : Number.parseInt(value, radix);
}

/** `value` with its well-formed character references decoded, and nothing else changed. */
export function decodeXmlCharacterReferences(value: string): string {
  return value.replace(REFERENCE, (written: string, named?: string, decimal?: string, hex?: string) => {
    if (named) {
      return PREDEFINED[named];
    }
    const code = decimal !== undefined
      ? codePointOf(decimal, 10, SIGNIFICANT_DIGITS.decimal)
      : codePointOf(hex!, 16, SIGNIFICANT_DIGITS.hex);
    return code !== undefined && isXmlCharacter(code) ? String.fromCodePoint(code) : written;
  });
}
