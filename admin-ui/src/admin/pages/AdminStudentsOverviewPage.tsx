import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '@/services/api/admin';
import EmptyState from '@/shared/ui/EmptyState';
import type { AdminStudentTrackingGroup } from '@/types/workflow';
import ShellLayout from '../../ShellLayout';
import { buildFacultySummaries } from '../studentTracking';

export default function AdminStudentsOverviewPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<AdminStudentTrackingGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        setGroups(await adminApi.students());
      } catch (err) {
        setGroups([]);
        setError(err instanceof Error ? err.message : 'Failed to load student tracking.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const facultySummaries = useMemo(() => buildFacultySummaries(groups), [groups]);

  return (
    <ShellLayout title="Students">
      {error ? <div className="alert alert-danger">{error}</div> : null}

      {loading ? (
        <div className="text-center py-5">
          <div className="su-spinner mx-auto mb-3" />
          <div className="text-muted">Loading student tracking...</div>
        </div>
      ) : facultySummaries.every((item) => item.totalStudents === 0) ? (
        <EmptyState
          title="No Students Found"
          description="Student publication records will appear here after workflow cases are created."
        />
      ) : (
        <section className="su-faculty-grid">
          {facultySummaries.map((faculty) => (
            <button
              key={faculty.code}
              type="button"
              className="su-faculty-card"
              onClick={() => navigate(`/admin/students/${faculty.code}`)}
            >
              <div className="su-faculty-card-title">{faculty.label}</div>
              <div className="su-faculty-card-metrics">
                <div className="su-faculty-card-metric">
                  <span className="su-secondary-text">Total Students</span>
                  <strong>{faculty.totalStudents}</strong>
                </div>
                <div className="su-faculty-card-metric">
                  <span className="su-secondary-text">Active Cases</span>
                  <strong>{faculty.activeCases}</strong>
                </div>
                <div className="su-faculty-card-metric">
                  <span className="su-secondary-text">Pending Review</span>
                  <strong>{faculty.pendingReview}</strong>
                </div>
                <div className="su-faculty-card-metric">
                  <span className="su-secondary-text">Completed</span>
                  <strong>{faculty.completed}</strong>
                </div>
              </div>
            </button>
          ))}
        </section>
      )}
    </ShellLayout>
  );
}
