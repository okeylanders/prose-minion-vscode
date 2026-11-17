import {
  LEXICAL_GRAVITY_EARLY_CLOSED_ATTENTION,
  parseLexicalGravityLensJson,
  recloseLexicalGravityAttention
} from '@services/widgets/LexicalGravityLensReplyJson';
import * as modelJsonRepair from '@parsers/ModelJsonRepair';
import { ModelJsonParseError } from '@parsers/ModelJsonRepair';

/** A made-up lens body in the reply's shape, as a model writes it: compact, one line. */
const take = (variant: string) => ({
  name: 'Wonderland',
  variant,
  logic: {
    premise: 'Size decides who may speak.',
    attention: {
      foregrounds: ['who has grown', 'who has shrunk'],
      backgrounds: ['the riverbank', 'the hour']
    },
    axes: [{ id: 'size', name: 'Size', poles: ['small', 'tall'] }],
    guardrails: ['Never explain the bottle.']
  },
  sample: 'Alice held the bottle marked "DRINK ME" and waited.'
});

const reply = (...variants: string[]): string =>
  JSON.stringify({ version: 2, candidates: variants.map(take) });

const SEAM = '],"backgrounds":';

/** The model's slip: `attention` closed after `foregrounds`, and a brace too many after `backgrounds`. */
const slipOnce = (text: string, from = 0): string => {
  const at = text.indexOf(SEAM, from);
  return `${text.slice(0, at)}]},"backgrounds":${text.slice(at + SEAM.length)}`;
};

const meant = reply('Down the Rabbit-Hole', 'A Mad Tea-Party', 'The Croquet-Ground');

/** The writer's case: the second and third lenses slipped (the third first, so the second's offset still holds). */
const slippedTwice = (): string =>
  slipOnce(slipOnce(meant, meant.indexOf('The Croquet-Ground')), meant.indexOf('A Mad Tea-Party'));

describe('recloseLexicalGravityAttention', () => {
  it('leaves a reply with no such slip exactly as it came', () => {
    expect(recloseLexicalGravityAttention(meant)).toEqual({ text: meant, moved: 0, fenced: false });
  });

  it('closes attention after backgrounds in each lens that closed it early', () => {
    const written = slippedTwice();
    expect(written.split('}').length - written.split('{').length).toBe(2);
    expect(() => JSON.parse(written)).toThrow();

    const repaired = recloseLexicalGravityAttention(written);

    expect(repaired.moved).toBe(2);
    expect(repaired.text).toBe(meant);
  });

  it('moves the brace when the model wrote none after backgrounds', () => {
    // Balanced: `backgrounds` and everything after it stand in `logic`, and the text parses as written.
    const balanced = meant.replace(
      '],"backgrounds":["the riverbank","the hour"]}',
      ']},"backgrounds":["the riverbank","the hour"]'
    );
    expect(JSON.parse(balanced).candidates[0].logic.backgrounds).toEqual(['the riverbank', 'the hour']);

    const repaired = recloseLexicalGravityAttention(balanced);

    expect(repaired.moved).toBe(1);
    expect(JSON.parse(repaired.text)).toEqual(JSON.parse(meant));
  });

  it('moves nothing when the repaired text would not read', () => {
    // `backgrounds` last in `logic`, balanced: the brace after it is logic's own, so closing attention there
    // leaves logic open. The repair cannot be confirmed, and the reply stays as written.
    const lastInLogic = '{"version":2,"candidates":[{"logic":{"premise":"p","attention":{"foregrounds":["a"]},"backgrounds":["b"]},"sample":"s"}]}';
    expect(() => JSON.parse(lastInLogic)).not.toThrow();

    expect(recloseLexicalGravityAttention(lastInLogic)).toEqual({ text: lastInLogic, moved: 0, fenced: false });
  });

  it('moves nothing when the content guard does not confirm the repair', () => {
    const written = slippedTwice();
    const guard = jest.spyOn(modelJsonRepair, 'modelJsonContentMatches').mockReturnValue(false);
    try {
      expect(recloseLexicalGravityAttention(written)).toEqual({ text: written, moved: 0, fenced: false });
      // The guard was asked about the text as written and the repaired one.
      expect(guard).toHaveBeenCalledWith(written, meant);
      expect(() => parseLexicalGravityLensJson(written)).toThrow(ModelJsonParseError);
    } finally {
      guard.mockRestore();
    }
  });

  it('moves nothing when the text cannot be tokenized, so the guard has nothing to compare', () => {
    const written = `${slipOnce(meant)} and that is all`;
    expect(recloseLexicalGravityAttention(written)).toEqual({ text: written, moved: 0, fenced: false });
  });

  it('applies only to the exact shape: foregrounds alone, a list of strings, then backgrounds at once', () => {
    const shapes = [
      // attention holds another member before it closes
      '{"logic":{"attention":{"foregrounds":["a"],"note":"n"},"backgrounds":["b"]}}',
      // something stands between attention and backgrounds
      '{"logic":{"attention":{"foregrounds":["a"]},"axes":[],"backgrounds":["b"]}}',
      // foregrounds is not a list of strings
      '{"logic":{"attention":{"foregrounds":[{"a":1}]},"backgrounds":["b"]}}',
      // backgrounds is not a list of strings
      '{"logic":{"attention":{"foregrounds":["a"]},"backgrounds":"b"}}',
      // the words stand in a string, not as keys
      '{"sample":"\\"attention\\":{\\"foregrounds\\":[\\"a\\"]},\\"backgrounds\\":[\\"b\\"]}"}'
    ];
    for (const shape of shapes) {
      expect(recloseLexicalGravityAttention(shape)).toEqual({ text: shape, moved: 0, fenced: false });
    }
  });
});

describe('parseLexicalGravityLensJson', () => {
  it('reads a reply as written with no repair', () => {
    expect(parseLexicalGravityLensJson(meant)).toEqual({ value: JSON.parse(meant), repairs: [], reclosedAttentions: 0 });
  });

  it('reads the slipped reply whole, and names the repair by its own kind', () => {
    const read = parseLexicalGravityLensJson(slippedTwice());

    expect(read.value).toEqual(JSON.parse(meant));
    expect(read.repairs).toEqual([LEXICAL_GRAVITY_EARLY_CLOSED_ATTENTION]);
    expect(read.reclosedAttentions).toBe(2);
  });

  it('reads a slip beside the shared parser\'s own faults: a fence and a trailing comma', () => {
    const written = ['```json', slipOnce(meant).replace(/\}\]\}$/u, '},]}'), '```'].join('\n');

    const read = parseLexicalGravityLensJson(written);

    expect(read.value).toEqual(JSON.parse(meant));
    expect(read.repairs).toEqual(['code-fence', LEXICAL_GRAVITY_EARLY_CLOSED_ATTENTION, 'trailing-comma']);
  });

  it('leaves the shared parser\'s repairs to it, by kind', () => {
    const read = parseLexicalGravityLensJson(['```json', meant.replace(/\}\]\}$/u, '},]}'), '```'].join('\n'));
    expect(read.value).toEqual(JSON.parse(meant));
    expect(read.repairs).toEqual(['code-fence', 'trailing-comma']);
  });

  it('refuses what neither repair can read, in words that hold none of the reply', () => {
    const broken = meant.replace('"axes":[', '"axes":[}');
    let thrown: unknown;
    try {
      parseLexicalGravityLensJson(broken);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ModelJsonParseError);
    expect((thrown as Error).message).not.toMatch(/Rabbit|Wonderland|DRINK/);
  });
});
