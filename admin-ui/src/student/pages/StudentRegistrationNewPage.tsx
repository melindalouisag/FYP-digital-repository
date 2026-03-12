import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ShellLayout from '../../layout/ShellLayout';
import { studentApi, type SupervisorRow } from '../../lib/api/student';
import { masterApi, type Faculty } from '../../lib/api/master';
import type { CaseSummary, PublicationType } from '../../lib/types/workflow';
import { useAuth } from '../../lib/context/AuthContext';

type FormErrors = {
  title?: string;
  publicationType?: string;
  year?: string;
  faculty?: string;
  authorName?: string;
  studentId?: string;
  supervisorIds?: string;
  agreement1?: string;
  agreement2?: string;
};

function supervisorLabel(supervisor: SupervisorRow): string {
  const displayName = supervisor.name && supervisor.name.trim().length > 0
    ? supervisor.name.trim()
    : supervisor.email;
  return `${displayName} (${supervisor.email})`;
}

export default function StudentRegistrationNewPage() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const editCaseId = caseId ? Number(caseId) : null;
  const isEditMode = editCaseId !== null && !Number.isNaN(editCaseId);
  const hasStudyProgram = Boolean(user?.program?.trim());

  const [title, setTitle] = useState('');
  const [year, setYear] = useState<number | undefined>(new Date().getFullYear());
  const [type, setType] = useState<PublicationType>('THESIS');
  const [faculty, setFaculty] = useState(user?.faculty ?? '');
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [facultyLoadError, setFacultyLoadError] = useState(false);
  const [articlePublishIn, setArticlePublishIn] = useState('');
  const [authorName, setAuthorName] = useState(user?.fullName ?? '');
  const [studentIdNumber, setStudentIdNumber] = useState(user?.studentId ?? '');
  const [supervisors, setSupervisors] = useState<SupervisorRow[]>([]);
  const [existingCases, setExistingCases] = useState<CaseSummary[]>([]);
  const [selectedSupervisorEmail, setSelectedSupervisorEmail] = useState('');
  const [permissionChecklistOneAccepted, setPermissionChecklistOneAccepted] = useState(false);
  const [permissionChecklistTwoAccepted, setPermissionChecklistTwoAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingPage, setLoadingPage] = useState(Boolean(isEditMode));
  const [loadingSupervisors, setLoadingSupervisors] = useState(true);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState('');

  const externalThesisCases = useMemo(
    () => existingCases.filter((item) => item.type === 'THESIS' && item.id !== editCaseId),
    [editCaseId, existingCases]
  );
  const thesisBlocked = !isEditMode && type === 'THESIS' && externalThesisCases.length > 0;
  const preferredThesisCase = useMemo(() => {
    const priority = (status: string) => {
      switch (status) {
        case 'REGISTRATION_VERIFIED':
          return 0;
        case 'REGISTRATION_APPROVED':
          return 1;
        case 'REGISTRATION_PENDING':
          return 2;
        case 'REGISTRATION_DRAFT':
          return 3;
        case 'REJECTED':
          return 4;
        default:
          return 5;
      }
    };

    return externalThesisCases
      .slice()
      .sort((left, right) => {
        const byStatus = priority(left.status) - priority(right.status);
        if (byStatus !== 0) return byStatus;
        return (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '');
      })[0] ?? null;
  }, [externalThesisCases]);

  const clearFieldError = (field: keyof FormErrors) => {
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const scrollToFirstError = (nextErrors: FormErrors) => {
    const fieldOrder: Array<keyof FormErrors> = [
      'title',
      'publicationType',
      'year',
      'faculty',
      'authorName',
      'studentId',
      'supervisorIds',
      'agreement1',
      'agreement2',
    ];
    const firstField = fieldOrder.find((field) => nextErrors[field]);
    if (!firstField) {
      return;
    }

    const elementId =
      firstField === 'agreement1' || firstField === 'agreement2'
        ? 'registration-agreements'
        : firstField === 'supervisorIds'
          ? 'registration-supervisors'
          : `registration-${firstField}`;
    const target = document.getElementById(elementId);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
      target.focus();
    }
  };

  const validateForDraft = (): FormErrors => {
    const nextErrors: FormErrors = {};
    if (!title.trim()) nextErrors.title = 'Title is required to save draft.';
    if (thesisBlocked) nextErrors.publicationType = 'You already have a THESIS registration case.';
    if (!selectedSupervisorEmail.trim()) nextErrors.supervisorIds = 'Please select a supervisor.';
    return nextErrors;
  };

  const validateForSubmit = (): FormErrors => {
    const nextErrors: FormErrors = {};
    if (!title.trim()) nextErrors.title = 'Title is required.';
    if (thesisBlocked) nextErrors.publicationType = 'You already have a THESIS registration case.';
    if (!type) nextErrors.publicationType = 'Publication type is required.';
    if (year === undefined || Number.isNaN(year) || !/^\d{4}$/.test(String(year))) {
      nextErrors.year = 'Year is required and must be 4 digits.';
    }
    if (!faculty.trim()) nextErrors.faculty = 'Faculty is required.';
    if (!authorName.trim()) nextErrors.authorName = 'Author name is required.';
    if (!studentIdNumber.trim()) nextErrors.studentId = 'Student ID number is required.';
    if (!selectedSupervisorEmail.trim()) nextErrors.supervisorIds = 'Please select a supervisor.';
    if (!permissionChecklistOneAccepted) nextErrors.agreement1 = 'Please accept agreement checklist 1.';
    if (!permissionChecklistTwoAccepted) nextErrors.agreement2 = 'Please accept agreement checklist 2.';
    return nextErrors;
  };

  useEffect(() => {
    const loadExistingCases = async () => {
      try {
        const rows = await studentApi.listCases();
        setExistingCases(rows);
      } catch (err) {
        setServerError(err instanceof Error ? err.message : 'Failed to load existing registrations.');
      }
    };
    void loadExistingCases();
  }, []);

  useEffect(() => {
    const loadEditCase = async () => {
      if (!isEditMode || !editCaseId) {
        setLoadingPage(false);
        return;
      }

      setLoadingPage(true);
      try {
        const detail = await studentApi.caseDetail(editCaseId);
        setTitle(detail.registration?.title ?? '');
        setYear(detail.registration?.year ?? new Date().getFullYear());
        setType(detail.case.type);
        setFaculty(detail.registration?.faculty ?? user?.faculty ?? '');
        setArticlePublishIn(detail.registration?.articlePublishIn ?? '');
        setAuthorName(detail.registration?.authorName ?? user?.fullName ?? '');
        setStudentIdNumber(detail.registration?.studentIdNumber ?? user?.studentId ?? '');
        setSelectedSupervisorEmail(detail.supervisors?.[0]?.email ?? '');
        setCurrentStatus(detail.case.status);
      } catch (err) {
        setServerError(err instanceof Error ? err.message : 'Failed to load registration.');
      } finally {
        setLoadingPage(false);
      }
    };
    void loadEditCase();
  }, [editCaseId, isEditMode, user?.faculty, user?.fullName, user?.studentId]);

  useEffect(() => {
    const loadSupervisors = async () => {
      if (!hasStudyProgram) {
        setSupervisors([]);
        setLoadingSupervisors(false);
        return;
      }
      setLoadingSupervisors(true);
      try {
        const rows = await studentApi.listSupervisors();
        setSupervisors(rows);
      } catch (err) {
        setServerError(err instanceof Error ? err.message : 'Failed to load supervisors.');
      } finally {
        setLoadingSupervisors(false);
      }
    };
    void loadSupervisors();
  }, [hasStudyProgram]);

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

  const useFacultySelect = faculties.length > 0 && !facultyLoadError;

  const submit = async (submitForApproval: boolean) => {
    setServerError('');
    const nextErrors = submitForApproval ? validateForSubmit() : validateForDraft();
    if (Object.values(nextErrors).some(Boolean)) {
      setErrors(nextErrors);
      scrollToFirstError(nextErrors);
      return;
    }
    setErrors({});

    setSaving(true);
    try {
      if (isEditMode && editCaseId) {
        await studentApi.updateRegistration(editCaseId, {
          title,
          year,
          faculty,
          articlePublishIn: articlePublishIn || undefined,
          authorName: authorName || undefined,
          studentIdNumber: studentIdNumber || undefined,
          supervisorEmail: selectedSupervisorEmail || undefined,
        });
        if (submitForApproval) {
          await studentApi.submitRegistration(editCaseId, true);
        }
        navigate(`/student/cases/${editCaseId}`);
        return;
      }

      const createResponse = await studentApi.createRegistration({
        title,
        type,
        year,
        faculty,
        articlePublishIn: articlePublishIn || undefined,
        authorName: authorName || undefined,
        studentIdNumber: studentIdNumber || undefined,
        supervisorEmail: selectedSupervisorEmail || undefined,
      });

      if (submitForApproval) {
        await studentApi.submitRegistration(createResponse.caseId, true);
      }

      navigate(`/student/cases/${createResponse.caseId}`);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to create registration.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ShellLayout
      title={isEditMode ? 'Edit Publication Registration' : 'New Publication Registration'}
      subtitle={isEditMode ? 'Update the same case and resubmit when required' : 'Create draft then submit when agreement is accepted'}
    >
      <div className="su-card fade-in">
        <div className="card-body p-4">
          {loadingPage && <div className="alert alert-info">Loading registration...</div>}
          {thesisBlocked && (
            <div className="alert alert-warning">
              You already have a THESIS registration case.
              {preferredThesisCase && (
                <>
                  {' '}Use the existing case instead.
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 ms-1 align-baseline"
                    onClick={() => navigate(`/student/cases/${preferredThesisCase.id}`)}
                  >
                    Open case #{preferredThesisCase.id}
                  </button>
                </>
              )}
            </div>
          )}
          {isEditMode && currentStatus === 'REGISTRATION_PENDING' && (
            <div className="alert alert-info">
              Editing this pending registration will move it back to draft. Save your changes, then resubmit the same case for lecturer approval.
            </div>
          )}
          {isEditMode && currentStatus === 'REJECTED' && (
            <div className="alert alert-danger">
              This registration was rejected. Update the same case here, then resubmit it when your revisions are ready.
            </div>
          )}
          <form
            className="row g-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submit(false);
            }}
          >
            <div className="col-12">
              <label className="form-label" htmlFor="registration-title">Title</label>
              <input
                id="registration-title"
                className={`form-control${errors.title ? ' is-invalid' : ''}`}
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  clearFieldError('title');
                }}
              />
              {errors.title && <div className="text-danger small mt-1">{errors.title}</div>}
            </div>

            <div className="col-md-4">
              <label className="form-label" htmlFor="registration-publicationType">Publication Type</label>
              <select
                id="registration-publicationType"
                className={`form-select${errors.publicationType ? ' is-invalid' : ''}`}
                value={type}
                onChange={(event) => {
                  setType(event.target.value as PublicationType);
                  clearFieldError('publicationType');
                }}
                disabled={isEditMode}
              >
                <option value="THESIS">THESIS</option>
                <option value="ARTICLE">ARTICLE</option>
                <option value="INTERNSHIP_REPORT" disabled>INTERNSHIP_REPORT (Not enabled yet)</option>
                <option value="OTHER" disabled>OTHER (Not enabled yet)</option>
              </select>
              <div className="form-text">
                {isEditMode
                  ? 'Publication type cannot be changed for an existing case.'
                  : 'Only THESIS and ARTICLE are currently enabled.'}
              </div>
              {errors.publicationType && <div className="text-danger small mt-1">{errors.publicationType}</div>}
            </div>

            <div className="col-md-4">
              <label className="form-label" htmlFor="registration-year">Year</label>
              <input
                id="registration-year"
                className={`form-control${errors.year ? ' is-invalid' : ''}`}
                type="number"
                min={1900}
                max={2100}
                value={year ?? ''}
                onChange={(event) => {
                  setYear(event.target.value ? Number(event.target.value) : undefined);
                  clearFieldError('year');
                }}
              />
              {errors.year && <div className="text-danger small mt-1">{errors.year}</div>}
            </div>

            <div className="col-md-4">
              <label className="form-label" htmlFor="registration-faculty">Faculty</label>
              {useFacultySelect ? (
                <select
                  id="registration-faculty"
                  className={`form-select${errors.faculty ? ' is-invalid' : ''}`}
                  value={faculty}
                  onChange={(event) => {
                    setFaculty(event.target.value);
                    clearFieldError('faculty');
                  }}
                >
                  <option value="">Select faculty</option>
                  {faculties.map((item) => (
                    <option key={item.id} value={item.name}>{item.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  id="registration-faculty"
                  className={`form-control${errors.faculty ? ' is-invalid' : ''}`}
                  value={faculty}
                  onChange={(event) => {
                    setFaculty(event.target.value);
                    clearFieldError('faculty');
                  }}
                />
              )}
              {errors.faculty && <div className="text-danger small mt-1">{errors.faculty}</div>}
            </div>

            <div className="col-md-6">
              <label className="form-label" htmlFor="registration-authorName">Author</label>
              <input
                id="registration-authorName"
                className={`form-control${errors.authorName ? ' is-invalid' : ''}`}
                value={authorName}
                onChange={(event) => {
                  setAuthorName(event.target.value);
                  clearFieldError('authorName');
                }}
              />
              {errors.authorName && <div className="text-danger small mt-1">{errors.authorName}</div>}
            </div>

            <div className="col-md-6">
              <label className="form-label" htmlFor="registration-studentId">Student ID Number</label>
              <input
                id="registration-studentId"
                className={`form-control${errors.studentId ? ' is-invalid' : ''}`}
                value={studentIdNumber}
                onChange={(event) => {
                  setStudentIdNumber(event.target.value);
                  clearFieldError('studentId');
                }}
              />
              {errors.studentId && <div className="text-danger small mt-1">{errors.studentId}</div>}
            </div>

            <div className="col-12">
              <label className="form-label">Article Publish In</label>
              <input
                className="form-control"
                value={articlePublishIn}
                onChange={(event) => setArticlePublishIn(event.target.value)}
                placeholder="Journal or conference name"
              />
            </div>

            <div className="col-12" id="registration-supervisors">
              <label className="form-label">Supervisors</label>
              <select
                className={`form-select${errors.supervisorIds ? ' is-invalid' : ''}`}
                value={selectedSupervisorEmail}
                onChange={(event) => {
                  setSelectedSupervisorEmail(event.target.value);
                  clearFieldError('supervisorIds');
                }}
                disabled={loadingSupervisors || !hasStudyProgram}
              >
                <option value="">
                  {loadingSupervisors
                    ? 'Loading supervisors...'
                    : hasStudyProgram
                      ? 'Select supervisor'
                      : 'Complete onboarding first'}
                </option>
                {supervisors.map((supervisor) => (
                  <option key={supervisor.id} value={supervisor.email}>
                    {supervisorLabel(supervisor)}
                  </option>
                ))}
              </select>
              {!loadingSupervisors && supervisors.length === 0 && (
                <div className="text-muted small mt-1">
                  {hasStudyProgram
                    ? 'No supervisors available right now.'
                    : 'Complete onboarding to load supervisors.'}
                </div>
              )}
              <div className="form-text">Supervisor options are loaded from the lecturer directory.</div>
              {errors.supervisorIds && <div className="text-danger small mt-1">{errors.supervisorIds}</div>}
            </div>

            <div className="col-12" id="registration-agreements">
              <div className="form-check mb-2">
                <input
                  className={`form-check-input${errors.agreement1 ? ' is-invalid' : ''}`}
                  id="permissionChecklistOneAccepted"
                  type="checkbox"
                  checked={permissionChecklistOneAccepted}
                  onChange={(event) => {
                    setPermissionChecklistOneAccepted(event.target.checked);
                    clearFieldError('agreement1');
                  }}
                />
                <label className="form-check-label" htmlFor="permissionChecklistOneAccepted">
                  I hereby grant to Sampoerna University (SU) the nonexclusive right to create a digital version of the above-named publication and to make my publication available as part of library electronic local content collections. I understand that the full text of my publication will be available to the SU Library members, in digital form without restriction as part of the collection, and I give my permission for the SU Library to reproduce, distribute, display, and transmit my publication in order to make it available online to support education and research activities.
                </label>
              </div>
              <div className="form-check">
                <input
                  className={`form-check-input${errors.agreement2 ? ' is-invalid' : ''}`}
                  id="permissionChecklistTwoAccepted"
                  type="checkbox"
                  checked={permissionChecklistTwoAccepted}
                  onChange={(event) => {
                    setPermissionChecklistTwoAccepted(event.target.checked);
                    clearFieldError('agreement2');
                  }}
                />
                <label className="form-check-label" htmlFor="permissionChecklistTwoAccepted">
                  I understand that this permission constitutes a non-exclusive, perpetual, royalty-free license, and that I retain all other rights to the copyright in my publication, including the right to use it in other works such as articles and books.
                </label>
              </div>
              {errors.agreement1 && <div className="text-danger small mt-1">{errors.agreement1}</div>}
              {errors.agreement2 && <div className="text-danger small mt-1">{errors.agreement2}</div>}
            </div>

            {serverError && (
              <div className="col-12">
                <div className="alert alert-danger d-flex align-items-center gap-2 mb-0" style={{ borderRadius: '0.75rem' }}><span>⚠️</span> {serverError}</div>
              </div>
            )}

            <div className="col-12 d-flex flex-wrap gap-2">
              <button className="btn btn-outline-primary" type="submit" disabled={saving || loadingSupervisors || loadingPage} style={{ borderRadius: '999px', padding: '0.5rem 1.5rem' }}>
                {saving ? '⏳ Saving...' : (isEditMode ? '💾 Save Changes' : '💾 Save Draft')}
              </button>
              <button
                className="btn btn-primary"
                type="button"
                disabled={saving || loadingSupervisors || loadingPage}
                onClick={() => void submit(true)}
                style={{ borderRadius: '999px', padding: '0.5rem 1.5rem' }}
              >
                {saving
                  ? '⏳ Submitting...'
                  : (isEditMode && currentStatus && currentStatus !== 'REGISTRATION_DRAFT'
                    ? '📨 Save and Resubmit for Approval'
                    : '📨 Save and Submit for Approval')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ShellLayout>
  );
}
