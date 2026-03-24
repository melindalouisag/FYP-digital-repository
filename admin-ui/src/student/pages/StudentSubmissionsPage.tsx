import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ShellLayout from '../../layout/ShellLayout';
import { studentApi } from '../../lib/api/student';
import type { CaseSummary, PagedResponse } from '../../lib/types/workflow';
import { canUploadSubmission, formatStatus, statusBadgeClass } from '../../lib/workflowUi';
import { isNavigationActivationKey, resolveStudentCaseNavigation } from '../lib/caseNavigation';

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

export default function StudentSubmissionsPage() {
  const navigate = useNavigate();
  const [pageData, setPageData] = useState<PagedResponse<CaseSummary>>(EMPTY_PAGE);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (requestedPage: number) => {
    setLoading(true);
    setError('');
    try {
      const response = await studentApi.listCasesPage({ page: requestedPage, size: PAGE_SIZE });
      if (response.totalPages > 0 && requestedPage >= response.totalPages) {
        setPage(response.totalPages - 1);
        return;
      }
      setPageData(response);
    } catch (err) {
      setPageData(EMPTY_PAGE);
      setError(err instanceof Error ? err.message : 'Unable to load submissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(page);
  }, [page]);

  const cases = pageData.items;
  const pageStart = pageData.totalElements === 0 ? 0 : pageData.page * pageData.size + 1;
  const pageEnd = pageStart === 0 ? 0 : pageStart + cases.length - 1;

  return (
    <ShellLayout title="Submission" subtitle="Upload thesis/article files after registration approvals">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <button className="btn btn-outline-secondary btn-sm" style={{ borderRadius: '999px' }} onClick={() => void load(page)} disabled={loading}>
          {loading ? '⏳ Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {!loading && cases.length === 0 && (
        <div className="su-empty-state">
          <div className="su-empty-icon">📄</div>
          <h5>No Cases Found</h5>
          <p className="text-muted">Create a publication registration first, then come here to upload submissions.</p>
        </div>
      )}

      {cases.length > 0 && (
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
              {cases.map((c) => {
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
                    <td className="fw-semibold">{c.title || `Case #${c.id}`}</td>
                    <td><span className="badge bg-dark-subtle text-dark-emphasis" style={{ borderRadius: '999px' }}>{c.type}</span></td>
                    <td>
                      <span className={`badge status-badge ${statusBadgeClass(c.status)}`}>
                        {formatStatus(c.status)}
                      </span>
                    </td>
                    <td className="text-muted small">{c.updatedAt ? new Date(c.updatedAt).toLocaleString() : 'N/A'}</td>
                    <td>
                      <div className="fw-semibold small text-body-secondary">{navigationTarget.label}</div>
                      {!canUpload && (
                        <div className="small text-muted mt-1">Complete registration approvals first</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && pageData.totalElements > 0 && (
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-4">
          <div className="text-muted small">
            Showing {pageStart}-{pageEnd} of {pageData.totalElements}
          </div>
          <nav aria-label="Submission list pagination">
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
