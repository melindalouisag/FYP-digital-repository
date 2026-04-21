import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '@/services/api/admin';
import { calendarApi } from '@/services/api/calendar';
import EmptyState from '@/shared/ui/EmptyState';
import StatusBadge from '@/shared/ui/StatusBadge';
import type {
  AdminDashboardData,
  CalendarEvent,
  DashboardActivityItem,
  DashboardActionItem,
  DeadlineActionType,
  PublicationType,
} from '@/types/workflow';
import { ACTIVE_PUBLICATION_TYPES } from '@/utils/uiLabels';
import ShellLayout from '../../ShellLayout';
import {
  compareCalendarEvents,
  formatCalendarEventSchedule,
  getDeadlineActionLabel,
  getPublicationTypeLabel,
  toDateInputValue,
} from '../../calendar/calendarUtils';

const EMPTY_DASHBOARD: AdminDashboardData = {
  workflowProgressPercent: 0,
  activeCaseCount: 0,
  publishedStudentCount: 0,
  totalStudentCount: 0,
  registrationQueueCount: 0,
  submissionReviewQueueCount: 0,
  clearanceQueueCount: 0,
  publishingQueueCount: 0,
  revisionRequiredCount: 0,
  needsActionNow: [],
  stageDistribution: [],
  recentActivity: [],
};

interface DeadlineFormState {
  title: string;
  deadlineAction: DeadlineActionType;
  publicationType: PublicationType;
  eventDate: string;
  eventTime: string;
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<AdminDashboardData>(EMPTY_DASHBOARD);
  const [deadlineEvents, setDeadlineEvents] = useState<CalendarEvent[]>([]);
  const [deadlineForm, setDeadlineForm] = useState<DeadlineFormState>(createDeadlineFormState());
  const [loading, setLoading] = useState(true);
  const [deadlineSaving, setDeadlineSaving] = useState(false);
  const [error, setError] = useState('');
  const [deadlineError, setDeadlineError] = useState('');
  const [deadlineMessage, setDeadlineMessage] = useState('');
  const [deadlineLoadError, setDeadlineLoadError] = useState('');

