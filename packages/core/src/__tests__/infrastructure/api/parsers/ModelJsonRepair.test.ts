/**
 * The shared, feature-agnostic model-JSON parser (Lightbox Slice 4H, epic
 * decision 39): each structure-only repair, the content guard refusing any
 * change to a scalar, the salvage of a reply cut off at its output ceiling
 * (decision 40), and errors that carry positions and closed reasons, never
 * the reply's text. Each case is a small JSON text written for these tests;
 * Lightbox's worked examples go through it in `LightboxReadingRepair.test.ts`.
 */
import {
  ModelJsonParseError,
  describeModelJsonRefusal,
  modelJsonContentMatches,
  parseModelJson,
  salvageModelJson,
  type ModelJsonRefusal
} from '@parsers/ModelJsonRepair';

/** The error a text throws, or a failure when it reads. */
function refusedBy(read: () => unknown): ModelJsonParseError {
  try {
    read();
  } catch (error) {
    if (error instanceof ModelJsonParseError) {
      return error;
    }
    throw error;
  }
  throw new Error('expected a ModelJsonParseError');
}
const refusal = (text: string, closeMissingBrackets = true): ModelJsonRefusal =>
  refusedBy(() => parseModelJson(text, { closeMissingBrackets })).refusal;

describe('parseModelJson', () => {
  it('is JSON.parse when the text parses as it stands, with no repair', () => {
    expect(parseModelJson('{"a":[1,"b"],"c":null}')).toEqual({ value: { a: [1, 'b'], c: null }, repairs: [] });
  });

  it('drops stray closing brackets after a complete root, the real case', () => {
    const text = '{"version":1,"summary":{"movements":[{"id":"m1"}],"friction":"The chase could close with ¶4."}}}';
    expect(() => JSON.parse(text)).toThrow(/Unexpected non-whitespace character after JSON/);
    expect(parseModelJson(text)).toEqual({
      value: { version: 1, summary: { movements: [{ id: 'm1' }], friction: 'The chase could close with ¶4.' } },
      repairs: ['stray-closing-bracket']
    });
    expect(parseModelJson(`${text}]}\n`).repairs).toEqual(['stray-closing-bracket']);
  });

  it('drops trailing commas before a closing bracket, in objects and arrays', () => {
    expect(parseModelJson('{"a":[1,2,],"b":{"c":"d",},}')).toEqual({ value: { a: [1, 2], b: { c: 'd' } }, repairs: ['trailing-comma'] });
  });

  it('sets aside a code fence around the JSON, with or without its language', () => {
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ value: { a: 1 }, repairs: ['code-fence'] });
    expect(parseModelJson('```\n{"a":[1,]}\n```')).toEqual({ value: { a: [1] }, repairs: ['code-fence', 'trailing-comma'] });
  });

  it('closes brackets missing at the end only when the caller says the reply stopped with its frame closed', () => {
    const text = '{"version":1,"spark":{"items":[{"title":"The empty jar"}],"friction":"Thin ground."';
    expect(parseModelJson(text, { closeMissingBrackets: true })).toEqual({
      value: { version: 1, spark: { items: [{ title: 'The empty jar' }], friction: 'Thin ground.' } },
      repairs: ['missing-closing-bracket']
    });
    expect(refusal(text, false)).toEqual({ reason: 'root-not-closed' });
    expect(refusedBy(() => parseModelJson(text)).refusal.reason).toBe('root-not-closed');
    // A trailing comma before the missing brackets goes too.
    expect(parseModelJson('{"a":[1,2,', { closeMissingBrackets: true }).value).toEqual({ a: [1, 2] });
  });

  it('reads curly quotation marks used as a string\'s delimiters, and only where a token starts', () => {
    expect(parseModelJson('{“name”: “Portal descent”, "note": "She said “down” twice."}')).toEqual({
      value: { name: 'Portal descent', note: 'She said “down” twice.' },
      repairs: ['curly-quote-delimiters']
    });
  });

  it.each([
    ['a mismatched closing bracket', '{"a":[1,2}', { reason: 'closer-mismatch', at: 9 }],
    ['more JSON after the root', '{"a":1},{"b":2}', { reason: 'more-after-root', at: 7 }],
    ['a doubled comma', '{"a":1,,"b":2}', { reason: 'comma-out-of-place', at: 7 }],
    ['a key with no value at the end', '{"a":{"b":1},"c"', { reason: 'ends-inside-member' }],
    ['a bare word', '{"a":maybe}', { reason: 'not-json', at: 5 }],
    ['an unterminated string', '{"a":"the rest', { reason: 'unterminated-string', at: 5 }],
    ['a curly string holding a straight quote', '{"a":“He said "no"”}', { reason: 'unsafe-curly-quotes', at: 5 }],
    ['a curly string holding a curly quote', '{"a":“the “Rabbit” ran”}', { reason: 'unsafe-curly-quotes', at: 5 }],
    ['a curly string across a line', '{"a":“two\nlines”}', { reason: 'unsafe-curly-quotes', at: 5 }]
  ])('refuses %s, with a closed reason and a position only', (_case, text, expected) => {
    expect(refusal(text)).toEqual(expected);
  });

  it('throws an error that carries JSON.parse\'s position and host words, never the text', () => {
    const secret = 'Synthetic private line: she never told the Queen';
    const text = `{"note":"${secret}" maybe}`;
    const at = text.indexOf('maybe');
    const error = refusedBy(() => parseModelJson(text));
    expect(error.position).toBe(at);
    expect(error.refusal).toEqual({ reason: 'not-json', at });
    expect(error.message).toBe(`The JSON is invalid (at character ${at}): text that is not JSON at character ${at}`);
    expect(describeModelJsonRefusal(error.refusal)).toBe(`text that is not JSON at character ${at}`);
    expect(`${error.message} ${JSON.stringify(error)}`).not.toMatch(/Synthetic|Queen|maybe/);
  });
});

