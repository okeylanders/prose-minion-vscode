/** @jest-environment jsdom */

/**
 * Craft steering in the webview (ADR 2026-10-19 D7 second addendum; Slice
 * 4F), through the real Lightbox root: each figure's counts measured and
 * drawn before any reading, a construction or a note lighting its
 * paragraphs, notes with their stance chips, a nudge under "Worth a look"
 * and its one example under "One way it could go", drawn apart from the
 * quote and never as one, what was withheld and why, a stale note, the
 * inspector's details and Bring by id. The host is played by window
 * messages; the counts are the board fixture's synthetic ones and the
 * readings come from group G's worked example through the production codec
 * and verifier, over "Alice's Adventures in Wonderland" (1865, public
 * domain).
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { LightboxBoard, LightboxReadingGroup } from '@messages';
import { MessageType } from '@messages';
import { LIGHTBOX_READING_GROUPS, emptyLightboxReadingGroup } from '@shared/constants/lightbox';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { makeBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxBoardFixtures';
import { readGroup } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxReadingBoardFixtures';

jest.mock('../../../presentation/webview/hooks/useVSCodeApi');
jest.mock('../../../presentation/webview/styles/lightbox/tokens.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/board.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/ribbon.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/tiles.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/rail.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/inspector.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/readings.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/gravity.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/story.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/craft.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/plot.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/opinion.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/steering.css', () => ({}));
jest.mock('../../../presentation/webview/styles/lightbox/boards.css', () => ({}));
// eslint-disable-next-line @typescript-eslint/naming-convention -- the mocked component's export name.
jest.mock('../../../presentation/webview/components/shared/PmLogo', () => ({ PmLogo: () => null }));

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { LightboxApp } from '@/presentation/webview/LightboxApp';

const fromHost = (type: MessageType, payload: object) =>
  act(() => {
    window.dispatchEvent(new MessageEvent('message', {
      data: { type, source: 'extension.lightbox', payload, timestamp: 1 }
    }));
  });

const litParagraphs = () =>
  Array.from(document.querySelectorAll('.pm-lb-col'))
    .flatMap((column, index) => (column.querySelector('.pm-lb-col-focus.is-lit') ? [index + 1] : []));

/** The counted board with group G as given, every other group unread. */
function boardWith(groupG?: LightboxReadingGroup): LightboxBoard {
  return {
    ...makeBoard(8),
    readings: LIGHTBOX_READING_GROUPS.map((group) => (group === 'G' && groupG ? groupG : emptyLightboxReadingGroup(group)))
  };
}
const notesOf = (board: LightboxBoard) => board.readings.flatMap((group) => group.tiles).filter((tile) => tile.kind === 'steering-note');

