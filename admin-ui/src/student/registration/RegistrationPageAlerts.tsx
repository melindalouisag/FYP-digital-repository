interface RegistrationPageAlertsProps {
  isEditMode: boolean;
  loadingPage: boolean;
  thesisBlocked: boolean;
  registrationDeadlinePassed: boolean;
  registrationDeadlineLabel: string;
  preferredThesisCaseId?: number;
  currentStatus: string | null;
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
  onOpenPreferredCase,
}: RegistrationPageAlertsProps) {
  return (
    <>
      {loadingPage && <div className="alert alert-info">Loading registration...</div>}
      {!loadingPage && (
        <div className="small text-muted mb-4">
          {isEditMode
            ? 'Use this page to update the same registration. Save changes if you are still preparing details, then submit it again when it is ready.'
            : 'Use this form to prepare your registration. Save a draft if you are still working, then submit it after selecting a supervisor and accepting both permission statements.'}
        </div>
      )}
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
    </>
  );
}
