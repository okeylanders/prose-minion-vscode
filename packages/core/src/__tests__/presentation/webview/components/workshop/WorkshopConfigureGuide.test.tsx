/**
 * @jest-environment jsdom
 */

/**
 * Witnesses for the "How to configure your project" guide.
 *
 * The guide's whole job is to tell a writer which glob goes in which settings
 * field. Its value is the accuracy of that table, so the table is what these
 * tests pin — including the two globs that deliberately end in `*.md` rather
 * than `**​/*` (one chapter per file, so an assistant can open the chapter it
 * needs instead of the whole novel).
 */

import * as React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { WorkshopConfigureGuide } from '@components/workshop/WorkshopConfigureGuide';

describe('WorkshopConfigureGuide', () => {
  afterEach(() => {
    cleanup();
    delete window.proseMinonAssets;
  });

  it('renders nothing while closed', () => {
    render(<WorkshopConfigureGuide open={false} onClose={jest.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lays out the three setup steps in order', () => {
    render(<WorkshopConfigureGuide open onClose={jest.fn()} />);

    const steps = screen.getAllByRole('listitem');
    expect(steps).toHaveLength(3);
    expect(steps[0].textContent).toContain('Open the project folder');
    expect(steps[1].textContent).toContain('Open Prose Minion Settings');
    expect(steps[2].textContent).toContain('Fill in one glob per field');
  });

  it('maps every settings field to the glob for the example layout', () => {
    render(<WorkshopConfigureGuide open onClose={jest.fn()} />);

    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row').slice(1); // drop the header
    const mapping = rows.map((row) => {
      const cells = within(row).getAllByRole('cell');
      const field = within(row).getByRole('rowheader').textContent;
      return [field, cells[0].textContent];
    });

    expect(mapping).toEqual([
      ['Characters', 'characters/**/*'],
      ['Locations & Settings', 'locations-and-settings/**/*'],
      ['Themes', 'themes-and-literary-devices/**/*'],
      ['Things / Props', 'things-and-props/**/*'],
      ['Draft Chapters & Outlines', 'draft-chapters/*.md,outlines/*.md'],
      ['Manuscript Chapters', 'manuscript-chapters/*.md'],
      ['Project Brief Materials', 'project-brief/**/*,*.md'],
      ['General References', 'references/**/*,research/**/*']
    ]);
  });

  it('warns that the settings screenshot shows another project\'s values', () => {
    render(<WorkshopConfigureGuide open onClose={jest.fn()} />);
    expect(screen.getByText(/Values shown are from another project/)).toBeTruthy();
  });

  it('explains why the chapter fields end in *.md', () => {
    render(<WorkshopConfigureGuide open onClose={jest.fn()} />);
    expect(screen.getByText(/Split chapters into individual files/)).toBeTruthy();
  });

  it('renders the two walkthrough screenshots from the host-resolved URIs', () => {
    window.proseMinonAssets = {
      noticeShots: {
        'project-layout': 'https://webview.test/project-layout.png',
        'settings-resource-locations': 'https://webview.test/settings.png'
      }
    };
    render(<WorkshopConfigureGuide open onClose={jest.fn()} />);

    const shots = screen.getAllByRole('img') as HTMLImageElement[];
    expect(shots.map((img) => img.getAttribute('src'))).toEqual([
      'https://webview.test/project-layout.png',
      'https://webview.test/settings.png'
    ]);
    shots.forEach((img) => expect(img.getAttribute('alt')).toBeTruthy());
  });

  it('closes on the back button and on Escape', () => {
    const onClose = jest.fn();
    const { unmount } = render(<WorkshopConfigureGuide open onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /Back to the tour/ }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);

    /* An unrelated key must not close a page someone is reading. */
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(onClose).toHaveBeenCalledTimes(2);

    unmount();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
