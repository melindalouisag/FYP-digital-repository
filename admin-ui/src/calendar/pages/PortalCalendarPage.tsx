import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ShellLayout from '../../ShellLayout';
import { useAuth } from '../../lib/context/AuthContext';
import { CalendarEventModal } from '../CalendarEventModal';
import { CalendarMonthGrid } from '../CalendarMonthGrid';
import {
  describeCalendarEvent,
  formatCalendarDateLabel,
  formatCalendarEventSchedule,
  formatMonthLabel,
  getCalendarEventBadgeLabel,
  getCalendarEventDetailsText,
  getCalendarEventFrequencyLabel,
  getCalendarEventLocation,
  shiftMonth,
  startOfMonth,
  toDateInputValue,
} from '../calendarUtils';
import { createDefaultCalendarForm, useCalendarEvents } from '../useCalendarEvents';

function readInitialDate(value: string | null): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return toDateInputValue(new Date());
}

export default function PortalCalendarPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const calendar = useCalendarEvents();
  const initialDate = readInitialDate(searchParams.get('date'));
  const todayValue = toDateInputValue(new Date());
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date(`${initialDate}T00:00:00`)));
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [showComposer, setShowComposer] = useState(searchParams.get('new') === '1');
  const [form, setForm] = useState(() => createDefaultCalendarForm(initialDate));
  const isAdmin = user?.role === 'ADMIN';

  const subtitle = isAdmin
    ? 'Create personal events, publish library deadlines, and keep every portal aligned to the same academic schedule.'
    : 'Review your academic schedule, personal reminders, and library deadlines in one quiet monthly workspace.';

  const selectedEvents = useMemo(
    () => calendar.events.filter((event) => event.eventDate === selectedDate),
    [calendar.events, selectedDate]
  );

  const selectDate = (dateValue: string) => {
    setSelectedDate(dateValue);
    setCurrentMonth(startOfMonth(new Date(`${dateValue}T00:00:00`)));
  };

  const openComposer = (dateValue = selectedDate) => {
    setShowComposer(true);
    setForm((current) => ({
      ...current,
      eventDate: dateValue,
    }));
    calendar.clearActionError();
  };

  const closeComposer = () => {
    setShowComposer(false);
    setForm(createDefaultCalendarForm(selectedDate));
    calendar.clearActionError();
  };

  const submitEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const saved = await calendar.createEvent(form);
    if (saved) {
      selectDate(form.eventDate);
      setForm(createDefaultCalendarForm(form.eventDate));
      setShowComposer(false);
    }
  };

  const deleteEvent = async (eventId: number, title: string) => {
    if (!window.confirm(`Delete "${title}" from the calendar?`)) {
      return;
    }
    await calendar.deleteEvent(eventId);
  };

  return (
    <ShellLayout title="Calendar" subtitle={subtitle}>
      {calendar.error && <div className="alert alert-danger">{calendar.error}</div>}
      {calendar.actionError && !showComposer ? <div className="alert alert-danger">{calendar.actionError}</div> : null}

      <div className="su-calendar-page-layout">
        <section className="su-calendar-main-column">
          <div className="su-card su-calendar-surface">
            <div className="card-body p-4 p-xl-4">
              <div className="su-calendar-toolbar">
                <div>
                  <div className="su-calendar-panel-kicker">Academic month view</div>
                  <h3 className="su-page-title mb-1">{formatMonthLabel(currentMonth)}</h3>
                  <div className="text-muted small">Select a date to review events or open the add modal.</div>
                </div>

                <div className="su-calendar-toolbar-actions">
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    type="button"
                    onClick={() => selectDate(todayValue)}
                  >
                    Today
                  </button>
                  <button
                    className="su-calendar-chevron-button"
                    type="button"
                    aria-label="Previous month"
                    onClick={() => setCurrentMonth((current) => shiftMonth(current, -1))}
                  >
                    ‹
                  </button>
                  <button
                    className="su-calendar-chevron-button"
                    type="button"
                    aria-label="Next month"
                    onClick={() => setCurrentMonth((current) => shiftMonth(current, 1))}
                  >
                    ›
                  </button>
                </div>
              </div>

              <CalendarMonthGrid
                currentMonth={currentMonth}
                events={calendar.events}
                selectedDate={selectedDate}
                onSelectDate={selectDate}
              />
            </div>
          </div>
        </section>

        <aside className="su-calendar-sidebar-column">
          <div className="su-card su-calendar-sidebar-card">
            <div className="card-body p-3">
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
                onSelectDate={selectDate}
              />
            </div>
          </div>

          <div className="su-card su-calendar-sidebar-card">
            <div className="card-body p-4">
              <div className="su-calendar-selected-header">
                <div className="min-w-0">
                  <div className="su-calendar-panel-kicker">Selected date</div>
                  <h3 className="h6 mb-1 su-page-title">{formatCalendarDateLabel(selectedDate)}</h3>
                  <div className="text-muted small">Visible events scheduled for this date.</div>
                </div>
                <button
                  className="su-calendar-add-button"
                  type="button"
                  aria-label={`Add event for ${formatCalendarDateLabel(selectedDate)}`}
                  onClick={() => openComposer(selectedDate)}
                >
                  +
                </button>
              </div>

              {selectedEvents.length > 0 ? (
                <div className="su-calendar-event-list">
                  {selectedEvents.map((event) => {
                    const detailText = getCalendarEventDetailsText(event);
                    const location = getCalendarEventLocation(event);
                    const repeatLabel = getCalendarEventFrequencyLabel(event);

                    return (
                      <div className="su-calendar-event-card" key={event.id}>
                        <div className="d-flex justify-content-between gap-2 align-items-start">
                          <div className="min-w-0">
                            <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                              <div className="su-dashboard-item-title">{event.title}</div>
                              <span className={`su-calendar-tag${event.eventType === 'DEADLINE' ? ' is-deadline' : ''}`}>
                                {getCalendarEventBadgeLabel(event)}
                              </span>
                            </div>
                            <div className="su-dashboard-item-support">{describeCalendarEvent(event)}</div>
                            <div className="su-dashboard-item-meta">
                              {formatCalendarEventSchedule(event, { includeDate: false })}
                            </div>
                            {location ? <div className="su-calendar-event-inline-meta">Location: {location}</div> : null}
                            {repeatLabel ? <div className="su-calendar-event-inline-meta">Frequency: {repeatLabel}</div> : null}
                            {detailText ? (
                              <div className="small text-muted mt-2">{detailText}</div>
                            ) : null}
                          </div>

                          {event.canManage ? (
                            <button
                              className="btn btn-outline-danger btn-sm"
                              type="button"
                              disabled={calendar.deletingId === event.id}
                              onClick={() => void deleteEvent(event.id, event.title)}
                            >
                              {calendar.deletingId === event.id ? 'Deleting...' : 'Delete'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted small mb-0">No events scheduled for this date.</p>
              )}
            </div>
          </div>
        </aside>
      </div>

      <CalendarEventModal
        open={showComposer}
        isAdmin={isAdmin}
        form={form}
        submitting={calendar.submitting}
        actionError={calendar.actionError}
        onClose={closeComposer}
        onSubmit={submitEvent}
        onChange={setForm}
      />
    </ShellLayout>
  );
}
