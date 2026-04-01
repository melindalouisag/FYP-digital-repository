import type { FormEvent } from 'react';
import KeywordChipInput from '../../lib/components/KeywordChipInput';
import type { RepositorySearchParams } from '../../lib/api/publicRepository';
import type { Faculty, Program } from '../../lib/api/master';

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

function SearchIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{ flexShrink: 0, opacity: 0.8 }}
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

export function RepositorySearchFilters({
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
    <div className="su-card mb-4">
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
              placeholder="Type one keyword and press Enter"
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
