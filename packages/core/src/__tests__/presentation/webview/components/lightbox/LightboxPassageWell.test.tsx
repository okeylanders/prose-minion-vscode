/** @jest-environment jsdom */

/**
 * The inspector's wells and the hapax list as rendered (Slice 4E): the
 * sentences well is an ordered list in a labelled, focusable region, a row
 * across a paragraph break names both paragraphs, the row bound is stated,
 * and refusals read as notes; the hapax list pages its words with a button
 * that says how many are not shown yet, and each word is a board item.
 * Text from Lewis Carroll's "Alice's Adventures in Wonderland" (1865,
 * public domain) and lines written for these tests.
 */

import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { LightboxBoard } from '@messages';
import type { LightboxPassageWellView } from '@hooks/domain/lightbox/lightboxPassages';
import type { LightboxItemRef } from '@hooks/domain/lightbox/lightboxItems';
import type { LightboxItemBinding } from '@hooks/domain/lightbox/controllers/useLightboxFocus';
import { LightboxPassageWell } from '@components/lightbox/LightboxPassageWell';
import { LIGHTBOX_HAPAX_PAGE, LightboxHapaxList } from '@components/lightbox/LightboxHapaxList';
import { makeBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxBoardFixtures';

function binder() {
  const clicked: LightboxItemRef[] = [];
  const hovered: LightboxItemRef[] = [];
  const bind = (ref: LightboxItemRef): LightboxItemBinding => ({
    isHot: false,
    isSelected: false,
    handlers: {
      onMouseEnter: () => hovered.push(ref),
      onMouseLeave: () => undefined,
      onFocus: () => undefined,
      onBlur: () => undefined,
      onClick: () => clicked.push(ref)
    }
  });
  return { bind, clicked, hovered };
}

const PHRASE = { kind: 'phrase', phrase: 'end never' } as const;

const SENTENCES: LightboxPassageWellView = {
  kind: 'instances',
  status: 'ready',
  label: 'Sentences',
  regionLabel: 'Sentences holding “end never”',
  term: PHRASE,
  header: '2 instances in 3 sentences',
  passage: {
    kind: 'instances',
    instances: 2,
    sentences: 3,
    outside: 0,
    rows: [
      {
        sentences: [
          { paragraph: 1, sentence: 1, segments: [{ text: 'It was the ' }, { text: 'end', instances: [0] }] },
          { paragraph: 2, sentence: 1, segments: [{ text: 'Never', instances: [0] }, { text: ' mind.' }] }
        ]
      },
      { sentences: [{ paragraph: 2, sentence: 2, segments: [{ text: 'The ' }, { text: 'end never', instances: [1] }, { text: ' came.' }] }] }
    ],
    more: { rows: 3, sentences: 3, instances: 4, outside: 0 }
  },
  more: 'The well lists up to 50 rows: 3 more sentences with 4 instances are not listed.'
};

describe('the sentences well', () => {
  it('is an ordered list of rows in a labelled, focusable region, each row\'s paragraphs its addresses', () => {
    const { bind, clicked, hovered } = binder();
    render(<LightboxPassageWell view={SENTENCES} bind={bind} />);
    const well = screen.getByRole('region', { name: 'Sentences holding “end never”' });
    expect(well.getAttribute('tabindex')).toBe('0');
    const rows = within(well).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    // The row across the paragraph break names both paragraphs and marks the break.
    expect(within(rows[0]).getAllByRole('button').map((button) => button.textContent)).toEqual(['¶1', '¶2']);
    expect(rows[0].querySelector('.pm-lb-well-text')?.textContent).toBe('It was the end ¶ Never mind.');
    expect([...rows[0].querySelectorAll('mark')].map((mark) => mark.getAttribute('data-instances'))).toEqual(['0', '0']);

    fireEvent.mouseEnter(within(rows[1]).getByRole('button', { name: '¶2' }));
    fireEvent.click(within(rows[1]).getByRole('button', { name: '¶2' }));
    expect(hovered).toEqual([{ kind: 'paragraphs', from: 2, to: 2, via: PHRASE }]);
    expect(clicked).toEqual([{ kind: 'paragraphs', from: 2, to: 2, via: PHRASE }]);
    expect(screen.getByText('The well lists up to 50 rows: 3 more sentences with 4 instances are not listed.')).not.toBeNull();
    expect(screen.getByText(/^Sentences/).textContent).toBe('Sentences · 2 instances in 3 sentences');
  });

  it('shows an instance no sentence holds in its own stretch, lit and marked, with its paragraph\'s address (PR #161 N-01)', () => {
    const { bind, clicked } = binder();
    const APOSTROPHE = { kind: 'hapax', word: '\'' } as const;
    render(<LightboxPassageWell
      view={{
        kind: 'instances',
        status: 'ready',
        label: 'Sentences',
        regionLabel: 'Sentences holding “\'”',
        term: APOSTROPHE,
        header: '1 instance, outside any sentence',
        passage: {
          kind: 'instances',
          instances: 1,
          sentences: 0,
          outside: 1,
          rows: [{ outside: { paragraph: 1, segments: [{ text: '\'', instances: [0] }] } }],
          more: { rows: 0, sentences: 0, instances: 0, outside: 0 }
        }
      }}
      bind={bind}
    />);
    const [row] = within(screen.getByRole('region', { name: 'Sentences holding “\'”' })).getAllByRole('listitem');
    expect(row.classList.contains('is-outside')).toBe(true);
    expect(row.querySelector('.pm-lb-well-text')?.textContent).toBe('\' · outside any sentence');
    expect([...row.querySelectorAll('mark')].map((mark) => [mark.textContent, mark.getAttribute('data-instances')])).toEqual([['\'', '0']]);
    fireEvent.click(within(row).getByRole('button', { name: '¶1' }));
    expect(clicked).toEqual([{ kind: 'paragraphs', from: 1, to: 1, via: APOSTROPHE }]);
    expect(screen.getByText(/^Sentences/).textContent).toBe('Sentences · 1 instance, outside any sentence');
  });

  it('reads a refusal or a wait as a status note, with no well', () => {
    const { bind } = binder();
    render(<LightboxPassageWell
      view={{ kind: 'instances', status: 'refused', label: 'Sentences', regionLabel: 'Sentences holding “alice”', term: { kind: 'word', word: 'alice' }, note: 'This item is not on the board any more.' }}
      bind={bind}
    />);
    expect(screen.getByRole('status').textContent).toBe('This item is not on the board any more.');
    expect(screen.queryByRole('region')).toBeNull();
  });
});

describe('the hapax list', () => {
  function boardWithHapax(count: number): LightboxBoard {
    const board = makeBoard(6);
    const hapax = Array.from({ length: count }, (_unused, index) => ({ term: `word${String.fromCharCode(97 + (index % 26))}${index}`, written: `Word${index}`, paragraph: 1 + (index % 6) }));
    return { ...board, measured: { ...board.measured, hapax, headline: { ...board.measured.headline, hapaxCount: count } } };
  }

  it('shows a page of words, and the next page on request, saying how many are not shown yet', () => {
    const { bind } = binder();
    render(<LightboxHapaxList board={boardWithHapax(350)} bind={bind} />);
    expect(LIGHTBOX_HAPAX_PAGE).toBe(300);
    const well = screen.getByRole('region', { name: 'Words used once: 350' });
    expect(screen.getByText('350 words, in order of appearance')).not.toBeNull();
    // Read as one line, its label apart from its count.
    expect(document.querySelector('.pm-lb-hapax-head')?.textContent).toBe('Used once 350 words, in order of appearance');
    expect(well.querySelectorAll('.pm-lb-hapax-word')).toHaveLength(300);
    fireEvent.click(within(well).getByRole('button', { name: 'Show 50 more · 50 not shown yet' }));
    expect(well.querySelectorAll('.pm-lb-hapax-word')).toHaveLength(350);
    expect(within(well).queryByRole('button', { name: /more/ })).toBeNull();
  });

  it('names each word as written, hovers and pins it by its counted form, and says so when it has none', () => {
    const { bind, clicked } = binder();
    render(<LightboxHapaxList board={makeBoard(6)} bind={bind} />);
    const word = screen.getByRole('button', { name: 'daisy-chain' });
    expect(word.getAttribute('title')).toBe('Used once, in ¶3; counted as “daisychain”');
    expect(screen.getByRole('button', { name: 'tunnel' }).getAttribute('title')).toBe('Used once, in ¶4');
    fireEvent.click(word);
    expect(clicked).toEqual([{ kind: 'hapax', word: 'daisychain' }]);

    const empty = makeBoard(6);
    render(<LightboxHapaxList board={{ ...empty, measured: { ...empty.measured, hapax: [] } }} bind={bind} />);
    expect(screen.getByText('No word is used only once.')).not.toBeNull();
  });
});
