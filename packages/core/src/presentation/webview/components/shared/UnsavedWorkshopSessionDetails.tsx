import * as React from 'react';
import type { UnsavedWorkshopSessionRow } from '@messages';

const dateFormat = new Intl.DateTimeFormat(undefined, {
  year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
});

export const UnsavedWorkshopSessionDetails = ({ row }: { row: UnsavedWorkshopSessionRow }) => {
  const timestamp = Date.parse(row.updatedAt);
  return (
    <span className="unsaved-session-details">
      <strong title={row.title}>{row.title}</strong>
      {row.preview && row.preview !== row.title && <span className="unsaved-session-preview" title={row.preview}>{row.preview}</span>}
      {Number.isFinite(timestamp) && <time dateTime={row.updatedAt}>{dateFormat.format(timestamp)}</time>}
    </span>
  );
};