describe('LightboxApp: craft steering (Slice 4F)', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const posted = (type: MessageType) => vscode.postMessage.mock.calls.map(([message]) => message).filter((message) => message.type === type);
  const steeringTile = () => screen.getByLabelText('Craft steering');
  const figure = (label: string) => within(steeringTile()).getByLabelText(label);
  const noteWith = (why: string) => within(steeringTile()).getByText(why).closest('button') as HTMLButtonElement;

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  it('draws each figure\'s counts before any reading, and lights the paragraphs a figure or a construction holds', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith(), refusal: null });
    expect(steeringTile().getAttribute('data-register')).toBe('counted-read');
    const being = figure('Being verbs');
    expect(being.textContent).toContain('3 being verbs · 25 per 1,000 words');
    expect(being.textContent).toContain('2 in narration · 1 in dialogue');
    expect(being.textContent).toContain('1 in runs of short sentences (3 or more in a row, each 8 words or fewer)');
    expect(within(figure('Adverbs (-ly)')).getByText('Weak verbs among them: 1')).not.toBeNull();
    expect(within(being).getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      'be + adjective1', 'be + -ing1', 'be + past participle0', 'there or it + be1', 'other0'
    ]);
    fireEvent.mouseEnter(within(being).getByText('3 being verbs · 25 per 1,000 words').closest('button') as HTMLButtonElement);
    expect(litParagraphs()).toEqual([2, 4]);
    fireEvent.mouseEnter(within(being).getByText('be + -ing').closest('button') as HTMLButtonElement);
    expect(litParagraphs()).toEqual([4]);
    // Nothing is read yet: no stance, no nudge.
    expect(steeringTile().textContent).not.toMatch(/Leans|Earns|Worth a look/);
  });

  it('draws a reading per figure and its notes: a stance chip, the quote, the why, and a nudge only where a note leans or compensates', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith(readGroup('G')), refusal: null });
    const being = figure('Being verbs');
    expect(within(being).getByText('How it works here')).not.toBeNull();
    const earns = noteWith('The progressive keeps her idle thinking going while nothing happens, which is the scene’s whole point.');
    expect(within(earns).getByText('Earns')).not.toBeNull();
    expect(earns.textContent).not.toContain('Worth a look');
    const leans = noteWith('A state stands where the fall could act: the darkness is reported rather than met.');
    expect(within(leans).getByText('Leans')).not.toBeNull();
    expect(leans.textContent).toContain('Worth a look');
    expect(leans.textContent).toContain('An action that lets the dark do something may be worth a look, so the state becomes an event.');
    const compensates = noteWith('Very lifts a plain size word at the moment the fall begins.');
    expect(within(compensates).getByText('Compensates')).not.toBeNull();
    fireEvent.mouseEnter(leans);
    expect(litParagraphs()).toEqual([7]);
  });

  it('draws the one example under its own label, apart from the quote and never as one', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith(readGroup('G')), refusal: null });
    const leans = noteWith('A state stands where the fall could act: the darkness is reported rather than met.');
    const example = leans.querySelector('.pm-lb-steer-example') as HTMLElement;
    expect(within(example).getByText('One way it could go')).not.toBeNull();
    expect(within(example).getByText('it was too dark').className).toBe('pm-lb-steer-before');
    expect(within(example).getByText('the dark swallowed everything').className).toBe('pm-lb-steer-after');
    expect(within(example).getByText('an illustration, not your text')).not.toBeNull();
    // The only quotation on the note is the chapter's own line.
    expect(Array.from(leans.querySelectorAll('q')).map((quote) => quote.textContent)).toEqual(['it was too dark to see anything']);
    expect(example.querySelector('q')).toBeNull();
    // A note that leans with no example shows none.
    const plain = noteWith('Very tired names her boredom where the peeping at the book already shows it.');
    expect(plain.querySelector('.pm-lb-steer-example')).toBeNull();
  });

  it('says why a note or an example was withheld, in the host\'s words', () => {
    const withheld = readGroup('G', {
      mutate: (body) => {
        body.steering.figures[0].notes[1].nudge = 'Try an action that lets the dark do something.';
        body.steering.figures[2].notes[0].example = { before: 'nothing so VERY remarkable', after: 'nothing remarkable' };
      }
    });
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith(withheld), refusal: null });
    expect(steeringTile().textContent).toContain('Being verbs · note II');
    expect(steeringTile().textContent).toContain('Its nudge was withheld. It gives an order: craft steering names a move worth a look, and the call is yours.');
    const earns = noteWith('The capitals mock how calmly she takes a talking rabbit: the intensifier is the joke.');
    expect(earns.textContent).toContain('Example withheld');
    expect(earns.textContent).toContain('A note that earns its place shows no example, so this one is not shown.');
    expect(earns.querySelector('.pm-lb-steer-example')).toBeNull();
  });

  it('draws a note in dialogue with its stance and the host\'s line where a nudge would be, beside a narration note with one (epic decision 26)', () => {
    const reason = 'Its instance is in dialogue, the character\'s voice, so no nudge or example the reading gave is shown.';
    const spoken = readGroup('G', {
      mutate: (body) => {
        // ¶4's "I shall be late" is the Rabbit's line, inside double quotation marks.
        body.steering.figures[0].notes.push({
          para: 4, quote: 'I shall be late', stance: 'leans', why: 'The Rabbit’s fret sits in a plain future state.',
          nudge: 'A verb for his hurry may be worth a look.', example: { before: 'I shall be late', after: 'I run late' }
        });
      }
    });
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith(spoken), refusal: null });
    const voice = noteWith('The Rabbit’s fret sits in a plain future state.');
    expect(within(voice).getByText('Leans')).not.toBeNull();
    expect(voice.textContent).not.toContain('Worth a look');
    expect(voice.textContent).not.toContain('A verb for his hurry');
    expect(voice.querySelector('.pm-lb-steer-example')).toBeNull();
    expect(voice.querySelector('.pm-lb-steer-voice')?.textContent).toBe(`In dialogue ${reason}`);
    const narration = noteWith('A state stands where the fall could act: the darkness is reported rather than met.');
    expect(narration.textContent).toContain('Worth a look');
    expect(narration.querySelector('.pm-lb-steer-example')).not.toBeNull();
    expect(narration.querySelector('.pm-lb-steer-voice')).toBeNull();
    fireEvent.click(voice);
    const inspector = screen.getByLabelText('Inspector');
    expect(within(inspector).getByText('In dialogue')).not.toBeNull();
    expect(within(inspector).getByText(reason)).not.toBeNull();
    expect(within(inspector).queryByText('Worth a look')).toBeNull();
  });

  it('marks a note that earns in dialogue with the host\'s line too, on the tile and in the inspector (PR #162 N-01)', () => {
    const line = 'Its instance is in dialogue, the character\'s voice.';
    const spoken = readGroup('G', {
      mutate: (body) => {
        body.steering.figures[0].notes.push({
          para: 4, quote: 'I shall be late', stance: 'earns', why: 'The Rabbit’s fret is his own, in his own plain words.',
          nudge: null, example: null
        });
      }
    });
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith(spoken), refusal: null });
    const voice = noteWith('The Rabbit’s fret is his own, in his own plain words.');
    expect(within(voice).getByText('Earns')).not.toBeNull();
    expect(voice.querySelector('.pm-lb-steer-voice')?.textContent).toBe(`In dialogue ${line}`);
    // A note that earns in narration has no line.
    const narration = noteWith('The progressive keeps her idle thinking going while nothing happens, which is the scene’s whole point.');
    expect(narration.querySelector('.pm-lb-steer-voice')).toBeNull();
    fireEvent.click(voice);
    const inspector = screen.getByLabelText('Inspector');
    expect(within(inspector).getByText('In dialogue')).not.toBeNull();
    expect(within(inspector).getByText(line)).not.toBeNull();
  });

  it('says on the tile when its readings were read against an earlier version of the chapter', () => {
    const read = readGroup('G');
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith({ ...read, staleLenses: [{ lens: 'steering', readAgainst: 'old-hash' }] }), refusal: null });
    expect(within(steeringTile()).getByText('Stale')).not.toBeNull();
  });

  it('opens a note in the inspector with its stance, nudge and example, and brings it by its id only', () => {
    const board = boardWith(readGroup('G'));
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board, refusal: null });
    fireEvent.click(noteWith('A state stands where the fall could act: the darkness is reported rather than met.'));
    const inspector = screen.getByLabelText('Inspector');
    expect(within(inspector).getByText('Leans: The sentence leans on it where another choice could carry the meaning.')).not.toBeNull();
    expect(within(inspector).getByText('it was too dark → the dark swallowed everything (an illustration, not your text)')).not.toBeNull();
    expect(within(inspector).getByText('Each quote holds one, checked by the detector that counted the figure')).not.toBeNull();
    fireEvent.click(within(inspector).getByRole('button', { name: 'Bring to Workshop →' }));
    const leaning = notesOf(board).find((tile) => tile.title === 'Being verbs · note II');
    expect(posted(MessageType.LIGHTBOX_HAND_OFF)).toEqual([expect.objectContaining({
      payload: { kind: 'tile', boardId: board.boardId, tileId: leaning?.id }
    })]);
  });

  it('lists craft steering on the rail as call G, which the writer can turn off', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith(), refusal: null });
    const lenses = screen.getByLabelText('Lenses');
    const toggle = within(lenses).getByRole('checkbox', { name: /^Craft steering/ });
    expect(toggle.closest('label')?.textContent).toBe('Craft steeringcall G');
    expect(lenses.textContent).toContain('as up to 7 grouped calls');
    fireEvent.click(toggle);
    expect(posted(MessageType.LIGHTBOX_SET_LENSES).at(-1)).toEqual(expect.objectContaining({
      payload: expect.objectContaining({ lensesOff: ['steering'] })
    }));
  });

  it('says the numbers lens had nothing to read when only a figure craft steering reads stands out (PR #160 N-01)', () => {
    const board = boardWith(readGroup('G'));
    const emptyNumbers = readGroup('D', { mutate: (body) => { body.numbers.items = []; } });
    const onlySteered: LightboxBoard = {
      ...board,
      readings: board.readings.map((group) => (group.group === 'D' ? emptyNumbers : group)),
      measured: {
        ...board.measured,
        numbers: {
          ...board.measured.numbers,
          rows: board.measured.numbers.rows.map(({ standout: _standout, ...row }) =>
            (row.stat === 'adverbs' ? { ...row, standout: { direction: 'above' as const, against: ['writer' as const] } } : row))
        }
      }
    };
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: onlySteered, refusal: null });
    const numbers = screen.getByLabelText('What stands out in the numbers');
    expect(within(numbers).getByText('Read under Craft steering, below')).not.toBeNull();
    expect(numbers.textContent).toContain(
      'None of the figures this lens reads (sentence length, dialogue, passive voice) stands out, so it had nothing to read. ' +
      'Craft steering reads the figure that does, below.'
    );
    expect(numbers.textContent).not.toContain('Nothing in the numbers stands out');
  });

  it('points a standout steering figure in the numbers tile to craft steering, where it is read', () => {
    const board = boardWith();
    const standing: LightboxBoard = {
      ...board,
      measured: {
        ...board.measured,
        numbers: {
          ...board.measured.numbers,
          rows: board.measured.numbers.rows.map((row) => (row.stat === 'adverbs' ? { ...row, standout: { direction: 'above', against: ['writer'] } } : row))
        }
      }
    };
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: standing, refusal: null });
    const numbers = screen.getByLabelText('What stands out in the numbers');
    const adverbs = within(numbers).getByText('Adverbs (-ly)').closest('button') as HTMLButtonElement;
    expect(within(adverbs).getByText('Read under Craft steering, below')).not.toBeNull();
    const dialogue = within(numbers).getByText('Dialogue').closest('button') as HTMLButtonElement;
    expect(within(dialogue).queryByText('Read under Craft steering, below')).toBeNull();
  });
});
