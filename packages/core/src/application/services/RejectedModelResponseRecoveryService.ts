/** Durable local quarantine for paid provider responses rejected by host validation. */

import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { TokenUsage } from '@shared/types';
import type { FileSystem, LogSink, ShellService, Workspace } from '@/platform';

const RECOVERY_VERSION = 1 as const;
const OPEN_ACTION = 'Open Recovery File';
const REVEAL_ACTION = 'Reveal in Finder';
const PROJECT_RECOVERY_DIRECTORY = path.join('prose-minion', 'recovery');
const RESPONSE_DIRECTORY = 'model-responses';
const RECOVERY_GITIGNORE = '*\n!.gitignore\n';

export interface RejectedModelResponse {
  toolName: string;
  requestSummary: string;
  rawResponse: string;
  rejection: string;
  modelId?: string;
  providerResponseId?: string;
  finishReason?: string;
  usage?: TokenUsage;
}

export interface RejectedModelResponseRecoveryReceipt {
  /** Exact provider body, opened automatically and safe to edit in place. */
  filePath: string;
  /** Versioned diagnostic sidecar for support and provider-side retrieval. */
  metadataPath?: string;
  storageScope: 'project' | 'extension';
}

export interface RejectedModelResponseRecovery {
  capture(response: RejectedModelResponse): Promise<RejectedModelResponseRecoveryReceipt | undefined>;
}

interface RejectedModelResponseEnvelopeV1 {
  version: typeof RECOVERY_VERSION;
  kind: 'rejected-model-response';
  recordedAt: string;
  toolName: string;
  requestSummary: string;
  rejection: string;
  modelId?: string;
  providerResponseId?: string;
  finishReason?: string;
  usage?: TokenUsage;
  responseFile: string;
  responseCharacters: number;
}

export class RejectedModelResponseRecoveryService implements RejectedModelResponseRecovery {
  private readonly encoder = new TextEncoder();

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly workspace: Workspace,
    private readonly shell: ShellService,
    private readonly fallbackStorageDirectory: string,
    private readonly log?: LogSink,
    private readonly now: () => Date = () => new Date()
  ) {}

  async capture(
    response: RejectedModelResponse
  ): Promise<RejectedModelResponseRecoveryReceipt | undefined> {
    const projectRoot = this.workspace.workspaceFolders()[0]?.path;
    if (projectRoot) {
      const recoveryRoot = path.join(projectRoot, PROJECT_RECOVERY_DIRECTORY);
      try {
        await this.ensureProjectRecoveryIgnored(recoveryRoot);
      } catch (error) {
        // Ignoring the folder is a safety convenience, not a reason to discard
        // another paid response. Preserve first and make the warning explicit.
        this.log?.appendLine(
          `[RejectedModelResponseRecovery] Could not create the project recovery .gitignore: ${this.errorMessage(error)}`
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
          `[RejectedModelResponseRecovery] Project recovery failed; trying extension storage: ${this.errorMessage(error)}`
        );
      }
    }

    try {
      return await this.captureInDirectory(
        response,
        path.join(this.fallbackStorageDirectory, RESPONSE_DIRECTORY),
        'extension'
      );
    } catch (error) {
      this.log?.appendLine(
        `[RejectedModelResponseRecovery] Failed to save ${response.toolName} response: ${this.errorMessage(error)}`
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
    const filePath = path.join(storageDirectory, `${baseName}.response.txt`);
    const metadataPath = path.join(storageDirectory, `${baseName}.metadata.json`);
    const temporaryPath = `${filePath}.tmp`;
    const temporaryMetadataPath = `${metadataPath}.tmp`;
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
      responseCharacters: response.rawResponse.length
    };
    await this.fileSystem.writeFile(temporaryPath, this.encoder.encode(response.rawResponse));
    await this.fileSystem.rename(temporaryPath, filePath, { overwrite: false });
    let savedMetadataPath: string | undefined;
    try {
      const metadataBytes = this.encoder.encode(`${JSON.stringify(envelope, null, 2)}\n`);
      await this.fileSystem.writeFile(temporaryMetadataPath, metadataBytes);
      await this.fileSystem.rename(temporaryMetadataPath, metadataPath, { overwrite: false });
      savedMetadataPath = metadataPath;
    } catch (error) {
      this.log?.appendLine(
        `[RejectedModelResponseRecovery] Response survived, but its metadata sidecar did not: ${this.errorMessage(error)}`
      );
    }
    this.log?.appendLine(
      `[RejectedModelResponseRecovery] Saved complete ${response.toolName} response to ${filePath}`
    );
    void this.present(filePath, response.toolName);
    return { filePath, metadataPath: savedMetadataPath, storageScope };
  }

  private async ensureProjectRecoveryIgnored(recoveryRoot: string): Promise<void> {
    const ignorePath = path.join(recoveryRoot, '.gitignore');
    try {
      await this.fileSystem.stat(ignorePath);
    } catch {
      await this.fileSystem.writeFile(ignorePath, this.encoder.encode(RECOVERY_GITIGNORE));
    }
  }

  private async present(filePath: string, toolName: string): Promise<void> {
    let opened = false;
    try {
      await this.shell.openFileInEditor(filePath, { beside: true });
      opened = true;
    } catch (error) {
      this.log?.appendLine(
        `[RejectedModelResponseRecovery] Saved recovery could not be opened automatically: ${this.errorMessage(error)}`
      );
    }

    try {
      const choice = await this.shell.showWarningMessage(
        `${toolName} returned a paid response that Prose Minion could not use. `
          + `The complete response was saved${opened ? ' and opened' : ''}: ${filePath}`,
        ...(opened ? [REVEAL_ACTION] : [OPEN_ACTION, REVEAL_ACTION])
      );
      if (choice === OPEN_ACTION) {
        await this.shell.openFileInEditor(filePath, { beside: true });
      } else if (choice === REVEAL_ACTION) {
        await this.shell.revealFileInOS(filePath);
      }
    } catch (error) {
      this.log?.appendLine(
        `[RejectedModelResponseRecovery] Recovery notification action failed: ${this.errorMessage(error)}`
      );
    }
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
