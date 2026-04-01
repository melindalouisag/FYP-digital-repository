interface RepositorySearchPaginationProps {
  loading: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  page: number;
  totalPages: number;
  pageStart: number;
  pageEnd: number;
  totalElements: number;
  onPrevious: () => void;
  onNext: () => void;
}

export function RepositorySearchPagination({
  loading,
  hasPrevious,
  hasNext,
  page,
  totalPages,
  pageStart,
  pageEnd,
  totalElements,
  onPrevious,
  onNext,
}: RepositorySearchPaginationProps) {
  if (loading || totalElements === 0) {
    return null;
  }

  return (
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-4">
      <div className="text-muted small">
        Showing {pageStart}-{pageEnd} of {totalElements}
      </div>
      <nav aria-label="Repository search pagination">
        <ul className="pagination pagination-sm mb-0">
          <li className={`page-item ${!hasPrevious || loading ? 'disabled' : ''}`}>
            <button className="page-link" type="button" onClick={onPrevious} disabled={!hasPrevious || loading}>
              Previous
            </button>
          </li>
          <li className="page-item disabled">
            <span className="page-link">
              Page {page + 1} of {Math.max(totalPages, 1)}
            </span>
          </li>
          <li className={`page-item ${!hasNext || loading ? 'disabled' : ''}`}>
            <button className="page-link" type="button" onClick={onNext} disabled={!hasNext || loading}>
              Next
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
