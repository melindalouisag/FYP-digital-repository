import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '@/services/api/admin';
import PortalIcon from '@/shared/ui/PortalIcon';
import EmptyState from '@/shared/ui/EmptyState';
import StatusBadge from '@/shared/ui/StatusBadge';
import type { AdminStudentReviewGroup } from '@/types/workflow';
import { formatFacultyName } from '@/utils/facultyLabel';
import { adminSidebarIcons } from '@/utils/portalIcons';
import ShellLayout from '../../ShellLayout';
import { resolvePrimaryCase } from '../studentTracking';

export default function AdminReviewPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<AdminStudentReviewGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        setGroups(await adminApi.reviewQueueGrouped());
      } catch (err) {
        setGroups([]);
        setError(err instanceof Error ? err.message : 'Failed to load review queue.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const rows = useMemo(() => (
    groups.map((group) => {
      const primaryCase = resolvePrimaryCase(group.cases);
      return {
        studentUserId: group.studentUserId,
        studentName: group.studentName,
        studentIdNumber: group.studentIdNumber || 'Not available',
        faculty: formatFacultyName(group.faculty),
        program: group.program || 'Not available',
        title: primaryCase?.title?.trim() || 'Untitled publication',
        status: primaryCase?.status,
        updatedAt: primaryCase?.updatedAt ?? primaryCase?.latestSubmissionAt ?? null,
        reviewCaseCount: group.cases.length,
      };
    }).sort((left, right) => compareReviewRows(left.status, right.status, left.updatedAt, right.updatedAt))
  ), [groups]);

  return (
    <ShellLayout
      title="Submission Review"
      subtitle="Review submissions that have already been sent to the library and open each student record for checklist processing."
    >
      {error ? <div className="alert alert-danger">{error}</div> : null}

      <section className="su-section">
        {loading ? (
          <div className="text-center py-5">
            <div className="su-spinner mx-auto mb-3" />
            <div className="text-muted">Loading review queue...</div>
          </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="No submissions awaiting review"
              description="Library review cases will appear here after supervisors forward them to the library."
              icon={<PortalIcon src={adminSidebarIcons.submission} size={40} />}
              centered
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
                {rows.map((row) => (
                  <tr
                    key={row.studentUserId}
                    className="su-table-row-clickable"
                    tabIndex={0}
                    onClick={() => navigate(`/admin/review/students/${row.studentUserId}`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        navigate(`/admin/review/students/${row.studentUserId}`);
                      }
                    }}
                  >
                    <td>
                      <div className="fw-semibold">{row.studentName}</div>
                      <div className="su-secondary-text">{row.reviewCaseCount} case{row.reviewCaseCount === 1 ? '' : 's'}</div>
                    </td>
                    <td>{row.studentIdNumber}</td>
                    <td>{row.program}</td>
                    <td>
                      <div className="su-table-title">{row.title}</div>
                      <div className="su-secondary-text">{row.faculty}</div>
                    </td>
                    <td>{row.status ? <StatusBadge status={row.status} /> : null}</td>
                    <td>{row.updatedAt ? new Date(row.updatedAt).toLocaleString() : 'Not available'}</td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/admin/review/students/${row.studentUserId}`);
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

function compareReviewRows(
  leftStatus: string | undefined,
  rightStatus: string | undefined,
  leftUpdatedAt: string | null,
  rightUpdatedAt: string | null
) {
  const priorityDelta = reviewPriority(leftStatus) - reviewPriority(rightStatus);
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  return compareDates(rightUpdatedAt, leftUpdatedAt);
}

function reviewPriority(status?: string) {
  switch (status) {
    case 'NEEDS_REVISION_LIBRARY':
      return 0;
    case 'UNDER_LIBRARY_REVIEW':
      return 1;
    case 'FORWARDED_TO_LIBRARY':
      return 2;
    default:
      return 3;
  }
}

function compareDates(left?: string | null, right?: string | null) {
  const leftValue = left ? Date.parse(left) || 0 : 0;
  const rightValue = right ? Date.parse(right) || 0 : 0;
  return leftValue - rightValue;
}
