ALTER TABLE submission_version
  ADD COLUMN IF NOT EXISTS metadata_study_program VARCHAR(255);
