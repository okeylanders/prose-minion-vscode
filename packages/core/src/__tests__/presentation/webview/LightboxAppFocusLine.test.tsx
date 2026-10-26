/** @jest-environment jsdom */

/**
 * The ribbon's focus line has a row of its own (Slice 4M). The writer saw the
 * board go into "chaos" mode: hovering an item made its paragraph labels
 * wrap the ribbon's top row onto a second line, the board moved, the pointer
 * left the item, the labels went, and it all repeated on a loop.
 *
 * jsdom has no layout, so the real-browser evidence
 * (docs/pr-reviews/evidence/lightbox-slice-4m-visual/) measures the boxes.
 * Here: the line's shape (its own row under the eyebrow, a clipped text and
 * a tail that never clips) is the same element in every state, idle, hovered,
 * pinned and empty, and says the item's paragraphs as ranges and their count.
 * Paragraphs are hand-built (Alice, public domain).
 */

import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MessageType } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { makeBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxBoardFixtures';

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

const top = () => document.querySelector('.pm-lb-ribbon-top') as HTMLElement;
const line = () => document.querySelector('.pm-lb-ribbon-focus') as HTMLElement;
const text = () => line().querySelector('.pm-lb-ribbon-focus-text')?.textContent;
const tail = () => line().querySelector('.pm-lb-ribbon-focus-tail')?.textContent;
/** The line's shape: what it is and what it holds, never what it says. */
const shape = () => ({
  tag: line().tagName,
  parent: line().parentElement?.className,
  previous: line().previousElementSibling?.className,
  children: [...line().children].map((child) => child.className)
});

describe('LightboxApp: the ribbon\'s focus line (Slice 4M)', () => {
  beforeEach(() => {
    (useVSCodeApi as jest.Mock).mockReturnValue(createMockVSCode());
    render(<LightboxApp />);
    // A 300-paragraph board: the ribbon buckets it into 96 columns, and even paragraphs carry dialogue.
    fromHost(MessageType.LIGHTBOX_BOARD, { board: makeBoard(300), refusal: null });
  });

  it('stands on a row of its own under the eyebrow, idle with no tail', () => {
    expect(top().children).toHaveLength(2);
    expect(top().firstElementChild?.className).toBe('pm-lb-ribbon-eyebrow');
    expect(top().firstElementChild?.textContent).toBe('The text · 300 ¶ · 96 columns');
    expect(shape()).toEqual({ tag: 'P', parent: 'pm-lb-ribbon-top', previous: 'pm-lb-ribbon-eyebrow', children: ['pm-lb-ribbon-focus-text'] });
    expect(text()).toBe('Hover anything on the board to light the paragraphs it touches.');
    // Not a live region: hover changes it constantly.
    expect(line().getAttribute('aria-live')).toBeNull();
    expect(line().getAttribute('role')).toBeNull();
  });

  it('writes a hovered lane\'s paragraphs as ranges, capped, and keeps its count in the tail', () => {
    const dialogue = screen.getByRole('button', { name: 'Dialogue' });
    fireEvent.mouseEnter(dialogue);
    expect(shape().children).toEqual(['pm-lb-ribbon-focus-text', 'pm-lb-ribbon-focus-tail']);
    // 150 even paragraphs, none adjacent: the first 60 written, then an ellipsis; the count is whole.
    expect(text()?.startsWith('Dialogue share · ¶2 ¶4 ¶6 ')).toBe(true);
    expect(text()?.endsWith(' ¶120 …')).toBe(true);
    expect(tail()).toBe('· 150 ¶');
    expect(line().className).toBe('pm-lb-ribbon-focus is-measured');
    fireEvent.mouseLeave(dialogue);
    expect(text()).toBe('Hover anything on the board to light the paragraphs it touches.');
    expect(tail()).toBeUndefined();
  });

  it('writes a hovered column\'s run as one range', () => {
    const column = screen.getByRole('button', { name: 'Paragraphs 1 to 3' });
    fireEvent.mouseEnter(column);
    expect(text()).toBe('¶1–¶3 · ¶1–¶3');
    expect(tail()).toBe('· 3 ¶');
  });

  it('keeps the same element and shape when an item is pinned and the pointer leaves', () => {
    const before = line();
    const word = [...document.querySelectorAll('.pm-lb-cloud-word')].find((chip) => chip.textContent?.startsWith('alice')) as HTMLElement;
    fireEvent.mouseEnter(word);
    fireEvent.click(word);
    fireEvent.mouseLeave(word);
    expect(line()).toBe(before);
    expect(shape()).toEqual({
      tag: 'P', parent: 'pm-lb-ribbon-top', previous: 'pm-lb-ribbon-eyebrow',
      children: ['pm-lb-ribbon-focus-text', 'pm-lb-ribbon-focus-tail']
    });
    expect(text()).toBe('alice · ¶2 ¶4–¶6');
    expect(tail()).toBe('· 4 ¶');
  });
});
