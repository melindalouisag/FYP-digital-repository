import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  centered?: boolean;
}

export default function EmptyState({
  title,
  description,
  icon,
  action,
  centered = false,
}: EmptyStateProps) {
  return (
    <div className={`su-empty-state${centered ? ' su-empty-state-centered' : ''}`}>
      {icon ? <div className="su-empty-icon" aria-hidden="true">{icon}</div> : null}
      <h2 className="su-empty-state-title">{title}</h2>
      <p className="su-empty-state-copy">{description}</p>
      {action ? <div className="su-empty-state-action">{action}</div> : null}
    </div>
  );
}
