import { useEffect, useRef, useState, type ReactNode } from 'react';
import DashboardPanel from '@/shared/ui/DashboardPanel';

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

const RING_SIZE = 200;
const RING_STROKE_WIDTH = 14;
const RING_RADIUS = (RING_SIZE - RING_STROKE_WIDTH) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const INITIAL_RING_DELAY_MS = 100;
const COUNT_DURATION_MS = 900;

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
  const prefersReducedMotion = usePrefersReducedMotion();
  const [ringProgress, setRingProgress] = useState(0);
  const [displayPercent, setDisplayPercent] = useState(0);
  const ringProgressRef = useRef(0);
  const displayPercentRef = useRef(0);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    if (normalizedProgress == null) {
      ringProgressRef.current = 0;
      displayPercentRef.current = 0;
      hasAnimatedRef.current = false;
      setRingProgress(0);
      setDisplayPercent(0);
    }
  }, [normalizedProgress]);

  useEffect(() => {
    if (loading || normalizedProgress == null) {
      return;
    }

    if (prefersReducedMotion) {
      ringProgressRef.current = normalizedProgress;
      displayPercentRef.current = normalizedProgress;
      hasAnimatedRef.current = true;
      setRingProgress(normalizedProgress);
      setDisplayPercent(normalizedProgress);
      return;
    }

    if (normalizedProgress === 0) {
      ringProgressRef.current = 0;
      displayPercentRef.current = 0;
      hasAnimatedRef.current = true;
      setRingProgress(0);
      setDisplayPercent(0);
      return;
    }

    const isInitialAnimation = !hasAnimatedRef.current;
    const fromRingValue = isInitialAnimation ? 0 : ringProgressRef.current;
    const fromNumberValue = isInitialAnimation ? 0 : displayPercentRef.current;

    if (!isInitialAnimation
      && fromRingValue === normalizedProgress
      && fromNumberValue === normalizedProgress) {
      return;
    }

    if (isInitialAnimation) {
      ringProgressRef.current = 0;
      displayPercentRef.current = 0;
      setRingProgress(0);
      setDisplayPercent(0);
    }

    const ringDelay = isInitialAnimation ? INITIAL_RING_DELAY_MS : 0;
    const ringTimer = window.setTimeout(() => {
      ringProgressRef.current = normalizedProgress;
      setRingProgress(normalizedProgress);
    }, ringDelay);

    const animationStart = performance.now() + ringDelay;
    let animationFrame = 0;

    const tick = (now: number) => {
      if (now < animationStart) {
        animationFrame = window.requestAnimationFrame(tick);
        return;
      }

      const progress = Math.min((now - animationStart) / COUNT_DURATION_MS, 1);
      const easedProgress = easeOutCubic(progress);
      const nextValue = Math.round(
        fromNumberValue + ((normalizedProgress - fromNumberValue) * easedProgress)
      );

      if (nextValue !== displayPercentRef.current) {
        displayPercentRef.current = nextValue;
        setDisplayPercent(nextValue);
      }

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(tick);
        return;
      }

      displayPercentRef.current = normalizedProgress;
      hasAnimatedRef.current = true;
      setDisplayPercent(normalizedProgress);
    };

    animationFrame = window.requestAnimationFrame(tick);

    return () => {
      window.clearTimeout(ringTimer);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [loading, normalizedProgress, prefersReducedMotion]);

  const dashOffset = RING_CIRCUMFERENCE - ((ringProgress / 100) * RING_CIRCUMFERENCE);

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
          <div
            className="su-progress-ring"
            role="img"
            aria-label={`${normalizedProgress}% complete`}
          >
            <svg
              className="su-progress-ring-svg"
              viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
              aria-hidden="true"
            >
              <circle
                className="su-progress-ring-track"
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                strokeWidth={RING_STROKE_WIDTH}
              />
              <circle
                className="su-progress-ring-fill"
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                strokeWidth={RING_STROKE_WIDTH}
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
              />
            </svg>
            <div className="su-progress-ring-core">
              <div className="su-progress-ring-value">{displayPercent}%</div>
            </div>
          </div>
          {primaryText ? <div className="su-progress-ring-primary">{primaryText}</div> : null}
          {secondaryText ? <div className="su-progress-ring-secondary">{secondaryText}</div> : null}
        </>
      )}
    </DashboardPanel>
  );
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updatePreference);
      return () => mediaQuery.removeEventListener('change', updatePreference);
    }

    mediaQuery.addListener(updatePreference);
    return () => mediaQuery.removeListener(updatePreference);
  }, []);

  return prefersReducedMotion;
}

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}
