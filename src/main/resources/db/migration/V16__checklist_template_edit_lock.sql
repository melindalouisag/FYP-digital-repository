CREATE TABLE IF NOT EXISTS checklist_template_edit_lock (
  id BIGSERIAL PRIMARY KEY,
  template_id BIGINT NOT NULL UNIQUE REFERENCES checklist_template(id),
  locked_by_user_id BIGINT NOT NULL REFERENCES users(id),
  locked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);
