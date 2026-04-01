import { useEffect, useState } from 'react';
import ShellLayout from '../../ShellLayout';
import { adminApi } from '../../lib/api/admin';
import PortalIcon from '../../lib/components/PortalIcon';
import { adminSidebarIcons } from '../../lib/portalIcons';
import type { AdminRegistrationApproval, PagedResponse } from '../../lib/workflowTypes';
import { formatStatus, statusBadgeClass } from '../../lib/workflowUi';

const PAGE_SIZE = 10;

const EMPTY_PAGE: PagedResponse<AdminRegistrationApproval> = {
  items: [],
  page: 0,
  size: PAGE_SIZE,
  totalElements: 0,
  totalPages: 0,
  hasNext: false,
  hasPrevious: false,
};

export default function AdminRegistrationApprovalsPage() {
  const [pageData, setPageData] = useState<PagedResponse<AdminRegistrationApproval>>(EMPTY_PAGE);
  const [page, setPage] = useState(0);
  const [rejectNotes, setRejectNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (requestedPage: number) => {
    setLoading(true);
    setError('');
    try {
      const response = await adminApi.registrationApprovals({ page: requestedPage, size: PAGE_SIZE });
      if (response.totalPages > 0 && requestedPage >= response.totalPages) {
        setPage(response.totalPages - 1);
        return;
      }
      setPageData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load registration approval queue.');
      setPageData(EMPTY_PAGE);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(page);
  }, [page]);

  const approve = async (caseId: number) => {
    try {
      await adminApi.approveRegistration(caseId);
      await load(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve action failed.');
    }
  };

  const reject = async (caseId: number) => {
    const note = rejectNotes[caseId]?.trim();
    if (!note) {
      setError('Rejection reason is required.');
      return;
    }
    try {
      await adminApi.rejectRegistration(caseId, note);
      await load(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject action failed.');
    }
  };

  const rows = pageData.items;
  const pageStart = pageData.totalElements === 0 ? 0 : pageData.page * pageData.size + 1;
  const pageEnd = pageStart === 0 ? 0 : pageStart + rows.length - 1;

  return (
    <ShellLayout title="Registration Verification" subtitle="Verify registrations after supervisor approval or return them with a reason">
      {error && <div className="alert alert-danger" style={{ borderRadius: '0.75rem' }}>{error}</div>}

      {loading && (
        <div className="text-center py-5">
          <div className="su-spinner mx-auto mb-3" />
          <div className="text-muted">Loading registration queue...</div>
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="su-empty-state">
          <div className="su-empty-icon">
            <PortalIcon src={adminSidebarIcons.registration} size={40} />
          </div>
          <h5>No Registration Verifications Pending</h5>
          <p className="text-muted">No supervisor-approved registrations are waiting for library verification.</p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="mb-3">
          <p className="text-muted small mb-0">
            Use this queue to confirm registration readiness before submission opens, or return the case with a clear reason for correction.
          </p>
        </div>
      )}

      <div className="vstack gap-3">
        {rows.map((row, index) => (
          <div className="su-card fade-in" key={row.caseId} style={{ animationDelay: `${index * 0.05}s` }}>
            <div className="card-body p-4">
              <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
                <div>
                  <h5 className="fw-bold mb-1">{row.title || `Case #${row.caseId}`}</h5>
                  <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
                    <span className="badge bg-dark-subtle text-dark-emphasis" style={{ borderRadius: '999px' }}>{row.type}</span>
                    <span className={`badge status-badge ${statusBadgeClass(row.status)}`}>{formatStatus(row.status)}</span>
                  </div>
                  <div className="su-meta-row">
                    <span className="su-meta-item">
                      <strong>Student:</strong> {row.studentName || row.studentEmail} {row.studentIdNumber ? `(${row.studentIdNumber})` : ''}
                    </span>
                    <span className="su-meta-item">
                      <strong>Faculty:</strong> {row.faculty || 'N/A'} {row.program ? ` / ${row.program}` : ''}
                    </span>
                  </div>
                  <div className="text-muted small mt-1">
                    Submitted: {row.submittedAt ? new Date(row.submittedAt).toLocaleString() : 'N/A'}
                  </div>
                </div>
                <button className="btn btn-success btn-sm" style={{ borderRadius: '999px', padding: '0.4rem 1.2rem' }} onClick={() => void approve(row.caseId)}>
                  Verify Registration
                </button>
              </div>

              <div className="p-3" style={{ background: '#fef3f2', borderRadius: '0.6rem', border: '1px solid #fecaca' }}>
                <label className="form-label mb-1 small fw-semibold" style={{ color: '#dc3545' }}>Reason for rejection</label>
                <div className="d-flex gap-2">
                  <input
                    className="form-control form-control-sm"
                    value={rejectNotes[row.caseId] ?? ''}
                    onChange={(event) =>
                      setRejectNotes((prev) => ({
                        ...prev,
                        [row.caseId]: event.target.value,
                      }))
                    }
                    placeholder="Enter rejection reason"
                    style={{ borderRadius: '999px' }}
                  />
                  <button className="btn btn-outline-danger btn-sm" style={{ borderRadius: '999px', whiteSpace: 'nowrap' }} onClick={() => void reject(row.caseId)}>
                    Reject Registration
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!loading && pageData.totalElements > 0 && (
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-4">
          <div className="text-muted small">
            Showing {pageStart}-{pageEnd} of {pageData.totalElements}
          </div>
          <nav aria-label="Registration approval pagination">
            <ul className="pagination pagination-sm mb-0">
              <li className={`page-item ${!pageData.hasPrevious || loading ? 'disabled' : ''}`}>
                <button
                  className="page-link"
                  type="button"
                  onClick={() => setPage((current) => Math.max(current - 1, 0))}
                  disabled={!pageData.hasPrevious || loading}
                >
                  Previous
                </button>
              </li>
              <li className="page-item disabled">
                <span className="page-link">
                  Page {pageData.page + 1} of {Math.max(pageData.totalPages, 1)}
                </span>
              </li>
              <li className={`page-item ${!pageData.hasNext || loading ? 'disabled' : ''}`}>
                <button
                  className="page-link"
                  type="button"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={!pageData.hasNext || loading}
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
