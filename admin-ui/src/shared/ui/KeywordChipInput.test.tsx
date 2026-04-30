import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import KeywordChipInput from './KeywordChipInput';

function KeywordChipInputHarness({
  commitOnComma,
}: {
  commitOnComma?: boolean;
}) {
  const [values, setValues] = useState<string[]>([]);

  return (
    <KeywordChipInput
      values={values}
      onChange={setValues}
      placeholder="Keywords"
      commitOnComma={commitOnComma}
    />
  );
}

describe('KeywordChipInput', () => {
  afterEach(() => {
    cleanup();
  });

  it('does not commit commas immediately when commitOnComma is false', async () => {
    const user = userEvent.setup();
    render(<KeywordChipInputHarness commitOnComma={false} />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'book,');

    expect(screen.queryByText('book')).not.toBeInTheDocument();
    expect(input).toHaveValue('book,');
  });

  it('commits and splits comma-separated keywords on Enter', async () => {
    const user = userEvent.setup();
    render(<KeywordChipInputHarness commitOnComma={false} />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'book, library, digital repository{Enter}');

    expect(screen.getByText('book')).toBeInTheDocument();
    expect(screen.getByText('library')).toBeInTheDocument();
    expect(screen.getByText('digital repository')).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('ignores duplicates and empty keyword values on commit', async () => {
    const user = userEvent.setup();
    render(<KeywordChipInputHarness commitOnComma={false} />);

    await user.type(screen.getByRole('textbox'), 'book,, library, BOOK,   digital repository{Enter}');

    expect(screen.getByText('book')).toBeInTheDocument();
    expect(screen.getByText('library')).toBeInTheDocument();
    expect(screen.getByText('digital repository')).toBeInTheDocument();
    expect(screen.getAllByText(/book/i)).toHaveLength(1);
  });

  it('commits immediately on comma by default', async () => {
    const user = userEvent.setup();
    render(<KeywordChipInputHarness />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'book,');

    expect(screen.getByText('book')).toBeInTheDocument();
    expect(input).toHaveValue('');
  });
});
