/** @jest-environment jsdom */

/**
 * The story lenses in the webview (ADR 2026-10-19 D4, D7 and its addendum;
 * Slice 4C), through the real Lightbox root: the Sections lane measured
 * before any reading; template and freshness with its basis line, pressure,
 * artifacts, and summary and movements, each with its register chip; the
 * ribbon's Movements, Pressure and Engagement lanes; hover and focus
 * lighting paragraphs; a pin opening the inspector with the host's checks; a
 * stale note on every new tile; and Bring by id. The host is played by
 * window messages; readings come from the worked examples through the
 * production codec and verifier, over "Alice's Adventures in Wonderland"
 * (1865, public domain).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { LightboxBoard, LightboxReadingGroup, LightboxSectionsMeasure } from '@messages';
import { MessageType } from '@messages';
import { LIGHTBOX_BASIS_LINES } from '@shared/constants/lightboxPlot';
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

/* eslint-disable @typescript-eslint/naming-convention -- the Sections signals are kebab-case protocol literals. */

const fromHost = (type: MessageType, payload: object) =>
  act(() => {
    window.dispatchEvent(new MessageEvent('message', {
      data: { type, source: 'extension.lightbox', payload, timestamp: 1 }
    }));
  });

const litParagraphs = () =>
  Array.from(document.querySelectorAll('.pm-lb-col'))
    .flatMap((column, index) => (column.querySelector('.pm-lb-col-focus.is-lit') ? [index + 1] : []));

const SCENES: LightboxSectionsMeasure = {
  signal: 'scene-breaks',
  sections: [{ from: 1, to: 3, label: 'Scene 1' }, { from: 4, to: 8, label: 'Scene 2', marker: 4 }],
  fired: { headings: [], 'scene-breaks': [4], 'chapter-lines': [] }
};

function boardWith(groupE: LightboxReadingGroup = readGroup('E'), groupD: LightboxReadingGroup = readGroup('D')): LightboxBoard {
  return { ...makeBoard(8), readings: [readGroup('A'), readGroup('B'), readGroup('C'), groupD, groupE] };
}
const UNREAD: LightboxBoard = { ...makeBoard(8), readings: (['A', 'B', 'C', 'D', 'E'] as const).map(emptyLightboxReadingGroup) };
const staleAll = (group: LightboxReadingGroup): LightboxReadingGroup =>
  ({ ...group, staleLenses: group.lenses.map((lens) => ({ lens, readAgainst: 'old-hash' })) });
const tileTitled = (board: LightboxBoard, title: string) =>
  board.readings.flatMap((group) => group.tiles).find((tile) => tile.title === title)!;

