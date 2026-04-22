import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '@/services/api/admin';
import { calendarApi } from '@/services/api/calendar';
import DashboardPanel from '@/shared/ui/DashboardPanel';
import DashboardProgressRingCard from '@/shared/ui/DashboardProgressRingCard';
import StatusBadge from '@/shared/ui/StatusBadge';
import WorkflowStageOverviewCard from '@/shared/ui/WorkflowStageOverviewCard';
import type {
  AdminDashboardData,
  AdminStudentTrackingGroup,
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
  const [studentNameByCaseId, setStudentNameByCaseId] = useState<Record<number, string>>({});
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
        const [dashboardResult, studentGroupsResult] = await Promise.allSettled([
          adminApi.dashboard(),
          adminApi.students(),
        ]);

        if (dashboardResult.status === 'rejected') {
          throw dashboardResult.reason;
        }

        setDashboard(dashboardResult.value);
        setStudentNameByCaseId(
          studentGroupsResult.status === 'fulfilled'
            ? buildStudentNameByCaseId(studentGroupsResult.value)
            : {}
        );
      } catch (err) {
        setDashboard(EMPTY_DASHBOARD);
        setStudentNameByCaseId({});
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

  const completionPercent = useMemo(() => (
    dashboard.totalStudentCount > 0
      ? Math.round((dashboard.publishedStudentCount / dashboard.totalStudentCount) * 100)
      : 0
  ), [dashboard.publishedStudentCount, dashboard.totalStudentCount]);
  const upcomingDeadlines = useMemo(() => (
    deadlineEvents
      .filter((event) => {
        const rawTime = event.eventTime.length === 5 ? `${event.eventTime}:00` : event.eventTime;
        return new Date(`${event.eventDate}T${rawTime}`).getTime() >= Date.now();
      })
      .slice(0, 4)
  ), [deadlineEvents]);
  const visibleNeedsAction = useMemo(
    () => dashboard.needsActionNow.slice(0, 4),
    [dashboard.needsActionNow]
  );
  const visibleRecentActivity = useMemo(
    () => dashboard.recentActivity.slice(0, 4),
    [dashboard.recentActivity]
  );

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
      title="Library Admin Dashboard"
      subtitle="Monitor repository completion, act on urgent queue items, and keep publication workflows moving."
      pageClassName="su-page-shell-dashboard"
      sidebarBadges={{
        '/admin/registration-approvals': dashboard.registrationQueueCount,
        '/admin/review': dashboard.submissionReviewQueueCount,
        '/admin/clearance': dashboard.clearanceQueueCount,
        '/admin/publish': dashboard.publishingQueueCount,
      }}
    >
      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="su-dashboard-content">
        <div className="su-dashboard-grid su-dashboard-grid-3 su-dashboard-top-row su-admin-dashboard-top-row">
          <DashboardProgressRingCard
            title="Repository Completion"
            progressPercent={completionPercent}
            loading={loading}
            primaryText={`${dashboard.publishedStudentCount} of ${dashboard.totalStudentCount} students published`}
            secondaryText={`${dashboard.activeCaseCount} active publication${dashboard.activeCaseCount === 1 ? '' : 's'}`}
          />
          <DashboardPanel title="Needs Action Now" className="w-100">
            {loading ? (
              <p className="su-dashboard-empty-copy mb-0">Loading dashboard data.</p>
            ) : visibleNeedsAction.length === 0 ? (
              <p className="su-dashboard-empty-copy mb-0">No urgent queue items right now.</p>
            ) : (
              <div className="su-dashboard-list">
                {visibleNeedsAction.map((item) => (
                  <button
                    className="su-dashboard-item-button"
                    type="button"
                    key={`${item.queueKey}-${item.caseId}`}
                    onClick={() => navigate(resolveAdminQueuePath(item))}
                  >
                    <div className="su-dashboard-list-item">
                      <AdminNeedsActionItem item={item} studentName={studentNameByCaseId[item.caseId]} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </DashboardPanel>
          <WorkflowStageOverviewCard
            loading={loading}
            stageDistribution={dashboard.stageDistribution}
            emptyText="No workflow records available."
          />
        </div>

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
            ) : visibleRecentActivity.length === 0 ? (
              <p className="su-dashboard-empty-copy mb-0">Recent workflow events will appear here after cases move between stages.</p>
            ) : (
              <div className="su-support-list">
                {visibleRecentActivity.map((item) => (
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
              <p className="su-dashboard-empty-copy mb-0">Create a deadline to add it to the administrative calendar.</p>
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
      </div>
    </ShellLayout>
  );
}

function AdminNeedsActionItem({
  item,
  studentName,
}: {
  item: DashboardActionItem;
  studentName?: string;
}) {
  const primaryLabel = studentName || item.title;
  const secondaryLabel = studentName ? item.title : item.detail;
  const metadataParts = [
    studentName ? item.detail : null,
    item.queueLabel,
    item.updatedAt ? `Updated ${new Date(item.updatedAt).toLocaleString()}` : null,
  ].filter(Boolean);

  return (
    <div className="d-flex justify-content-between gap-3 align-items-start">
      <div className="min-w-0 su-dashboard-activity-copy">
        <div className="su-dashboard-activity-primary">{primaryLabel}</div>
        {secondaryLabel ? <div className="su-dashboard-activity-secondary">{secondaryLabel}</div> : null}
        <div className="su-dashboard-activity-meta">{metadataParts.join(' • ')}</div>
      </div>
      <div className="flex-shrink-0">
        <StatusBadge status={item.status} />
      </div>
    </div>
  );
}

function ActivityRow({ item }: { item: DashboardActivityItem }) {
  const primaryLabel = item.subtitle || item.title;
  const secondaryLabel = item.subtitle ? item.title : item.detail;
  const metadataText = [
    item.subtitle ? item.detail : null,
    item.occurredAt ? new Date(item.occurredAt).toLocaleString() : 'Not available',
  ].filter(Boolean).join(' • ');

  return (
    <div className="su-support-list-item">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
        <div className="min-w-0 su-dashboard-activity-copy">
          <div className="su-dashboard-activity-primary">{primaryLabel}</div>
          <div className="su-dashboard-activity-secondary-row">
            <div className="su-dashboard-activity-secondary">{secondaryLabel}</div>
            {metadataText ? <div className="su-dashboard-activity-meta-inline">{metadataText}</div> : null}
          </div>
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

function buildStudentNameByCaseId(groups: AdminStudentTrackingGroup[]) {
  return groups.reduce<Record<number, string>>((map, group) => {
    group.cases.forEach((publicationCase) => {
      map[publicationCase.caseId] = group.studentName;
    });
    return map;
  }, {});
}
