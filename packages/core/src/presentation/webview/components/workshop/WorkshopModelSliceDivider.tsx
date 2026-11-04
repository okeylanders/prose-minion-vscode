/**
 * A model slice in the thread (ADR 2026-11-03 D8): "Model · Claude Sonnet 5 →
 * GPT-5" where the room's model changed. It takes the session divider's
 * treatment. The separator is named with its visible text, because a
 * separator's children are presentational and would otherwise go unheard; its
 * title names the raw ids behind the display names.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import {
  workshopModelSliceText,
  type WorkshopModelSlice
} from '@shared/workshop/workshopModelSlices';

interface WorkshopModelSliceDividerProps {
  slice: WorkshopModelSlice;
  /** A model's display name, with the raw id as the fallback. */
  modelLabel: (modelId: string) => string;
}

export const WorkshopModelSliceDivider: React.FC<WorkshopModelSliceDividerProps> = ({ slice, modelLabel }) => {
  const text = workshopModelSliceText(slice.scope, modelLabel(slice.fromModelId), modelLabel(slice.toModelId));
  return (
    <div
      className="pm-ws-revision-divider pm-ws-session-divider pm-ws-model-slice"
      role="separator"
      aria-label={text}
      title={`${slice.fromModelId} → ${slice.toModelId}`}
    >
      <span>
        <Icon name="chip" size={12} />
        {text}
      </span>
    </div>
  );
};
