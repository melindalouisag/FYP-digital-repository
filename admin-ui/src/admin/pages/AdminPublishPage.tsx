import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ShellLayout from '../../layout/ShellLayout';
import { adminApi } from '../../lib/api/admin';
import type { AdminPublishQueueItem } from '../../lib/types/workflow';
import { formatStatus, statusBadgeClass } from '../../lib/workflowUi';

export default function AdminPublishPage() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<AdminPublishQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingCaseId, setWorkingCaseId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setCases(await adminApi.publishQueue());
    } catch (err) {
      setCases([]);
      setError(err instanceof Error ? err.message : 'Failed to load publish queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const publishCase = async (caseId: number) => {
    setWorkingCaseId(caseId);
    setError('');
    setMessage('');
    try {
      await adminApi.publish(caseId);
      setMessage(`Case #${caseId} published to repository.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish action failed.');
    } finally {
      setWorkingCaseId(null);
    }
  };

  return (
    <ShellLayout title="Publish Manager" subtitle="Publish cases that are ready for repository release">
      {error && <div className="alert alert-danger d-flex align-items-center gap-2" style={{ borderRadius: '0.75rem' }}><span>⚠️</span> {error}</div>}
      {message && <div className="alert alert-success d-flex align-items-center gap-2" style={{ borderRadius: '0.75rem' }}><span>✅</span> {message}</div>}

      {loading && (
        <div className="text-center py-5">
          <div className="su-spinner mx-auto mb-3" />
          <div className="text-muted">Loading publish queue...</div>
        </div>
      )}

      {!loading && cases.length === 0 && (
        <div className="su-empty-state">
          <div className="su-empty-icon">🚀</div>
          <h5>Nothing to Publish</h5>
          <p className="text-muted">No cases ready to be published yet.</p>
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
                  <h5 className="fw-bold mb-1">{c.title || `Case #${c.caseId}`}</h5>
                  <div className="d-flex flex-wrap gap-2 align-items-center">
                    <span className="badge bg-dark-subtle text-dark-emphasis" style={{ borderRadius: '999px' }}>{c.type}</span>
                    <span className={`badge status-badge ${statusBadgeClass(c.status)}`}>{formatStatus(c.status)}</span>
                    <span className="text-muted small">Updated: {c.updatedAt ? new Date(c.updatedAt).toLocaleString() : 'N/A'}</span>
                  </div>
                </div>
                <div className="d-flex flex-wrap gap-2">
                  <button
                    className="btn btn-success btn-sm"
                    style={{ borderRadius: '999px' }}
                    disabled={workingCaseId === c.caseId || c.status !== 'READY_TO_PUBLISH'}
                    onClick={(event) => {
                      event.stopPropagation();
                      void publishCase(c.caseId);
                    }}
                  >
                    {workingCaseId === c.caseId ? '⏳ Publishing...' : '🚀 Publish'}
                  </button>
                  <button
                    className="btn btn-outline-primary btn-sm"
                    style={{ borderRadius: '999px' }}
                    onClick={(event) => {
                      event.stopPropagation();
                      navigate(`/admin/publish/${c.caseId}`);
                    }}
                  >
                    Open Details →
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ShellLayout>
  );
}