  const loadDeadlines = useCallback(async () => {
    try {
      const rows = await calendarApi.listEvents();
      setDeadlineEvents(rows.filter((event) => event.eventType === 'DEADLINE').sort(compareCalendarEvents));
      setDeadlineLoadError('');
    } catch {
      setDeadlineEvents([]);
      setDeadlineLoadError('Unable to load scheduled deadlines right now.');
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        setDashboard(await adminApi.dashboard());
      } catch (err) {
        setDashboard(EMPTY_DASHBOARD);
        setError(err instanceof Error ? err.message : 'Failed to load admin dashboard.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    void loadDeadlines();
  }, [loadDeadlines]);

  const totalCases = useMemo(() => (
    dashboard.stageDistribution.reduce((sum, item) => sum + item.count, 0)
  ), [dashboard.stageDistribution]);
  const pendingActions = dashboard.registrationQueueCount
    + dashboard.submissionReviewQueueCount
    + dashboard.clearanceQueueCount
    + dashboard.publishingQueueCount;
  const completedCases = dashboard.stageDistribution.find((item) => item.label === 'Published')?.count ?? 0;
  const upcomingDeadlines = deadlineEvents
    .filter((event) => {
      const rawTime = event.eventTime.length === 5 ? `${event.eventTime}:00` : event.eventTime;
      return new Date(`${event.eventDate}T${rawTime}`).getTime() >= Date.now();
    })
    .slice(0, 4);

  const saveDeadline = async () => {
    if (!deadlineForm.title.trim()) {
      setDeadlineError('Please enter a deadline title.');
      setDeadlineMessage('');
      return;
    }

    setDeadlineSaving(true);
    setDeadlineError('');
    setDeadlineMessage('');
    try {
      await calendarApi.createEvent({
        title: deadlineForm.title.trim(),
        eventDate: deadlineForm.eventDate,
        eventTime: deadlineForm.eventTime,
        eventType: 'DEADLINE',
        deadlineAction: deadlineForm.deadlineAction,
        publicationType: deadlineForm.publicationType,
      });
      setDeadlineMessage('Deadline saved successfully.');
      setDeadlineForm(createDeadlineFormState());
      await loadDeadlines();
    } catch (err) {
      setDeadlineError(err instanceof Error ? err.message : 'Unable to save the deadline.');
    } finally {
      setDeadlineSaving(false);
    }
  };

  return (
    <ShellLayout
      title="Dashboard"
      subtitle="Administrative overview for registration, submission review, clearance, and publication release."
      sidebarBadges={{
        '/admin/registration-approvals': dashboard.registrationQueueCount,
        '/admin/review': dashboard.submissionReviewQueueCount,
        '/admin/clearance': dashboard.clearanceQueueCount,
        '/admin/publish': dashboard.publishingQueueCount,
      }}
    >
      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="su-summary-grid mb-4">
        <SummaryCard label="Total Cases" value={totalCases} />
        <SummaryCard label="Pending Actions" value={pendingActions} />
        <SummaryCard label="Completed" value={completedCases} />
        <SummaryCard label="Revision Required" value={dashboard.revisionRequiredCount} />
      </div>

      <section className="su-section">
        <div className="su-section-header">
          <div>
            <h2 className="su-section-title mb-1">Action Required</h2>
            <p className="su-secondary-text mb-0">Items are ordered by the most urgent administrative queue.</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="su-spinner mx-auto mb-3" />
            <div className="text-muted">Loading dashboard data...</div>
          </div>
        ) : dashboard.needsActionNow.length === 0 ? (
          <EmptyState
            title="No actions pending"
            description="Urgent queue items will appear here when a workflow step needs administrative attention."
          />
        ) : (
          <div className="su-table-shell">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Queue</th>
                  <th>Last Updated</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.needsActionNow.map((item) => (
                  <tr
                    key={`${item.queueKey}-${item.caseId}`}
                    className="su-table-row-clickable"
                    tabIndex={0}
                    onClick={() => navigate(resolveAdminQueuePath(item))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        navigate(resolveAdminQueuePath(item));
                      }
                    }}
                  >
                    <td>
                      <div className="su-table-title">{item.title}</div>
                      <div className="su-secondary-text">{item.detail}</div>
                    </td>
                    <td><StatusBadge status={item.status} /></td>
                    <td>{item.queueLabel}</td>
                    <td>{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'Not available'}</td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(resolveAdminQueuePath(item));
                        }}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="su-support-grid">
        <section className="su-support-card">
          <div className="su-section-header">
            <div>
              <h2 className="su-section-title mb-1">Recent Activity</h2>
              <p className="su-secondary-text mb-0">Latest workflow updates across the repository.</p>
            </div>
          </div>

          {loading ? (
            <div className="text-muted">Loading activity...</div>
          ) : dashboard.recentActivity.length === 0 ? (
            <EmptyState
              title="No recent activity"
              description="Recent workflow events will appear here after cases move between stages."
            />
          ) : (
            <div className="su-support-list">
              {dashboard.recentActivity.map((item) => (
                <ActivityRow key={`${item.caseId}-${item.occurredAt ?? item.detail}`} item={item} />
              ))}
            </div>
          )}
        </section>

        <section className="su-support-card">
          <div className="su-section-header">
            <div>
              <h2 className="su-section-title mb-1">Administrative Calendar</h2>
              <p className="su-secondary-text mb-0">Manage upcoming registration and submission deadlines.</p>
            </div>
          </div>

          {deadlineError ? <div className="alert alert-danger py-2">{deadlineError}</div> : null}
          {deadlineMessage ? <div className="alert alert-success py-2">{deadlineMessage}</div> : null}
          {deadlineLoadError ? <div className="alert alert-warning py-2">{deadlineLoadError}</div> : null}

          <div className="su-form-section mb-3">
            <div className="su-form-grid">
              <div className="su-form-field-full">
                <label className="form-label mb-1">Deadline Title</label>
                <input
                  className="form-control"
                  value={deadlineForm.title}
                  placeholder="Enter deadline title"
                  onChange={(event) => setDeadlineForm((current) => ({ ...current, title: event.target.value }))}
                />
              </div>
              <div>
                <label className="form-label mb-1">Action</label>
                <select
                  className="form-select"
                  value={deadlineForm.deadlineAction}
                  onChange={(event) => setDeadlineForm((current) => ({
                    ...current,
                    deadlineAction: event.target.value as DeadlineActionType,
                  }))}
                >
                  <option value="REGISTRATION_DEADLINE">Registration deadline</option>
                  <option value="SUBMISSION_DEADLINE">Submission deadline</option>
                </select>
              </div>
              <div>
                <label className="form-label mb-1">Publication Type</label>
                <select
                  className="form-select"
                  value={deadlineForm.publicationType}
                  onChange={(event) => setDeadlineForm((current) => ({
                    ...current,
                    publicationType: event.target.value as PublicationType,
                  }))}
                >
                  {ACTIVE_PUBLICATION_TYPES.map((type) => (
                    <option key={type} value={type}>{getPublicationTypeLabel(type)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label mb-1">Date</label>
                <input
                  className="form-control"
                  type="date"
                  value={deadlineForm.eventDate}
                  onChange={(event) => setDeadlineForm((current) => ({ ...current, eventDate: event.target.value }))}
                />
              </div>
              <div>
                <label className="form-label mb-1">Time</label>
                <input
                  className="form-control"
                  type="time"
                  value={deadlineForm.eventTime}
                  onChange={(event) => setDeadlineForm((current) => ({ ...current, eventTime: event.target.value }))}
                />
              </div>
            </div>
            <div className="su-form-actions mt-3">
              <button type="button" className="btn btn-primary" disabled={deadlineSaving} onClick={() => void saveDeadline()}>
                {deadlineSaving ? 'Saving...' : 'Save Deadline'}
              </button>
            </div>
          </div>

          {upcomingDeadlines.length === 0 ? (
            <EmptyState
              title="No upcoming deadlines"
              description="Create a deadline to add it to the administrative calendar."
            />
          ) : (
            <div className="su-support-list">
              {upcomingDeadlines.map((event) => (
                <div key={event.id} className="su-support-list-item">
                  <div className="fw-semibold">{event.title}</div>
                  <div className="su-secondary-text">
                    {getDeadlineActionLabel(event.deadlineAction)} • {getPublicationTypeLabel(event.publicationType)}
                  </div>
                  <div className="su-secondary-text">{formatCalendarEventSchedule(event)}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </ShellLayout>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="su-summary-card">
      <div className="su-secondary-text">{label}</div>
      <div className="su-summary-value">{value}</div>
    </div>
  );
}

function ActivityRow({ item }: { item: DashboardActivityItem }) {
  return (
    <div className="su-support-list-item">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
        <div>
          <div className="fw-semibold">{item.title}</div>
          <div className="su-secondary-text">
            {item.subtitle ? `${item.subtitle} • ` : ''}
            {item.occurredAt ? new Date(item.occurredAt).toLocaleString() : 'Not available'}
          </div>
          <div className="su-table-title">{item.detail}</div>
        </div>
        <StatusBadge status={item.status} />
      </div>
    </div>
  );
}

function resolveAdminQueuePath(item: DashboardActionItem) {
  switch (item.queueKey) {
    case 'registration':
      return '/admin/registration-approvals';
    case 'review':
      return `/admin/review/${item.caseId}`;
    case 'clearance':
      return '/admin/clearance';
    case 'publishing':
      return `/admin/publish/${item.caseId}`;
    default:
      return '/admin/dashboard';
  }
}

function createDeadlineFormState(): DeadlineFormState {
  const now = new Date();
  return {
    title: '',
    deadlineAction: 'REGISTRATION_DEADLINE',
    publicationType: ACTIVE_PUBLICATION_TYPES[0],
    eventDate: toDateInputValue(now),
    eventTime: '09:00',
  };
}
