/** @jest-environment jsdom */

/**
 * Holding the writer's place when earlier turns land (ADR 2026-11-17 D7):
 * the anchor is the first bubble still in view, and the scroll position
 * afterwards puts it back where it stood. jsdom lays nothing out, so the DOM
 * readers run over stubbed boxes.
 */

import {
  measureWorkshopThreadPlace,
  restoreWorkshopThreadPlace,
  workshopScrollTopHoldingPlace,
  workshopThreadAnchor
} from '@utils/workshopThreadScrollHold';

describe('workshopThreadAnchor', () => {
  it('is the first bubble any part of which is still in view', () => {
    const rows = [
      { id: 'a', top: -300, bottom: -120 },
      { id: 'b', top: -100, bottom: 40 },
      { id: 'c', top: 62, bottom: 200 }
    ];
    expect(workshopThreadAnchor(rows)).toEqual({ id: 'b', top: -100 });
  });

  it('skips a bubble that ends exactly at the view\'s top edge, and answers nothing with no bubble in view', () => {
    expect(workshopThreadAnchor([{ id: 'a', top: -50, bottom: 0 }, { id: 'b', top: 22, bottom: 90 }]))
      .toEqual({ id: 'b', top: 22 });
    expect(workshopThreadAnchor([{ id: 'a', top: -50, bottom: -10 }])).toBeUndefined();
    expect(workshopThreadAnchor([])).toBeUndefined();
  });
});

describe('workshopScrollTopHoldingPlace', () => {
  const before = { scrollTop: 40, scrollHeight: 2_000, anchor: { id: 'b', top: -100 } };

  it('moves the scroll by how far the anchor moved', () => {
    // 4,000px of earlier turns landed above: the anchor now stands 4,000px lower.
    expect(workshopScrollTopHoldingPlace(before, { scrollTop: 40, scrollHeight: 6_000, anchorTop: 3_900 })).toBe(4_040);
  });

  it('changes nothing when the browser already held the anchor', () => {
    expect(workshopScrollTopHoldingPlace(before, { scrollTop: 4_040, scrollHeight: 6_000, anchorTop: -100 })).toBe(4_040);
  });

  it('falls back to the content\'s growth when the anchor is gone or there was none', () => {
    expect(workshopScrollTopHoldingPlace(before, { scrollTop: 40, scrollHeight: 6_000 })).toBe(4_040);
    expect(workshopScrollTopHoldingPlace({ scrollTop: 0, scrollHeight: 500 }, { scrollTop: 0, scrollHeight: 900, anchorTop: 10 }))
      .toBe(400);
  });

  it('never scrolls above the top', () => {
    expect(workshopScrollTopHoldingPlace(before, { scrollTop: 10, scrollHeight: 2_000, anchorTop: -400 })).toBe(0);
  });
});

describe('the DOM readers', () => {
  const box = (top: number, height: number) => () => ({ top, bottom: top + height, height } as DOMRect);
  const row = (id: string, top: number, height: number) => {
    const element = document.createElement('div');
    element.setAttribute('data-turn-id', id);
    element.getBoundingClientRect = box(top, height);
    return element;
  };
  const scrollerWith = (rows: HTMLElement[], scrollTop: number, scrollHeight: number) => {
    const scroller = document.createElement('div');
    scroller.getBoundingClientRect = box(100, 600);
    rows.forEach((each) => scroller.appendChild(each));
    scroller.scrollTop = scrollTop;
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: scrollHeight });
    return scroller;
  };

  it('measures the anchor from the scroller\'s top edge, and restores the place after rows land above', () => {
    const b = row('b', 60, 140);
    const scroller = scrollerWith([row('a', -200, 240), b, row('c', 222, 300)], 300, 1_000);

    const place = measureWorkshopThreadPlace(scroller, 'data-turn-id');
    expect(place).toEqual({ scrollTop: 300, scrollHeight: 1_000, anchor: { id: 'b', top: -40 } });

    // Earlier turns landed above: every row stands 500px lower.
    scroller.insertBefore(row('earlier', -700, 480), scroller.firstChild);
    b.getBoundingClientRect = box(560, 140);
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 1_500 });

    restoreWorkshopThreadPlace(scroller, 'data-turn-id', place);

    expect(scroller.scrollTop).toBe(800);
  });

  it('uses the content\'s growth when no bubble was in view', () => {
    const scroller = scrollerWith([], 0, 400);
    const place = measureWorkshopThreadPlace(scroller, 'data-turn-id');
    expect(place.anchor).toBeUndefined();

    scroller.appendChild(row('earlier', 100, 300));
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 700 });
    restoreWorkshopThreadPlace(scroller, 'data-turn-id', place);

    expect(scroller.scrollTop).toBe(300);
  });
});
