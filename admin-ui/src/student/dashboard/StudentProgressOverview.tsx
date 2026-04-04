import DashboardMetricCard from '../../lib/components/DashboardMetricCard';
import { studentSidebarIcons } from '../../lib/portalIcons';

interface StudentProgressOverviewProps {
  loading: boolean;
  progressPercent: number;
}

export function StudentProgressOverview({
  loading,
  progressPercent,
}: StudentProgressOverviewProps) {
  return (
    <DashboardMetricCard
      iconSrc={studentSidebarIcons.inProgress}
      iconBackground="rgba(11, 117, 132, 0.10)"
      label="Overall Progress"
      value={loading ? '—%' : `${progressPercent}%`}
    />
  );
}
