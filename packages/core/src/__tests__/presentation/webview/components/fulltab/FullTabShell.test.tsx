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
import { FULL_TAB_RAIL_BODY_ID, FullTabRail, FullTabRailCollapse } from '@components/fulltab/FullTabRail';

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

    expect(container.firstElementChild?.className).toBe('pm-ws pm-ws-with-aside');
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

  describe('inertBehindOverlay (PR #186 N-03)', () => {
    const frame = (inertBehindOverlay?: boolean) => (
      <FullTabShell
        brand={brand}
        headerActions={<button type="button">Header action</button>}
        banners={<div role="status">A banner</div>}
        rail={{ label: 'Board rail', boundaryName: 'Lightbox rail', content: <button type="button">Rail row</button> }}
        main={{ label: 'Board', content: <p>Main content</p> }}
        {...(inertBehindOverlay === undefined ? {} : { inertBehindOverlay })}
      >
        <div role="dialog" aria-label="Overlay"><button type="button">Inside</button></div>
      </FullTabShell>
    );

    it('leaves the markup exactly as before when it is off', () => {
      const omitted = render(frame()).container.innerHTML;
      const off = render(frame(false)).container.innerHTML;
      expect(off).toBe(omitted);
      expect(omitted).not.toContain('inert');
    });

    it('marks the header and the split inert, and never the overlay', () => {
      const { container } = render(frame(true));
      expect(container.querySelector('.pm-ws-header')?.hasAttribute('inert')).toBe(true);
      expect(container.querySelector('.pm-ws-split')?.hasAttribute('inert')).toBe(true);
      const dialog = screen.getByRole('dialog', { name: 'Overlay' });
      expect(dialog.closest('[inert]')).toBeNull();
      // Banners are the tab's to inert: the shell adds no wrapper around them.
      expect(screen.getByRole('status').parentElement?.className).toBe('pm-ws');
    });
  });
});

