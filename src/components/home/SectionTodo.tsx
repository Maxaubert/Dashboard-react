import { useTodos } from '@/hooks/useTodos';
import { usePageOverlay } from '@/context/PageOverlayContext';
import { topOpenTodos } from '@/lib/todoPreview';
import { GripHandle, type HandleProps } from '@/components/home/GripHandle';

export function TodoSection({ handleProps }: { handleProps?: HandleProps }) {
  const { data: todos } = useTodos();
  const { openOverlay } = usePageOverlay();
  const top = topOpenTodos(todos ?? []);

  return (
    <section>
      <div className="section-header">
        <span>
          <GripHandle handleProps={handleProps} />
          Todo
        </span>
        <button type="button" className="section-header-link" onClick={() => openOverlay('todo')}>
          Vis alle
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z" />
          </svg>
        </button>
      </div>
      {top.length === 0 ? (
        <div className="todo-preview-empty">Ingen åpne oppgaver</div>
      ) : (
        <ul className="todo-preview-list">
          {top.map((todo) => (
            <li key={todo.id} className="todo-preview-item" onClick={() => openOverlay('todo')}>
              <span className={`todo-preview-dot prio-${todo.priority}`} />
              <span className="todo-preview-text">{todo.text}</span>
              {todo.deadline && <span className="todo-preview-deadline">{todo.deadline}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
