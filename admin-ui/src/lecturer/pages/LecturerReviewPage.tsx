import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ShellLayout from '../../ShellLayout';
import { lecturerApi, type LecturerStudentGroup } from '../../lib/api/lecturer';
import PortalIcon from '../../lib/components/PortalIcon';
import { lecturerSidebarIcons } from '../../lib/portalIcons';

export default function LecturerReviewPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<LecturerStudentGroup[]>([]);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setGroups(await lecturerApi.pendingSupervisor(year));
    } catch (err) {
      setGroups([]);
      setError(err instanceof Error ? err.message : 'Failed to load review queue.');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void load();
  }, [load]);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1];
  }, []);

  const displayCaseTitle = (value?: string | null) => value?.trim() || 'Untitled submission';

  return (
    <ShellLayout title="Submission Review" subtitle="Review submission cases grouped by student for supervisor action">
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="d-flex flex-wrap align-items-center gap-2 mb-4">
        <label className="form-label mb-0 fw-semibold small">Year:</label>
        <select
          className="form-select form-select-sm"
          style={{ width: 120, borderRadius: '999px' }}
          value={year}
          onChange={(event) => setYear(Number(event.target.value))}
        >
          {yearOptions.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="text-center py-5">
          <div className="su-spinner mx-auto mb-3" />
          <div className="text-muted">Loading review queue...</div>
        </div>
      )}

      {!loading && groups.length === 0 && (
        <div className="su-empty-state">
          <div className="su-empty-icon">
            <PortalIcon src={lecturerSidebarIcons.review} size={40} />
          </div>
          <h5>No Cases Awaiting Supervisor Review</h5>
          <p className="text-muted">No cases are waiting for supervisor review for {year}.</p>
        </div>
      )}

      {!loading && groups.length > 0 && (
        <div className="mb-3">
          <p className="text-muted small mb-0">
            Select a student record to open case history, submission files, and the supervisor actions for each case.
          </p>
        </div>
      )}

      <div className="row g-3">
        {groups.map((group, index) => {
          const latestSubmissionAt = group.cases
            .map((c) => (c.latestSubmissionAt ? new Date(c.latestSubmissionAt).getTime() : 0))
            .reduce((max, current) => Math.max(max, current), 0);

          return (
            <div className="col-lg-6" key={group.studentUserId}>
              <div
                className="su-card su-card-clickable h-100 fade-in"
                role="button"
                onClick={() => navigate(`/lecturer/students/${group.studentUserId}?tab=supervisor`)}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="card-body p-4">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <h3 className="h6 mb-1 fw-bold">{group.studentName || group.studentEmail}</h3>
                      <div className="text-muted small">
                        Student ID: {group.studentIdNumber ?? 'N/A'} / {group.faculty ?? 'Faculty N/A'}
                      </div>
                    </div>
                    <span className="badge bg-primary-subtle text-primary-emphasis" style={{ borderRadius: '999px' }}>
                      {group.cases.length} case{group.cases.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="text-muted small mb-2">
                    Latest submission: {latestSubmissionAt ? new Date(latestSubmissionAt).toLocaleString() : 'N/A'}
                  </div>
                  <div className="vstack gap-1">
                    {group.cases.map((c) => (
                      <div key={c.caseId} className="small p-2" style={{ background: '#f8fafc', borderRadius: '0.4rem' }}>
                        {displayCaseTitle(c.registrationTitle)}
                      </div>
                    ))}
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
