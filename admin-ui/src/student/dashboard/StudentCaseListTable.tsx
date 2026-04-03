import { useMemo, useState } from 'react';
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
  const publicationGroups = useMemo(() => orderedCases.reduce<Array<{
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
  }, []), [orderedCases]);
  const groupTypes = useMemo(
    () => publicationGroups.map((group) => group.type),
    [publicationGroups]
  );
  const [expandedTypes, setExpandedTypes] = useState<CaseSummary['type'][] | null>(null);
  const activeExpandedTypes = useMemo(() => {
    if (expandedTypes === null) {
      return groupTypes.length > 0 ? [groupTypes[0]] : [];
    }
    return expandedTypes.filter((type) => groupTypes.includes(type));
  }, [expandedTypes, groupTypes]);

  const toggleGroup = (type: CaseSummary['type']) => {
    setExpandedTypes((current) => {
      const visibleExpanded = current === null
        ? (groupTypes.length > 0 ? [groupTypes[0]] : [])
        : current.filter((value) => groupTypes.includes(value));

      return visibleExpanded.includes(type)
        ? visibleExpanded.filter((value) => value !== type)
        : [...visibleExpanded, type];
    });
  };

  return (
    <DashboardPanel title="My Publications" className="su-dashboard-panel-auto-height" bodyClassName="su-dashboard-panel-body-auto-height">
      {loading ? (
        <p className="su-dashboard-empty-copy mb-0">Loading dashboard data.</p>
      ) : publicationGroups.length === 0 ? (
        <p className="su-dashboard-empty-copy mb-0">No publications yet.</p>
      ) : (
        <div className="su-publication-accordion">
          {publicationGroups.map((group) => {
            const latestItem = group.items[0];
            const isExpanded = activeExpandedTypes.includes(group.type);
            return (
              <section
                key={group.type}
                className={`su-publication-group${isExpanded ? ' is-open' : ''}`}
              >
                <button
                  type="button"
                  className="su-publication-group-trigger"
                  onClick={() => toggleGroup(group.type)}
                  aria-expanded={isExpanded}
                >
                  <div className="min-w-0">
                    <div className="su-publication-group-title-row">
                      <div className="su-publication-group-title">{getPublicationTypeLabel(group.type)}</div>
                      <div className="su-publication-group-meta">
                        {group.items.length === 1 ? '1 record' : `${group.items.length} records`}
                      </div>
                    </div>
                    <div className="su-publication-group-support">
                      Latest activity: {formatStatus(latestItem.status)}
                    </div>
                  </div>
                  <span className={`su-publication-group-chevron${isExpanded ? ' is-open' : ''}`} aria-hidden="true">
                    ⌄
                  </span>
                </button>

                {isExpanded ? (
                  <div className="su-publication-group-content">
                    {group.items.map((item) => {
                      const navigationTarget = resolveStudentCaseNavigation(item, 'dashboard');
                      const lastUpdated = item.updatedAt ?? item.createdAt;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className="su-publication-record"
                          onClick={() => onNavigate(navigationTarget.path)}
                        >
                          <div className="su-publication-record-header">
                            <div className="min-w-0">
                              <div className="su-publication-record-title">{item.title || 'Untitled publication'}</div>
                              <div className="su-publication-record-support">{getWorkflowNextAction(item.status)}</div>
                              <div className="su-publication-record-meta">
                                {lastUpdated ? `Updated ${new Date(lastUpdated).toLocaleString()}` : 'No recent updates'}
                              </div>
                            </div>
                            <span className={`badge status-badge ${statusBadgeClass(item.status)}`}>
                              {formatStatus(item.status)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </DashboardPanel>
  );
}
