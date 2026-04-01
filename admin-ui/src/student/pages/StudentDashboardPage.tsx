import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ShellLayout from '../../layout/ShellLayout';
import DashboardPanel from '../../lib/components/DashboardPanel';
import { studentApi, type StudentReminderPayload } from '../../lib/api/student';
import type { CaseStatus, CaseSummary, StudentReminder } from '../../lib/types/workflow';
import {
  canSubmitClearance,
  canSubmitRegistration,
  canUploadSubmission,
  formatStageName,
  formatStatus,
  getStageKey,
  getWorkflowProgressPercent,
  isActiveWorkflowCase,
  statusBadgeClass,
} from '../../lib/workflowUi';
import { isNavigationActivationKey, resolveStudentCaseNavigation } from '../lib/caseNavigation';

type ReminderFormState = {
  title: string;
  reminderDate: string;
  reminderTime: string;
  caseId: string;
};

export default function StudentDashboardPage() {
  const navigate = useNavigate();
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

  const load = async () => {
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
  };

  useEffect(() => {
    void load();
  }, []);

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

  const openNewReminderForm = () => {
    setReminderError('');
    setEditingReminderId(null);
    setReminderForm(createDefaultReminderForm());
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

  const closeReminderForm = () => {
    setShowReminderForm(false);
    setEditingReminderId(null);
    setReminderForm(createDefaultReminderForm());
    setReminderError('');
  };

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
      await load();
      closeReminderForm();
    } catch (err) {
      setReminderError(err instanceof Error ? err.message : 'Failed to save reminder.');
    } finally {
      setReminderSubmitting(false);
    }
  };

  const markReminderDone = async (reminderId: number) => {
    setReminderActionId(reminderId);
    setReminderError('');
    try {
      await studentApi.markReminderDone(reminderId);
      await load();
    } catch (err) {
      setReminderError(err instanceof Error ? err.message : 'Failed to mark reminder as done.');
    } finally {
      setReminderActionId(null);
    }
  };

  const deleteReminder = async (reminderId: number) => {
    setReminderActionId(reminderId);
    setReminderError('');
    try {
      await studentApi.deleteReminder(reminderId);
      await load();
      if (editingReminderId === reminderId) {
        closeReminderForm();
      }
    } catch (err) {
      setReminderError(err instanceof Error ? err.message : 'Failed to delete reminder.');
    } finally {
      setReminderActionId(null);
    }
  };

  return (
    <ShellLayout title="Student Dashboard" subtitle="Monitor your recent progress">
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="su-dashboard-grid su-dashboard-grid-3 mb-4">
        <DashboardPanel title="Overall Progress">
          <div className="su-dashboard-progress-value">{loading ? '—%' : `${progressPercent}%`}</div>
          <div className="su-dashboard-progress-bar" aria-hidden="true">
            <div className="su-dashboard-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="su-dashboard-support mb-0">
            {loading ? 'Loading dashboard data.' : progressSummary}
          </p>
        </DashboardPanel>

        <DashboardPanel title="Next Steps">
          {loading ? (
            <p className="su-dashboard-empty-copy mb-0">Loading dashboard data.</p>
          ) : nextStepCases.length === 0 ? (
            <p className="su-dashboard-empty-copy mb-0">No active cases yet.</p>
          ) : (
            <div className="su-dashboard-list">
              {nextStepCases.map((caseSummary) => {
                const navigationTarget = resolveStudentCaseNavigation(caseSummary, 'dashboard');
                return (
                  <button
                    key={caseSummary.id}
                    type="button"
                    className="su-dashboard-item-button"
                    onClick={() => navigate(navigationTarget.path)}
                  >
                    <div className="su-dashboard-list-item">
                      <div className="d-flex justify-content-between gap-2 align-items-start">
                        <div className="min-w-0">
                          <div className="su-dashboard-item-title su-text-truncate">
                            {caseSummary.title || 'Untitled Publication'}
                          </div>
                          <div className="su-dashboard-item-support">{navigationTarget.label}</div>
                        </div>
                        <span className={`badge status-badge ${statusBadgeClass(caseSummary.status)}`}>
                          {formatStatus(caseSummary.status)}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Reminders"
          actions={reminders.length > 0 ? (
            <div className="d-flex flex-wrap gap-2 justify-content-end">
              <button className="btn btn-outline-secondary btn-sm" type="button" onClick={openNewReminderForm}>
                Add Reminder
              </button>
              <button
                className="btn btn-outline-secondary btn-sm"
                type="button"
                onClick={() => setShowReminderManager((current) => !current)}
              >
                Manage Reminders
              </button>
            </div>
          ) : undefined}
        >
          {loading ? (
            <p className="su-dashboard-empty-copy mb-0">Loading reminders.</p>
          ) : reminders.length === 0 && !showReminderForm ? (
            <div className="su-dashboard-empty">
              <p className="su-dashboard-empty-copy mb-3">No reminders yet.</p>
              <button className="btn btn-primary btn-sm" type="button" onClick={openNewReminderForm}>
                Add Reminder
              </button>
            </div>
          ) : (
            <>
              {reminderError && <div className="alert alert-danger py-2 mb-0">{reminderError}</div>}

              {reminderPreview.length > 0 ? (
                <div className="su-dashboard-list">
                  {reminderPreview.map((reminder) => {
                    const overdue = isReminderOverdue(reminder);
                    return (
                      <div
                        className={`su-dashboard-list-item su-dashboard-reminder-item${overdue ? ' is-overdue' : ''}`}
                        key={reminder.id}
                      >
                        <div className="d-flex justify-content-between gap-2 align-items-start">
                          <div className="min-w-0">
                            <div className="su-dashboard-item-title su-text-truncate">{reminder.title}</div>
                            <div className="su-dashboard-item-meta">
                              {formatReminderSchedule(reminder)}
                              {reminder.caseTitle ? ` • ${reminder.caseTitle}` : ''}
                            </div>
                          </div>
                          {overdue ? (
                            <span className="badge bg-danger-subtle text-danger-emphasis">Overdue</span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="su-dashboard-empty-copy mb-0">No active reminders.</p>
              )}

              {showReminderForm ? (
                <form className="su-dashboard-form-panel" onSubmit={submitReminder}>
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label">Reminder title</label>
                      <input
                        className="form-control"
                        value={reminderForm.title}
                        onChange={(event) => setReminderForm((current) => ({ ...current, title: event.target.value }))}
                        maxLength={160}
                        required
                      />
                    </div>
                    <div className="col-sm-6">
                      <label className="form-label">Date</label>
                      <input
                        className="form-control"
                        type="date"
                        value={reminderForm.reminderDate}
                        onChange={(event) => setReminderForm((current) => ({ ...current, reminderDate: event.target.value }))}
                        required
                      />
                    </div>
                    <div className="col-sm-6">
                      <label className="form-label">Time</label>
                      <input
                        className="form-control"
                        type="time"
                        value={reminderForm.reminderTime}
                        onChange={(event) => setReminderForm((current) => ({ ...current, reminderTime: event.target.value }))}
                        required
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Related case (optional)</label>
                      <select
                        className="form-select"
                        value={reminderForm.caseId}
                        onChange={(event) => setReminderForm((current) => ({ ...current, caseId: event.target.value }))}
                      >
                        <option value="">No related case</option>
                        {reminderCaseOptions.map((caseSummary) => (
                          <option key={caseSummary.id} value={caseSummary.id}>
                            {caseSummary.title || `Case #${caseSummary.id}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="d-flex flex-wrap gap-2 mt-3">
                    <button className="btn btn-primary btn-sm" type="submit" disabled={reminderSubmitting}>
                      {reminderSubmitting ? 'Saving...' : editingReminderId ? 'Save Reminder' : 'Add Reminder'}
                    </button>
                    <button className="btn btn-outline-secondary btn-sm" type="button" onClick={closeReminderForm} disabled={reminderSubmitting}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}

              {showReminderManager ? (
                <div className="su-dashboard-subsection">
                  <h3 className="su-dashboard-subtitle">Manage Reminders</h3>
                  {activeReminders.length > 0 ? (
                    <div className="su-dashboard-list">
                      {activeReminders.map((reminder) => {
                        const busy = reminderActionId === reminder.id;
                        const overdue = isReminderOverdue(reminder);
                        return (
                          <div
                            className={`su-dashboard-list-item su-dashboard-reminder-item${overdue ? ' is-overdue' : ''}`}
                            key={reminder.id}
                          >
                            <div className="d-flex justify-content-between gap-3 align-items-start">
                              <div className="min-w-0">
                                <div className="su-dashboard-item-title su-text-truncate">{reminder.title}</div>
                                <div className="su-dashboard-item-meta">
                                  {formatReminderSchedule(reminder)}
                                  {reminder.caseTitle ? ` • ${reminder.caseTitle}` : ''}
                                </div>
                              </div>
                              <div className="d-flex flex-wrap gap-2 justify-content-end">
                                <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => openEditReminderForm(reminder)} disabled={busy || reminderSubmitting}>
                                  Edit
                                </button>
                                <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => void markReminderDone(reminder.id)} disabled={busy || reminderSubmitting}>
                                  {busy ? 'Saving...' : 'Done'}
                                </button>
                                <button className="btn btn-outline-danger btn-sm" type="button" onClick={() => void deleteReminder(reminder.id)} disabled={busy || reminderSubmitting}>
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="su-dashboard-empty-copy mb-0">No active reminders.</p>
                  )}

                  {completedReminders.length > 0 ? (
                    <div className="su-dashboard-subsection">
                      <h3 className="su-dashboard-subtitle">Completed</h3>
                      <div className="su-dashboard-list">
                        {completedReminders.map((reminder) => (
                          <div className="su-dashboard-list-item" key={reminder.id}>
                            <div className="d-flex justify-content-between gap-2 align-items-start">
                              <div className="min-w-0">
                                <div className="su-dashboard-item-title su-text-truncate">{reminder.title}</div>
                                <div className="su-dashboard-item-meta">
                                  Completed reminder • {formatReminderSchedule(reminder)}
                                </div>
                              </div>
                              <button className="btn btn-outline-danger btn-sm" type="button" onClick={() => void deleteReminder(reminder.id)} disabled={reminderActionId === reminder.id || reminderSubmitting}>
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </DashboardPanel>
      </div>

      <DashboardPanel title="Case List" className="su-dashboard-panel-auto-height" bodyClassName="su-dashboard-panel-body-auto-height">
        {loading ? (
          <p className="su-dashboard-empty-copy mb-0">Loading dashboard data.</p>
        ) : orderedCases.length === 0 ? (
          <p className="su-dashboard-empty-copy mb-0">No cases yet.</p>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>Recommended next step</th>
                </tr>
              </thead>
              <tbody>
                {orderedCases.map((caseSummary) => {
                  const navigationTarget = resolveStudentCaseNavigation(caseSummary, 'dashboard');
                  return (
                    <tr
                      key={caseSummary.id}
                      className="su-table-row-clickable"
                      tabIndex={0}
                      aria-label={`${navigationTarget.label}: ${caseSummary.title || 'Untitled Publication'}`}
                      onClick={() => navigate(navigationTarget.path)}
                      onKeyDown={(event) => {
                        if (!isNavigationActivationKey(event)) return;
                        event.preventDefault();
                        navigate(navigationTarget.path);
                      }}
                    >
                      <td>
                        <div className="fw-semibold">{caseSummary.title || 'Untitled Publication'}</div>
                      </td>
                      <td>
                        <span className="badge bg-dark-subtle text-dark-emphasis" style={{ borderRadius: '999px' }}>
                          {caseSummary.type}
                        </span>
                      </td>
                      <td>
                        <span className={`badge status-badge ${statusBadgeClass(caseSummary.status)}`}>
                          {formatStatus(caseSummary.status)}
                        </span>
                      </td>
                      <td className="text-muted small">
                        {caseSummary.updatedAt ? new Date(caseSummary.updatedAt).toLocaleString() : 'N/A'}
                      </td>
                      <td>
                        <div className="small fw-semibold text-body-secondary">{navigationTarget.label}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DashboardPanel>
    </ShellLayout>
  );
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

function formatReminderSchedule(reminder: Pick<StudentReminder, 'reminderDate' | 'reminderTime'>): string {
  const value = new Date(`${reminder.reminderDate}T${reminder.reminderTime}`);
  return `${value.toLocaleDateString()} • ${value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function compareTimestamps(left?: string, right?: string): number {
  const leftValue = left ? Date.parse(left) || 0 : 0;
  const rightValue = right ? Date.parse(right) || 0 : 0;
  return leftValue - rightValue;
}
