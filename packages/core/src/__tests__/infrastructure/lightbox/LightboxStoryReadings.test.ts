/**
 * Lineage, subtext and Spark (ADR 2026-10-19 D7; Slice 4), through the
 * production codec, verifier, counter and assembly: a stance outside the
 * three withholds its story, a lineage block may be empty but always says
 * what it set aside, a said line must be dialogue, and a spark must be a
 * question with counted support. The worked examples read ¶1–¶8 of "Alice's
 * Adventures in Wonderland" (1865, public domain).
 */
import type { LightboxLensId, LightboxReadingGroupId, LightboxSparkTile, LightboxSubtextTile } from '@messages';
import { LIGHTBOX_TILE_REGISTER } from '@shared/constants/lightbox';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
import { createLightboxDialogueIndex } from '@/infrastructure/lightbox/LightboxDialogueAnchor';
import { LIGHTBOX_GATE_REASONS } from '@/infrastructure/lightbox/LightboxTileGates';
import { LIGHTBOX_SPARK_PHRASING_REASONS } from '@/infrastructure/lightbox/LightboxSparkPhrasing';
import { frame, framedJson, readWorkedExample } from './lightboxReadingFixtures';

/* eslint-disable @typescript-eslint/no-explicit-any -- worked-example bodies are edited as plain JSON. */
type Body = Record<string, any>;

const PARAGRAPHS = readWorkedExample('B').paragraphs;
const bodyOf = (group: LightboxReadingGroupId): Body => framedJson(readWorkedExample(group).response) as Body;

function read(group: LightboxReadingGroupId, lenses: LightboxLensId[], body: Body, paragraphs: readonly string[] = PARAGRAPHS) {
  const decoded = decodeLightboxGroup(frame(group, body), { group, lenses, columnCount: paragraphs.length });
  let id = 0;
  const assembled = assembleLightboxGroup(decoded, {
    verifier: createLightboxQuoteVerifier(paragraphs),
    counter: createLightboxTermCounter(paragraphs),
    mintId: () => `t${++id}`
  });
  return { decoded, assembled };
}

describe('lineage', () => {
  const lineage = (edit: (body: Body) => void) => {
    const body = bodyOf('C');
    edit(body);
    return read('C', ['lineage'], { version: 1, lineage: body.lineage });
  };

  it('withholds a story whose stance is not matches, departs or subverts, and keeps its sibling', () => {
    const { decoded, assembled } = lineage((body) => {
      body.lineage.items[0].stances[1].stance = 'echoes';
    });
    const block = decoded.blocks[0];
    expect(block.lens === 'lineage' && block.malformed).toEqual([{
      title: 'The white hart',
      reason: 'It broke the format: lineage.items[0].stances[1].stance must be matches, departs or subverts'
    }]);
    expect(assembled.tiles.map((tile) => `${tile.kind}:${tile.title}`)).toEqual(['lineage:The descent to the underworld']);
    expect(assembled.withheldClaims).toEqual([expect.objectContaining({ kind: 'lineage', lens: 'lineage', title: 'The white hart' })]);
  });

  it('withholds a story that gives one stance twice', () => {
    const { decoded } = lineage((body) => {
      body.lineage.items[1].stances[1].stance = 'matches';
    });
    const block = decoded.blocks[0];
    expect(block.lens === 'lineage' && block.malformed.map((item) => item.reason)).toEqual([
      'It broke the format: lineage.items[1].stances[1].stance must be a stance not already given for this story'
    ]);
  });

  it('accepts an empty lineage: no story drawn, its friction and set-aside list still stand', () => {
    const { decoded, assembled } = lineage((body) => {
      body.lineage.items = [];
      body.lineage.setAside = [];
      body.lineage.friction = 'No strong echo: a fall and a follow are too common to tie these paragraphs to one story.';
    });
    expect(decoded.withheld).toEqual([]);
    expect(assembled.tiles).toEqual([]);
    expect(assembled.withheldBlocks).toEqual([]);
    expect(assembled.frictions).toEqual([{
      lens: 'lineage',
      friction: 'No strong echo: a fall and a follow are too common to tie these paragraphs to one story.',
      setAside: []
    }]);
  });

  it('keeps the stories it checked and set aside with its friction, never as tiles', () => {
    const { assembled } = lineage(() => undefined);
    expect(assembled.frictions[0].setAside).toEqual([
      { title: 'Persephone', reason: 'No one takes her below: she jumps in after the Rabbit herself.' },
      { title: 'Orpheus', reason: 'Nobody has been lost below, so there is no one to bring back.' }
    ]);
    expect(assembled.tiles.map((tile) => tile.title)).not.toContain('Persephone');
    const descent = assembled.tiles.find((tile) => tile.kind === 'lineage' && tile.title === 'The descent to the underworld');
    expect(descent).toMatchObject({
      kind: 'lineage',
      source: 'Greek myth',
      stances: [{ stance: 'matches' }, { stance: 'subverts' }],
      paragraphs: [6, 7]
    });
  });

  it('withholds a block with no set-aside list, and a story it also sets aside', () => {
    expect(lineage((body) => { delete body.lineage.setAside; }).decoded.withheld)
      .toEqual([{ lens: 'lineage', reason: 'The lineage block broke the format: lineage is missing required field setAside.' }]);
    const both = lineage((body) => {
      body.lineage.setAside.push({ title: 'The White Hart', reason: 'Set aside and drawn at once.' });
    }).decoded.blocks[0];
    expect(both.lens === 'lineage' && both.malformed).toEqual([{
      title: 'The white hart',
      reason: 'It broke the format: It is also listed as checked and set aside, so it cannot be drawn.'
    }]);
  });

  it('counts a field the format does not define without naming it', () => {
    const block = lineage((body) => {
      body.lineage.items[0].mood = 'wistful';
    }).decoded.blocks[0];
    const reason = block.lens === 'lineage' ? block.malformed[0].reason : '';
    expect(reason).toBe('It broke the format: lineage.items[0] has 1 field the format does not define.');
    expect(reason).not.toContain('mood');
  });
});

