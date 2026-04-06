import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ShellLayout from '../../ShellLayout';
import { adminApi } from '../../lib/api/admin';
import PortalIcon from '../../lib/components/PortalIcon';
import { useConfirmDialog } from '../../lib/components/useConfirmDialog';
import { adminSidebarIcons } from '../../lib/portalIcons';
import type { AdminPublishQueueItem, PagedResponse } from '../../lib/workflowTypes';
import { formatStatus, statusBadgeClass } from '../../lib/workflowUi';

const PAGE_SIZE = 10;

const EMPTY_PAGE: PagedResponse<AdminPublishQueueItem> = {
  items: [],
  page: 0,
  size: PAGE_SIZE,
  totalElements: 0,
  totalPages: 0,
  hasNext: false,
  hasPrevious: false,
};

export default function AdminPublishPage() {
  const navigate = useNavigate();
  const { openConfirm, confirmDialog } = useConfirmDialog();
  const [pageData, setPageData] = useState<PagedResponse<AdminPublishQueueItem>>(EMPTY_PAGE);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [workingCaseId, setWorkingCaseId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async (requestedPage: number) => {
    setLoading(true);
    setError('');
    try {
      const response = await adminApi.publishQueue({ page: requestedPage, size: PAGE_SIZE });
      if (response.totalPages > 0 && requestedPage >= response.totalPages) {
        setPage(response.totalPages - 1);
        return;
      }
      setPageData(response);
    } catch (err) {
      setPageData(EMPTY_PAGE);
      setError(err instanceof Error ? err.message : 'Failed to load publish queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(page);
  }, [page]);

  const publishCase = async (caseId: number) => {
    setWorkingCaseId(caseId);
    setError('');
    setMessage('');
    try {
      await adminApi.publish(caseId);
      setMessage('Submission published to repository.');
      await load(page);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish action failed.');
      return false;
    } finally {
      setWorkingCaseId(null);
    }
  };

  const cases = pageData.items;
  const pageStart = pageData.totalElements === 0 ? 0 : pageData.page * pageData.size + 1;
  const pageEnd = pageStart === 0 ? 0 : pageStart + cases.length - 1;
  const displayCaseTitle = (value?: string | null) => value?.trim() || 'Untitled submission';

  const openPublishConfirm = (publicationCase: AdminPublishQueueItem) => {
    openConfirm({
      title: 'Confirm Publish',
      message: (
        <div className="vstack gap-2">
          <div>
            This will publish <strong>{displayCaseTitle(publicationCase.title)}</strong> to the repository.
          </div>
          <div>Please confirm that the metadata and uploaded file are ready for release.</div>
        </div>
      ),
      confirmLabel: 'Confirm Publish',
      onConfirm: async (close) => {
        const success = await publishCase(publicationCase.caseId);
        if (success) {
          close();
        }
      },
    });
  };

  return (
    <>
      <ShellLayout title="Publishing" subtitle="Review publications that are ready for repository release and publish them when metadata is complete">
        {error && <div className="alert alert-danger" style={{ borderRadius: '0.75rem' }}>{error}</div>}
        {message && <div className="alert alert-success" style={{ borderRadius: '0.75rem' }}>{message}</div>}

        {loading && (
          <div className="text-center py-5">
            <div className="su-spinner mx-auto mb-3" />
            <div className="text-muted">Loading publish queue...</div>
          </div>
        )}

        {!loading && cases.length === 0 && (
          <div className="su-empty-state">
            <div className="su-empty-icon">
              <PortalIcon src={adminSidebarIcons.publishing} size={40} />
            </div>
            <h5>No Publications Ready for Publication</h5>
            <p className="text-muted">No publications are ready for publication at this time.</p>
          </div>
        )}

        <div className="vstack gap-3">
          {cases.map((c, index) => (
            <div
              className="su-card su-card-clickable fade-in"
              key={c.caseId}
              role="button"
              onClick={() => navigate(`/admin/publish/${c.caseId}`)}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="card-body p-4">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <div>
                    <h5 className="fw-bold mb-1">{displayCaseTitle(c.title)}</h5>
                    <div className="d-flex flex-wrap gap-2 align-items-center">
                      <span className="badge bg-dark-subtle text-dark-emphasis" style={{ borderRadius: '999px' }}>{c.type}</span>
                      <span className={`badge status-badge ${statusBadgeClass(c.status)}`}>{formatStatus(c.status)}</span>
                      <span className="text-muted small">Updated: {c.updatedAt ? new Date(c.updatedAt).toLocaleString() : 'N/A'}</span>
                    </div>
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <button
                      className="btn btn-sm su-action-button su-action-button-primary"
                      disabled={workingCaseId === c.caseId || c.status !== 'READY_TO_PUBLISH'}
                      onClick={(event) => {
                        event.stopPropagation();
                        openPublishConfirm(c);
                      }}
                    >
                      {workingCaseId === c.caseId ? 'Publishing...' : 'Publish to Repository'}
                    </button>
                    <button
                      className="btn btn-sm su-action-button su-action-button-secondary"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/admin/publish/${c.caseId}`);
                      }}
                    >
                      Open Publishing Detail
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
            <nav aria-label="Publish queue pagination">
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
