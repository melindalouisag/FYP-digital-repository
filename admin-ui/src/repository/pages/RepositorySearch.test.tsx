import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RepositorySearchPage from './RepositorySearch';
import { renderWithProviders } from '../../test/testUtils';

const authMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

const repositoryApiMocks = vi.hoisted(() => ({
  search: vi.fn(),
}));

const masterApiMocks = vi.hoisted(() => ({
  listFaculties: vi.fn(),
  listPrograms: vi.fn(),
}));

vi.mock('../../lib/context/AuthContext', () => ({
  useAuth: authMocks.useAuth,
}));

vi.mock('../../lib/api/publicRepository', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api/publicRepository')>('../../lib/api/publicRepository');
  return {
    ...actual,
    publicRepositoryApi: {
      ...actual.publicRepositoryApi,
      search: repositoryApiMocks.search,
    },
  };
});

vi.mock('../../lib/api/master', () => ({
  masterApi: masterApiMocks,
}));

describe('RepositorySearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.useAuth.mockReturnValue({
      user: null,
      logout: vi.fn(),
      loading: false,
    });
    repositoryApiMocks.search.mockResolvedValue({
      items: [],
      page: 0,
      size: 10,
      totalElements: 0,
      totalPages: 0,
      hasNext: false,
      hasPrevious: false,
    });
    masterApiMocks.listFaculties.mockResolvedValue([{ id: 1, name: 'Faculty of Engineering and Technology (FET)' }]);
    masterApiMocks.listPrograms.mockResolvedValue([]);
  });

  it('submits title filters through the repository search hook', async () => {
    const user = userEvent.setup();

    renderWithProviders(<RepositorySearchPage />);

    await waitFor(() => expect(repositoryApiMocks.search).toHaveBeenCalledTimes(1));

    await user.type(screen.getByLabelText('Title'), 'Deep Learning');
    await user.click(screen.getByRole('button', { name: /search repository/i }));

    await waitFor(() => {
      expect(repositoryApiMocks.search).toHaveBeenLastCalledWith(
        expect.objectContaining({
          title: 'Deep Learning',
          page: 0,
          size: 10,
        })
      );
    });

    expect(
      screen.queryByText('File download requires sign-in.')
    ).not.toBeInTheDocument();
  });
});
