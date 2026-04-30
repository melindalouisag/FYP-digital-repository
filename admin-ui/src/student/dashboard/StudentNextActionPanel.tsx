import DashboardPanel from '@/shared/ui/DashboardPanel';
import PortalIcon from '@/shared/ui/PortalIcon';
import StatusBadge from '@/shared/ui/StatusBadge';
import { resolveStudentCaseNavigation } from '@/student/caseNavigation';
import type { CaseSummary } from '@/types/workflow';
import { studentSidebarIcons } from '@/utils/portalIcons';
import {
  getStudentWorkflowOwnerLabel,
  getWorkflowStatusPresentation,
} from '@/utils/workflowUi';

interface StudentNextActionPanelProps {
  loading: boolean;
  nextStepCases: CaseSummary[];
  onNavigate: (path: string) => void;
}

export function StudentNextActionPanel({
  loading,
  nextStepCases,
  onNavigate,
}: StudentNextActionPanelProps) {
  const nextCase = nextStepCases[0] ?? null;

  return (
    <DashboardPanel
      className="su-next-action-panel"
      bodyClassName="su-next-action-panel-body"
      title={(
        <span className="su-dashboard-title-with-icon">
          <PortalIcon src={studentSidebarIcons.needsAction} className="su-dashboard-title-icon" />
          <span>Next Action</span>
        </span>
      )}
    >
      {loading ? (
        <p className="su-dashboard-empty-copy mb-0">Loading dashboard data.</p>
      ) : !nextCase ? (
        <div className="su-dashboard-empty su-dashboard-empty-centered">
          <p className="su-dashboard-empty-copy mb-0">No active publications need your attention right now.</p>
        </div>
      ) : (
        <StudentNextActionCard item={nextCase} onNavigate={onNavigate} />
      )}
    </DashboardPanel>
  );
}

function StudentNextActionCard({
  item,
  onNavigate,
}: {
  item: CaseSummary;
  onNavigate: (path: string) => void;
}) {
  const navigationTarget = resolveStudentCaseNavigation(item, 'dashboard');
  const presentation = getWorkflowStatusPresentation(item.status);
  const ownerLabel = getStudentWorkflowOwnerLabel(item.status);
  const lastUpdated = item.updatedAt ?? item.createdAt;

  return (
    <button
      type="button"
      className="su-dashboard-panel-button"
      onClick={() => onNavigate(navigationTarget.path)}
    >
      <div className="d-flex justify-content-between gap-3 align-items-start">
        <div className="min-w-0">
          <div className="su-dashboard-item-title">{item.title || 'Untitled publication'}</div>
          <div className="su-dashboard-item-support">{presentation.nextAction}</div>
        </div>
        <div className="flex-shrink-0">
          <StatusBadge status={item.status} />
        </div>
      </div>
      <div className="su-dashboard-next-action-callout">
        {ownerLabel ?? `Current reviewer: ${presentation.actor}`}
      </div>
      <div className="su-dashboard-item-meta">
        {lastUpdated ? `Updated ${new Date(lastUpdated).toLocaleString()}` : 'No recent updates'}
      </div>
    </button>
  );
}
