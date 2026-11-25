/**
 * WorkshopConfigureGuide — the full-surface "How to configure your project"
 * walkthrough referenced by the startup notice
 * (docs/design/`Prose Minion - Notice Modal.html` §configure).
 *
 * It is a reference sheet, not a wizard: three steps, a worked example of a
 * well-aligned project beside the settings pane that consumes it, and the
 * field → glob mapping for that exact layout. Nothing here writes settings —
 * the writer reviews suggestions or enters globs in Prose Minion Settings.
 *
 * It takes the whole webview rather than a modal box because the two
 * screenshots are tall (a full explorer tree and eight stacked settings
 * fields) and shrinking them to a dialog made both unreadable.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { useOverlayDismiss } from '@hooks/useOverlayDismiss';
import { getNoticeShotUri } from '@utils/proseMinionAssets';

interface GuideStep {
  key: string;
  title: string;
  body: React.ReactNode;
}

const STEPS: readonly GuideStep[] = [
  {
    key: 'STEP 1',
    title: 'Open the project folder',
    body: (
      <>
        VS Code → <b>File → Open Folder…</b> and select your book&rsquo;s root folder. The
        extension only sees what is inside the open workspace.
      </>
    )
  },
  {
    key: 'STEP 2',
    title: 'Open Prose Minion Settings',
    body: (
      <>
        Click the <b>Settings</b> gear in the Prose Minion sidebar and scroll to{' '}
        <b>Context Resource Paths</b>.
      </>
    )
  },
  {
    key: 'STEP 3',
    /* "one glob per field" undersold it — three of the eight rows in the table
       below carry two patterns (PR #94 review, Bria). */
    title: 'Fill in the fields with globs',
    body: (
      <>
        Enter patterns relative to the project folder. Use commas to list several paths and{' '}
        <b>**/*</b> for everything below a folder. Or choose <b>Suggest from my folders</b> to
        ask the helper model for patterns based on your file and folder names. Review
        the examples before choosing <b>Apply</b> to update your user settings.
      </>
    )
  }
];

/** Settings field → the glob that matches the example layout shown above it. */
const FIELD_PATTERNS: ReadonlyArray<readonly [field: string, pattern: string]> = [
  ['Characters', 'characters/**/*'],
  ['Locations & Settings', 'locations-and-settings/**/*'],
  ['Themes', 'themes-and-literary-devices/**/*'],
  ['Things / Props', 'things-and-props/**/*'],
  ['Draft Chapters & Outlines', 'draft-chapters/*.md,outlines/*.md'],
  ['Manuscript Chapters', 'manuscript-chapters/*.md'],
  ['Project Brief Materials', 'project-brief/**/*,*.md'],
  ['General References', 'references/**/*,research/**/*']
];

interface WorkshopConfigureGuideProps {
  open: boolean;
  onClose: () => void;
}

export const WorkshopConfigureGuide: React.FC<WorkshopConfigureGuideProps> = ({
  open,
  onClose
}) => {
  /* Same hook the boxed modal shell uses — this overlay only opts out of the
     shell's backdrop LAYOUT, not its Escape and focus contract. */
  const closeButtonRef = useOverlayDismiss({ open, onClose });

  if (!open) {
    return null;
  }

  return (
    <div
      className="pm-ws-guide"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pm-ws-guide-title"
    >
      <header className="pm-ws-guide-head">
        <div>
          <span className="pm-ws-eyebrow">Prose Minion · Workshop</span>
          <h2 id="pm-ws-guide-title">How to configure your project</h2>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          className="pm-ws-guide-back"
          onClick={onClose}
        >
          <Icon name="chevRight" size={14} />
          Back to the tour
        </button>
      </header>

      <div className="pm-ws-guide-body">
        <p className="pm-ws-guide-lede">
          Context paths tell the Workshop where to find your chapters, character sheets, and
          reference files. Use the example below to set up your own groups.
        </p>

        <ol className="pm-ws-guide-steps">
          {STEPS.map((step) => (
            <li className="pm-ws-guide-step" key={step.key}>
              <span className="pm-ws-guide-step-key">{step.key}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>

        <div className="pm-ws-guide-panels">
          <section className="pm-ws-guide-panel">
            <h3 className="pm-ws-guide-panel-cap">A well-aligned project</h3>
            <p className="pm-ws-guide-panel-sub">
              One folder per resource type, one file per chapter — this is the layout the fields
              below map onto.
            </p>
            <img
              src={getNoticeShotUri('project-layout')}
              alt="An example project folder structure in the VS Code explorer, with one folder per resource type"
            />
          </section>
          <section className="pm-ws-guide-panel">
            <h3 className="pm-ws-guide-panel-cap">
              Where you enter it — Settings → Context Resource Paths
            </h3>
            <p className="pm-ws-guide-panel-sub">
              Eight fields, each with its own hint and example beneath the input.
            </p>
            <img
              src={getNoticeShotUri('settings-resource-locations')}
              alt="The Context Resource Paths settings fields"
            />
            <p className="pm-ws-guide-warn">
              Values shown are from another project — use the mapping below.
            </p>
          </section>
        </div>

        <table className="pm-ws-guide-map">
          <thead>
            <tr>
              <th scope="col">Settings field</th>
              <th scope="col">Pattern for the layout above</th>
            </tr>
          </thead>
          <tbody>
            {FIELD_PATTERNS.map(([field, pattern]) => (
              <tr key={field}>
                <th scope="row">{field}</th>
                <td>
                  <code>{pattern}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <aside className="pm-ws-guide-tip">
          <span className="pm-ws-guide-tip-mark" aria-hidden="true" />
          <p>
            <b>Split chapters into individual files.</b> Draft and manuscript fields end in{' '}
            <b>*.md</b> rather than <b>**/*</b> on purpose: one chapter per file lets an assistant
            open exactly the chapter it needs instead of loading a whole novel as a single
            document.
          </p>
        </aside>
      </div>
    </div>
  );
};
