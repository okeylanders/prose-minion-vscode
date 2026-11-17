import * as React from 'react';
import type { SupportCopyStatus } from '@hooks/domain/useSettings';

export const SUPPORT_EMAIL = 'support@frameminion.video';
const COMMUNITY_URL = 'https://www.reddit.com/r/proseminion/';

export interface SettingsSupportProps {
  onCopyEmail: (email: string) => void;
  copyStatus: SupportCopyStatus;
}

/** Support contacts, with the site's skull-book mark supplied by the bundled CSS asset. */
export const SettingsSupport: React.FC<SettingsSupportProps> = ({ onCopyEmail, copyStatus }) => (
  <section className="settings-section pm-settings-support" aria-labelledby="settings-support-title">
    <h3 className="settings-section-title" id="settings-support-title">Support</h3>
    <div className="pm-support-contact">
      <p>Questions, issues, or feature requests?</p>
      <div className="pm-support-email-row">
        <a className="pm-support-email" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        <button
          type="button"
          className="pm-support-copy"
          title="Copy support email"
          aria-label="Copy support email"
          disabled={copyStatus === 'copying'}
          onClick={() => onCopyEmail(SUPPORT_EMAIL)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <rect x="9" y="9" width="12" height="12" rx="2" />
            <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
          </svg>
        </button>
      </div>
    </div>
    <p className="pm-support-copy-status" role="status">
      {copyStatus === 'copying' && 'Copying…'}
      {copyStatus === 'copied' && 'Email copied.'}
      {copyStatus === 'error' && 'Couldn’t copy. Try again, or select the email address to copy it.'}
    </p>
    <a
      className="pm-community-card"
      href={COMMUNITY_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Join the Prose Minion community on r/proseminion"
    >
      <span className="pm-community-eyebrow">Community</span>
      <h4 className="pm-community-title">
        Join the Prose Minion community <span>r/proseminion</span>
      </h4>
      <p className="pm-community-description">
        Share passages, swap prompts, and talk craft with other writers.
      </p>
      <span className="pm-community-cta">
        Open r/proseminion
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M4 12h16m-6-6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="pm-community-art" aria-hidden="true">
        <span className="pm-community-page pm-community-page-back" />
        <span className="pm-community-page pm-community-page-front" />
        <span className="pm-community-book" />
      </span>
    </a>
    <a className="pm-support-site" href="https://proseminion.app" target="_blank" rel="noopener noreferrer">
      proseminion.app
    </a>
  </section>
);
