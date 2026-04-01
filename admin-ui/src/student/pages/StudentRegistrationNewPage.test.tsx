import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StudentRegistrationNewPage from './StudentRegistrationNewPage';
import { renderWithProviders } from '../../test/testUtils';

const authMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

const studentApiMocks = vi.hoisted(() => ({
  listCases: vi.fn(),
  listSupervisors: vi.fn(),
  caseDetail: vi.fn(),
  createRegistration: vi.fn(),
  updateRegistration: vi.fn(),
  submitRegistration: vi.fn(),
}));

const masterApiMocks = vi.hoisted(() => ({
  listFaculties: vi.fn(),
}));

vi.mock('../../lib/context/AuthContext', () => ({
  useAuth: authMocks.useAuth,
}));

vi.mock('../../lib/api/student', () => ({
  studentApi: studentApiMocks,
}));

vi.mock('../../lib/api/master', () => ({
  masterApi: masterApiMocks,
}));

describe('StudentRegistrationNewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.useAuth.mockReturnValue({
      user: {
        id: 10,
        email: 'student@example.com',
        role: 'STUDENT',
        availableRoles: ['STUDENT'],
        roleSelectionRequired: false,
        profileComplete: true,
        emailVerified: true,
        fullName: 'Student Example',
        faculty: 'Faculty of Engineering and Technology (FET)',
        studentId: 'S-1001',
        program: 'Information Systems',
      },
      logout: vi.fn(),
      loading: false,
    });
    studentApiMocks.listCases.mockResolvedValue([]);
    studentApiMocks.listSupervisors.mockResolvedValue([
      { id: 1, email: 'lecturer@example.com', name: 'Dr. Lecturer' },
    ]);
    studentApiMocks.caseDetail.mockResolvedValue(null);
    studentApiMocks.createRegistration.mockResolvedValue({ caseId: 1, status: 'REGISTRATION_DRAFT' });
    studentApiMocks.updateRegistration.mockResolvedValue({ caseId: 1, status: 'REGISTRATION_DRAFT' });
    studentApiMocks.submitRegistration.mockResolvedValue({ caseId: 1, status: 'REGISTRATION_PENDING' });
    masterApiMocks.listFaculties.mockResolvedValue([
      { id: 1, name: 'Faculty of Engineering and Technology (FET)' },
    ]);
  });

  it('shows client-side validation errors before submit', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <Routes>
        <Route path="/student/registrations/new" element={<StudentRegistrationNewPage />} />
      </Routes>,
      '/student/registrations/new'
    );

    await waitFor(() => expect(studentApiMocks.listSupervisors).toHaveBeenCalled());

    await user.clear(screen.getByLabelText('Title'));
    await user.click(screen.getByRole('button', { name: /save and submit for approval/i }));

    expect(await screen.findByText('Title is required.')).toBeInTheDocument();
    expect(screen.getByText('Please select a supervisor.')).toBeInTheDocument();
    expect(screen.getByText('Please accept agreement checklist 1.')).toBeInTheDocument();
    expect(screen.getByText('Please accept agreement checklist 2.')).toBeInTheDocument();
    expect(studentApiMocks.createRegistration).not.toHaveBeenCalled();
  });
});