describe('the content guard', () => {
  it('accepts a repair that changes only brackets, commas, whitespace and delimiters', () => {
    expect(modelJsonContentMatches('{"a":[1,"b",],}}', '{"a": [1, "b"]}')).toBe(true);
    expect(modelJsonContentMatches('{“a”:"x"}', '{"a":"x"}')).toBe(true);
  });

  it.each([
    ['a changed string', '{"note":"The jar is empty."}', '{"note":"The jar is full."}'],
    ['a string with a quotation mark changed', '{"note":"She said “down”."}', '{"note":"She said \\"down\\"."}'],
    ['an added value', '{"a":[1,2]}', '{"a":[1,2,3]}'],
    ['a dropped value', '{"a":[1,2],"b":true}', '{"a":[1,2]}'],
    ['a number for a string', '{"a":"1"}', '{"a":1}'],
    ['a changed number', '{"a":0.4}', '{"a":0.45}'],
    ['two values swapped', '{"a":"x","b":"y"}', '{"a":"y","b":"x"}']
  ])('refuses a repair with %s', (_case, original, repaired) => {
    expect(modelJsonContentMatches(original, repaired)).toBe(false);
  });
});

describe('salvageModelJson', () => {
  it('keeps the root members that finished and names the one it was cut inside', () => {
    const text = '{"version":1,"template":{"name":"Portal descent","friction":"x"},"pressure":{"threads":[{"question":"Will she';
    expect(salvageModelJson(text)).toEqual({
      root: { version: 1, template: { name: 'Portal descent', friction: 'x' } },
      repairs: ['missing-closing-bracket'],
      cutKey: 'pressure'
    });
  });

  it('names no cut member when the reply stopped between members, inside the next key', () => {
    expect(salvageModelJson('{"version":1,"template":{"name":"Portal descent"},\n  "press')).toEqual({
      root: { version: 1, template: { name: 'Portal descent' } },
      repairs: ['missing-closing-bracket']
    });
  });

  it('names the member whose key arrived whole, even before its value began', () => {
    expect(salvageModelJson('{"version":1,"template":{"name":"x"},"summary":')).toMatchObject({ cutKey: 'summary' });
  });

  it('never trusts a number cut at the very end, or a member left open inside', () => {
    expect(salvageModelJson('{"version":1,"tension":{"scores":[3,4,1')).toEqual({
      root: { version: 1 },
      repairs: ['missing-closing-bracket'],
      cutKey: 'tension'
    });
  });

  it('reads a root that closed whole as nothing cut, with any stray bracket after it dropped', () => {
    expect(salvageModelJson('{"version":1,"a":{"b":2}}}')).toEqual({ root: { version: 1, a: { b: 2 } }, repairs: ['stray-closing-bracket'] });
  });

  it('keeps trailing commas out of what it keeps, and sets aside an opening fence', () => {
    expect(salvageModelJson('```json\n{"version":1,"a":{"b":[1,2,],},"c":{"d":"e')).toEqual({
      root: { version: 1, a: { b: [1, 2] } },
      repairs: ['code-fence', 'trailing-comma', 'missing-closing-bracket'],
      cutKey: 'c'
    });
  });

  it.each([
    ['a reply cut before its root began', '   ', { reason: 'no-root-object' }],
    ['prose where JSON belongs', 'Here is what the chapter', { reason: 'not-json', at: 0 }],
    ['a root that is a list', '[{"a":1},', { reason: 'no-root-object' }]
  ])('refuses %s', (_case, text, expected) => {
    expect(refusedBy(() => salvageModelJson(text)).refusal).toEqual(expected);
  });
});
