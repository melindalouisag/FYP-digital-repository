import DashboardPanel from '../../lib/components/DashboardPanel';

interface StudentProgressOverviewProps {
  loading: boolean;
  progressPercent: number;
  progressSummary: string;
}

export function StudentProgressOverview({
  loading,
  progressPercent,
  progressSummary,
}: StudentProgressOverviewProps) {
  return (
    <DashboardPanel title="Overall Progress">
      <div className="su-dashboard-progress-value">{loading ? '—%' : `${progressPercent}%`}</div>
      <div className="su-dashboard-progress-bar" aria-hidden="true">
        <div className="su-dashboard-progress-fill" style={{ width: `${progressPercent}%` }} />
      </div>
      <p className="su-dashboard-support mb-0">
        {loading ? 'Loading dashboard data.' : progressSummary}
      </p>
    </DashboardPanel>
  );
}