describe('LightboxApp: the story lenses (Slice 4C)', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const posted = (type: MessageType) => vscode.postMessage.mock.calls.map(([message]) => message).filter((message) => message.type === type);
  const templateTile = () => screen.getByLabelText('Template & freshness');
  const pressureTile = () => screen.getByLabelText('Pressure');
  const artifactsTile = () => screen.getByLabelText('Artifacts');
  const summaryTile = () => screen.getByLabelText('Summary & movements');
  const plotLanes = () => screen.getByRole('group', { name: 'Sections, movements, pressure and engagement' });
  const storyLabels = () => document.querySelector('.pm-lb-ribbon-plot-labels') as HTMLElement;

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  it('measures the Sections lane before any reading, and says when nothing divides the chapter', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: UNREAD, refusal: null });
    const note = 'Found one heading (¶1), which does not divide the chapter into two or more sections, so the ribbon stays in paragraphs.';
    expect(within(plotLanes()).getByText(note)).not.toBeNull();
    expect(within(plotLanes()).getAllByText('Summary & movements is a reading. Not read yet.')).toHaveLength(1);
    expect(summaryTile().textContent).toContain(note);
  });

  it('draws found sections as measured bands that light their paragraphs and pin to the inspector', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: { ...boardWith(), measured: { ...makeBoard(8).measured, sections: SCENES } }, refusal: null });
    const band = within(plotLanes()).getByRole('button', { name: 'Section 2: Scene 2, ¶4–¶8' });
    fireEvent.mouseEnter(band);
    expect(litParagraphs()).toEqual([4, 5, 6, 7, 8]);
    fireEvent.mouseLeave(band);
    fireEvent.click(band);
    const inspector = screen.getByLabelText('Inspector');
    expect(within(inspector).getByText('¶4–¶8, opened in ¶4. Found by code; nothing here is a reading.')).not.toBeNull();
  });

  it('draws the template: its beats, engagement by movement, and freshness as a reading over the counted basis', () => {
    const board = boardWith();
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board, refusal: null });
    const template = templateTile();
    expect(template.getAttribute('data-register')).toBe('read');
    expect(within(template).getByText('Portal descent')).not.toBeNull();
    expect(within(template).getAllByText('Subverts')).toHaveLength(2);
    expect(within(template).getByRole('img', { name: 'Freshness, as read: Fresh' })).not.toBeNull();
    expect(template.textContent).toContain('A reading, not a grade');
    expect(template.textContent).toContain('Basis, counted: 8 of 16 classified beats signature (50%) · 2 of 5 template beats subverted.');
    const chase = within(template).getByRole('button', { name: 'Movement II, The chase: engagement high' });
    fireEvent.mouseEnter(chase);
    expect(litParagraphs()).toEqual([4, 5]);
    fireEvent.mouseLeave(chase);
    // The tier mix is not repeated: the link pins it where it was counted.
    fireEvent.click(within(template).getByRole('button', { name: 'The tier mix is counted in Stock & signature →' }));
    const tiers = board.readings.flatMap((group) => group.tiles).find((tile) => tile.kind === 'stock-tiers')!;
    const inspector = screen.getByLabelText('Inspector');
    expect(within(inspector).getAllByText(tiers.title).length).toBeGreaterThan(0);
    expect(within(inspector).queryByText('Portal descent')).toBeNull();
  });

  it('says which half of the basis is missing or stale instead of counting', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith(readGroup('E'), staleAll(readGroup('D'))), refusal: null });
    expect(templateTile().textContent).toContain(LIGHTBOX_BASIS_LINES.staleStock);
    expect(templateTile().textContent).not.toContain('classified beats signature');
  });

  it('draws pressure: each thread\'s plant, builds and end, the counts code made, and a dormant thread checked', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith(), refusal: null });
    const pressure = pressureTile();
    expect(pressure.getAttribute('data-register')).toBe('counted-read');
    expect(pressure.textContent).toContain('¶6 · builds ¶7 → still open');
    expect(pressure.textContent).toContain('¶5 · dormant, never touched again');
    expect(pressure.textContent).toContain('¶7 → resolved ¶7');
    const counts = pressure.querySelector('.pm-lb-pressure-counts')?.textContent;
    expect(counts).toContain('4 threads');
    expect(counts).toContain('1 resolved here');
    expect(counts).toContain('3 carried out of the chapter');
    expect(counts).toContain('1 dormant');
    expect(pressure.textContent).toContain('code checked it has no quote after its plant');
    const fall = within(pressure).getByText('Will the fall ever end?').closest('button') as HTMLButtonElement;
    fireEvent.focus(fall);
    expect(litParagraphs()).toEqual([6, 7, 8]);
    fireEvent.blur(fall);
    fireEvent.click(fall);
    const inspector = screen.getByLabelText('Inspector');
    expect(within(inspector).getByText('Counted by code from where its quotes stand')).not.toBeNull();
    expect(within(inspector).getByText('¶6–¶8')).not.toBeNull();
  });

  it('draws artifacts: mentions and first paragraphs counted by code, arcs read, and "planted, unused" where code bears it out', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith(), refusal: null });
    const artifacts = artifactsTile();
    expect(artifacts.getAttribute('data-register')).toBe('counted-read');
    const book = within(artifacts).getByRole('button', { name: /^Her sister's book: first in ¶2, 2 mentions counted by code/ });
    expect(book.getAttribute('aria-label')).toContain('arc, as read: peeped into → found wanting; planted, unused');
    expect(within(artifacts).getAllByText('planted, unused')).toHaveLength(2);
    expect(artifacts.textContent).toContain('4 objects · 4 change state · 2 planted, unused.');
    fireEvent.mouseEnter(book);
    expect(litParagraphs()).toEqual([2]);
  });

  it('draws the synopsis and the movements with their boundaries, each lighting its range', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith(), refusal: null });
    const summary = summaryTile();
    expect(summary.getAttribute('data-register')).toBe('read');
    expect(summary.textContent).toContain('Bored on the bank, Alice sees a White Rabbit');
    const well = within(summary).getByText('The well').closest('button') as HTMLButtonElement;
    expect(well.textContent).toContain('III · ¶6–8');
    expect(well.textContent).toContain('The rabbit-hole went straight on like a tunnel for some way');
    expect(well.textContent).toContain('Engagement · Medium');
    fireEvent.mouseEnter(well);
    expect(litParagraphs()).toEqual([6, 7, 8]);
    expect(summary.textContent).toContain('contiguous, no overlap, ¶1 to ¶8');
  });

  it('draws the ribbon\'s movements, pressure and engagement lanes from the host\'s ranges and spans', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith(), refusal: null });
    const lanes = plotLanes();
    const movements = within(lanes).getAllByRole('button', { name: /^Movement / }).map((band) => band.getAttribute('aria-label'));
    expect(movements).toEqual(['Movement I: The bank, ¶1–¶3', 'Movement II: The chase, ¶4–¶5', 'Movement III: The well, ¶6–¶8']);
    expect(within(lanes).getAllByRole('button', { name: /^Engagement in movement/ }).map((band) => band.getAttribute('aria-label')))
      .toEqual(['Engagement in movement I: low', 'Engagement in movement II: high', 'Engagement in movement III: medium']);
    const pressure = Array.from(lanes.querySelectorAll('.pm-lb-plot-pressure')).map((cell) => cell.getAttribute('title'));
    expect(pressure[3]).toBe('¶4 · 1 open thread, counted by code');
    expect(pressure[7]).toBe('¶8 · 3 open threads, counted by code');
    fireEvent.mouseEnter(within(lanes).getByRole('button', { name: 'Movement II: The chase, ¶4–¶5' }));
    expect(litParagraphs()).toEqual([4, 5]);
    fireEvent.click(within(storyLabels()).getByRole('button', { name: /^Pressure/ }));
    expect(within(screen.getByLabelText('Inspector')).getByText('Open threads')).not.toBeNull();
  });

  it('draws every label block and track as a child of one plain grid, with one label track (PR #156 F-03, F-04)', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith(staleAll(readGroup('E'))), refusal: null });
    const grid = document.querySelector('.pm-lb-ribbon .pm-lb-ribbon-grid') as HTMLElement;
    expect(grid).not.toBeNull();
    // No row wrappers: the label blocks, the tracks and the rule between the parts are the grid's own children.
    const children = Array.from(grid.children) as HTMLElement[];
    expect(children.map((child) => child.className)).toEqual([
      'pm-lb-ribbon-labels', 'pm-lb-ribbon-cols', 'pm-lb-ribbon-rule', 'pm-lb-ribbon-labels pm-lb-ribbon-plot-labels', 'pm-lb-plot-lanes'
    ]);
    // The stale badges sit inside the shared label track.
    expect(within(children[3]).getAllByText('stale')).toHaveLength(3);
    expect(children[4].style.gridTemplateColumns).toBe(children[1].style.gridTemplateColumns);
    expect(children[4].getAttribute('role')).toBe('group');

    // The stylesheet places each by column on one shared grid; subgrid is kept out by the floor guard.
    const css = (name: string) => fs.readFileSync(path.resolve(__dirname, `../../../presentation/webview/styles/lightbox/${name}`), 'utf8');
    const rule = (sheet: string, selector: string) => {
      const start = sheet.indexOf(`${selector} {`);
      return start < 0 ? '' : sheet.slice(start, sheet.indexOf('}', start));
    };
    const ribbon = css('ribbon.css');
    const plot = css('plot.css');
    expect(rule(ribbon, '[data-pm-surface="lightbox"] .pm-lb-ribbon-grid')).toMatch(/display: grid;[\s\S]*grid-template-columns: minmax\(74px, max-content\) minmax\(0, 1fr\);/);
    expect(rule(ribbon, '[data-pm-surface="lightbox"] .pm-lb-ribbon-labels')).toMatch(/grid-column: 1;/);
    expect(rule(ribbon, '[data-pm-surface="lightbox"] .pm-lb-ribbon-cols')).toMatch(/grid-column: 2;/);
    expect(rule(plot, '[data-pm-surface="lightbox"] .pm-lb-plot-lanes')).toMatch(/grid-column: 2;/);
    expect(rule(plot, '[data-pm-surface="lightbox"] .pm-lb-ribbon-rule')).toMatch(/grid-column: 1 \/ -1;/);
    expect(ribbon).not.toContain('.pm-lb-ribbon-wrap');
    // Both column tracks share one gap, so equal indices mean equal edges.
    expect(rule(ribbon, '[data-pm-surface="lightbox"] .pm-lb-ribbon-cols')).toMatch(/gap: 2px;/);
    expect(rule(plot, '[data-pm-surface="lightbox"] .pm-lb-plot-lanes')).toMatch(/column-gap: 2px;/);
  });

  it('says why engagement is absent when the movements are off, on the tile and the lane', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith(), refusal: null });
    fireEvent.click(within(screen.getByLabelText('Lenses')).getByRole('checkbox', { name: /^Summary & movements/ }));
    expect(templateTile().textContent).toContain('Engagement needs the movements: turn on Summary & movements, and it is read with them.');
    expect(within(plotLanes()).getByText('The Summary & movements lens is off.')).not.toBeNull();
  });

  it('says on every new tile and lane when it was read against an earlier version of the chapter', () => {
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board: boardWith(staleAll(readGroup('E'))), refusal: null });
    for (const tile of [templateTile(), pressureTile(), artifactsTile(), summaryTile()]) {
      expect(within(tile).getByText('Stale')).not.toBeNull();
    }
    expect(within(storyLabels()).getAllByText('stale')).toHaveLength(3);
    expect(templateTile().textContent).toContain(LIGHTBOX_BASIS_LINES.staleTemplate);
  });

  it('brings a pinned movement to the Workshop by its id only', () => {
    const board = boardWith();
    render(<LightboxApp />);
    fromHost(MessageType.LIGHTBOX_BOARD, { board, refusal: null });
    fireEvent.click(within(summaryTile()).getByText('The chase').closest('button') as HTMLButtonElement);
    const inspector = screen.getByLabelText('Inspector');
    expect(within(inspector).getByText('Found in ¶4, its first paragraph, by code')).not.toBeNull();
    fireEvent.click(within(inspector).getByRole('button', { name: 'Bring to Workshop →' }));
    expect(posted(MessageType.LIGHTBOX_HAND_OFF)).toEqual([expect.objectContaining({
      payload: { kind: 'tile', boardId: board.boardId, tileId: tileTitled(board, 'The chase').id }
    })]);
  });
});
