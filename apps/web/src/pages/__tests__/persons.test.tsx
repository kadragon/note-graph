import userEvent from '@testing-library/user-event';
import { usePersons } from '@web/hooks/use-persons';
import { createPerson, resetFactoryCounter } from '@web/test/factories';
import { render, screen } from '@web/test/setup';
import { useSearchParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Persons from '../persons';

vi.mock('@web/hooks/use-persons', () => ({
  usePersons: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useSearchParams: vi.fn(),
  };
});

vi.mock('../persons/components/person-dialog', () => ({
  PersonDialog: ({ open }: { open: boolean }) => (
    <div data-testid="person-dialog" data-open={open ? 'true' : 'false'} />
  ),
}));

vi.mock('../persons/components/person-import-dialog', () => ({
  PersonImportDialog: ({ open }: { open: boolean }) => (
    <div data-testid="person-import-dialog" data-open={open ? 'true' : 'false'} />
  ),
}));

describe('persons page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
    vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams(), vi.fn()]);
  });

  it('shows empty state when there are no persons', () => {
    vi.mocked(usePersons).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof usePersons>);

    render(<Persons />);

    expect(screen.getByText('등록된 사람이 없습니다.')).toBeInTheDocument();
  });

  it('filters by department and clears the filter', async () => {
    const setSearchParams = vi.fn();
    vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams('dept=개발'), setSearchParams]);

    const persons = [
      createPerson({ name: '김개발', currentDept: '개발', personId: '111111' }),
      createPerson({ name: '박디자인', currentDept: '디자인', personId: '222222' }),
    ];
    vi.mocked(usePersons).mockReturnValue({
      data: persons,
      isLoading: false,
    } as unknown as ReturnType<typeof usePersons>);

    const user = userEvent.setup();
    render(<Persons />);

    expect(screen.getByText('김개발')).toBeInTheDocument();
    expect(screen.queryByText('박디자인')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '필터 해제' }));
    expect(setSearchParams).toHaveBeenCalledWith({});
  });

  it('truncates long role descriptions in the table', () => {
    vi.mocked(usePersons).mockReturnValue({
      data: [
        createPerson({
          name: '김개발',
          currentDept: '개발',
          personId: '111111',
          currentRoleDesc: '12345678901234567890가나다',
        }),
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof usePersons>);

    render(<Persons />);

    expect(screen.getByText('12345678901234567890...')).toBeInTheDocument();
    expect(screen.queryByText('12345678901234567890가나다')).not.toBeInTheDocument();
  });
});
