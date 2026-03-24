import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ShellLayout from '../../layout/ShellLayout';
import { studentApi } from '../../lib/api/student';
import type { CaseStatus, CaseSummary } from '../../lib/types/workflow';
import { canUploadSubmission, formatStatus, statusBadgeClass } from '../../lib/workflowUi';
import StudentCaseWorkflowProgress from '../components/StudentCaseWorkflowProgress';
import {
  isNavigationActivationKey,
  isSubmissionWorkspaceCase,
  resolveStudentCaseNavigation,
  sortCasesByRecentActivity,
} from '../lib/caseNavigation';

const PAGE_SIZE = 10;

export default function StudentSubmissionsPage() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setCases(await studentApi.listCases());
    } catch (err) {
      setCases([]);
      setError(err instanceof Error ? err.message : 'Unable to load submissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const statusHint: Partial<Record<CaseStatus, string>> = {
    REGISTRATION_VERIFIED: '📄 Registration verified — ready for first upload',
    UNDER_SUPERVISOR_REVIEW: '⏳ Uploaded files are under supervisor review',
    NEEDS_REVISION_SUPERVISOR: '🛠️ Supervisor requested revisions — upload an updated file',
    READY_TO_FORWARD: '✅ Supervisor approved — waiting library handoff',
    FORWARDED_TO_LIBRARY: '🏛️ Forwarded to library review',
    UNDER_LIBRARY_REVIEW: '⏳ Uploaded files are under library review',
    NEEDS_REVISION_LIBRARY: '🛠️ Library requested revisions — upload an updated file',
    APPROVED_FOR_CLEARANCE: '🏛️ Submission accepted — continue to clearance tracking',
    CLEARANCE_SUBMITTED: '⏳ Clearance submitted — waiting final approval',
    CLEARANCE_APPROVED: '✅ Clearance approved — tracking final release',
    READY_TO_PUBLISH: '🚀 Ready for repository publication',
  };

  const submissionCases = useMemo(
    () => sortCasesByRecentActivity(cases.filter((c) => isSubmissionWorkspaceCase(c.status))),
    [cases]
  );
  const totalPages = Math.max(Math.ceil(submissionCases.length / PAGE_SIZE), 1);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages - 1));
  }, [totalPages]);

  const visibleCases = useMemo(() => {
    const start = page * PAGE_SIZE;
    return submissionCases.slice(start, start + PAGE_SIZE);
  }, [page, submissionCases]);
  const pageStart = submissionCases.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const pageEnd = pageStart === 0 ? 0 : pageStart + visibleCases.length - 1;
  const hasPrevious = page > 0;
  const hasNext = page + 1 < totalPages;

  return (
    <ShellLayout title="Submission" subtitle="Work on submission-stage cases you can upload, revise, or track">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <button className="btn btn-outline-secondary btn-sm" style={{ borderRadius: '999px' }} onClick={() => void load()} disabled={loading}>
          {loading ? '⏳ Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {!loading && submissionCases.length === 0 && (
        <div className="su-empty-state">
          <div className="su-empty-icon">📄</div>
          <h5>No Submission-Stage Cases Yet</h5>
          <p className="text-muted">Cases will appear here after registration verification or while submissions are under review.</p>
        </div>
      )}

      {submissionCases.length > 0 && (
        <div className="mb-3">
          <p className="text-muted small mb-0">
            This workspace only shows cases that are ready for upload, need revision, or are being tracked through submission review.
          </p>
        </div>
      )}

      {submissionCases.length > 0 && (
        <div className="table-responsive su-card">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Case</th>
                <th>Type</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Next</th>
              </tr>
            </thead>
            <tbody>
              {visibleCases.map((c) => {
                const canUpload = canUploadSubmission(c.status);
                const navigationTarget = resolveStudentCaseNavigation(c, 'submissions');
                return (
                  <tr
                    key={c.id}
                    className="su-table-row-clickable"
                    tabIndex={0}
                    aria-label={`${navigationTarget.label}: ${c.title || `Case #${c.id}`}`}
                    onClick={() => navigate(navigationTarget.path)}
                    onKeyDown={(event) => {
                      if (!isNavigationActivationKey(event)) return;
                      event.preventDefault();
                      navigate(navigationTarget.path);
                    }}
                  >
                    <td>
                      <div className="fw-semibold">{c.title || `Case #${c.id}`}</div>
                      <StudentCaseWorkflowProgress status={c.status} className="mt-2" />
                    </td>
                    <td><span className="badge bg-dark-subtle text-dark-emphasis" style={{ borderRadius: '999px' }}>{c.type}</span></td>
                    <td>
                      <span className={`badge status-badge ${statusBadgeClass(c.status)}`}>
                        {formatStatus(c.status)}
                      </span>
                    </td>
                    <td className="text-muted small">{c.updatedAt ? new Date(c.updatedAt).toLocaleString() : 'N/A'}</td>
                    <td>
                      <div className="fw-semibold small text-body-secondary">Next: {navigationTarget.label}</div>
                      {statusHint[c.status] && (
                        <div className="small text-muted mt-1">{statusHint[c.status]}</div>
                      )}
                      {!statusHint[c.status] && !canUpload && (
                        <div className="small text-muted mt-1">Track the current submission-stage progress from case detail.</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && submissionCases.length > 0 && (
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-4">
          <div className="text-muted small">
            Showing {pageStart}-{pageEnd} of {submissionCases.length}
          </div>
          <nav aria-label="Submission list pagination">
            <ul className="pagination pagination-sm mb-0">
              <li className={`page-item ${!hasPrevious || loading ? 'disabled' : ''}`}>
                <button
                  className="page-link"
                  type="button"
                  onClick={() => setPage((current) => Math.max(current - 1, 0))}
                  disabled={!hasPrevious || loading}
                >
                  Previous
                </button>
              </li>
              <li className="page-item disabled">
                <span className="page-link">
                  Page {page + 1} of {totalPages}
                </span>
              </li>
              <li className={`page-item ${!hasNext || loading ? 'disabled' : ''}`}>
                <button
                  className="page-link"
                  type="button"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={!hasNext || loading}
                >
                  Next
                </button>
              </li>
            </ul>
          </nav>
        </div>
      )}
    </ShellLayout>
  );
}
