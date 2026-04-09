import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  findLatestDeadline,
  formatCalendarEventSchedule,
  getPublicationTypeLabel,
  isDeadlinePassed,
} from '../../calendar/calendarUtils';
import ShellLayout from '../../ShellLayout';
import { calendarApi } from '../../lib/api/calendar';
import { studentApi } from '../../lib/api/student';
import DownloadFilenameLink from '../../lib/components/DownloadFilenameLink';
import CaseTimeline from '../../lib/components/CaseTimeline';
import { getRoleDisplayLabel } from '../../lib/uiLabels';
import type {
  CalendarEvent,
  CaseDetailPayload,
  CaseStatus,
  ChecklistResult,
  SubmissionVersion,
  TimelineItem,
  WorkflowComment,
} from '../../lib/workflowTypes';
import {
  canSubmitClearance,
  formatStageName,
  formatStatus,
  getStageIndex,
  getStageKey,
} from '../../lib/workflowUi';

const STAGES = ['registration', 'supervisor', 'library', 'clearance', 'publish'] as const;
const CLEARANCE_ACTION_STATUSES = new Set<CaseStatus>([
  'APPROVED_FOR_CLEARANCE',
  'CLEARANCE_SUBMITTED',
]);

interface FeedbackEntry {
  key: string;
  title: string;
  detail?: string;
  meta: string;
}

