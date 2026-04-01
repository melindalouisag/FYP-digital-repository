import DashboardPanel from '../../lib/components/DashboardPanel';
import { formatStatus, getWorkflowNextAction, statusBadgeClass } from '../../lib/workflowUi';
import type { CaseSummary } from '../../lib/workflowTypes';
import { isNavigationActivationKey, resolveStudentCaseNavigation } from '../caseNavigation';

interface StudentCaseListTableProps {
  loading: boolean;
  orderedCases: CaseSummary[];
  onNavigate: (path: string) => void;
}

export function StudentCaseListTable({
  loading,
  orderedCases,
  onNavigate,
}: StudentCaseListTableProps) {
  return (
    <DashboardPanel title="Case List" className="su-dashboard-panel-auto-height" bodyClassName="su-dashboard-panel-body-auto-height">
      {loading ? (
        <p className="su-dashboard-empty-copy mb-0">Loading dashboard data.</p>
      ) : orderedCases.length === 0 ? (
        <p className="su-dashboard-empty-copy mb-0">No cases yet.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Recommended next step</th>
              </tr>
            </thead>
            <tbody>
              {orderedCases.map((caseSummary) => {
                const navigationTarget = resolveStudentCaseNavigation(caseSummary, 'dashboard');
                return (
                  <tr
                    key={caseSummary.id}
                    className="su-table-row-clickable"
                    tabIndex={0}
                    aria-label={`${navigationTarget.label}: ${caseSummary.title || 'Untitled Publication'}`}
                    onClick={() => onNavigate(navigationTarget.path)}
                    onKeyDown={(event) => {
                      if (!isNavigationActivationKey(event)) return;
                      event.preventDefault();
                      onNavigate(navigationTarget.path);
                    }}
                  >
                    <td>
                      <div className="fw-semibold">{caseSummary.title || 'Untitled Publication'}</div>
                    </td>
                    <td>
                      <span className="badge bg-dark-subtle text-dark-emphasis" style={{ borderRadius: '999px' }}>
                        {caseSummary.type}
                      </span>
                    </td>
                    <td>
                      <span className={`badge status-badge ${statusBadgeClass(caseSummary.status)}`}>
                        {formatStatus(caseSummary.status)}
                      </span>
                    </td>
                    <td className="text-muted small">
                      {caseSummary.updatedAt ? new Date(caseSummary.updatedAt).toLocaleString() : 'N/A'}
                    </td>
                    <td>
                      <div className="small fw-semibold text-body-secondary">{getWorkflowNextAction(caseSummary.status)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashboardPanel>
  );
}
