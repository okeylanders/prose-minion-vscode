import * as fs from 'fs';
import * as path from 'path';
import type { LogSink } from '@/platform';
import { WorkshopHelpReference } from '@/application/services/workshop/help/WorkshopHelpReference';

const coreRoot = path.resolve(__dirname, '../../../../../..');
export const helpDirectory = path.join(coreRoot, 'resources/help');
export const helpVersion: string = JSON.parse(
  fs.readFileSync(path.resolve(coreRoot, '../../apps/vscode-extension/package.json'), 'utf8')
).version;

export function bundledHelpReference(log: LogSink): WorkshopHelpReference {
  return new WorkshopHelpReference({ readFile: file => fs.promises.readFile(file) }, helpDirectory, helpVersion, log);
}
