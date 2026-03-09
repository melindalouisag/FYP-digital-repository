-- Pre-registered staff: lecturers and library admins
-- When a user with @sampoernauniversity.ac.id logs in via SSO,
-- the system checks this table to determine their role.
CREATE TABLE staff_registry (
    id            BIGSERIAL PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    role          VARCHAR(20)  NOT NULL,  -- 'LECTURER' or 'ADMIN'
    full_name     VARCHAR(255),
    department    VARCHAR(255),           -- e.g. 'Library Management'
    study_program VARCHAR(255),           -- e.g. 'Information Systems'
    created_at    TIMESTAMP DEFAULT NOW()
);

-- Staff rows are managed operationally (e.g. Railway database), not seeded in code.
