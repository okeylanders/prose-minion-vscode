/**
 * Stock beats (ADR 2026-10-21, Amendment 2026-10-26: Slice 3c part 3): the
 * closed list, the beats a flag's words name, and each beat's count in the
 * narration, every form together. Text adapts public-domain *Alice*.
 */
import { STOCK_BEATS, stockBeatCounts, stockBeatsIn, type StockBeat } from '@/utils/craftFlags/stockBeats';
import { withPhraseScanLimit } from '@/__tests__/utils/craftFlags/phraseScanLimit';

const beat = (id: string): StockBeat => {
  const found = STOCK_BEATS.find((each) => each.id === id);
  if (!found) {
    throw new Error(`no beat ${id}`);
  }
  return found;
};
const count = (text: string, id: string, skipped: Array<{ start: number; end: number }> = []) =>
  stockBeatCounts(text, skipped).count(beat(id));

describe('STOCK_BEATS', () => {
  it('is the closed list the ADR names, each with a plural for its note', () => {
    expect(STOCK_BEATS.map((each) => [each.id, each.plural])).toEqual([
      ['nod', 'nods'],
      ['shrug', 'shrugs'],
      ['sigh', 'sighs'],
      ['smile', 'smiles'],
      ['grin', 'grins'],
      ['frown', 'frowns'],
      ['wink', 'winks'],
      ['smirk', 'smirks'],
      ['head-shake', 'head shakes'],
      ['eye-roll', 'eye rolls']
    ]);
  });
});

describe('stockBeatCounts', () => {
  it('counts every form of a beat together, case folded, at word boundaries', () => {
    expect(count('Alice nodded. The Rabbit nods. Nodding, she ran; a nod. Nod!', 'nod')).toBe(5);
    expect(count('She smiled, smiles, smiling, a smile.', 'smile')).toBe(4);
    expect(count('He grinned and grins; grinning; a grin.', 'grin')).toBe(4);
    expect(count('She sighed, sighs, sighing; a sigh. The sight of it.', 'sigh')).toBe(4);
    // Not inside other words.
    expect(count('The nodule, the grinder, the smiley, the shrugger.', 'nod')).toBe(0);
    expect(count('The nodule, the grinder, the smiley, the shrugger.', 'grin')).toBe(0);
  });

  it('counts a head shake and an eye roll by their phrases, whoever\'s head or eyes', () => {
    expect(count('She shook her head. They shook their heads. With a shake of the head, he left. Shaking his head.', 'head-shake')).toBe(4);
    expect(count('She shook the tablecloth. He shook his fist.', 'head-shake')).toBe(0);
    expect(count('She rolled her eyes. An eye roll; another eye-roll. He rolls his eyes.', 'eye-roll')).toBe(4);
    expect(count('The barrel rolled down the hill.', 'eye-roll')).toBe(0);
  });

  it('leaves out an occurrence that touches a skipped range: speech, protected regions', () => {
    const text = '“Do stop nodding,” said Alice, and her sister nodded.';
    expect(count(text, 'nod')).toBe(2);
    expect(count(text, 'nod', [{ start: 0, end: text.indexOf(' said') }])).toBe(1);
  });

  it('counts the stated limit: a form used for something else counts too', () => {
    expect(count('They sailed off to the land of Nod.', 'nod')).toBe(1);
  });

  it('scans the text once per beat, however many flags ask about it', async () => {
    const text = Array.from({ length: 50 }, () => 'Her sister nodded.').join(' ');
    const { scans } = await withPhraseScanLimit(60, () => {
      const counts = stockBeatCounts(text, []);
      for (let asked = 0; asked < 30; asked += 1) {
        expect(counts.count(beat('nod'))).toBe(50);
      }
    });
    // One walk: a search per match, and one that finds none.
    expect(scans).toBe(51);
  });
});

describe('stockBeatsIn', () => {
  it('names the listed beats a flag\'s words hold, in the order they stand, each once', () => {
    expect(stockBeatsIn('nodding again, smiled').map((each) => each.id)).toEqual(['nod', 'smile']);
    expect(stockBeatsIn('smiled, then nodded and nodded').map((each) => each.id)).toEqual(['smile', 'nod']);
    expect(stockBeatsIn('shrugged her shoulders').map((each) => each.id)).toEqual(['shrug']);
    expect(stockBeatsIn('shook his head with a sigh').map((each) => each.id)).toEqual(['head-shake', 'sigh']);
    expect(stockBeatsIn('eyes flew across the room')).toEqual([]);
  });

  it('is the same however often it is asked: a global pattern\'s position never leaks between searches', () => {
    expect(stockBeatsIn('she nodded').map((each) => each.id)).toEqual(['nod']);
    expect(stockBeatsIn('she nodded').map((each) => each.id)).toEqual(['nod']);
    expect(count('nodded nodded', 'nod')).toBe(2);
    expect(stockBeatsIn('nodded').map((each) => each.id)).toEqual(['nod']);
  });
});
