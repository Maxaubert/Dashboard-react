import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

interface AddWidgetMenuProps {
  onAddHabit: () => void;
}

export function AddWidgetMenu({ onAddHabit }: AddWidgetMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="section-header-link"
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          + Add widget
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          style={{
            background: '#0a0a0a',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 10,
            padding: 4,
            minWidth: 180,
            zIndex: 50,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div
            style={{
              color: 'rgba(255, 255, 255, 0.3)',
              fontSize: '0.6rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.10em',
              padding: '6px 10px 4px',
            }}
          >
            Add widget
          </div>
          <DropdownMenu.Item
            onSelect={onAddHabit}
            style={{
              padding: '8px 10px',
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '0.82rem',
              cursor: 'pointer',
              borderRadius: 6,
              outline: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 14 }}>🔥</span>
            Habit Tracker
          </DropdownMenu.Item>
          <div
            style={{
              padding: '8px 10px',
              color: 'rgba(255, 255, 255, 0.2)',
              fontSize: '0.75rem',
              fontStyle: 'italic',
            }}
          >
            More coming soon...
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
