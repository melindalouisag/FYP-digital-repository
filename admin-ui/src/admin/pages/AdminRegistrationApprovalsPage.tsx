import { useEffect, useState } from 'react';
import { adminApi } from '@/services/api/admin';
import EmptyState from '@/shared/ui/EmptyState';
import StatusBadge from '@/shared/ui/StatusBadge';
import { useConfirmDialog } from '@/shared/ui/useConfirmDialog';
import type { AdminRegistrationApproval, PagedResponse } from '@/types/workflow';
import { formatFacultyName } from '@/utils/facultyLabel';
import ShellLayout from '../../ShellLayout';

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

  useEffect(() => {
    void load(page, setLoading, setError, setPageData, setPage);
  }, [page]);

  const openApproveConfirm = (row: AdminRegistrationApproval) => {
    openConfirm({
      title: 'Approve registration',
      message: `Approve and continue "${displayRegistrationTitle(row.title)}" to the submission stage?`,
      confirmLabel: 'Approve and Continue',
      onConfirm: async (close) => {
        try {
          await adminApi.approveRegistration(row.caseId);
          await load(page, setLoading, setError, setPageData, setPage);
          close();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Approve action failed.');
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
      title: 'Return registration for revision',
      message: `Return "${displayRegistrationTitle(row.title)}" to the student for revision?`,
      confirmLabel: 'Reject Registration',
      confirmVariant: 'secondary',
      onConfirm: async (close) => {
        try {
          await adminApi.rejectRegistration(row.caseId, note);
          await load(page, setLoading, setError, setPageData, setPage);
          close();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Reject action failed.');
        }
      },
    });
  };

  const pageStart = pageData.totalElements === 0 ? 0 : pageData.page * pageData.size + 1;
  const pageEnd = pageStart === 0 ? 0 : pageStart + pageData.items.length - 1;

  return (
    <>
      <ShellLayout
        title="Registration"
        subtitle="Review submitted registrations, approve them for the next stage, or return them with a clear revision note."
      >
        {error ? <div className="alert alert-danger">{error}</div> : null}

        <div className="su-summary-grid mb-4">
          <div className="su-summary-card">
            <div className="su-secondary-text">Pending Cases</div>
            <div className="su-summary-value">{pageData.totalElements}</div>
          </div>
          <div className="su-summary-card">
            <div className="su-secondary-text">Current Page</div>
            <div className="su-summary-value">{pageData.totalElements === 0 ? 0 : pageData.page + 1}</div>
          </div>
          <div className="su-summary-card">
            <div className="su-secondary-text">Faculty Records</div>
            <div className="su-summary-value">{new Set(pageData.items.map((row) => formatFacultyName(row.faculty))).size}</div>
          </div>
          <div className="su-summary-card">
            <div className="su-secondary-text">Visible Rows</div>
            <div className="su-summary-value">{pageData.items.length}</div>
          </div>
        </div>

        <section className="su-section">
          <div className="su-section-header">
            <div>
              <h2 className="su-section-title mb-1">Action Required</h2>
              <p className="su-secondary-text mb-0">Registrations listed here have already passed supervisor approval.</p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <div className="su-spinner mx-auto mb-3" />
              <div className="text-muted">Loading registration queue...</div>
            </div>
          ) : pageData.items.length === 0 ? (
            <EmptyState
              title="No registrations awaiting review"
              description="New registration submissions will appear here after supervisor approval."
            />
          ) : (
            <div className="su-table-shell">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Owner</th>
                    <th>Status</th>
                    <th>Last Updated</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.items.map((row) => (
                    <tr key={row.caseId}>
                      <td>
                        <div className="su-table-title">{displayRegistrationTitle(row.title)}</div>
                        <div className="su-secondary-text">{row.type}</div>
                      </td>
                      <td>
                        <div className="fw-semibold">{row.studentName || row.studentEmail}</div>
                        <div className="su-secondary-text">
                          {row.studentIdNumber || 'Not available'} • {formatFacultyName(row.faculty)} • {row.program || 'Program not available'}
                        </div>
                      </td>
                      <td><StatusBadge status={row.status} /></td>
                      <td>{row.submittedAt ? new Date(row.submittedAt).toLocaleString() : 'Not available'}</td>
                      <td className="text-end">
                        <div className="d-flex flex-column align-items-end gap-2">
                          <div className="d-flex flex-wrap justify-content-end gap-2">
                            <button type="button" className="btn btn-primary" onClick={() => openApproveConfirm(row)}>
                              Approve and Continue
                            </button>
                            <button type="button" className="btn btn-outline-secondary" onClick={() => openRejectConfirm(row)}>
                              Reject Registration
                            </button>
                          </div>
                          <input
                            className="form-control"
                            style={{ width: '280px' }}
                            value={rejectNotes[row.caseId] ?? ''}
                            onChange={(event) => setRejectNotes((current) => ({ ...current, [row.caseId]: event.target.value }))}
                            placeholder="Enter revision note"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {!loading && pageData.totalElements > 0 ? (
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div className="su-secondary-text">Showing {pageStart}-{pageEnd} of {pageData.totalElements}</div>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={!pageData.hasPrevious || loading}
                onClick={() => setPage((current) => Math.max(current - 1, 0))}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={!pageData.hasNext || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </ShellLayout>
      {confirmDialog}
    </>
  );
}

async function load(
  requestedPage: number,
  setLoading: (value: boolean) => void,
  setError: (value: string) => void,
  setPageData: (value: PagedResponse<AdminRegistrationApproval>) => void,
  setPage: (value: number) => void
) {
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
}

function displayRegistrationTitle(value?: string | null) {
  return value?.trim() || 'Untitled registration';
}
