import * as React from 'react';
import { Icon, IconName } from '@components/shared/Icon';

export interface WorkshopToastState {
  message: string;
  icon: IconName;
  tone?: 'success' | 'error';
}

interface WorkshopToastProps {
  toast: WorkshopToastState | null;
}

export const WorkshopToast: React.FC<WorkshopToastProps> = ({ toast }) => {
  if (!toast) {
    return null;
  }

  return (
    <div
      className={`pm-ws-toast ${toast.tone === 'error' ? 'pm-ws-toast-error' : ''}`}
      role="status"
      aria-live="polite"
    >
      <Icon name={toast.icon} size={15} />
      <span>{toast.message}</span>
    </div>
  );
};
