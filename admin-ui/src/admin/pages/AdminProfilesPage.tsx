import { useCallback, useEffect, useMemo, useState } from 'react';
import ShellLayout from '../../ShellLayout';
import { adminApi } from '../../lib/api/admin';
import type { AdminUserDirectoryItem } from '../../lib/workflowTypes';

type DirectoryTab = 'students' | 'lecturers';

interface DirectoryFilters {
  q: string;
  faculty: string;
  studyProgram: string;
}

const EMPTY_FILTERS: DirectoryFilters = {
  q: '',
  faculty: '',
  studyProgram: '',
};

export default function AdminProfilesPage() {
  const [activeTab, setActiveTab] = useState<DirectoryTab>('students');
  const [draftFilters, setDraftFilters] = useState<DirectoryFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<DirectoryFilters>(EMPTY_FILTERS);
  const [rows, setRows] = useState<AdminUserDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = activeTab === 'students'
        ? await adminApi.studentDirectory(appliedFilters)
        : await adminApi.lecturerDirectory(appliedFilters);
      setRows(payload);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'Failed to load profile directory.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, appliedFilters]);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  const studyProgramLabel = activeTab === 'students' ? 'Study Program' : 'Department';
  const resultLabel = useMemo(
    () => `${rows.length} ${activeTab === 'students' ? 'student' : 'lecturer'} profile${rows.length === 1 ? '' : 's'}`,
    [activeTab, rows.length]
  );

  return (
    <ShellLayout title="Profiles" subtitle="Browse student and lecturer profiles with compact academic filters">
      <div className="su-card mb-3">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap gap-2 mb-3">
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

          <div className="row g-3 align-items-end">
            <div className="col-12 col-lg-4">
              <label className="form-label">Name or email</label>
              <input
                className="form-control"
                value={draftFilters.q}
                onChange={(event) => setDraftFilters((current) => ({ ...current, q: event.target.value }))}
                placeholder={`Search ${activeTab} by name or email`}
              />
            </div>
            <div className="col-12 col-md-6 col-lg-3">
              <label className="form-label">Faculty</label>
              <input
                className="form-control"
                value={draftFilters.faculty}
                onChange={(event) => setDraftFilters((current) => ({ ...current, faculty: event.target.value }))}
                placeholder="Filter by faculty"
              />
            </div>
            <div className="col-12 col-md-6 col-lg-3">
              <label className="form-label">{studyProgramLabel}</label>
              <input
                className="form-control"
                value={draftFilters.studyProgram}
                onChange={(event) => setDraftFilters((current) => ({ ...current, studyProgram: event.target.value }))}
                placeholder={`Filter by ${studyProgramLabel.toLowerCase()}`}
              />
            </div>
            <div className="col-12 col-lg-2 d-flex gap-2 justify-content-lg-end">
              <button
                type="button"
                className="btn btn-primary w-100"
                onClick={() => setAppliedFilters(draftFilters)}
              >
                Apply
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary w-100"
                onClick={() => {
                  setDraftFilters(EMPTY_FILTERS);
                  setAppliedFilters(EMPTY_FILTERS);
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="su-card">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <div>
              <h3 className="h6 su-page-title mb-1">
                {activeTab === 'students' ? 'Student Profiles' : 'Lecturer Profiles'}
              </h3>
              <div className="su-dashboard-item-meta">{resultLabel}</div>
            </div>
          </div>

          {loading ? (
            <div className="text-muted">Loading profiles...</div>
          ) : rows.length === 0 ? (
            <div className="text-muted">No profiles matched the current filters.</div>
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