export default function StudentCaseDetailPage() {
  const { caseId } = useParams();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<CaseDetailPayload | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [checklist, setChecklist] = useState<ChecklistResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timelineOpen, setTimelineOpen] = useState(false);

  const load = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError('');
    try {
      const [caseDetail, checklistResults] = await Promise.all([
        studentApi.caseDetail(Number(caseId)),
        studentApi.listChecklistResults(Number(caseId)).catch(() => []),
      ]);
      setDetail(caseDetail);
      setChecklist(checklistResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load publication detail.');
      setDetail(null);
      setChecklist([]);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const loadDeadlines = async () => {
      try {
        setCalendarEvents(await calendarApi.listEvents());
      } catch {
        setCalendarEvents([]);
      }
    };

    void loadDeadlines();
  }, []);

  const status = detail?.case.status;
  const stageKey = useMemo(() => (status ? getStageKey(status) : null), [status]);
  const currentStage = useMemo(() => (status ? getStageIndex(status) : 0), [status]);
  const versions = detail?.versions ?? detail?.submissions ?? [];
  const isRejected = stageKey === 'rejected';
  const showClearanceAction = Boolean(status && CLEARANCE_ACTION_STATUSES.has(status));
  const clearanceButtonLabel = status && canSubmitClearance(status) ? 'Submit clearance' : 'Open clearance';
  const pageTitle = detail?.case.title?.trim() ? detail.case.title : 'Untitled Publication';
  const pageSubtitle = detail
    ? `${getPublicationTypeLabel(detail.case.type)} • Current status: ${formatStatus(detail.case.status)}`
    : undefined;
  const submissionDeadline = useMemo(
    () => (detail ? findLatestDeadline(calendarEvents, detail.case.type, 'SUBMISSION_DEADLINE') : null),
    [calendarEvents, detail]
  );
  const submissionDeadlinePassed = isDeadlinePassed(submissionDeadline);
  const feedbackEntries = useMemo(
    () => buildFeedbackEntries(detail?.comments ?? [], checklist),
    [detail?.comments, checklist]
  );

  if (loading) {
    return (
      <ShellLayout title="Publication Detail">
        <div className="text-center py-5">
          <div className="su-spinner mx-auto mb-3" />
          <div className="text-muted">Loading publication details...</div>
        </div>
      </ShellLayout>
    );
  }

  if (error || !detail) {
    return (
      <ShellLayout title="Publication Detail">
        <div className="alert alert-danger">{error || 'Publication detail is unavailable.'}</div>
      </ShellLayout>
    );
  }

  return (
    <ShellLayout title={pageTitle} subtitle={pageSubtitle}>
      {showClearanceAction ? (
        <div className="d-flex justify-content-end mb-3">
          <button
            className="btn btn-primary btn-sm"
            style={{ borderRadius: '999px' }}
            onClick={() => navigate(`/student/clearance/${detail.case.id}`)}
          >
            {clearanceButtonLabel}
          </button>
        </div>
      ) : null}

      {isRejected ? (
        <div className="alert alert-danger" style={{ borderRadius: '0.75rem' }}>
          <strong>Rejected.</strong> Review the feedback and continue the required corrections from the registration page.
        </div>
      ) : null}

      <div className="su-card mb-3 fade-in">
        <div className="card-body p-3">
          <button
            type="button"
            className="su-progress-toggle"
            onClick={() => setTimelineOpen((current) => !current)}
            aria-expanded={timelineOpen}
          >
            <div className="su-progress-toggle-header">
              <div>
                <div className="su-progress-title">Progress</div>
                <div className="su-progress-meta">
                  Current stage: {stageKey ? formatStageName(stageKey) : 'Registration'}
                </div>
              </div>
              <span className="su-progress-toggle-label">
                {timelineOpen ? 'Hide timeline' : 'Show timeline'}
              </span>
            </div>

            <div className="su-stepper">
              {STAGES.map((stage, index) => {
                const isCompleted = currentStage > index;
                const isActive = currentStage === index;
                return (
                  <div
                    key={stage}
                    className={`su-stepper-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}
                  >
                    <div className="su-stepper-dot" aria-hidden="true">{index + 1}</div>
                    <span>{formatStageName(stage)}</span>
                  </div>
                );
              })}
            </div>
          </button>

          {timelineOpen ? (
            <div className="su-progress-timeline">
              <CaseTimeline items={detail.timeline ?? []} emptyLabel="No timeline activity yet." />
            </div>
          ) : null}
        </div>
      </div>

      <div className="su-card mb-3 fade-in" style={{ animationDelay: '0.05s' }}>
        <div className="card-body p-3">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
            <div className="min-w-0">
              <h3 className="h6 su-page-title mb-1">Submission Files</h3>
              <div className="su-dashboard-item-meta">
                {submissionDeadlinePassed && submissionDeadline
                  ? `Submission deadline passed on ${formatCalendarEventSchedule(submissionDeadline)}.`
                  : versions.length > 0
                    ? versions.length === 1
                      ? '1 submission version available.'
                      : `${versions.length} submission versions available.`
                    : 'No files have been uploaded for this publication yet.'}
              </div>
            </div>
            <button
              className="btn btn-primary btn-sm"
              style={{ borderRadius: '999px' }}
              onClick={() => navigate(`/student/cases/${detail.case.id}/submission`)}
              disabled={submissionDeadlinePassed}
            >
              Open submission page
            </button>
          </div>

          {versions.length > 0 ? (
            <div className="su-submission-version-list">
              {versions.map((version) => (
                <div className="su-submission-version-item" key={version.id}>
                  <div className="min-w-0">
                    <div className="su-submission-version-title">
                      Version {version.versionNumber}
                    </div>
                    <div className="su-submission-version-file">
                      <DownloadFilenameLink
                        href={`/api/student/cases/${detail.case.id}/submissions/${version.id}/download`}
                        filename={version.originalFilename || `Submission v${version.versionNumber}`}
                      />
                    </div>
                  </div>
                  <div className="su-submission-version-meta">
                    <div>{formatSubmissionVersionStatus(version)}</div>
                    <div>{version.createdAt ? new Date(version.createdAt).toLocaleString() : 'N/A'}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="su-dashboard-empty-copy mb-0">No files have been uploaded for this publication yet.</p>
          )}
        </div>
      </div>

      <div className="su-card fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="card-body p-3">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
            <div className="min-w-0">
              <h3 className="h6 su-page-title mb-1">Comments &amp; Review Notes</h3>
            </div>
            {feedbackEntries.length > 0 ? (
              <button
                className="btn btn-link btn-sm p-0 text-decoration-none"
                type="button"
                onClick={() => navigate(`/student/cases/${detail.case.id}/feedback`)}
              >
                Open feedback page
              </button>
            ) : null}
          </div>

          {feedbackEntries.length > 0 ? (
            <div className="su-feedback-list">
              {feedbackEntries.map((entry) => (
                <div className="su-feedback-item" key={entry.key}>
                  <div className="su-feedback-meta">{entry.meta}</div>
                  <div className="su-feedback-title">{entry.title}</div>
                  {entry.detail ? <div className="su-feedback-detail">{entry.detail}</div> : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="su-dashboard-empty-copy mb-0">No review notes yet.</p>
          )}
        </div>
      </div>
    </ShellLayout>
  );
}

function buildFeedbackEntries(comments: WorkflowComment[], checklist: ChecklistResult[]): FeedbackEntry[] {
  const commentEntries = comments.map((comment) => ({
    key: `comment-${comment.id}`,
    title: comment.body,
    detail: comment.authorEmail ?? undefined,
    meta: [
      `Comment from ${formatRoleLabel(comment.authorRole)}`,
      comment.createdAt ? new Date(comment.createdAt).toLocaleString() : 'N/A',
    ].join(' • '),
  }));

  const checklistEntries = checklist
    .filter((item) => item.passFail === 'FAIL' || Boolean(item.note?.trim()))
    .map((item) => ({
      key: `checklist-${item.id}`,
      title: item.checklistItem.itemText,
      detail: item.note?.trim() || 'Revision is required for this template item.',
      meta: [
        item.passFail === 'FAIL' ? 'Template item revision' : 'Template item note',
        item.checklistItem.section ?? null,
      ].filter(Boolean).join(' • '),
    }));

  return [...commentEntries, ...checklistEntries];
}

function formatRoleLabel(role?: WorkflowComment['authorRole'] | TimelineItem['actorRole']) {
  return role ? getRoleDisplayLabel(role) : 'Reviewer';
}

function formatSubmissionVersionStatus(version: SubmissionVersion): string {
  return version.status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
