import * as React from 'react';
import type { useWorkshopPastedText } from '@hooks/domain/workshop/useWorkshopPastedText';
import { WorkshopTextSheet } from './WorkshopTextSheet';

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components use PascalCase.
export function WorkshopPastedTextSheet({ pasted, locked }: { pasted: ReturnType<typeof useWorkshopPastedText>; locked: boolean }) {
  const sheet = pasted.sheet;
  return sheet ? (
    <WorkshopTextSheet key={sheet.key} open mode={{ kind: 'pasted-text' }}
      value={sheet.text} error={sheet.error} loading={sheet.text === undefined && !sheet.error}
      saving={sheet.text !== undefined && pasted.composer.isBusy(sheet.attachmentId)}
      applyDisabled={locked || sheet.text === undefined || pasted.composer.isBusy(sheet.attachmentId)}
      onApply={pasted.save} onClose={pasted.closeSheet} />
  ) : null;
}
