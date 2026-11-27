import { placeWorkshopHighlights } from '@/application/services/workshop/highlights/placeWorkshopHighlights';
import {
  extractWorkshopReplyControls,
  stripWorkshopReplyTrailersForRetention,
  stripWorkshopReplyTrailersForStreaming
} from '@/utils/workshopReplyControls';
import { decodeWorkshopHighlights, WORKSHOP_HIGHLIGHTS_TAG } from '@/utils/workshopReplyHighlights';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

const set = { title: 'Signature lines', places: [{ start: { quote: 'A private quote' }, note: 'A private note' }] };
const trailer = `<${WORKSHOP_HIGHLIGHTS_TAG}>${JSON.stringify(set)}</${WORKSHOP_HIGHLIGHTS_TAG}>`;
const options = { memoryOpen: false };

describe('Workshop highlights trailer', () => {
  it('keeps one tail set and strips its payload from prose, retention and diagnostics', () => {
    const reply = `Here they are.\n${trailer}\n${trailer}`;
    const controls = extractWorkshopReplyControls(reply, options);
    expect(controls.highlights).toEqual({ set, rejections: ['extra'] });
    expect(controls.rest.trim()).toBe('Here they are.');
    expect(controls.redacted).not.toMatch(/Signature lines|A private/);
    expect(stripWorkshopReplyTrailersForRetention(trailer)).toBe('Requested highlights.');
  });

  it('redacts malformed and incomplete frames as well as frames outside the tail', () => {
    const offTail = extractWorkshopReplyControls(`${trailer}\nSome prose`, options);
    expect(offTail.highlights).toEqual({ rejections: ['misplaced'] });
    const unclosed = extractWorkshopReplyControls(`<${WORKSHOP_HIGHLIGHTS_TAG}>A private note`, options);
    expect(unclosed.highlights).toEqual({ rejections: ['malformed:unclosed'] });
    expect(unclosed.redacted).not.toContain('A private note');
    expect(extractWorkshopReplyControls(`<${WORKSHOP_HIGHLIGHTS_TAG}>{</${WORKSHOP_HIGHLIGHTS_TAG}>`, options)
      .highlights).toEqual({ rejections: ['malformed'] });
  });

  it('keeps the frame hidden from the first streamed tag character', () => {
    for (let end = 1; end <= trailer.length; end += 1) {
      expect(stripWorkshopReplyTrailersForStreaming(`Here. ${trailer.slice(0, end)}`).trimEnd()).toBe('Here.');
    }
  });

  it('rejects extra fields, blank attributes and out-of-budget sets', () => {
    const { placesPerSet, titleCharacters } = PROMPT_BUDGETS.workshopHighlights;
    expect(decodeWorkshopHighlights(JSON.stringify({ ...set, file: 'elsewhere.md' }))).toBeUndefined();
    expect(decodeWorkshopHighlights(JSON.stringify({ ...set, title: 'a'.repeat(titleCharacters + 1) }))).toBeUndefined();
    expect(decodeWorkshopHighlights(JSON.stringify({ ...set, places: Array(placesPerSet + 1).fill(set.places[0]) })))
      .toBeUndefined();
    expect(decodeWorkshopHighlights(JSON.stringify({ ...set, places: [{ start: { quote: ' ' }, note: 'A note' }] })))
      .toBeUndefined();
  });
});

describe('Workshop highlights placement', () => {
  it('places repeated quotes with context and ordered spans against current text', () => {
    const text = 'New introduction. Red sweater. Blue sweater. Start here, then end there.';
    const result = placeWorkshopHighlights(text, 'markdown', {
      title: 'Clothing and action',
      places: [
        { start: { quote: 'sweater', before: 'Blue' }, note: 'Clothing' },
        { start: { quote: 'Start here' }, end: { quote: 'end there' }, note: 'Action' }
      ]
    });
    expect(result.placed.map(({ start, end, note }) => ({ start, quote: text.slice(start, end), note }))).toEqual([
      { start: text.lastIndexOf('sweater'), quote: 'sweater', note: 'Clothing' },
      { start: text.indexOf('Start here'), quote: 'Start here, then end there', note: 'Action' }
    ]);
    expect(result.dropped).toEqual({ unanchored: 0, ambiguous: 0, unordered: 0, protected: 0 });
  });

  it('counts missing, ambiguous, reversed and protected places without returning any ranges', () => {
    const result = placeWorkshopHighlights('---\ntitle: Private\n---\nFirst. Repeat. Repeat. Last.\n\n`secret`\n\n[link](target.md)', 'markdown', {
      title: 'A set',
      places: [
        { start: { quote: 'Missing' }, note: 'Missing' },
        { start: { quote: 'Repeat' }, note: 'Ambiguous' },
        { start: { quote: 'Last' }, end: { quote: 'First' }, note: 'Reversed' },
        { start: { quote: 'Private' }, note: 'Front matter' },
        { start: { quote: 'First' }, end: { quote: 'link' }, note: 'Crosses inline code' },
        { start: { quote: 'target.md' }, note: 'Link destination' }
      ]
    });
    expect(result.placed).toEqual([]);
    expect(result.dropped).toEqual({ unanchored: 1, ambiguous: 1, unordered: 1, protected: 3 });
  });
});
