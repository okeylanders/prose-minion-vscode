/** @jest-environment jsdom */

/**
 * The inspector's reading aids through the real Lightbox root, with the real
 * host in the loop (Slice 4E): the production LightboxService builds the
 * board from public-domain text (¶1–¶8 of Chapter I of Lewis Carroll's
 * "Alice's Adventures in Wonderland", 1865, as the worked examples hold it),
 * and every passage request the webview posts is answered by the real
 * LightboxPassageHandler, when the test says so.
 *
 * - A word, a part-of-speech entry, a phrase, a hapax word or a style flag
 *   opens a well of sentences, with exactly as many instances lit as its
 *   count; each row's address pins its paragraph, lit by the term, with the
 *   way back.
 * - A paragraph shows its whole text.
 * - The hapax list is as long as the stats row's count.
 * - A changed text says so and shows none of the older text.
 * - No chapter text reaches `setState`.
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MessageType } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { LightboxPassageHandler } from '@/application/handlers/domain/LightboxPassageHandler';
import { boardWithPassages, createPassageService } from '@/__tests__/infrastructure/lightbox/lightboxPassageFixtures';
import { readWorkedExample } from '@/__tests__/infrastructure/lightbox/lightboxReadingFixtures';

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

const CHAPTER = readWorkedExample('A').paragraphs.join('\n\n');

function deliver(type: MessageType, payload: unknown): void {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: { type, source: 'extension.lightbox', payload, timestamp: 1 } }));
  });
}

async function setup() {
  const service = createPassageService();
  const { board } = await boardWithPassages(CHAPTER, service);
  const vscode = createMockVSCode();
  (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  const handler = new LightboxPassageHandler(
    service,
    async (message) => deliver(message.type, message.payload),
    { appendLine: () => undefined } as never
  );
  const requests = () => vscode.postMessage.mock.calls.map(([message]) => message).filter((message) => message.type === MessageType.LIGHTBOX_REQUEST_PASSAGE);
  let answered = 0;
  /** The host answers every request not yet answered. */
  const answer = async () => {
    const waiting = requests().slice(answered);
    answered += waiting.length;
    for (const message of waiting) {
      await act(async () => {
        await handler.handleRequestPassage(message);
      });
    }
  };
  render(<LightboxApp />);
  deliver(MessageType.LIGHTBOX_BOARD, { board, refusal: null });
  return { service, board, vscode, requests, answer };
}

const inspector = () => screen.getByLabelText('Inspector');
const region = (name: string) => within(inspector()).getByRole('region', { name });
const litIds = (element: HTMLElement) => new Set(
  [...element.querySelectorAll('mark.pm-lb-mark')].flatMap((mark) => (mark.getAttribute('data-instances') ?? '').split(' '))
);
const buttonWithText = (selector: string, text: string) => {
  const found = [...document.querySelectorAll<HTMLButtonElement>(selector)].find((button) => button.textContent === text);
  if (!found) {
    throw new Error(`No ${selector} reads ${text}`);
  }
  return found;
};

