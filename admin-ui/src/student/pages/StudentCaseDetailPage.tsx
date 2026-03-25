import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ShellLayout from '../../layout/ShellLayout';
import { studentApi } from '../../lib/api/student';
import CaseTimeline from '../../lib/components/CaseTimeline';
import DownloadFilenameLink from '../../lib/components/DownloadFilenameLink';
import PortalIcon from '../../lib/components/PortalIcon';
import { adminSidebarIcons, studentSidebarIcons } from '../../lib/portalIcons';
import type { CaseDetailPayload, CaseStatus, ChecklistResult } from '../../lib/types/workflow';
import { getStudentCaseGuidance, getStudentCaseNextText } from '../lib/casePresentation';
import {
  canSubmitClearance,
  getStageIndex,
  getStageKey,
  formatStatus,
  statusBadgeClass,
  formatStageName,
} from '../../lib/workflowUi';

const STAGES = ['registration', 'supervisor', 'library', 'clearance', 'publish'] as const;

const EDIT_REGISTRATION_STATUSES = new Set<CaseStatus>([
  'REGISTRATION_DRAFT',
  'REGISTRATION_PENDING',
  'REJECTED',
]);

const SUBMIT_REGISTRATION_STATUSES = new Set<CaseStatus>([
  'REGISTRATION_DRAFT',
  'REJECTED',
]);

const SUBMISSION_PAGE_STATUSES = new Set<CaseStatus>([
  'REGISTRATION_VERIFIED',
  'NEEDS_REVISION_SUPERVISOR',
  'NEEDS_REVISION_LIBRARY',
]);

const CLEARANCE_ACTION_STATUSES = new Set<CaseStatus>([
  'APPROVED_FOR_CLEARANCE',
  'CLEARANCE_SUBMITTED',
]);

function getStudentCaseActionVisibility(status: CaseStatus) {
  return {
    showEditRegistration: EDIT_REGISTRATION_STATUSES.has(status),
    showSubmitRegistration: SUBMIT_REGISTRATION_STATUSES.has(status),
    showSubmissionPage: SUBMISSION_PAGE_STATUSES.has(status),
    showClearanceAction: CLEARANCE_ACTION_STATUSES.has(status),
  };
}

function getRegistrationSectionCopy(status: CaseStatus): string {
  switch (status) {
    case 'REGISTRATION_DRAFT':
      return 'Complete the registration details here, then submit the same case when you are ready.';
    case 'REGISTRATION_PENDING':
      return 'Your registration is waiting for supervisor approval. Update the details here only if a correction is needed before approval.';
    case 'REJECTED':
      return 'Review the feedback below, update the registration details, and submit the same case again.';
    default:
      return 'Registration details are shown here for reference. No registration action is required at this stage.';
  }
}

function getSubmissionSectionCopy(status: CaseStatus): string {
  switch (status) {
    case 'REGISTRATION_VERIFIED':
      return 'Open the submission page to upload the first PDF and confirm the repository metadata.';
    case 'NEEDS_REVISION_SUPERVISOR':
    case 'NEEDS_REVISION_LIBRARY':
      return 'Open the submission page to upload a revised PDF after reviewing the latest feedback below.';
    case 'REGISTRATION_DRAFT':
    case 'REGISTRATION_PENDING':
    case 'REGISTRATION_APPROVED':
    case 'REJECTED':
      return 'Submission opens after registration is verified.';
    case 'UNDER_SUPERVISOR_REVIEW':
      return 'Wait for supervisor review.';
    case 'READY_TO_FORWARD':
      return 'Supervisor review is complete. Wait for library handoff.';
    case 'FORWARDED_TO_LIBRARY':
    case 'UNDER_LIBRARY_REVIEW':
      return 'Wait for library review.';
    case 'APPROVED_FOR_CLEARANCE':
    case 'CLEARANCE_SUBMITTED':
    case 'CLEARANCE_APPROVED':
    case 'READY_TO_PUBLISH':
    case 'PUBLISHED':
      return 'Submission review is complete. Uploaded files remain available below for reference.';
  }
}

