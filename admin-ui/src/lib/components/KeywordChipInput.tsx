import { useState } from 'react';

type KeywordChipInputProps = {
  id?: string;
  values: string[];
  onChange: (nextValues: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
};

export default function KeywordChipInput({
  id,
  values,
  onChange,
  placeholder = 'Enter keywords separated by commas',
  disabled = false,
}: KeywordChipInputProps) {
  const [draft, setDraft] = useState('');

  const appendTokens = (rawValues: string[]) => {
    const nextValues = [...values];

    rawValues.forEach((rawValue) => {
      const token = rawValue.trim();
      if (!token) {
        return;
      }
      const exists = nextValues.some((value) => value.toLowerCase() === token.toLowerCase());
      if (!exists) {
        nextValues.push(token);
      }
    });

    if (nextValues.length !== values.length) {
      onChange(nextValues);
    }
  };

  const commitDraft = (rawValue: string) => {
    appendTokens(rawValue.split(','));
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
        id={id}
        className="form-control"
        value={draft}
        onChange={(event) => {
          const nextDraft = event.target.value;
          if (nextDraft.includes(',')) {
            const parts = nextDraft.split(',');
            const trailingDraft = parts.pop() ?? '';
            appendTokens(parts);
            setDraft(trailingDraft);
            return;
          }
          setDraft(nextDraft);
        }}
        onBlur={() => commitDraft(draft)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commitDraft(draft);
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
}
