/**
 * A model's display name from the options the webview holds (`MODEL_DATA`),
 * with the raw id as the fallback. The one lookup every surface that names a
 * model by id uses: the context budget, and the Workshop's model slices and
 * served-by notes (ADR 2026-11-03 D8).
 */

import type { ModelOption } from '@messages';

export function modelOptionLabel(options: readonly ModelOption[], modelId: string): string {
  return options.find((option) => option.id === modelId)?.label ?? modelId;
}
