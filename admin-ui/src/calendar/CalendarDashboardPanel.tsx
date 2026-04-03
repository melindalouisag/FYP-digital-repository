import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardPanel from '../lib/components/DashboardPanel';
import {
  describeCalendarEvent,
  formatCalendarEventSchedule,
  formatMonthLabel,
  getCalendarEventBadgeLabel,
  getCalendarEventDetailsText,
  shiftMonth,
  startOfMonth,
  toDateInputValue,
} from './calendarUtils';
import { CalendarMonthGrid } from './CalendarMonthGrid';
import { useCalendarEvents } from './useCalendarEvents';

interface CalendarDashboardPanelProps {
  navigatePath: string;
  hideHeader?: boolean;
}

export function CalendarDashboardPanel({ navigatePath, hideHeader = false }: CalendarDashboardPanelProps) {
  const navigate = useNavigate();
  const calendar = useCalendarEvents();
  const today = new Date();
  const todayValue = toDateInputValue(today);
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(todayValue);

  const openCalendar = (dateValue?: string) => {
    navigate(dateValue ? `${navigatePath}?date=${dateValue}` : navigatePath);
  };

  return (
    <DashboardPanel
      title={hideHeader ? '' : 'Calendar'}
      actions={hideHeader ? undefined : (
        <button className="btn btn-link btn-sm text-decoration-none px-0 su-calendar-dashboard-link" type="button" onClick={() => openCalendar()}>
          Open Calendar
        </button>
      )}
      className="su-calendar-dashboard-panel"
      bodyClassName="su-calendar-dashboard-body"
    >
      {calendar.loading ? (
        <p className="su-dashboard-empty-copy mb-0">Loading calendar.</p>
      ) : (
        <>
          <div className="su-calendar-mini-shell">
            <div className="su-calendar-mini-toolbar">
              <button
                className="su-calendar-chevron-button"
                type="button"
                aria-label="Previous month"
                onClick={() => setCurrentMonth((current) => shiftMonth(current, -1))}
              >
                ‹
              </button>
              <div className="su-calendar-mini-title">{formatMonthLabel(currentMonth)}</div>
              <button
                className="su-calendar-chevron-button"
                type="button"
                aria-label="Next month"
                onClick={() => setCurrentMonth((current) => shiftMonth(current, 1))}
              >
                ›
              </button>
            </div>

            <CalendarMonthGrid
              currentMonth={currentMonth}
              events={calendar.events}
              selectedDate={selectedDate}
              compact
              onSelectDate={(dateValue) => {
                setSelectedDate(dateValue);
                openCalendar(dateValue);
              }}
            />
          </div>

          {calendar.error && <div className="alert alert-danger py-2 mb-0">{calendar.error}</div>}

          <div className="su-calendar-todo">
            <div className="su-calendar-todo-header">
              <h3 className="su-calendar-todo-title">To Do</h3>
              <button
                className="btn btn-link btn-sm text-decoration-none px-0 su-calendar-dashboard-link"
                type="button"
                onClick={() => openCalendar()}
              >
                Show All
              </button>
            </div>
            <div className="su-calendar-divider" />

            {calendar.upcomingEvents.length > 0 ? (
              <div className="su-calendar-todo-list">
                {calendar.upcomingEvents.map((event) => {
                  const detailText = getCalendarEventDetailsText(event);
                  return (
                    <button
                      type="button"
                      className="su-calendar-todo-item"
                      key={event.id}
                      onClick={() => openCalendar(event.eventDate)}
                    >
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <div className="min-w-0">
                          <div className="su-calendar-todo-item-title">{event.title}</div>
                          <div className="su-calendar-todo-item-support">
                            {describeCalendarEvent(event)}
                            {detailText ? ` • ${detailText}` : ''}
                          </div>
                          <div className="su-calendar-todo-item-meta">{formatCalendarEventSchedule(event)}</div>
                        </div>
                        <span className={`su-calendar-tag${event.eventType === 'DEADLINE' ? ' is-deadline' : ''}`}>
                          {getCalendarEventBadgeLabel(event)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="su-dashboard-empty-copy mb-0">No upcoming events.</p>
            )}
          </div>
        </>
      )}
    </DashboardPanel>
  );
}
