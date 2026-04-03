import type { CalendarEvent, DeadlineActionType, PublicationType } from '../lib/workflowTypes';

export interface CalendarDay {
  iso: string;
  dateNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function getWeekdayLabels() {
  return WEEKDAY_LABELS;
}

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseCalendarDateTime(eventDate: string, eventTime: string): Date {
  const normalizedTime = eventTime.length === 5 ? `${eventTime}:00` : eventTime;
  return new Date(`${eventDate}T${normalizedTime}`);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function shiftMonth(date: Date, offset: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

export function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function buildCalendarMonthDays(currentMonth: Date): CalendarDay[] {
  const monthStart = startOfMonth(currentMonth);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());
  const today = toDateInputValue(new Date());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const iso = toDateInputValue(date);
    return {
      iso,
      dateNumber: date.getDate(),
      inCurrentMonth: date.getMonth() === currentMonth.getMonth(),
      isToday: iso === today,
    };
  });
}

export function compareCalendarEvents(left: CalendarEvent, right: CalendarEvent): number {
  const timeDiff = parseCalendarDateTime(left.eventDate, left.eventTime).getTime()
    - parseCalendarDateTime(right.eventDate, right.eventTime).getTime();
  if (timeDiff !== 0) {
    return timeDiff;
  }
  return left.id - right.id;
}

export function formatCalendarDateLabel(dateValue: string): string {
  return parseCalendarDateTime(dateValue, '00:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatCalendarEventSchedule(event: Pick<CalendarEvent, 'eventDate' | 'eventTime'>): string {
  const date = parseCalendarDateTime(event.eventDate, event.eventTime);
  return `${date.toLocaleDateString()} • ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function getPublicationTypeLabel(type?: PublicationType | null): string {
  if (!type) {
    return 'Publication';
  }
  return type
    .toLowerCase()
    .split('_')
    .map((value) => value.charAt(0).toUpperCase() + value.slice(1))
    .join(' ');
}

export function getDeadlineActionLabel(action?: DeadlineActionType | null): string {
  if (action === 'REGISTRATION_DEADLINE') {
    return 'Registration deadline';
  }
  if (action === 'SUBMISSION_DEADLINE') {
    return 'Submission deadline';
  }
  return 'Deadline';
}

export function describeCalendarEvent(event: CalendarEvent): string {
  if (event.eventType === 'DEADLINE') {
    return `${getDeadlineActionLabel(event.deadlineAction)} • ${getPublicationTypeLabel(event.publicationType)}`;
  }
  return 'Personal event';
}

export function findLatestDeadline(
  events: CalendarEvent[],
  publicationType: PublicationType,
  deadlineAction: DeadlineActionType,
): CalendarEvent | null {
  return events
    .filter((event) => (
      event.eventType === 'DEADLINE'
        && event.deadlineAction === deadlineAction
        && event.publicationType === publicationType
    ))
    .sort((left, right) => compareCalendarEvents(right, left))
    .at(0) ?? null;
}

export function isDeadlinePassed(event: CalendarEvent | null): boolean {
  if (!event) {
    return false;
  }
  return parseCalendarDateTime(event.eventDate, event.eventTime).getTime() <= Date.now();
}

export function getDeadlineBlockMessage(deadlineAction: DeadlineActionType): string {
  return deadlineAction === 'REGISTRATION_DEADLINE'
    ? 'The registration deadline has passed.'
    : 'The submission deadline has passed.';
}
