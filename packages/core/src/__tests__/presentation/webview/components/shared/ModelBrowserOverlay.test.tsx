/**
 * @jest-environment jsdom
 */

/**
 * The Model Browser joins the overlay stack (PR #150 F-07): while it is open
 * a handed-over seed sees an overlay, Escape closes it only when it is on
 * top, focus returns to what opened it, and choosing a model still reaches
 * its scope. The header path (the browser alone) and the nested path (the
 * browser over a widget sheet) both hold.
 */

import * as React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ModelSelector } from '@components/shared/ModelSelector';
import { WorkshopModalShell } from '@components/workshop/WorkshopModalShell';
import { __resetOverlayFocusStateForTests, isAnyOverlayOpen } from '@hooks/useOverlayDismiss';
import type { ModelOption } from '@shared/types';

const OPTIONS: ModelOption[] = [
  { id: 'provider/reader-model', label: 'Reader model (stub)', provider: 'provider' },
  { id: 'provider/second-model', label: 'Second model (stub)', provider: 'provider' }
];

describe('Model Browser in the overlay stack', () => {
  afterEach(() => {
    cleanup();
    __resetOverlayFocusStateForTests();
  });

  const escape = () => act(() => {
    fireEvent.keyDown(window, { key: 'Escape' });
  });
  /** Focus is handed back on a microtask, after any overlay opening in the same commit. */
  const settleFocus = () => act(async () => {
    await Promise.resolve();
  });
  const browser = () => screen.queryByRole('dialog', { name: /Model browser$/ });

  it('header: registers while open, takes Escape, returns focus to its trigger, and routes a choice to its scope', async () => {
    const onChange = jest.fn();
    render(<ModelSelector scope="assistant" options={OPTIONS} value="provider/reader-model" onChange={onChange} label="Assistant Model" />);
    const trigger = screen.getByRole('button', { name: /Browse assistant model options/ });
    trigger.focus();
    fireEvent.click(trigger);
    expect(browser()).not.toBeNull();
    expect(isAnyOverlayOpen()).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));

    escape();
    await settleFocus();
    expect(browser()).toBeNull();
    expect(isAnyOverlayOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: /Second model \(stub\)/ }));
    await settleFocus();
    expect(onChange).toHaveBeenCalledWith('assistant', 'provider/second-model');
    expect(browser()).toBeNull();
    expect(isAnyOverlayOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('nested over a sheet: one Escape closes only the browser and returns focus inside the sheet; the next closes the sheet', async () => {
    const onCloseSheet = jest.fn();
    const onChange = jest.fn();
    render(
      <WorkshopModalShell open titleId="sheet-title" closeLabel="Close sheet" onClose={onCloseSheet}>
        <h2 id="sheet-title">Widget sheet</h2>
        <WorkshopModalShell.CloseButton />
        <ModelSelector scope="widget" options={OPTIONS} value="provider/reader-model" onChange={onChange} label="Widget Model" />
      </WorkshopModalShell>
    );
    const trigger = screen.getByRole('button', { name: /Browse widget model options/ });
    trigger.focus();
    fireEvent.click(trigger);
    expect(browser()).not.toBeNull();

    escape();
    await settleFocus();
    expect(browser()).toBeNull();
    expect(onCloseSheet).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Widget sheet' })).not.toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(isAnyOverlayOpen()).toBe(true);

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: /Second model \(stub\)/ }));
    await settleFocus();
    expect(onChange).toHaveBeenCalledWith('widget', 'provider/second-model');
    expect(document.activeElement).toBe(trigger);

    escape();
    expect(onCloseSheet).toHaveBeenCalledTimes(1);
  });

  it('leaves the stack when it unmounts while open', () => {
    const view = render(<ModelSelector scope="assistant" options={OPTIONS} onChange={jest.fn()} label="Assistant Model" />);
    fireEvent.click(screen.getByRole('button', { name: /Browse assistant model options/ }));
    expect(isAnyOverlayOpen()).toBe(true);
    view.unmount();
    expect(isAnyOverlayOpen()).toBe(false);
  });
});
