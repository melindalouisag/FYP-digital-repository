import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ShellLayout from '../../layout/ShellLayout';
import { studentApi } from '../../lib/api/student';
import type { CaseSummary } from '../../lib/types/workflow';
import { canSubmitClearance, canSubmitRegistration, canUploadSubmission, formatStatus, statusBadgeClass } from '../../lib/workflowUi';
import { isNavigationActivationKey, resolveStudentCaseNavigation, selectDashboardCases } from '../lib/caseNavigation';

const DASHBOARD_CASE_LIMIT = 5;

export default function StudentDashboardPage() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setCases(await studentApi.listCases());
    } catch (err) {
      setCases([]);
      setError(err instanceof Error ? err.message : 'Failed to load student cases.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const total = cases.length;
    const inProgress = cases.filter(c => !['PUBLISHED', 'REJECTED'].includes(c.status)).length;
    const published = cases.filter(c => c.status === 'PUBLISHED').length;
    const needsAction = cases.filter(c =>
      canSubmitRegistration(c.status) || canUploadSubmission(c.status) || canSubmitClearance(c.status)
    ).length;
    return { total, inProgress, published, needsAction };
  }, [cases]);

  const visibleCases = useMemo(
    () => selectDashboardCases(cases, DASHBOARD_CASE_LIMIT),
    [cases]
  );

  return (
    <ShellLayout title="Student Dashboard" subtitle="Start with cases that need your action, then monitor your most recent progress">
      {/* ===== STAT CARDS ===== */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="su-stat-card">
            <div className="su-stat-value">{stats.total}</div>
            <div className="su-stat-label">Total Cases</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="su-stat-card">
            <div className="su-stat-value">{stats.inProgress}</div>
            <div className="su-stat-label">In Progress</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="su-stat-card">
            <div className="su-stat-value">{stats.published}</div>
            <div className="su-stat-label">Published</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="su-stat-card" style={{ borderColor: stats.needsAction > 0 ? '#0b7584' : undefined }}>
            <div className="su-stat-value" style={{ color: stats.needsAction > 0 ? '#0b7584' : undefined }}>{stats.needsAction}</div>
            <div className="su-stat-label">Needs Action</div>
          </div>
        </div>
      </div>

      {/* ===== ACTIONS BAR ===== */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <button className="btn btn-primary" onClick={() => navigate('/student/registrations/new')}>
          New Publication Registration
        </button>
        <button className="btn btn-outline-secondary btn-sm" onClick={() => void load()} disabled={loading}>
          {loading ? <><span className="su-spinner d-inline-block me-1" style={{ width: '0.9rem', height: '0.9rem', borderWidth: 2 }} /> Loading...</> : 'Refresh'}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {!loading && cases.length === 0 && (
        <div className="su-empty-state">
          <h5>No Publication Cases Yet</h5>
          <p className="text-muted">Create a publication registration when you are ready to start a thesis or article submission.</p>
          <button className="btn btn-primary" onClick={() => navigate('/student/registrations/new')}>
            Create First Registration
          </button>
        </div>
      )}

      {!loading && cases.length > 0 && visibleCases.length === 0 && (
        <div className="su-empty-state">
          <h5>No Priority Cases Right Now</h5>
          <p className="text-muted">When a case needs your action or receives a recent update, it will appear here first.</p>
        </div>
      )}

      {visibleCases.length > 0 && (
        <div className="mb-3">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
            <h2 className="h6 mb-0 su-page-title">Priority Cases</h2>
            <span className="text-muted small">Showing up to {DASHBOARD_CASE_LIMIT} cases that need action or changed recently</span>
          </div>
          <p className="text-muted small mb-0">
            Cases you can act on appear first, followed by your most recently updated in-progress work.
          </p>
        </div>
      )}

      <div className="vstack gap-3">
        {visibleCases.map((c, index) => {
          const navigationTarget = resolveStudentCaseNavigation(c, 'dashboard');

          return (
            <div
              className="su-card su-card-clickable fade-in"
              key={c.id}
              role="link"
              tabIndex={0}
              aria-label={`${navigationTarget.label}: ${c.title || 'Untitled Publication'}`}
              onClick={() => navigate(navigationTarget.path)}
              onKeyDown={(event) => {
                if (!isNavigationActivationKey(event)) return;
                event.preventDefault();
                navigate(navigationTarget.path);
              }}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="card-body">
                <div className="d-flex flex-wrap justify-content-between gap-2 align-items-start">
                  <div style={{ flex: 1 }}>
                    <h3 className="h6 mb-1 fw-bold">{c.title || 'Untitled Publication'}</h3>
                    <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
                      <span className="badge bg-dark-subtle text-dark-emphasis" style={{ borderRadius: '999px' }}>{c.type}</span>
                      <span className={`badge status-badge ${statusBadgeClass(c.status)}`}>{formatStatus(c.status)}</span>
                    </div>
                    <p className="text-muted small mb-0">
                      Last updated: {c.updatedAt ? new Date(c.updatedAt).toLocaleString() : 'N/A'}
                    </p>
                    <p className="small fw-semibold text-body-secondary mb-0 mt-2">
                      Recommended next step: {navigationTarget.label}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ShellLayout>
  );
}
