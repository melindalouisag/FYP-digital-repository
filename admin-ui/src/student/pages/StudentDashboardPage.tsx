import { CalendarDashboardPanel } from '../../calendar/CalendarDashboardPanel';
import { useNavigate } from 'react-router-dom';
import ShellLayout from '../../ShellLayout';
import { StudentCaseListTable } from '../dashboard/StudentCaseListTable';
import { StudentNextActionPanel } from '../dashboard/StudentNextActionPanel';
import { StudentProgressOverview } from '../dashboard/StudentProgressOverview';
import { useStudentDashboard } from '../dashboard/useStudentDashboard';

export default function StudentDashboardPage() {
  const navigate = useNavigate();
  const dashboard = useStudentDashboard();

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
        <CalendarDashboardPanel navigatePath="/student/calendar" hideHeader />
      </div>

      <StudentCaseListTable
        loading={dashboard.loading}
        orderedCases={dashboard.orderedCases}
        onNavigate={navigate}
      />
    </ShellLayout>
  );
}
