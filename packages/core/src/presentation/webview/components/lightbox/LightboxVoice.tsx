/**
 * LightboxVoice — how the chapter is told (ADR 2026-10-19 D3, D7). Drawn in
 * the counted-read register: the reading names the point of view, tense,
 * distance, register and sentence music, and the host sets its measured
 * words per sentence beside the music. One button pins the whole reading.
 */
import * as React from 'react';
import type { LightboxTileProps } from '@components/lightbox/LightboxTiles';
import { lightboxLensView, lightboxTilesOfKind } from '@hooks/domain/lightbox/lightboxReadings';
import { LightboxItemButton } from '@components/lightbox/LightboxItemButton';
import { LightboxReadingFrame } from '@components/lightbox/LightboxReadingFrame';

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxVoice: React.FC<LightboxTileProps> = ({ board, bind }) => {
  const [voice] = lightboxTilesOfKind(board, 'voice');
  return (
    <LightboxReadingFrame kind="voice" span={3} title="Voice" view={lightboxLensView(board, 'voice')} empty="The voice was not read.">
      {voice && (
        <LightboxItemButton binding={bind({ kind: 'reading', tileId: voice.id })} className="pm-lb-voice">
          {voice.traits.map((trait) => (
            <span key={trait.label} className="pm-lb-voice-row">
              <span className="pm-lb-voice-label">{trait.label}</span>
              <span className="pm-lb-voice-value">
                {trait.measured && <span className="pm-lb-voice-measured">{trait.measured}</span>}
                {trait.value}
              </span>
            </span>
          ))}
        </LightboxItemButton>
      )}
    </LightboxReadingFrame>
  );
};
