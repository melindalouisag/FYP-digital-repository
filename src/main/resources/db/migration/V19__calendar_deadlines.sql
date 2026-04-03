ALTER TABLE student_dashboard_reminder
  ADD COLUMN description TEXT,
  ADD COLUMN event_type VARCHAR(24) NOT NULL DEFAULT 'PERSONAL',
  ADD COLUMN deadline_action VARCHAR(32),
  ADD COLUMN publication_type VARCHAR(32);

CREATE INDEX idx_student_dashboard_reminder_visible
  ON student_dashboard_reminder (status, user_id, reminder_date, reminder_time);

CREATE INDEX idx_student_dashboard_reminder_deadline
  ON student_dashboard_reminder (event_type, deadline_action, publication_type, status, reminder_date, reminder_time);
