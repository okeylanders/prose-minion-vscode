import * as React from 'react';
import { Icon } from '../shared/Icon';
import { UnsavedWorkshopSessionDetails } from '../shared/UnsavedWorkshopSessionDetails';
import type { UnsavedWorkshopSessions } from '../../hooks/domain/useUnsavedWorkshopSessions';

type Props = {
  sessions: UnsavedWorkshopSessions;
  launch: (newTab?: boolean) => void;
  manage: () => void;
};

export const WorkshopLauncher = ({ sessions, launch, manage }: Props) => {
  const [expanded, setExpanded] = React.useState(false);
  const [opening, setOpening] = React.useState(false);
  const anchor = React.useRef<HTMLDivElement>(null);
  const chevron = React.useRef<HTMLButtonElement>(null);
  const menu = React.useRef<HTMLDivElement>(null);
  const menuId = React.useId();
  React.useEffect(() => {
    if (expanded && !opening && !sessions.busy && document.activeElement === menu.current) {
      menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
    }
  }, [expanded, opening, sessions.busy]);
  const show = () => {
    setOpening(false);
    sessions.refresh();
    setExpanded(true);
  };
  const close = () => {
    setExpanded(false);
    chevron.current?.focus();
  };

  React.useLayoutEffect(() => {
    if (!expanded || !menu.current) { return; }
    const scrollport = anchor.current?.closest<HTMLElement>('.app-main');
    const position = () => {
      const pane = scrollport?.getBoundingClientRect();
      const left = pane && scrollport ? Math.max(0, pane.left + scrollport.clientLeft) : 0;
      const top = pane && scrollport ? Math.max(0, pane.top + scrollport.clientTop) : 0;
      const right = scrollport ? Math.min(window.innerWidth, left + scrollport.clientWidth) : window.innerWidth;
      const bottom = scrollport ? Math.min(window.innerHeight, top + scrollport.clientHeight) : window.innerHeight;
      const group = anchor.current?.getBoundingClientRect();
      const popup = menu.current;
      if (group && popup) {
        // The sidebar scrolls inside .app-main. Its scrollbars sit inside the webview viewport.
        popup.style.maxWidth = Math.max(0, right - left - 8) + 'px';
        const popupRight = Math.max(left + 4 + popup.offsetWidth, Math.min(right - 4, group.right));
        popup.style.left = (popupRight - popup.offsetWidth - group.left) + 'px';
        const below = bottom - group.bottom - 9;
        const above = group.top - top - 9;
        const opensAbove = below < 180 && above > below;
        popup.dataset.placement = opensAbove ? 'above' : 'below';
        popup.style.setProperty('--unsaved-menu-space', Math.max(0, opensAbove ? above : below) + 'px');
      }
    };
    position();
    menu.current.focus();
    const outside = (event: PointerEvent) => {
      if (!anchor.current?.contains(event.target as Node)) { setExpanded(false); }
    };
    const onScroll = (event: Event) => {
      if (!menu.current?.contains(event.target as Node)) { position(); }
    };
    const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(position);
    if (scrollport) { resize?.observe(scrollport); }
    document.addEventListener('scroll', onScroll, true);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', position);
    return () => {
      resize?.disconnect();
      document.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', position);
    };
  }, [expanded]);

  React.useEffect(() => {
    if (opening && !sessions.busy) {
      if (!sessions.error) { setExpanded(false); }
      setOpening(false);
    }
  }, [opening, sessions.busy, sessions.error]);

  const navigate = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { return; }
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'));
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    let next: number;
    switch (event.key) {
      case 'Home': next = 0; break;
      case 'End': next = items.length - 1; break;
      case 'ArrowUp': next = index <= 0 ? items.length - 1 : index - 1; break;
      default: next = (index + 1) % items.length;
    }
    event.preventDefault();
    items[next]?.focus();
  };

  return (
    <div ref={anchor} className="workshop-launch-anchor" onBlur={event => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) { setExpanded(false); }
    }}>
      <div className="workshop-launch-split" role="group" aria-label="Workshop tabs">
        <button type="button" className="btn btn-secondary surface-launch-button" onClick={() => launch()} title="Open the Workshop editor tab">
          <Icon name="panelRight" size={14} /> Workshop
        </button>
        <button type="button" className="btn btn-secondary surface-launch-button" onClick={() => launch(true)}
          aria-label="New Workshop tab" title="New Workshop tab"><Icon name="plus" size={14} /></button>
        <button ref={chevron} id="workshop-unsaved-sessions-toggle" type="button" className="btn btn-secondary surface-launch-button" aria-label="Unsaved Sessions"
          title="Unsaved Sessions" aria-haspopup="menu" aria-expanded={expanded} aria-controls={expanded ? menuId : undefined}
          onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); show(); } }}
          onClick={() => expanded ? close() : show()}><Icon name="chevDown" size={14} /></button>
      </div>
      {expanded && (
        <div ref={menu} id={menuId} className="unsaved-sessions-menu" role="menu" aria-label="Unsaved Sessions" tabIndex={-1} onKeyDown={navigate}>
          <div className="unsaved-sessions-caption">Unsaved Sessions</div>
          <div className="unsaved-sessions-menu-list" role="group" aria-label="Closed sessions">
            {sessions.error && <>
              <p role="alert" className="unsaved-sessions-message">{sessions.error}</p>
              <button type="button" role="menuitem" tabIndex={-1} className="unsaved-session-choice" onClick={() => { menu.current?.focus(); sessions.refresh(); }}>Retry</button>
            </>}
            {sessions.busy && <p role="status" className="unsaved-sessions-message">{opening ? 'Opening session…' : 'Loading sessions…'}</p>}
            {!sessions.busy && !sessions.error && !sessions.rows.length && <p className="unsaved-sessions-message">No unsaved sessions.</p>}
            {!sessions.busy && sessions.rows.map(row => (
              <button type="button" role="menuitem" tabIndex={-1} key={row.token} className="unsaved-session-choice" onClick={() => {
                menu.current?.focus();
                setOpening(true);
                sessions.open(row.token);
              }}>
                <UnsavedWorkshopSessionDetails row={row} />
              </button>
            ))}
          </div>
          <button type="button" role="menuitem" tabIndex={-1} className="unsaved-sessions-manage" onClick={() => { setExpanded(false); manage(); }}>
            <Icon name="gear" size={14} /> Manage…
          </button>
        </div>
      )}
    </div>
  );
};
