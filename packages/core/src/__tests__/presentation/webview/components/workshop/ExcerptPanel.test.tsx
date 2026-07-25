/**
 * @jest-environment jsdom
 */

/**
 * ExcerptPanel — Sprint 12 intake rework + Sprint 13A scope awareness.
 *
 * Sprint 12 behavior still under test:
 * - no pin vocabulary in the empty state,
 * - display-safe provenance line (file path + line range, honest
 *   "source unknown" for manual text),
 * - locked affordances switch on source kind (`Update text…` vs
 *   `Re-read from file`).
 *
 * Sprint 13A behavior under test:
 * - the block's three states key off SCOPE, not off excerpt presence,
 * - the no-excerpt open-chat card is honest about what the host has read AND
 *   about context still riding along,
 * - both reversals are offered and shelve rather than delete,
 * - authoring delegates to the shared Edit/Preview sheet (no inline draft).
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ExcerptPanel } from '@components/workshop/ExcerptPanel';
import { WorkshopExcerpt, WorkshopExcerptSource } from '@messages';

const excerptWith = (
  source: WorkshopExcerptSource,
  text = 'The prom lights die.'
): WorkshopExcerpt => ({
  text,
  version: 2,
  source,
  pinnedAt: 1
});

const fileSource: WorkshopExcerptSource = {
  kind: 'file',
  sourceUri: 'file:///chapters/05.md',
  relativePath: 'chapters/05.md'
};

const renderPanel = (overrides: Partial<React.ComponentProps<typeof ExcerptPanel>> = {}) => {
  const props: React.ComponentProps<typeof ExcerptPanel> = {
    excerpt: null,
    shelvedExcerpt: null,
    scope: null,
    hostLabel: 'Jill',
    isRunning: false,
    locked: false,
    onOpenPasteSheet: jest.fn(),
    onChooseFile: jest.fn(),
    onRereadFile: jest.fn(),
    onContinueWithExcerpt: jest.fn(),
    onRepinExcerpt: jest.fn(),
    onSetAside: jest.fn(),
    onStartOpenConversation: jest.fn(),
    ...overrides
  };
  return { ...render(<ExcerptPanel {...props} />), props };
};

describe('ExcerptPanel — path unchosen', () => {
  it('opens with two intent buttons and no pin vocabulary', () => {
    const { container } = renderPanel();

    expect(screen.getByRole('button', { name: /paste or type/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /choose from project/i })).toBeTruthy();
    // \b so "workshopping" in the caption doesn't trip the check.
    expect(container.textContent).not.toMatch(/\bpin(ned|ning|s)?\b/i);
  });

  it('delegates authoring to the shared sheet instead of an inline draft', () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /paste or type/i }));

    expect(props.onOpenPasteSheet).toHaveBeenCalled();
    expect(screen.queryByLabelText('Excerpt text')).toBeNull();
  });

  it('routes the file button to the host picker', () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /choose from project/i }));
    expect(props.onChooseFile).toHaveBeenCalled();
  });

  it('offers the open-conversation path from the rail', () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /start a conversation/i }));
    expect(props.onStartOpenConversation).toHaveBeenCalled();
  });

  it('leads with the carried-over passage after a new session', () => {
    const { props } = renderPanel({ shelvedExcerpt: excerptWith(fileSource) });

    fireEvent.click(screen.getByRole('button', { name: /continue with 05 v2/i }));
    expect(props.onContinueWithExcerpt).toHaveBeenCalled();
  });
});

describe('ExcerptPanel — open conversation without a passage', () => {
  const openProps = { scope: 'open' as const, excerpt: null };

  it('says what the host has read, and that context still rides along', () => {
    const { container } = renderPanel(openProps);

    expect(screen.getByText('Open conversation')).toBeTruthy();
    expect(container.textContent).toContain('Jill hasn’t read any pages');
    expect(container.textContent).toContain('Context attachments below still ride along');
    expect(container.textContent).toContain('the session keeps its history');
  });

  it('offers re-pinning the shelved passage without leaving the conversation', () => {
    const { props } = renderPanel({
      ...openProps,
      shelvedExcerpt: excerptWith(fileSource)
    });

    fireEvent.click(screen.getByRole('button', { name: /re-pin 05 v2/i }));
    expect(props.onRepinExcerpt).toHaveBeenCalled();
    expect(props.onContinueWithExcerpt).not.toHaveBeenCalled();
  });

  it('offers no re-pin affordance when nothing is on the shelf', () => {
    renderPanel(openProps);
    expect(screen.queryByRole('button', { name: /re-pin/i })).toBeNull();
  });
});

describe('ExcerptPanel — passage pinned', () => {
  it('shows the source line for a verified selection, with its line range', () => {
    renderPanel({
      scope: 'excerpt',
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
    renderPanel({ scope: 'excerpt', excerpt: excerptWith({ kind: 'manual' }) });
    expect(screen.getByText(/Pasted or typed · source unknown/)).toBeTruthy();
  });

  it('offers Re-read from file when locked on a file-backed excerpt', () => {
    const { props } = renderPanel({
      scope: 'excerpt',
      locked: true,
      excerpt: excerptWith(fileSource)
    });

    expect(screen.getByText(/Session live/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /update text/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /re-read from file/i }));
    expect(props.onRereadFile).toHaveBeenCalled();
  });

  it('offers Update text… when locked on typed or pasted origin', () => {
    const { props } = renderPanel({
      scope: 'excerpt',
      locked: true,
      excerpt: excerptWith({ kind: 'manual' })
    });

    expect(screen.queryByRole('button', { name: /re-read from file/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /update text/i }));
    expect(props.onOpenPasteSheet).toHaveBeenCalled();
  });

  it('shelves the passage rather than deleting it, and says so', () => {
    const { props } = renderPanel({ scope: 'excerpt', excerpt: excerptWith(fileSource) });
    const setAside = screen.getByRole('button', { name: /set this aside/i });

    expect(setAside.textContent).toContain('Keeps the passage on the shelf');
    // Nobody has read it yet — that is the whole reason this reversal is still
    // on offer (ADR 2026-07-25).
    expect(setAside.textContent).toContain('Jill has not read it yet');
    fireEvent.click(setAside);
    expect(props.onSetAside).toHaveBeenCalled();
  });

  /**
   * ADR 2026-07-25. Un-reading a passage is not something the product can
   * honestly deliver, so once the room has a memory the reversal disappears —
   * and must be replaced by the way out, not by silence.
   */
  it('withdraws the reversal once the room has a memory, and names the way out', () => {
    renderPanel({ scope: 'excerpt', excerpt: excerptWith(fileSource), locked: true });

    expect(screen.queryByRole('button', { name: /set this aside/i })).toBeNull();
    expect(screen.getByText(/Start a new session to chat without this passage/)).toBeTruthy();
    expect(screen.getByText(/context attachments carry over/)).toBeTruthy();
  });
});

describe('ExcerptPanel — open conversation', () => {
  it('offers the passage path only while nobody has been prompted', () => {
    renderPanel({ scope: 'open', excerpt: null });

    expect(screen.getByRole('button', { name: /paste or type/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /from project/i })).toBeTruthy();
  });

  it('closes that door once the conversation has started, and says where to go', () => {
    renderPanel({ scope: 'open', excerpt: null, locked: true });

    expect(screen.queryByRole('button', { name: /paste or type/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /from project/i })).toBeNull();
    expect(screen.getByText(/Start a new session to work on a passage/)).toBeTruthy();
  });

  it('names the set-aside passage in the signpost so it is not lost track of', () => {
    renderPanel({
      scope: 'open',
      excerpt: null,
      locked: true,
      shelvedExcerpt: excerptWith(fileSource)
    });

    expect(screen.getByText(/carry over/)).toBeTruthy();
    expect(screen.getByText(/Your excerpt \(05 v2\)/)).toBeTruthy();
  });
});
