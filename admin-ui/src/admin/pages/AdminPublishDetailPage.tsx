import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { adminApi } from '@/services/api/admin';
import DownloadFilenameLink from '@/shared/ui/DownloadFilenameLink';
import { useConfirmDialog } from '@/shared/ui/useConfirmDialog';
import type { AdminPublishDetail } from '@/types/workflow';
import { normalizeFacultyCode } from '@/utils/facultyLabel';
import ShellLayout from '../../ShellLayout';

type StudentProfileReturnState = {
  returnToStudentProfile?: {
    studentName?: string | null;
    facultyCode?: string | null;
    studentUserId?: number | string | null;
  };
};

export default function AdminPublishDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { caseId } = useParams();
  const [detail, setDetail] = useState<AdminPublishDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [workingAction, setWorkingAction] = useState<'publish' | 'unpublish' | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const { openConfirm, confirmDialog } = useConfirmDialog();

  const working = workingAction !== null;
  const isPublished = detail?.status === 'PUBLISHED';
  const isReadyToPublish = detail?.status === 'READY_TO_PUBLISH';
  const canUnpublish = isPublished && !working;
  const latestSubmissionDownloadHref = detail ? `/api/admin/cases/${detail.caseId}/file/latest` : '';
  const displayCaseTitle = (value?: string | null) => value?.trim() || 'Untitled submission';
  const profileReturnState = (location.state as StudentProfileReturnState | null)?.returnToStudentProfile;
  const profileReturnFacultyCode = normalizeFacultyCode(profileReturnState?.facultyCode);
  const profileReturnStudentUserId = profileReturnState?.studentUserId;
  const profileReturnPath = profileReturnFacultyCode && profileReturnStudentUserId != null
    ? `/admin/students/${profileReturnFacultyCode}/${profileReturnStudentUserId}`
    : null;
  const profileReturnName = profileReturnState?.studentName?.trim();
  const returnButtonLabel = profileReturnPath && profileReturnName
    ? `Return to ${profileReturnName} Profile`
    : 'Return to Publishing';
  const returnButtonTarget = profileReturnPath ?? '/admin/publish';

  const load = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError('');
    try {
      const payload = await adminApi.publishDetail(Number(caseId));
      setDetail(payload);
    } catch (err) {
      setDetail(null);
      setError(err instanceof Error ? err.message : 'Failed to load publish detail.');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const publish = async () => {
    if (!caseId) return false;
    setWorkingAction('publish');
    setError('');
    setMessage('');
    try {
      await adminApi.publish(Number(caseId));
      setMessage('Publication published to repository.');
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish action failed.');
      return false;
    } finally {
      setWorkingAction(null);
    }
  };

  const openPublishConfirm = () => {
    openConfirm({
      title: 'Confirm Publish',
      message: (
        <div className="vstack gap-2">
          <div>
            This will publish <strong>{displayCaseTitle(detail?.title)}</strong> to the repository.
          </div>
          <div>Please confirm that the metadata and uploaded file are ready for release.</div>
        </div>
      ),
      confirmLabel: 'Confirm Publish',
      onConfirm: async (close) => {
        const success = await publish();
        if (success) {
          close();
        }
      },
    });
  };

  const unpublish = async () => {
    if (!caseId) return;
    openConfirm({
      title: 'Unpublish Publication?',
      message: 'This will permanently delete the publication record from the system and remove it from the repository. The student will need to start again from registration. Continue?',
      confirmLabel: 'Unpublish',
      confirmVariant: 'danger',
      onConfirm: async (close) => {
        setWorkingAction('unpublish');
        setError('');
        setMessage('');
        try {
          await adminApi.unpublish(Number(caseId));
          close();
          navigate('/admin/publish');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Unpublish action failed.');
        } finally {
          setWorkingAction(null);
        }
      },
    });
  };

  return (
    <ShellLayout title="Publishing Detail">
      <button className="btn btn-outline-secondary btn-sm mb-4" style={{ borderRadius: '999px' }} onClick={() => navigate(returnButtonTarget)}>
        {returnButtonLabel}
      </button>

      {error && <div className="alert alert-danger" style={{ borderRadius: '0.75rem' }}>{error}</div>}
      {message && <div className="alert alert-success" style={{ borderRadius: '0.75rem' }}>{message}</div>}

      {loading && (
        <div className="text-center py-5">
          <div className="su-spinner mx-auto mb-3" />
          <div className="text-muted">Loading publish detail...</div>
        </div>
      )}

      {!loading && detail && (
        <div className="row g-3 fade-in">
          {/* Case Summary */}
          <div className="col-lg-6">
            <div className="su-card h-100">
              <div className="card-body p-4">
                <h3 className="h6 mb-3 su-page-title">Publication Summary</h3>
                {[
                  { label: 'Title', value: displayCaseTitle(detail.title) },
                  { label: 'Type', value: detail.type },
                  { label: 'Status', value: detail.status },
                  { label: 'Updated', value: detail.updatedAt ? new Date(detail.updatedAt).toLocaleString() : 'N/A' },
                ].map((row) => (
                  <div key={row.label} className="d-flex py-2" style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <div className="text-muted small" style={{ width: 100 }}>{row.label}</div>
                    <div className="fw-semibold">{row.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Latest Submission */}
          <div className="col-lg-6">
            <div className="su-card h-100">
              <div className="card-body p-4">
                <h3 className="h6 mb-3 su-page-title">Latest Submission</h3>
                {detail.latestSubmission ? (
                  <>
                    <div className="d-flex py-2" style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <div className="text-muted small" style={{ width: 100 }}>File</div>
                      <div className="fw-semibold">
                        <DownloadFilenameLink
                          href={latestSubmissionDownloadHref}
                          filename={detail.latestSubmission.originalFilename || 'Latest submission'}
                        />
                      </div>
                    </div>
                    {[
                      { label: 'Uploaded', value: detail.latestSubmission.createdAt ? new Date(detail.latestSubmission.createdAt).toLocaleString() : 'N/A' },
                      { label: 'Size', value: detail.latestSubmission.fileSize ? `${(detail.latestSubmission.fileSize / 1024).toFixed(1)} KB` : 'N/A' },
                    ].map((row) => (
                      <div key={row.label} className="d-flex py-2" style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <div className="text-muted small" style={{ width: 100 }}>{row.label}</div>
                        <div className="fw-semibold">{row.value}</div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="text-muted">No submission file is available for this publication.</div>
                )}
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="col-12">
            <div className="su-card">
              <div className="card-body p-4">
                <h3 className="h6 mb-3 su-page-title">Repository Metadata</h3>
                <div className="row g-3">
                  {[
                    { label: 'Title', value: detail.metadata?.title, col: 6 },
                    { label: 'Authors', value: detail.metadata?.authors, col: 6 },
                    { label: 'Faculty', value: detail.metadata?.faculty, col: 6 },
                    { label: 'Year', value: detail.metadata?.year, col: 6 },
                    { label: 'Keywords', value: detail.metadata?.keywords, col: 12 },
                  ].map((field) => (
                    <div className={`col-md-${field.col}`} key={field.label}>
                      <div className="p-2 px-3" style={{ background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e8eff5' }}>
                        <div className="text-muted small">{field.label}</div>
                        <div className="fw-semibold">{field.value || 'N/A'}</div>
                      </div>
                    </div>
                  ))}
                  <div className="col-12">
                    <div className="p-3" style={{ background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e8eff5' }}>
                      <div className="text-muted small mb-1">Abstract</div>
                      <div style={{ lineHeight: 1.6 }}>{detail.metadata?.abstractText || 'N/A'}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  {isReadyToPublish && (
                    <button
                      className="btn su-action-button su-action-button-primary"
                      style={{ paddingInline: '2rem' }}
                      disabled={working}
                      onClick={openPublishConfirm}
                    >
                      {workingAction === 'publish' ? 'Publishing...' : 'Publish to Repository'}
                    </button>
                  )}

                  {isPublished && (
                    <button
                      className="btn btn-outline-danger"
                      style={{ borderRadius: '999px' }}
                      disabled={!canUnpublish}
                      onClick={() => void unpublish()}
                    >
                      {workingAction === 'unpublish' ? 'Unpublishing...' : 'Unpublish'}
                    </button>
                  )}

                  {!isReadyToPublish && !isPublished && (
                    <div className="text-muted p-3" style={{ background: '#f8fafc', borderRadius: '0.5rem' }}>
                      This publication is not currently ready for publication.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
    </ShellLayout>
  );
}
