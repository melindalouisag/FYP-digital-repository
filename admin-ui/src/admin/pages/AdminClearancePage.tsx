import { useEffect, useState } from 'react';
import { adminApi } from '@/services/api/admin';
import EmptyState from '@/shared/ui/EmptyState';
import StatusBadge from '@/shared/ui/StatusBadge';
import { useConfirmDialog } from '@/shared/ui/useConfirmDialog';
import type { CaseSummary, PagedResponse } from '@/types/workflow';
import ShellLayout from '../../ShellLayout';

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

  useEffect(() => {
    void load(page, setLoading, setError, setPageData, setPage);
  }, [page]);

  const openApproveConfirm = (publicationCase: CaseSummary) => {
    openConfirm({
      title: 'Approve clearance',
      message: `Approve and continue "${displayCaseTitle(publicationCase.title)}" to the publishing stage?`,
      confirmLabel: 'Approve and Continue',
      onConfirm: async (close) => {
        const success = await runCaseAction(publicationCase.id, setWorkingCaseId, setError, async () => {
          await adminApi.approveClearance(publicationCase.id);
          await load(page, setLoading, setError, setPageData, setPage);
        });
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
      title: 'Return for correction',
      message: `Return "${displayCaseTitle(publicationCase.title)}" for clearance correction?`,
      confirmLabel: 'Request Correction',
      confirmVariant: 'secondary',
      onConfirm: async (close) => {
        const success = await runCaseAction(publicationCase.id, setWorkingCaseId, setError, async () => {
          await adminApi.requestClearanceCorrection(publicationCase.id, reason);
          await load(page, setLoading, setError, setPageData, setPage);
        });
        if (success) {
          close();
        }
      },
    });
  };

  const pageStart = pageData.totalElements === 0 ? 0 : pageData.page * pageData.size + 1;
  const pageEnd = pageStart === 0 ? 0 : pageStart + pageData.items.length - 1;

  return (
    <>
      <ShellLayout
        title="Clearance"
        subtitle="Review submitted clearance forms and either approve them for publication or return them with a correction note."
      >
        {error ? <div className="alert alert-danger">{error}</div> : null}

        <div className="su-summary-grid mb-4">
          <div className="su-summary-card">
            <div className="su-secondary-text">Pending Cases</div>
            <div className="su-summary-value">{pageData.totalElements}</div>
          </div>
          <div className="su-summary-card">
            <div className="su-secondary-text">Visible Rows</div>
            <div className="su-summary-value">{pageData.items.length}</div>
          </div>
          <div className="su-summary-card">
            <div className="su-secondary-text">Current Page</div>
            <div className="su-summary-value">{pageData.totalElements === 0 ? 0 : pageData.page + 1}</div>
          </div>
          <div className="su-summary-card">
            <div className="su-secondary-text">Action Needed</div>
            <div className="su-summary-value">{pageData.items.length}</div>
          </div>
        </div>

        <section className="su-section">
          <div className="su-section-header">
            <div>
              <h2 className="su-section-title mb-1">Action Required</h2>
              <p className="su-secondary-text mb-0">Submitted clearance forms are listed from the most recent update.</p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <div className="su-spinner mx-auto mb-3" />
              <div className="text-muted">Loading clearance queue...</div>
            </div>
          ) : pageData.items.length === 0 ? (
            <EmptyState
              title="No clearance reviews pending"
              description="Submitted clearance forms will appear here when students send them for review."
            />
          ) : (
            <div className="su-table-shell">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Last Updated</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.items.map((item) => {
                    const busy = workingCaseId === item.id;
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="su-table-title">{displayCaseTitle(item.title)}</div>
                          <div className="su-secondary-text">{item.type}</div>
                        </td>
                        <td><StatusBadge status={item.status} /></td>
                        <td>{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'Not available'}</td>
                        <td className="text-end">
                          <div className="d-flex flex-column align-items-end gap-2">
                            <div className="d-flex flex-wrap justify-content-end gap-2">
                              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => openApproveConfirm(item)}>
                                Approve and Continue
                              </button>
                              <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => openCorrectionConfirm(item)}>
                                Request Correction
                              </button>
                            </div>
                            <input
                              className="form-control"
                              style={{ width: '280px' }}
                              disabled={busy}
                              value={reasons[item.id] ?? ''}
                              onChange={(event) => setReasons((current) => ({ ...current, [item.id]: event.target.value }))}
                              placeholder="Enter correction note"
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
  setPageData: (value: PagedResponse<CaseSummary>) => void,
  setPage: (value: number) => void
) {
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
}

async function runCaseAction(
  caseId: number,
  setWorkingCaseId: (value: number | null) => void,
  setError: (value: string) => void,
  action: () => Promise<void>
) {
  setWorkingCaseId(caseId);
  setError('');
  try {
    await action();
    return true;
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Action failed.');
    return false;
  } finally {
    setWorkingCaseId(null);
  }
}

function displayCaseTitle(value?: string | null) {
  return value?.trim() || 'Untitled submission';
}
