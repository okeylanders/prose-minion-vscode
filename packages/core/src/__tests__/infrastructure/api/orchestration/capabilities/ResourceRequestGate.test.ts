import { ResourceRequestGate } from '@orchestration/capabilities/ResourceRequestGate';

const request = (paths: readonly string[]) =>
  `<prose-minion-tool-call name="resource.read"><paths>${paths.map(p => `<path>${p}</path>`).join('')}</paths></prose-minion-tool-call>`;

describe('ResourceRequestGate', () => {
  const gate = new ResourceRequestGate({
    catalogLabel: 'craft-guide',
    nothingLoaded: 'No guides were loaded.',
    finalArtifactLabel: 'the final response',
    evidenceLabel: 'guide'
  });
  gate.setAllowedPaths(['dialogue.md', 'scene-example-guides/campfire-stories.md']);

  it('authorizes only whole requests whose every path is a displayed catalog key', () => {
    expect(gate.inspect(request(['dialogue.md']))).toEqual({
      kind: 'request',
      request: { operation: 'resource.read', paths: ['dialogue.md'] }
    });
    expect(gate.inspect(request(['dialogue.md', 'secrets.md']))).toEqual({
      kind: 'invalid', reason: 'path-not-allowlisted', pathCount: 2, allowlistedPathCount: 1
    });
    expect(gate.allows('dialogue.md')).toBe(true);
    expect(gate.allows('secrets.md')).toBe(false);
  });

  it('passes through structural verdicts from the codec unchanged', () => {
    expect(gate.inspect('Ordinary final prose.')).toEqual({ kind: 'none' });
    expect(gate.inspect(`${request(['dialogue.md'])} Then I will answer.`)).toMatchObject({
      kind: 'invalid', reason: 'mixed-content'
    });
    expect(gate.stripToolCalls(request(['dialogue.md']))).toBe('');
  });

  it('splices capability wording into the shared correction instruction', () => {
    const allowlistCorrection = gate.invalidRequestInstruction({
      kind: 'invalid', reason: 'path-not-allowlisted', pathCount: 2, allowlistedPathCount: 1
    });
    expect(allowlistCorrection).toContain('displayed craft-guide catalog');
    expect(allowlistCorrection).toContain('No guides were loaded.');
    expect(allowlistCorrection).toContain('provide the final response yet; wait for the requested guide evidence.');

    expect(gate.invalidRequestInstruction({ kind: 'invalid', reason: 'mixed-content' }))
      .toContain('did not match the required bare XML envelope (mixed-content)');
  });

  it('replaces the allow-list wholesale when the displayed catalog changes', () => {
    const rotating = new ResourceRequestGate({
      catalogLabel: 'project-resource',
      nothingLoaded: 'No project files were loaded.',
      finalArtifactLabel: 'the context briefing',
      evidenceLabel: 'project'
    });
    rotating.setAllowedPaths(['a.md']);
    expect(rotating.inspect(request(['a.md']))).toMatchObject({ kind: 'request' });
    rotating.setAllowedPaths(['b.md']);
    expect(rotating.inspect(request(['a.md']))).toMatchObject({
      kind: 'invalid', reason: 'path-not-allowlisted', pathCount: 1, allowlistedPathCount: 0
    });
  });
});
