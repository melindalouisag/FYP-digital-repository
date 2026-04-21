import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="su-empty-state">
      <h2 className="su-empty-state-title">{title}</h2>
      <p className="su-empty-state-copy">{description}</p>
      {action ? <div className="su-empty-state-action">{action}</div> : null}
    </div>
  );
}
