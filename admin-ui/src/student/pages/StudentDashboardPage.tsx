import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ShellLayout from '../../ShellLayout';
import DashboardMetricCard from '../../lib/components/DashboardMetricCard';
import { canUploadSubmission, formatStatus } from '../../lib/workflowUi';
import { studentSidebarIcons } from '../../lib/portalIcons';
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
        />
        <StudentNextActionPanel
          loading={dashboard.loading}
          nextStepCases={dashboard.nextStepCases}
          onNavigate={navigate}
        />
        <DashboardMetricCard
          iconSrc={studentSidebarIcons.submission}
          iconBackground="rgba(11, 117, 132, 0.10)"
          label="Submission Status"
          value={dashboard.loading ? '—' : uploadReadyCount}
          description={dashboard.loading ? undefined : latestPublication ? formatStatus(latestPublication.status) : 'No uploads needed'}
          onClick={() => navigate('/student/submissions')}
        />
      </div>

      <StudentCaseListTable
        loading={dashboard.loading}
        orderedCases={dashboard.orderedCases}
        onNavigate={navigate}
      />
    </ShellLayout>
  );
}
