import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '@/services/api/admin';
import PortalIcon from '@/shared/ui/PortalIcon';
import EmptyState from '@/shared/ui/EmptyState';
import StatusBadge from '@/shared/ui/StatusBadge';
import { useConfirmDialog } from '@/shared/ui/useConfirmDialog';
import type { AdminPublishQueueItem, PagedResponse } from '@/types/workflow';
import { adminSidebarIcons } from '@/utils/portalIcons';
import ShellLayout from '../../ShellLayout';

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

  useEffect(() => {
    void load(page, setLoading, setError, setPageData, setPage);
  }, [page]);

  const openPublishConfirm = (publicationCase: AdminPublishQueueItem) => {
    openConfirm({
      title: 'Publish record',
      message: `Publish "${displayCaseTitle(publicationCase.title)}" to the repository?`,
      confirmLabel: 'Publish',
      onConfirm: async (close) => {
        const success = await publishCase(publicationCase.caseId, setWorkingCaseId, setError, setMessage, async () => {
          await adminApi.publish(publicationCase.caseId);
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
        title="Publishing"
      >
        {error ? <div className="alert alert-danger">{error}</div> : null}
        {message ? <div className="alert alert-success">{message}</div> : null}

        <section className="su-section">
          {loading ? (
            <div className="text-center py-5">
              <div className="su-spinner mx-auto mb-3" />
              <div className="text-muted">Loading publish queue...</div>
            </div>
          ) : pageData.items.length === 0 ? (
            <EmptyState
              title="No Publications Ready for Publication"
              description="Finalized records will appear here when they are ready for repository publication."
              icon={<PortalIcon src={adminSidebarIcons.publishing} size={40} />}
              centered
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
                    const busy = workingCaseId === item.caseId;
                    return (
                      <tr
                        key={item.caseId}
                        className="su-table-row-clickable"
                        tabIndex={0}
                        onClick={() => navigate(`/admin/publish/${item.caseId}`)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            navigate(`/admin/publish/${item.caseId}`);
                          }
                        }}
                      >
                        <td>
                          <div className="su-table-title">{displayCaseTitle(item.title)}</div>
                          <div className="su-secondary-text">{item.type}</div>
                        </td>
                        <td><StatusBadge status={item.status} /></td>
                        <td>{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'Not available'}</td>
                        <td className="text-end">
                          <div className="d-flex flex-wrap justify-content-end gap-2">
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={busy}
                              onClick={(event) => {
                                event.stopPropagation();
                                openPublishConfirm(item);
                              }}
                            >
                              {busy ? 'Publishing...' : 'Publish'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-secondary"
                              onClick={(event) => {
                                event.stopPropagation();
                                navigate(`/admin/publish/${item.caseId}`);
                              }}
                            >
                              View
                            </button>
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
  setPageData: (value: PagedResponse<AdminPublishQueueItem>) => void,
  setPage: (value: number) => void
) {
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
}

async function publishCase(
  caseId: number,
  setWorkingCaseId: (value: number | null) => void,
  setError: (value: string) => void,
  setMessage: (value: string) => void,
  action: () => Promise<void>
) {
  setWorkingCaseId(caseId);
  setError('');
  setMessage('');
  try {
    await action();
    setMessage('Publication published to the repository.');
    return true;
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Publish action failed.');
    return false;
  } finally {
    setWorkingCaseId(null);
  }
}

function displayCaseTitle(value?: string | null) {
  return value?.trim() || 'Untitled submission';
}