export default function StudentCaseDetailPage() {
  const { caseId } = useParams();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<CaseDetailPayload | null>(null);
  const [checklist, setChecklist] = useState<ChecklistResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
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
      setError(err instanceof Error ? err.message : 'Failed to load case detail.');
      setDetail(null);
      setChecklist([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [caseId]);

  const status = detail?.case.status;
  const stageKey = useMemo(() => (status ? getStageKey(status) : null), [status]);
  const currentStage = useMemo(() => (status ? getStageIndex(status) : 0), [status]);
  const isRejected = stageKey === 'rejected';
  const actionVisibility = status ? getStudentCaseActionVisibility(status) : null;
  const showClearance = actionVisibility?.showClearanceAction ?? false;
  const clearanceButtonLabel = status && canSubmitClearance(status) ? 'Submit Clearance' : 'Open Clearance';
  const studentActionAvailable = actionVisibility
    ? actionVisibility.showEditRegistration
      || actionVisibility.showSubmitRegistration
      || actionVisibility.showSubmissionPage
      || actionVisibility.showClearanceAction
    : false;
  const currentStepLabel = isRejected ? 'Registration revision' : (stageKey ? formatStageName(stageKey) : 'Registration');
  const nextStepLabel = status ? getStudentCaseNextText(status) : '';
  const nextStepGuidance = status ? getStudentCaseGuidance(status) : '';

  const submitRegistration = async () => {
    if (!caseId) return;
    try {
      await studentApi.submitRegistration(Number(caseId), true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit registration.');
    }
  };

  if (loading) {
    return (
      <ShellLayout title="Case Detail">
        <div className="text-center py-5">
          <div className="su-spinner mx-auto mb-3" />
          <div className="text-muted">Loading case details...</div>
        </div>
      </ShellLayout>
    );
  }

  if (error || !detail) {
    return (
      <ShellLayout title="Case Detail">
        <div className="alert alert-danger">{error || 'Case detail is unavailable.'}</div>
      </ShellLayout>
    );
  }

  return (
    <ShellLayout
      title={detail.case.title || `Case #${detail.case.id}`}
      subtitle={`Case #${detail.case.id} | ${detail.case.type}`}
    >
      {/* Status & Stage */}
      <div className="d-flex flex-wrap align-items-center gap-2 mb-4">
        <span className={`badge status-badge ${statusBadgeClass(detail.case.status)}`} style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem' }}>
          {formatStatus(detail.case.status)}
        </span>
        {stageKey && stageKey !== 'rejected' && (
          <span className="badge bg-light text-muted" style={{ borderRadius: '999px', fontSize: '0.75rem' }}>
            Stage: {formatStageName(stageKey)}
          </span>
        )}
      </div>

      {isRejected && (
        <div className="alert alert-danger" style={{ borderRadius: '0.75rem' }}>
          <div><strong>Rejected.</strong> Review the feedback and update your registration before resubmitting.</div>
        </div>
      )}

      <div className="su-card mb-4 fade-in">
        <div className="card-body">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
            <div>
              <h3 className="h6 mb-1 su-page-title">
                <span className="su-title-with-icon">
                  <PortalIcon src={studentSidebarIcons.dashboard} />
                  <span>Current Step Summary</span>
                </span>
              </h3>
              <p className="small text-muted mb-0">Use this summary first, then review the sections below for details and supporting history.</p>
            </div>
            <span
              className={`badge ${studentActionAvailable ? 'bg-primary-subtle text-primary-emphasis' : 'bg-light text-muted'}`}
              style={{ borderRadius: '999px' }}
            >
              {studentActionAvailable ? 'Student action available now' : 'No student action required now'}
            </span>
          </div>
          <div className="row g-3">
            <div className="col-md-4">
              <div className="small text-uppercase text-muted mb-1">Current step</div>
              <div className="fw-semibold">{currentStepLabel}</div>
            </div>
            <div className="col-md-4">
              <div className="small text-uppercase text-muted mb-1">Recommended next step</div>
              <div className="fw-semibold">{nextStepLabel}</div>
            </div>
            <div className="col-md-4">
              <div className="small text-uppercase text-muted mb-1">What this means</div>
              <div className="small text-muted">{nextStepGuidance}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== WORKFLOW STEPPER ===== */}
      <div className="su-card mb-4 fade-in">
        <div className="card-body">
          <h3 className="h6 mb-3 su-page-title">
            <span className="su-title-with-icon">
              <PortalIcon src={studentSidebarIcons.dashboard} />
              <span>Workflow Progress</span>
            </span>
          </h3>
          <div className="su-stepper">
            {STAGES.map((stage, index) => {
              const isCompleted = currentStage > index;
              const isActive = currentStage === index;
              return (
                <div
                  key={stage}
                  className={`su-stepper-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}
                >
                  <div className="su-stepper-dot">{index + 1}</div>
                  {formatStageName(stage)}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Registration */}
      <div className="su-card mb-3 fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="card-body">
          <h3 className="h6 su-page-title mb-2">
            <span className="su-title-with-icon">
              <PortalIcon src={studentSidebarIcons.registration} />
              <span>Registration</span>
            </span>
          </h3>
          <div className="small text-muted mb-3">{getRegistrationSectionCopy(detail.case.status)}</div>
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <strong>{detail.registration?.title || 'Untitled'}</strong>
            {(actionVisibility?.showEditRegistration || actionVisibility?.showSubmitRegistration) && (
              <div className="d-flex flex-wrap gap-2">
                {actionVisibility?.showEditRegistration && (
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    style={{ borderRadius: '999px' }}
                    onClick={() => navigate(`/student/registrations/${detail.case.id}/edit`)}
                  >
                    Edit Registration
                  </button>
                )}
                {actionVisibility?.showSubmitRegistration && (
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ borderRadius: '999px' }}
                    onClick={() => void submitRegistration()}
                  >
                    Submit for Approval
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Submission Versions */}
      <div className="su-card mb-3 fade-in" style={{ animationDelay: '0.15s' }}>
        <div className="card-body">
          <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
            <h3 className="h6 mb-0 su-page-title">
              <span className="su-title-with-icon">
                <PortalIcon src={studentSidebarIcons.submission} />
                <span>Submission Versions</span>
              </span>
            </h3>
            {actionVisibility?.showSubmissionPage && (
                <button
                  className="btn btn-outline-primary btn-sm"
                  style={{ borderRadius: '999px' }}
                  onClick={() => navigate(`/student/cases/${detail.case.id}/submission`)}
                >
                  Open Submission Page
                </button>
            )}
          </div>
          <div className="small text-muted mb-3">{getSubmissionSectionCopy(detail.case.status)}</div>
          {(detail.versions || []).length === 0 ? (
            <div className="text-muted small text-center py-3">No files have been uploaded for this case yet.</div>
          ) : (
            <div className="vstack gap-2">
              {(detail.versions || []).map((version) => (
                <div className="d-flex justify-content-between align-items-center p-2 px-3" key={version.id}
                  style={{ background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e8eff5' }}>
                  <div>
                    <span className="fw-semibold">v{version.versionNumber}</span>
                    <span className="text-muted mx-1">—</span>
                    <DownloadFilenameLink
                      href={`/api/student/cases/${detail.case.id}/submissions/${version.id}/download`}
                      filename={version.originalFilename || `Submission v${version.versionNumber}`}
                    />
                    <div className="text-muted small">
                      Uploaded: {version.createdAt ? new Date(version.createdAt).toLocaleString() : 'N/A'}
                    </div>
                  </div>
                  <span className={`badge ${version.status === 'APPROVED' ? 'bg-success' : 'bg-secondary'}`} style={{ borderRadius: '999px' }}>
                    {version.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Checklist */}
      <div className="su-card mb-3 fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="card-body">
          <h3 className="h6 su-page-title mb-3">Checklist Results</h3>
          <div className="small text-muted mb-3">
            Review library checklist outcomes here. Failed items and notes usually explain why revisions were requested.
          </div>
          {checklist.length === 0 ? (
            <div className="text-muted small text-center py-3">Checklist review has not started yet.</div>
          ) : (
            <div className="vstack gap-2">
              {checklist.map((result) => (
                <div className="d-flex justify-content-between align-items-center p-2 px-3" key={result.id}
                  style={{ background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e8eff5' }}>
                  <div>
                    <div className="fw-semibold">{result.checklistItem?.itemText || `Item #${result.id}`}</div>
                    {result.note && <div className="text-muted small">{result.note}</div>}
                  </div>
                  <span className={`badge ${result.passFail === 'PASS' ? 'bg-success' : 'bg-danger'}`} style={{ borderRadius: '999px' }}>
                    {result.passFail}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Clearance */}
      {showClearance && (
        <div className="su-card mb-3 fade-in" style={{ animationDelay: '0.25s' }}>
          <div className="card-body">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div>
                <h3 className="h6 mb-1 su-page-title">
                  <span className="su-title-with-icon">
                    <PortalIcon src={adminSidebarIcons.clearance} />
                    <span>Library Clearance</span>
                  </span>
                </h3>
                <p className="small text-muted mb-0">
                  {canSubmitClearance(detail.case.status)
                    ? 'Submit the clearance form now to move the case toward publication.'
                    : 'Open the clearance form to review what you submitted and wait for clearance approval.'}
                </p>
              </div>
              <button
                className="btn btn-primary btn-sm"
                style={{ borderRadius: '999px' }}
                onClick={() => navigate(`/student/clearance/${detail.case.id}`)}
              >
                {clearanceButtonLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comments */}
      <div className="su-card mb-3 fade-in" style={{ animationDelay: '0.3s' }}>
        <div className="card-body">
          <h3 className="h6 su-page-title mb-3">Comments</h3>
          <div className="small text-muted mb-3">
            Use comments to review feedback from supervisors and library staff.
          </div>
          {(detail.comments || []).length === 0 ? (
            <div className="text-muted small text-center py-3">No staff comments have been added yet.</div>
          ) : (
            <div className="vstack gap-2">
              {(detail.comments || []).map((comment) => (
                <div className="p-3" key={comment.id}
                  style={{ background: '#f8fafc', borderRadius: '0.6rem', border: '1px solid #e8eff5' }}>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <div className="fw-semibold small">
                      {comment.authorRole}
                      {comment.authorEmail ? ` — ${comment.authorEmail}` : ''}
                    </div>
                    <div className="text-muted small">
                      {comment.createdAt ? new Date(comment.createdAt).toLocaleString() : 'N/A'}
                    </div>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{comment.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="su-card fade-in" style={{ animationDelay: '0.35s' }}>
        <div className="card-body">
          <h3 className="h6 mb-3 su-page-title">Activity Timeline</h3>
          <div className="small text-muted mb-3">
            This timeline shows the case history so you can confirm what has already been completed.
          </div>
          <CaseTimeline items={detail.timeline ?? []} />
        </div>
      </div>
    </ShellLayout>
  );
}
