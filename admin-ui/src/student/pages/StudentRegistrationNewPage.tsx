import ShellLayout from '../../ShellLayout';
import { RegistrationForm } from '../registration/RegistrationForm';
import { RegistrationPageAlerts } from '../registration/RegistrationPageAlerts';
import { useRegistrationForm } from '../registration/useRegistrationForm';

export default function StudentRegistrationNewPage() {
  const form = useRegistrationForm();

  return (
    <ShellLayout
      title={form.isEditMode ? 'Update Registration' : 'Register Publication'}
    >
      <div className="su-card fade-in">
        <div className="card-body p-4">
          <RegistrationPageAlerts
            isEditMode={form.isEditMode}
            loadingPage={form.loadingPage}
            thesisBlocked={form.thesisBlocked}
            registrationDeadlinePassed={form.registrationDeadlinePassed}
            registrationDeadlineLabel={form.registrationDeadlineLabel}
            preferredThesisCaseId={form.preferredThesisCase?.id}
            currentStatus={form.currentStatus}
            onOpenPreferredCase={form.openPreferredThesisCase}
          />
          <RegistrationForm form={form} />
        </div>
      </div>
    </ShellLayout>
  );
}
