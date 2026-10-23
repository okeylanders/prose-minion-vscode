/**
 * SavedItemsMenu — the full tabs' saved-item menu (Lightbox Slice 5A.2,
 * extracted from the Workshop's sessions menu so the Workshop and the
 * Lightbox speak one design language).
 *
 * The chrome and behaviour are shared; the items are composed by each tab:
 * a trigger naming what is on screen, a save status beside it, and a menu
 * that opens below. Opening focuses its first item; Escape or a click
 * outside closes it; closing returns focus to the trigger; choosing an item
 * closes the menu first, then acts. The markup and classes are the
 * Workshop's own (`pm-ws-sessions-*`, styles in `styles/fulltab/savedItems.css`),
 * so the Workshop's sessions menu renders exactly as it did.
 */

import * as React from 'react';
import { Icon, type IconName } from '@components/shared/Icon';

/** Whether the item on screen is saved; the dot and the words beside the trigger. */
export interface SavedItemsMenuStatus {
  /** `session`: nothing is saved yet, or saving is off (a muted dot). */
  state: 'saving' | 'saved' | 'error' | 'session';
  text: string;
}

export interface SavedItemsMenuProps {
  open: boolean;
  /** What the trigger names: the item on screen, or the menu's own name. */
  label: string;
  status?: SavedItemsMenuStatus;
  /** The menu element's id, which the trigger controls. */
  menuId: string;
  /** The menu's accessible name. */
  menuLabel: string;
  triggerTitle: string;
  triggerIcon?: IconName;
  /** Focus the first item that is not disabled on open (the Lightbox's); the first item by default, as the Workshop's menu always has. */
  focusFirstEnabled?: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- a React context is PascalCase, as its Provider is used.
const MenuContext = React.createContext<{ invoke: (action: () => void) => void } | null>(null);

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const SavedItemsMenuRoot: React.FC<SavedItemsMenuProps> = ({
  open,
  label,
  status,
  menuId,
  menuLabel,
  triggerTitle,
  triggerIcon = 'cards',
  focusFirstEnabled = false,
  onOpenChange,
  children
}) => {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }
    const first = focusFirstEnabled ? '[role="menuitem"]:not(:disabled)' : '[role="menuitem"]';
    const focusTimer = window.setTimeout(() => menuRef.current?.querySelector<HTMLElement>(first)?.focus(), 0);
    const closeOutside = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        rootRef.current &&
        !rootRef.current.contains(event.target)
      ) {
        onOpenChange(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    };
    document.addEventListener('mousedown', closeOutside);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('mousedown', closeOutside);
      window.removeEventListener('keydown', closeOnEscape);
      triggerRef.current?.focus();
    };
  }, [focusFirstEnabled, onOpenChange, open]);

  const invoke = React.useCallback((action: () => void) => {
    onOpenChange(false);
    action();
  }, [onOpenChange]);
  const context = React.useMemo(() => ({ invoke }), [invoke]);

  return (
    <div className="pm-ws-sessions-menu-wrap" ref={rootRef}>
      <button
        ref={triggerRef}
        className="pm-ws-reset pm-ws-sessions-trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => onOpenChange(!open)}
        title={triggerTitle}
      >
        <Icon name={triggerIcon} size={14} />
        <span className="pm-ws-sessions-trigger-label">
          {label}
        </span>
        <Icon name="chevDown" size={13} />
      </button>
      {status && (
        <span
          className={`pm-ws-named-save-state pm-ws-named-save-state-${status.state}`}
          role="status"
          aria-live="polite"
        >
          <span />
          {status.text}
        </span>
      )}
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          className="pm-ws-sessions-menu"
          role="menu"
          aria-label={menuLabel}
        >
          <MenuContext.Provider value={context}>{children}</MenuContext.Provider>
        </div>
      )}
    </div>
  );
};

function useInvoke(): (action: () => void) => void {
  const context = React.useContext(MenuContext);
  return context?.invoke ?? ((action) => action());
}

export interface SavedItemsMenuItemProps {
  icon: IconName;
  disabled?: boolean;
  /** The danger tone, for an item that discards something. */
  danger?: boolean;
  title?: string;
  kbd?: string;
  onSelect: () => void;
  children: React.ReactNode;
}

/** A command: the menu closes, then it acts. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const SavedItemsMenuItem: React.FC<SavedItemsMenuItemProps> = ({ icon, disabled, danger, title, kbd, onSelect, children }) => {
  const invoke = useInvoke();
  return (
    <button
      className={`pm-ws-sessions-menu-item${danger ? ' pm-ws-sessions-menu-item-danger' : ''}`}
      type="button"
      role="menuitem"
      disabled={disabled}
      title={title}
      onClick={() => invoke(onSelect)}
    >
      <Icon name={icon} size={15} />
      <span>{children}</span>
      {kbd && <kbd>{kbd}</kbd>}
    </button>
  );
};

export interface SavedItemsMenuRecentProps {
  title: string;
  meta: React.ReactNode;
  disabled?: boolean;
  onSelect: () => void;
}

/** A recent item: its title, and a line about it; choosing it opens it. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const SavedItemsMenuRecent: React.FC<SavedItemsMenuRecentProps> = ({ title, meta, disabled, onSelect }) => {
  const invoke = useInvoke();
  return (
    <button
      className="pm-ws-sessions-menu-recent"
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => invoke(onSelect)}
    >
      <strong>{title}</strong>
      <span>{meta}</span>
    </button>
  );
};

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const SavedItemsMenuHeading: React.FC<{ recent?: boolean; children: React.ReactNode }> = ({ recent, children }) => (
  <div className={`pm-ws-sessions-menu-heading${recent ? ' pm-ws-sessions-menu-recent-heading' : ''}`}>{children}</div>
);

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const SavedItemsMenuRule: React.FC = () => <div className="pm-ws-sessions-menu-rule" />;

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const SavedItemsMenuEmpty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="pm-ws-sessions-menu-empty">{children}</div>
);

/** The menu and its parts: `Item`, `Recent`, `Heading`, `Rule`, `Empty`. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const SavedItemsMenu = Object.assign(SavedItemsMenuRoot, {
  // eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
  Item: SavedItemsMenuItem,
  // eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
  Recent: SavedItemsMenuRecent,
  // eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
  Heading: SavedItemsMenuHeading,
  // eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
  Rule: SavedItemsMenuRule,
  // eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
  Empty: SavedItemsMenuEmpty
});
