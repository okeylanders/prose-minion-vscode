/** @jest-environment jsdom */

/**
 * A withheld headline is withheld, not hidden (ADR 2026-10-19 D7; PR #149
 * F-04). Group A's worked example is broken the two ways the review
 * reproduced, decoded and verified by the production codec and verifier, and
 * drawn by the real Lightbox root: the plain heading stays, and the headline
 * lens's own state (the claim withheld by its title with its reasons, the
 * block withheld with its reason, or the call's failure) sits under it,
 * while the group's valid readings still land.
 */

import * as React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import { LightboxReadingGroup, MessageType } from '@messages';
import { emptyLightboxReadingGroup } from '@shared/constants/lightbox';
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

const HEADLINE = 'A bored girl follows a hurried white rabbit down a hole and keeps on falling.';

function show(groupA: LightboxReadingGroup): void {
  const board = { ...makeBoard(8), readings: [groupA, readGroup('B'), readGroup('C')] };
  render(<LightboxApp />);
  act(() => {
    window.dispatchEvent(new MessageEvent('message', {
      data: { type: MessageType.LIGHTBOX_BOARD, source: 'extension.lightbox', payload: { board, refusal: null }, timestamp: 1 }
    }));
  });
}

describe('a withheld headline is shown, not hidden (PR #149 F-04)', () => {
  beforeEach(() => {
    (useVSCodeApi as jest.Mock).mockReturnValue(createMockVSCode());
  });

  it('keeps the plain heading and names the withheld claim, its reason and its quotes\' reasons', () => {
    show(readGroup('A', {
      mutate: (body) => {
        body.headline.evidence = [{ para: 3, quote: 'a sentence that stands nowhere in this chapter' }];
      }
    }));

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('One chapter, held up to the light.');
    const state = screen.getByLabelText('Headline reading');
    expect(within(state).getByText(`Withheld · ${HEADLINE}`)).not.toBeNull();
    expect(within(state).getByText('No quote it gave was found in the paragraph it named.')).not.toBeNull();
    expect(within(state).getByText(/^¶3: Not found in the chapter/)).not.toBeNull();
    // The rejected sentence is never drawn as the heading, and the group's valid readings still land.
    expect(screen.queryByRole('heading', { name: HEADLINE })).toBeNull();
    expect(screen.getByText('Going down')).not.toBeNull();
  });

  it('names a headline block withheld for its missing friction', () => {
    show(readGroup('A', {
      mutate: (body) => {
        delete body.headline.friction;
      }
    }));

    const state = screen.getByLabelText('Headline reading');
    expect(state.textContent).toBe(
      'Headline withheld The headline block names no friction; every lens must say where it strains.'
    );
    expect(screen.getByText('Going down')).not.toBeNull();
  });

  it('says when the call that reads the headline failed, keeping the plain heading', () => {
    show({
      ...emptyLightboxReadingGroup('A'),
      status: 'failed',
      error: 'The provider refused the call (HTTP 400). Press Finish or Analyze to try again.'
    });

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('One chapter, held up to the light.');
    expect(within(screen.getByLabelText('Headline reading')).getByText(
      'The headline did not come back. The provider refused the call (HTTP 400). Press Finish or Analyze to try again.'
    )).not.toBeNull();
  });

  it('shows the plain heading alone before any reading', () => {
    show(emptyLightboxReadingGroup('A'));
    expect(screen.queryByLabelText('Headline reading')).toBeNull();
  });
});
