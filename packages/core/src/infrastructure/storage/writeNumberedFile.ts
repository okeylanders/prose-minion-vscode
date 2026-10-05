/**
 * Write a NEW file without ever replacing an existing one: `stem.ext`, else
 * `stem-2.ext`, `stem-3.ext`, … The bytes land in a temporary file first and
 * are renamed into the first free name with `overwrite: false`, so a
 * concurrent writer that takes a name makes this one move on rather than
 * clobber it.
 */

import * as path from 'path';
import { randomUUID } from 'node:crypto';
import type { FileSystem } from '@/platform';

export async function writeNumberedFile(
  fileSystem: FileSystem,
  directory: string,
  stem: string,
  extension: string,
  content: Uint8Array
): Promise<string> {
  const temporaryPath = path.join(directory, `.${stem}.${randomUUID()}.tmp`);
  try {
    await fileSystem.writeFile(temporaryPath, content);

    for (let number = 1; ; number++) {
      const fileName = number === 1 ? `${stem}.${extension}` : `${stem}-${number}.${extension}`;
      const destination = path.join(directory, fileName);
      try {
        await fileSystem.rename(temporaryPath, destination, { overwrite: false });
        return destination;
      } catch (error) {
        // Retry only when the destination was taken; preserve other I/O errors.
        if (!/EEXIST|FileExists|already exists|destination exists/i.test(String(error))) {
          throw error;
        }
        try {
          await fileSystem.stat(destination);
        } catch {
          throw error;
        }
      }
    }
  } catch (error) {
    try {
      await fileSystem.delete(temporaryPath);
    } catch {
      // The temporary file may already have been moved or the write may have failed.
    }
    throw error;
  }
}
