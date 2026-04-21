import { getPublicationTypeLabel } from '../../calendar/calendarUtils';
import { ACTIVE_PUBLICATION_TYPES } from '@/utils/uiLabels';
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
      className="su-registration-form"
      onSubmit={(event) => {
        event.preventDefault();
        void form.submitDraft();
      }}
    >
      <section className="su-form-section">
        <h2 className="su-subsection-title mb-3">Publication Information</h2>
        <div className="su-form-grid">
          <div className="su-form-field-full">
            <label className="form-label" htmlFor="registration-title">Title</label>
            <input
              id="registration-title"
              className={`form-control${form.errors.title ? ' is-invalid' : ''}`}
              value={form.title}
              onChange={(event) => form.setTitle(event.target.value)}
            />
            {form.errors.title ? <div className="text-danger small mt-1">{form.errors.title}</div> : null}
          </div>

          <div>
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
            <div className="su-secondary-text mt-1">
              {form.isEditMode
                ? 'Publication type cannot be changed for an existing registration.'
                : 'Select the publication type for this registration.'}
            </div>
            {form.errors.publicationType ? <div className="text-danger small mt-1">{form.errors.publicationType}</div> : null}
          </div>

          <div>
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
            {form.errors.year ? <div className="text-danger small mt-1">{form.errors.year}</div> : null}
          </div>

          <div>
            <label className="form-label" htmlFor="registration-faculty">Faculty</label>
            {form.useFacultySelect ? (
              <select
                id="registration-faculty"
                className={`form-select${form.errors.faculty ? ' is-invalid' : ''}`}
                value={form.faculty}
                onChange={(event) => form.setFaculty(event.target.value)}
              >
                <option value="">Select faculty</option>
                {form.faculties.map((item) => (
                  <option key={item.id} value={item.name}>{item.name}</option>
                ))}
              </select>
            ) : (
              <input
                id="registration-faculty"
                className={`form-control${form.errors.faculty ? ' is-invalid' : ''}`}
                value={form.faculty}
                onChange={(event) => form.setFaculty(event.target.value)}
              />
            )}
            {form.errors.faculty ? <div className="text-danger small mt-1">{form.errors.faculty}</div> : null}
          </div>

          <div className="su-form-field-full">
            <label className="form-label">Journal or Conference (for Articles)</label>
            <input
              className="form-control"
              value={form.articlePublishIn}
              onChange={(event) => form.setArticlePublishIn(event.target.value)}
              placeholder="Journal or conference name"
            />
            <div className="su-secondary-text mt-1">Leave this blank for thesis registrations.</div>
          </div>
        </div>
      </section>

      <section className="su-form-section">
        <h2 className="su-subsection-title mb-3">Author Information</h2>
        <div className="su-form-grid">
          <div>
            <label className="form-label" htmlFor="registration-authorName">Author</label>
            <input
              id="registration-authorName"
              className={`form-control${form.errors.authorName ? ' is-invalid' : ''}`}
              value={form.authorName}
              onChange={(event) => form.setAuthorName(event.target.value)}
            />
            {form.errors.authorName ? <div className="text-danger small mt-1">{form.errors.authorName}</div> : null}
          </div>

          <div>
            <label className="form-label" htmlFor="registration-studentId">Student ID Number</label>
            <input
              id="registration-studentId"
              className={`form-control${form.errors.studentId ? ' is-invalid' : ''}`}
              value={form.studentIdNumber}
              onChange={(event) => form.setStudentIdNumber(event.target.value)}
            />
            {form.errors.studentId ? <div className="text-danger small mt-1">{form.errors.studentId}</div> : null}
          </div>
        </div>
      </section>

      <section className="su-form-section" id="registration-supervisors">
        <h2 className="su-subsection-title mb-3">Supervisor Information</h2>
        <div className="su-form-grid">
          <div className="su-form-field-full">
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
            {!form.loadingSupervisors && form.supervisors.length === 0 ? (
              <div className="su-secondary-text mt-1">
                {form.hasStudyProgram
                  ? 'No supervisors are available right now.'
                  : 'Complete onboarding to load supervisors.'}
              </div>
            ) : null}
            <div className="su-secondary-text mt-1">Choose the lecturer who should review this registration.</div>
            {form.errors.supervisorIds ? <div className="text-danger small mt-1">{form.errors.supervisorIds}</div> : null}
          </div>
        </div>
      </section>

      <section className="su-form-section" id="registration-agreements">
        <h2 className="su-subsection-title mb-3">Submission Declaration</h2>
        <div className="su-secondary-text mb-3">
          Both permission statements are required before you submit this registration for review.
        </div>
        <div className="form-check mb-3">
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
        {form.errors.agreement1 ? <div className="text-danger small mt-1">{form.errors.agreement1}</div> : null}
        {form.errors.agreement2 ? <div className="text-danger small mt-1">{form.errors.agreement2}</div> : null}
      </section>

      {form.serverError ? (
        <div className="alert alert-danger mb-0">{form.serverError}</div>
      ) : null}

      <div className="su-form-actions">
        <button
          className="btn btn-outline-secondary"
          type="submit"
          disabled={form.saving || form.loadingSupervisors || form.loadingPage || form.registrationDeadlinePassed}
        >
          {form.saving ? 'Saving...' : (form.isEditMode ? 'Save Changes' : 'Save Draft')}
        </button>
        <button
          className="btn btn-primary"
          type="button"
          disabled={form.saving || form.loadingSupervisors || form.loadingPage || form.registrationDeadlinePassed}
          onClick={() => void form.submitForApproval()}
        >
          {form.saving
            ? 'Submitting...'
            : (form.isEditMode && form.currentStatus && form.currentStatus !== 'REGISTRATION_DRAFT'
              ? 'Save and Submit for Review'
              : 'Submit for Review')}
        </button>
      </div>
    </form>
  );
}
