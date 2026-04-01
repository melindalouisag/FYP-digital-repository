import { Link } from 'react-router-dom';
import type { RepositoryItemSummary } from '../../lib/api/publicRepository';

interface RepositorySearchResultsProps {
  results: RepositoryItemSummary[];
  loading: boolean;
  totalElements: number;
  showPublicAccessNotice: boolean;
}

function SearchIcon({ size = 18, opacity = 0.8 }: { size?: number; opacity?: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{ flexShrink: 0, opacity }}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function RepositorySearchResults({
  results,
  loading,
  totalElements,
  showPublicAccessNotice,
}: RepositorySearchResultsProps) {
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3 className="h5 mb-0 su-page-title">
          <span className="su-title-with-icon">
            <SearchIcon />
            <span>Search Results</span>
          </span>
        </h3>
        <span className="badge bg-secondary-subtle text-secondary-emphasis" style={{ borderRadius: '999px', fontSize: '0.8rem' }}>
          {totalElements} item{totalElements !== 1 ? 's' : ''}
        </span>
      </div>

      {showPublicAccessNotice && (
        <div className="alert alert-info border-0" role="note" style={{ borderRadius: '0.9rem', background: 'rgba(13, 110, 253, 0.08)' }}>
          File download requires sign-in.
        </div>
      )}

      <div className="vstack gap-3">
        {results.map((item, index) => (
          <div className="su-result-card fade-in" key={item.id} style={{ animationDelay: `${index * 0.04}s` }}>
            <div className="d-flex justify-content-between align-items-start gap-3">
              <div style={{ flex: 1 }}>
                <h4 className="h6 mb-1 su-page-title" style={{ fontSize: '1rem' }}>{item.title}</h4>
                <div className="d-flex flex-wrap gap-2 mb-2">
                  <span className="badge bg-primary-subtle text-primary-emphasis" style={{ borderRadius: '999px', fontSize: '0.72rem' }}>
                    Author: {item.authors || item.authorName || 'Unknown author'}
                  </span>
                  <span className="badge bg-secondary-subtle text-secondary-emphasis" style={{ borderRadius: '999px', fontSize: '0.72rem' }}>
                    Faculty: {item.faculty || 'Unknown faculty'}
                  </span>
                  {item.program && (
                    <span className="badge bg-secondary-subtle text-secondary-emphasis" style={{ borderRadius: '999px', fontSize: '0.72rem' }}>
                      Program: {item.program}
                    </span>
                  )}
                  {item.year && (
                    <span className="badge bg-secondary-subtle text-secondary-emphasis" style={{ borderRadius: '999px', fontSize: '0.72rem' }}>
                      Year: {item.year}
                    </span>
                  )}
                </div>
                {item.keywords && (
                  <p className="mb-0 small text-muted">
                    <strong>Keywords:</strong> {item.keywords}
                  </p>
                )}
              </div>
              <Link to={`/repo/${item.id}`} className="btn btn-primary btn-sm" style={{ borderRadius: '999px', whiteSpace: 'nowrap' }}>
                View Detail →
              </Link>
            </div>
          </div>
        ))}

        {!loading && results.length === 0 && (
          <div className="su-empty-state">
            <div className="su-empty-icon">
              <SearchIcon size={40} opacity={0.7} />
            </div>
            <h5>No Publications Found</h5>
            <p className="mb-0">Try adjusting your filters or search terms to discover more publications.</p>
          </div>
        )}
      </div>
    </>
  );
}
