import * as Dialog from '@radix-ui/react-dialog';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from './navConfig';
import { CloseIcon, MenuIcon } from './navIcons';
import { cn } from '@/lib/cn';

/**
 * Hamburger + slide-out drawer for screens below the md breakpoint.
 * Built on Radix Dialog so focus trap, esc-to-close, and aria are handled
 * for free. The drawer auto-closes on route change via the route subscriber
 * inside <DrawerLink>.
 */
export function MobileDrawer() {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          aria-label="Åpne meny"
          className={cn(
            'md:hidden',
            'flex h-9 w-9 items-center justify-center rounded-lg',
            'border border-[var(--color-border)] bg-[var(--color-surface-2)]',
            'text-[var(--color-text-dim)] transition-colors',
            'hover:text-[var(--color-text)] active:scale-95'
          )}
        >
          <MenuIcon />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-40 bg-black/70 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0'
          )}
        />
        <Dialog.Content
          className={cn(
            'fixed right-0 top-0 z-50 h-screen w-[80vw] max-w-[300px]',
            'border-l border-[var(--color-border)]',
            'bg-[rgba(10,10,12,0.96)] backdrop-blur-2xl',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
            'duration-200 ease-out'
          )}
        >
          <Dialog.Title className="sr-only">Navigasjon</Dialog.Title>
          <Dialog.Description className="sr-only">
            Velg en side fra menyen
          </Dialog.Description>

          <div className="flex h-[64px] items-center justify-between px-5">
            <span className="section-label">Meny</span>
            <Dialog.Close asChild>
              <button
                aria-label="Lukk meny"
                className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-text-dim)] hover:bg-white/5 hover:text-[var(--color-text)]"
              >
                <CloseIcon />
              </button>
            </Dialog.Close>
          </div>

          <div className="mx-5 h-px bg-[var(--color-border)]" />

          <nav className="px-3 pt-4">
            <ul className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <DrawerLink
                    to={item.to}
                    icon={item.icon}
                    label={item.label}
                    accent={item.accent}
                  />
                </li>
              ))}
            </ul>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface DrawerLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  accent: string;
}

function DrawerLink({ to, icon, label, accent }: DrawerLinkProps) {
  // Auto-close the drawer when the user picks a link. Radix wires the close
  // through Dialog.Close, so we wrap the link in one.
  return (
    <Dialog.Close asChild>
      <NavLink
        to={to}
        end={to === '/'}
        style={{ ['--accent' as string]: accent }}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5',
            'text-[14px] font-medium transition-colors',
            isActive
              ? 'bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--color-text)]'
              : 'text-[var(--color-text-dim)] hover:bg-white/5 hover:text-[var(--color-text)]'
          )
        }
      >
        <span className="grid h-8 w-8 place-items-center rounded-md bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]">
          {icon}
        </span>
        <span>{label}</span>
      </NavLink>
    </Dialog.Close>
  );
}
