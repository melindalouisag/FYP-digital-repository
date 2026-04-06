import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ShellLayout from '../../ShellLayout';
import {
  compareCalendarEvents,
  formatCalendarEventSchedule,
  getDeadlineActionLabel,
  getPublicationTypeLabel,
  toDateInputValue,
} from '../../calendar/calendarUtils';
import { calendarApi } from '../../lib/api/calendar';
import DashboardPanel from '../../lib/components/DashboardPanel';
import DashboardProgressRingCard from '../../lib/components/DashboardProgressRingCard';
import DashboardMetricCard from '../../lib/components/DashboardMetricCard';
import { adminApi } from '../../lib/api/admin';
import { adminSidebarIcons } from '../../lib/portalIcons';
import type { AdminDashboardData, CalendarEvent, DashboardActionItem, DeadlineActionType, PublicationType } from '../../lib/workflowTypes';
import { formatStatus, statusBadgeClass } from '../../lib/workflowUi';

const EMPTY_DASHBOARD: AdminDashboardData = {
  workflowProgressPercent: 0,
  activeCaseCount: 0,
  publishedStudentCount: 0,
  totalStudentCount: 0,
  registrationQueueCount: 0,
  submissionReviewQueueCount: 0,
  clearanceQueueCount: 0,
  publishingQueueCount: 0,
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

interface DashboardMetricSummaryCard {
  title: string;
  value: number | string;
  iconSrc: string;
  detail?: string;
  onClick?: () => void;
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
      setDeadlineEvents(
        rows
          .filter((event) => event.eventType === 'DEADLINE')
          .sort(compareCalendarEvents)
      );
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

  const maxStageCount = useMemo(
    () => Math.max(...dashboard.stageDistribution.map((item) => item.count), 1),
    [dashboard.stageDistribution]
  );
  const upcomingDeadlines = useMemo(
    () => deadlineEvents
      .filter((event) => {
        const rawTime = event.eventTime.length === 5 ? `${event.eventTime}:00` : event.eventTime;
        return new Date(`${event.eventDate}T${rawTime}`).getTime() >= Date.now();
      })
      .slice(0, 4),
    [deadlineEvents]
  );
  const completionPercent = useMemo(() => (
    dashboard.totalStudentCount > 0
      ? Math.round((dashboard.publishedStudentCount / dashboard.totalStudentCount) * 100)
      : null
  ), [dashboard.publishedStudentCount, dashboard.totalStudentCount]);

  const queueCards: DashboardMetricSummaryCard[] = [
    {
      title: 'Registration Queue',
      value: dashboard.registrationQueueCount,
      iconSrc: adminSidebarIcons.registration,
      onClick: () => navigate('/admin/registration-approvals'),
    },
    {
      title: 'Submission Review Queue',
      value: dashboard.submissionReviewQueueCount,
      iconSrc: adminSidebarIcons.submission,
      onClick: () => navigate('/admin/review'),
    },
    {
      title: 'Clearance Queue',
      value: dashboard.clearanceQueueCount,
      iconSrc: adminSidebarIcons.clearance,
      onClick: () => navigate('/admin/clearance'),
    },
    {
      title: 'Publishing Queue',
      value: dashboard.publishingQueueCount,
      iconSrc: adminSidebarIcons.publishing,
      onClick: () => navigate('/admin/publish'),
    },
  ];

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
    <ShellLayout title="Admin Dashboard" subtitle="Library administration overview for registration, review, clearance, and publishing">
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="su-dashboard-grid su-dashboard-grid-5 mb-4">
        <DashboardProgressRingCard
          title="Repository Completion"
          progressPercent={completionPercent}
          loading={loading}
          emptyText="No workflow records yet."
          primaryText={`${dashboard.publishedStudentCount} of ${dashboard.totalStudentCount} students published`}
          secondaryText={`${dashboard.activeCaseCount} active publication${dashboard.activeCaseCount === 1 ? '' : 's'}`}
        />
        {queueCards.map((card) => (
          <DashboardMetricCard
            key={card.title}
            iconSrc={card.iconSrc}
            iconBackground="rgba(11, 117, 132, 0.10)"
            label={card.title}
            value={loading ? '—' : card.value}
            description={card.detail}
            onClick={card.onClick}
          />
        ))}
      </div>

      <div className="mb-4">
        <DashboardPanel title="Add Event" className="su-dashboard-panel-auto-height" bodyClassName="su-dashboard-panel-body-auto-height">
          {deadlineError ? <div className="alert alert-danger py-2 mb-0">{deadlineError}</div> : null}
          {deadlineMessage ? <div className="alert alert-success py-2 mb-0">{deadlineMessage}</div> : null}
          {deadlineLoadError ? <div className="alert alert-warning py-2 mb-0">{deadlineLoadError}</div> : null}

          <div className="su-dashboard-form-panel">
            <div className="row g-2">
              <div className="col-12 col-xl-4">
                <label className="form-label mb-1">Deadline title</label>
                <input
                  className="form-control form-control-sm"
                  value={deadlineForm.title}
                  placeholder="Input event title..."
                  onChange={(event) => setDeadlineForm((current) => ({ ...current, title: event.target.value }))}
                />
              </div>
              <div className="col-6 col-xl-2">
                <label className="form-label mb-1">Action</label>
                <select
                  className="form-select form-select-sm"
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
              <div className="col-6 col-xl-2">
                <label className="form-label mb-1">Type</label>
                <select
                  className="form-select form-select-sm"
                  value={deadlineForm.publicationType}
                  onChange={(event) => setDeadlineForm((current) => ({
                    ...current,
                    publicationType: event.target.value as PublicationType,
                  }))}
                >
                  {PUBLICATION_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {getPublicationTypeLabel(option)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-6 col-xl-2">
                <label className="form-label mb-1">Date</label>
                <input
                  className="form-control form-control-sm"
                  type="date"
                  value={deadlineForm.eventDate}
                  onChange={(event) => setDeadlineForm((current) => ({ ...current, eventDate: event.target.value }))}
                />
              </div>
              <div className="col-6 col-xl-2">
                <label className="form-label mb-1">Time</label>
                <input
                  className="form-control form-control-sm"
                  type="time"
                  value={deadlineForm.eventTime}
                  onChange={(event) => setDeadlineForm((current) => ({ ...current, eventTime: event.target.value }))}
                />
              </div>
              <div className="col-12 d-flex justify-content-end">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => void saveDeadline()}
                  disabled={deadlineSaving}
                >
                  {deadlineSaving ? 'Saving...' : 'Save deadline'}
                </button>
              </div>
            </div>
          </div>

          <div className="su-dashboard-subsection">
            <h3 className="su-dashboard-subtitle">Upcoming deadlines</h3>
            {upcomingDeadlines.length > 0 ? (
              <div className="su-dashboard-list">
                {upcomingDeadlines.map((event) => (
                  <div className="su-dashboard-list-item" key={event.id}>
                    <div className="d-flex justify-content-between gap-2 align-items-start">
                      <div className="min-w-0">
                        <div className="su-dashboard-item-title">{event.title}</div>
                        <div className="su-dashboard-item-support">
                          {getDeadlineActionLabel(event.deadlineAction)} • {getPublicationTypeLabel(event.publicationType)}
                        </div>
                        <div className="su-dashboard-item-meta">{formatCalendarEventSchedule(event)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="su-dashboard-empty-copy mb-0">No deadlines scheduled.</p>
            )}
          </div>
        </DashboardPanel>
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-6 d-flex">
          <DashboardPanel title="Needs Action Now" className="w-100">
            {loading ? (
              <p className="su-dashboard-empty-copy mb-0">Loading dashboard data.</p>
            ) : dashboard.needsActionNow.length === 0 ? (
              <p className="su-dashboard-empty-copy mb-0">No urgent queue items right now.</p>
            ) : (
              <div className="su-dashboard-list">
                {dashboard.needsActionNow.map((item) => (
                  <button
                    className="su-dashboard-item-button"
                    type="button"
                    key={`${item.queueKey}-${item.caseId}`}
                    onClick={() => navigate(resolveAdminQueuePath(item))}
                  >
                    <div className="su-dashboard-list-item">
                      <div className="d-flex justify-content-between gap-2 align-items-start">
                        <div className="min-w-0">
                          <div className="su-dashboard-item-title su-text-truncate">{item.title}</div>
                          <div className="su-dashboard-item-support">{item.detail}</div>
                          <div className="su-dashboard-item-meta">
                            {item.queueLabel}
                            {item.updatedAt ? ` • Updated ${new Date(item.updatedAt).toLocaleString()}` : ''}
                          </div>
                        </div>
                        <span className={`badge status-badge ${statusBadgeClass(item.status)}`}>
                          {formatStatus(item.status)}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </DashboardPanel>
        </div>

        <div className="col-12 col-xl-6 d-flex">
          <DashboardPanel title="Stage Distribution" className="w-100">
            {loading ? (
              <p className="su-dashboard-empty-copy mb-0">Loading dashboard data.</p>
            ) : dashboard.stageDistribution.length === 0 ? (
              <p className="su-dashboard-empty-copy mb-0">No workflow records available.</p>
            ) : (
              <div className="su-dashboard-bars">
                {dashboard.stageDistribution.map((item) => (
                  <div className="su-dashboard-bar-row" key={item.label}>
                    <div className="d-flex justify-content-between gap-2 mb-2">
                      <span className="su-dashboard-bar-label">{item.label}</span>
                      <span className="su-dashboard-bar-value">{item.count}</span>
                    </div>
                    <div className="su-dashboard-bar-track" aria-hidden="true">
                      <div
                        className="su-dashboard-bar-fill"
                        style={{ width: `${maxStageCount === 0 ? 0 : (item.count / maxStageCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashboardPanel>
        </div>
      </div>
    </ShellLayout>
  );
}

const PUBLICATION_TYPE_OPTIONS: PublicationType[] = ['THESIS', 'ARTICLE', 'INTERNSHIP_REPORT', 'OTHER'];

function createDeadlineFormState(): DeadlineFormState {
  return {
    title: '',
    deadlineAction: 'REGISTRATION_DEADLINE',
    publicationType: 'THESIS',
    eventDate: toDateInputValue(new Date()),
    eventTime: '17:00',
  };
}

function resolveAdminQueuePath(item: DashboardActionItem): string {
  switch (item.queueKey) {
    case 'registration':
      return '/admin/registration-approvals';
    case 'review':
      return '/admin/review';
    case 'clearance':
      return '/admin/clearance';
    case 'publishing':
      return '/admin/publish';
  }
}
