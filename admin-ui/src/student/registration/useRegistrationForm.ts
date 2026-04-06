import { calendarApi } from '../../lib/api/calendar';
import {
  findLatestDeadline,
  formatCalendarEventSchedule,
  getDeadlineActionLabel,
  getDeadlineBlockMessage,
  getPublicationTypeLabel,
  isDeadlinePassed,
} from '../../calendar/calendarUtils';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { masterApi, type Faculty } from '../../lib/api/master';
import { studentApi, type SupervisorRow } from '../../lib/api/student';
import { useAuth } from '../../lib/context/AuthContext';
import type { CalendarEvent, CaseDetailPayload, CaseSummary, PublicationType } from '../../lib/workflowTypes';

export type FormErrors = {
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

export interface UseRegistrationFormResult {
  isEditMode: boolean;
  editCaseId: number | null;
  hasStudyProgram: boolean;
  loadingPage: boolean;
  loadingSupervisors: boolean;
  saving: boolean;
  currentStatus: string | null;
  errors: FormErrors;
  serverError: string;
  title: string;
  year?: number;
  type: PublicationType;
  faculty: string;
  faculties: Faculty[];
  useFacultySelect: boolean;
  articlePublishIn: string;
  authorName: string;
  studentIdNumber: string;
  supervisors: SupervisorRow[];
  selectedSupervisorEmail: string;
  permissionChecklistOneAccepted: boolean;
  permissionChecklistTwoAccepted: boolean;
  thesisBlocked: boolean;
  registrationDeadlinePassed: boolean;
  registrationDeadlineLabel: string;
  registrationFeedback: RegistrationFeedbackEntry[];
  preferredThesisCase: CaseSummary | null;
  setTitle: (value: string) => void;
  setYear: (value?: number) => void;
  setType: (value: PublicationType) => void;
  setFaculty: (value: string) => void;
  setArticlePublishIn: (value: string) => void;
  setAuthorName: (value: string) => void;
  setStudentIdNumber: (value: string) => void;
  setSelectedSupervisorEmail: (value: string) => void;
  setPermissionChecklistOneAccepted: (value: boolean) => void;
  setPermissionChecklistTwoAccepted: (value: boolean) => void;
  openPreferredThesisCase: () => void;
  submitDraft: () => Promise<void>;
  submitForApproval: () => Promise<void>;
}

export interface RegistrationFeedbackEntry {
  key: string;
  sourceLabel: string;
  body: string;
  createdAt?: string;
}

const STATUS_PRIORITY: Record<string, number> = {
  REGISTRATION_VERIFIED: 0,
  REGISTRATION_APPROVED: 1,
  REGISTRATION_PENDING: 2,
  REGISTRATION_DRAFT: 3,
  REJECTED: 4,
};

const ERROR_FIELD_ORDER: Array<keyof FormErrors> = [
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

function priority(status: string) {
  return STATUS_PRIORITY[status] ?? 5;
}

export function supervisorLabel(supervisor: SupervisorRow): string {
  const displayName = supervisor.name && supervisor.name.trim().length > 0
    ? supervisor.name.trim()
    : supervisor.email;
  return `${displayName} (${supervisor.email})`;
}

export function useRegistrationForm(): UseRegistrationFormResult {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const editCaseId = caseId ? Number(caseId) : null;
  const isEditMode = editCaseId !== null && !Number.isNaN(editCaseId);
  const hasStudyProgram = Boolean(user?.program?.trim());

  const [title, setTitleState] = useState('');
  const [year, setYearState] = useState<number | undefined>(new Date().getFullYear());
  const [type, setTypeState] = useState<PublicationType>('THESIS');
  const [faculty, setFacultyState] = useState(user?.faculty ?? '');
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [facultyLoadError, setFacultyLoadError] = useState(false);
  const [articlePublishIn, setArticlePublishInState] = useState('');
  const [authorName, setAuthorNameState] = useState(user?.fullName ?? '');
  const [studentIdNumber, setStudentIdNumberState] = useState(user?.studentId ?? '');
  const [supervisors, setSupervisors] = useState<SupervisorRow[]>([]);
  const [existingCases, setExistingCases] = useState<CaseSummary[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [selectedSupervisorEmail, setSelectedSupervisorEmailState] = useState('');
  const [permissionChecklistOneAccepted, setPermissionChecklistOneAcceptedState] = useState(false);
  const [permissionChecklistTwoAccepted, setPermissionChecklistTwoAcceptedState] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingPage, setLoadingPage] = useState(Boolean(isEditMode));
  const [loadingSupervisors, setLoadingSupervisors] = useState(true);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [registrationFeedback, setRegistrationFeedback] = useState<RegistrationFeedbackEntry[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState('');

  const externalThesisCases = useMemo(
    () => existingCases.filter((item) => item.type === 'THESIS' && item.id !== editCaseId),
    [editCaseId, existingCases]
  );
  const thesisBlocked = !isEditMode && type === 'THESIS' && externalThesisCases.length > 0;
  const registrationDeadline = useMemo(
    () => findLatestDeadline(calendarEvents, type, 'REGISTRATION_DEADLINE'),
    [calendarEvents, type]
  );
  const registrationDeadlinePassed = isDeadlinePassed(registrationDeadline);
  const registrationDeadlineLabel = registrationDeadline
    ? `${getPublicationTypeLabel(type)} ${getDeadlineActionLabel('REGISTRATION_DEADLINE')} • ${formatCalendarEventSchedule(registrationDeadline)}`
    : '';
  const preferredThesisCase = useMemo(() => (
    externalThesisCases
      .slice()
      .sort((left, right) => {
        const byStatus = priority(left.status) - priority(right.status);
        if (byStatus !== 0) return byStatus;
        return (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '');
      })[0] ?? null
  ), [externalThesisCases]);

  const clearFieldError = (field: keyof FormErrors) => {
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const scrollToFirstError = (nextErrors: FormErrors) => {
    const firstField = ERROR_FIELD_ORDER.find((field) => nextErrors[field]);
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
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
      target.focus();
    }
  };

  const validateBase = (): FormErrors => {
    const nextErrors: FormErrors = {};
    if (!title.trim()) {
      nextErrors.title = 'Title is required.';
    }
    if (thesisBlocked) {
      nextErrors.publicationType = 'You already have a THESIS registration in progress.';
    }
    if (!selectedSupervisorEmail.trim()) {
      nextErrors.supervisorIds = 'Please select a supervisor.';
    }
    return nextErrors;
  };

  const validate = (submitForApproval: boolean): FormErrors => {
    const nextErrors = validateBase();
    if (!submitForApproval) {
      if (nextErrors.title) {
        nextErrors.title = 'Title is required to save draft.';
      }
      return nextErrors;
    }

    if (!type) {
      nextErrors.publicationType = 'Publication type is required.';
    }
    if (year === undefined || Number.isNaN(year) || !/^\d{4}$/.test(String(year))) {
      nextErrors.year = 'Year is required and must be 4 digits.';
    }
    if (!faculty.trim()) {
      nextErrors.faculty = 'Faculty is required.';
    }
    if (!authorName.trim()) {
      nextErrors.authorName = 'Author name is required.';
    }
    if (!studentIdNumber.trim()) {
      nextErrors.studentId = 'Student ID number is required.';
    }
    if (!permissionChecklistOneAccepted) {
      nextErrors.agreement1 = 'Please accept agreement checklist 1.';
    }
    if (!permissionChecklistTwoAccepted) {
      nextErrors.agreement2 = 'Please accept agreement checklist 2.';
    }
    return nextErrors;
  };

  const buildRegistrationPayload = () => ({
    title,
    year,
    faculty,
    articlePublishIn: articlePublishIn || undefined,
    authorName: authorName || undefined,
    studentIdNumber: studentIdNumber || undefined,
    supervisorEmail: selectedSupervisorEmail || undefined,
  });

  const applyEditCaseDetail = useCallback((detail: Awaited<ReturnType<typeof studentApi.caseDetail>>) => {
    setTitleState(detail.registration?.title ?? '');
    setYearState(detail.registration?.year ?? new Date().getFullYear());
    setTypeState(detail.case.type);
    setFacultyState(detail.registration?.faculty ?? user?.faculty ?? '');
    setArticlePublishInState(detail.registration?.articlePublishIn ?? '');
    setAuthorNameState(detail.registration?.authorName ?? user?.fullName ?? '');
    setStudentIdNumberState(detail.registration?.studentIdNumber ?? user?.studentId ?? '');
    setSelectedSupervisorEmailState(detail.supervisors?.[0]?.email ?? '');
    setCurrentStatus(detail.case.status);
    setRegistrationFeedback(buildRegistrationFeedback(detail));
  }, [user?.faculty, user?.fullName, user?.studentId]);

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
    const loadCalendar = async () => {
      try {
        setCalendarEvents(await calendarApi.listEvents());
      } catch {
        setCalendarEvents([]);
      }
    };
    void loadCalendar();
  }, []);

  useEffect(() => {
    const loadEditCase = async () => {
      if (!isEditMode || !editCaseId) {
        setRegistrationFeedback([]);
        setLoadingPage(false);
        return;
      }

      setLoadingPage(true);
      try {
        const detail = await studentApi.caseDetail(editCaseId);
        applyEditCaseDetail(detail);
      } catch (err) {
        setServerError(err instanceof Error ? err.message : 'Failed to load registration.');
      } finally {
        setLoadingPage(false);
      }
    };
    void loadEditCase();
  }, [applyEditCaseDetail, editCaseId, isEditMode]);

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
    if (registrationDeadlinePassed) {
      setServerError(getDeadlineBlockMessage('REGISTRATION_DEADLINE'));
      return;
    }
    const nextErrors = validate(submitForApproval);
    if (Object.values(nextErrors).some(Boolean)) {
      setErrors(nextErrors);
      scrollToFirstError(nextErrors);
      return;
    }
    setErrors({});

    setSaving(true);
    try {
      const registrationPayload = buildRegistrationPayload();
      let targetCaseId = editCaseId;

      if (isEditMode && targetCaseId) {
        await studentApi.updateRegistration(editCaseId, registrationPayload);
      } else {
        const createResponse = await studentApi.createRegistration({
          type,
          ...registrationPayload,
        });
        targetCaseId = createResponse.caseId;
      }

      if (submitForApproval && targetCaseId) {
        await studentApi.submitRegistration(targetCaseId, true);
      }

      if (targetCaseId) {
        navigate(`/student/cases/${targetCaseId}`);
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to create registration.');
    } finally {
      setSaving(false);
    }
  };

  return {
    isEditMode,
    editCaseId,
    hasStudyProgram,
    loadingPage,
    loadingSupervisors,
    saving,
    currentStatus,
    errors,
    serverError,
    title,
    year,
    type,
    faculty,
    faculties,
    useFacultySelect,
    articlePublishIn,
    authorName,
    studentIdNumber,
    supervisors,
    selectedSupervisorEmail,
    permissionChecklistOneAccepted,
    permissionChecklistTwoAccepted,
    thesisBlocked,
    registrationDeadlinePassed,
    registrationDeadlineLabel,
    registrationFeedback,
    preferredThesisCase,
    setTitle: (value) => {
      setTitleState(value);
      clearFieldError('title');
    },
    setYear: (value) => {
      setYearState(value);
      clearFieldError('year');
    },
    setType: (value) => {
      setTypeState(value);
      clearFieldError('publicationType');
    },
    setFaculty: (value) => {
      setFacultyState(value);
      clearFieldError('faculty');
    },
    setArticlePublishIn: setArticlePublishInState,
    setAuthorName: (value) => {
      setAuthorNameState(value);
      clearFieldError('authorName');
    },
    setStudentIdNumber: (value) => {
      setStudentIdNumberState(value);
      clearFieldError('studentId');
    },
    setSelectedSupervisorEmail: (value) => {
      setSelectedSupervisorEmailState(value);
      clearFieldError('supervisorIds');
    },
    setPermissionChecklistOneAccepted: (value) => {
      setPermissionChecklistOneAcceptedState(value);
      clearFieldError('agreement1');
    },
    setPermissionChecklistTwoAccepted: (value) => {
      setPermissionChecklistTwoAcceptedState(value);
      clearFieldError('agreement2');
    },
    openPreferredThesisCase: () => {
      if (preferredThesisCase) {
        navigate(`/student/cases/${preferredThesisCase.id}`);
      }
    },
    submitDraft: () => submit(false),
    submitForApproval: () => submit(true),
  };
}

function buildRegistrationFeedback(detail: CaseDetailPayload): RegistrationFeedbackEntry[] {
  const entries: RegistrationFeedbackEntry[] = detail.comments
    ?.filter((comment) => comment.authorRole === 'LECTURER' || comment.authorRole === 'ADMIN')
    .map((comment) => ({
      key: `comment-${comment.id}`,
      sourceLabel: comment.authorRole === 'ADMIN' ? 'Feedback from library' : 'Feedback from lecturer',
      body: comment.body,
      createdAt: comment.createdAt,
    })) ?? [];

  const supervisorDecisionNote = detail.registration?.supervisorDecisionNote?.trim();
  if (supervisorDecisionNote) {
    const duplicate = entries.some((entry) => entry.body.trim() === supervisorDecisionNote);
    if (!duplicate) {
      entries.push({
        key: 'registration-supervisor-note',
        sourceLabel: 'Feedback from lecturer',
        body: supervisorDecisionNote,
        createdAt: detail.registration?.supervisorDecisionAt ?? undefined,
      });
    }
  }

  return entries.sort((left, right) => compareRegistrationFeedbackDates(left.createdAt, right.createdAt));
}

function compareRegistrationFeedbackDates(left?: string, right?: string) {
  const leftValue = left ? Date.parse(left) || 0 : 0;
  const rightValue = right ? Date.parse(right) || 0 : 0;
  return leftValue - rightValue;
}
