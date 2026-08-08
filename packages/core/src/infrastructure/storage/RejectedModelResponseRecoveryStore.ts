/** Durable quarantine for completed provider bodies rejected by widget validation. */

import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ExecutionResult } from '@orchestration/AgentRunContracts';
import {
  RECOVERABLE_WIDGET_RESPONSE_CONTRACTS,
  type RecoverableWidgetToolName,
  type RejectedModelResponseContract,
  type TokenUsage
} from '@messages';
import type { FileSystem, LogSink, ShellService, Workspace } from '@/platform';
import { isMissingFileSystemPathError } from './fileSystemErrors';

const RECOVERY_VERSION = 1 as const;
const PROJECT_RECOVERY_DIRECTORY = path.join('prose-minion', 'recovery');
const RESPONSE_DIRECTORY = 'model-responses';
const RECOVERY_GITIGNORE = '*\n!.gitignore\n';
const RESPONSE_FILE_EXTENSION = '.response.txt';
const OPEN_ACTION = 'Open Recovery File';
const REVEAL_ACTION = 'Reveal in Finder';

export interface RejectedModelResponse {
  toolName: RecoverableWidgetToolName;
  requestSummary: string;
  rawResponse: string;
  rejection: string;
  modelId?: string;
  providerResponseId?: string;
  finishReason?: string;
  usage?: TokenUsage;
}

export interface RejectedModelResponseRecoveryReceipt {
  /** Exact provider body, opened only when a caller explicitly presents it. */
  filePath: string;
  /** Versioned diagnostic sidecar for support and future repair workflows. */
  metadataPath?: string;
  toolName: RecoverableWidgetToolName;
  storageScope: 'project' | 'extension';
}

export interface RejectedModelResponseRecovery {
  capture(response: RejectedModelResponse): Promise<RejectedModelResponseRecoveryReceipt | undefined>;
}

export interface RejectedModelResponseRecoveryPresenter {
  present(receipt: RejectedModelResponseRecoveryReceipt): Promise<void>;
}

export interface RejectedWidgetResponseInput {
  toolName: RecoverableWidgetToolName;
  requestSummary: string;
  rawResponse: string;
  rejection: string;
  result: Pick<ExecutionResult, 'modelId' | 'providerResponseId' | 'finishReason' | 'usage'>;
}

interface RejectedModelResponseEnvelopeV1 {
  version: typeof RECOVERY_VERSION;
  kind: 'rejected-model-response';
  recordedAt: string;
  toolName: RecoverableWidgetToolName;
  requestSummary: string;
  rejection: string;
  modelId?: string;
  providerResponseId?: string;
  finishReason?: string;
  usage?: TokenUsage;
  responseFile: string;
  /** The saved body is raw/malformed text; its intended validation contract is below. */
  responseContentType: 'text/plain';
  responseCharacters: number;
  contract: RejectedModelResponseContract;
}

