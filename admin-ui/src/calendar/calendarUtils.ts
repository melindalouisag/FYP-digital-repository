import type { CalendarEvent, DeadlineActionType, PublicationType } from '../lib/workflowTypes';

export interface CalendarDay {
  iso: string;
  dateNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
}

export type CalendarRepeatOption = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUALLY';

interface CalendarDescriptionMeta {
  endTime?: string;
  frequency?: CalendarRepeatOption;
  location?: string;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CALENDAR_META_PREFIX = '[[CALENDAR_META]]';
const CALENDAR_META_SUFFIX = '[[/CALENDAR_META]]';

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

export function buildCalendarDescription({
  details,
  endTime,
  frequency,
  location,
}: {
  details: string;
  endTime?: string;
  frequency?: CalendarRepeatOption;
  location?: string;
}): string | null {
  const normalizedDetails = details.trim();
  const meta: CalendarDescriptionMeta = {};

  if (endTime?.trim()) {
    meta.endTime = endTime.trim();
  }
  if (frequency && frequency !== 'NONE') {
    meta.frequency = frequency;
  }
  if (location?.trim()) {
    meta.location = location.trim();
  }

  const hasMeta = Object.keys(meta).length > 0;
  if (!hasMeta) {
    return normalizedDetails || null;
  }

  const metaBlock = `${CALENDAR_META_PREFIX}${JSON.stringify(meta)}${CALENDAR_META_SUFFIX}`;
  return normalizedDetails ? `${metaBlock}\n${normalizedDetails}` : metaBlock;
}

export function readCalendarDescription(description?: string | null): CalendarDescriptionMeta & { body: string } {
  if (!description) {
    return { body: '' };
  }

  if (!description.startsWith(CALENDAR_META_PREFIX)) {
    return { body: description.trim() };
  }

  const suffixIndex = description.indexOf(CALENDAR_META_SUFFIX);
  if (suffixIndex === -1) {
    return { body: description.trim() };
  }

  const rawMeta = description.slice(CALENDAR_META_PREFIX.length, suffixIndex);
  const body = description.slice(suffixIndex + CALENDAR_META_SUFFIX.length).trim();

  try {
    const parsed = JSON.parse(rawMeta) as CalendarDescriptionMeta;
    return {
      body,
      endTime: parsed.endTime,
      frequency: parsed.frequency,
      location: parsed.location,
    };
  } catch {
    return { body: description.trim() };
  }
}

export function getRepeatOptionLabel(option: CalendarRepeatOption): string {
  switch (option) {
    case 'DAILY':
      return 'Daily';
    case 'WEEKLY':
      return 'Weekly';
    case 'MONTHLY':
      return 'Monthly';
    case 'ANNUALLY':
      return 'Annually';
    case 'NONE':
    default:
      return 'Does not repeat';
  }
}

export function getCalendarEventBadgeLabel(event: Pick<CalendarEvent, 'eventType'>): string {
  return event.eventType === 'DEADLINE' ? 'Deadline' : 'Personal';
}

export function getCalendarEventDetailsText(event: Pick<CalendarEvent, 'description'>): string {
  return readCalendarDescription(event.description).body;
}

export function getCalendarEventLocation(event: Pick<CalendarEvent, 'description'>): string | null {
  return readCalendarDescription(event.description).location ?? null;
}

export function getCalendarEventFrequencyLabel(event: Pick<CalendarEvent, 'description'>): string | null {
  const frequency = readCalendarDescription(event.description).frequency;
  return frequency ? getRepeatOptionLabel(frequency) : null;
}

export function formatCalendarEventSchedule(
  event: Pick<CalendarEvent, 'eventDate' | 'eventTime' | 'description'>,
  options?: { includeDate?: boolean },
): string {
  const date = parseCalendarDateTime(event.eventDate, event.eventTime);
  const startLabel = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const endTime = readCalendarDescription(event.description).endTime;
  const timeLabel = endTime
    ? `${startLabel} - ${formatTimeLabel(endTime)}`
    : startLabel;

  if (options?.includeDate === false) {
    return timeLabel;
  }
  return `${date.toLocaleDateString()} • ${timeLabel}`;
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
  const location = getCalendarEventLocation(event);
  const repeatLabel = getCalendarEventFrequencyLabel(event);
  const details = [repeatLabel, location].filter(Boolean);
  return details.join(' • ') || 'Personal event';
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

function formatTimeLabel(timeValue: string): string {
  return parseCalendarDateTime('2000-01-01', timeValue).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}
