import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ShellLayout from '../../ShellLayout';
import DashboardPanel from '../../lib/components/DashboardPanel';
import DashboardProgressRingCard from '../../lib/components/DashboardProgressRingCard';
import DashboardMetricCard from '../../lib/components/DashboardMetricCard';
import { lecturerApi } from '../../lib/api/lecturer';
import { lecturerSidebarIcons } from '../../lib/portalIcons';
import type { DashboardActivityItem, LecturerDashboardData } from '../../lib/workflowTypes';
import { formatStatus, statusBadgeClass } from '../../lib/workflowUi';

const EMPTY_DASHBOARD: LecturerDashboardData = {
  supervisionProgressPercent: 0,
  activeSupervisedCaseCount: 0,
  publishedStudentCount: 0,
  totalStudentCount: 0,
  registrationApprovalCount: 0,
  submissionReviewCount: 0,
  studentCount: 0,
  stageDistribution: [],
  recentActivity: [],
};

interface DashboardMetricSummaryCard {
  title: string;
  value: number | string;
  iconSrc: string;
  detail?: string;
  onClick?: () => void;
}

export default function LecturerDashboardPage() {
  const navigate = useNavigate();
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
  const maxStageCount = useMemo(
    () => Math.max(...dashboard.stageDistribution.map((item) => item.count), 1),
    [dashboard.stageDistribution]
  );
  const completionPercent = useMemo(() => (
    dashboard.totalStudentCount > 0
      ? Math.round((dashboard.publishedStudentCount / dashboard.totalStudentCount) * 100)
      : 0
  ), [dashboard.publishedStudentCount, dashboard.totalStudentCount]);
  const completionSecondaryText = dashboard.totalStudentCount > 0
    ? `${dashboard.activeSupervisedCaseCount} active supervised publication${dashboard.activeSupervisedCaseCount === 1 ? '' : 's'}`
    : 'No supervised publications yet.';

  const summaryCards: DashboardMetricSummaryCard[] = [
    {
      title: 'Registration Approvals',
      value: dashboard.registrationApprovalCount,
      iconSrc: lecturerSidebarIcons.approvals,
      onClick: () => navigate('/lecturer/approvals'),
    },
    {
      title: 'Submission Review',
      value: dashboard.submissionReviewCount,
      iconSrc: lecturerSidebarIcons.review,
      onClick: () => navigate('/lecturer/review'),
    },
    {
      title: 'My Students',
      value: dashboard.studentCount,
      iconSrc: lecturerSidebarIcons.students,
      onClick: () => navigate('/lecturer/students'),
    },
  ];

  return (
    <ShellLayout title="Lecturer Dashboard" subtitle="Monitor registration approvals, submission review, and supervised publication activity">
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="d-flex flex-wrap align-items-center gap-2 mb-4">
        <label className="form-label mb-0 fw-semibold small">Academic Year:</label>
        <select
          className="form-select form-select-sm"
          style={{ width: 120, borderRadius: '999px' }}
          value={year}
          onChange={(event) => setYear(Number(event.target.value))}
        >
          {yearOptions.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </div>

      <div className="su-dashboard-grid su-dashboard-grid-4 mb-4">
        <DashboardProgressRingCard
          title="Publication Completion"
          progressPercent={completionPercent}
          loading={loading}
          primaryText={`${dashboard.publishedStudentCount} of ${dashboard.totalStudentCount} students published`}
          secondaryText={completionSecondaryText}
        />
        {summaryCards.map((card) => (
          <DashboardMetricCard
            key={card.title}
            iconSrc={card.iconSrc}
            iconBackground="rgba(11, 117, 132, 0.10)"
            label={card.title}
            value={loading ? '—' : card.value}
            description={card.detail}
            onClick={card.onClick}
          />
        ))}
      </div>
      <div className="row g-3">
        <div className="col-12 col-xl-5 d-flex">
          <DashboardPanel title="Stage Distribution" className="w-100">
            {loading ? (
              <p className="su-dashboard-empty-copy mb-0">Loading dashboard data.</p>
            ) : dashboard.stageDistribution.length === 0 ? (
              <p className="su-dashboard-empty-copy mb-0">No supervised publications available for this view.</p>
            ) : (
              <div className="su-dashboard-bars">
                {dashboard.stageDistribution.map((item) => (
                  <div className="su-dashboard-bar-row" key={item.label}>
                    <div className="d-flex justify-content-between gap-2 mb-2">
                      <span className="su-dashboard-bar-label">{item.label}</span>
                      <span className="su-dashboard-bar-value">{item.count}</span>
                    </div>
                    <div className="su-dashboard-bar-track" aria-hidden="true">
                      <div
                        className="su-dashboard-bar-fill"
                        style={{ width: `${maxStageCount === 0 ? 0 : (item.count / maxStageCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashboardPanel>
        </div>

        <div className="col-12 col-xl-7 d-flex">
          <DashboardPanel title="Recent Student Activity" className="w-100">
            {loading ? (
              <p className="su-dashboard-empty-copy mb-0">Loading dashboard data.</p>
            ) : dashboard.recentActivity.length === 0 ? (
              <p className="su-dashboard-empty-copy mb-0">No recent student activity.</p>
            ) : (
              <div className="su-dashboard-list">
                {dashboard.recentActivity.map((item) => (
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
  return (
    <div className="d-flex justify-content-between gap-2 align-items-start">
      <div className="min-w-0">
        <div className="su-dashboard-item-title su-text-truncate">{item.title}</div>
        <div className="su-dashboard-item-support">{item.detail}</div>
        <div className="su-dashboard-item-meta">
          {item.subtitle ? `${item.subtitle} • ` : ''}
          {item.occurredAt ? new Date(item.occurredAt).toLocaleString() : 'N/A'}
        </div>
      </div>
      <span className={`badge status-badge ${statusBadgeClass(item.status)}`}>
        {formatStatus(item.status)}
      </span>
    </div>
  );
}
