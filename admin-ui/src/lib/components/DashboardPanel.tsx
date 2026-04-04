import type { ReactNode } from 'react';

type DashboardPanelProps = {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export default function DashboardPanel({
  title,
  actions,
  children,
  className = '',
  bodyClassName = '',
}: DashboardPanelProps) {
  const panelClassName = ['su-card', 'su-dashboard-panel', 'h-100', className]
    .filter(Boolean)
    .join(' ');
  const panelBodyClassName = ['su-dashboard-panel-body', bodyClassName]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={panelClassName}>
      {title || actions ? (
        <div className="su-dashboard-panel-header">
          <h2 className="su-dashboard-panel-title">{title}</h2>
          {actions ? <div className="su-dashboard-panel-actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className={panelBodyClassName}>{children}</div>
    </section>
  );
}
