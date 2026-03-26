import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import ShellLayout from '../../layout/ShellLayout';
import { studentApi, type SubmissionMetaPayload } from '../../lib/api/student';
import { masterApi, type Faculty } from '../../lib/api/master';
import { ApiError } from '../../lib/api/http';
import DownloadFilenameLink from '../../lib/components/DownloadFilenameLink';
import KeywordChipInput from '../../lib/components/KeywordChipInput';
import { useAuth } from '../../lib/context/AuthContext';
import { joinKeywordTokens, splitKeywordString } from '../../lib/keywords';
import type { CaseDetailPayload, SubmissionVersion } from '../../lib/types/workflow';
import { canUploadSubmission, formatStatus, statusBadgeClass } from '../../lib/workflowUi';
import { getStudentCaseGuidance } from '../lib/casePresentation';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export default function StudentCaseSubmissionPage() {
  const { caseId } = useParams();
  const { user } = useAuth();
  const [detail, setDetail] = useState<CaseDetailPayload | null>(null);
  const [versions, setVersions] = useState<SubmissionVersion[]>([]);
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

  const load = async () => {
    if (!caseId) return;
    setLoading(true);
    setError('');
    try {
      const [caseDetail, submissionList] = await Promise.all([
        studentApi.caseDetail(Number(caseId)),
        studentApi.listSubmissions(Number(caseId)),
      ]);
      setDetail(caseDetail);
      setVersions(submissionList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submission data.');
      setDetail(null);
      setVersions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [caseId]);

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

  const onUpload = async () => {
    if (!caseId) return;
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
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

  return (
    <ShellLayout
      title={detail?.case.title?.trim() || 'Submission'}
      subtitle="Submission"
    >
      {loading && <div className="alert alert-info">Loading submission page...</div>}
      {error && <div className="alert alert-danger">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      {detail && (
        <div className="card shadow-sm mb-3">
          <div className="card-body d-flex flex-wrap justify-content-between align-items-start gap-3">
            <div>
              <div className="small text-uppercase text-muted mb-1">Current status</div>
              <span className={`badge status-badge ${statusBadgeClass(detail.case.status)}`}>{formatStatus(detail.case.status)}</span>
              <div className="text-muted small mt-2">
                {uploadAllowed
                  ? (hasPreviousUploads
                    ? 'Upload the revised PDF and confirm that the metadata below matches the latest version.'
                    : 'Upload the first approved PDF and complete the repository metadata below.')
                  : getStudentCaseGuidance(detail.case.status)}
              </div>
            </div>
            {!uploadAllowed && (
              <div className="text-muted small">Uploads open after registration verification or when a supervisor or library revision is requested.</div>
            )}
          </div>
        </div>
      )}

      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <h3 className="h6 mb-2">Upload File and Metadata</h3>
          <p className="text-muted small mb-3">
            The title, author, keywords, and abstract entered here are used for the repository record if this case is published.
          </p>
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
                disabled={!uploadAllowed || uploading}
              />
              <div className="form-text">Only PDF files, max 25 MB.</div>
            </div>
            <div className="col-md-6">
              <label className="form-label">Title</label>
              <input
                className="form-control"
                value={meta.metadataTitle ?? ''}
                onChange={(event) => setMeta((prev) => ({ ...prev, metadataTitle: event.target.value }))}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Author</label>
              <input
                className="form-control"
                value={meta.metadataAuthors ?? ''}
                onChange={(event) => setMeta((prev) => ({ ...prev, metadataAuthors: event.target.value }))}
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
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Faculty</label>
              {useFacultySelect ? (
                <select
                  className="form-select"
                  value={meta.metadataFaculty ?? ''}
                  onChange={(event) => setMeta((prev) => ({ ...prev, metadataFaculty: event.target.value }))}
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
                />
              )}
            </div>
            <div className="col-md-4">
              <label className="form-label">Study Program</label>
              <input
                className="form-control"
                value={meta.metadataStudyProgram ?? ''}
                onChange={(event) => setMeta((prev) => ({ ...prev, metadataStudyProgram: event.target.value }))}
              />
            </div>
            <div className="col-12">
              <label className="form-label">Keywords</label>
              <KeywordChipInput
                values={keywordTokens}
                onChange={setKeywordTokens}
                disabled={!uploadAllowed || uploading}
                placeholder="Type one keyword and press Enter"
              />
            </div>
            <div className="col-12">
              <label className="form-label">Abstract</label>
              <textarea
                className="form-control"
                rows={4}
                value={meta.abstractText ?? ''}
                onChange={(event) => setMeta((prev) => ({ ...prev, abstractText: event.target.value }))}
              />
            </div>
            <div className="col-12">
              <button className="btn btn-primary" onClick={() => void onUpload()} disabled={!uploadAllowed || uploading}>
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
                      No files have been uploaded for this case yet.
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