export class RejectedModelResponseRecoveryStore implements RejectedModelResponseRecovery {
  private readonly encoder = new TextEncoder();

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly workspace: Workspace,
    private readonly fallbackStorageDirectory: string,
    private readonly log?: LogSink,
    private readonly now: () => Date = () => new Date()
  ) {}

  async capture(response: RejectedModelResponse): Promise<RejectedModelResponseRecoveryReceipt | undefined> {
    const folders = this.workspace.workspaceFolders();
    if (folders.length === 1) {
      const recoveryRoot = path.join(folders[0].path, PROJECT_RECOVERY_DIRECTORY);
      try {
        await this.ensureProjectRecoveryIgnored(recoveryRoot);
      } catch (error) {
        this.log?.appendLine(
          `[RejectedModelResponseRecovery] Could not create the project recovery .gitignore${this.trace(response)}: ${this.errorMessage(error)}`
        );
      }
      try {
        return await this.captureInDirectory(
          response,
          path.join(recoveryRoot, RESPONSE_DIRECTORY),
          'project'
        );
      } catch (error) {
        this.log?.appendLine(
          `[RejectedModelResponseRecovery] Project recovery failed; trying extension storage${this.trace(response)}: ${this.errorMessage(error)}`
        );
      }
    } else if (folders.length > 1) {
      this.log?.appendLine(
        `[RejectedModelResponseRecovery] Multi-root workspace; using extension recovery storage${this.trace(response)}.`
      );
    }

    try {
      return await this.captureInDirectory(
        response,
        path.join(this.fallbackStorageDirectory, RESPONSE_DIRECTORY),
        'extension'
      );
    } catch (error) {
      this.log?.appendLine(
        `[RejectedModelResponseRecovery] Failed to save ${response.toolName} response${this.trace(response)}: ${this.errorMessage(error)}`
      );
      return undefined;
    }
  }

  private async captureInDirectory(
    response: RejectedModelResponse,
    storageDirectory: string,
    storageScope: RejectedModelResponseRecoveryReceipt['storageScope']
  ): Promise<RejectedModelResponseRecoveryReceipt> {
    const recordedAt = this.now();
    const baseName = `${this.fileTimestamp(recordedAt)}-${this.fileSegment(response.toolName)}-${randomUUID()}`;
    // The body is intentionally text: it may be malformed JSON or a mixed framed response.
    const filePath = path.join(storageDirectory, `${baseName}${RESPONSE_FILE_EXTENSION}`);
    const metadataPath = path.join(storageDirectory, `${baseName}.metadata.json`);
    const envelope: RejectedModelResponseEnvelopeV1 = {
      version: RECOVERY_VERSION,
      kind: 'rejected-model-response',
      recordedAt: recordedAt.toISOString(),
      toolName: response.toolName,
      requestSummary: response.requestSummary,
      rejection: response.rejection,
      modelId: response.modelId,
      providerResponseId: response.providerResponseId,
      finishReason: response.finishReason,
      usage: response.usage ? { ...response.usage } : undefined,
      responseFile: path.basename(filePath),
      responseContentType: 'text/plain',
      responseCharacters: response.rawResponse.length,
      contract: RECOVERABLE_WIDGET_RESPONSE_CONTRACTS[response.toolName]
    };

    await this.writeAtomically(filePath, this.encoder.encode(response.rawResponse), response);
    let savedMetadataPath: string | undefined;
    try {
      await this.writeAtomically(
        metadataPath,
        this.encoder.encode(`${JSON.stringify(envelope, null, 2)}\n`),
        response
      );
      savedMetadataPath = metadataPath;
    } catch (error) {
      this.log?.appendLine(
        `[RejectedModelResponseRecovery] Response survived, but its metadata sidecar did not${this.trace(response)}: ${this.errorMessage(error)}`
      );
    }
    this.log?.appendLine(
      `[RejectedModelResponseRecovery] Saved complete ${response.toolName} response${this.trace(response)} to ${filePath}`
    );
    return { filePath, metadataPath: savedMetadataPath, toolName: response.toolName, storageScope };
  }

  private async writeAtomically(
    targetPath: string,
    bytes: Uint8Array,
    response: RejectedModelResponse
  ): Promise<void> {
    const temporaryPath = `${targetPath}.tmp`;
    try {
      await this.fileSystem.writeFile(temporaryPath, bytes);
      await this.fileSystem.rename(temporaryPath, targetPath, { overwrite: false });
    } catch (error) {
      try {
        await this.fileSystem.delete(temporaryPath);
      } catch (cleanupError) {
        this.log?.appendLine(
          `[RejectedModelResponseRecovery] Could not clean temporary recovery file${this.trace(response)}: ${this.errorMessage(cleanupError)}`
        );
      }
      throw error;
    }
  }

  private async ensureProjectRecoveryIgnored(recoveryRoot: string): Promise<void> {
    const ignorePath = path.join(recoveryRoot, '.gitignore');
    try {
      await this.fileSystem.stat(ignorePath);
      return;
    } catch (error) {
      if (!isMissingFileSystemPathError(error)) {
        throw error;
      }
    }
    await this.fileSystem.writeFile(ignorePath, this.encoder.encode(RECOVERY_GITIGNORE));
  }

  private trace(response: RejectedModelResponse): string {
    return ` providerResponseId=${response.providerResponseId ?? 'unavailable'}`;
  }

  private fileTimestamp(value: Date): string {
    return value.toISOString().replace(/[:.]/g, '-');
  }

  private fileSegment(value: string): string {
    const normalized = value.trim().toLocaleLowerCase('en-US')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return normalized || 'model-response';
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

export class RejectedModelResponseRecoveryShellPresenter implements RejectedModelResponseRecoveryPresenter {
  constructor(private readonly shell: ShellService, private readonly log?: LogSink) {}

  async present(receipt: RejectedModelResponseRecoveryReceipt): Promise<void> {
    let opened = false;
    try {
      await this.shell.openFileInEditor(receipt.filePath, { beside: true });
      opened = true;
    } catch (error) {
      this.log?.appendLine(
        `[RejectedModelResponseRecovery] Saved recovery could not be opened automatically: ${this.errorMessage(error)}`
      );
    }

    try {
      const choice = await this.shell.showWarningMessage(
        `${receipt.toolName} returned a paid response that Prose Minion could not use. `
          + `The complete response was saved${opened ? ' and opened' : ''}: ${receipt.filePath}`,
        ...(opened ? [REVEAL_ACTION] : [OPEN_ACTION, REVEAL_ACTION])
      );
      if (choice === OPEN_ACTION) {
        await this.shell.openFileInEditor(receipt.filePath, { beside: true });
      } else if (choice === REVEAL_ACTION) {
        await this.shell.revealFileInOS(receipt.filePath);
      }
    } catch (error) {
      this.log?.appendLine(
        `[RejectedModelResponseRecovery] Recovery notification action failed: ${this.errorMessage(error)}`
      );
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

/** Shared widget seam: persistence is reusable; presentation remains opt-in. */
export async function persistRejectedWidgetResponse(
  recovery: RejectedModelResponseRecovery,
  presenter: RejectedModelResponseRecoveryPresenter,
  input: RejectedWidgetResponseInput
): Promise<RejectedModelResponseRecoveryReceipt | undefined> {
  const receipt = await recovery.capture({
    toolName: input.toolName,
    requestSummary: input.requestSummary,
    rawResponse: input.rawResponse,
    rejection: input.rejection,
    modelId: input.result.modelId,
    providerResponseId: input.result.providerResponseId,
    finishReason: input.result.finishReason,
    usage: input.result.usage
  });
  if (receipt) {
    void presenter.present(receipt);
  }
  return receipt;
}

export function recoveryLocationNotice(receipt: RejectedModelResponseRecoveryReceipt | undefined): string {
  return receipt
    ? `Complete response saved for recovery at ${receipt.filePath}.`
    : 'The complete response could not be saved; see the Prose Minion output for details.';
}
