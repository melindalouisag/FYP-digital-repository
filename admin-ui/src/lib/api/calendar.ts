import type {
  CalendarEvent,
  CalendarEventType,
  DeadlineActionType,
  PublicationType,
} from '../workflowTypes';
import { deleteJson, getJson, postJson } from './http';

export interface CalendarEventPayload {
  title: string;
  description?: string | null;
  eventDate: string;
  eventTime: string;
  eventType: CalendarEventType;
  deadlineAction?: DeadlineActionType | null;
  publicationType?: PublicationType | null;
}

export const calendarApi = {
  listEvents(): Promise<CalendarEvent[]> {
    return getJson('/api/calendar/events');
  },

  createEvent(payload: CalendarEventPayload): Promise<CalendarEvent> {
    return postJson('/api/calendar/events', payload);
  },

  deleteEvent(eventId: number): Promise<{ ok: boolean }> {
    return deleteJson(`/api/calendar/events/${eventId}`);
  },
};
