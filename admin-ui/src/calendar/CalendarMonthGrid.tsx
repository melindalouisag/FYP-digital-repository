import { useMemo } from 'react';
import type { CalendarEvent } from '../lib/workflowTypes';
import { buildCalendarMonthDays, getWeekdayLabels } from './calendarUtils';

interface CalendarMonthGridProps {
  currentMonth: Date;
  events: CalendarEvent[];
  selectedDate?: string;
  compact?: boolean;
  onSelectDate: (dateValue: string) => void;
}

export function CalendarMonthGrid({
  currentMonth,
  events,
  selectedDate,
  compact = false,
  onSelectDate,
}: CalendarMonthGridProps) {
  const days = useMemo(() => buildCalendarMonthDays(currentMonth), [currentMonth]);
  const eventCountByDate = useMemo(() => {
    const counts = new Map<string, number>();
    events.forEach((event) => {
      counts.set(event.eventDate, (counts.get(event.eventDate) ?? 0) + 1);
    });
    return counts;
  }, [events]);
  const deadlineDates = useMemo(() => {
    const values = new Set<string>();
    events.forEach((event) => {
      if (event.eventType === 'DEADLINE') {
        values.add(event.eventDate);
      }
    });
    return values;
  }, [events]);
  const eventPreviewByDate = useMemo(() => {
    const previews = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      const bucket = previews.get(event.eventDate) ?? [];
      if (bucket.length < 3) {
        bucket.push(event);
      }
      previews.set(event.eventDate, bucket);
    });
    return previews;
  }, [events]);

  return (
    <div className={`su-calendar-grid-wrapper${compact ? ' is-compact' : ''}`}>
      <div className="su-calendar-weekdays">
        {getWeekdayLabels().map((label) => (
          <div key={label} className="su-calendar-weekday">
            {label}
          </div>
        ))}
      </div>
      <div className={`su-calendar-grid${compact ? ' is-compact' : ''}`}>
        {days.map((day) => {
          const count = eventCountByDate.get(day.iso) ?? 0;
          const previews = eventPreviewByDate.get(day.iso) ?? [];
          const hasDeadline = deadlineDates.has(day.iso);
          return (
            <button
              key={day.iso}
              type="button"
              className={[
                'su-calendar-day',
                !day.inCurrentMonth ? 'is-outside' : '',
                day.isToday ? 'is-today' : '',
                selectedDate === day.iso ? 'is-selected' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onSelectDate(day.iso)}
            >
              <span className="su-calendar-day-number">{day.dateNumber}</span>
              {compact ? (
                <span className="su-calendar-day-mini-events">
                  {count > 0 ? (
                    <>
                      <span
                        className={`su-calendar-day-dot${hasDeadline ? ' is-deadline' : ''}`}
                        aria-hidden="true"
                      />
                      {count > 1 ? <span className="su-calendar-day-count">{count}</span> : null}
                    </>
                  ) : null}
                </span>
              ) : (
                <span className="su-calendar-day-events">
                  {previews.map((event) => (
                    <span
                      key={event.id}
                      className={`su-calendar-day-event${event.eventType === 'DEADLINE' ? ' is-deadline' : ''}`}
                    >
                      {event.title}
                    </span>
                  ))}
                  {count > previews.length ? (
                    <span className="su-calendar-day-more">+{count - previews.length} more</span>
                  ) : null}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
