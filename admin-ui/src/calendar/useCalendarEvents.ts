import { useCallback, useEffect, useMemo, useState } from 'react';
import { calendarApi } from '../lib/api/calendar';
import type { CalendarEvent, DeadlineActionType, PublicationType } from '../lib/workflowTypes';
import {
  buildCalendarDescription,
  compareCalendarEvents,
  parseCalendarDateTime,
  toDateInputValue,
  type CalendarRepeatOption,
} from './calendarUtils';

export type CalendarComposerMode = 'PERSONAL' | DeadlineActionType;

export interface CalendarFormState {
  title: string;
  description: string;
  eventDate: string;
  eventTime: string;
  endTime: string;
  frequency: CalendarRepeatOption;
  location: string;
  mode: CalendarComposerMode;
  publicationType: PublicationType;
}

export function createDefaultCalendarForm(selectedDate = toDateInputValue(new Date())): CalendarFormState {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1, 0, 0, 0);
  return {
    title: '',
    description: '',
    eventDate: selectedDate,
    eventTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    endTime: `${String(nextHour.getHours()).padStart(2, '0')}:${String(nextHour.getMinutes()).padStart(2, '0')}`,
    frequency: 'NONE',
    location: '',
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
        description: buildCalendarDescription({
          details: form.description,
          endTime: form.endTime,
          frequency: form.frequency,
          location: form.location,
        }),
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
      .slice(0, 5);
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
