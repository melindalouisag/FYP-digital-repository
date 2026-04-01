import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ShellLayout from '../../ShellLayout';
import { studentApi } from '../../lib/api/student';
import CaseTimeline from '../../lib/components/CaseTimeline';
import type { CaseDetailPayload, CaseStatus, ChecklistResult } from '../../lib/workflowTypes';
import {
  canSubmitClearance,
  formatStageName,
  formatStatus,
  getStageIndex,
  getStageKey,
  getWorkflowStatusPresentation,
  getWorkflowToneClass,
  statusBadgeClass,
} from '../../lib/workflowUi';

const STAGES = ['registration', 'supervisor', 'library', 'clearance', 'publish'] as const;
const CLEARANCE_ACTION_STATUSES = new Set<CaseStatus>([
  'APPROVED_FOR_CLEARANCE',
  'CLEARANCE_SUBMITTED',
]);

export default function StudentCaseDetailPage() {
  const { caseId } = useParams();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<CaseDetailPayload | null>(null);
  const [checklist, setChecklist] = useState<ChecklistResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      setError(err instanceof Error ? err.message : 'Failed to load case detail.');
      setDetail(null);
      setChecklist([]);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const status = detail?.case.status;
  const stageKey = useMemo(() => (status ? getStageKey(status) : null), [status]);
  const currentStage = useMemo(() => (status ? getStageIndex(status) : 0), [status]);
  const versions = detail?.versions ?? detail?.submissions ?? [];
  const isRejected = stageKey === 'rejected';
  const showClearanceAction = Boolean(status && CLEARANCE_ACTION_STATUSES.has(status));
  const clearanceButtonLabel = status && canSubmitClearance(status) ? 'Submit clearance' : 'Open clearance';
  const submissionVersionLabel = versions.length === 1 ? '1 submission version' : `${versions.length} submission versions`;
  const hasFeedback = checklist.length > 0 || (detail?.comments?.length ?? 0) > 0;
  const pageTitle = detail?.case.title?.trim() ? detail.case.title : 'Untitled Publication';
  const presentation = status ? getWorkflowStatusPresentation(status) : null;

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
    <ShellLayout title={pageTitle} subtitle={detail.case.type}>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-4">
        <span
          className={`badge status-badge ${statusBadgeClass(detail.case.status)}`}
          style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem' }}
        >
          {formatStatus(detail.case.status)}
        </span>
        {stageKey && stageKey !== 'rejected' && (
          <span
            className="badge bg-light text-muted"
            style={{ borderRadius: '999px', fontSize: '0.75rem' }}
          >
            Stage: {formatStageName(stageKey)}
          </span>
        )}
        {showClearanceAction && (
          <button
            className="btn btn-primary btn-sm ms-sm-auto"
            style={{ borderRadius: '999px' }}
            onClick={() => navigate(`/student/clearance/${detail.case.id}`)}
          >
            {clearanceButtonLabel}
          </button>
        )}
      </div>

      {isRejected && (
        <div className="alert alert-danger" style={{ borderRadius: '0.75rem' }}>
          <div><strong>Rejected.</strong> Review the feedback and continue the required corrections from the registration page.</div>
        </div>
      )}

      {presentation && (
        <div className={`alert ${getWorkflowToneClass(detail.case.status)} border-0 mb-4`} style={{ borderRadius: '0.9rem' }}>
          <div className="fw-semibold mb-1">Next action</div>
          <div className="mb-2">{presentation.nextAction}</div>
          <div className="small">
            {presentation.description} Responsible now: {presentation.actor}.
          </div>
        </div>
      )}

      <div className="su-card mb-4 fade-in">
        <div className="card-body">
          <h3 className="h6 mb-3 su-page-title">Progress Summary</h3>
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

      <div className="su-card mb-3 fade-in" style={{ animationDelay: '0.05s' }}>
        <div className="card-body">
          <h3 className="h6 su-page-title mb-3">Submission</h3>
          <div className="vstack gap-3">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 pb-3" style={{ borderBottom: '1px solid #eef3f7' }}>
              <div>
                <div className="fw-semibold">Open submission page</div>
                <div className="small text-muted">
                  Upload the current PDF and confirm the repository metadata for this publication.
                </div>
              </div>
              <button
                className="btn btn-primary btn-sm"
                style={{ borderRadius: '999px' }}
                onClick={() => navigate(`/student/cases/${detail.case.id}/submission`)}
              >
                Open submission page
              </button>
            </div>

            <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 pb-3" style={{ borderBottom: '1px solid #eef3f7' }}>
              <div>
                <div className="fw-semibold">Submission History</div>
                <div className="small text-muted">
                  Review submitted versions and download previous files from one place.
                </div>
              </div>
              <button
                className="btn btn-link btn-sm p-0 text-decoration-none"
                onClick={() => navigate(`/student/cases/${detail.case.id}/submissions/history`)}
              >
                {submissionVersionLabel}
              </button>
            </div>

            <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
              <div>
                <div className="fw-semibold">Feedback</div>
                <div className="small text-muted">
                  Review comments, checklist outcomes, and revision notes that apply to this case.
                </div>
              </div>
              {hasFeedback ? (
                <button
                  className="btn btn-link btn-sm p-0 text-decoration-none"
                  onClick={() => navigate(`/student/cases/${detail.case.id}/feedback`)}
                >
                  View feedback
                </button>
              ) : (
                <span className="small text-muted">No feedback yet</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="su-card fade-in" style={{ animationDelay: '0.1s' }}>
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
