import type { ReusableItemSuggestion, ItemDraft } from './types';

interface ChecklistItemRowProps {
  item: ItemDraft;
  isNewestItem: boolean;
  isReadOnly: boolean;
  highlightedSuggestionIndex: number;
  matchingSuggestions: ReusableItemSuggestion[];
  onActivateSuggestions: () => void;
  onDeactivateSuggestions: () => void;
  onSetHighlightedSuggestionIndex: (index: number) => void;
  onTitleChange: (value: string) => void;
  onGuidanceTextChange: (value: string) => void;
  onRequiredChange: (value: boolean) => void;
  onDelete: () => void;
  onAddItem: () => void;
  onApplySuggestion: (suggestion: ReusableItemSuggestion) => void;
}

export function ChecklistItemRow({
  item,
  isNewestItem,
  isReadOnly,
  highlightedSuggestionIndex,
  matchingSuggestions,
  onActivateSuggestions,
  onDeactivateSuggestions,
  onSetHighlightedSuggestionIndex,
  onTitleChange,
  onGuidanceTextChange,
  onRequiredChange,
  onDelete,
  onAddItem,
  onApplySuggestion,
}: ChecklistItemRowProps) {
  const showSuggestions = !isReadOnly && matchingSuggestions.length > 0;

  return (
    <div className="border rounded p-3">
      <div className="row g-3 align-items-end">
        <div className="col-lg-5 col-md-6">
          <label className="form-label small" htmlFor={`item-title-${item.id}`}>Item Title</label>
          <div className="position-relative">
            <input
              id={`item-title-${item.id}`}
              className="form-control form-control-sm"
              value={item.title}
              autoComplete="off"
              disabled={isReadOnly}
              onFocus={onActivateSuggestions}
              onBlur={() => {
                window.setTimeout(() => {
                  onDeactivateSuggestions();
                }, 120);
              }}
              onChange={(event) => {
                onActivateSuggestions();
                onSetHighlightedSuggestionIndex(0);
                onTitleChange(event.target.value);
              }}
              onKeyDown={(event) => {
                if (!showSuggestions) {
                  if (event.key === 'Escape') {
                    onDeactivateSuggestions();
                  }
                  return;
                }

                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  onSetHighlightedSuggestionIndex(
                    highlightedSuggestionIndex >= matchingSuggestions.length - 1 ? 0 : highlightedSuggestionIndex + 1
                  );
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  onSetHighlightedSuggestionIndex(
                    highlightedSuggestionIndex <= 0 ? matchingSuggestions.length - 1 : highlightedSuggestionIndex - 1
                  );
                } else if (event.key === 'Enter') {
                  const suggestion = matchingSuggestions[highlightedSuggestionIndex] ?? matchingSuggestions[0];
                  if (!suggestion) {
                    return;
                  }
                  event.preventDefault();
                  onApplySuggestion(suggestion);
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  onDeactivateSuggestions();
                }
              }}
            />
            {showSuggestions && (
              <div className="dropdown-menu show su-item-suggestion-menu">
                {matchingSuggestions.map((suggestion, suggestionIndex) => (
                  <button
                    key={suggestion.key}
                    type="button"
                    className={`dropdown-item su-item-suggestion-option ${suggestionIndex === highlightedSuggestionIndex ? 'active' : ''}`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onApplySuggestion(suggestion);
                    }}
                    onMouseEnter={() => onSetHighlightedSuggestionIndex(suggestionIndex)}
                  >
                    <div className="fw-semibold">{suggestion.title}</div>
                    <div className="small text-muted">
                      {suggestion.guidanceText || 'No guidance text'}
                    </div>
                    <div className="d-flex justify-content-between align-items-center gap-2 mt-1">
                      <span className="badge text-bg-light border">
                        {suggestion.isRequired ? 'Required' : 'Optional'}
                      </span>
                      {suggestion.usageCount > 1 && (
                        <span className="small text-muted">Used {suggestion.usageCount}x</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {item.errorTitle && <div className="text-danger small mt-1">{item.errorTitle}</div>}
        </div>
        <div className="col-lg-4 col-md-6">
          <label className="form-label small">Guidance (optional)</label>
          <input
            className="form-control form-control-sm"
            value={item.guidanceText}
            disabled={isReadOnly}
            onChange={(event) => onGuidanceTextChange(event.target.value)}
          />
        </div>
        <div className="col-lg-3">
          <label className="form-label small">Required</label>
          <div className="d-flex flex-wrap align-items-center gap-2 mt-1">
            <div className="form-check m-0">
              <input
                type="checkbox"
                className="form-check-input"
                checked={item.isRequired}
                disabled={isReadOnly}
                onChange={(event) => onRequiredChange(event.target.checked)}
              />
            </div>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm su-icon-action su-icon-action-close"
              disabled={isReadOnly}
              aria-label="Delete item"
              title="Delete item"
              onClick={onDelete}
            >
              <CloseIcon />
            </button>
            {isNewestItem && (
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                style={{ borderRadius: '999px', whiteSpace: 'nowrap' }}
                disabled={isReadOnly}
                onClick={onAddItem}
              >
                Add Item
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
      <path d="m4 4 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
