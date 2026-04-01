import ShellLayout from '../../ShellLayout';
import { RegistrationForm } from '../registration/RegistrationForm';
import { RegistrationPageAlerts } from '../registration/RegistrationPageAlerts';
import { useRegistrationForm } from '../registration/useRegistrationForm';

export default function StudentRegistrationNewPage() {
  const form = useRegistrationForm();

  return (
    <ShellLayout
      title={form.isEditMode ? 'Edit Publication Registration' : 'New Publication Registration'}
      subtitle={form.isEditMode ? 'Update the same case, then resubmit it when your revisions are complete' : 'Prepare the registration details now, then submit the same case when everything is complete'}
    >
      <div className="su-card fade-in">
        <div className="card-body p-4">
          <RegistrationPageAlerts
            isEditMode={form.isEditMode}
            loadingPage={form.loadingPage}
            thesisBlocked={form.thesisBlocked}
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
