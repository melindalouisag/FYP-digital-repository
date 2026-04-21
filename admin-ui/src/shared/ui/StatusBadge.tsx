import type { CaseStatus } from '@/types/workflow';
import { formatStatus, statusBadgeClass } from '@/utils/workflowUi';

interface StatusBadgeProps {
  status: CaseStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`badge ${statusBadgeClass(status)} status-badge`}>
      {formatStatus(status)}
    </span>
  );
}
