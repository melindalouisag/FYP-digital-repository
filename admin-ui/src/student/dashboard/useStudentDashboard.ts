import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { studentApi, type StudentReminderPayload } from '../../lib/api/student';
import type { CaseStatus, CaseSummary, StudentReminder } from '../../lib/workflowTypes';
import {
  canSubmitClearance,
  canSubmitRegistration,
  canUploadSubmission,
  formatStageName,
  getStageKey,
  getWorkflowProgressPercent,
  isActiveWorkflowCase,
} from '../../lib/workflowUi';

export type ReminderFormState = {
  title: string;
  reminderDate: string;
  reminderTime: string;
  caseId: string;
};

export interface UseStudentDashboardResult {
  cases: CaseSummary[];
  reminders: StudentReminder[];
  loading: boolean;
  error: string;
  reminderError: string;
  showReminderManager: boolean;
  showReminderForm: boolean;
  editingReminderId: number | null;
  reminderSubmitting: boolean;
  reminderActionId: number | null;
  reminderForm: ReminderFormState;
  orderedCases: CaseSummary[];
  nextStepCases: CaseSummary[];
  progressPercent: number;
  progressSummary: string;
  activeReminders: StudentReminder[];
  completedReminders: StudentReminder[];
  reminderPreview: StudentReminder[];
  reminderCaseOptions: CaseSummary[];
  setShowReminderManager: (value: boolean | ((current: boolean) => boolean)) => void;
  setReminderForm: Dispatch<SetStateAction<ReminderFormState>>;
  openNewReminderForm: () => void;
  openEditReminderForm: (reminder: StudentReminder) => void;
  closeReminderForm: () => void;
  submitReminder: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  markReminderDone: (reminderId: number) => Promise<void>;
  deleteReminder: (reminderId: number) => Promise<void>;
}

export function useStudentDashboard(): UseStudentDashboardResult {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [reminders, setReminders] = useState<StudentReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reminderError, setReminderError] = useState('');
  const [showReminderManager, setShowReminderManager] = useState(false);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState<number | null>(null);
  const [reminderSubmitting, setReminderSubmitting] = useState(false);
  const [reminderActionId, setReminderActionId] = useState<number | null>(null);
  const [reminderForm, setReminderForm] = useState<ReminderFormState>(() => createDefaultReminderForm());

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [caseRows, reminderRows] = await Promise.all([
        studentApi.listCases(),
        studentApi.listReminders(),
      ]);
      setCases(caseRows);
      setReminders(reminderRows);
    } catch (err) {
      setCases([]);
      setReminders([]);
      setError(err instanceof Error ? err.message : 'Failed to load student dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const activeCases = useMemo(
    () => cases.filter((caseSummary) => isActiveWorkflowCase(caseSummary.status)),
    [cases]
  );
  const orderedActiveCases = useMemo(
    () => sortStudentDashboardCases(activeCases),
    [activeCases]
  );
  const orderedCases = useMemo(
    () => sortStudentDashboardCases(cases),
    [cases]
  );
  const nextStepCases = useMemo(
    () => orderedActiveCases.slice(0, 3),
    [orderedActiveCases]
  );
  const furthestCase = useMemo(
    () => [...activeCases].sort(compareCaseProgress).at(0) ?? null,
    [activeCases]
  );
  const progressPercent = useMemo(() => {
    if (activeCases.length === 0) {
      return 0;
    }
    const total = activeCases.reduce((sum, caseSummary) => sum + getWorkflowProgressPercent(caseSummary.status), 0);
    return Math.round(total / activeCases.length);
  }, [activeCases]);
  const progressSummary = useMemo(() => {
    if (activeCases.length === 0) {
      return 'No active cases yet.';
    }

    const countLabel = `${activeCases.length} active case${activeCases.length === 1 ? '' : 's'}`;
    if (!furthestCase) {
      return countLabel;
    }

    return `${countLabel} • current stage: ${formatStageName(getStageKey(furthestCase.status))}`;
  }, [activeCases.length, furthestCase]);

  const activeReminders = useMemo(
    () => reminders.filter((reminder) => reminder.status === 'ACTIVE').sort(compareReminderSchedule),
    [reminders]
  );
  const completedReminders = useMemo(
    () => reminders
      .filter((reminder) => reminder.status === 'DONE')
      .sort((left, right) => compareTimestamps(right.updatedAt, left.updatedAt)),
    [reminders]
  );
  const reminderPreview = useMemo(
    () => activeReminders.slice(0, 3),
    [activeReminders]
  );
  const reminderCaseOptions = useMemo(
    () => [...cases].sort((left, right) => compareTimestamps(right.updatedAt ?? right.createdAt, left.updatedAt ?? left.createdAt)),
    [cases]
  );

  const resetReminderForm = useCallback(() => {
    setReminderError('');
    setReminderForm(createDefaultReminderForm());
  }, []);

  const openNewReminderForm = () => {
    resetReminderForm();
    setEditingReminderId(null);
    setShowReminderManager(true);
    setShowReminderForm(true);
  };

  const openEditReminderForm = (reminder: StudentReminder) => {
    setReminderError('');
    setEditingReminderId(reminder.id);
    setReminderForm({
      title: reminder.title,
      reminderDate: reminder.reminderDate,
      reminderTime: reminder.reminderTime.slice(0, 5),
      caseId: reminder.caseId ? String(reminder.caseId) : '',
    });
    setShowReminderManager(true);
    setShowReminderForm(true);
  };

  const closeReminderForm = useCallback(() => {
    setShowReminderForm(false);
    setEditingReminderId(null);
    resetReminderForm();
  }, [resetReminderForm]);

  const reloadDashboard = useCallback(async () => {
    await loadDashboard();
  }, [loadDashboard]);

  const runReminderAction = useCallback(
    async (
      action: () => Promise<void>,
      errorMessage: string,
      options?: { actionId?: number; closeEditedReminderId?: number }
    ) => {
      if (options?.actionId != null) {
        setReminderActionId(options.actionId);
      }
      setReminderError('');
      try {
        await action();
        await reloadDashboard();
        if (options?.closeEditedReminderId != null && editingReminderId === options.closeEditedReminderId) {
          closeReminderForm();
        }
      } catch (err) {
        setReminderError(err instanceof Error ? err.message : errorMessage);
      } finally {
        if (options?.actionId != null) {
          setReminderActionId(null);
        }
      }
    },
    [closeReminderForm, editingReminderId, reloadDashboard]
  );

  const submitReminder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReminderSubmitting(true);
    setReminderError('');

    try {
      const payload = toReminderPayload(reminderForm);
      if (editingReminderId) {
        await studentApi.updateReminder(editingReminderId, payload);
      } else {
        await studentApi.createReminder(payload);
      }
      await reloadDashboard();
      closeReminderForm();
    } catch (err) {
      setReminderError(err instanceof Error ? err.message : 'Failed to save reminder.');
    } finally {
      setReminderSubmitting(false);
    }
  };

  const markReminderDone = async (reminderId: number) => {
    await runReminderAction(
      () => studentApi.markReminderDone(reminderId),
      'Failed to mark reminder as done.',
      { actionId: reminderId }
    );
  };

  const deleteReminder = async (reminderId: number) => {
    await runReminderAction(
      () => studentApi.deleteReminder(reminderId),
      'Failed to delete reminder.',
      { actionId: reminderId, closeEditedReminderId: reminderId }
    );
  };

  return {
    cases,
    reminders,
    loading,
    error,
    reminderError,
    showReminderManager,
    showReminderForm,
    editingReminderId,
    reminderSubmitting,
    reminderActionId,
    reminderForm,
    orderedCases,
    nextStepCases,
    progressPercent,
    progressSummary,
    activeReminders,
    completedReminders,
    reminderPreview,
    reminderCaseOptions,
    setShowReminderManager,
    setReminderForm,
    openNewReminderForm,
    openEditReminderForm,
    closeReminderForm,
    submitReminder,
    markReminderDone,
    deleteReminder,
  };
}

