import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { adminApi } from '@/services/api/admin';
import DownloadFilenameLink from '@/shared/ui/DownloadFilenameLink';
import EmptyState from '@/shared/ui/EmptyState';
import StatusBadge from '@/shared/ui/StatusBadge';
import type { AdminStudentTrackingDetail } from '@/types/workflow';
import { formatFacultyName, normalizeFacultyCode } from '@/utils/facultyLabel';
import ShellLayout from '../../ShellLayout';
import {
  buildTrackingTimeline,
  statusDescriptionText,
  resolvePrimaryCase,
} from '../studentTracking';

export default function AdminStudentProfilePage() {
  const navigate = useNavigate();
  const { facultyCode, studentUserId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [detail, setDetail] = useState<AdminStudentTrackingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const selectedCaseId = searchParams.get('caseId');

  useEffect(() => {
    const load = async () => {
      if (!studentUserId) {
        return;
      }

      setLoading(true);
      setError('');
      try {
        setDetail(await adminApi.studentDetail(
          Number(studentUserId),
          selectedCaseId ? Number(selectedCaseId) : undefined
        ));
      } catch (err) {
        setDetail(null);
        setError(err instanceof Error ? err.message : 'Failed to load student profile.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [selectedCaseId, studentUserId]);

  const selectedCase = detail?.selectedCase ?? null;
  const activeCase = selectedCase?.case ?? null;
  const selectedRegistration = selectedCase?.registration ?? null;
  const selectedSubmissions = selectedCase?.submissions ?? selectedCase?.versions ?? [];
  const latestSubmission = selectedSubmissions[0] ?? null;
  const previousVersions = selectedSubmissions.slice(1);
  const timelineItems = buildTrackingTimeline(selectedCase);
  const facultyLabel = formatFacultyName(detail?.faculty ?? facultyCode);
  const primaryCase = useMemo(() => resolvePrimaryCase(detail?.cases ?? []), [detail?.cases]);
  const publishTarget = activeCase && (
    activeCase.status === 'CLEARANCE_APPROVED'
      || activeCase.status === 'READY_TO_PUBLISH'
      || activeCase.status === 'PUBLISHED'
  )
    ? `/admin/publish/${activeCase.id}`
    : null;

  return (
    <ShellLayout title="Student Profile">
      <div className="su-section-header mb-4">
        <div>
          <h2 className="su-section-title mb-1">{detail?.studentName ?? 'Student Profile'}</h2>
        </div>
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => navigate(`/admin/students/${normalizeFacultyCode(facultyCode) ?? normalizeFacultyCode(detail?.faculty) ?? 'FET'}`)}
        >
          Back to Student List
        </button>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      {loading ? (
        <div className="text-center py-5">
          <div className="su-spinner mx-auto mb-3" />
          <div className="text-muted">Loading student profile...</div>
        </div>
      ) : !detail ? (
        <EmptyState
          title="Student not found"
          description="The selected student record could not be found."
        />
      ) : (
        <>
          {detail.cases.length > 1 ? (
            <div className="su-filter-bar mb-4">
              <div className="su-secondary-text">Current case</div>
              <select
                className="form-select"
                value={detail.selectedCaseId ?? primaryCase?.caseId ?? ''}
                onChange={(event) => {
                  const nextParams = new URLSearchParams(searchParams);
                  nextParams.set('caseId', event.target.value);
                  setSearchParams(nextParams);
                }}
              >
                {detail.cases.map((item) => (
                  <option key={item.caseId} value={item.caseId}>
                    {(item.title?.trim() || 'Untitled publication')} • {item.status.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {!selectedCase || !activeCase ? (
            <EmptyState
              title="No Submissions Yet"
              description="This student does not have a publication case to review yet."
            />
          ) : (
            <>
              <section className="su-section mb-4">
                <div className="su-section-header">
                  <div>
                    <h2 className="su-section-title mb-1">Student Info</h2>
                    <p className="su-secondary-text mb-0">Current publication case and student record.</p>
                  </div>
                  <StatusBadge status={activeCase.status} />
                </div>

                <div className="su-detail-grid">
                  <InfoItem label="Name" value={detail.studentName} />
                  <InfoItem label="ID" value={detail.studentIdNumber || 'Not available'} />
                  <InfoItem label="Faculty" value={facultyLabel} />
                  <InfoItem label="Program" value={detail.program || 'Not available'} />
                  <InfoItem label="Title" value={selectedRegistration?.title || activeCase.title || 'Untitled publication'} />
                  <InfoItem
                    label="Supervisor(s)"
                    value={selectedCase.supervisors?.length
                      ? selectedCase.supervisors.map((item) => item.name || item.email).join(', ')
                      : 'Not assigned'}
                  />
                  <InfoItem label="Current Status" value={statusDescriptionText(activeCase.status)} />
                  <InfoItem label="Last Updated" value={activeCase.updatedAt ? new Date(activeCase.updatedAt).toLocaleString() : 'Not available'} />
                </div>
              </section>

              <section className="su-section mb-4">
                <div className="su-section-header">
                  <div>
                    <h2 className="su-section-title mb-1">Progress Timeline</h2>
                    <p className="su-secondary-text mb-0">Workflow milestones based on the current publication case.</p>
                  </div>
                </div>
                <StudentProgressTimeline items={timelineItems} />
              </section>

              <section className="su-section mb-4">
                <div className="su-section-header">
                  <div>
                    <h2 className="su-section-title mb-1">Supporting Data</h2>
                  </div>
                </div>

                <div className="su-support-grid">
                  <div className="su-support-card">
                    <h3 className="su-subsection-title">Latest Submission</h3>
                    {latestSubmission ? (
                      <>
                        <div className="su-secondary-text mb-2">
                          Uploaded {latestSubmission.createdAt ? new Date(latestSubmission.createdAt).toLocaleString() : 'Not available'}
                        </div>
                        <DownloadFilenameLink
                          href={`/api/admin/cases/${activeCase.id}/submissions/${latestSubmission.id}/download`}
                          filename={latestSubmission.originalFilename || 'Latest submission'}
                        />
                      </>
                    ) : (
                      <p className="su-secondary-text mb-0">No submission file is available.</p>
                    )}
                  </div>

                  <div className="su-support-card">
                    <h3 className="su-subsection-title">Previous Versions</h3>
                    {previousVersions.length === 0 ? (
                      <p className="su-secondary-text mb-0">No previous versions are available.</p>
                    ) : (
                      <div className="su-support-list">
                        {previousVersions.map((version) => (
                          <div key={version.id} className="su-support-list-item">
                            <div className="fw-semibold">Version {version.versionNumber}</div>
                            <DownloadFilenameLink
                              href={`/api/admin/cases/${activeCase.id}/submissions/${version.id}/download`}
                              filename={version.originalFilename || `Version ${version.versionNumber}`}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="su-section">
                <div className="su-section-header">
                  <div>
                    <h2 className="su-section-title mb-1">Quick Actions</h2>
                    <p className="su-secondary-text mb-0">Open the current case in the existing admin workflow pages.</p>
                  </div>
                </div>
                <div className="su-action-row">
                  <button type="button" className="btn btn-primary" onClick={() => navigate(`/admin/review/${activeCase.id}`)}>
                    Review
                  </button>
                  {publishTarget ? (
                    <button type="button" className="btn btn-outline-secondary" onClick={() => navigate(publishTarget)}>
                      Publish
                    </button>
                  ) : null}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </ShellLayout>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="su-detail-item">
      <div className="su-detail-label">{label}</div>
      <div className="su-detail-value">{value}</div>
    </div>
  );
}

function StudentProgressTimeline({
  items,
}: {
  items: ReturnType<typeof buildTrackingTimeline>;
}) {
  if (items.length === 0) {
    return <p className="su-dashboard-empty-copy mb-0">No workflow progress is available for this case.</p>;
  }

  return (
    <ol className="su-student-timeline">
      {items.map((item) => (
        <li
          key={item.id}
          className={[
            'su-student-timeline-item',
            item.isCurrent ? 'is-current' : '',
            item.isComplete ? 'is-complete' : '',
          ].filter(Boolean).join(' ')}
        >
          <div className="su-student-timeline-marker" aria-hidden="true" />
          <div className="su-student-timeline-content">
            <div className="su-student-timeline-header">
              <div>
                <h3 className="su-subsection-title mb-1">{item.title}</h3>
                <div className="su-secondary-text">
                  {item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Pending'}
                </div>
              </div>
              <span className={`su-timeline-pill${item.isCurrent ? ' is-current' : ''}`}>
                {item.statusLabel}
              </span>
            </div>
            {item.actorLabel ? (
              <div className="su-secondary-text">{item.actorLabel}</div>
            ) : null}
            {item.comment ? (
              <div className="su-timeline-note">{item.comment}</div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
