import { createHash } from 'crypto';
import type {
  WorkshopContextAttachment,
  WorkshopPendingHostUpdates
} from '@/application/services/workshop/WorkshopSessionRecords';

/** Host-private acknowledgement; manuscript bodies remain in the working set/history. */
export interface WorkshopContextDeliveryBaseline {
  revision: number;
  attachments: Array<{ id: string; fingerprint: string }>;
}

type ContextDelivery = NonNullable<WorkshopPendingHostUpdates['contextAttachments']>;

function fingerprint(attachment: WorkshopContextAttachment): string {
  return createHash('sha256').update(JSON.stringify([
    attachment.kind, attachment.label, attachment.relativePath,
    attachment.words, attachment.truncation, attachment.content
  ])).digest('hex');
}

/** Acknowledged-state synchronization: compare current attachments with what reached the host. */
export class WorkshopContextDelivery {
  private baseline?: WorkshopContextDeliveryBaseline;

  prepare(revision: number, attachments: WorkshopContextAttachment[], replace = false): ContextDelivery {
    const baseline = {
      revision,
      attachments: attachments.map(attachment => ({ id: attachment.id, fingerprint: fingerprint(attachment) }))
    };
    const previous = new Map(this.baseline?.attachments.map(row => [row.id, row.fingerprint]));
    const current = new Map(baseline.attachments.map(row => [row.id, row.fingerprint]));
    const mode = replace || !this.baseline ? 'replace' : 'delta';
    return {
      revision,
      mode,
      attachments: mode === 'replace' ? attachments
        : attachments.filter(attachment => previous.get(attachment.id) !== current.get(attachment.id)),
      removedAttachmentIds: mode === 'replace' ? [] : [...previous.keys()].filter(id => !current.has(id)),
      baseline
    };
  }

  acknowledge(baseline: WorkshopContextDeliveryBaseline): void {
    if (!this.baseline || baseline.revision >= this.baseline.revision) {
      this.install(baseline);
    }
  }

  acknowledgedRevision(): number | undefined {
    return this.baseline?.revision;
  }

  exportState(): WorkshopContextDeliveryBaseline | undefined {
    return this.baseline && {
      revision: this.baseline.revision,
      attachments: this.baseline.attachments.map(row => ({ ...row }))
    };
  }

  install(baseline?: WorkshopContextDeliveryBaseline): void {
    this.baseline = baseline && {
      revision: baseline.revision,
      attachments: baseline.attachments.map(row => ({ ...row }))
    };
  }
}
