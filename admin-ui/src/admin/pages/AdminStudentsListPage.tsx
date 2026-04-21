import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminApi } from '@/services/api/admin';
import EmptyState from '@/shared/ui/EmptyState';
import StatusBadge from '@/shared/ui/StatusBadge';
import type { AdminStudentTrackingGroup, CaseStatus } from '@/types/workflow';
import { formatFacultyName, normalizeFacultyCode, type FacultyCode } from '@/utils/facultyLabel';
import { formatStatus } from '@/utils/workflowUi';
import ShellLayout from '../../ShellLayout';
import { buildFacultySummaries, buildStudentListRows, isRevisionStatus } from '../studentTracking';

type SortValue = 'desc' | 'asc';

export default function AdminStudentsListPage() {
  const navigate = useNavigate();
  const { facultyCode } = useParams();
  const activeFacultyCode = normalizeFacultyCode(facultyCode) as FacultyCode | null;
  const [groups, setGroups] = useState<AdminStudentTrackingGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | CaseStatus>('ALL');
  const [sortValue, setSortValue] = useState<SortValue>('desc');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        setGroups(await adminApi.students());
      } catch (err) {
        setGroups([]);
        setError(err instanceof Error ? err.message : 'Failed to load student list.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const rows = useMemo(() => (
    activeFacultyCode ? buildStudentListRows(groups, activeFacultyCode) : []
  ), [activeFacultyCode, groups]);

  const availableStatuses = useMemo(() => {
    return rows.reduce<CaseStatus[]>((items, row) => {
      if (!row.status || items.includes(row.status)) {
        return items;
      }
      return [...items, row.status];
    }, []);
  }, [rows]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (statusFilter !== 'ALL' && row.status !== statusFilter) {
          return false;
        }
        if (!normalizedQuery) {
          return true;
        }

        return [
          row.studentName,
          row.studentIdNumber,
          row.program,
          row.publicationTitle,
        ].some((value) => value.toLowerCase().includes(normalizedQuery));
      })
      .sort((left, right) => {
        const delta = compareDates(left.lastUpdated, right.lastUpdated);
        return sortValue === 'desc' ? -delta : delta;
      });
  }, [query, rows, sortValue, statusFilter]);

  const facultySummary = useMemo(() => (
    activeFacultyCode
      ? buildFacultySummaries(groups).find((item) => item.code === activeFacultyCode) ?? null
      : null
  ), [activeFacultyCode, groups]);

  const revisionRequired = useMemo(() => (
    rows.filter((row) => isRevisionStatus(row.status)).length
  ), [rows]);

  if (!activeFacultyCode) {
    return (
      <ShellLayout title="Students" subtitle="Student tracking">
        <EmptyState
          title="Faculty not found"
          description="Open the Students overview and choose one of the available faculty views."
          action={(
            <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/admin/students')}>
              Back to Students
            </button>
          )}
        />
      </ShellLayout>
    );
  }

  return (
    <ShellLayout
      title="Students"
      subtitle={`Faculty view for ${formatFacultyName(activeFacultyCode)}`}
    >
      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="su-summary-grid mb-4">
        <div className="su-summary-card">
          <div className="su-secondary-text">Total Students</div>
          <div className="su-summary-value">{facultySummary?.totalStudents ?? 0}</div>
        </div>
        <div className="su-summary-card">
          <div className="su-secondary-text">Active Cases</div>
          <div className="su-summary-value">{facultySummary?.activeCases ?? 0}</div>
        </div>
        <div className="su-summary-card">
          <div className="su-secondary-text">Pending Review</div>
          <div className="su-summary-value">{facultySummary?.pendingReview ?? 0}</div>
        </div>
        <div className="su-summary-card">
          <div className="su-secondary-text">Revision Required</div>
          <div className="su-summary-value">{revisionRequired}</div>
        </div>
      </div>

      <section className="su-section">
        <div className="su-section-header">
          <div>
            <h2 className="su-section-title mb-1">Student List</h2>
            <p className="su-secondary-text mb-0">Search, filter, and review the latest publication record for each student.</p>
          </div>
          <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/admin/students')}>
            Back to Faculties
          </button>
        </div>

        <div className="su-filter-bar">
          <input
            className="form-control"
            placeholder="Search by student, ID, program, or publication title"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            className="form-select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'ALL' | CaseStatus)}
          >
            <option value="ALL">All statuses</option>
            {availableStatuses.map((status) => (
              <option key={status} value={status}>{formatStatus(status)}</option>
            ))}
          </select>
          <select
            className="form-select"
            value={sortValue}
            onChange={(event) => setSortValue(event.target.value as SortValue)}
          >
            <option value="desc">Last updated: newest first</option>
            <option value="asc">Last updated: oldest first</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="su-spinner mx-auto mb-3" />
            <div className="text-muted">Loading students...</div>
          </div>
        ) : filteredRows.length === 0 ? (
          <EmptyState
            title="No students found"
            description="Adjust the current search or filter to see matching student records."
          />
        ) : (
          <div className="su-table-shell">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Student ID</th>
                  <th>Program</th>
                  <th>Publication Title</th>
                  <th>Status</th>
                  <th>Last Updated</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr
                    key={row.studentUserId}
                    className="su-table-row-clickable"
                    tabIndex={0}
                    onClick={() => navigate(`/admin/students/${activeFacultyCode}/${row.studentUserId}`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        navigate(`/admin/students/${activeFacultyCode}/${row.studentUserId}`);
                      }
                    }}
                  >
                    <td>
                      <div className="fw-semibold">{row.studentName}</div>
                      <div className="su-secondary-text">{row.caseCount} case{row.caseCount === 1 ? '' : 's'}</div>
                    </td>
                    <td>{row.studentIdNumber}</td>
                    <td>{row.program}</td>
                    <td>
                      <div className="su-table-title">{row.publicationTitle}</div>
                      <div className="su-secondary-text">{row.faculty}</div>
                    </td>
                    <td>
                      {row.status ? <StatusBadge status={row.status} /> : <span className="su-secondary-text">No case</span>}
                    </td>
                    <td>{row.lastUpdated ? new Date(row.lastUpdated).toLocaleString() : 'Not available'}</td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/admin/students/${activeFacultyCode}/${row.studentUserId}`);
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </ShellLayout>
  );
}

function compareDates(left?: string | null, right?: string | null) {
  const leftValue = left ? Date.parse(left) || 0 : 0;
  const rightValue = right ? Date.parse(right) || 0 : 0;
  return leftValue - rightValue;
}