describe('subtext', () => {
  const subtext = (edit: (body: Body) => void, paragraphs: readonly string[] = PARAGRAPHS) => {
    const body = bodyOf('B');
    edit(body);
    return read('B', ['subtext'], { version: 1, subtext: body.subtext }, paragraphs);
  };
  const pairs = (tiles: ReturnType<typeof subtext>['assembled']['tiles']) =>
    tiles.filter((tile): tile is LightboxSubtextTile => tile.kind === 'subtext');

  it('draws each pair with its said line found inside dialogue, leading its evidence, and its meant side as the claim', () => {
    const drawn = pairs(subtext(() => undefined).assembled.tiles);
    expect(drawn.map((tile) => [tile.speaker, tile.said.paragraph, tile.said.text])).toEqual([
      ['White Rabbit', 4, 'Oh dear! Oh dear! I shall be late!'],
      ['Alice', 8, 'after such a fall as this, I shall think nothing of tumbling down stairs!'],
      ['Alice', 2, 'and what is the use of a book']
    ]);
    for (const tile of drawn) {
      expect(tile.evidence[0]).toEqual(tile.said);
    }
    expect(drawn[0].claim).toBe('Being late is the whole of its worry; what it is late for never comes into it.');
  });

  it('withholds a said line that is narration, though the verifier finds it', () => {
    const { assembled } = subtext((body) => {
      body.subtext.items[0].said.quote = 'TOOK A WATCH OUT OF ITS WAISTCOAT-POCKET';
    });
    expect(pairs(assembled.tiles).map((tile) => tile.speaker)).toEqual(['Alice', 'Alice']);
    expect(assembled.withheldClaims).toEqual([expect.objectContaining({
      kind: 'subtext', title: 'White Rabbit', reason: LIGHTBOX_GATE_REASONS.saidNotDialogue.fresh
    })]);
  });

  it('withholds a said line that runs past the closing quotation mark', () => {
    const { assembled } = subtext((body) => {
      body.subtext.items[0].said.quote = 'I shall be late!” (when she thought it over afterwards';
    });
    expect(assembled.withheldClaims.map((claim) => claim.reason)).toEqual([LIGHTBOX_GATE_REASONS.saidNotDialogue.fresh]);
  });

  it('accepts a said line with its quotation marks, and straight-quoted dialogue', () => {
    expect(pairs(subtext((body) => {
      body.subtext.items[0].said.quote = '“Oh dear! Oh dear! I shall be late!”';
    }).assembled.tiles)).toHaveLength(3);
    const straight = PARAGRAPHS.map((text) => text.replace(/[“”]/g, '"'));
    expect(pairs(subtext(() => undefined, straight).assembled.tiles)).toHaveLength(3);
  });

  it('does not take single-quoted speech for dialogue (the shared matcher\'s documented rule)', () => {
    const singles = PARAGRAPHS.map((text, index) => (index === 3 ? text.replace('“', '‘').replace('”', '’') : text));
    const { assembled } = subtext(() => undefined, singles);
    expect(assembled.withheldClaims.map((claim) => [claim.title, claim.reason])).toEqual([
      ['White Rabbit', LIGHTBOX_GATE_REASONS.saidNotDialogue.fresh]
    ]);
  });

  it('withholds a pair whose said line is not found, even when its context quote is', () => {
    const { assembled } = subtext((body) => {
      body.subtext.items[0].said.quote = 'I shall be very late indeed!';
    });
    expect(assembled.withheldClaims).toEqual([expect.objectContaining({
      kind: 'subtext', title: 'White Rabbit', reason: LIGHTBOX_GATE_REASONS.saidNotFound.fresh,
      quotes: [{ paragraph: 4, reason: 'not-in-chapter' }]
    })]);
  });

  it('places a span within dialogue by every span the verifier finds for it, never a model\'s words', () => {
    const verifier = createLightboxQuoteVerifier(['She said she was late. “I am late,” she said.', 'No speech here at all.']);
    const index = createLightboxDialogueIndex(verifier);
    expect(index.holds({ paragraph: 1, text: 'late' })).toBe(true);
    expect(index.contains(1, 24, 34)).toBe(true);
    expect(index.contains(1, 0, 8)).toBe(false);
    expect(index.contains(3, 0, 1)).toBe(false);
    expect(index.holds({ paragraph: 1, text: 'she said' })).toBe(false);
    expect(index.holds({ paragraph: 1, text: '“I am late,”' })).toBe(true);
    expect(index.holds({ paragraph: 2, text: 'speech' })).toBe(false);
    expect(index.holds({ paragraph: 3, text: 'late' })).toBe(false);
  });

  describe('a said line chosen among every span the verifier finds (PR #151 F-04)', () => {
    const NARRATED = 'I don\'t know was written all over his face. “I don’t know,” he said.';
    const pairOn = (paragraphs: readonly string[], quote: string) => read('B', ['subtext'], {
      version: 1,
      subtext: {
        items: [{ speaker: 'Bill', said: { para: 1, quote }, meant: 'He knows, and will not say.', evidence: [] }],
        friction: 'One line is thin ground for a reading.'
      }
    }, paragraphs).assembled;
    const saidOf = (assembled: ReturnType<typeof pairOn>) => pairs(assembled.tiles).map((tile) => tile.said);

    it('finds the speech when an exact match in narration comes first', () => {
      const assembled = pairOn([NARRATED], 'I don\'t know');
      expect(saidOf(assembled)).toEqual([{ paragraph: 1, text: 'I don’t know', match: 'normalized' }]);
      expect(assembled.withheldClaims).toEqual([]);
    });

    it('chooses among normalized matches that differ in whitespace and typography', () => {
      const paragraph = 'I  don’t\nknow, he thought. “I don‘t   know,” he said.';
      expect(saidOf(pairOn([paragraph], 'I don\'t know'))).toEqual([{ paragraph: 1, text: 'I don‘t   know', match: 'normalized' }]);
    });

    it('takes speech that is the only match, exact or normalized, as before', () => {
      expect(saidOf(pairOn(['“I don’t know,” he said.'], 'I don’t know'))).toEqual([{ paragraph: 1, text: 'I don’t know', match: 'exact' }]);
      expect(saidOf(pairOn(['“I don’t know,” he said.'], 'I don\'t know'))).toEqual([{ paragraph: 1, text: 'I don’t know', match: 'normalized' }]);
    });

    it('still withholds a line found only in narration', () => {
      const assembled = pairOn(['I don\'t know was written all over his face.'], 'I don\'t know');
      expect(assembled.tiles).toEqual([]);
      expect(assembled.withheldClaims.map((claim) => claim.reason)).toEqual([LIGHTBOX_GATE_REASONS.saidNotDialogue.fresh]);
    });
  });
});

