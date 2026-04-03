import DashboardPanel from '../../lib/components/DashboardPanel';
import { getWorkflowStatusPresentation, statusBadgeClass } from '../../lib/workflowUi';
import type { CaseSummary } from '../../lib/workflowTypes';
import { resolveStudentCaseNavigation } from '../caseNavigation';

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
  return (
    <DashboardPanel title="Next Action">
      {loading ? (
        <p className="su-dashboard-empty-copy mb-0">Loading dashboard data.</p>
      ) : nextStepCases.length === 0 ? (
        <p className="su-dashboard-empty-copy mb-0">No active publications yet.</p>
      ) : (
        <div className="su-dashboard-list">
          {nextStepCases.map((caseSummary) => {
            const navigationTarget = resolveStudentCaseNavigation(caseSummary, 'dashboard');
            const presentation = getWorkflowStatusPresentation(caseSummary.status);
            return (
              <button
                key={caseSummary.id}
                type="button"
                className="su-dashboard-item-button"
                onClick={() => onNavigate(navigationTarget.path)}
              >
                <div className="su-dashboard-list-item">
                  <div className="d-flex justify-content-between gap-2 align-items-start">
                    <div className="min-w-0">
                      <div className="su-dashboard-item-title su-text-truncate">
                        {caseSummary.title || 'Untitled Publication'}
                      </div>
                      <div className="su-dashboard-item-support">{presentation.nextAction}</div>
                      <div className="small text-muted mt-1">
                        Responsible now: {presentation.actor}
                      </div>
                    </div>
                    <span className={`badge status-badge ${statusBadgeClass(caseSummary.status)}`}>
                      {presentation.label}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </DashboardPanel>
  );
}
