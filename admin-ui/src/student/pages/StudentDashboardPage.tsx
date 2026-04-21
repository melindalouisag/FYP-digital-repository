import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import EmptyState from '@/shared/ui/EmptyState';
import StatusBadge from '@/shared/ui/StatusBadge';
import type { CaseSummary } from '@/types/workflow';
import { formatStatus, getWorkflowNextAction } from '@/utils/workflowUi';
import ShellLayout from '../../ShellLayout';
import { resolveStudentCaseNavigation } from '../caseNavigation';
import { useStudentDashboard } from '../useStudentDashboard';

export default function StudentDashboardPage() {
  const navigate = useNavigate();
  const dashboard = useStudentDashboard();

  const completedCases = useMemo(() => (
    dashboard.cases.filter((item) => item.status === 'PUBLISHED').length
  ), [dashboard.cases]);
  const revisionRequiredCases = useMemo(() => (
    dashboard.cases.filter((item) => (
      item.status === 'NEEDS_REVISION_SUPERVISOR'
        || item.status === 'NEEDS_REVISION_LIBRARY'
        || item.status === 'REJECTED'
    )).length
  ), [dashboard.cases]);

  return (
    <ShellLayout title="Dashboard" subtitle="Track your publication workflow, open the next required task, and review recent case activity.">
      {dashboard.error ? <div className="alert alert-danger">{dashboard.error}</div> : null}

      <div className="su-summary-grid mb-4">
        <SummaryCard label="Total Cases" value={dashboard.cases.length} />
        <SummaryCard label="Pending Actions" value={dashboard.nextStepCases.length} />
        <SummaryCard label="Completed" value={completedCases} />
        <SummaryCard label="Revision Required" value={revisionRequiredCases} />
      </div>

      <section className="su-section">
        <div className="su-section-header">
          <div>
            <h2 className="su-section-title mb-1">Action Required</h2>
            <p className="su-secondary-text mb-0">Open the workflow item that currently needs your attention.</p>
          </div>
        </div>

        {dashboard.loading ? (
          <div className="text-center py-5">
            <div className="su-spinner mx-auto mb-3" />
            <div className="text-muted">Loading dashboard...</div>
          </div>
        ) : dashboard.nextStepCases.length === 0 ? (
          <EmptyState
            title="No submissions yet"
            description="Start by creating a new submission or registration."
            action={(
              <button type="button" className="btn btn-primary" onClick={() => navigate('/student/registrations')}>
                Register Publication
              </button>
            )}
          />
        ) : (
          <div className="su-table-shell">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Next Step</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.nextStepCases.map((item) => (
                  <CaseRow key={item.id} item={item} onNavigate={navigate} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="su-section">
        <div className="su-section-header">
          <div>
            <h2 className="su-section-title mb-1">Recent Activity</h2>
            <p className="su-secondary-text mb-0">Latest updates across your publication workflow records.</p>
          </div>
        </div>

        {dashboard.loading ? (
          <div className="text-muted">Loading recent activity...</div>
        ) : dashboard.orderedCases.length === 0 ? (
          <EmptyState
            title="No records available"
            description="Your publication activity will appear here after you create a registration."
          />
        ) : (
          <div className="su-table-shell">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Last Updated</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.orderedCases.map((item) => (
                  <CaseActivityRow key={item.id} item={item} onNavigate={navigate} />
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

function CaseRow({
  item,
  onNavigate,
}: {
  item: CaseSummary;
  onNavigate: (path: string) => void;
}) {
  const target = resolveStudentCaseNavigation(item, 'dashboard');
  return (
    <tr className="su-table-row-clickable" tabIndex={0} onClick={() => onNavigate(target.path)} onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onNavigate(target.path);
      }
    }}>
      <td>
        <div className="su-table-title">{item.title || 'Untitled publication'}</div>
        <div className="su-secondary-text">{formatStatus(item.status)}</div>
      </td>
      <td><StatusBadge status={item.status} /></td>
      <td>{getWorkflowNextAction(item.status)}</td>
      <td className="text-end">
        <button type="button" className="btn btn-outline-secondary" onClick={(event) => {
          event.stopPropagation();
          onNavigate(target.path);
        }}>
          Open
        </button>
      </td>
    </tr>
  );
}

function CaseActivityRow({
  item,
  onNavigate,
}: {
  item: CaseSummary;
  onNavigate: (path: string) => void;
}) {
  const target = resolveStudentCaseNavigation(item, 'dashboard');
  const lastUpdated = item.updatedAt ?? item.createdAt;
  return (
    <tr className="su-table-row-clickable" tabIndex={0} onClick={() => onNavigate(target.path)} onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onNavigate(target.path);
      }
    }}>
      <td>
        <div className="su-table-title">{item.title || 'Untitled publication'}</div>
        <div className="su-secondary-text">{getWorkflowNextAction(item.status)}</div>
      </td>
      <td><StatusBadge status={item.status} /></td>
      <td>{lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Not available'}</td>
      <td className="text-end">
        <button type="button" className="btn btn-outline-secondary" onClick={(event) => {
          event.stopPropagation();
          onNavigate(target.path);
        }}>
          Open
        </button>
      </td>
    </tr>
  );
}
