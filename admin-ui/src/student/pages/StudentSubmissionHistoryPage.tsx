import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ShellLayout from '../../ShellLayout';
import { studentApi } from '../../lib/api/student';
import DownloadFilenameLink from '../../lib/components/DownloadFilenameLink';
import type { CaseDetailPayload, SubmissionVersion } from '../../lib/workflowTypes';

export default function StudentSubmissionHistoryPage() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<CaseDetailPayload | null>(null);
  const [versions, setVersions] = useState<SubmissionVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!caseId) return;
      setLoading(true);
      setError('');
      try {
        const [caseDetail, submissionVersions] = await Promise.all([
          studentApi.caseDetail(Number(caseId)),
          studentApi.listSubmissions(Number(caseId)),
        ]);
        setDetail(caseDetail);
        setVersions(submissionVersions);
      } catch (err) {
        setDetail(null);
        setVersions([]);
        setError(err instanceof Error ? err.message : 'Failed to load submission history.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [caseId]);

  const title = detail?.case.title?.trim() ? detail.case.title : 'Submission History';

  return (
    <ShellLayout title={title} subtitle="Submission History">
      <button
        className="btn btn-outline-secondary btn-sm mb-4"
        style={{ borderRadius: '999px' }}
        onClick={() => navigate(caseId ? `/student/cases/${caseId}` : '/student/submissions')}
      >
        Return to Case Detail
      </button>

      {loading && (
        <div className="text-center py-5">
          <div className="su-spinner mx-auto mb-3" />
          <div className="text-muted">Loading submission history...</div>
        </div>
      )}
      {error && <div className="alert alert-danger">{error}</div>}

      {!loading && !error && versions.length === 0 && (
        <div className="su-card">
          <div className="card-body p-4">
            <h3 className="h6 su-page-title mb-2">Submission History</h3>
            <p className="text-muted small mb-0">No submission versions have been uploaded for this case.</p>
          </div>
        </div>
      )}

      {!loading && versions.length > 0 && (
        <div className="table-responsive su-card">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th>Version</th>
                <th>File</th>
                <th>Uploaded</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.id}>
                  <td className="fw-semibold">v{version.versionNumber}</td>
                  <td>
                    <DownloadFilenameLink
                      href={`/api/student/cases/${caseId}/submissions/${version.id}/download`}
                      filename={version.originalFilename || `Submission v${version.versionNumber}`}
                    />
                  </td>
                  <td className="text-muted small">
                    {version.createdAt ? new Date(version.createdAt).toLocaleString() : 'N/A'}
                  </td>
                  <td>{version.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ShellLayout>
  );
}
