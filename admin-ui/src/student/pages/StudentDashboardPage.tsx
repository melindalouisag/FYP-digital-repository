import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ShellLayout from '../../ShellLayout';
import DashboardPanel from '../../lib/components/DashboardPanel';
import { canUploadSubmission, formatStatus } from '../../lib/workflowUi';
import { StudentCaseListTable } from '../dashboard/StudentCaseListTable';
import { StudentNextActionPanel } from '../dashboard/StudentNextActionPanel';
import { StudentProgressOverview } from '../dashboard/StudentProgressOverview';
import { useStudentDashboard } from '../dashboard/useStudentDashboard';

export default function StudentDashboardPage() {
  const navigate = useNavigate();
  const dashboard = useStudentDashboard();
  const uploadReadyCount = useMemo(
    () => dashboard.cases.filter((item) => canUploadSubmission(item.status)).length,
    [dashboard.cases]
  );
  const latestPublication = dashboard.orderedCases[0] ?? null;

  return (
    <ShellLayout title="Student Dashboard" subtitle="Monitor your recent progress">
      {dashboard.error && <div className="alert alert-danger">{dashboard.error}</div>}

      <div className="su-dashboard-grid su-dashboard-grid-3 mb-4">
        <StudentProgressOverview
          loading={dashboard.loading}
          progressPercent={dashboard.progressPercent}
          progressSummary={dashboard.progressSummary}
        />
        <StudentNextActionPanel
          loading={dashboard.loading}
          nextStepCases={dashboard.nextStepCases}
          onNavigate={navigate}
        />
        <DashboardPanel title="Submission Status" className="su-card-clickable" bodyClassName="justify-content-between">
          <button type="button" className="su-dashboard-panel-button" onClick={() => navigate('/student/submissions')}>
            <div className="su-dashboard-progress-value">{dashboard.loading ? '—' : uploadReadyCount}</div>
            <p className="su-dashboard-support mb-0">
              {dashboard.loading
                ? 'Loading dashboard data.'
                : uploadReadyCount > 0
                  ? 'Ready for upload or revision.'
                  : 'No uploads are needed right now.'}
            </p>
            <div className="su-dashboard-item-meta">
              {dashboard.loading
                ? 'Checking current publication activity.'
                : latestPublication
                  ? `Latest update: ${formatStatus(latestPublication.status)}`
                  : 'Open the Submission page to review your current progress.'}
            </div>
          </button>
        </DashboardPanel>
      </div>

      <StudentCaseListTable
        loading={dashboard.loading}
        orderedCases={dashboard.orderedCases}
        onNavigate={navigate}
      />
    </ShellLayout>
  );
}
