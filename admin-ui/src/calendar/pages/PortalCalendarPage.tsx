import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ShellLayout from '../../ShellLayout';
import { useAuth } from '../../lib/context/AuthContext';
import type { PublicationType } from '../../lib/workflowTypes';
import { CalendarMonthGrid } from '../CalendarMonthGrid';
import {
  describeCalendarEvent,
  formatCalendarDateLabel,
  formatCalendarEventSchedule,
  formatMonthLabel,
  getDeadlineActionLabel,
  getPublicationTypeLabel,
  shiftMonth,
  startOfMonth,
} from '../calendarUtils';
import { createDefaultCalendarForm, useCalendarEvents } from '../useCalendarEvents';

const PUBLICATION_TYPES: PublicationType[] = ['THESIS', 'ARTICLE', 'INTERNSHIP_REPORT', 'OTHER'];

function readInitialDate(value: string | null): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function PortalCalendarPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const calendar = useCalendarEvents();
  const initialDate = readInitialDate(searchParams.get('date'));
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date(`${initialDate}T00:00:00`)));
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [showComposer, setShowComposer] = useState(searchParams.get('new') === '1');
  const [form, setForm] = useState(() => createDefaultCalendarForm(initialDate));
  const isAdmin = user?.role === 'ADMIN';

  const subtitle = isAdmin
    ? 'Create personal events, publish library deadlines, and keep every portal aligned to the same schedule.'
    : 'Track your personal schedule in one place and keep an eye on library deadlines that affect your workflow.';

  const selectedEvents = useMemo(
    () => calendar.events.filter((event) => event.eventDate === selectedDate),
    [calendar.events, selectedDate]
  );

  const openDate = (dateValue: string) => {
    setSelectedDate(dateValue);
    setCurrentMonth(startOfMonth(new Date(`${dateValue}T00:00:00`)));
    setShowComposer(true);
    setForm((current) => ({
      ...current,
      eventDate: dateValue,
    }));
    calendar.clearActionError();
  };

  const resetFormForDate = (dateValue: string) => {
    setForm(createDefaultCalendarForm(dateValue));
  };

  const submitEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const saved = await calendar.createEvent(form);
    if (saved) {
      resetFormForDate(form.eventDate);
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
      {calendar.actionError && <div className="alert alert-danger">{calendar.actionError}</div>}

      <div className="row g-3">
        <div className="col-12 col-xl-8">
          <div className="su-card">
            <div className="card-body p-4">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <div>
                  <h3 className="h5 mb-1 su-page-title">{formatMonthLabel(currentMonth)}</h3>
                  <div className="text-muted small">Select a date to create an event.</div>
                </div>
                <div className="d-flex gap-2">
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    type="button"
                    onClick={() => setCurrentMonth((current) => shiftMonth(current, -1))}
                  >
                    Previous
                  </button>
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    type="button"
                    onClick={() => setCurrentMonth((current) => shiftMonth(current, 1))}
                  >
                    Next
                  </button>
                </div>
              </div>

              <CalendarMonthGrid
                currentMonth={currentMonth}
                events={calendar.events}
                selectedDate={selectedDate}
                onSelectDate={openDate}
              />
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-4">
          <div className="su-card mb-3">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                <div>
                  <h3 className="h6 mb-1 su-page-title">{formatCalendarDateLabel(selectedDate)}</h3>
                  <div className="text-muted small">Visible events for the selected date.</div>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  type="button"
                  onClick={() => {
                    setShowComposer(true);
                    setForm((current) => ({ ...current, eventDate: selectedDate }));
                  }}
                >
                  Add Event
                </button>
              </div>

              {selectedEvents.length > 0 ? (
                <div className="su-calendar-event-list">
                  {selectedEvents.map((event) => (
                    <div className="su-calendar-event-card" key={event.id}>
                      <div className="d-flex justify-content-between gap-2 align-items-start">
                        <div className="min-w-0">
                          <div className="su-dashboard-item-title">{event.title}</div>
                          <div className="su-dashboard-item-support">{describeCalendarEvent(event)}</div>
                          <div className="su-dashboard-item-meta">{formatCalendarEventSchedule(event)}</div>
                          {event.description ? (
                            <div className="small text-muted mt-2">{event.description}</div>
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
                  ))}
                </div>
              ) : (
                <p className="text-muted small mb-0">No events scheduled for this date.</p>
              )}
            </div>
          </div>

          {showComposer ? (
            <div className="su-card">
              <div className="card-body p-4">
                <h3 className="h6 mb-3 su-page-title">Add Event</h3>
                <form className="row g-3" onSubmit={(event) => void submitEvent(event)}>
                  <div className="col-12">
                    <label className="form-label">Title</label>
                    <input
                      className="form-control"
                      value={form.title}
                      maxLength={160}
                      onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                      required
                    />
                  </div>

                  {isAdmin ? (
                    <div className="col-12">
                      <label className="form-label">Event Type</label>
                      <select
                        className="form-select"
                        value={form.mode}
                        onChange={(event) => setForm((current) => ({
                          ...current,
                          mode: event.target.value as typeof current.mode,
                        }))}
                      >
                        <option value="PERSONAL">Personal event</option>
                        <option value="REGISTRATION_DEADLINE">Registration deadline</option>
                        <option value="SUBMISSION_DEADLINE">Submission deadline</option>
                      </select>
                    </div>
                  ) : null}

                  <div className="col-sm-6">
                    <label className="form-label">Date</label>
                    <input
                      className="form-control"
                      type="date"
                      value={form.eventDate}
                      onChange={(event) => setForm((current) => ({ ...current, eventDate: event.target.value }))}
                      required
                    />
                  </div>

                  <div className="col-sm-6">
                    <label className="form-label">Time</label>
                    <input
                      className="form-control"
                      type="time"
                      value={form.eventTime}
                      onChange={(event) => setForm((current) => ({ ...current, eventTime: event.target.value }))}
                      required
                    />
                  </div>

                  {form.mode !== 'PERSONAL' ? (
                    <div className="col-12">
                      <label className="form-label">{getDeadlineActionLabel(form.mode)} for</label>
                      <select
                        className="form-select"
                        value={form.publicationType}
                        onChange={(event) => setForm((current) => ({
                          ...current,
                          publicationType: event.target.value as PublicationType,
                        }))}
                      >
                        {PUBLICATION_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {getPublicationTypeLabel(type)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  <div className="col-12">
                    <label className="form-label">Details</label>
                    <textarea
                      className="form-control"
                      rows={4}
                      value={form.description}
                      onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Add notes or a short description."
                    />
                  </div>

                  <div className="col-12 d-flex flex-wrap gap-2">
                    <button className="btn btn-primary" type="submit" disabled={calendar.submitting}>
                      {calendar.submitting ? 'Saving...' : 'Save Event'}
                    </button>
                    <button
                      className="btn btn-outline-secondary"
                      type="button"
                      onClick={() => {
                        resetFormForDate(selectedDate);
                        setShowComposer(false);
                        calendar.clearActionError();
                      }}
                      disabled={calendar.submitting}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </ShellLayout>
  );
}
