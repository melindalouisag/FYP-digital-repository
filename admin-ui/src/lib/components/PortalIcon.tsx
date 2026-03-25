import type { CSSProperties } from 'react';

type PortalIconProps = {
  src: string;
  label?: string;
  className?: string;
  size?: number;
  style?: CSSProperties;
  decorative?: boolean;
};

export default function PortalIcon({
  src,
  label,
  className = '',
  size = 18,
  style,
  decorative = true,
}: PortalIconProps) {
  const combinedClassName = ['su-portal-icon', className].filter(Boolean).join(' ');

  return (
    <img
      src={src}
      alt={decorative ? '' : (label ?? '')}
      aria-hidden={decorative ? 'true' : undefined}
      className={combinedClassName}
      style={{ width: size, height: size, ...style }}
    />
  );
}
