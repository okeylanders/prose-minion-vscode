/**
 * The *Alice* project with the real resolver, the settings writer and the
 * checker over it (ADR 2026-11-19 D22).
 */
import { ContextResourceResolver } from '@/infrastructure/context/ContextResourceResolver';
import { ContextPathProposalChecker } from '@/application/services/contextPaths/ContextPathProposalChecker';
import { ContextPathSettingsWriter } from '@/application/services/contextPaths/ContextPathSettingsWriter';
import { aliceProject, type AliceProjectOptions } from './aliceProject';

export const ALICE_FILES = [
  'Cast/Alice.md',
  'Cast/Mad Hatter.md',
  'Cast/Queen of Hearts.md',
  'Wonderland/Rabbit Hole.md',
  'Wonderland/Croquet Ground.md',
  'Wonderland/Queen of Hearts.md',
  'Book 1/Chapters/01 Down the Rabbit-Hole.md',
  'Notes/lore.md',
  'synopsis.md'
];

export const EMPTY_SETTINGS = {
  'contextPaths.characters': 'characters/**/*',
  'contextPaths.locations': 'locations/**/*',
  'contextPaths.themes': '',
  'contextPaths.things': '',
  'contextPaths.chapters': 'drafts/**/*',
  'contextPaths.manuscript': '',
  'contextPaths.projectBrief': '',
  'contextPaths.general': ''
};

export function aliceChecker(options: Partial<AliceProjectOptions> = {}) {
  const project = aliceProject({ roots: { '/alice': ALICE_FILES }, settings: { ...EMPTY_SETTINGS }, ...options });
  const resolver = new ContextResourceResolver(project.settings, project.fileSystem, project.workspace, project.log);
  const settings = new ContextPathSettingsWriter(project.settings);
  return { project, resolver, settings, checker: new ContextPathProposalChecker(resolver, settings) };
}

