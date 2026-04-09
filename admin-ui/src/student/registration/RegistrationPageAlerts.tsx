import type { RegistrationFeedbackEntry } from './useRegistrationForm';

interface RegistrationPageAlertsProps {
  isEditMode: boolean;
  loadingPage: boolean;
  thesisBlocked: boolean;
  registrationDeadlinePassed: boolean;
  registrationDeadlineLabel: string;
  preferredThesisCaseId?: number;
  currentStatus: string | null;
  registrationFeedback: RegistrationFeedbackEntry[];
  onOpenPreferredCase: () => void;
}

export function RegistrationPageAlerts({
  isEditMode,
  loadingPage,
  thesisBlocked,
  registrationDeadlinePassed,
  registrationDeadlineLabel,
  preferredThesisCaseId,
  currentStatus,
  registrationFeedback,
  onOpenPreferredCase,
}: RegistrationPageAlertsProps) {
  return (
    <>
      {loadingPage && <div className="alert alert-info">Loading registration...</div>}
      {registrationDeadlinePassed && (
        <div className="alert alert-danger">
          The registration deadline has passed.
          {registrationDeadlineLabel ? ` ${registrationDeadlineLabel}.` : null}
        </div>
      )}
      {thesisBlocked && (
        <div className="alert alert-warning">
          You already have a THESIS registration in progress.
          {preferredThesisCaseId != null && (
            <>
              {' '}Use the existing registration instead.
              <button type="button" className="btn btn-link btn-sm p-0 ms-1 align-baseline" onClick={onOpenPreferredCase}>
                Open THESIS registration
              </button>
            </>
          )}
        </div>
      )}
      {isEditMode && currentStatus === 'REGISTRATION_PENDING' && (
        <div className="alert alert-info">
          Editing this pending registration will move it back to draft. Save your changes, then resubmit it for lecturer approval.
        </div>
      )}
      {isEditMode && currentStatus === 'REJECTED' && (
        <div className="alert alert-danger">
          This registration was rejected. Update it here, then resubmit it when your revisions are ready.
        </div>
      )}
      {isEditMode && currentStatus === 'REJECTED' && registrationFeedback.length > 0 && (
        <div className="su-revision-panel mb-4">
          <div className="su-revision-panel-header">
            <div>
              <div className="su-revision-panel-kicker">Action Required</div>
              <h3 className="su-revision-panel-title mb-1">Comments from reviewer</h3>
              <div className="su-revision-panel-copy">
                Review this feedback before updating the registration form below.
              </div>
            </div>
          </div>
          <div className="su-revision-comment-list">
            {registrationFeedback.map((entry) => (
              <div className="su-revision-comment-item" key={entry.key}>
                <div className="su-revision-comment-meta">
                  {entry.sourceLabel}
                  {entry.createdAt ? ` • ${new Date(entry.createdAt).toLocaleString()}` : ''}
                </div>
                <div className="su-revision-comment-body">{entry.body}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
