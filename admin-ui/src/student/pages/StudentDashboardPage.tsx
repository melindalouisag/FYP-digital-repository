import { useNavigate } from 'react-router-dom';
import ShellLayout from '../../ShellLayout';
import { StudentNextActionPanel } from '../dashboard/StudentNextActionPanel';
import { StudentProgressOverview } from '../dashboard/StudentProgressOverview';
import { StudentPublicationSummary } from '../dashboard/StudentPublicationSummary';
import { useStudentDashboard } from '../useStudentDashboard';

export default function StudentDashboardPage() {
  const navigate = useNavigate();
  const dashboard = useStudentDashboard();

  return (
    <ShellLayout
      title="Student Dashboard"
      pageClassName="su-page-shell-dashboard"
    >
      {dashboard.error ? <div className="alert alert-danger">{dashboard.error}</div> : null}

      <div className="su-dashboard-content">
        <div className="su-dashboard-grid su-dashboard-grid-2 su-dashboard-top-row su-student-dashboard-top-row">
          <StudentProgressOverview
            loading={dashboard.loading}
            orderedCases={dashboard.orderedCases}
          />
          <StudentNextActionPanel
            loading={dashboard.loading}
            nextStepCases={dashboard.nextStepCases}
            onNavigate={navigate}
          />
        </div>

        <StudentPublicationSummary
          loading={dashboard.loading}
          orderedCases={dashboard.orderedCases}
          onNavigate={navigate}
        />
      </div>
    </ShellLayout>
  );
}
