/**
 * Copy and Save on the sidebar route (ADR 2026-11-20 D15, D22; PR #294): a
 * report is written by the host from the result it holds, named by id; a
 * stale or missing result is refused cleanly; a failed write and a failed
 * open are told apart; and no log line carries a path or a thrown message.
 */

import { PASSAGE_SEARCH_ROUTE_WORDS } from '@/application/handlers/domain/PassageSearchRoute';
import { passageSearchReportFileName } from '@/application/handlers/domain/PassageSearchReportExport';
import { passageSearchResultView } from '@/application/handlers/domain/PassageSearchViews';
import { MessageType, PassageSearchReportResultPayload } from '@messages';
import { formatPassageSearchReport } from '@shared/utils/passageSearchReport';
import {
  ALICE_QUOTE,
  aliceResult,
  passageSearchRouteHost,
  type PassageSearchRouteHost
} from '@/__tests__/application/handlers/domain/passageSearchRouteHarness';

const ROOT = '/home/dodgson/novel';
const FILE = 'passage-search-20261121-090507.md';
const SAVED = `${ROOT}/prose-minion/reports/${FILE}`;

describe('PassageSearchRoute: copy and save the report', () => {
  let host: PassageSearchRouteHost;

  beforeEach(() => {
    host = passageSearchRouteHost();
  });

  const answers = () => host.posted<PassageSearchReportResultPayload>(MessageType.PASSAGE_SEARCH_REPORT_RESULT);
  const copy = (payload: Record<string, unknown>) => host.send(MessageType.PASSAGE_SEARCH_COPY_REPORT, payload);
  const save = (payload: Record<string, unknown>) => host.send(MessageType.PASSAGE_SEARCH_SAVE_REPORT, payload);
  /** The report of the held *Alice* result, as the host's own formatter writes it. */
  const heldReport = (resultId: string) => formatPassageSearchReport(passageSearchResultView(aliceResult(), resultId, false));
  const expectNoPathInLogs = () => {
    const written = host.logs();
    for (const secret of ['/home', 'dodgson', 'novel', 'prose-minion', FILE, 'EACCES', 'ENOENT', 'alice']) {
      expect(written).not.toContain(secret);
    }
  };

  describe('the id boundary', () => {
    it('copies the report the host builds from the held result', async () => {
      const resultId = await host.finished();
      await copy({ requestId: 'copy-1', resultId });
      expect(host.copyToClipboard).toHaveBeenCalledWith(heldReport(resultId));
      expect(answers()).toEqual([{ requestId: 'copy-1', status: 'copied' }]);
    });

    it('saves the report the host builds, under prose-minion/reports, and opens it', async () => {
      const resultId = await host.finished();
      await save({ requestId: 'save-1', resultId });
      expect(host.createDirectory).toHaveBeenCalledWith(`${ROOT}/prose-minion/reports`);
      expect(host.writeFile).toHaveBeenCalledTimes(1);
      const [filePath, bytes] = host.writeFile.mock.calls[0];
      expect(filePath).toBe(SAVED);
      expect(new TextDecoder().decode(bytes)).toBe(heldReport(resultId));
      expect(host.openFileInEditor).toHaveBeenCalledWith(SAVED);
      expect(answers()).toEqual([{ requestId: 'save-1', status: 'saved', filePath: `prose-minion/reports/${FILE}`, opened: true }]);
    });

    it('never writes text the webview sends: content, a path and a tool name are ignored', async () => {
      const resultId = await host.finished();
      const smuggled = { content: '# Not the report', text: 'Off with her head!', report: 'x', filePath: '/etc/passwd', path: '/etc/passwd', toolName: '../../escape' };
      await copy({ requestId: 'copy-1', resultId, ...smuggled });
      await save({ requestId: 'save-1', resultId, ...smuggled });
      expect(host.copyToClipboard).toHaveBeenCalledWith(heldReport(resultId));
      expect(host.writeFile.mock.calls[0][0]).toBe(SAVED);
      expect(new TextDecoder().decode(host.writeFile.mock.calls[0][1])).toBe(heldReport(resultId));
    });

    it('holds the question the result was searched for, whatever was asked since', async () => {
      const resultId = await host.finished();
      await host.planRequest('plan-2', { question: 'Where does the Cheshire Cat grin?' });
      await copy({ requestId: 'copy-1', resultId });
      const report = host.copyToClipboard.mock.calls[0][0] as string;
      expect(report).toContain('Find every time the White Rabbit checks his watch.');
      expect(report).not.toContain('Cheshire');
    });
  });

  describe('a missing or stale result', () => {
    it('is refused with no result held', async () => {
      await copy({ requestId: 'copy-1', resultId: 'result-x-1' });
      await save({ requestId: 'save-1', resultId: 'result-x-1' });
      expect(host.copyToClipboard).not.toHaveBeenCalled();
      expect(host.writeFile).not.toHaveBeenCalled();
      expect(answers()).toEqual([
        { requestId: 'copy-1', status: 'refused', message: PASSAGE_SEARCH_ROUTE_WORDS['result-expired'] },
        { requestId: 'save-1', status: 'refused', message: PASSAGE_SEARCH_ROUTE_WORDS['result-expired'] }
      ]);
    });

    it('is refused for an earlier result once a newer run has replaced it', async () => {
      const first = await host.finished();
      await host.send(MessageType.PASSAGE_SEARCH_RUN, { requestId: 'run-2', planId: await host.planned('plan-2') });
      await copy({ requestId: 'copy-1', resultId: first });
      await save({ requestId: 'save-1', resultId: first });
      expect(host.copyToClipboard).not.toHaveBeenCalled();
      expect(host.writeFile).not.toHaveBeenCalled();
      expect(answers().map((answer) => answer.status)).toEqual(['refused', 'refused']);
    });

    it('is refused when no result id is named, and ignored with no request id', async () => {
      const resultId = await host.finished();
      await save({ requestId: 'save-1' });
      await save({ resultId });
      expect(host.writeFile).not.toHaveBeenCalled();
      expect(answers()).toEqual([{ requestId: 'save-1', status: 'refused', message: PASSAGE_SEARCH_ROUTE_WORDS['result-expired'] }]);
    });
  });

  describe('failures', () => {
    it('says a write failed, and logs its kind only: no path, no thrown message', async () => {
      const resultId = await host.finished();
      host.writeFile.mockRejectedValueOnce(Object.assign(new Error(`EACCES: permission denied, open '${SAVED}'`), { name: 'FileSystemError' }));
      await save({ requestId: 'save-1', resultId });
      expect(answers()).toEqual([{ requestId: 'save-1', status: 'refused', message: PASSAGE_SEARCH_ROUTE_WORDS['save-failed'] }]);
      expect(host.openFileInEditor).not.toHaveBeenCalled();
      expect(host.logs()).toContain('Save failed (FileSystemError).');
      expectNoPathInLogs();
    });

    it('says a folder could not be made the same way', async () => {
      const resultId = await host.finished();
      host.createDirectory.mockRejectedValueOnce(new Error(`ENOENT: no such file or directory, mkdir '${ROOT}/prose-minion'`));
      await save({ requestId: 'save-1', resultId });
      expect(host.writeFile).not.toHaveBeenCalled();
      expect(answers()[0]).toMatchObject({ status: 'refused', message: PASSAGE_SEARCH_ROUTE_WORDS['save-failed'] });
      expectNoPathInLogs();
    });

    it('tells a saved report that could not be opened apart from a failed save', async () => {
      const resultId = await host.finished();
      host.openFileInEditor.mockRejectedValueOnce(new Error(`Unable to open '${SAVED}'`));
      await save({ requestId: 'save-1', resultId });
      expect(host.writeFile).toHaveBeenCalledTimes(1);
      expect(answers()).toEqual([{ requestId: 'save-1', status: 'saved', filePath: `prose-minion/reports/${FILE}`, opened: false }]);
      expect(host.logs()).toContain('Saved, but the report could not be opened (Error).');
      expectNoPathInLogs();
    });

    it('refuses a save with no workspace folder open', async () => {
      const resultId = await host.finished();
      host.workspaceFolders.mockReturnValueOnce([]);
      await save({ requestId: 'save-1', resultId });
      expect(host.writeFile).not.toHaveBeenCalled();
      expect(answers()).toEqual([{ requestId: 'save-1', status: 'refused', message: PASSAGE_SEARCH_ROUTE_WORDS['no-workspace'] }]);
    });

    it('says a copy failed, without the host\'s message', async () => {
      const resultId = await host.finished();
      host.copyToClipboard.mockRejectedValueOnce(new Error(`clipboard refused "${ALICE_QUOTE}"`));
      await copy({ requestId: 'copy-1', resultId });
      expect(answers()).toEqual([{ requestId: 'copy-1', status: 'refused', message: PASSAGE_SEARCH_ROUTE_WORDS['copy-failed'] }]);
      expect(host.logs()).not.toContain('waistcoat');
    });

    it('logs counts on success, never the report or where it went', async () => {
      const resultId = await host.finished();
      await copy({ requestId: 'copy-1', resultId });
      await save({ requestId: 'save-1', resultId });
      expect(host.logs()).toContain('Saved: 2 instance(s), opened yes.');
      expectNoPathInLogs();
      expect(host.logs()).not.toContain('waistcoat');
    });
  });

  it('names a report by local date and time', () => {
    expect(passageSearchReportFileName(new Date(2026, 0, 3, 4, 5, 6))).toBe('passage-search-20260103-040506.md');
  });
});
