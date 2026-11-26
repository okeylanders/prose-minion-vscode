/** @jest-environment jsdom */

import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '@/presentation/webview/App';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { MessageType, type UnsavedWorkshopSessionRow } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

const rows: UnsavedWorkshopSessionRow[] = Array.from({ length: 7 }, (_, index) => ({
  token: 'token-' + index,
  title: 'Scene ' + index,
  preview: 'Excerpt ' + index,
  updatedAt: index === 6 ? 'unknown timestamp' : '2026-11-12T09:10:00Z',
  canDelete: index !== 0
}));

describe('Unsaved Sessions in the sidebar', () => {
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
  const chevron = () => screen.getByRole('button', { name: 'Unsaved Sessions' });
  const openMenu = () => {
    fireEvent.click(chevron());
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
    const menu = screen.getByRole('menu', { name: 'Unsaved Sessions' });
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

  it('takes Manage to the Settings section and requires confirmation before removing one room', () => {
    render(<App />);
    result(openMenu(), rows);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Manage…' }));
    const section = screen.getByRole('region', { name: 'Unsaved Sessions' });
    expect(document.activeElement).toBe(within(section).getByRole('heading'));
    const reply = request(MessageType.LIST_UNSAVED_WORKSHOP_SESSIONS);
    result(reply.requestId, rows);
    const actions = within(section);
    expect(actions.getAllByRole('listitem')).toHaveLength(7);
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
