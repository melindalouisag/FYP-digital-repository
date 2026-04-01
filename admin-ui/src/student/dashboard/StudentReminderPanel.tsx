import DashboardPanel from '../../lib/components/DashboardPanel';
import type { UseStudentDashboardResult } from './useStudentDashboard';
import { formatReminderSchedule, isDashboardReminderOverdue } from './useStudentDashboard';

interface StudentReminderPanelProps {
  dashboard: UseStudentDashboardResult;
}

export function StudentReminderPanel({ dashboard }: StudentReminderPanelProps) {
  return (
    <DashboardPanel
      title="Reminders"
      actions={dashboard.reminders.length > 0 ? (
        <div className="d-flex flex-wrap gap-2 justify-content-end">
          <button className="btn btn-outline-secondary btn-sm" type="button" onClick={dashboard.openNewReminderForm}>
            Add Reminder
          </button>
          <button
            className="btn btn-outline-secondary btn-sm"
            type="button"
            onClick={() => dashboard.setShowReminderManager((current) => !current)}
          >
            Manage Reminders
          </button>
        </div>
      ) : undefined}
    >
      {dashboard.loading ? (
        <p className="su-dashboard-empty-copy mb-0">Loading reminders.</p>
      ) : dashboard.reminders.length === 0 && !dashboard.showReminderForm ? (
        <div className="su-dashboard-empty">
          <p className="su-dashboard-empty-copy mb-3">No reminders yet.</p>
          <button className="btn btn-primary btn-sm" type="button" onClick={dashboard.openNewReminderForm}>
            Add Reminder
          </button>
        </div>
      ) : (
        <>
          {dashboard.reminderError && <div className="alert alert-danger py-2 mb-0">{dashboard.reminderError}</div>}

          {dashboard.reminderPreview.length > 0 ? (
            <div className="su-dashboard-list">
              {dashboard.reminderPreview.map((reminder) => {
                const overdue = isDashboardReminderOverdue(reminder);
                return (
                  <div className={`su-dashboard-list-item su-dashboard-reminder-item${overdue ? ' is-overdue' : ''}`} key={reminder.id}>
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

          {dashboard.showReminderForm ? (
            <form className="su-dashboard-form-panel" onSubmit={(event) => void dashboard.submitReminder(event)}>
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label">Reminder title</label>
                  <input
                    className="form-control"
                    value={dashboard.reminderForm.title}
                    onChange={(event) => dashboard.setReminderForm((current) => ({ ...current, title: event.target.value }))}
                    maxLength={160}
                    required
                  />
                </div>
                <div className="col-sm-6">
                  <label className="form-label">Date</label>
                  <input
                    className="form-control"
                    type="date"
                    value={dashboard.reminderForm.reminderDate}
                    onChange={(event) => dashboard.setReminderForm((current) => ({ ...current, reminderDate: event.target.value }))}
                    required
                  />
                </div>
                <div className="col-sm-6">
                  <label className="form-label">Time</label>
                  <input
                    className="form-control"
                    type="time"
                    value={dashboard.reminderForm.reminderTime}
                    onChange={(event) => dashboard.setReminderForm((current) => ({ ...current, reminderTime: event.target.value }))}
                    required
                  />
                </div>
                <div className="col-12">
                  <label className="form-label">Related case (optional)</label>
                  <select
                    className="form-select"
                    value={dashboard.reminderForm.caseId}
                    onChange={(event) => dashboard.setReminderForm((current) => ({ ...current, caseId: event.target.value }))}
                  >
                    <option value="">No related case</option>
                    {dashboard.reminderCaseOptions.map((caseSummary) => (
                      <option key={caseSummary.id} value={caseSummary.id}>
                        {caseSummary.title || `Case #${caseSummary.id}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="d-flex flex-wrap gap-2 mt-3">
                <button className="btn btn-primary btn-sm" type="submit" disabled={dashboard.reminderSubmitting}>
                  {dashboard.reminderSubmitting ? 'Saving...' : dashboard.editingReminderId ? 'Save Reminder' : 'Add Reminder'}
                </button>
                <button className="btn btn-outline-secondary btn-sm" type="button" onClick={dashboard.closeReminderForm} disabled={dashboard.reminderSubmitting}>
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          {dashboard.showReminderManager ? (
            <div className="su-dashboard-subsection">
              <h3 className="su-dashboard-subtitle">Manage Reminders</h3>
              {dashboard.activeReminders.length > 0 ? (
                <div className="su-dashboard-list">
                  {dashboard.activeReminders.map((reminder) => {
                    const busy = dashboard.reminderActionId === reminder.id;
                    const overdue = isDashboardReminderOverdue(reminder);
                    return (
                      <div className={`su-dashboard-list-item su-dashboard-reminder-item${overdue ? ' is-overdue' : ''}`} key={reminder.id}>
                        <div className="d-flex justify-content-between gap-3 align-items-start">
                          <div className="min-w-0">
                            <div className="su-dashboard-item-title su-text-truncate">{reminder.title}</div>
                            <div className="su-dashboard-item-meta">
                              {formatReminderSchedule(reminder)}
                              {reminder.caseTitle ? ` • ${reminder.caseTitle}` : ''}
                            </div>
                          </div>
                          <div className="d-flex flex-wrap gap-2 justify-content-end">
                            <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => dashboard.openEditReminderForm(reminder)} disabled={busy || dashboard.reminderSubmitting}>
                              Edit
                            </button>
                            <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => void dashboard.markReminderDone(reminder.id)} disabled={busy || dashboard.reminderSubmitting}>
                              {busy ? 'Saving...' : 'Done'}
                            </button>
                            <button className="btn btn-outline-danger btn-sm" type="button" onClick={() => void dashboard.deleteReminder(reminder.id)} disabled={busy || dashboard.reminderSubmitting}>
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

              {dashboard.completedReminders.length > 0 ? (
                <div className="su-dashboard-subsection">
                  <h3 className="su-dashboard-subtitle">Completed</h3>
                  <div className="su-dashboard-list">
                    {dashboard.completedReminders.map((reminder) => (
                      <div className="su-dashboard-list-item" key={reminder.id}>
                        <div className="d-flex justify-content-between gap-2 align-items-start">
                          <div className="min-w-0">
                            <div className="su-dashboard-item-title su-text-truncate">{reminder.title}</div>
                            <div className="su-dashboard-item-meta">
                              Completed reminder • {formatReminderSchedule(reminder)}
                            </div>
                          </div>
                          <button className="btn btn-outline-danger btn-sm" type="button" onClick={() => void dashboard.deleteReminder(reminder.id)} disabled={dashboard.reminderActionId === reminder.id || dashboard.reminderSubmitting}>
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
  );
}
