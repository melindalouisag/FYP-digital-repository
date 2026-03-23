import { useEffect, useState } from 'react';
import ShellLayout from '../../layout/ShellLayout';
import { adminApi } from '../../lib/api/admin';
import type { CaseSummary, PagedResponse } from '../../lib/types/workflow';
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setWorkingCaseId(null);
    }
  };

  const cases = pageData.items;
  const pageStart = pageData.totalElements === 0 ? 0 : pageData.page * pageData.size + 1;
  const pageEnd = pageStart === 0 ? 0 : pageStart + cases.length - 1;

  return (
    <ShellLayout title="Clearance Queue" subtitle="Approve submitted clearances or request correction">
      {error && <div className="alert alert-danger d-flex align-items-center gap-2" style={{ borderRadius: '0.75rem' }}><span>⚠️</span> {error}</div>}

      {loading && (
        <div className="text-center py-5">
          <div className="su-spinner mx-auto mb-3" />
          <div className="text-muted">Loading clearance queue...</div>
        </div>
      )}

      {!loading && cases.length === 0 && (
        <div className="su-empty-state">
          <div className="su-empty-icon">🏛️</div>
          <h5>No Clearance Requests</h5>
          <p className="text-muted">Clearance queue is empty.</p>
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
                    <h5 className="fw-bold mb-1">{c.title || `Case #${c.id}`}</h5>
                    <div className="d-flex gap-2 align-items-center">
                      <span className={`badge status-badge ${statusBadgeClass(c.status)}`}>{formatStatus(c.status)}</span>
                      <span className="text-muted small">{c.updatedAt ? new Date(c.updatedAt).toLocaleString() : ''}</span>
                    </div>
                  </div>
                  <button
                    className="btn btn-success btn-sm"
                    style={{ borderRadius: '999px', padding: '0.4rem 1.2rem' }}
                    disabled={busy}
                    onClick={() => void run(c.id, () => adminApi.approveClearance(c.id).then(() => undefined))}
                  >
                    ✅ Approve Clearance
                  </button>
                </div>

                <div className="p-3" style={{ background: '#fffbeb', borderRadius: '0.6rem', border: '1px solid #fde68a' }}>
                  <label className="form-label mb-1 small fw-semibold" style={{ color: '#d97706' }}>⚠️ Request correction</label>
                  <div className="d-flex gap-2">
                    <input
                      className="form-control form-control-sm"
                      value={reasons[c.id] ?? ''}
                      onChange={(event) =>
                        setReasons((prev) => ({ ...prev, [c.id]: event.target.value }))
                      }
                      placeholder="Reason for correction..."
                      disabled={busy}
                      style={{ borderRadius: '999px' }}
                    />
                    <button
                      className="btn btn-outline-warning btn-sm"
                      style={{ borderRadius: '999px', whiteSpace: 'nowrap' }}
                      disabled={busy}
                      onClick={() =>
                        void run(c.id, async () => {
                          const reason = reasons[c.id]?.trim();
                          if (!reason) throw new Error('Correction reason is required.');
                          await adminApi.requestClearanceCorrection(c.id, reason);
                        })
                      }
                    >
                      Correction
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
  );
}
