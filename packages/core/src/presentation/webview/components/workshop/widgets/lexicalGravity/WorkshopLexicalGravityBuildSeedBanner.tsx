/**
 * The Build lens sheet's note when another tab handed the subject over (the
 * Lightbox's "Build as a lens", ADR 2026-10-19 D11): the field, its governing
 * metaphor and the terms counted in the chapter, and a plain statement of
 * what each step does: Build lens drafts takes, adding one saves it, and only
 * a chosen lens and Install on passage install anything (PR #150 F-01).
 * Build lens takes one subject, so the counted terms ride in it; the writer
 * can edit it first.
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
      Nothing is built until you press <b>Build lens</b>, nothing is saved until you add a take,
      and nothing is installed until you choose a lens and press <b>Install on passage</b>.
    </span>
  </div>
);
