/** @jest-environment jsdom */

import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '@/presentation/webview/App';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { MessageType, type RecentWorkshopSessionRow, type UnsavedWorkshopSessionRow } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

const rows: UnsavedWorkshopSessionRow[] = Array.from({ length: 7 }, (_, index) => ({
  token: 'token-' + index,
  title: 'Scene ' + index,
  preview: 'Excerpt ' + index,
  updatedAt: index === 6 ? 'unknown timestamp' : '2026-11-12T09:10:00Z',
  canDelete: index !== 0
}));

const recentRows: RecentWorkshopSessionRow[] = Array.from({ length: 4 }, (_, index) => ({
  token: 'saved-token-' + index,
  title: 'Saved project ' + index,
  updatedAt: '2026-11-12T09:10:00Z'
}));

describe('Workshop sessions in the sidebar', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  beforeEach(() => {
    vscode = createMockVSCode();
    jest.mocked(useVSCodeApi).mockReturnValue(vscode);
  });

  const request = (type: MessageType) => vscode.postMessage.mock.calls.map(([message]) => message)
    .filter(message => message.type === type).at(-1)?.payload;
  const result = (requestId: string, available: UnsavedWorkshopSessionRow[], error?: string) =>
    fireEvent(window, new MessageEvent('message', { data: {
      type: MessageType.UNSAVED_WORKSHOP_SESSIONS_RESULT, payload: { requestId, rows: available, error }
    } }));
  const recentResult = (requestId: string, available: RecentWorkshopSessionRow[], error?: string) =>
    fireEvent(window, new MessageEvent('message', { data: {
      type: MessageType.RECENT_WORKSHOP_SESSIONS_RESULT, payload: { requestId, rows: available, error }
    } }));
  const chevron = () => screen.getByRole('button', { name: 'Workshop sessions' });
  const openMenu = (recent: RecentWorkshopSessionRow[] = []) => {
    fireEvent.click(chevron());
    recentResult(request(MessageType.LIST_RECENT_WORKSHOP_SESSIONS).requestId, recent);
    return request(MessageType.LIST_UNSAVED_WORKSHOP_SESSIONS).requestId as string;
  };

  it('lists every closed session, keeps the keyboard on the selected row and sends its token', () => {
    render(<App />);
    const old = openMenu();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(document.activeElement).toBe(chevron());
    const current = openMenu();
    result(old, []);
    expect(screen.getByRole('status').textContent).toMatch(/Loading sessions/);
    result(current, rows);
    const menu = screen.getByRole('menu', { name: 'Workshop sessions' });
    const choices = within(menu).getAllByRole('menuitem');
    expect(choices).toHaveLength(8);
    expect(choices[0].textContent).toContain('Excerpt 0');
    expect(choices[0].querySelector('time')?.dateTime).toBe(rows[0].updatedAt);
    expect(choices[6].querySelector('time')).toBeNull();
    expect(document.activeElement).toBe(choices[0]);
    fireEvent.keyDown(choices[0], { key: 'End' });
    expect(document.activeElement).toBe(choices[7]);
    fireEvent.keyDown(choices[7], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(choices[6]);
    fireEvent.click(choices[6]);
    const opening = request(MessageType.OPEN_UNSAVED_WORKSHOP_SESSION);
    expect(opening.token).toBe(rows[6].token);
    result(opening.requestId, rows, 'Room unavailable');
    expect(within(menu).getByRole('alert').textContent).toBe('Room unavailable');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Retry' }));
    result(request(MessageType.LIST_UNSAVED_WORKSHOP_SESSIONS).requestId, []);
    expect(within(menu).getByText('No unsaved sessions.')).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();

    result(openMenu(), [rows[1]]);
    fireEvent.click(screen.getByRole('menuitem', { name: /Scene 1/ }));
    result(request(MessageType.OPEN_UNSAVED_WORKSHOP_SESSION).requestId, []);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('orders the three recent saved choices above all unsaved rooms and opens the selected saved session', () => {
    render(<App />);
    result(openMenu(recentRows), rows);
    const menu = screen.getByRole('menu');
    const groups = within(menu).getAllByRole('group');
    expect(groups).toEqual([
      within(menu).getByRole('group', { name: 'Recent Saved Sessions' }),
      within(menu).getByRole('group', { name: 'Unsaved Sessions' })
    ]);
    const saved = within(groups[0]).getAllByRole('menuitem');
    const unsaved = within(groups[1]).getAllByRole('menuitem');
    expect(saved.map(choice => choice.querySelector('strong')?.textContent)).toEqual(recentRows.slice(0, 3).map(row => row.title));
    expect(saved[0].querySelector('time')?.dateTime).toBe(recentRows[0].updatedAt);
    expect(unsaved).toHaveLength(rows.length);
    expect(document.activeElement).toBe(saved[0]);
    fireEvent.keyDown(saved[0], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(within(menu).getByRole('menuitem', { name: 'Manage…' }));
    fireEvent.keyDown(menu, { key: 'Home' });
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(unsaved[0]);
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(saved[2]);
    fireEvent.click(saved[2]);
    const opening = request(MessageType.OPEN_RECENT_WORKSHOP_SESSION);
    expect(opening.token).toBe(recentRows[2].token);
    expect(request(MessageType.OPEN_UNSAVED_WORKSHOP_SESSION)).toBeUndefined();
    recentResult(opening.requestId, []);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('correlates each section independently, and keeps unsaved rooms available when recents fail', () => {
    render(<App />);
    fireEvent.click(chevron());
    const old = request(MessageType.LIST_RECENT_WORKSHOP_SESSIONS);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    fireEvent.click(chevron());
    const current = request(MessageType.LIST_RECENT_WORKSHOP_SESSIONS);
    const unsaved = request(MessageType.LIST_UNSAVED_WORKSHOP_SESSIONS);
    result(unsaved.requestId, [rows[2]]);
    recentResult(old.requestId, [recentRows[0]]);
    recentResult(unsaved.requestId, [recentRows[0]]);
    const savedGroup = within(screen.getByRole('group', { name: 'Recent Saved Sessions' }));
    expect(savedGroup.getByRole('status')).toBeTruthy();
    expect(savedGroup.queryByRole('menuitem')).toBeNull();
    recentResult(current.requestId, [recentRows[1]]);
    fireEvent.click(savedGroup.getByRole('menuitem', { name: /Saved project 1/ }));
    const opening = request(MessageType.OPEN_RECENT_WORKSHOP_SESSION);
    recentResult(opening.requestId, [], 'Saved session is unavailable');
    expect(savedGroup.getByRole('alert').textContent).toBe('Saved session is unavailable');
    expect(screen.getByRole('menuitem', { name: /Scene 2/ })).toBeTruthy();
    fireEvent.click(savedGroup.getByRole('menuitem', { name: 'Retry' }));
    recentResult(request(MessageType.LIST_RECENT_WORKSHOP_SESSIONS).requestId, []);
    expect(savedGroup.getByText('No recent saved sessions.')).toBeTruthy();
    expect(request(MessageType.LIST_UNSAVED_WORKSHOP_SESSIONS)).toEqual(unsaved);
  });

  it('fits the popup and its Manage footer inside the sidebar scrollbars', () => {
    render(<App />);
    const pane = screen.getByRole('main');
    const anchor = chevron().closest('.workshop-launch-anchor') as HTMLElement;
    const bounds = (left: number, top: number, width: number, height: number) =>
      ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;
    Object.defineProperties(pane, { clientWidth: { value: 266 }, clientHeight: { value: 512 } });
    jest.spyOn(pane, 'getBoundingClientRect').mockReturnValue(bounds(8, 260, 281, 527));
    const location = jest.spyOn(anchor, 'getBoundingClientRect').mockReturnValue(bounds(86, 401, 172, 44));
    const width = jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('unsaved-sessions-menu') ? parseInt(this.style.maxWidth, 10) : 0;
    });
    try {
      result(openMenu(), rows);
      const popup = screen.getByRole('menu');
      expect(popup.style.maxWidth).toBe('258px');
      expect(popup.style.left).toBe('-74px');
      expect(popup.style.getPropertyValue('--unsaved-menu-space')).toBe((Math.min(window.innerHeight, 772) - 445 - 9) + 'px');
      expect(popup.dataset.placement).toBe('below');
      location.mockReturnValue(bounds(86, 680, 172, 44));
      fireEvent.scroll(pane);
      expect(popup.dataset.placement).toBe('above');
      expect(popup.style.getPropertyValue('--unsaved-menu-space')).toBe('411px');
    } finally {
      width.mockRestore();
    }
  });

  it('takes Manage to the unsaved-only Settings section and requires confirmation before removing one room', () => {
    render(<App />);
    result(openMenu(recentRows), rows);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Manage…' }));
    const section = screen.getByRole('region', { name: 'Unsaved Sessions' });
    expect(document.activeElement).toBe(within(section).getByRole('heading'));
    const reply = request(MessageType.LIST_UNSAVED_WORKSHOP_SESSIONS);
    result(reply.requestId, rows);
    const actions = within(section);
    expect(actions.getAllByRole('listitem')).toHaveLength(7);
    expect(actions.queryByText(recentRows[0].title)).toBeNull();
    expect((actions.getByRole('button', { name: 'Delete Scene 0' }) as HTMLButtonElement).disabled).toBe(true);
    const remove = () => actions.getByRole('button', { name: 'Delete Scene 1' });
    fireEvent.click(remove());
    expect(document.activeElement).toBe(actions.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(actions.getByRole('button', { name: 'Cancel' }));
    expect(request(MessageType.DELETE_UNSAVED_WORKSHOP_SESSION)).toBeUndefined();
    fireEvent.click(remove());
    fireEvent.click(actions.getByRole('button', { name: 'Delete session' }));
    const removing = request(MessageType.DELETE_UNSAVED_WORKSHOP_SESSION);
    expect(removing.token).toBe(rows[1].token);
    result(removing.requestId, rows.filter(row => row !== rows[1]));
    expect(actions.queryByRole('button', { name: 'Delete Scene 1' })).toBeNull();
    fireEvent.click(actions.getByRole('button', { name: 'Open Scene 2' }));
    const opening = request(MessageType.OPEN_UNSAVED_WORKSHOP_SESSION);
    expect(opening.token).toBe(rows[2].token);
    result(opening.requestId, [], 'Workspace changed');
    fireEvent.click(actions.getByRole('button', { name: 'Retry' }));
    result(request(MessageType.LIST_UNSAVED_WORKSHOP_SESSIONS).requestId, []);
    expect(actions.getByText('No unsaved sessions.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(document.activeElement).toBe(chevron());
  });
});
