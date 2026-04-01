import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminChecklistPage from './AdminChecklistPage';
import { renderWithProviders } from '../../test/testUtils';

const authMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

const checklistApiMocks = vi.hoisted(() => ({
  listTemplates: vi.fn(),
  activate: vi.fn(),
  deleteTemplate: vi.fn(),
  newDraft: vi.fn(),
}));

vi.mock('../../lib/context/AuthContext', () => ({
  useAuth: authMocks.useAuth,
}));

vi.mock('../../lib/api/checklist', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api/checklist')>('../../lib/api/checklist');
  return {
    ...actual,
    checklistApi: {
      ...actual.checklistApi,
      listTemplates: checklistApiMocks.listTemplates,
      activate: checklistApiMocks.activate,
      deleteTemplate: checklistApiMocks.deleteTemplate,
      newDraft: checklistApiMocks.newDraft,
    },
  };
});

describe('AdminChecklistPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.useAuth.mockReturnValue({
      user: {
        id: 1,
        email: 'admin@example.com',
        role: 'ADMIN',
        availableRoles: ['ADMIN'],
        roleSelectionRequired: false,
        profileComplete: true,
        emailVerified: true,
        fullName: 'Admin User',
      },
      logout: vi.fn(),
      loading: false,
    });
    checklistApiMocks.listTemplates.mockImplementation((type: 'THESIS' | 'ARTICLE') =>
      Promise.resolve(
        type === 'THESIS'
          ? [{ id: 9, publicationType: 'THESIS', version: 2, active: false, itemCount: 4 }]
          : []
      )
    );
    checklistApiMocks.activate.mockResolvedValue({ templateId: 9, active: true });
    checklistApiMocks.deleteTemplate.mockResolvedValue({ deleted: true, templateId: 9 });
    checklistApiMocks.newDraft.mockResolvedValue({ id: 10, publicationType: 'THESIS', version: 3, active: false, itemCount: 0 });
  });

  it('uses the reusable confirm dialog before activating a template', async () => {
    const user = userEvent.setup();

    renderWithProviders(<AdminChecklistPage />, '/admin/checklists');

    await waitFor(() => expect(checklistApiMocks.listTemplates).toHaveBeenCalledTimes(2));

    await user.click(screen.getByRole('button', { name: 'Activate' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('This becomes active for future reviews. Continue?')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Activate' }));

    await waitFor(() => expect(checklistApiMocks.activate).toHaveBeenCalledWith(9));
  });
});
