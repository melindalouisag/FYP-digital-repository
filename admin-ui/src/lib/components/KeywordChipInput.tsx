import { useState } from 'react';

type KeywordChipInputProps = {
  values: string[];
  onChange: (nextValues: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
};

export default function KeywordChipInput({
  values,
  onChange,
  placeholder = 'Type a keyword and press Enter',
  disabled = false,
}: KeywordChipInputProps) {
  const [draft, setDraft] = useState('');

  const addToken = (rawValue: string) => {
    const token = rawValue.trim();
    if (!token) {
      return;
    }

    const exists = values.some((value) => value.toLowerCase() === token.toLowerCase());
    if (!exists) {
      onChange([...values, token]);
    }
    setDraft('');
  };

  const removeToken = (tokenToRemove: string) => {
    onChange(values.filter((value) => value !== tokenToRemove));
  };

  return (
    <div>
      {values.length > 0 && (
        <div className="d-flex flex-wrap gap-2 mb-2">
          {values.map((value) => (
            <span
              key={value}
              className="badge bg-primary-subtle text-primary-emphasis d-inline-flex align-items-center gap-2 px-3 py-2"
              style={{ borderRadius: '999px' }}
            >
              <span>{value}</span>
              <button
                type="button"
                className="btn btn-sm p-0 border-0 bg-transparent text-primary-emphasis"
                onClick={() => removeToken(value)}
                disabled={disabled}
                aria-label={`Remove ${value}`}
                style={{ lineHeight: 1 }}
              >
                x
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        className="form-control"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => addToken(draft)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            addToken(draft);
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
      />
      <div className="form-text">Press Enter to add each keyword.</div>
    </div>
  );
}
