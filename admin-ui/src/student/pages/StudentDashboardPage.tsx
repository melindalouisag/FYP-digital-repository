import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ShellLayout from '../../layout/ShellLayout';
import { studentApi } from '../../lib/api/student';
import type { CaseSummary } from '../../lib/types/workflow';
import { canSubmitClearance, canSubmitRegistration, canUploadSubmission, formatStatus, statusBadgeClass } from '../../lib/workflowUi';
import StudentCaseWorkflowProgress from '../components/StudentCaseWorkflowProgress';
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
    <ShellLayout title="Student Dashboard" subtitle="Overview of cases that need attention now or were updated most recently">
      {/* ===== STAT CARDS ===== */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="su-stat-card">
            <div className="su-stat-icon" style={{ background: '#e8f4f8' }}><img src="/icons/student/registration.png" alt="" style={{ width: 28, height: 28 }} /></div>
            <div className="su-stat-value">{stats.total}</div>
            <div className="su-stat-label">Total Cases</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="su-stat-card">
            <div className="su-stat-icon" style={{ background: '#fff3cd' }}><img src="/icons/student/in progress.png" alt="" style={{ width: 28, height: 28 }} /></div>
            <div className="su-stat-value">{stats.inProgress}</div>
            <div className="su-stat-label">In Progress</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="su-stat-card">
            <div className="su-stat-icon" style={{ background: '#d1e7dd' }}><img src="/icons/student/published.png" alt="" style={{ width: 28, height: 28 }} /></div>
            <div className="su-stat-value">{stats.published}</div>
            <div className="su-stat-label">Published</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="su-stat-card" style={{ borderColor: stats.needsAction > 0 ? '#0b7584' : undefined }}>
            <div className="su-stat-icon" style={{ background: stats.needsAction > 0 ? '#e0f7fa' : '#f0f0f0' }}><img src="/icons/student/need action.png" alt="" style={{ width: 28, height: 28 }} /></div>
            <div className="su-stat-value" style={{ color: stats.needsAction > 0 ? '#0b7584' : undefined }}>{stats.needsAction}</div>
            <div className="su-stat-label">Needs Action</div>
          </div>
        </div>
      </div>

      {/* ===== ACTIONS BAR ===== */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <button className="btn btn-primary" onClick={() => navigate('/student/registrations/new')}>
          ➕ New Publication Registration
        </button>
        <button className="btn btn-outline-secondary btn-sm" onClick={() => void load()} disabled={loading}>
          {loading ? <><span className="su-spinner d-inline-block me-1" style={{ width: '0.9rem', height: '0.9rem', borderWidth: 2 }} /> Loading...</> : '🔄 Refresh'}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {!loading && cases.length === 0 && (
        <div className="su-empty-state">
          <div className="su-empty-icon">📁</div>
          <h5>No Publication Cases Yet</h5>
          <p className="text-muted">Start by creating a new publication registration to begin the submission process.</p>
          <button className="btn btn-primary" onClick={() => navigate('/student/registrations/new')}>
            Create First Registration
          </button>
        </div>
      )}

      {!loading && cases.length > 0 && visibleCases.length === 0 && (
        <div className="su-empty-state">
          <div className="su-empty-icon">✅</div>
          <h5>No Cases Need Attention Right Now</h5>
          <p className="text-muted">Your dashboard only shows cases that need action first or were updated most recently.</p>
        </div>
      )}

      {visibleCases.length > 0 && (
        <div className="mb-3">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
            <h2 className="h6 mb-0 su-page-title">Attention & Recent Activity</h2>
            <span className="text-muted small">Showing up to {DASHBOARD_CASE_LIMIT} active cases</span>
          </div>
          <p className="text-muted small mb-0">
            Actionable cases appear first, followed by your most recently updated in-progress work.
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
              aria-label={`${navigationTarget.label}: ${c.title || `Case #${c.id}`}`}
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
                    <h3 className="h6 mb-1 fw-bold">{c.title || `Case #${c.id}`}</h3>
                    <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
                      <span className="badge bg-dark-subtle text-dark-emphasis" style={{ borderRadius: '999px' }}>{c.type}</span>
                      <span className={`badge status-badge ${statusBadgeClass(c.status)}`}>{formatStatus(c.status)}</span>
                    </div>
                    <StudentCaseWorkflowProgress status={c.status} className="mb-2" />
                    <p className="text-muted small mb-0">
                      Last updated: {c.updatedAt ? new Date(c.updatedAt).toLocaleString() : 'N/A'}
                    </p>
                    <p className="small fw-semibold text-body-secondary mb-0 mt-2">
                      Next: {navigationTarget.label}
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
