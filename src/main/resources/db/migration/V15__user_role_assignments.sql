CREATE TABLE IF NOT EXISTS user_role_assignment (
  user_id BIGINT NOT NULL REFERENCES users(id),
  role VARCHAR(32) NOT NULL,
  CONSTRAINT pk_user_role_assignment PRIMARY KEY (user_id, role)
);

INSERT INTO user_role_assignment (user_id, role)
SELECT u.id, u.role
FROM users u
WHERE NOT EXISTS (
  SELECT 1
  FROM user_role_assignment ura
  WHERE ura.user_id = u.id
    AND ura.role = u.role
);
