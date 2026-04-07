import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ShellLayout from '../../ShellLayout';
import { studentApi } from '../../lib/api/student';
import { getRoleDisplayLabel } from '../../lib/uiLabels';
import type { CaseDetailPayload, ChecklistResult } from '../../lib/workflowTypes';

export default function StudentFeedbackPage() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<CaseDetailPayload | null>(null);
  const [checklist, setChecklist] = useState<ChecklistResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!caseId) return;
      setLoading(true);
      setError('');
      try {
        const [caseDetail, checklistResults] = await Promise.all([
          studentApi.caseDetail(Number(caseId)),
          studentApi.listChecklistResults(Number(caseId)).catch(() => []),
        ]);
        setDetail(caseDetail);
        setChecklist(checklistResults);
      } catch (err) {
        setDetail(null);
        setChecklist([]);
        setError(err instanceof Error ? err.message : 'Failed to load feedback.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [caseId]);

  const comments = detail?.comments ?? [];
  const hasFeedback = comments.length > 0 || checklist.length > 0;
  const title = detail?.case.title?.trim() ? detail.case.title : 'Feedback';

  return (
    <ShellLayout title={title} subtitle="Feedback">
      <button
        className="btn btn-outline-secondary btn-sm mb-4"
        style={{ borderRadius: '999px' }}
        onClick={() => navigate(caseId ? `/student/cases/${caseId}` : '/student/submissions')}
      >
        Return to Publication Detail
      </button>

      {loading && (
        <div className="text-center py-5">
          <div className="su-spinner mx-auto mb-3" />
          <div className="text-muted">Loading feedback...</div>
        </div>
      )}
      {error && <div className="alert alert-danger">{error}</div>}

      {!loading && !error && !hasFeedback && (
        <div className="su-card">
          <div className="card-body p-4">
            <h3 className="h6 su-page-title mb-2">Feedback</h3>
            <p className="text-muted small mb-0">No feedback yet.</p>
          </div>
        </div>
      )}

      {!loading && comments.length > 0 && (
        <div className="su-card mb-3">
          <div className="card-body p-4">
            <h3 className="h6 su-page-title mb-3">Comments</h3>
            <div className="vstack gap-2">
              {comments.map((comment) => (
                <div
                  className="p-3"
                  key={comment.id}
                  style={{ background: '#f8fafc', borderRadius: '0.6rem', border: '1px solid #e8eff5' }}
                >
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <div className="fw-semibold small">
                      {getRoleDisplayLabel(comment.authorRole)}
                      {comment.authorEmail ? ` — ${comment.authorEmail}` : ''}
                    </div>
                    <div className="text-muted small">
                      {comment.createdAt ? new Date(comment.createdAt).toLocaleString() : 'N/A'}
                    </div>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{comment.body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!loading && checklist.length > 0 && (
        <div className="su-card">
          <div className="card-body p-4">
            <h3 className="h6 su-page-title mb-3">Checklist Outcomes</h3>
            <div className="vstack gap-2">
              {checklist.map((result) => (
                <div
                  className="d-flex justify-content-between align-items-center p-3"
                  key={result.id}
                  style={{ background: '#f8fafc', borderRadius: '0.6rem', border: '1px solid #e8eff5' }}
                >
                  <div>
                    <div className="fw-semibold">{result.checklistItem.itemText}</div>
                    {result.note && <div className="text-muted small mt-1">{result.note}</div>}
                  </div>
                  <span
                    className={`badge ${result.passFail === 'PASS' ? 'bg-success' : 'bg-danger'}`}
                    style={{ borderRadius: '999px' }}
                  >
                    {result.passFail}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </ShellLayout>
  );
}
