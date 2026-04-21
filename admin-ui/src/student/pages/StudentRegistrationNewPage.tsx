import ShellLayout from '../../ShellLayout';
import { RegistrationForm } from '../registration/RegistrationForm';
import { useRegistrationForm } from '../registration/useRegistrationForm';

export default function StudentRegistrationNewPage() {
  const form = useRegistrationForm();

  return (
    <ShellLayout
      title={form.isEditMode ? 'Update Registration' : 'Register Publication'}
    >
      <div className="su-card fade-in">
        <div className="card-body p-4">
          {form.loadingPage && <div className="alert alert-info">Loading registration...</div>}
          {form.registrationDeadlinePassed && (
            <div className="alert alert-danger">
              The registration deadline has passed.
              {form.registrationDeadlineLabel ? ` ${form.registrationDeadlineLabel}.` : null}
            </div>
          )}
          {form.thesisBlocked && (
            <div className="alert alert-warning">
              You already have a THESIS registration in progress.
              {form.preferredThesisCase?.id != null && (
                <>
                  {' '}Use the existing registration instead.
                  <button type="button" className="btn btn-link btn-sm p-0 ms-1 align-baseline" onClick={form.openPreferredThesisCase}>
                    Open THESIS registration
                  </button>
                </>
              )}
            </div>
          )}
          {form.isEditMode && form.currentStatus === 'REGISTRATION_PENDING' && (
            <div className="alert alert-info">
              Editing this pending registration will move it back to draft. Save your changes, then resubmit it for lecturer approval.
            </div>
          )}
          {form.isEditMode && form.currentStatus === 'REJECTED' && (
            <div className="alert alert-danger">
              This registration was rejected. Update it here, then resubmit it when your revisions are ready.
            </div>
          )}
          {form.isEditMode && form.currentStatus === 'REJECTED' && form.registrationFeedback.length > 0 && (
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
                {form.registrationFeedback.map((entry) => (
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
          <RegistrationForm form={form} />
        </div>
      </div>
    </ShellLayout>
  );
}
