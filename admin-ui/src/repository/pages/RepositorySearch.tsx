import { useNavigate } from 'react-router-dom';
import ThemeSwitch from '../../theme/ThemeSwitch';
import PortalIcon from '../../lib/components/PortalIcon';
import { useAuth } from '../../lib/context/AuthContext';
import { adminSidebarIcons } from '../../lib/portalIcons';
import { useTheme } from '../../theme/ThemeContext';
import { RepositorySearchFilters } from '../components/RepositorySearchFilters';
import { RepositorySearchPagination } from '../components/RepositorySearchPagination';
import { RepositorySearchResults } from '../components/RepositorySearchResults';
import { useRepositorySearch } from '../useRepositorySearch';

export default function RepositorySearchPage() {
  const { user, logout, loading } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const search = useRepositorySearch();

  return (
    <div className="min-vh-100" style={{ background: 'linear-gradient(180deg, #f0f6fa 0%, #fff 30%)' }}>
      <header className="su-app-header">
        <div className="container py-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div className="d-flex align-items-center gap-2">
            <div className="su-logo-circle">SU</div>
            <div>
              <h1 className="h5 mb-0 text-white fw-bold">Sampoerna University</h1>
              <small className="text-white-50">Digital Repository Portal</small>
            </div>
          </div>
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
                    style={{ borderRadius: '999px' }}
                    onClick={() => navigate(
                      user.role === 'STUDENT'
                        ? '/student/dashboard'
                        : user.role === 'LECTURER'
                          ? '/lecturer/dashboard'
                          : '/admin/dashboard'
                    )}
                  >
                    <span className="su-label-with-icon">
                      <PortalIcon src={adminSidebarIcons.dashboard} />
                      <span>Dashboard</span>
                    </span>
                  </button>
                  <button type="button" className="btn btn-light btn-sm" style={{ borderRadius: '999px' }} onClick={() => void logout()}>
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-outline-light btn-sm" style={{ borderRadius: '999px' }} onClick={() => navigate('/login')}>
                    Sign In
                  </button>
                  <button type="button" className="btn btn-light btn-sm" style={{ borderRadius: '999px', fontWeight: 600 }} onClick={() => navigate('/register')}>
                    Register
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container py-4 fade-in">
        <section className="su-hero mb-4">
          <div className="row align-items-center">
            <div className="col-lg-7">
              <h2 className="display-6 mb-2">Discover Research &<br />Publications</h2>
              <p className="mb-0" style={{ fontSize: '1.05rem' }}>
                Browse theses, articles, and scholarly works from Sampoerna University's academic community.
                Access knowledge curated by our university library.
              </p>
            </div>
            <div className="col-lg-5 text-center mt-3 mt-lg-0">
              <div className="d-flex justify-content-center gap-3">
                <div className="text-center">
                  <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>{search.pageData.totalElements}</div>
                  <div style={{ fontSize: '0.78rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Publications</div>
                </div>
                <div style={{ width: 1, background: 'rgba(255,255,255,0.2)', margin: '0.5rem 0' }} />
                <div className="text-center">
                  <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>{search.faculties.length}</div>
                  <div style={{ fontSize: '0.78rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Faculties</div>
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
          showPublicAccessNotice={!loading && !user}
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

        <footer className="text-center text-muted small py-4 mt-4">
          <div className="fw-semibold">Sampoerna University Library</div>
          <div>© {new Date().getFullYear()} — Digital Repository Portal</div>
        </footer>
      </div>
    </div>
  );
}
