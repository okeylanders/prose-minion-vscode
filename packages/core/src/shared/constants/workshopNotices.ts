/**
 * Workshop startup-notice contract — the version string the host compares
 * against the recorded dismissal, and the GlobalStateStore key it lives under.
 *
 * The notice CONTENT lives with its modal in the webview (it is presentation
 * copy); only the version crosses the message boundary. Revise the copy →
 * bump the version → every machine sees the box once more. That re-show is
 * deliberate product behavior (Sprint 14 §5), not a bug.
 */

export const WORKSHOP_STARTUP_NOTICE_VERSION = 'v1';

export const WORKSHOP_STARTUP_NOTICE_DISMISSED_KEY =
  'proseMinion.workshopNotice.dismissedVersion';
