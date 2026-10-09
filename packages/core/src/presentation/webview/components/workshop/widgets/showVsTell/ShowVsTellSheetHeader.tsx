/**
 * The sheet header: eyebrow, title, the neutral framing line, and the opening
 * banner (persona prefill or clone). Split from the modal so the modal stays
 * under the repository size guard; it renders what it is given.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { WorkshopModalShell } from '@components/workshop/WorkshopModalShell';
import type { ShowVsTellBanner } from './showVsTellAuthoringTypes';

export interface ShowVsTellSheetHeaderProps {
  banner: ShowVsTellBanner;
  /** The close affordance is disabled while a commit is pending. */
  commitPending: boolean;
}

export const ShowVsTellSheetHeader: React.FC<ShowVsTellSheetHeaderProps> = ({
  banner,
  commitPending
}) => (
    <header className="pm-ws-svt-head">
      <div className="pm-ws-eyebrow pm-ws-svt-eyebrow">
        Widget{' '}
        <span className="pm-ws-sb-railtag pm-ws-sb-railtag-oneshot">
          one-shot · thread-artifact
        </span>
      </div>
      <h2 id="pm-ws-svt-title">
        <Icon name="eye" size={17} /> Show vs. Tell Playground
      </h2>
      <p className="pm-ws-svt-sub">
        Move one beat along the continuum from <b>compressed explanation</b> to{' '}
        <b>embodied dramatization</b>, see what each version gains and costs, and hand the
        useful directions back to the room. <b>Both ends are tools</b> — nothing here calls
        telling bad writing.
      </p>
      {banner.kind === 'seed' && (
        <div className="pm-ws-svt-banner pm-ws-svt-banner-seed">
          <Icon name="sparkle" size={13} />
          <span>
            <b>Recommended and prefilled by {banner.personaLabel}.</b> {banner.personaLabel}{' '}
            spotted a told beat worth testing — proposing and prefilling is as far as a
            persona goes; you decide what commits.
          </span>
        </div>
      )}
      {banner.kind === 'clone' && (
        <div className="pm-ws-svt-banner pm-ws-svt-banner-clone">
          <Icon name="refresh" size={13} />
          {banner.from === 'rewound-message' ? (
            <span>
              <b>Reopened from a message you rewound.</b> Adjust it, then commit to send
              it again as a <b>new</b> turn at the head.
            </span>
          ) : (
            <span>
              <b>Re-opened from a committed turn.</b> The old chip stays as history —
              committing again creates a <b>new</b> turn at the head.
            </span>
          )}
        </div>
      )}
      <WorkshopModalShell.CloseButton disabled={commitPending} />
    </header>
);
