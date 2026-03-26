import type { TimelineItem } from '../types/workflow';

interface CaseTimelineProps {
  items: TimelineItem[];
  emptyLabel?: string;
}

export default function CaseTimeline({ items, emptyLabel = 'No timeline activity yet.' }: CaseTimelineProps) {
  if (items.length === 0) {
    return (
      <div className="su-empty-state">
        <div>{emptyLabel}</div>
      </div>
    );
  }

  return (
    <ul className="timeline-list list-unstyled mb-0">
      {items.map((item, index) => (
        <li key={`${item.type}-${item.at ?? index}-${index}`} className="fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
          <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
            <span className="text-muted small">{item.at ? new Date(item.at).toLocaleString() : 'N/A'}</span>
            {item.actorRole && (
              <span className="badge bg-secondary-subtle text-secondary-emphasis"
                style={{ borderRadius: '999px', fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}>
                {item.actorRole}
              </span>
            )}
          </div>
          <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>{item.message || item.type}</div>
          {item.actorEmail && <div className="text-muted small">{item.actorEmail}</div>}
        </li>
      ))}
    </ul>
  );
}
