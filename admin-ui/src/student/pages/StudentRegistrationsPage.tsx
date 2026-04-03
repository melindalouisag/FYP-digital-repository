import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ShellLayout from '../../ShellLayout';
import { studentApi } from '../../lib/api/student';
import PortalIcon from '../../lib/components/PortalIcon';
import { studentSidebarIcons } from '../../lib/portalIcons';
import type { CaseSummary } from '../../lib/workflowTypes';
import { formatStatus, getStudentCaseGuidance, statusBadgeClass } from '../../lib/workflowUi';
import {
  isNavigationActivationKey,
  isRegistrationWorkspaceCase,
  resolveStudentCaseNavigation,
  sortCasesByRecentActivity,
} from '../caseNavigation';

const PAGE_SIZE = 10;

export default function StudentRegistrationsPage() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setCases(await studentApi.listCases());
    } catch (err) {
      setCases([]);
      setError(err instanceof Error ? err.message : 'Unable to load registrations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const registrationCases = useMemo(
    () => sortCasesByRecentActivity(cases.filter((c) => isRegistrationWorkspaceCase(c.status))),
    [cases]
  );
  const totalPages = Math.max(Math.ceil(registrationCases.length / PAGE_SIZE), 1);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages - 1));
  }, [totalPages]);

  const visibleCases = useMemo(() => {
    const start = page * PAGE_SIZE;
    return registrationCases.slice(start, start + PAGE_SIZE);
  }, [page, registrationCases]);
  const pageStart = registrationCases.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const pageEnd = pageStart === 0 ? 0 : pageStart + visibleCases.length - 1;
  const hasPrevious = page > 0;
  const hasNext = page + 1 < totalPages;

  return (
    <ShellLayout title="Publication Registration">
      <section className="su-card su-registration-info-card mb-4">
        <h3 className="su-registration-info-title">About Publication Registration</h3>
        <p className="su-registration-info-copy">
          Publication Registration is used to record your permission for Sampoerna University to include your thesis,
          article, or other academic work in the University Library’s Digital Repository for education and research use.
          This page is for registration only and is not the place to upload your final document. After the publication
          registration is finished, continue with your document submission through the Submission page.
        </p>

        <h4 className="su-registration-info-subtitle">How to use this page</h4>
        <ol className="su-registration-info-list mb-0">
          <li>Click Create New Registration to start a new publication registration.</li>
          <li>Complete the form with the required publication information carefully.</li>
          <li>Review your details, then submit the registration for approval.</li>
          <li>Return to this page to monitor the registration status.</li>
          <li className="su-registration-info-emphasis">
            After the registration is completed, continue your file upload through the Submission page.
          </li>
        </ol>
      </section>

      <div className="d-flex justify-content-end align-items-center mb-4">
        <button className="btn btn-primary" style={{ borderRadius: '999px' }} onClick={() => navigate('/student/registrations/new')}>
          Create New Registration
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {!loading && registrationCases.length === 0 && (
        <div className="su-empty-state">
          <div className="su-empty-icon">
            <PortalIcon src={studentSidebarIcons.registration} size={40} />
          </div>
          <h5>No Registration Records to Work On</h5>
          <p className="text-muted">Draft registrations, returned registrations, and registrations still in approval will appear here.</p>
          <button className="btn btn-primary" onClick={() => navigate('/student/registrations/new')}>
            Create First Registration
          </button>
        </div>
      )}

      {registrationCases.length > 0 && (
        <div className="table-responsive su-card">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Publication</th>
                <th>Type</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Next Step</th>
              </tr>
            </thead>
            <tbody>
              {visibleCases.map((c) => {
                const navigationTarget = resolveStudentCaseNavigation(c, 'registrations');

                return (
                  <tr
                    key={c.id}
                    className="su-table-row-clickable"
                    tabIndex={0}
                    aria-label={`${navigationTarget.label}: ${c.title || 'Untitled Publication'}`}
                    onClick={() => navigate(navigationTarget.path)}
                    onKeyDown={(event) => {
                      if (!isNavigationActivationKey(event)) return;
                      event.preventDefault();
                      navigate(navigationTarget.path);
                    }}
                  >
                    <td>
                      <div className="fw-semibold">{c.title || 'Untitled Publication'}</div>
                    </td>
                    <td><span className="badge bg-dark-subtle text-dark-emphasis" style={{ borderRadius: '999px' }}>{c.type}</span></td>
                    <td>
                      <span className={`badge status-badge ${statusBadgeClass(c.status)}`}>
                        {formatStatus(c.status)}
                      </span>
                    </td>
                    <td className="text-muted small">{c.updatedAt ? new Date(c.updatedAt).toLocaleString() : 'N/A'}</td>
                    <td>
                      <div className="fw-semibold small text-body-secondary">{navigationTarget.label}</div>
                      <div className="small text-muted mt-1">{getStudentCaseGuidance(c.status)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && registrationCases.length > 0 && (
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-4">
          <div className="text-muted small">
            Showing {pageStart}-{pageEnd} of {registrationCases.length}
          </div>
          <nav aria-label="Registration list pagination">
            <ul className="pagination pagination-sm mb-0">
              <li className={`page-item ${!hasPrevious || loading ? 'disabled' : ''}`}>
                <button
                  className="page-link"
                  type="button"
                  onClick={() => setPage((current) => Math.max(current - 1, 0))}
                  disabled={!hasPrevious || loading}
                >
                  Previous
                </button>
              </li>
              <li className="page-item disabled">
                <span className="page-link">
                  Page {page + 1} of {totalPages}
                </span>
              </li>
              <li className={`page-item ${!hasNext || loading ? 'disabled' : ''}`}>
                <button
                  className="page-link"
                  type="button"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={!hasNext || loading}
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
