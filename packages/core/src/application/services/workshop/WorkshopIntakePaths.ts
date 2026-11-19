/**
 * Path rules the context intake reads by: whether a path is absolute on any
 * host, whether a candidate lies inside a root, a path's base name, and the
 * segments of a workspace-relative display path (never one that climbs out
 * or names nothing). Pure; moved out of `WorkshopContextIntakeService`
 * unchanged.
 */

import * as path from 'path';

export const isAbsolutePath = (filePath: string): boolean =>
  filePath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(filePath) || filePath.startsWith('\\\\');

export const isPathWithinRoot = (root: string, candidate: string): boolean => {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  if (resolvedCandidate === resolvedRoot) {
    return true;
  }
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  return relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative);
};

export const baseName = (filePath: string): string =>
  filePath.split(/[\\/]/).filter(Boolean).pop() ?? filePath;

export const workspaceRelativeSegments = (displayPath: string): string[] | undefined => {
  if (
    displayPath.length === 0
    || displayPath.startsWith('External file: ')
    || displayPath.includes('\0')
    || isAbsolutePath(displayPath)
  ) {
    return undefined;
  }
  const segments = displayPath.split(/[\\/]/);
  return segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')
    ? undefined
    : segments;
};
