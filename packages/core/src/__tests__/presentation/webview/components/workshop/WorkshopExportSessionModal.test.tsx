/** @jest-environment jsdom */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkshopExportSessionModal } from '@components/workshop/WorkshopExportSessionModal';

const renderModal = (
  overrides: Partial<React.ComponentProps<typeof WorkshopExportSessionModal>> = {}
) => {
  const props: React.ComponentProps<typeof WorkshopExportSessionModal> = {
    open: true,
    available: true,
    suggestedTitle: 'Dock scene — Jill — Oct 5',
    exporting: false,
    onClose: jest.fn(),
    onExport: jest.fn(),
    ...overrides
  };
  return { props, view: render(<WorkshopExportSessionModal {...props} />) };
};

const nameInput = () => screen.getByRole('textbox', { name: 'Export name' }) as HTMLInputElement;
const exportButton = () => screen.getByRole('button', { name: /^Export$/ }) as HTMLButtonElement;

describe('WorkshopExportSessionModal', () => {
  it('offers the three formats, Markdown first, and previews the exact export path', () => {
    renderModal();

    const formats = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(formats.map((radio) => radio.value)).toEqual(['markdown', 'json', 'html']);
    expect(formats[0].checked).toBe(true);
    expect(nameInput().value).toBe('Dock scene — Jill — Oct 5');
    expect(screen.getByText('dock-scene-jill-oct-5.md')).not.toBeNull();
  });

  it('exports the chosen format under the trimmed name', () => {
    const { props } = renderModal();

    fireEvent.click(screen.getByRole('radio', { name: /Styled HTML/ }));
    fireEvent.change(nameInput(), { target: { value: '  Dock scene, shared  ' } });

    expect(screen.getByText('dock-scene-shared.html')).not.toBeNull();
    expect(screen.getByText(/print from there to save a PDF/)).not.toBeNull();
    fireEvent.click(exportButton());
    expect(props.onExport).toHaveBeenCalledWith('html', 'Dock scene, shared');
  });

  it('submits on Enter from the name field', () => {
    const { props } = renderModal();

    fireEvent.click(screen.getByRole('radio', { name: /JSON/ }));
    fireEvent.keyDown(nameInput(), { key: 'Enter' });

    expect(props.onExport).toHaveBeenCalledWith('json', 'Dock scene — Jill — Oct 5');
  });

  it('will not export an unnamed transcript', () => {
    const { props } = renderModal();

    fireEvent.change(nameInput(), { target: { value: '   ' } });
    fireEvent.click(exportButton());

    expect(exportButton().disabled).toBe(true);
    expect(props.onExport).not.toHaveBeenCalled();
  });

  it('says what stays out of the transcript', () => {
    renderModal();

    expect(screen.getByText(/Left out: excerpt text, context and attachment contents/)).not.toBeNull();
  });

  it('explains the missing workspace and disables the export', () => {
    renderModal({ available: false });

    expect(screen.getByRole('status').textContent).toContain('Open a workspace folder to export');
    expect(exportButton().disabled).toBe(true);
  });

  it('holds the sheet open while the host writes the file', () => {
    const { props } = renderModal({ exporting: true });

    expect(screen.getByRole('button', { name: /Exporting…/ })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('keeps the chosen format across openings but refreshes the suggested name', () => {
    const { props, view } = renderModal();

    fireEvent.click(screen.getByRole('radio', { name: /JSON/ }));
    view.rerender(<WorkshopExportSessionModal {...props} open={false} />);
    view.rerender(
      <WorkshopExportSessionModal {...props} open suggestedTitle="Market scene — Jill — Oct 6" />
    );

    expect((screen.getByRole('radio', { name: /JSON/ }) as HTMLInputElement).checked).toBe(true);
    expect(nameInput().value).toBe('Market scene — Jill — Oct 6');
  });
});
