/**
 * LightboxWorkshopTray — the header's "n tiles bound for Workshop · Open
 * Workshop →" (ADR 2026-10-19 D11; Slice 4). Props-only.
 *
 * The count is what the Workshop holds above its composer in its current
 * room, as its host reports it: tiles it staged, from this board or an
 * earlier one, never a request still on its way. It falls when the writer
 * sends a tile with a message or removes it there, and when the Workshop's
 * room is replaced; closing the Workshop tab keeps it, since the tiles are
 * session state. With nothing bound it is not shown.
 */
import * as React from 'react';
import type { LightboxWorkshopTrayTile } from '@messages';
import { Icon } from '@components/shared/Icon';

export interface LightboxWorkshopTrayProps {
  tiles: readonly LightboxWorkshopTrayTile[];
  onOpenWorkshop: () => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxWorkshopTray: React.FC<LightboxWorkshopTrayProps> = ({ tiles, onOpenWorkshop }) => {
  if (tiles.length === 0) {
    return null;
  }
  const count = `${tiles.length} ${tiles.length === 1 ? 'tile' : 'tiles'} bound for Workshop`;
  return (
    <div className="pm-lb-tray" role="status" title={tiles.map((tile) => tile.label).join('\n')}>
      <Icon name="pin" size={12} />
      <span className="pm-lb-tray-count">{count}</span>
      <span aria-hidden="true">·</span>
      <button type="button" className="pm-lb-link" onClick={onOpenWorkshop}>Open Workshop →</button>
    </div>
  );
};
