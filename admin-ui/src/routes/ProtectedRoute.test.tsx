import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';
import type { AuthUser } from '../lib/api/auth';

const baseUser: AuthUser = {
  id: 1,
  email: 'student@example.com',
  role: 'STUDENT',
  availableRoles: ['STUDENT'],
  roleSelectionRequired: false,
  profileComplete: true,
  emailVerified: true,
};

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to login', () => {
    render(
      <MemoryRouter initialEntries={['/student/dashboard']}>
        <Routes>
          <Route
            path="/student/dashboard"
            element={(
              <ProtectedRoute user={null} loading={false}>
                <div>Protected Content</div>
              </ProtectedRoute>
            )}
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('redirects users who still need role selection', () => {
    render(
      <MemoryRouter initialEntries={['/student/dashboard']}>
        <Routes>
          <Route
            path="/student/dashboard"
            element={(
              <ProtectedRoute user={{ ...baseUser, roleSelectionRequired: true }} loading={false}>
                <div>Protected Content</div>
              </ProtectedRoute>
            )}
          />
          <Route path="/choose-role" element={<div>Choose Role</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Choose Role')).toBeInTheDocument();
  });
});