function sortStudentDashboardCases(cases: CaseSummary[]): CaseSummary[] {
  const actionable = sortCasesByRecentActivity(cases.filter((caseSummary) => isActionableCase(caseSummary.status)));
  const waiting = sortCasesByRecentActivity(
    cases.filter((caseSummary) => !isActionableCase(caseSummary.status) && isActiveWorkflowCase(caseSummary.status))
  );
  const completed = sortCasesByRecentActivity(
    cases.filter((caseSummary) => !isActionableCase(caseSummary.status) && !isActiveWorkflowCase(caseSummary.status))
  );

  return [...actionable, ...waiting, ...completed];
}

function sortCasesByRecentActivity(cases: CaseSummary[]): CaseSummary[] {
  return [...cases].sort((left, right) => compareTimestamps(right.updatedAt ?? right.createdAt, left.updatedAt ?? left.createdAt));
}

function compareCaseProgress(left: CaseSummary, right: CaseSummary): number {
  const progressDiff = getWorkflowProgressPercent(right.status) - getWorkflowProgressPercent(left.status);
  if (progressDiff !== 0) {
    return progressDiff;
  }
  return compareTimestamps(right.updatedAt ?? right.createdAt, left.updatedAt ?? left.createdAt);
}

function isActionableCase(status: CaseStatus): boolean {
  return canSubmitRegistration(status) || canUploadSubmission(status) || canSubmitClearance(status);
}

function createDefaultReminderForm(): ReminderFormState {
  const now = new Date();
  return {
    title: '',
    reminderDate: now.toISOString().slice(0, 10),
    reminderTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    caseId: '',
  };
}

function toReminderPayload(form: ReminderFormState): StudentReminderPayload {
  return {
    title: form.title.trim(),
    reminderDate: form.reminderDate,
    reminderTime: form.reminderTime,
    caseId: form.caseId ? Number(form.caseId) : null,
  };
}

function compareReminderSchedule(left: StudentReminder, right: StudentReminder): number {
  const leftOverdue = isReminderOverdue(left);
  const rightOverdue = isReminderOverdue(right);
  if (leftOverdue !== rightOverdue) {
    return leftOverdue ? -1 : 1;
  }
  const timeDiff = reminderTimestamp(left) - reminderTimestamp(right);
  if (timeDiff !== 0) {
    return timeDiff;
  }
  return left.id - right.id;
}

function reminderTimestamp(reminder: Pick<StudentReminder, 'reminderDate' | 'reminderTime'>): number {
  return new Date(`${reminder.reminderDate}T${reminder.reminderTime}`).getTime();
}

function isReminderOverdue(reminder: Pick<StudentReminder, 'reminderDate' | 'reminderTime' | 'status'>): boolean {
  return reminder.status === 'ACTIVE' && reminderTimestamp(reminder) < Date.now();
}

export function formatReminderSchedule(reminder: Pick<StudentReminder, 'reminderDate' | 'reminderTime'>): string {
  const value = new Date(`${reminder.reminderDate}T${reminder.reminderTime}`);
  return `${value.toLocaleDateString()} • ${value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function isDashboardReminderOverdue(reminder: Pick<StudentReminder, 'reminderDate' | 'reminderTime' | 'status'>): boolean {
  return isReminderOverdue(reminder);
}

function compareTimestamps(left?: string, right?: string): number {
  const leftValue = left ? Date.parse(left) || 0 : 0;
  const rightValue = right ? Date.parse(right) || 0 : 0;
  return leftValue - rightValue;
}
