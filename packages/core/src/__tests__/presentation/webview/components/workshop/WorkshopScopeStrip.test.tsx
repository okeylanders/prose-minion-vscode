/**
 * @jest-environment jsdom
 */

/**
 * WorkshopScopeStrip — the center scope banner (Sprint 13A §10).
 *
 * Under test:
 * - the strip states what the session IS from `scope`, never from a missing
 *   excerpt (§1),
 * - with a passage on the shelf it offers the non-destructive route back, so
 *   "Add excerpt" is not the only affordance pointing at a one-slot shelf (§4).
 */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkshopScopeStrip } from '@components/workshop/WorkshopScopeStrip';

const renderStrip = (props: Partial<React.ComponentProps<typeof WorkshopScopeStrip>> = {}) =>
  render(
    <WorkshopScopeStrip
      scope="open"
      hostLabel="Jill"
      roomHasMemory={false}
      disabled={false}
      onAddExcerpt={jest.fn()}
      onRepinExcerpt={jest.fn()}
      {...props}
    />
  );

describe('WorkshopScopeStrip — open conversation', () => {
  it('says out loud what the host has not read', () => {
    renderStrip();
    expect(screen.getByText('Open conversation · No excerpt yet')).toBeTruthy();
    expect(screen.getByText(/Jill hasn’t read any pages/)).toBeTruthy();
  });

  /**
   * ADR 2026-07-25: an open conversation that has started stays open, so the
   * strip stops offering and points at a new session instead.
   */
  it('closes the passage door once the conversation has started', () => {
    renderStrip({ roomHasMemory: true, shelvedExcerptTitle: 'one', shelvedExcerptVersion: 1 });

    expect(screen.queryByRole('button', { name: /Add excerpt/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Re-pin/ })).toBeNull();
    expect(screen.getByText(/Start a new session to change this/)).toBeTruthy();
  });
});

describe('WorkshopScopeStrip — the shelf', () => {
  it('offers the non-destructive route back when a passage is set aside', () => {
    const onRepinExcerpt = jest.fn();
    renderStrip({ shelvedExcerptTitle: 'one', shelvedExcerptVersion: 1, onRepinExcerpt });

    fireEvent.click(screen.getByRole('button', { name: /Re-pin one v1/ }));
    expect(onRepinExcerpt).toHaveBeenCalled();
  });

  /**
   * Regression (PR #86 review): "Add excerpt" was this strip's ONLY action,
   * and it discards the shelved passage. The re-pin lived solely in the rail,
   * so a writer working from the strip had no way back to their own passage.
   */
  it('does not offer a re-pin when the shelf is empty', () => {
    renderStrip();
    expect(screen.queryByRole('button', { name: /Re-pin/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Add excerpt/ })).toBeTruthy();
  });

  it('warns on the replacing action that it displaces the set-aside passage', () => {
    renderStrip({ shelvedExcerptTitle: 'one', shelvedExcerptVersion: 1 });
    expect(screen.getByRole('button', { name: /Add excerpt/ }).getAttribute('title'))
      .toContain('replaces the set-aside one');
  });
});

describe('WorkshopScopeStrip — scope is explicit', () => {
  /**
   * §1: nothing may infer "open conversation" from a missing excerpt. A
   * passage session with nothing pinned is not a state this strip can
   * describe, so it renders nothing rather than announcing the wrong session.
   */
  it('refuses to describe a passage session as an open conversation', () => {
    const { container } = renderStrip({ scope: 'excerpt' });
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for an unchosen path', () => {
    const { container } = renderStrip({ scope: null });
    expect(container.firstChild).toBeNull();
  });
});
