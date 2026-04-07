import type { FormEvent } from 'react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { PublicationType } from '../lib/workflowTypes';
import {
  getDeadlineActionLabel,
  getPublicationTypeLabel,
  getRepeatOptionLabel,
  type CalendarRepeatOption,
} from './calendarUtils';
import { ACTIVE_PUBLICATION_TYPES } from '../lib/uiLabels';
import type { CalendarFormState } from './useCalendarEvents';

interface CalendarEventModalProps {
  open: boolean;
  isAdmin: boolean;
  form: CalendarFormState;
  submitting: boolean;
  actionError: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (updater: (current: CalendarFormState) => CalendarFormState) => void;
}

const REPEAT_OPTIONS: CalendarRepeatOption[] = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'ANNUALLY'];

export function CalendarEventModal({
  open,
  isAdmin,
  form,
  submitting,
  actionError,
  onClose,
  onSubmit,
  onChange,
}: CalendarEventModalProps) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, open, submitting]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className="modal d-block"
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-event-modal-title"
      style={{ background: 'rgba(15, 23, 42, 0.48)' }}
      onClick={() => {
        if (!submitting) {
          onClose();
        }
      }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg" onClick={(event) => event.stopPropagation()}>
        <div className="modal-content su-calendar-modal">
          <div className="modal-header border-0 pb-0 align-items-start">
            <div>
              <div className="su-calendar-modal-kicker">Academic calendar</div>
              <h2 className="modal-title fs-4" id="calendar-event-modal-title">Add Event</h2>
            </div>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              disabled={submitting}
              onClick={onClose}
            />
          </div>

          <form onSubmit={onSubmit}>
            <div className="modal-body pt-3">
              {actionError ? <div className="alert alert-danger py-2">{actionError}</div> : null}

              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label">Title</label>
                  <input
                    className="form-control"
                    value={form.title}
                    maxLength={160}
                    placeholder="Input event title..."
                    onChange={(event) => onChange((current) => ({ ...current, title: event.target.value }))}
                    required
                  />
                </div>

                <div className="col-12">
                  <label className="form-label">Date</label>
                  <input
                    className="form-control"
                    type="date"
                    value={form.eventDate}
                    onChange={(event) => onChange((current) => ({ ...current, eventDate: event.target.value }))}
                    required
                  />
                </div>

                <div className="col-sm-6">
                  <label className="form-label">From</label>
                  <input
                    className="form-control"
                    type="time"
                    value={form.eventTime}
                    onChange={(event) => onChange((current) => ({ ...current, eventTime: event.target.value }))}
                    required
                  />
                </div>

                <div className="col-sm-6">
                  <label className="form-label">To</label>
                  <input
                    className="form-control"
                    type="time"
                    value={form.endTime}
                    onChange={(event) => onChange((current) => ({ ...current, endTime: event.target.value }))}
                  />
                </div>

                <div className="col-12">
                  <label className="form-label">Frequency</label>
                  <select
                    className="form-select"
                    value={form.frequency}
                    onChange={(event) => onChange((current) => ({
                      ...current,
                      frequency: event.target.value as CalendarRepeatOption,
                    }))}
                  >
                    {REPEAT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {getRepeatOptionLabel(option)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12">
                  <label className="form-label">Location</label>
                  <input
                    className="form-control"
                    value={form.location}
                    placeholder="Input event location..."
                    onChange={(event) => onChange((current) => ({ ...current, location: event.target.value }))}
                  />
                </div>

                <div className="col-12">
                  <label className="form-label">Details</label>
                  <textarea
                    className="form-control"
                    rows={4}
                    value={form.description}
                    placeholder="Add notes or a short description."
                    onChange={(event) => onChange((current) => ({ ...current, description: event.target.value }))}
                  />
                </div>

                {isAdmin ? (
                  <>
                    <div className="col-12">
                      <label className="form-label">Calendar</label>
                      <select
                        className="form-select"
                        value={form.mode}
                        onChange={(event) => onChange((current) => ({
                          ...current,
                          mode: event.target.value as typeof current.mode,
                        }))}
                      >
                        <option value="PERSONAL">Personal event</option>
                        <option value="REGISTRATION_DEADLINE">Registration deadline</option>
                        <option value="SUBMISSION_DEADLINE">Submission deadline</option>
                      </select>
                    </div>

                    {form.mode !== 'PERSONAL' ? (
                      <div className="col-12">
                        <label className="form-label">{getDeadlineActionLabel(form.mode)} for</label>
                        <select
                          className="form-select"
                          value={form.publicationType}
                          onChange={(event) => onChange((current) => ({
                            ...current,
                            publicationType: event.target.value as PublicationType,
                          }))}
                        >
                          {ACTIVE_PUBLICATION_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {getPublicationTypeLabel(type)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>

            <div className="modal-footer border-0 pt-0">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Event'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
