/** @jest-environment jsdom */

/**
 * "Show earlier turns" in the thread (ADR 2026-11-17 D6, D7): the control's
 * states and words, its one live region, the host's parts on an earlier
 * bubble, and the scroll hold when a page lands. Made-up turns.
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('marked', () => {
  const marked = Object.assign(jest.fn((content: string) => content), { setOptions: jest.fn() });
  return { marked };
});

import { WorkshopThread } from '@components/workshop/WorkshopThread';
import { WorkshopEarlierTurnsControl } from '@components/workshop/WorkshopEarlierTurnsControl';
import { WORKSHOP_TURN_ID_ATTRIBUTE } from '@components/workshop/WorkshopTurnBubble';
import type { WorkshopEarlierTurnsThreadView } from '@hooks/domain/workshop/useWorkshopEarlierTurns';
import type { WorkshopTurn, WorkshopTurnReactionSummary } from '@messages';

const reply = (id: string, content: string, change: Partial<WorkshopTurn> = {}): WorkshopTurn => ({
  id,
  role: 'assistant',
  kind: 'message',
  participant: 'host',
  artifact: 'persona_message',
  personaId: 'jill',
  personaLabel: 'Jill',
  content,
  timestamp: 1,
  excerptVersion: 1,
  ...change
} as WorkshopTurn);

const view = (change: Partial<WorkshopEarlierTurnsThreadView> = {}): WorkshopEarlierTurnsThreadView => ({
  turns: [],
  turnRewindability: {},
  reactionsByTurn: new Map(),
  widgetConfigSummaries: {},
  remaining: 73,
  pending: false,
  landSerial: 0,
  announcement: '',
  announcementSerial: 0,
  onShowEarlier: jest.fn(),
  ...change
});

const noop = jest.fn();
const thread = (earlier: WorkshopEarlierTurnsThreadView, props: Partial<React.ComponentProps<typeof WorkshopThread>> = {}) => (
  <WorkshopThread
    turns={[reply('window-1', 'The window\'s first reply.')]}
    hiddenTurns={73}
    earlier={earlier}
    toolSidecars={[]}
    currentExcerptVersion={1}
    onQuickAction={noop}
    onTalkDirectly={noop}
    onCopy={noop}
    onSave={noop}
    {...props}
  />
);

const announcer = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-pm-earlier-turns-announcer]')!;

describe('the control', () => {
  it('leads the thread with the count, and says the hidden turns are kept', () => {
    const { container } = render(thread(view()));

    const block = container.querySelector('.pm-ws-thread-earlier')!;
    const button = screen.getByRole('button', { name: 'Show earlier turns (73 not shown)' });
    expect(block.contains(button)).toBe(true);
    expect(block.textContent).toContain('They\'re kept in full: export, bookmarks and the personas still have them.');
    expect(block.textContent).not.toMatch(/coming soon|pagination/i);
    // Before the first bubble, and in place of part 1's plain notice.
    expect(block.compareDocumentPosition(container.querySelector(`[${WORKSHOP_TURN_ID_ATTRIBUTE}]`)!) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(container.querySelectorAll('.pm-ws-thread-hidden')).toHaveLength(1);
    expect(button.getAttribute('aria-disabled')).toBeNull();
  });

  it('agrees in number for one turn, and groups a large count', () => {
    render(thread(view({ remaining: 1 })));
    expect(screen.getByRole('button', { name: 'Show earlier turns (1 not shown)' })).toBeTruthy();
    expect(document.querySelector('.pm-ws-thread-earlier')!.textContent).toContain('It\'s kept in full');

    render(thread(view({ remaining: 1_200 })));
    expect(screen.getByRole('button', { name: `Show earlier turns (${(1_200).toLocaleString()} not shown)` })).toBeTruthy();
  });

  it('pressed, asks once', () => {
    const onShowEarlier = jest.fn();
    render(thread(view({ onShowEarlier })));

    fireEvent.click(screen.getByRole('button', { name: /Show earlier turns/ }));

    expect(onShowEarlier).toHaveBeenCalledTimes(1);
  });

  it('while its page is pending: says so, stays focusable, and ignores a press', () => {
    const onShowEarlier = jest.fn();
    render(thread(view({ pending: true, onShowEarlier })));

    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Loading earlier turns…' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.disabled).toBe(false);
    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    expect(onShowEarlier).not.toHaveBeenCalled();
  });

  it('shows a refusal\'s words beside the control, as its description', () => {
    render(thread(view({ error: 'The room changed before its earlier turns could be shown.' })));

    const button = screen.getByRole('button', { name: /Show earlier turns/ });
    const described = document.getElementById(button.getAttribute('aria-describedby')!);
    expect(described?.textContent).toBe('The room changed before its earlier turns could be shown.');
    expect(document.querySelector('.pm-ws-thread-earlier')!.contains(described)).toBe(true);
  });

  it('goes at the room\'s first turn, and the live region stays to say so', () => {
    const { container } = render(thread(view({ remaining: 0, announcement: '13 earlier turns shown.', announcementSerial: 1 })));

    expect(container.querySelector('.pm-ws-thread-earlier')).toBeNull();
    expect(container.querySelector('.pm-ws-thread-hidden')).toBeNull();
    expect(screen.queryByRole('button', { name: /earlier turns/ })).toBeNull();
    expect(announcer(container).textContent).toBe('13 earlier turns shown.');
  });

  it('has one polite live region, there before any page lands, re-keyed per announcement', () => {
    const { container, rerender } = render(thread(view()));
    const region = announcer(container);
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.getAttribute('role')).toBe('status');
    expect(region.textContent).toBe('');
    expect(container.querySelectorAll('[data-pm-earlier-turns-announcer]')).toHaveLength(1);

    rerender(thread(view({ announcement: '100 earlier turns shown.', announcementSerial: 1 })));
    const first = announcer(container).firstElementChild;
    expect(first?.textContent).toBe('100 earlier turns shown.');
    // The same words again are a new node, so they are read again.
    rerender(thread(view({ announcement: '100 earlier turns shown.', announcementSerial: 2 })));
    expect(announcer(container).firstElementChild).not.toBe(first);
    expect(announcer(container)).toBe(region);
  });
});

describe('an earlier bubble', () => {
  const earlierTurn = reply('earlier-1', 'An earlier reply.');
  const reaction = { turnId: 'earlier-1', reaction: 'heart', author: { kind: 'writer' }, label: 'You' } as WorkshopTurnReactionSummary;

  it('offers Rewind and Branch from the page\'s verdicts, and acts on its own turn', () => {
    const onRewind = jest.fn();
    const onBranch = jest.fn();
    render(thread(
      view({ turns: [earlierTurn], turnRewindability: { 'earlier-1': { available: true } } }),
      {
        turns: [earlierTurn, reply('window-1', 'The window\'s first reply.')],
        // The window's own maps hold nothing for the earlier turn.
        turnRewindability: {},
        turnBranchability: {},
        onRewind,
        onBranch
      }
    ));

    const bubble = document.querySelector<HTMLElement>(`[${WORKSHOP_TURN_ID_ATTRIBUTE}="earlier-1"]`)!;
    const rewind = bubble.querySelector<HTMLButtonElement>('.pm-ws-rewind-action');
    const branch = bubble.querySelector<HTMLButtonElement>('.pm-ws-branch-action');
    expect(rewind).not.toBeNull();
    expect(branch).not.toBeNull();
    fireEvent.click(rewind!);
    fireEvent.click(branch!);
    expect(onRewind).toHaveBeenCalledWith(expect.objectContaining({ id: 'earlier-1' }));
    expect(onBranch).toHaveBeenCalledWith(expect.objectContaining({ id: 'earlier-1' }));
    // The window's reply has no verdict from either map: no Rewind there.
    const windowBubble = document.querySelector<HTMLElement>(`[${WORKSHOP_TURN_ID_ATTRIBUTE}="window-1"]`)!;
    expect(windowBubble.querySelector('.pm-ws-rewind-action')).toBeNull();
  });

  it('draws the page\'s reactions for an earlier turn and the snapshot\'s for the window', () => {
    const asked: string[] = [];
    const windowReaction = { ...reaction, turnId: 'window-1', reaction: 'mind-blown' } as WorkshopTurnReactionSummary;
    render(thread(
      view({ turns: [earlierTurn], reactionsByTurn: new Map([['earlier-1', [reaction]]]) }),
      {
        turns: [earlierTurn, reply('window-1', 'The window\'s first reply.')],
        reactions: {
          reactionsOf: (turnId) => {
            asked.push(turnId);
            return turnId === 'window-1' ? [windowReaction] : [];
          },
          disabled: false,
          onSet: jest.fn(),
          onHide: jest.fn()
        }
      }
    ));

    const bubble = (id: string) => document.querySelector<HTMLElement>(`[${WORKSHOP_TURN_ID_ATTRIBUTE}="${id}"]`)!;
    expect(bubble('earlier-1').querySelectorAll('.pm-ws-reaction-item')).toHaveLength(1);
    expect(bubble('window-1').querySelectorAll('.pm-ws-reaction-item')).toHaveLength(1);
    expect(asked).toContain('window-1');
    expect(asked).not.toContain('earlier-1');
  });
});

describe('the scroll hold', () => {
  // jsdom lays nothing out: each element reads its box from attributes React
  // writes at commit, so a measure taken before the commit sees the earlier ones.
  const realRect = HTMLElement.prototype.getBoundingClientRect;

  beforeEach(() => {
    HTMLElement.prototype.getBoundingClientRect = function rect(this: HTMLElement) {
      const top = Number(this.getAttribute('data-top') ?? 0);
      return { top, bottom: top + 100, height: 100 } as DOMRect;
    };
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get(this: HTMLElement) { return Number(this.getAttribute('data-height') ?? 0); }
    });
  });

  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = realRect;
    delete (HTMLElement.prototype as { scrollHeight?: number }).scrollHeight;
  });

  const scroller = (landSerial: number, height: number, rows: Record<string, number>) => (
    <div className="pm-ws-thread" data-height={height}>
      <WorkshopEarlierTurnsControl earlier={view({ landSerial })} rowAttribute="data-turn-id" />
      {Object.entries(rows).map(([id, top]) => <div key={id} data-turn-id={id} data-top={top} />)}
    </div>
  );

  it('keeps the bubble at the top of the view where it was when a page lands above it', () => {
    const { container, rerender } = render(scroller(0, 1_000, { a: -60, b: 62 }));
    const element = container.querySelector<HTMLElement>('.pm-ws-thread')!;
    element.scrollTop = 0;

    // The page lands: two earlier rows above, and everything stands 900px lower.
    rerender(scroller(1, 1_900, { older1: -60, older2: 400, a: 840, b: 962 }));

    expect(element.scrollTop).toBe(900);
  });

  it('leaves the scroll alone when the thread changes without a page landing', () => {
    const { container, rerender } = render(scroller(3, 1_000, { a: -60, b: 62 }));
    const element = container.querySelector<HTMLElement>('.pm-ws-thread')!;
    element.scrollTop = 250;

    rerender(scroller(3, 1_900, { a: 840, b: 962, c: 1_084 }));

    expect(element.scrollTop).toBe(250);
  });
});