describe('the inspector\'s reading aids (Slice 4E)', () => {
  it('lists a top word\'s sentences, lit as many times as it is counted, in a labelled, focusable, scrollable well', async () => {
    const { answer, requests } = await setup();
    fireEvent.click(screen.getByTitle('alice ×7'));
    expect(within(inspector()).getByText('Finding the sentences…')).not.toBeNull();
    expect(requests()).toHaveLength(1);
    await answer();

    expect(inspector().querySelector('.pm-lb-passage .pm-lb-label')?.textContent).toBe('Sentences · 7 instances in 6 sentences');
    const well = region('Sentences holding “alice”');
    expect(well.getAttribute('tabindex')).toBe('0');
    expect(well.getAttribute('aria-live')).toBe('off');
    expect(litIds(well).size).toBe(7);
    expect([...well.querySelectorAll('mark')].every((mark) => mark.textContent?.toLowerCase() === 'alice')).toBe(true);
    expect(within(well).getAllByRole('listitem')).toHaveLength(6);
  });

  it('pins a row\'s paragraph with the word lit there, and goes back to the word', async () => {
    const { answer } = await setup();
    fireEvent.click(screen.getByTitle('alice ×7'));
    await answer();
    fireEvent.click(within(region('Sentences holding “alice”')).getAllByRole('button', { name: '¶2' })[0]);
    expect(within(inspector()).getByRole('heading').textContent).toBe('¶2');
    await answer();

    const text = region('Text of ¶2');
    expect(text.textContent?.startsWith('Alice was beginning to get very tired of sitting by her sister on the bank')).toBe(true);
    expect(litIds(text)).toEqual(new Set(['0', '1']));
    expect(within(inspector()).getByText('Lit: “alice”, 2 instances here.')).not.toBeNull();

    fireEvent.click(within(inspector()).getByRole('button', { name: '← Back to “alice”' }));
    expect(within(inspector()).getByRole('heading').textContent).toBe('alice');
  });

  it('keeps the word\'s sentences when the writer goes back before the paragraph answers, and its answer comes late (PR #159 F-01)', async () => {
    const { answer, requests } = await setup();
    fireEvent.click(screen.getByTitle('alice ×7'));
    await answer();
    fireEvent.click(within(region('Sentences holding “alice”')).getAllByRole('button', { name: '¶2' })[0]);
    expect(within(inspector()).getByText('Reading ¶2 from the text the board counted…')).not.toBeNull();
    expect(requests()).toHaveLength(2);

    // Back while ¶2 is still being read: the word's sentences, held, show at once.
    fireEvent.click(within(inspector()).getByRole('button', { name: '← Back to “alice”' }));
    expect(litIds(region('Sentences holding “alice”')).size).toBe(7);
    expect(requests()).toHaveLength(2);

    // ¶2's answer, late, is not the word's: the well stays, and nothing waits.
    await answer();
    expect(within(inspector()).getByRole('heading').textContent).toBe('alice');
    expect(within(inspector()).queryByText('Finding the sentences…')).toBeNull();
    expect(litIds(region('Sentences holding “alice”')).size).toBe(7);
    expect(requests()).toHaveLength(2);

    // ¶2, pinned again, asks again.
    fireEvent.click(within(region('Sentences holding “alice”')).getAllByRole('button', { name: '¶2' })[0]);
    expect(requests()).toHaveLength(3);
    await answer();
    expect(litIds(region('Text of ¶2'))).toEqual(new Set(['0', '1']));
  });

  it('shows a paragraph pinned on the ribbon whole, with nothing lit', async () => {
    const { answer } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Paragraph 3' }));
    await answer();
    const text = region('Text of ¶3');
    expect(text.textContent).toBe(readWorkedExample('A').paragraphs[2]);
    expect(litIds(text).size).toBe(0);
  });

  it('opens a part-of-speech entry, a repeated phrase and a style flag with exactly their counts lit', async () => {
    const { answer } = await setup();
    const cases: Array<[string, string, string, number]> = [
      ['.pm-lb-pos-row', 'was13', 'Sentences holding “was” (verb)', 13],
      ['.pm-lb-phrase', '“she had” ×3', 'Sentences holding “she had”', 3],
      ['.pm-lb-flag', 'Weak Verbs 28', 'Sentences holding Weak Verbs', 28]
    ];
    for (const [selector, text, name, count] of cases) {
      fireEvent.click(buttonWithText(selector, text));
      await answer();
      expect({ name, lit: litIds(region(name)).size }).toEqual({ name, lit: count });
    }
    // Repetitive Words counts words that repeat, not instances: a count, not an item.
    expect([...document.querySelectorAll('.pm-lb-flag')].map((flag) => `${flag.tagName} ${flag.textContent}`)).toEqual([
      'BUTTON Weak Verbs 28', 'BUTTON Filler Words 11', 'BUTTON Adverbs (-ly words) 7', 'SPAN Repetitive Words 5', 'BUTTON Passive Voice 2'
    ]);
  });

  it('lists the hapax words under the cloud, as many as the stats row counts, and opens one\'s sentence', async () => {
    const { board, answer } = await setup();
    const well = screen.getByRole('region', { name: 'Words used once: 139' });
    expect(board.measured.headline.hapaxCount).toBe(139);
    expect(within(well).getAllByRole('button')).toHaveLength(139);
    expect(within(well).getAllByRole('button').slice(0, 3).map((button) => button.textContent)).toEqual(['Chapter', 'beginning', 'tired']);
    expect(screen.getByText('139 words, in order of appearance')).not.toBeNull();

    fireEvent.click(within(well).getByRole('button', { name: 'daisy-chain' }));
    expect(within(inspector()).getByRole('heading').textContent).toBe('daisy-chain');
    await answer();
    const sentence = region('Sentences holding “daisy-chain”');
    expect([...sentence.querySelectorAll('mark')].map((mark) => mark.textContent)).toEqual(['daisy-chain']);
  });

  it('says the text changed, never showing the older text, until the new board\'s passage lands', async () => {
    const { service, answer } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Paragraph 3' }));
    await answer();
    expect(region('Text of ¶3').textContent).toContain('White Rabbit with pink eyes');

    // The writer edits the chapter and re-reads it: a new board, the pin kept.
    const edited = await boardWithPassages(CHAPTER.replace('White Rabbit with pink eyes', 'White Rabbit with grey eyes'), service);
    deliver(MessageType.LIGHTBOX_BOARD, { board: edited.board, refusal: null });
    expect(within(inspector()).getByText('The text changed since this was shown. Reading it again from the board as it stands…')).not.toBeNull();
    expect(within(inspector()).queryByRole('region', { name: 'Text of ¶3' })).toBeNull();

    await answer();
    expect(region('Text of ¶3').textContent).toContain('White Rabbit with grey eyes');
  });

  it('never puts the chapter\'s text in webview state', async () => {
    const { vscode, answer } = await setup();
    fireEvent.click(screen.getByTitle('alice ×7'));
    await answer();
    fireEvent.click(within(region('Sentences holding “alice”')).getAllByRole('button', { name: '¶2' })[0]);
    await answer();
    expect(region('Text of ¶2').textContent).toContain('peeped into the book');

    const saved = vscode.setState.mock.calls.map(([state]) => JSON.stringify(state));
    expect(saved.length).toBeGreaterThan(0);
    expect(saved.filter((state) => state.includes('peeped into the book') || state.includes('beginning to get very tired'))).toEqual([]);
    expect(vscode.setState).toHaveBeenLastCalledWith(expect.objectContaining({
      lightboxSelectedItem: { kind: 'paragraphs', from: 2, to: 2, via: { kind: 'word', word: 'alice' } }
    }));
  });
});
