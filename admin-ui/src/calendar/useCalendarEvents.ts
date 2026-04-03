import { useCallback, useEffect, useMemo, useState } from 'react';
import { calendarApi } from '../lib/api/calendar';
import type { CalendarEvent, DeadlineActionType, PublicationType } from '../lib/workflowTypes';
import { compareCalendarEvents, parseCalendarDateTime, toDateInputValue } from './calendarUtils';

export type CalendarComposerMode = 'PERSONAL' | DeadlineActionType;

export interface CalendarFormState {
  title: string;
  description: string;
  eventDate: string;
  eventTime: string;
  mode: CalendarComposerMode;
  publicationType: PublicationType;
}

export function createDefaultCalendarForm(selectedDate = toDateInputValue(new Date())): CalendarFormState {
  const now = new Date();
  return {
    title: '',
    description: '',
    eventDate: selectedDate,
    eventTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    mode: 'PERSONAL',
    publicationType: 'THESIS',
  };
}

export function useCalendarEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await calendarApi.listEvents();
      setEvents(rows.sort(compareCalendarEvents));
    } catch (err) {
      setEvents([]);
      setError(err instanceof Error ? err.message : 'Failed to load calendar events.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const createEvent = useCallback(async (form: CalendarFormState) => {
    setSubmitting(true);
    setActionError('');
    try {
      await calendarApi.createEvent({
        title: form.title.trim(),
        description: form.description.trim() || null,
        eventDate: form.eventDate,
        eventTime: form.eventTime,
        eventType: form.mode === 'PERSONAL' ? 'PERSONAL' : 'DEADLINE',
        deadlineAction: form.mode === 'PERSONAL' ? null : form.mode,
        publicationType: form.mode === 'PERSONAL' ? null : form.publicationType,
      });
      await loadEvents();
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to save calendar event.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [loadEvents]);

  const deleteEvent = useCallback(async (eventId: number) => {
    setDeletingId(eventId);
    setActionError('');
    try {
      await calendarApi.deleteEvent(eventId);
      await loadEvents();
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete calendar event.');
      return false;
    } finally {
      setDeletingId(null);
    }
  }, [loadEvents]);

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return events
      .filter((event) => parseCalendarDateTime(event.eventDate, event.eventTime).getTime() >= now)
      .sort(compareCalendarEvents)
      .slice(0, 3);
  }, [events]);

  return {
    events,
    loading,
    error,
    actionError,
    submitting,
    deletingId,
    upcomingEvents,
    createEvent,
    deleteEvent,
    loadEvents,
    clearActionError: () => setActionError(''),
  };
}
