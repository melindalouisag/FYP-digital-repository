import { useMemo, useState } from 'react';
import { getPublicationTypeLabel } from '@/calendar/calendarUtils';
import DashboardPanel from '@/shared/ui/DashboardPanel';
import StatusBadge from '@/shared/ui/StatusBadge';
import { resolveStudentCaseNavigation } from '@/student/caseNavigation';
import type { CaseSummary } from '@/types/workflow';
import { getWorkflowStatusDescription } from '@/utils/workflowUi';

interface StudentPublicationSummaryProps {
  loading: boolean;
  orderedCases: CaseSummary[];
  onNavigate: (path: string) => void;
}

export function StudentPublicationSummary({
  loading,
  orderedCases,
  onNavigate,
}: StudentPublicationSummaryProps) {
  const publicationGroups = useMemo(
    () => orderedCases.reduce<Array<{
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
    }, []),
    [orderedCases]
  );
  const groupTypes = useMemo(
    () => publicationGroups.map((group) => group.type),
    [publicationGroups]
  );
  const [selectedType, setSelectedType] = useState<CaseSummary['type'] | ''>('');
  const activeType = useMemo(() => {
    if (selectedType && groupTypes.includes(selectedType)) {
      return selectedType;
    }
    return groupTypes[0] ?? '';
  }, [groupTypes, selectedType]);
  const selectedGroup = useMemo(
    () => publicationGroups.find((group) => group.type === activeType) ?? null,
    [activeType, publicationGroups]
  );
  const publicationFilter = publicationGroups.length > 0 ? (
    <label className="su-publication-filter-wrap">
      <span className="su-publication-filter-label">Type</span>
      <select
        className="form-select form-select-sm su-publication-filter-select"
        value={activeType}
        onChange={(event) => setSelectedType(event.target.value as CaseSummary['type'])}
        aria-label="Filter publications by type"
      >
        {publicationGroups.map((group) => (
          <option key={group.type} value={group.type}>
            {getPublicationTypeLabel(group.type)}
          </option>
        ))}
      </select>
    </label>
  ) : null;

  return (
    <DashboardPanel
      title="My Publications"
      actions={publicationFilter}
      className="su-dashboard-panel-auto-height"
      bodyClassName="su-dashboard-panel-body-auto-height"
    >
      {loading ? (
        <p className="su-dashboard-empty-copy mb-0">Loading dashboard data.</p>
      ) : publicationGroups.length === 0 ? (
        <p className="su-dashboard-empty-copy mb-0">No publications yet.</p>
      ) : selectedGroup ? (
        <div className="su-publication-list-shell">
          <div className="su-publication-list">
            {selectedGroup.items.map((item) => {
              const navigationTarget = resolveStudentCaseNavigation(item, 'dashboard');
              const lastUpdated = item.updatedAt ?? item.createdAt;

              return (
                <button
                  key={item.id}
                  type="button"
                  className="su-publication-record su-publication-record-card"
                  onClick={() => onNavigate(navigationTarget.path)}
                >
                  <div className="su-publication-record-header">
                    <div className="min-w-0">
                      <div className="su-publication-record-title">{item.title || 'Untitled publication'}</div>
                      <div className="su-publication-record-support">{getWorkflowStatusDescription(item.status)}</div>
                      <div className="su-publication-record-meta">
                        {lastUpdated ? `Updated ${new Date(lastUpdated).toLocaleString()}` : 'No recent updates'}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </DashboardPanel>
  );
}