describe('FullTabShell railCollapse (Everyday Conveniences, item D)', () => {
  const strip = <button type="button">Strip icon</button>;

  const frame = (railCollapse?: FullTabRailCollapse, aside = false) => (
    <FullTabShell
      brand={brand}
      headerActions={<button type="button">Header action</button>}
      banners={<div role="status">A banner</div>}
      rail={{
        label: 'Board rail',
        boundaryName: 'Lightbox rail',
        content: <><button type="button">Rail row</button><input aria-label="Rail field" /></>
      }}
      main={{ label: 'Board', content: <p>Main content</p> }}
      {...(aside ? { aside: { label: 'Inspector', boundaryName: 'Inspector', content: <p>Pinned</p> } } : {})}
      {...(railCollapse ? { railCollapse } : {})}
    />
  );

  const collapse = (overrides: Partial<FullTabRailCollapse> = {}): FullTabRailCollapse => ({
    collapsed: false,
    overlay: false,
    onToggle: jest.fn(),
    strip,
    ...overrides
  });

  // eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
  const Stateful: React.FC<{ overlay?: boolean }> = ({ overlay = false }) => {
    const [collapsed, setCollapsed] = React.useState(false);
    return frame(collapse({
      collapsed,
      overlay: overlay && !collapsed,
      onToggle: () => setCollapsed((current) => !current)
    }));
  };

  const control = () => screen.getByRole('button', { name: 'Side pane' });

  it('leaves the markup exactly as it was without the opt-in', () => {
    // The frame's markup as it stood before the opt-in existed, written out.
    const { container } = render(frame());
    expect(container.querySelector('.pm-ws-split')?.outerHTML).toBe(
      '<div class="pm-ws-split">'
      + '<aside class="pm-ws-rail" aria-label="Board rail">'
      + '<button type="button">Rail row</button><input aria-label="Rail field">'
      + '</aside>'
      + '<section class="pm-ws-main" aria-label="Board"><p>Main content</p></section>'
      + '</div>'
    );
    expect(container.innerHTML).not.toMatch(/collaps|pm-ws-rail-(toggle|body|strip)|aria-expanded/);
  });

  it('opting in changes nothing outside the split', () => {
    const plain = render(frame()).container;
    const opted = render(frame(collapse())).container;
    const outside = (root: HTMLElement) => {
      const copy = root.cloneNode(true) as HTMLElement;
      copy.querySelector('.pm-ws-split')?.remove();
      return copy.innerHTML;
    };
    expect(outside(opted)).toBe(outside(plain));
  });

  it('leaves a three-column tab alone: an aside keeps its own narrow rules', () => {
    expect(render(frame(collapse(), true)).container.innerHTML)
      .toBe(render(frame(undefined, true)).container.innerHTML);
  });

  it('expanded: the control names the rail content it controls, and the content shows', () => {
    const { container } = render(frame(collapse()));
    expect(control().getAttribute('aria-expanded')).toBe('true');
    expect(control().getAttribute('aria-controls')).toBe(FULL_TAB_RAIL_BODY_ID);
    const body = document.getElementById(FULL_TAB_RAIL_BODY_ID)!;
    expect(body.hidden).toBe(false);
    expect(body.textContent).toBe('Rail row');
    expect(screen.queryByRole('button', { name: 'Strip icon' })).toBeNull();
    // The control sits at the rail's top edge, not in the header.
    expect(screen.getByLabelText('Board rail').firstElementChild).toBe(control());
    expect(container.querySelector('.pm-ws-header')?.contains(control())).toBe(false);
    expect(container.querySelector('.pm-ws-split')?.className).toBe('pm-ws-split pm-ws-split-collapsible');
    expect(screen.getByLabelText('Board rail').className).toBe('pm-ws-rail pm-ws-rail-collapsible');
  });

  it('collapsed: shows the tab\'s strip and keeps the content mounted but hidden', () => {
    const { container } = render(frame(collapse({ collapsed: true })));
    expect(control().getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: 'Strip icon' })).not.toBeNull();
    const body = document.getElementById(control().getAttribute('aria-controls')!)!;
    expect(body.hidden).toBe(true);
    expect(body.textContent).toBe('Rail row');
    expect(container.querySelector('.pm-ws-split')?.className)
      .toBe('pm-ws-split pm-ws-split-collapsible pm-ws-split-rail-collapsed');
    expect(screen.getByLabelText('Board rail').className)
      .toBe('pm-ws-rail pm-ws-rail-collapsible pm-ws-rail-collapsed');
  });

  it('collapses and expands from the control', () => {
    render(<Stateful />);
    fireEvent.click(control());
    expect(control().getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: 'Strip icon' })).not.toBeNull();
    fireEvent.click(control());
    expect(control().getAttribute('aria-expanded')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Strip icon' })).toBeNull();
  });

  it('moves focus to the control when the rail collapses around it', () => {
    render(<Stateful />);
    const row = screen.getByText('Rail row');
    row.focus();
    expect(document.activeElement).toBe(row);
    fireEvent.click(control());
    expect(document.activeElement).toBe(control());
  });

  it('leaves focus alone when it was outside the rail', () => {
    render(<Stateful />);
    const header = screen.getByRole('button', { name: 'Header action' });
    header.focus();
    fireEvent.click(control());
    expect(document.activeElement).toBe(header);
  });

  it('marks an open rail on a narrow tab as an overlay', () => {
    const { container } = render(frame(collapse({ overlay: true })));
    expect(container.querySelector('.pm-ws-split')?.className)
      .toBe('pm-ws-split pm-ws-split-collapsible pm-ws-split-rail-overlay');
    expect(screen.getByLabelText('Board rail').className)
      .toBe('pm-ws-rail pm-ws-rail-collapsible pm-ws-rail-overlay');
  });

  it('closes an overlaid rail on Escape, with focus on the control', () => {
    render(<Stateful overlay />);
    const row = screen.getByText('Rail row');
    row.focus();
    fireEvent.keyDown(row, { key: 'Escape' });
    expect(control().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(control());
  });

  it('leaves Escape to a field inside the rail, and to a rail that squeezes', () => {
    const overlaid = collapse({ overlay: true });
    const first = render(frame(overlaid));
    fireEvent.keyDown(screen.getByLabelText('Rail field'), { key: 'Escape' });
    expect(overlaid.onToggle).not.toHaveBeenCalled();
    first.unmount();

    const beside = collapse();
    render(frame(beside));
    fireEvent.keyDown(screen.getByText('Rail row'), { key: 'Escape' });
    expect(beside.onToggle).not.toHaveBeenCalled();
  });
});