describe('Spark', () => {
  const spark = (edit: (body: Body) => void) => {
    const body = bodyOf('C');
    edit(body);
    return read('C', ['spark'], { version: 1, spark: body.spark });
  };
  const sparks = (tiles: ReturnType<typeof spark>['assembled']['tiles']) =>
    tiles.filter((tile): tile is LightboxSparkTile => tile.kind === 'spark');

  it('stands every spark on host-counted support and paragraph addresses', () => {
    const drawn = sparks(spark(() => undefined).assembled.tiles);
    expect(drawn.map((tile) => tile.title)).toEqual(['The empty jar', 'Late for what?', 'Nobody at home']);
    const late = drawn[1];
    expect(late.support).toEqual([
      { term: 'late', count: 1, paragraphs: [4] },
      { term: 'watch', count: 2, paragraphs: [4] }
    ]);
    const home = drawn[2];
    // The quote's ¶8 and the counted terms' paragraphs: the sister is in ¶2.
    expect(home.paragraphs).toEqual([2, 8]);
    expect(home.claim).toBe('Alice pictures how brave they will think her at home. Who is at home, and does anyone there know she has gone?');
    expect(LIGHTBOX_TILE_REGISTER.spark).toBe('counted-read');
  });

  it('withholds a spark phrased as an instruction, by the validator rule', () => {
    const block = spark((body) => {
      body.spark.items[0].question = 'Cut the jar: what is left on the shelf?';
    }).decoded.blocks[0];
    expect(block.lens === 'spark' && block.malformed).toEqual([{
      title: 'The empty jar',
      reason: `It broke the format: ${LIGHTBOX_SPARK_PHRASING_REASONS.instruction}`
    }]);
  });

  it.each([
    'Please add a line where Alice notices the cold. What does she fear?',
    'The Rabbit is late, so add a deadline. Who is waiting?',
    'Before she falls, show the sister looking up. What might she notice?',
    'Now cut the jar from the scene. What remains on the shelves?'
  ])('withholds an instruction behind a softening word or a set-up clause: %s (PR #151 F-03)', (question) => {
    const { decoded, assembled } = spark((body) => {
      body.spark.items[0].question = question;
    });
    const block = decoded.blocks[0];
    expect(block.lens === 'spark' && block.malformed).toEqual([{
      title: 'The empty jar',
      reason: `It broke the format: ${LIGHTBOX_SPARK_PHRASING_REASONS.instruction}`
    }]);
    expect(sparks(assembled.tiles).map((tile) => tile.title)).toEqual(['Late for what?', 'Nobody at home']);
  });

  it('withholds a spark that states a number or is not a question', () => {
    const numbered = spark((body) => {
      body.spark.items[1].question = 'The Rabbit says late 1 time. Who is it late for?';
    }).decoded.blocks[0];
    expect(numbered.lens === 'spark' && numbered.malformed.map((item) => item.reason))
      .toEqual([`It broke the format: ${LIGHTBOX_SPARK_PHRASING_REASONS.number}`]);
    const statement = spark((body) => {
      body.spark.items[1].question = 'The Rabbit is late for something the chapter never names.';
    }).decoded.blocks[0];
    expect(statement.lens === 'spark' && statement.malformed.map((item) => item.reason))
      .toEqual([`It broke the format: ${LIGHTBOX_SPARK_PHRASING_REASONS.notQuestion}`]);
  });

  it('withholds a spark none of whose words is in the chapter: it has no counted support', () => {
    const { assembled } = spark((body) => {
      body.spark.items[0].terms = ['quince', 'apricot'];
    });
    expect(assembled.withheldClaims).toEqual([expect.objectContaining({
      kind: 'spark', title: 'The empty jar', reason: LIGHTBOX_GATE_REASONS.sparkUncounted.fresh
    })]);
  });

  it('never takes a count from the model: a count field is withheld as undefined', () => {
    const block = spark((body) => {
      body.spark.items[0].count = 3;
    }).decoded.blocks[0];
    expect(block.lens === 'spark' && block.malformed[0].reason)
      .toBe('It broke the format: spark.items[0] has 1 field the format does not define.');
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */
