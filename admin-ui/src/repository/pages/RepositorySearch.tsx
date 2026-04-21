import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { type Faculty, type Program } from '@/services/api/master';
import type { RepositoryItemSummary, RepositorySearchParams } from '@/services/api/publicRepository';
import KeywordChipInput from '@/shared/ui/KeywordChipInput';
import ThemeSwitch from '../../theme/ThemeSwitch';
import { useTheme } from '../../theme/ThemeContext';
import { useRepositorySearch } from '../useRepositorySearch';

export default function RepositorySearchPage() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const search = useRepositorySearch();

  return (
    <div className="min-vh-100 su-repository-page">
      <header className="su-app-header">
        <div className="container py-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
          <Link to="/" className="d-flex align-items-center gap-2 text-decoration-none su-repository-brand-link" aria-label="Go to Digital Repository home">
            <div className="su-logo-circle">SU</div>
            <div>
              <h1 className="h5 mb-0 text-white fw-bold">Sampoerna University</h1>
              <small className="text-white-50">Digital Repository</small>
            </div>
          </Link>
          <div className="d-flex flex-wrap align-items-center gap-3">
            <div className="d-flex align-items-center gap-2 text-white">
              <span className="small text-white-50">Dark mode</span>
              <ThemeSwitch checked={theme === 'dark'} onChange={(checked) => setTheme(checked ? 'dark' : 'light')} />
            </div>
            <div className="d-flex flex-wrap gap-2">
              {user ? (
                <>
                  <button
                    type="button"
                    className="btn btn-outline-light btn-sm"
                    style={{ borderRadius: '0.7rem' }}
                    onClick={() => navigate(
                      user.role === 'STUDENT'
                        ? '/student/dashboard'
                        : user.role === 'LECTURER'
                          ? '/lecturer/dashboard'
                          : '/admin/dashboard'
                    )}
                  >
                    Dashboard
                  </button>
                  <button type="button" className="btn btn-light btn-sm" style={{ borderRadius: '0.7rem' }} onClick={() => void logout()}>
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-outline-light btn-sm" style={{ borderRadius: '0.7rem' }} onClick={() => navigate('/login')}>
                    Sign in
                  </button>
                  <button type="button" className="btn btn-light btn-sm" style={{ borderRadius: '0.7rem', fontWeight: 600 }} onClick={() => navigate('/register')}>
                    Register
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container py-4 fade-in">
        <section className="su-hero su-repository-hero mb-4">
          <div className="row align-items-center">
            <div className="col-lg-7">
              <h2 className="display-6 mb-2">Discover Research &<br />Publications</h2>
              <p className="mb-0" style={{ fontSize: '1.05rem' }}>
                Browse theses, articles, and scholarly works from Sampoerna University's academic community.
                Access knowledge curated by our university library.
              </p>
            </div>
            <div className="col-lg-5 text-center mt-3 mt-lg-0">
              <div className="d-flex justify-content-center gap-3 su-repository-hero-stats">
                <div className="text-center su-repository-hero-stat">
                  <div className="su-repository-hero-value" style={{ fontSize: '2.5rem', fontWeight: 800 }}>{search.pageData.totalElements}</div>
                  <div className="su-repository-hero-label" style={{ fontSize: '0.78rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Publications</div>
                </div>
                <div className="su-repository-hero-divider" />
                <div className="text-center su-repository-hero-stat">
                  <div className="su-repository-hero-value" style={{ fontSize: '2.5rem', fontWeight: 800 }}>{search.faculties.length}</div>
                  <div className="su-repository-hero-label" style={{ fontSize: '0.78rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Faculties</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <RepositorySearchFilters
          filters={search.filters}
          keywordTokens={search.keywordTokens}
          faculties={search.faculties}
          programs={search.programs}
          selectedFacultyId={search.selectedFacultyId}
          selectedProgramId={search.selectedProgramId}
          yearOptions={search.yearOptions}
          loading={search.loading}
          activeFilterCount={search.activeFilterCount}
          onKeywordTokensChange={search.setKeywordTokens}
          onChange={search.onChange}
          onFacultyChange={search.onFacultyChange}
          onProgramChange={search.onProgramChange}
          onSearch={search.onSearch}
          onReset={search.onReset}
        />

        {search.error && (
          <div className="alert alert-danger" role="alert">{search.error}</div>
        )}
        {search.masterLoadError && (
          <div className="alert alert-warning" role="alert">{search.masterLoadError}</div>
        )}

        <RepositorySearchResults
          results={search.results}
          loading={search.loading}
          totalElements={search.pageData.totalElements}
        />

        <RepositorySearchPagination
          loading={search.loading}
          hasPrevious={search.pageData.hasPrevious}
          hasNext={search.pageData.hasNext}
          page={search.pageData.page}
          totalPages={search.pageData.totalPages}
          pageStart={search.pageStart}
          pageEnd={search.pageEnd}
          totalElements={search.pageData.totalElements}
          onPrevious={() => search.setPage((current) => Math.max(current - 1, 0))}
          onNext={() => search.setPage((current) => current + 1)}
        />

        <footer className="su-repository-footer text-center text-muted small py-4 mt-4">
          <div className="fw-semibold">Sampoerna University Library</div>
          <div>© {new Date().getFullYear()} — Digital Repository</div>
        </footer>
      </div>
    </div>
  );
}

interface RepositorySearchFiltersProps {
  filters: RepositorySearchParams;
  keywordTokens: string[];
  faculties: Faculty[];
  programs: Program[];
  selectedFacultyId?: number;
  selectedProgramId?: number;
  yearOptions: number[];
  loading: boolean;
  activeFilterCount: number;
  onKeywordTokensChange: (values: string[]) => void;
  onChange: (key: keyof RepositorySearchParams, value: string) => void;
  onFacultyChange: (value: string) => void;
  onProgramChange: (value: string) => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
}

interface RepositorySearchResultsProps {
  results: RepositoryItemSummary[];
  loading: boolean;
  totalElements: number;
}

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

function RepositorySearchFilters({
  filters,
  keywordTokens,
  faculties,
  programs,
  selectedFacultyId,
  selectedProgramId,
  yearOptions,
  loading,
  activeFilterCount,
  onKeywordTokensChange,
  onChange,
  onFacultyChange,
  onProgramChange,
  onSearch,
  onReset,
}: RepositorySearchFiltersProps) {
  return (
    <div className="su-card su-repository-search-card mb-4">
      <div className="card-body p-4">
        <h3 className="h6 su-page-title mb-3">
          <span className="su-title-with-icon">
            <SearchIcon />
            <span>Search Repository</span>
          </span>
        </h3>
        <form className="row g-3" onSubmit={onSearch}>
          <div className="col-md-6">
            <label className="form-label" htmlFor="repository-search-title">Title</label>
            <input
              id="repository-search-title"
              className="form-control"
              value={filters.title ?? ''}
              onChange={(event) => onChange('title', event.target.value)}
              placeholder="Search by publication title..."
            />
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="repository-search-author">Author</label>
            <input
              id="repository-search-author"
              className="form-control"
              value={filters.author ?? ''}
              onChange={(event) => onChange('author', event.target.value)}
              placeholder="Search by author name..."
            />
          </div>

          <div className="col-md-3">
            <label className="form-label" htmlFor="repository-search-faculty">Faculty</label>
            <select
              id="repository-search-faculty"
              className="form-select"
              value={selectedFacultyId ?? ''}
              onChange={(event) => onFacultyChange(event.target.value)}
            >
              <option value="">Any faculty</option>
              {faculties.map((faculty) => (
                <option key={faculty.id} value={faculty.id}>{faculty.name}</option>
              ))}
            </select>
          </div>

          <div className="col-md-3">
            <label className="form-label" htmlFor="repository-search-program">Study Program</label>
            <select
              id="repository-search-program"
              className="form-select"
              value={selectedProgramId ?? ''}
              onChange={(event) => onProgramChange(event.target.value)}
              disabled={!selectedFacultyId}
            >
              <option value="">Any study program</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>{program.name}</option>
              ))}
            </select>
          </div>

          <div className="col-md-3">
            <label className="form-label" htmlFor="repository-search-keywords">Keywords</label>
            <KeywordChipInput
              id="repository-search-keywords"
              values={keywordTokens}
              onChange={onKeywordTokensChange}
              placeholder="Enter keywords separated by commas"
            />
          </div>

          <div className="col-md-3">
            <label className="form-label" htmlFor="repository-search-year">Year Published</label>
            <select
              id="repository-search-year"
              className="form-select"
              value={filters.year ?? ''}
              onChange={(event) => onChange('year', event.target.value)}
            >
              <option value="">Any year</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className="col-12 d-flex flex-wrap gap-2 align-items-center">
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? (
                <><span className="su-spinner d-inline-block me-2" style={{ width: '1rem', height: '1rem', borderWidth: 2 }} /> Searching...</>
              ) : (
                <span className="su-label-with-icon">
                  <SearchIcon />
                  <span>Search Repository</span>
                </span>
              )}
            </button>
            <button className="btn btn-outline-secondary" type="button" onClick={onReset} disabled={loading}>
              Reset Filters
            </button>
            {activeFilterCount > 0 && (
              <span className="badge bg-primary-subtle text-primary-emphasis" style={{ borderRadius: '999px' }}>
                {activeFilterCount} active filter{activeFilterCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function RepositorySearchResults({
  results,
  loading,
  totalElements,
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

      <div className="vstack gap-3">
        {results.map((item, index) => (
          <Link
            to={`/repo/${item.id}`}
            className="su-result-card fade-in d-block text-decoration-none text-reset"
            key={item.id}
            style={{ animationDelay: `${index * 0.04}s` }}
            aria-label={`Open publication details for ${item.title}`}
          >
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
            </div>
          </Link>
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

function RepositorySearchPagination({
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
