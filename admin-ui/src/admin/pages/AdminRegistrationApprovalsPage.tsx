import { useEffect, useState } from 'react';
import ShellLayout from '../../ShellLayout';
import { adminApi } from '../../lib/api/admin';
import PortalIcon from '../../lib/components/PortalIcon';
import { useConfirmDialog } from '../../lib/components/useConfirmDialog';
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
  const { openConfirm, confirmDialog } = useConfirmDialog();
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
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve action failed.');
      return false;
    }
  };

  const reject = async (caseId: number) => {
    const note = rejectNotes[caseId]?.trim();
    if (!note) {
      setError('Rejection reason is required.');
      return false;
    }
    try {
      await adminApi.rejectRegistration(caseId, note);
      await load(page);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject action failed.');
      return false;
    }
  };

  const rows = pageData.items;
  const displayRegistrationTitle = (value?: string | null) => value?.trim() || 'Untitled registration';
  const pageStart = pageData.totalElements === 0 ? 0 : pageData.page * pageData.size + 1;
  const pageEnd = pageStart === 0 ? 0 : pageStart + rows.length - 1;

  const openApproveConfirm = (row: AdminRegistrationApproval) => {
    openConfirm({
      title: 'Confirm Approval',
      message: (
        <div className="vstack gap-2">
          <div>
            This will verify <strong>{displayRegistrationTitle(row.title)}</strong> and open the submission stage.
          </div>
          <div>Please confirm that the registration is ready for the next workflow step.</div>
        </div>
      ),
      confirmLabel: 'Confirm Approval',
      onConfirm: async (close) => {
        const success = await approve(row.caseId);
        if (success) {
          close();
        }
      },
    });
  };

  const openRejectConfirm = (row: AdminRegistrationApproval) => {
    const note = rejectNotes[row.caseId]?.trim();
    if (!note) {
      setError('Rejection reason is required.');
      return;
    }

    openConfirm({
      title: 'Confirm Revision Request',
      message: (
        <div className="vstack gap-2">
          <div>
            This will return <strong>{displayRegistrationTitle(row.title)}</strong> to the student for revision.
          </div>
          <div>Please confirm that the rejection reason clearly explains what must be corrected.</div>
        </div>
      ),
      confirmLabel: 'Confirm Request Revision',
      confirmVariant: 'secondary',
      onConfirm: async (close) => {
        const success = await reject(row.caseId);
        if (success) {
          close();
        }
      },
    });
  };

  return (
    <>
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

      <div className="vstack gap-3">
        {rows.map((row, index) => (
          <div className="su-card fade-in" key={row.caseId} style={{ animationDelay: `${index * 0.05}s` }}>
            <div className="card-body p-4">
              <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
                <div>
                  <h5 className="fw-bold mb-1">{displayRegistrationTitle(row.title)}</h5>
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
                <button className="btn btn-sm su-action-button su-action-button-primary" onClick={() => openApproveConfirm(row)}>
                  Verify Registration
                </button>
              </div>

              <div className="su-action-panel p-3">
                <label className="form-label mb-1 small fw-semibold">Reason for rejection</label>
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
                  <button className="btn btn-sm su-action-button su-action-button-secondary" style={{ whiteSpace: 'nowrap' }} onClick={() => openRejectConfirm(row)}>
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
      {confirmDialog}
    </>
  );
}
