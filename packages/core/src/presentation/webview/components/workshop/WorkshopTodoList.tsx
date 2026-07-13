import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { WorkshopTodoAction, WorkshopTodoItem } from '@messages';

interface WorkshopTodoListProps {
  todos: readonly WorkshopTodoItem[];
  onAction: (action: WorkshopTodoAction) => void;
  onShowSource: (reportTurnId: string) => void;
}

export const WorkshopTodoList: React.FC<WorkshopTodoListProps> = ({
  todos,
  onAction,
  onShowSource
}) => {
  const [editingId, setEditingId] = React.useState<string>();
  const [draft, setDraft] = React.useState('');
  const openCount = todos.filter((todo) => todo.status === 'open' && !todo.stale).length;
  const completedCount = todos.filter((todo) => todo.status === 'completed').length;

  const beginEdit = (todo: WorkshopTodoItem) => {
    setEditingId(todo.id);
    setDraft(todo.text);
  };

  const saveEdit = (todoId: string) => {
    const text = draft.trim();
    if (text) {
      onAction({ action: 'edit', todoId, text });
    }
    setEditingId(undefined);
    setDraft('');
  };

  return (
    <section className="pm-ws-block pm-ws-todos" aria-labelledby="pm-ws-todos-title">
      <div className="pm-ws-todos-head">
        <div className="pm-ws-eyebrow" id="pm-ws-todos-title">To-do List</div>
        <span>{openCount} open · {completedCount} done</span>
      </div>
      {todos.length === 0 ? (
        <p className="pm-ws-todos-empty">
          Add a concrete next step from a tool report. Nothing is added automatically.
        </p>
      ) : (
        <ol className="pm-ws-todo-items">
          {todos.map((todo, index) => (
            <li
              className={`pm-ws-todo pm-ws-todo-${todo.status}${todo.stale ? ' pm-ws-todo-stale' : ''}`}
              key={todo.id}
            >
              <div className="pm-ws-todo-main">
                <button
                  className="pm-ws-todo-toggle"
                  type="button"
                  title={todo.status === 'open' ? 'Mark complete' : 'Reopen task'}
                  aria-label={todo.status === 'open' ? 'Mark task complete' : 'Reopen task'}
                  onClick={() => onAction({
                    action: todo.status === 'open' ? 'complete' : 'reopen',
                    todoId: todo.id
                  })}
                >
                  {todo.status === 'completed' && <Icon name="check" size={12} />}
                </button>
                <div className="pm-ws-todo-copy">
                  {editingId === todo.id ? (
                    <form onSubmit={(event) => { event.preventDefault(); saveEdit(todo.id); }}>
                      <input
                        value={draft}
                        maxLength={500}
                        autoFocus
                        aria-label="Edit task text"
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') setEditingId(undefined);
                        }}
                      />
                    </form>
                  ) : (
                    <span className="pm-ws-todo-text">{todo.text}</span>
                  )}
                  <button
                    className="pm-ws-todo-source"
                    type="button"
                    onClick={() => onShowSource(todo.source.reportTurnId)}
                    title={`Show source report ${todo.source.reportTurnId}`}
                  >
                    {todo.source.toolLabel} · excerpt v{todo.source.excerptVersion}
                    {todo.stale ? ' · stale' : ''}
                    {todo.writerEdit ? ' · edited' : ''}
                  </button>
                </div>
              </div>
              <div className="pm-ws-todo-actions">
                {editingId === todo.id ? (
                  <button type="button" onClick={() => saveEdit(todo.id)} title="Save task">
                    <Icon name="check" size={12} />
                  </button>
                ) : (
                  <button type="button" onClick={() => beginEdit(todo)} title="Edit task">
                    <Icon name="pen" size={12} />
                  </button>
                )}
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => onAction({ action: 'reorder', todoId: todo.id, direction: 'up' })}
                  title="Move task up"
                  aria-label="Move task up"
                >
                  <Icon name="chevDown" className="pm-ws-icon-up" size={12} />
                </button>
                <button
                  type="button"
                  disabled={index === todos.length - 1}
                  onClick={() => onAction({ action: 'reorder', todoId: todo.id, direction: 'down' })}
                  title="Move task down"
                  aria-label="Move task down"
                >
                  <Icon name="chevDown" size={12} />
                </button>
                {todo.status !== 'dismissed' && (
                  <button
                    type="button"
                    onClick={() => onAction({ action: 'dismiss', todoId: todo.id })}
                    title="Dismiss task"
                    aria-label="Dismiss task"
                  >
                    <Icon name="x" size={12} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
