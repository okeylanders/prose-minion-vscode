/**
 * The receipt card's controls (ADR 2026-11-19 D8): the domain hook's Undo
 * and its answers, with the room's lock, in the shape the bubble takes. The
 * app composes it in one line, as it composes the file-edit cards'.
 */

import * as React from 'react';
import { useWorkshopTodoReceipt, type UseWorkshopTodoReceiptOptions } from '@hooks/domain/workshop/useWorkshopTodoReceipt';
import type { WorkshopTodoReceiptControls } from './WorkshopTodoReceipt';

export function useWorkshopTodoReceiptControls(options: UseWorkshopTodoReceiptOptions & { locked: boolean }): WorkshopTodoReceiptControls {
  const { undoing, feedback, undo } = useWorkshopTodoReceipt({
    roomKey: options.roomKey,
    ...(options.roomRevision !== undefined ? { roomRevision: options.roomRevision } : {})
  });
  return React.useMemo(() => ({ undoing, feedback, locked: options.locked, onUndo: undo }), [undoing, feedback, options.locked, undo]);
}
