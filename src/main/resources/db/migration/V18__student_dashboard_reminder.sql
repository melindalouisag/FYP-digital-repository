CREATE TABLE student_dashboard_reminder (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_id BIGINT REFERENCES publication_case(id) ON DELETE SET NULL,
  title VARCHAR(160) NOT NULL,
  reminder_date DATE NOT NULL,
  reminder_time TIME NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_student_dashboard_reminder_title_not_blank CHECK (char_length(btrim(title)) > 0),
  CONSTRAINT chk_student_dashboard_reminder_status CHECK (status IN ('ACTIVE', 'DONE'))
);

CREATE INDEX idx_student_dashboard_reminder_user_schedule
  ON student_dashboard_reminder (user_id, status, reminder_date, reminder_time);

CREATE INDEX idx_student_dashboard_reminder_case
  ON student_dashboard_reminder (case_id);
