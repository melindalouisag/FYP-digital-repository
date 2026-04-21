import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { lecturerApi } from '@/services/api/lecturer';
import EmptyState from '@/shared/ui/EmptyState';
import StatusBadge from '@/shared/ui/StatusBadge';
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

  const totalCases = dashboard.stageDistribution.reduce((sum, item) => sum + item.count, 0);
  const pendingActions = dashboard.registrationApprovalCount + dashboard.submissionReviewCount;
  const completedCases = dashboard.stageDistribution.find((item) => item.label === 'Published')?.count ?? 0;

  return (
    <ShellLayout
      title="Dashboard"
      subtitle="Academic workflow overview for registration approvals, submission review, and supervised student progress."
      sidebarBadges={{
        '/lecturer/approvals': dashboard.registrationApprovalCount,
        '/lecturer/review': dashboard.submissionReviewCount,
      }}
    >
      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="su-filter-bar mb-4" style={{ gridTemplateColumns: 'minmax(0, 220px)' }}>
        <select className="form-select" value={year} onChange={(event) => setYear(Number(event.target.value))}>
          {yearOptions.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </div>

      <div className="su-summary-grid mb-4">
        <SummaryCard label="Total Cases" value={totalCases} />
        <SummaryCard label="Pending Actions" value={pendingActions} />
        <SummaryCard label="Completed" value={completedCases} />
        <SummaryCard label="Revision Required" value={dashboard.revisionRequiredCount} />
      </div>

      <section className="su-section">
        <div className="su-section-header">
          <div>
            <h2 className="su-section-title mb-1">Action Required</h2>
            <p className="su-secondary-text mb-0">Open the queue that currently needs lecturer attention.</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="su-spinner mx-auto mb-3" />
            <div className="text-muted">Loading dashboard...</div>
          </div>
        ) : (
          <div className="su-table-shell">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Queue</th>
                  <th>Cases</th>
                  <th>Description</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                <QueueRow
                  label="Registration Approval"
                  count={dashboard.registrationApprovalCount}
                  description="Submitted registrations waiting for lecturer approval."
                  onOpen={() => navigate('/lecturer/approvals')}
                />
                <QueueRow
                  label="Submission Review"
                  count={dashboard.submissionReviewCount}
                  description="Student submissions waiting for review or forwarding."
                  onOpen={() => navigate('/lecturer/review')}
                />
                <QueueRow
                  label="My Students"
                  count={dashboard.studentCount}
                  description="Open the supervised student list and review publication progress."
                  onOpen={() => navigate('/lecturer/students')}
                />
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="su-section">
        <div className="su-section-header">
          <div>
            <h2 className="su-section-title mb-1">Recent Activity</h2>
            <p className="su-secondary-text mb-0">Latest student workflow changes across the selected academic year.</p>
          </div>
        </div>

        {loading ? (
          <div className="text-muted">Loading recent activity...</div>
        ) : dashboard.recentActivity.length === 0 ? (
          <EmptyState
            title="No recent activity"
            description="Recent submission and registration events will appear here after students move through the workflow."
          />
        ) : (
          <div className="su-table-shell">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Publication</th>
                  <th>Student</th>
                  <th>Status</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recentActivity.map((item) => (
                  <ActivityRow key={`${item.caseId}-${item.occurredAt ?? item.detail}`} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </ShellLayout>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="su-summary-card">
      <div className="su-secondary-text">{label}</div>
      <div className="su-summary-value">{value}</div>
    </div>
  );
}

function QueueRow({
  label,
  count,
  description,
  onOpen,
}: {
  label: string;
  count: number;
  description: string;
  onOpen: () => void;
}) {
  return (
    <tr className="su-table-row-clickable" tabIndex={0} onClick={onOpen} onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onOpen();
      }
    }}>
      <td className="fw-semibold">{label}</td>
      <td>{count}</td>
      <td>{description}</td>
      <td className="text-end">
        <button type="button" className="btn btn-outline-secondary" onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}>
          Open
        </button>
      </td>
    </tr>
  );
}

function ActivityRow({ item }: { item: DashboardActivityItem }) {
  return (
    <tr>
      <td>
        <div className="su-table-title">{item.title}</div>
        <div className="su-secondary-text">{item.detail}</div>
      </td>
      <td>{item.subtitle || 'Not available'}</td>
      <td><StatusBadge status={item.status} /></td>
      <td>{item.occurredAt ? new Date(item.occurredAt).toLocaleString() : 'Not available'}</td>
    </tr>
  );
}
