/**
 * @jest-environment jsdom
 */

/**
 * ExcerptPanel — Sprint 12 intake rework. Behavior under test:
 * - two-button empty state with NO pin vocabulary anywhere,
 * - typing state: live word count, paste triggers the verify round-trip,
 *   verified provenance applies only while the draft matches the claim,
 * - set state: display-safe provenance line (file path + line range,
 *   honest "source unknown" for manual text),
 * - locked affordances switch on source kind (`Update text…` vs
 *   `Re-read from file`).
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ExcerptPanel } from '@components/workshop/ExcerptPanel';
import { WorkshopExcerpt, WorkshopExcerptSource } from '@messages';
import { WorkshopVerifiedExcerpt } from '@hooks/domain/useWorkshopExcerptVerify';

const excerptWith = (source: WorkshopExcerptSource, text = 'The prom lights die.'): WorkshopExcerpt => ({
  text,
  version: 2,
  source,
  pinnedAt: 1
});

const renderPanel = (overrides: Partial<React.ComponentProps<typeof ExcerptPanel>> = {}) => {
  const props: React.ComponentProps<typeof ExcerptPanel> = {
    excerpt: null,
    isRunning: false,
    locked: false,
    verified: null,
    onSet: jest.fn(),
    onChooseFile: jest.fn(),
    onRereadFile: jest.fn(),
    onPasteVerify: jest.fn(),
    ...overrides
  };
  return { ...render(<ExcerptPanel {...props} />), props };
};

describe('ExcerptPanel', () => {
  it('opens with two intent buttons and no pin vocabulary', () => {
    const { container } = renderPanel();

    expect(screen.getByRole('button', { name: /paste or type/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /choose from project/i })).toBeTruthy();
    // \b so "workshopping" in the caption doesn't trip the check.
    expect(container.textContent).not.toMatch(/\bpin(ned|ning|s)?\b/i);
  });

  it('routes the file button to the host picker', () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /choose from project/i }));
    expect(props.onChooseFile).toHaveBeenCalled();
  });

  it('counts words live while drafting', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /paste or type/i }));

    fireEvent.change(screen.getByLabelText('Excerpt text'), {
      target: { value: 'Five words typed right here.' }
    });

    expect(screen.getByText('5')).toBeTruthy();
  });

  it('asks for verification on paste', () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /paste or type/i }));

    fireEvent.paste(screen.getByLabelText('Excerpt text'), {
      clipboardData: { getData: () => 'Pasted passage.' }
    });

    expect(props.onPasteVerify).toHaveBeenCalledWith('Pasted passage.');
  });

  it('confirms with verified provenance only while the draft matches the claim', () => {
    const verified: WorkshopVerifiedExcerpt = {
      text: 'Pasted passage.',
      source: {
        kind: 'editor-selection',
        sourceUri: 'file:///chapters/05.md',
        relativePath: 'chapters/05.md',
        startLine: 143,
        endLine: 151
      }
    };
    const { props } = renderPanel({ verified });
    fireEvent.click(screen.getByRole('button', { name: /paste or type/i }));
    const textarea = screen.getByLabelText('Excerpt text');

    fireEvent.change(textarea, { target: { value: 'Pasted passage.' } });
    expect(screen.getByRole('status').textContent).toContain('chapters/05.md');

    fireEvent.change(textarea, { target: { value: 'Pasted passage. Edited.' } });
    expect(screen.queryByRole('status')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(props.onSet).toHaveBeenCalledWith('Pasted passage. Edited.', undefined);
  });

  it('confirm passes the verified source on an exact match', () => {
    const verified: WorkshopVerifiedExcerpt = {
      text: 'Pasted passage.',
      source: {
        kind: 'editor-selection',
        sourceUri: 'file:///chapters/05.md',
        relativePath: 'chapters/05.md'
      }
    };
    const { props } = renderPanel({ verified });
    fireEvent.click(screen.getByRole('button', { name: /paste or type/i }));
    fireEvent.change(screen.getByLabelText('Excerpt text'), {
      target: { value: 'Pasted passage.' }
    });

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    expect(props.onSet).toHaveBeenCalledWith('Pasted passage.', verified.source);
  });

  it('shows the source line for a verified selection, with its line range', () => {
    renderPanel({
      excerpt: excerptWith({
        kind: 'editor-selection',
        sourceUri: 'file:///chapters/05.md',
        relativePath: 'chapters/05.md',
        startLine: 143,
        endLine: 151
      })
    });

    expect(screen.getByText(/From chapters\/05\.md/).textContent).toContain('lines 143–151');
  });

  it('stays honest about unknown sources', () => {
    renderPanel({ excerpt: excerptWith({ kind: 'manual' }) });
    expect(screen.getByText(/Pasted or typed · source unknown/)).toBeTruthy();
  });

  it('offers Re-read from file when locked on a file-backed excerpt', () => {
    const { props } = renderPanel({
      locked: true,
      excerpt: excerptWith({ kind: 'file', sourceUri: 'file:///chapters/05.md', relativePath: 'chapters/05.md' })
    });

    expect(screen.getByText(/Session live/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /update text/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /re-read from file/i }));
    expect(props.onRereadFile).toHaveBeenCalled();
  });

  it('offers Update text… when locked on typed or pasted origin', () => {
    renderPanel({ locked: true, excerpt: excerptWith({ kind: 'manual' }) });

    expect(screen.queryByRole('button', { name: /re-read from file/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /update text/i }));
    expect(screen.getByLabelText('Excerpt text')).toBeTruthy();
  });
});
