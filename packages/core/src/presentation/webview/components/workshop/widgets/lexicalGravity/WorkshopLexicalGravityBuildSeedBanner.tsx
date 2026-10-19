/**
 * The Build lens sheet's note when another tab handed the subject over (the
 * Lightbox's "Build as a lens", ADR 2026-10-19 D11): the field, its governing
 * metaphor and the terms counted in the chapter, and a plain statement that
 * nothing is built until the writer presses Build. Build lens takes one
 * subject, so the counted terms ride in it; the writer can edit it first.
 */
import * as React from 'react';
import type { WorkshopLexicalGravityBuildSeed } from '@messages';
import { Icon } from '@components/shared/Icon';

export interface WorkshopLexicalGravityBuildSeedBannerProps {
  seed: WorkshopLexicalGravityBuildSeed;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const WorkshopLexicalGravityBuildSeedBanner: React.FC<WorkshopLexicalGravityBuildSeedBannerProps> = ({ seed }) => (
  <div className="pm-ws-gesture-banner pm-ws-gesture-banner-seed pm-ws-lg-build-seed" role="note">
    <Icon name="orbit" size={13} />
    <span>
      <b>From the Lightbox: the borrowed field “{seed.field}”</b>
      {seed.sourceLabel && <> in <code>{seed.sourceLabel}</code></>}.
      {seed.metaphor && <> Its governing metaphor: <i>{seed.metaphor}</i></>}
      {seed.terms.length > 0 && (
        <> Counted there: {seed.terms.map((term) => `${term.term} ×${term.count}`).join(', ')}.</>
      )}
      {' '}The subject below carries the field and as many of its terms as fit; edit it if you like.
      Nothing is built, saved or installed until you press <b>Build lens</b>.
    </span>
  </div>
);
