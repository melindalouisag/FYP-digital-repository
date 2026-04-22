import { useMemo } from 'react';
import DashboardPanel from '@/shared/ui/DashboardPanel';
import type { DashboardStageCount } from '@/types/workflow';

interface WorkflowStageOverviewCardProps {
  loading: boolean;
  stageDistribution: DashboardStageCount[];
  emptyText: string;
  title?: string;
}

export default function WorkflowStageOverviewCard({
  loading,
  stageDistribution,
  emptyText,
  title = 'Workflow Stage Overview',
}: WorkflowStageOverviewCardProps) {
  const maxStageCount = useMemo(
    () => Math.max(...stageDistribution.map((item) => item.count), 1),
    [stageDistribution]
  );

  return (
    <DashboardPanel title={title} className="w-100">
      {loading ? (
        <p className="su-dashboard-empty-copy mb-0">Loading dashboard data.</p>
      ) : stageDistribution.length === 0 ? (
        <p className="su-dashboard-empty-copy mb-0">{emptyText}</p>
      ) : (
        <div className="su-dashboard-bars">
          {stageDistribution.map((item) => (
            <div className="su-dashboard-bar-row" key={item.label}>
              <div className="su-dashboard-bar-header">
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
  );
}
