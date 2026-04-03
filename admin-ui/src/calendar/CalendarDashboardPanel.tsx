import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardPanel from '../lib/components/DashboardPanel';
import { formatCalendarEventSchedule, formatMonthLabel, describeCalendarEvent, startOfMonth } from './calendarUtils';
import { CalendarMonthGrid } from './CalendarMonthGrid';
import { useCalendarEvents } from './useCalendarEvents';

interface CalendarDashboardPanelProps {
  navigatePath: string;
}

export function CalendarDashboardPanel({ navigatePath }: CalendarDashboardPanelProps) {
  const navigate = useNavigate();
  const calendar = useCalendarEvents();
  const currentMonth = useMemo(() => startOfMonth(new Date()), []);

  const openDate = (dateValue: string) => {
    navigate(`${navigatePath}?date=${dateValue}&new=1`);
  };

  return (
    <DashboardPanel
      title="Calendar"
      actions={(
        <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => navigate(navigatePath)}>
          Open Calendar
        </button>
      )}
    >
      {calendar.loading ? (
        <p className="su-dashboard-empty-copy mb-0">Loading calendar.</p>
      ) : (
        <>
          <div className="d-flex justify-content-between align-items-center gap-2">
            <div className="su-dashboard-item-title">{formatMonthLabel(currentMonth)}</div>
            <div className="su-dashboard-item-meta">Click a date to add an event.</div>
          </div>

          <CalendarMonthGrid
            currentMonth={currentMonth}
            events={calendar.events}
            compact
            onSelectDate={openDate}
          />

          {calendar.error && <div className="alert alert-danger py-2 mb-0">{calendar.error}</div>}

          {calendar.upcomingEvents.length > 0 ? (
            <div className="su-dashboard-list">
              {calendar.upcomingEvents.map((event) => (
                <div className="su-dashboard-list-item" key={event.id}>
                  <div className="su-dashboard-item-title">{event.title}</div>
                  <div className="su-dashboard-item-support">{describeCalendarEvent(event)}</div>
                  <div className="su-dashboard-item-meta">{formatCalendarEventSchedule(event)}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="su-dashboard-empty-copy mb-0">No upcoming events yet.</p>
          )}
        </>
      )}
    </DashboardPanel>
  );
}
