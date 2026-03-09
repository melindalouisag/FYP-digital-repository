ALTER TABLE email_verification_token
  ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 0;
