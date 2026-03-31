import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ShellLayout from '../../layout/ShellLayout';
import DashboardPanel from '../../lib/components/DashboardPanel';
import { adminApi } from '../../lib/api/admin';
import type { AdminDashboardData, DashboardActionItem } from '../../lib/types/workflow';
import { formatStatus, statusBadgeClass } from '../../lib/workflowUi';

const EMPTY_DASHBOARD: AdminDashboardData = {
  workflowProgressPercent: 0,
  activeCaseCount: 0,
  registrationQueueCount: 0,
  submissionReviewQueueCount: 0,
  clearanceQueueCount: 0,
  publishingQueueCount: 0,
  needsActionNow: [],
  stageDistribution: [],
  recentActivity: [],
};

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<AdminDashboardData>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        setDashboard(await adminApi.dashboard());
      } catch (err) {
        setDashboard(EMPTY_DASHBOARD);
        setError(err instanceof Error ? err.message : 'Failed to load admin dashboard.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const maxStageCount = useMemo(
    () => Math.max(...dashboard.stageDistribution.map((item) => item.count), 1),
    [dashboard.stageDistribution]
  );

  const queueCards = [
    {
      title: 'Registration Queue',
      value: dashboard.registrationQueueCount,
      detail: 'Pending registration verifications',
      onClick: () => navigate('/admin/registration-approvals'),
    },
    {
      title: 'Submission Review Queue',
      value: dashboard.submissionReviewQueueCount,
      detail: 'Cases awaiting library checklist review',
      onClick: () => navigate('/admin/review'),
    },
    {
      title: 'Clearance Queue',
      value: dashboard.clearanceQueueCount,
      detail: 'Submitted clearance forms awaiting review',
      onClick: () => navigate('/admin/clearance'),
    },
    {
      title: 'Publishing Queue',
      value: dashboard.publishingQueueCount,
      detail: 'Cases ready for repository release',
      onClick: () => navigate('/admin/publish'),
    },
  ];

  return (
    <ShellLayout title="Admin Dashboard" subtitle="Library administration overview for registration, review, clearance, and publishing">
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="su-dashboard-grid su-dashboard-grid-5 mb-4">
        <DashboardPanel title="Workflow Progress">
          <div className="su-dashboard-progress-value">{loading ? '—%' : `${dashboard.workflowProgressPercent}%`}</div>
          <div className="su-dashboard-progress-bar" aria-hidden="true">
            <div className="su-dashboard-progress-fill" style={{ width: `${dashboard.workflowProgressPercent}%` }} />
          </div>
          <p className="su-dashboard-support mb-0">
            {loading
              ? 'Loading dashboard data.'
              : dashboard.activeCaseCount > 0
                ? 'Based on active repository workflow cases'
                : 'No active repository workflow cases.'}
          </p>
        </DashboardPanel>

        {queueCards.map((card) => (
          <DashboardPanel key={card.title} title={card.title} className="su-card-clickable" bodyClassName="justify-content-between">
            <button type="button" className="su-dashboard-panel-button" onClick={card.onClick}>
              <div className="su-dashboard-progress-value">{loading ? '—' : card.value}</div>
              <p className="su-dashboard-support mb-0">{card.detail}</p>
            </button>
          </DashboardPanel>
        ))}
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-4 d-flex">
          <DashboardPanel title="Needs Action Now" className="w-100">
            {loading ? (
              <p className="su-dashboard-empty-copy mb-0">Loading dashboard data.</p>
            ) : dashboard.needsActionNow.length === 0 ? (
              <p className="su-dashboard-empty-copy mb-0">No urgent queue items right now.</p>
            ) : (
              <div className="su-dashboard-list">
                {dashboard.needsActionNow.map((item) => (
                  <button
                    className="su-dashboard-item-button"
                    type="button"
                    key={`${item.queueKey}-${item.caseId}`}
                    onClick={() => navigate(resolveAdminQueuePath(item))}
                  >
                    <div className="su-dashboard-list-item">
                      <div className="d-flex justify-content-between gap-2 align-items-start">
                        <div className="min-w-0">
                          <div className="su-dashboard-item-title su-text-truncate">{item.title}</div>
                          <div className="su-dashboard-item-support">{item.detail}</div>
                          <div className="su-dashboard-item-meta">
                            {item.queueLabel}
                            {item.updatedAt ? ` • Updated ${new Date(item.updatedAt).toLocaleString()}` : ''}
                          </div>
                        </div>
                        <span className={`badge status-badge ${statusBadgeClass(item.status)}`}>
                          {formatStatus(item.status)}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </DashboardPanel>
        </div>

        <div className="col-12 col-xl-4 d-flex">
          <DashboardPanel title="Stage Distribution" className="w-100">
            {loading ? (
              <p className="su-dashboard-empty-copy mb-0">Loading dashboard data.</p>
            ) : dashboard.stageDistribution.length === 0 ? (
              <p className="su-dashboard-empty-copy mb-0">No workflow cases available.</p>
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

        <div className="col-12 col-xl-4 d-flex">
          <DashboardPanel title="Recent Workflow Activity" className="w-100">
            {loading ? (
              <p className="su-dashboard-empty-copy mb-0">Loading dashboard data.</p>
            ) : dashboard.recentActivity.length === 0 ? (
              <p className="su-dashboard-empty-copy mb-0">No recent workflow activity.</p>
            ) : (
              <div className="su-dashboard-list">
                {dashboard.recentActivity.map((item) => (
                  <div className="su-dashboard-list-item" key={`${item.caseId}-${item.occurredAt ?? item.detail}`}>
                    <div className="d-flex justify-content-between gap-2 align-items-start">
                      <div className="min-w-0">
                        <div className="su-dashboard-item-title su-text-truncate">{item.title}</div>
                        <div className="su-dashboard-item-support">{item.detail}</div>
                        <div className="su-dashboard-item-meta">
                          {item.occurredAt ? new Date(item.occurredAt).toLocaleString() : 'N/A'}
                        </div>
                      </div>
                      <span className={`badge status-badge ${statusBadgeClass(item.status)}`}>
                        {formatStatus(item.status)}
                      </span>
                    </div>
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

function resolveAdminQueuePath(item: DashboardActionItem): string {
  switch (item.queueKey) {
    case 'registration':
      return '/admin/registration-approvals';
    case 'review':
      return '/admin/review';
    case 'clearance':
      return '/admin/clearance';
    case 'publishing':
      return '/admin/publish';
  }
}
