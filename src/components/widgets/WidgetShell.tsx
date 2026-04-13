import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import * as ContextMenu from '@radix-ui/react-context-menu';

/** An item in the right-click context menu for a widget. */
export interface WidgetMenuItem {
  label: string;
  onSelect: () => void;
  /** If true, styled in red (intended for destructive actions like Remove). */
  destructive?: boolean;
}

interface WidgetShellProps {
  children: ReactNode;
  /** Click handler on the widget surface (whole body is clickable). */
  onClick?: () => void;
  /** Right-click context menu items. Right-click disabled if empty/omitted. */
  menu?: WidgetMenuItem[];
  /** Inline style overrides, merged onto the default shell. */
  style?: React.CSSProperties;
  /** Aria label for screen readers when the shell is a button. */
  ariaLabel?: string;
}

/**
 * Shared container for all home-page widgets (habit, countdown, pomodoro,
 * stopwatch, future types). Provides:
 *   - Standard box: 164px wide, 156px min-height, neutral dark bg, subtle border
 *   - Spring entry/exit animations (framer-motion layout)
 *   - Right-click context menu via Radix
 *   - Optional onClick for full-surface interactions (popup triggers, etc.)
 *
 * Widget-specific content (header, grid, controls) goes in `children`.
 */
export function WidgetShell({ children, onClick, menu, style, ariaLabel }: WidgetShellProps) {
  const isButton = Boolean(onClick);
  const hasMenu = menu && menu.length > 0;

  const sharedStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.006)',
    border: '1px solid rgba(255, 255, 255, 0.028)',
    borderRadius: 14,
    padding: '12px 10px',
    width: 164,
    minHeight: 156,
    boxSizing: 'border-box',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.018), 0 1px 2px rgba(0, 0, 0, 0.4)',
    cursor: isButton ? 'pointer' : 'default',
    display: 'flex',
    flexDirection: 'column',
    textAlign: 'left',
    ...style,
  };

  const motionProps = {
    layout: true,
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
    transition: { type: 'spring' as const, stiffness: 400, damping: 30 },
  };

  // The inner element is either a <motion.button> (clickable) or a <motion.div>.
  // Radix ContextMenu.Trigger wraps whichever one, via asChild.
  const inner = isButton ? (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      style={sharedStyle}
      {...motionProps}
    >
      {children}
    </motion.button>
  ) : (
    <motion.div style={sharedStyle} {...motionProps}>
      {children}
    </motion.div>
  );

  if (!hasMenu) return inner;

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{inner}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          style={{
            background: '#0a0a0a',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 8,
            padding: 4,
            minWidth: 140,
            zIndex: 50,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
          }}
        >
          {menu!.map((item, i) => (
            <ContextMenu.Item
              key={i}
              onSelect={item.onSelect}
              style={{
                padding: '6px 10px',
                color: item.destructive ? '#ef4444' : 'rgba(255, 255, 255, 0.7)',
                fontSize: '0.78rem',
                cursor: 'pointer',
                borderRadius: 4,
                outline: 'none',
              }}
            >
              {item.label}
            </ContextMenu.Item>
          ))}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
