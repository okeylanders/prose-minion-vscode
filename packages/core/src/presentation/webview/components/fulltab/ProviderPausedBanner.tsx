/**
 * ProviderPausedBanner — the full-tab notice shown while no OpenRouter API
 * key is saved (ADR 2026-10-19 D2).
 *
 * The headline and the call to action are the same in every tab; what keeps
 * working without a key differs, so each tab passes that sentence in. The
 * caller decides visibility (`useFullTabChrome().providerPaused`).
 */
import * as React from 'react';
import { Icon } from '@components/shared/Icon';

export interface ProviderPausedBannerProps {
  /** What still works while replies are paused, in this tab's own words. */
  availabilityNote: string;
  /** Opens the settings overlay at the API key. */
  onAddApiKey: () => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const ProviderPausedBanner: React.FC<ProviderPausedBannerProps> = ({
  availabilityNote,
  onAddApiKey
}) => (
  <div className="pm-ws-provider-paused" role="status">
    <Icon name="alert" size={14} />
    <span>
      <strong>AI replies are paused.</strong>{' '}
      Add an OpenRouter API key to continue. {availabilityNote}
    </span>
    <button type="button" onClick={onAddApiKey}>
      <Icon name="gear" size={13} /> Add API key
    </button>
  </div>
);
