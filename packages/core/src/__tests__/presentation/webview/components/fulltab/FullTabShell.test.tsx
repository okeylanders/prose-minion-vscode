/**
 * @jest-environment jsdom
 */

/**
 * FullTabShell + FullTabRail — the frame every full editor tab shares
 * (Lightbox Slice 1). The shell owns layout only: each slot renders where the
 * tab's content goes, the side regions carry their labels, and a side region
 * that throws falls back on its own without taking the tab down.
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { FullTabShell } from '@components/fulltab/FullTabShell';
import { FullTabRail } from '@components/fulltab/FullTabRail';

const brand = {
  eyebrow: 'Prose Minion · Inspiration & Mood Board',
  title: 'Lightbox',
  subtitle: <span>Drafts/chapter-6.md · 3,087 words</span>
};

let shouldThrow = false;

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const Flaky: React.FC = () => {
  if (shouldThrow) {
    throw new Error('rail exploded');
  }
  return <p>Rail content</p>;
};

describe('FullTabShell', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    shouldThrow = false;
    // ErrorBoundary and React both log a caught render error.
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => consoleError.mockRestore());

  it('renders every slot in the frame', () => {
    const { container } = render(
      <FullTabShell
        brand={brand}
        headerActions={<button type="button">Header action</button>}
        banners={<div role="status">A banner</div>}
        rail={{ label: 'Board rail', boundaryName: 'Lightbox rail', content: <p>Rail content</p> }}
        main={{ label: 'Board', content: <p>Main content</p> }}
      >
        <div role="dialog" aria-label="Overlay" />
      </FullTabShell>
    );

    expect(screen.getByRole('heading', { name: 'Lightbox' })).not.toBeNull();
    expect(screen.getByText('Prose Minion · Inspiration & Mood Board')).not.toBeNull();
    expect(screen.getByText('Drafts/chapter-6.md · 3,087 words')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Header action' }).parentElement?.className)
      .toBe('pm-ws-header-actions');
    expect(screen.getByRole('status').textContent).toBe('A banner');
    expect(screen.getByLabelText('Board rail').textContent).toBe('Rail content');
    expect(screen.getByLabelText('Board').textContent).toBe('Main content');
    expect(screen.getByRole('dialog', { name: 'Overlay' }).parentElement?.className).toBe('pm-ws');

    const split = container.querySelector('.pm-ws-split');
    expect(split?.className).toBe('pm-ws-split');
    expect(container.querySelector('.pm-ws-aside')).toBeNull();
  });

  it('keeps the frame order: header, banners, then the split', () => {
    const { container } = render(
      <FullTabShell
        brand={brand}
        banners={<div className="test-banner" />}
        rail={{ label: 'Rail', boundaryName: 'Rail', content: null }}
        main={{ label: 'Main', content: null }}
      />
    );

    const frame = container.querySelector('.pm-ws');
    expect(Array.from(frame?.children ?? []).map((child) => child.className))
      .toEqual(['pm-ws-header', 'test-banner', 'pm-ws-split']);
    const split = container.querySelector('.pm-ws-split');
    expect(Array.from(split?.children ?? []).map((child) => child.tagName.toLowerCase()))
      .toEqual(['aside', 'section']);
  });

  it('adds the trailing aside column only when one is given', () => {
    const { container } = render(
      <FullTabShell
        brand={brand}
        rail={{ label: 'Board rail', boundaryName: 'Lightbox rail', content: null }}
        main={{ label: 'Board', content: null }}
        aside={{ label: 'Inspector', boundaryName: 'Lightbox inspector', content: <p>Pinned</p> }}
      />
    );

    expect(container.querySelector('.pm-ws-split')?.className)
      .toBe('pm-ws-split pm-ws-split-with-aside');
    const inspector = screen.getByLabelText('Inspector');
    expect(inspector.className).toBe('pm-ws-aside');
    expect(inspector.textContent).toBe('Pinned');
  });

  it('contains a rail render failure to the rail, names it, reports it, and retries', () => {
    shouldThrow = true;
    const onBoundaryError = jest.fn();

    render(
      <FullTabShell
        brand={brand}
        rail={{ label: 'Session rail', boundaryName: 'Workshop rail', content: <Flaky /> }}
        main={{ label: 'Session thread', content: <p>Thread survives</p> }}
        onBoundaryError={onBoundaryError}
      />
    );

    expect(screen.getByLabelText('Session rail').textContent).toContain('Error in Workshop rail');
    expect(screen.getByText('Thread survives')).not.toBeNull();
    expect(onBoundaryError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'rail exploded' }),
      expect.anything()
    );

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(screen.getByLabelText('Session rail').textContent).toBe('Rail content');
  });
});

describe('FullTabRail', () => {
  it('is the leading rail by default and the trailing aside on request', () => {
    const { rerender } = render(
      <FullTabRail label="Session rail" boundaryName="Workshop rail">
        <p>Panels</p>
      </FullTabRail>
    );
    expect(screen.getByLabelText('Session rail').className).toBe('pm-ws-rail');

    rerender(
      <FullTabRail label="Inspector" boundaryName="Lightbox inspector" placement="aside">
        <p>Panels</p>
      </FullTabRail>
    );
    expect(screen.getByLabelText('Inspector').className).toBe('pm-ws-aside');
  });
});
