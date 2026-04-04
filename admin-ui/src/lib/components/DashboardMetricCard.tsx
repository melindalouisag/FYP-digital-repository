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

  const content = (
    <>
      <div className="su-stat-card-header">
        <div className="su-stat-label">{label}</div>
        <div className="su-stat-icon" style={{ background: iconBackground }}>
          <PortalIcon src={iconSrc} size={20} />
        </div>
      </div>
      <div className="su-stat-value" style={valueStyle}>{value}</div>
      {description ? <div className="su-stat-support">{description}</div> : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={cardClassName} onClick={onClick} style={style}>
        {content}
      </button>
    );
  }

  return (
    <div className={cardClassName} role={role} style={style}>
      {content}
    </div>
  );
}
