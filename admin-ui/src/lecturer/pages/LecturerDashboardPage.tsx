import { useEffect, useMemo, useState } from 'react';
import { lecturerApi } from '@/services/api/lecturer';
import DashboardPanel from '@/shared/ui/DashboardPanel';
import DashboardProgressRingCard from '@/shared/ui/DashboardProgressRingCard';
import StatusBadge from '@/shared/ui/StatusBadge';
import WorkflowStageOverviewCard from '@/shared/ui/WorkflowStageOverviewCard';
import type { DashboardActivityItem, LecturerDashboardData } from '@/types/workflow';
import ShellLayout from '../../ShellLayout';

const EMPTY_DASHBOARD: LecturerDashboardData = {
  supervisionProgressPercent: 0,
  activeSupervisedCaseCount: 0,
  publishedStudentCount: 0,
  totalStudentCount: 0,
  registrationApprovalCount: 0,
  submissionReviewCount: 0,
  studentCount: 0,
  revisionRequiredCount: 0,
  stageDistribution: [],
  recentActivity: [],
};

export default function LecturerDashboardPage() {
  const [dashboard, setDashboard] = useState<LecturerDashboardData>(EMPTY_DASHBOARD);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        setDashboard(await lecturerApi.dashboard(year));
      } catch (err) {
        setDashboard(EMPTY_DASHBOARD);
        setError(err instanceof Error ? err.message : 'Failed to load lecturer dashboard.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [year]);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1];
  }, []);
  const completionPercent = dashboard.totalStudentCount > 0
    ? Math.round((dashboard.publishedStudentCount / dashboard.totalStudentCount) * 100)
    : 0;
  const completionSecondaryText = dashboard.totalStudentCount > 0
    ? `${dashboard.activeSupervisedCaseCount} active supervised publication${dashboard.activeSupervisedCaseCount === 1 ? '' : 's'}`
    : 'No supervised publications yet.';
  const visibleRecentActivity = useMemo(
    () => dashboard.recentActivity.slice(0, 4),
    [dashboard.recentActivity]
  );

  return (
    <ShellLayout
      title="Lecturer Dashboard"
      pageClassName="su-page-shell-dashboard"
      sidebarBadges={{
        '/lecturer/approvals': dashboard.registrationApprovalCount,
        '/lecturer/review': dashboard.submissionReviewCount,
      }}
    >
      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="su-dashboard-content">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
          <label className="d-flex align-items-center gap-2">
            <span className="su-dashboard-toolbar-label">Academic Year</span>
            <select
              className="form-select form-select-sm su-dashboard-toolbar-select"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            >
              {yearOptions.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="su-dashboard-grid su-dashboard-grid-3 su-dashboard-top-row su-lecturer-dashboard-top-row">
          <DashboardProgressRingCard
            title="Publication Completion"
            className="su-lecturer-completion-card"
            progressPercent={completionPercent}
            loading={loading}
            primaryText={`${dashboard.publishedStudentCount} of ${dashboard.totalStudentCount} students published`}
            secondaryText={completionSecondaryText}
          />
          <WorkflowStageOverviewCard
            loading={loading}
            stageDistribution={dashboard.stageDistribution}
            emptyText="No supervised publications available for this academic year."
          />
          <DashboardPanel title="Recent Student Activity" className="w-100">
            {loading ? (
              <p className="su-dashboard-empty-copy mb-0">Loading dashboard data.</p>
            ) : visibleRecentActivity.length === 0 ? (
              <p className="su-dashboard-empty-copy mb-0">No recent student activity.</p>
            ) : (
              <div className="su-dashboard-list">
                {visibleRecentActivity.map((item) => (
                  <div className="su-dashboard-list-item" key={`${item.caseId}-${item.occurredAt ?? item.detail}`}>
                    <LecturerActivityItem item={item} />
                  </div>
                ))}
              </div>
            )}
          </DashboardPanel>
        </div>
      </div>
    </ShellLayout>
  );
}

function LecturerActivityItem({ item }: { item: DashboardActivityItem }) {
  const primaryLabel = item.subtitle || item.title;
  const secondaryLabel = item.subtitle ? item.title : item.detail;
  const metadataText = [
    item.subtitle ? item.detail : null,
    item.occurredAt ? new Date(item.occurredAt).toLocaleString() : 'No recent updates',
  ].filter(Boolean).join(' • ');

  return (
    <div className="d-flex justify-content-between gap-3 align-items-start">
      <div className="min-w-0 su-dashboard-activity-copy">
        <div className="su-dashboard-activity-primary">{primaryLabel}</div>
        <div className="su-dashboard-activity-secondary-row">
          <div className="su-dashboard-activity-secondary">{secondaryLabel}</div>
          {metadataText ? <div className="su-dashboard-activity-meta-inline">{metadataText}</div> : null}
        </div>
      </div>
      <div className="flex-shrink-0">
        <StatusBadge status={item.status} />
      </div>
    </div>
  );
}
