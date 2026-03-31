import type { CSSProperties, ReactNode } from 'react';
import PortalIcon from './PortalIcon';

type DashboardMetricCardProps = {
  iconSrc: string;
  iconBackground: string;
  value: ReactNode;
  label: ReactNode;
  description?: ReactNode;
  onClick?: () => void;
  role?: string;
  className?: string;
  style?: CSSProperties;
  valueStyle?: CSSProperties;
};

export default function DashboardMetricCard({
  iconSrc,
  iconBackground,
  value,
  label,
  description,
  onClick,
  role,
  className = '',
  style,
  valueStyle,
}: DashboardMetricCardProps) {
  const cardClassName = [
    'su-stat-card',
    'w-100',
    onClick ? 'su-card-clickable' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClassName} onClick={onClick} role={role} style={style}>
      <div className="su-stat-card-body">
        <div className="su-stat-icon" style={{ background: iconBackground }}>
          <PortalIcon src={iconSrc} size={22} />
        </div>
        <div className="su-stat-value" style={valueStyle}>{value}</div>
        <div className="su-stat-label">{label}</div>
        <div className={`su-stat-description${description ? '' : ' is-empty'}`}>
          {description ?? <span aria-hidden="true">&nbsp;</span>}
        </div>
      </div>
    </div>
  );
}
