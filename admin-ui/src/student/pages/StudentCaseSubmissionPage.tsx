import { calendarApi } from '../../lib/api/calendar';
import {
  findLatestDeadline,
  formatCalendarEventSchedule,
  getDeadlineBlockMessage,
  isDeadlinePassed,
} from '../../calendar/calendarUtils';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import ShellLayout from '../../ShellLayout';
import { studentApi, type SubmissionMetaPayload } from '../../lib/api/student';
import { masterApi, type Faculty } from '../../lib/api/master';
import { ApiError } from '../../lib/api/http';
import DownloadFilenameLink from '../../lib/components/DownloadFilenameLink';
import KeywordChipInput from '../../lib/components/KeywordChipInput';
import { useAuth } from '../../lib/context/AuthContext';
import { joinKeywordTokens, splitKeywordString } from '../../lib/keywords';
import type { CalendarEvent, CaseDetailPayload, ChecklistResult, SubmissionVersion, UserRole, WorkflowComment } from '../../lib/workflowTypes';
import {
  canUploadSubmission,
  formatStatus,
  getStudentCaseGuidance,
  statusBadgeClass,
} from '../../lib/workflowUi';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export default function StudentCaseSubmissionPage() {
  const { caseId } = useParams();
  const { user } = useAuth();
  const [detail, setDetail] = useState<CaseDetailPayload | null>(null);
  const [versions, setVersions] = useState<SubmissionVersion[]>([]);
  const [checklistResults, setChecklistResults] = useState<ChecklistResult[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<SubmissionMetaPayload>({
    metadataTitle: '',
    metadataAuthors: '',
    metadataKeywords: '',
    metadataFaculty: '',
    metadataStudyProgram: '',
    metadataYear: undefined,
    abstractText: '',
  });
  const [keywordTokens, setKeywordTokens] = useState<string[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [facultyLoadError, setFacultyLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [keywordTouched, setKeywordTouched] = useState(false);

  const load = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError('');
    try {
      const [caseDetail, submissionList, checklistRows] = await Promise.all([
        studentApi.caseDetail(Number(caseId)),
        studentApi.listSubmissions(Number(caseId)),
        studentApi.listChecklistResults(Number(caseId)).catch(() => []),
      ]);
      setDetail(caseDetail);
      setVersions(submissionList);
      setChecklistResults(checklistRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submission data.');
      setDetail(null);
      setVersions([]);
      setChecklistResults([]);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const loadCalendar = async () => {
      try {
        setCalendarEvents(await calendarApi.listEvents());
      } catch {
        setCalendarEvents([]);
      }
    };
    void loadCalendar();
  }, []);

  useEffect(() => {
    const loadFaculties = async () => {
      try {
        const data = await masterApi.listFaculties();
        setFaculties(data);
      } catch {
        setFacultyLoadError(true);
      }
    };
    void loadFaculties();
  }, []);

  useEffect(() => {
    setMeta((prev) => ({
      ...prev,
      metadataTitle: prev.metadataTitle?.trim()
        ? prev.metadataTitle
        : (detail?.registration?.title ?? versions[0]?.metadataTitle ?? ''),
      metadataAuthors: prev.metadataAuthors?.trim()
        ? prev.metadataAuthors
        : (detail?.registration?.authorName ?? versions[0]?.metadataAuthors ?? ''),
      metadataFaculty: prev.metadataFaculty?.trim()
        ? prev.metadataFaculty
        : (detail?.registration?.faculty ?? user?.faculty ?? versions[0]?.metadataFaculty ?? ''),
      metadataStudyProgram: prev.metadataStudyProgram?.trim()
        ? prev.metadataStudyProgram
        : (user?.program ?? versions[0]?.metadataStudyProgram ?? ''),
      metadataYear: prev.metadataYear ?? detail?.registration?.year ?? versions[0]?.metadataYear ?? undefined,
      abstractText: prev.abstractText?.trim() ? prev.abstractText : (versions[0]?.abstractText ?? ''),
    }));
    setKeywordTokens((prev) => (prev.length > 0 ? prev : splitKeywordString(versions[0]?.metadataKeywords)));
  }, [
    detail?.registration?.authorName,
    detail?.registration?.faculty,
    detail?.registration?.title,
    detail?.registration?.year,
    user?.faculty,
    user?.program,
    versions,
  ]);

  const uploadAllowed = useMemo(
    () => (detail ? canUploadSubmission(detail.case.status) : false),
    [detail]
  );
  const latestSubmission = versions[0] ?? null;
  const currentRevisionRole = useMemo<UserRole | null>(() => {
    if (!detail) {
      return null;
    }
    if (detail.case.status === 'NEEDS_REVISION_SUPERVISOR') {
      return 'LECTURER';
    }
    if (detail.case.status === 'NEEDS_REVISION_LIBRARY') {
      return 'ADMIN';
    }
    return null;
  }, [detail]);
  const revisionComments = useMemo(
    () => buildCurrentRevisionComments(detail?.comments ?? [], currentRevisionRole, latestSubmission?.createdAt),
    [currentRevisionRole, detail?.comments, latestSubmission?.createdAt]
  );
  const failedChecklistItems = useMemo(
    () => (
      currentRevisionRole === 'ADMIN'
        ? checklistResults.filter((item) => item.passFail === 'FAIL')
        : []
    ),
    [checklistResults, currentRevisionRole]
  );
  const showRevisionPanel = Boolean(currentRevisionRole);
  const submissionDeadline = useMemo(
    () => (detail ? findLatestDeadline(calendarEvents, detail.case.type, 'SUBMISSION_DEADLINE') : null),
    [calendarEvents, detail]
  );
  const submissionDeadlinePassed = isDeadlinePassed(submissionDeadline);
  const hasPreviousUploads = versions.length > 0;
  const useFacultySelect = faculties.length > 0 && !facultyLoadError;

  useEffect(() => {
    const joinedKeywords = joinKeywordTokens(keywordTokens);
    setMeta((prev) => (
      prev.metadataKeywords === joinedKeywords
        ? prev
        : { ...prev, metadataKeywords: joinedKeywords }
    ));
  }, [keywordTokens]);

  const validateFile = (candidate: File | null): string => {
    if (!candidate) {
      return 'Please choose a file before uploading.';
    }
    const lowerName = candidate.name.toLowerCase();
    if (!lowerName.endsWith('.pdf')) {
      return 'Only PDF files are accepted.';
    }
    if (candidate.size > MAX_UPLOAD_BYTES) {
      return 'File exceeds 25 MB maximum upload size.';
    }
    return '';
  };

  const validateKeywords = (tokens: string[]): string => (
    tokens.length >= 3 ? '' : 'Please enter at least 3 keywords.'
  );

  const onUpload = async () => {
    if (!caseId) return;
    setKeywordTouched(true);
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    const keywordValidationError = validateKeywords(keywordTokens);
    if (keywordValidationError) {
      setError(keywordValidationError);
      return;
    }
    if (submissionDeadlinePassed) {
      setError(getDeadlineBlockMessage('SUBMISSION_DEADLINE'));
      return;
    }
    if (!uploadAllowed) {
      setError('You can upload only after registration verification or when a revision has been requested.');
      return;
    }

    setUploading(true);
    setError('');
    setMessage('');
    try {
      await studentApi.uploadSubmission(Number(caseId), file as File, meta);
      setMessage(hasPreviousUploads ? 'Revised file uploaded successfully.' : 'First file uploaded successfully.');
      setFile(null);
      await load();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 400 || err.status === 409)) {
        setError(err.message || 'You can upload only after registration verification or when a revision has been requested.');
      } else {
        setError(err instanceof Error ? err.message : 'Upload failed.');
      }
    } finally {
      setUploading(false);
    }
  };

  const keywordError = keywordTouched ? validateKeywords(keywordTokens) : '';

  return (
    <ShellLayout
      title={detail?.case.title?.trim() || 'Submission'}
      subtitle="Submission"
    >
      {loading && <div className="alert alert-info">Loading submission page...</div>}
      {error && <div className="alert alert-danger">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}
      {submissionDeadlinePassed && submissionDeadline ? (
        <div className="alert alert-danger">
          The submission deadline has passed. {formatCalendarEventSchedule(submissionDeadline)}.
        </div>
      ) : null}

      {detail && (
        <div className="card shadow-sm mb-3">
          <div className="card-body d-flex flex-wrap justify-content-between align-items-start gap-3">
            <div>
              <div className="small text-uppercase text-muted mb-1">Current status</div>
              <span className={`badge status-badge ${statusBadgeClass(detail.case.status)}`}>{formatStatus(detail.case.status)}</span>
              <div className="text-muted small mt-2">
                {submissionDeadlinePassed
                  ? 'The submission deadline has passed for this publication.'
                  : uploadAllowed
                  ? (hasPreviousUploads
                    ? 'Upload the revised PDF and confirm that the metadata below matches the latest version.'
                    : 'Upload the first approved PDF and complete the repository metadata below.')
                  : getStudentCaseGuidance(detail.case.status)}
              </div>
            </div>
            {submissionDeadlinePassed ? (
              <div className="text-muted small">Library submission deadlines block new uploads after the scheduled time.</div>
            ) : !uploadAllowed ? (
              <div className="text-muted small">Uploads open after registration verification or when a supervisor or library revision is requested.</div>
            ) : null}
          </div>
        </div>
      )}

      {detail && showRevisionPanel ? (
        <div className="su-revision-panel mb-3">
          <div className="su-revision-panel-header">
            <div>
              <div className="su-revision-panel-kicker">Revision Guidance</div>
              <h3 className="su-revision-panel-title mb-1">
                {currentRevisionRole === 'ADMIN' ? 'Feedback from library' : 'Feedback from lecturer'}
              </h3>
              <div className="su-revision-panel-copy">
                Review the comments below before uploading the corrected file and metadata.
              </div>
            </div>
          </div>

          {revisionComments.length > 0 ? (
            <div className="su-revision-comment-list">
              {revisionComments.map((comment) => (
                <div className="su-revision-comment-item" key={comment.id}>
                  <div className="su-revision-comment-meta">
                    {comment.authorRole === 'ADMIN' ? 'Library feedback' : 'Lecturer feedback'}
                    {comment.createdAt ? ` • ${new Date(comment.createdAt).toLocaleString()}` : ''}
                  </div>
                  <div className="su-revision-comment-body">{comment.body}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="su-revision-empty-copy">
              A revision has been requested. Please update the file and confirm the metadata before uploading again.
            </div>
          )}

          {currentRevisionRole === 'ADMIN' ? (
            <div className="su-revision-section">
              <div className="su-revision-section-title">Checklist items to revise</div>
              {failedChecklistItems.length > 0 ? (
                <div className="su-revision-checklist">
                  {failedChecklistItems.map((item) => (
                    <div className="su-revision-checklist-item" key={item.id}>
                      <div className="su-revision-checklist-title">{item.checklistItem.itemText}</div>
                      <div className="su-revision-checklist-meta">
                        {item.checklistItem.section?.trim() || 'Library checklist requirement'}
                      </div>
                      {item.note?.trim() ? (
                        <div className="su-revision-checklist-note">{item.note.trim()}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="su-revision-empty-copy">
                  No failed checklist items are recorded for this revision request.
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <h3 className="h6 mb-2">Upload File and Metadata</h3>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Document file</label>
              <input
                className="form-control"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setError('');
                }}
                disabled={!uploadAllowed || submissionDeadlinePassed || uploading}
              />
              <div className="form-text">Only PDF files, max 25 MB.</div>
            </div>
            <div className="col-md-6">
              <label className="form-label">Title</label>
              <input
                className="form-control"
                value={meta.metadataTitle ?? ''}
                onChange={(event) => setMeta((prev) => ({ ...prev, metadataTitle: event.target.value }))}
                disabled={!uploadAllowed || submissionDeadlinePassed || uploading}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Author</label>
              <input
                className="form-control"
                value={meta.metadataAuthors ?? ''}
                onChange={(event) => setMeta((prev) => ({ ...prev, metadataAuthors: event.target.value }))}
                disabled={!uploadAllowed || submissionDeadlinePassed || uploading}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Year</label>
              <input
                className="form-control"
                type="number"
                min={1900}
                max={2100}
                value={meta.metadataYear ?? ''}
                onChange={(event) =>
                  setMeta((prev) => ({ ...prev, metadataYear: event.target.value ? Number(event.target.value) : undefined }))
                }
                disabled={!uploadAllowed || submissionDeadlinePassed || uploading}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Faculty</label>
              {useFacultySelect ? (
                <select
                  className="form-select"
                  value={meta.metadataFaculty ?? ''}
                  onChange={(event) => setMeta((prev) => ({ ...prev, metadataFaculty: event.target.value }))}
                  disabled={!uploadAllowed || submissionDeadlinePassed || uploading}
                >
                  <option value="">Select faculty</option>
                  {faculties.map((item) => (
                    <option key={item.id} value={item.name}>{item.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="form-control"
                  value={meta.metadataFaculty ?? ''}
                  onChange={(event) => setMeta((prev) => ({ ...prev, metadataFaculty: event.target.value }))}
                  disabled={!uploadAllowed || submissionDeadlinePassed || uploading}
                />
              )}
            </div>
            <div className="col-md-4">
              <label className="form-label">Study Program</label>
              <input
                className="form-control"
                value={meta.metadataStudyProgram ?? ''}
                onChange={(event) => setMeta((prev) => ({ ...prev, metadataStudyProgram: event.target.value }))}
                disabled={!uploadAllowed || submissionDeadlinePassed || uploading}
              />
            </div>
            <div className="col-12">
              <label className="form-label">Keywords</label>
              <KeywordChipInput
                values={keywordTokens}
                onChange={(nextTokens) => {
                  setKeywordTokens(nextTokens);
                  if (error === 'Please enter at least 3 keywords.' && nextTokens.length >= 3) {
                    setError('');
                  }
                }}
                disabled={!uploadAllowed || submissionDeadlinePassed || uploading}
                placeholder="Type one keyword and press Enter"
              />
              {keywordError ? (
                <div className="text-danger small mt-2">{keywordError}</div>
              ) : (
                <div className="form-text">Please enter at least 3 keywords.</div>
              )}
            </div>
            <div className="col-12">
              <label className="form-label">Abstract</label>
              <textarea
                className="form-control"
                rows={4}
                value={meta.abstractText ?? ''}
                onChange={(event) => setMeta((prev) => ({ ...prev, abstractText: event.target.value }))}
                disabled={!uploadAllowed || submissionDeadlinePassed || uploading}
              />
            </div>
            <div className="col-12">
              <button className="btn su-action-button su-action-button-primary" onClick={() => void onUpload()} disabled={!uploadAllowed || submissionDeadlinePassed || uploading}>
                {uploading
                  ? (hasPreviousUploads ? 'Uploading Revised File...' : 'Uploading First File...')
                  : (hasPreviousUploads ? 'Upload Revised File' : 'Upload First File')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-body">
          <h3 className="h6 mb-3">Submission Versions</h3>
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>File</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((version) => (
                  <tr key={version.id}>
                    <td>v{version.versionNumber}</td>
                    <td>
                      <DownloadFilenameLink
                        href={`/api/student/cases/${caseId}/submissions/${version.id}/download`}
                        filename={version.originalFilename || `Submission v${version.versionNumber}`}
                      />
                    </td>
                    <td>{version.status}</td>
                    <td>{version.createdAt ? new Date(version.createdAt).toLocaleString() : 'N/A'}</td>
                  </tr>
                ))}
                {versions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-muted">
                      No files have been uploaded for this publication yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ShellLayout>
  );
}

function buildCurrentRevisionComments(
  comments: WorkflowComment[],
  role: UserRole | null,
  latestSubmissionCreatedAt?: string
) {
  if (!role) {
    return [];
  }

  const sameRoleComments = comments.filter((comment) => comment.authorRole === role);
  if (sameRoleComments.length === 0) {
    return [];
  }

  const latestSubmissionAt = latestSubmissionCreatedAt ? Date.parse(latestSubmissionCreatedAt) || 0 : 0;
  if (latestSubmissionAt === 0) {
    return sameRoleComments;
  }

  const currentCycleComments = sameRoleComments.filter((comment) => {
    if (!comment.createdAt) {
      return true;
    }
    return (Date.parse(comment.createdAt) || 0) >= latestSubmissionAt;
  });

  return currentCycleComments.length > 0
    ? currentCycleComments
    : sameRoleComments.slice(-3);
}
