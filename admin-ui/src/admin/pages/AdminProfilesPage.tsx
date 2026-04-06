import { useCallback, useEffect, useMemo, useState } from 'react';
import ShellLayout from '../../ShellLayout';
import { adminApi } from '../../lib/api/admin';
import type { AdminUserDirectoryItem } from '../../lib/workflowTypes';

type DirectoryTab = 'students' | 'lecturers';

export default function AdminProfilesPage() {
  const [activeTab, setActiveTab] = useState<DirectoryTab>('students');
  const [rows, setRows] = useState<AdminUserDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = activeTab === 'students'
        ? await adminApi.studentDirectory()
        : await adminApi.lecturerDirectory();
      setRows(payload);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'Failed to load profile directory.');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  const studyProgramLabel = activeTab === 'students' ? 'Study Program' : 'Department';
  const resultLabel = useMemo(
    () => `${rows.length} ${activeTab === 'students' ? 'student' : 'lecturer'} profile${rows.length === 1 ? '' : 's'}`,
    [activeTab, rows.length]
  );

  return (
    <ShellLayout title="Profiles" subtitle="Browse student and lecturer profiles">
      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="su-card">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
            <div>
              <h3 className="h6 su-page-title mb-1">
                {activeTab === 'students' ? 'Student Profiles' : 'Lecturer Profiles'}
              </h3>
              <div className="su-dashboard-item-meta">{resultLabel}</div>
            </div>
            <div className="d-flex flex-wrap gap-2">
              <button
                type="button"
                className={`btn btn-sm ${activeTab === 'students' ? 'btn-primary' : 'btn-outline-secondary'}`}
                style={{ borderRadius: '999px' }}
                onClick={() => setActiveTab('students')}
              >
                Students
              </button>
              <button
                type="button"
                className={`btn btn-sm ${activeTab === 'lecturers' ? 'btn-primary' : 'btn-outline-secondary'}`}
                style={{ borderRadius: '999px' }}
                onClick={() => setActiveTab('lecturers')}
              >
                Lecturers
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-muted">Loading profiles...</div>
          ) : rows.length === 0 ? (
            <div className="text-muted">No profiles available.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>Full Name</th>
                    <th>Email</th>
                    <th>Faculty</th>
                    <th>{studyProgramLabel}</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.role}-${row.userId}`}>
                      <td>{row.fullName}</td>
                      <td>{row.email}</td>
                      <td>{row.faculty || 'N/A'}</td>
                      <td>{row.studyProgram || 'N/A'}</td>
                      <td>{row.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ShellLayout>
  );
}
