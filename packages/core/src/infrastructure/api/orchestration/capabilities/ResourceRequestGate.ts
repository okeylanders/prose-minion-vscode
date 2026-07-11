import { ResourceReadInspection, ResourceReadXmlCodec } from '../ResourceReadXmlCodec';

/** Capability-specific nouns spliced into the shared correction instruction. */
export interface ResourceRequestGateWording {
  /** Catalog adjective, e.g. 'craft-guide' or 'project-resource'. */
  readonly catalogLabel: string;
  /** Sentence confirming nothing was loaded, e.g. 'No guides were loaded.' */
  readonly nothingLoaded: string;
  /** The deliverable the model must not produce yet, e.g. 'the final response'. */
  readonly finalArtifactLabel: string;
  /** Evidence noun, e.g. 'guide' or 'project'. */
  readonly evidenceLabel: string;
}

/**
 * The shared request gate every resource capability stands behind. It owns
 * the strict XML codec, the allow-list of displayed catalog keys, and the
 * one correction instruction; capabilities keep catalog assembly,
 * fulfillment, evidence, and provenance. New capabilities compose a gate
 * rather than re-implementing this arithmetic.
 */
export class ResourceRequestGate {
  private readonly codec = new ResourceReadXmlCodec();
  private allowedPaths: ReadonlySet<string> = new Set();

  constructor(private readonly wording: ResourceRequestGateWording) {}

  /** Replace the allow-list with exactly the keys displayed in the catalog. */
  setAllowedPaths(paths: Iterable<string>): void {
    this.allowedPaths = new Set(paths);
  }

  allows(path: string): boolean {
    return this.allowedPaths.has(path);
  }

  /** Structural validation first, then whole-request allow-list authorization. */
  inspect(candidate: string): ResourceReadInspection {
    const inspection = this.codec.inspect(candidate);
    if (inspection.kind !== 'request') {
      return inspection;
    }

    const allowlistedPathCount = inspection.request.paths
      .filter(path => this.allowedPaths.has(path)).length;
    return allowlistedPathCount === inspection.request.paths.length
      ? inspection
      : {
          kind: 'invalid',
          reason: 'path-not-allowlisted',
          pathCount: inspection.request.paths.length,
          allowlistedPathCount
        };
  }

  stripToolCalls(content: string): string {
    return this.codec.stripExactRequest(content);
  }

  invalidRequestInstruction(rejection: Extract<ResourceReadInspection, { kind: 'invalid' }>): string {
    const correction = rejection.reason === 'path-not-allowlisted'
      ? `One or more path values did not exactly match a complete opaque key in the displayed ${this.wording.catalogLabel} catalog.`
      : `The resource request did not match the required bare XML envelope (${rejection.reason}).`;
    return `${correction} ${this.wording.nothingLoaded} Because you attempted a resource request, resubmit the intended request now as one bare XML document using only complete catalog keys. Do not narrate the request, use a Markdown fence, or provide ${this.wording.finalArtifactLabel} yet; wait for the requested ${this.wording.evidenceLabel} evidence.`;
  }
}
