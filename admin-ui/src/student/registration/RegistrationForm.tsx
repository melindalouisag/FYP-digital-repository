import { getPublicationTypeLabel } from '../../calendar/calendarUtils';
import { ACTIVE_PUBLICATION_TYPES } from '../../lib/uiLabels';
import { supervisorLabel, type UseRegistrationFormResult } from './useRegistrationForm';

interface RegistrationFormProps {
  form: UseRegistrationFormResult;
}

export function RegistrationForm({ form }: RegistrationFormProps) {
  const publicationTypeOptions = form.isEditMode && !ACTIVE_PUBLICATION_TYPES.includes(form.type)
    ? [form.type, ...ACTIVE_PUBLICATION_TYPES]
    : ACTIVE_PUBLICATION_TYPES;

  return (
    <form
      className="row g-3"
      onSubmit={(event) => {
        event.preventDefault();
        void form.submitDraft();
      }}
    >
      <div className="col-12">
        <label className="form-label" htmlFor="registration-title">Title</label>
        <input id="registration-title" className={`form-control${form.errors.title ? ' is-invalid' : ''}`} value={form.title} onChange={(event) => form.setTitle(event.target.value)} />
        {form.errors.title && <div className="text-danger small mt-1">{form.errors.title}</div>}
      </div>

      <div className="col-md-4">
        <label className="form-label" htmlFor="registration-publicationType">Publication Type</label>
        <select
          id="registration-publicationType"
          className={`form-select${form.errors.publicationType ? ' is-invalid' : ''}`}
          value={form.type}
          onChange={(event) => form.setType(event.target.value as typeof form.type)}
          disabled={form.isEditMode}
        >
          {publicationTypeOptions.map((publicationType) => (
            <option key={publicationType} value={publicationType}>
              {getPublicationTypeLabel(publicationType)}
            </option>
          ))}
        </select>
        <div className="form-text">
          {form.isEditMode
            ? 'Publication type cannot be changed for an existing registration.'
            : 'Select the publication type for this registration.'}
        </div>
        {form.errors.publicationType && <div className="text-danger small mt-1">{form.errors.publicationType}</div>}
      </div>

      <div className="col-md-4">
        <label className="form-label" htmlFor="registration-year">Year</label>
        <input
          id="registration-year"
          className={`form-control${form.errors.year ? ' is-invalid' : ''}`}
          type="number"
          min={1900}
          max={2100}
          value={form.year ?? ''}
          onChange={(event) => form.setYear(event.target.value ? Number(event.target.value) : undefined)}
        />
        {form.errors.year && <div className="text-danger small mt-1">{form.errors.year}</div>}
      </div>

      <div className="col-md-4">
        <label className="form-label" htmlFor="registration-faculty">Faculty</label>
        {form.useFacultySelect ? (
          <select id="registration-faculty" className={`form-select${form.errors.faculty ? ' is-invalid' : ''}`} value={form.faculty} onChange={(event) => form.setFaculty(event.target.value)}>
            <option value="">Select faculty</option>
            {form.faculties.map((item) => (
              <option key={item.id} value={item.name}>{item.name}</option>
            ))}
          </select>
        ) : (
          <input id="registration-faculty" className={`form-control${form.errors.faculty ? ' is-invalid' : ''}`} value={form.faculty} onChange={(event) => form.setFaculty(event.target.value)} />
        )}
        {form.errors.faculty && <div className="text-danger small mt-1">{form.errors.faculty}</div>}
      </div>

      <div className="col-md-6">
        <label className="form-label" htmlFor="registration-authorName">Author</label>
        <input id="registration-authorName" className={`form-control${form.errors.authorName ? ' is-invalid' : ''}`} value={form.authorName} onChange={(event) => form.setAuthorName(event.target.value)} />
        {form.errors.authorName && <div className="text-danger small mt-1">{form.errors.authorName}</div>}
      </div>

      <div className="col-md-6">
        <label className="form-label" htmlFor="registration-studentId">Student ID Number</label>
        <input id="registration-studentId" className={`form-control${form.errors.studentId ? ' is-invalid' : ''}`} value={form.studentIdNumber} onChange={(event) => form.setStudentIdNumber(event.target.value)} />
        {form.errors.studentId && <div className="text-danger small mt-1">{form.errors.studentId}</div>}
      </div>

      <div className="col-12">
        <label className="form-label">Journal or Conference (for Articles)</label>
        <input className="form-control" value={form.articlePublishIn} onChange={(event) => form.setArticlePublishIn(event.target.value)} placeholder="Journal or conference name" />
        <div className="form-text">Leave this blank for thesis registrations.</div>
      </div>

      <div className="col-12" id="registration-supervisors">
        <label className="form-label">Supervisor</label>
        <select
          className={`form-select${form.errors.supervisorIds ? ' is-invalid' : ''}`}
          value={form.selectedSupervisorEmail}
          onChange={(event) => form.setSelectedSupervisorEmail(event.target.value)}
          disabled={form.loadingSupervisors || !form.hasStudyProgram}
        >
          <option value="">
            {form.loadingSupervisors
              ? 'Loading supervisors...'
              : form.hasStudyProgram
                ? 'Select supervisor'
                : 'Complete onboarding to continue'}
          </option>
          {form.supervisors.map((supervisor) => (
            <option key={supervisor.id} value={supervisor.email}>
              {supervisorLabel(supervisor)}
            </option>
          ))}
        </select>
        {!form.loadingSupervisors && form.supervisors.length === 0 && (
          <div className="text-muted small mt-1">
            {form.hasStudyProgram
              ? 'No supervisors available right now.'
              : 'Complete onboarding to load supervisors.'}
          </div>
        )}
        <div className="form-text">Choose the lecturer who should review this registration.</div>
        {form.errors.supervisorIds && <div className="text-danger small mt-1">{form.errors.supervisorIds}</div>}
      </div>

      <div className="col-12" id="registration-agreements">
        <div className="small text-muted mb-2">
          Both permission statements are required when you submit the registration for approval.
        </div>
        <div className="form-check mb-2">
          <input
            className={`form-check-input${form.errors.agreement1 ? ' is-invalid' : ''}`}
            id="permissionChecklistOneAccepted"
            type="checkbox"
            checked={form.permissionChecklistOneAccepted}
            onChange={(event) => form.setPermissionChecklistOneAccepted(event.target.checked)}
          />
          <label className="form-check-label" htmlFor="permissionChecklistOneAccepted">
            I hereby grant to Sampoerna University (SU) the nonexclusive right to create a digital version of the above-named publication and to make my publication available as part of library electronic local content collections. I understand that the full text of my publication will be available to the SU Library members, in digital form without restriction as part of the collection, and I give my permission for the SU Library to reproduce, distribute, display, and transmit my publication in order to make it available online to support education and research activities.
          </label>
        </div>
        <div className="form-check">
          <input
            className={`form-check-input${form.errors.agreement2 ? ' is-invalid' : ''}`}
            id="permissionChecklistTwoAccepted"
            type="checkbox"
            checked={form.permissionChecklistTwoAccepted}
            onChange={(event) => form.setPermissionChecklistTwoAccepted(event.target.checked)}
          />
          <label className="form-check-label" htmlFor="permissionChecklistTwoAccepted">
            I understand that this permission constitutes a non-exclusive, perpetual, royalty-free license, and that I retain all other rights to the copyright in my publication, including the right to use it in other works such as articles and books.
          </label>
        </div>
        {form.errors.agreement1 && <div className="text-danger small mt-1">{form.errors.agreement1}</div>}
        {form.errors.agreement2 && <div className="text-danger small mt-1">{form.errors.agreement2}</div>}
      </div>

      {form.serverError && (
        <div className="col-12">
          <div className="alert alert-danger mb-0" style={{ borderRadius: '0.75rem' }}>{form.serverError}</div>
        </div>
      )}

      <div className="col-12 d-flex flex-wrap gap-2">
        <button className="btn btn-outline-primary" type="submit" disabled={form.saving || form.loadingSupervisors || form.loadingPage || form.registrationDeadlinePassed} style={{ borderRadius: '999px', padding: '0.5rem 1.5rem' }}>
          {form.saving ? 'Saving...' : (form.isEditMode ? 'Save Changes' : 'Save Draft')}
        </button>
        <button
          className="btn btn-primary"
          type="button"
          disabled={form.saving || form.loadingSupervisors || form.loadingPage || form.registrationDeadlinePassed}
          onClick={() => void form.submitForApproval()}
          style={{ borderRadius: '999px', padding: '0.5rem 1.5rem' }}
        >
          {form.saving
            ? 'Submitting...'
            : (form.isEditMode && form.currentStatus && form.currentStatus !== 'REGISTRATION_DRAFT'
              ? 'Save and Resubmit for Approval'
              : 'Save and Submit for Approval')}
        </button>
      </div>
    </form>
  );
}
