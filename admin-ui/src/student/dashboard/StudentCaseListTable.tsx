import DashboardPanel from '../../lib/components/DashboardPanel';
import { getPublicationTypeLabel } from '../../calendar/calendarUtils';
import { formatStatus, getWorkflowNextAction, statusBadgeClass } from '../../lib/workflowUi';
import type { CaseSummary } from '../../lib/workflowTypes';
import { resolveStudentCaseNavigation } from '../caseNavigation';

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
  const publicationGroups = orderedCases.reduce<Array<{
    type: CaseSummary['type'];
    items: CaseSummary[];
  }>>((groups, caseSummary) => {
    const existingGroup = groups.find((group) => group.type === caseSummary.type);
    if (existingGroup) {
      existingGroup.items.push(caseSummary);
      return groups;
    }
    groups.push({ type: caseSummary.type, items: [caseSummary] });
    return groups;
  }, []);

  return (
    <DashboardPanel title="My Publications" className="su-dashboard-panel-auto-height" bodyClassName="su-dashboard-panel-body-auto-height">
      {loading ? (
        <p className="su-dashboard-empty-copy mb-0">Loading dashboard data.</p>
      ) : publicationGroups.length === 0 ? (
        <p className="su-dashboard-empty-copy mb-0">No publications yet.</p>
      ) : (
        <div className="su-publication-card-grid">
          {publicationGroups.map((group) => {
            const latestItem = group.items[0];
            const navigationTarget = resolveStudentCaseNavigation(latestItem, 'dashboard');
            const lastUpdated = latestItem.updatedAt ?? latestItem.createdAt;
            return (
              <button
                key={group.type}
                type="button"
                className="su-publication-card"
                onClick={() => onNavigate(navigationTarget.path)}
              >
                <div className="d-flex justify-content-between align-items-start gap-3">
                  <div>
                    <div className="su-publication-card-title">{getPublicationTypeLabel(group.type)}</div>
                    <div className="su-publication-card-meta">
                      {group.items.length === 1 ? '1 record' : `${group.items.length} records`}
                    </div>
                  </div>
                  <span className={`badge status-badge ${statusBadgeClass(latestItem.status)}`}>
                    {formatStatus(latestItem.status)}
                  </span>
                </div>
                <div className="su-publication-card-detail">
                  {latestItem.title || 'Untitled publication'}
                </div>
                <div className="su-publication-card-support">
                  {getWorkflowNextAction(latestItem.status)}
                </div>
                <div className="su-publication-card-meta">
                  {lastUpdated ? `Updated ${new Date(lastUpdated).toLocaleString()}` : 'No recent updates'}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </DashboardPanel>
  );
}
