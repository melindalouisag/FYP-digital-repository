import { useEffect, useState } from 'react';
import ShellLayout from '../../ShellLayout';
import { adminApi } from '../../lib/api/admin';
import PortalIcon from '../../lib/components/PortalIcon';
import { useConfirmDialog } from '../../lib/components/useConfirmDialog';
import { adminSidebarIcons } from '../../lib/portalIcons';
import type { CaseSummary, PagedResponse } from '../../lib/workflowTypes';
import { formatStatus, statusBadgeClass } from '../../lib/workflowUi';

const PAGE_SIZE = 10;

const EMPTY_PAGE: PagedResponse<CaseSummary> = {
  items: [],
  page: 0,
  size: PAGE_SIZE,
  totalElements: 0,
  totalPages: 0,
  hasNext: false,
  hasPrevious: false,
};

export default function AdminClearancePage() {
  const { openConfirm, confirmDialog } = useConfirmDialog();
  const [pageData, setPageData] = useState<PagedResponse<CaseSummary>>(EMPTY_PAGE);
  const [page, setPage] = useState(0);
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [workingCaseId, setWorkingCaseId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = async (requestedPage: number) => {
    setLoading(true);
    setError('');
    try {
      const response = await adminApi.clearanceQueue({ page: requestedPage, size: PAGE_SIZE });
      if (response.totalPages > 0 && requestedPage >= response.totalPages) {
        setPage(response.totalPages - 1);
        return;
      }
      setPageData(response);
    } catch (err) {
      setPageData(EMPTY_PAGE);
      setError(err instanceof Error ? err.message : 'Failed to load clearance queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(page);
  }, [page]);

  const run = async (caseId: number, action: () => Promise<void>) => {
    setWorkingCaseId(caseId);
    setError('');
    try {
      await action();
      await load(page);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
      return false;
    } finally {
      setWorkingCaseId(null);
    }
  };

  const cases = pageData.items;
  const pageStart = pageData.totalElements === 0 ? 0 : pageData.page * pageData.size + 1;
  const pageEnd = pageStart === 0 ? 0 : pageStart + cases.length - 1;
  const displayCaseTitle = (value?: string | null) => value?.trim() || 'Untitled submission';

  const openApproveConfirm = (publicationCase: CaseSummary) => {
    openConfirm({
      title: 'Confirm Approval',
      message: (
        <div className="vstack gap-2">
          <div>
            This will approve clearance for <strong>{displayCaseTitle(publicationCase.title)}</strong> and move the publication to the next stage.
          </div>
          <div>Please confirm that the clearance submission is complete.</div>
        </div>
      ),
      confirmLabel: 'Confirm Approval',
      onConfirm: async (close) => {
        const success = await run(publicationCase.id, () => adminApi.approveClearance(publicationCase.id).then(() => undefined));
        if (success) {
          close();
        }
      },
    });
  };

  const openCorrectionConfirm = (publicationCase: CaseSummary) => {
    const reason = reasons[publicationCase.id]?.trim();
    if (!reason) {
      setError('Correction reason is required.');
      return;
    }

    openConfirm({
      title: 'Confirm Revision Request',
      message: (
        <div className="vstack gap-2">
          <div>
            This will return <strong>{displayCaseTitle(publicationCase.title)}</strong> to the student for clearance correction.
          </div>
          <div>Please confirm that the correction reason clearly explains what must be updated.</div>
        </div>
      ),
      confirmLabel: 'Confirm Request Revision',
      confirmVariant: 'secondary',
      onConfirm: async (close) => {
        const success = await run(publicationCase.id, async () => {
          await adminApi.requestClearanceCorrection(publicationCase.id, reason);
        });
        if (success) {
          close();
        }
      },
    });
  };

  return (
    <>
      <ShellLayout title="Clearance" subtitle="Review submitted clearance forms and either approve them or return them for correction">
        {error && <div className="alert alert-danger" style={{ borderRadius: '0.75rem' }}>{error}</div>}

      {loading && (
        <div className="text-center py-5">
          <div className="su-spinner mx-auto mb-3" />
          <div className="text-muted">Loading clearance queue...</div>
        </div>
      )}

      {!loading && cases.length === 0 && (
        <div className="su-empty-state">
          <div className="su-empty-icon">
            <PortalIcon src={adminSidebarIcons.clearance} size={40} />
          </div>
          <h5>No Clearance Reviews Pending</h5>
          <p className="text-muted">No submitted clearance forms are waiting for library review.</p>
        </div>
      )}

      <div className="vstack gap-3">
        {cases.map((c, index) => {
          const busy = workingCaseId === c.id;
          return (
            <div className="su-card fade-in" key={c.id} style={{ animationDelay: `${index * 0.05}s` }}>
              <div className="card-body p-4">
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
                  <div>
                    <h5 className="fw-bold mb-1">{displayCaseTitle(c.title)}</h5>
                    <div className="d-flex gap-2 align-items-center">
                      <span className={`badge status-badge ${statusBadgeClass(c.status)}`}>{formatStatus(c.status)}</span>
                      <span className="text-muted small">{c.updatedAt ? new Date(c.updatedAt).toLocaleString() : ''}</span>
                    </div>
                  </div>
                  <button
                    className="btn btn-sm su-action-button su-action-button-primary"
                    disabled={busy}
                    onClick={() => openApproveConfirm(c)}
                  >
                    Approve Clearance
                  </button>
                </div>

                <div className="su-action-panel p-3">
                  <label className="form-label mb-1 small fw-semibold">Reason for correction</label>
                  <div className="d-flex gap-2">
                    <input
                      className="form-control form-control-sm"
                      value={reasons[c.id] ?? ''}
                      onChange={(event) =>
                        setReasons((prev) => ({ ...prev, [c.id]: event.target.value }))
                      }
                      placeholder="Enter correction reason"
                      disabled={busy}
                      style={{ borderRadius: '999px' }}
                    />
                    <button
                      className="btn btn-sm su-action-button su-action-button-secondary"
                      style={{ whiteSpace: 'nowrap' }}
                      disabled={busy}
                      onClick={() => openCorrectionConfirm(c)}
                    >
                      Request Correction
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!loading && pageData.totalElements > 0 && (
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-4">
          <div className="text-muted small">
            Showing {pageStart}-{pageEnd} of {pageData.totalElements}
          </div>
          <nav aria-label="Clearance queue pagination">
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
