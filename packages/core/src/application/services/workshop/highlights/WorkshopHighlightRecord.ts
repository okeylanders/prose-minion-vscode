import { isWorkshopHighlightsDraft } from '@/utils/workshopReplyHighlights';
import { exactObject, shapeError } from '../persistedValidation';

/** Only a persona's reply owns a redraw record. The authorization itself is always derived again on this host. */
export function assertWorkshopHighlightRecord(turn: Record<string, unknown>, path: string): void {
  const at = `${path}.highlights`;
  if (turn.role !== 'assistant' || (turn.participant !== 'host' && turn.participant !== 'guest')
    || turn.artifact !== 'persona_message' || turn.kind !== 'message') {
    shapeError(at, 'a highlight set on a persona message');
  }
  const record = exactObject(turn.highlights, at, ['source', 'set'], ['suppressRestorePrompt']);
  if (record.suppressRestorePrompt !== undefined && record.suppressRestorePrompt !== true) {
    shapeError(`${at}.suppressRestorePrompt`, 'true');
  }
  const source = exactObject(record.source, `${at}.source`, ['sourceUri', 'relativePath']);
  if (typeof source.relativePath !== 'string' || !source.relativePath.trim() || typeof source.sourceUri !== 'string') {
    shapeError(`${at}.source`, 'a file source');
  }
  try {
    // A saved Windows file URI can be read on another OS. Local path conversion belongs to authorization.
    if (new URL(source.sourceUri).protocol !== 'file:') {
      shapeError(`${at}.source.sourceUri`, 'a file URI');
    }
  } catch {
    shapeError(`${at}.source.sourceUri`, 'a file URI');
  }
  if (!isWorkshopHighlightsDraft(record.set)) {
    shapeError(`${at}.set`, 'a bounded highlight set');
  }
}
