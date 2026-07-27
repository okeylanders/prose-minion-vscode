/**
 * Workshop startup-notice contract — the version string the host compares
 * against the recorded dismissal, the GlobalStateStore key it lives under, and
 * the names of the screenshots the notice renders.
 *
 * The notice COPY lives with its modal in the webview (it is presentation
 * copy); only the version and the screenshot names cross the message boundary.
 * Revise the copy → bump the version → every machine sees the box once more.
 * That re-show is deliberate product behavior (Sprint 14 §5), not a bug.
 */

export const WORKSHOP_STARTUP_NOTICE_VERSION = 'v3';

export const WORKSHOP_STARTUP_NOTICE_DISMISSED_KEY =
  'proseMinion.workshopNotice.dismissedVersion';

/**
 * Folder under the extension's `assets/` holding the notice screenshots.
 * The webview cannot build `vscode-webview://` URIs itself, so the host
 * resolves one per name into `window.proseMinonAssets.noticeShots`.
 */
export const WORKSHOP_NOTICE_SHOT_DIR = 'workshop-notices';

/**
 * Screenshots the notice modal and the project-configuration guide render,
 * named after what they SHOW rather than when they were captured — re-shooting
 * a control means replacing one file, not editing three call sites. Each name
 * is `<name>.png` inside `assets/workshop-notices/`.
 */
export const WORKSHOP_NOTICE_SHOTS = [
  'header-cluster',
  'talking-to-rail',
  'composer-controls',
  'vscode-open-folder',
  'sidebar-settings-gear',
  'controller-behavior',
  'controller-about-you',
  'controller-advanced',
  'project-layout',
  'settings-resource-locations'
] as const;

export type WorkshopNoticeShot = (typeof WORKSHOP_NOTICE_SHOTS)[number];
