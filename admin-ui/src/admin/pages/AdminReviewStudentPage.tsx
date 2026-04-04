import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ShellLayout from '../../ShellLayout';
import { adminApi } from '../../lib/api/admin';
import CaseTimeline from '../../lib/components/CaseTimeline';
import type { AdminStudentReviewGroup, TimelineItem } from '../../lib/workflowTypes';
import { formatStatus, statusBadgeClass } from '../../lib/workflowUi';

export default function AdminReviewStudentPage() {
  const navigate = useNavigate();
  const { studentUserId } = useParams();
  const [group, setGroup] = useState<AdminStudentReviewGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState('');
  const [timelineItems, setTimelineItems] = useState<TimelineItem[] | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const groups = await adminApi.reviewQueueGrouped();
        const match = groups.find((row) => String(row.studentUserId) === String(studentUserId));
        setGroup(match ?? null);
      } catch (err) {
        setGroup(null);
        setError(err instanceof Error ? err.message : 'Failed to load student review queue.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [studentUserId]);

  useEffect(() => {
    setTimelineOpen(false);
    setTimelineLoading(false);
    setTimelineError('');
    setTimelineItems(null);
  }, [studentUserId, group?.studentUserId]);

  const latestActivity = useMemo(() => {
    if (!group) return null;
    return group.cases.reduce((latest, item) => {
      const next = item.latestSubmissionAt || item.updatedAt || null;
      if (!next) return latest;
      if (!latest) return next;
      return new Date(next) > new Date(latest) ? next : latest;
    }, null as string | null);
  }, [group]);

  const displayCaseTitle = (value?: string | null) => value?.trim() || 'Untitled submission';

  const loadTimeline = useCallback(async () => {
    if (!group || timelineLoading || timelineItems !== null) {
      return;
    }

    setTimelineLoading(true);
    setTimelineError('');
    try {
      const results = await Promise.allSettled(
        group.cases.map(async (c) => {
          const detail = await adminApi.caseDetail(c.caseId);
          return {
            title: displayCaseTitle(c.title ?? detail.case.title),
            items: detail.timeline ?? [],
          };
        })
      );

      const nextItems = results
        .flatMap((result) => {
          if (result.status !== 'fulfilled') {
            return [];
          }
          return result.value.items.map((item) => ({
            ...item,
            message: group.cases.length > 1
              ? `${result.value.title} • ${item.message || item.type}`
              : item.message || item.type,
          }));
        })
        .sort((left, right) => compareTimelineDates(right.at, left.at));

      setTimelineItems(nextItems);
      if (results.some((result) => result.status === 'rejected')) {
        setTimelineError('Some timeline entries could not be loaded.');
      }
    } catch {
      setTimelineItems([]);
      setTimelineError('Unable to load the review timeline right now.');
    } finally {
      setTimelineLoading(false);
    }
  }, [group, timelineItems, timelineLoading]);

  const toggleTimeline = async () => {
    const nextOpen = !timelineOpen;
    setTimelineOpen(nextOpen);
    if (nextOpen) {
      await loadTimeline();
    }
  };

  return (
    <ShellLayout title="Student Publications in Review" subtitle="Library review publications for the selected student">
      <button className="btn btn-outline-secondary btn-sm mb-4" style={{ borderRadius: '999px' }} onClick={() => navigate('/admin/review')}>
        Return to Submission Review
      </button>

      {error && <div className="alert alert-danger" style={{ borderRadius: '0.75rem' }}>{error}</div>}

      {loading && (
        <div className="text-center py-5">
          <div className="su-spinner mx-auto mb-3" />
          <div className="text-muted">Loading student review detail...</div>
        </div>
      )}

      {!loading && !group && !error && (
        <div className="su-empty-state">
          <h5>Student Not Found</h5>
          <p className="text-muted">This student is not currently in the library review queue.</p>
        </div>
      )}

      {group && (
        <>
          {/* Student Info Card */}
          <div className="su-card mb-4 fade-in">
            <div className="card-body p-4">
              <div className="d-flex flex-wrap align-items-center gap-3">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{ width: '3rem', height: '3rem', background: '#e8f4f8', color: '#0b7584', fontWeight: 700, fontSize: '1.1rem' }}
                >
                  {(group.studentName || 'S')[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="h5 mb-0 fw-bold">{group.studentName}</h3>
                  <div className="su-meta-item">
                    <strong>Student ID:</strong> {group.studentIdNumber || 'N/A'} / {group.faculty || 'N/A'} {group.program ? ` / ${group.program}` : ''}
                  </div>
                  <div className="text-muted small mt-1">
                    {group.cases.length} publication{group.cases.length > 1 ? 's' : ''} in review / Latest activity:{' '}
                    {latestActivity ? new Date(latestActivity).toLocaleString() : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cases */}
          <div className="vstack gap-3">
            {group.cases.map((c, index) => (
              <div
                className="su-card su-card-clickable fade-in"
                key={c.caseId}
                style={{ animationDelay: `${index * 0.05}s` }}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/admin/review/${c.caseId}`)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') {
                    return;
                  }
                  event.preventDefault();
                  navigate(`/admin/review/${c.caseId}`);
                }}
              >
                <div className="card-body p-4">
                  <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <div>
                      <h5 className="fw-bold mb-1">{displayCaseTitle(c.title)}</h5>
                      <div className="d-flex flex-wrap gap-2 align-items-center">
                        <span className="badge bg-dark-subtle text-dark-emphasis" style={{ borderRadius: '999px' }}>{c.type}</span>
                        <span className={`badge status-badge ${statusBadgeClass(c.status)}`}>{formatStatus(c.status)}</span>
                        <span className="text-muted small">Updated: {c.updatedAt ? new Date(c.updatedAt).toLocaleString() : 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="su-card mt-4 fade-in" style={{ animationDelay: `${group.cases.length * 0.05}s` }}>
            <div className="card-body p-4">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                <h3 className="h6 su-page-title mb-0">Review Timeline</h3>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  style={{ borderRadius: '999px' }}
                  onClick={() => void toggleTimeline()}
                >
                  {timelineOpen ? 'Hide Timeline' : 'Show Timeline'}
                </button>
              </div>

              {timelineOpen ? (
                <div className="mt-3">
                  {timelineLoading ? (
                    <p className="su-dashboard-empty-copy mb-0">Loading timeline...</p>
                  ) : (
                    <>
                      {timelineError ? <div className="alert alert-warning py-2 mb-3">{timelineError}</div> : null}
                      <CaseTimeline items={timelineItems ?? []} />
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </ShellLayout>
  );
}

function compareTimelineDates(left?: string | null, right?: string | null) {
  const leftValue = left ? Date.parse(left) || 0 : 0;
  const rightValue = right ? Date.parse(right) || 0 : 0;
  return leftValue - rightValue;
}
