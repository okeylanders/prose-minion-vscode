/** @jest-environment jsdom */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkshopTodoList } from '@components/workshop/WorkshopTodoList';
import { WorkshopTodoItem } from '@messages';

const todo = (overrides: Partial<WorkshopTodoItem> = {}): WorkshopTodoItem => ({
  id: 'todo-1',
  text: 'Fix the cup continuity.',
  status: 'open',
  source: {
    kind: 'tool_report',
    turnId: 'report-1',
    participantLabel: 'Continuity',
    toolId: 'continuity',
    findingKey: 'finding-1',
    findingText: 'Fix the cup continuity.',
    excerptVersion: 1
  },
  createdAt: 1,
  stale: false,
  ...overrides
});

describe('WorkshopTodoList', () => {
  it('renders the writer-controlled empty state', () => {
    render(<WorkshopTodoList todos={[]} onAction={jest.fn()} onShowSource={jest.fn()} />);
    expect(screen.getByText(/Nothing is added automatically/)).toBeTruthy();
  });

  it('wires completion, editing, dismissal, reorder, and source inspection', () => {
    const onAction = jest.fn();
    const onShowSource = jest.fn();
    render(
      <WorkshopTodoList
        todos={[todo(), todo({ id: 'todo-2', text: 'Second task.' })]}
        onAction={onAction}
        onShowSource={onShowSource}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Mark task complete' })[0]);
    expect(onAction).toHaveBeenCalledWith({ action: 'complete', todoId: 'todo-1' });

    fireEvent.click(screen.getAllByTitle('Edit task')[0]);
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit task text' }), {
      target: { value: 'Clarify the cup continuity.' }
    });
    fireEvent.submit(screen.getByRole('textbox', { name: 'Edit task text' }).closest('form')!);
    expect(onAction).toHaveBeenCalledWith({
      action: 'edit',
      todoId: 'todo-1',
      text: 'Clarify the cup continuity.'
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss task' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Move task down' })[0]);
    fireEvent.click(screen.getAllByText(/Continuity · excerpt v1/)[0]);
    expect(onAction).toHaveBeenCalledWith({ action: 'dismiss', todoId: 'todo-1' });
    expect(onAction).toHaveBeenCalledWith({
      action: 'reorder', todoId: 'todo-1', direction: 'down'
    });
    expect(onShowSource).toHaveBeenCalledWith('report-1');
  });

  it('labels stale and dismissed state clearly', () => {
    render(
      <WorkshopTodoList
        todos={[todo({ status: 'dismissed', stale: true })]}
        onAction={jest.fn()}
        onShowSource={jest.fn()}
      />
    );
    expect(screen.getByText(/stale/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reopen task' })).toBeTruthy();
  });

  it('keeps host provenance and declared priority visible', () => {
    render(
      <WorkshopTodoList
        todos={[todo({
          priority: 'high',
          source: {
            kind: 'host_turn',
            turnId: 'host-turn-3',
            participantLabel: 'Jill',
            personaId: 'jill',
            findingKey: 'finding-1',
            findingText: 'Replace the beacon image.',
            excerptVersion: 1
          }
        })]}
        onAction={jest.fn()}
        onShowSource={jest.fn()}
      />
    );

    expect(screen.getByText('high')).toBeTruthy();
    expect(screen.getByText(/Jill · excerpt v1/)).toBeTruthy();
  });
});
