import type { CSSProperties, ReactNode } from 'react';
import DashboardPanel from './DashboardPanel';

interface DashboardProgressRingCardProps {
  title: ReactNode;
  progressPercent: number | null;
  primaryText?: ReactNode;
  secondaryText?: ReactNode;
  actions?: ReactNode;
  loading?: boolean;
  emptyText?: ReactNode;
  className?: string;
}

export default function DashboardProgressRingCard({
  title,
  progressPercent,
  primaryText,
  secondaryText,
  actions,
  loading = false,
  emptyText = 'No data available.',
  className = '',
}: DashboardProgressRingCardProps) {
  const normalizedProgress = progressPercent == null
    ? null
    : Math.max(0, Math.min(100, Math.round(progressPercent)));
  const ringStyle = normalizedProgress == null
    ? undefined
    : ({ ['--su-progress' as string]: normalizedProgress } as CSSProperties);

  return (
    <DashboardPanel
      title={title}
      actions={actions}
      className={`su-progress-ring-card ${className}`.trim()}
      bodyClassName="su-progress-ring-card-body"
    >
      {loading ? (
        <div className="su-progress-ring-card-empty">Loading dashboard data.</div>
      ) : normalizedProgress == null ? (
        <div className="su-progress-ring-card-empty">{emptyText}</div>
      ) : (
        <>
          <div className="su-progress-ring" style={ringStyle} aria-hidden="true">
            <div className="su-progress-ring-core">
              <div className="su-progress-ring-value">{normalizedProgress}%</div>
            </div>
          </div>
          {primaryText ? <div className="su-progress-ring-primary">{primaryText}</div> : null}
          {secondaryText ? <div className="su-progress-ring-secondary">{secondaryText}</div> : null}
        </>
      )}
    </DashboardPanel>
  );
}
