import type { CategoryDraft } from './types';
import { reusableItemSuggestions, categoryLabel } from './utils';
import { ChecklistItemRow } from './ChecklistItemRow';

interface ChecklistCategoryCardProps {
  category: CategoryDraft;
  categories: CategoryDraft[];
  index: number;
  editingCategoryId: string | null;
  activeSuggestionItemId: string | null;
  highlightedSuggestionIndex: number;
  isReadOnly: boolean;
  onToggleCategory: (categoryId: string) => void;
  onDeleteCategory: (categoryId: string) => void;
  onRequireAllItems: (categoryId: string) => void;
  onSetEditingCategoryId: (categoryId: string | null) => void;
  onUpdateCategoryTitle: (categoryId: string, value: string) => void;
  onAddItem: (categoryId: string) => void;
  onUpdateItem: (categoryId: string, itemId: string, patch: { title?: string; guidanceText?: string; isRequired?: boolean }) => void;
  onDeleteItem: (categoryId: string, itemId: string) => void;
  onActivateSuggestionItem: (itemId: string) => void;
  onDeactivateSuggestionItem: (itemId: string) => void;
  onSetHighlightedSuggestionIndex: (index: number) => void;
  onApplySuggestion: (categoryId: string, itemId: string, suggestionKey: string) => void;
}

export function ChecklistCategoryCard({
  category,
  categories,
  index,
  editingCategoryId,
  activeSuggestionItemId,
  highlightedSuggestionIndex,
  isReadOnly,
  onToggleCategory,
  onDeleteCategory,
  onRequireAllItems,
  onSetEditingCategoryId,
  onUpdateCategoryTitle,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onActivateSuggestionItem,
  onDeactivateSuggestionItem,
  onSetHighlightedSuggestionIndex,
  onApplySuggestion,
}: ChecklistCategoryCardProps) {
  const allItemsRequired = category.items.length > 0 && category.items.every((item) => item.isRequired);

  return (
    <div className="rounded-3 border" style={{ background: '#f8fafc', borderColor: '#e8eff5' }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={category.expanded}
        className="p-3 su-checklist-card-header"
        onClick={() => onToggleCategory(category.id)}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) {
            return;
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onToggleCategory(category.id);
          }
        }}
      >
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
          <div className="flex-grow-1" style={{ minWidth: '14rem' }}>
            <div className="d-flex align-items-start gap-2">
              <span className="small text-muted pt-1">
                <ChevronIcon expanded={category.expanded} />
              </span>
              <div className="flex-grow-1">
                {category.expanded && !isReadOnly ? (
                  <input
                    id={`category-title-${category.id}`}
                    className={`su-checklist-category-input ${editingCategoryId === category.id ? 'form-control form-control-sm' : 'form-control-plaintext'}`}
                    placeholder={`Untitled Category ${index + 1}`}
                    value={category.title}
                    onFocus={() => onSetEditingCategoryId(category.id)}
                    onBlur={() => onSetEditingCategoryId(editingCategoryId === category.id ? null : editingCategoryId)}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => onUpdateCategoryTitle(category.id, event.target.value)}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        event.currentTarget.blur();
                      }
                    }}
                  />
                ) : (
                  <div className="fw-semibold su-checklist-category-label">
                    {categoryLabel(category, index)}
                  </div>
                )}
                <div className="small text-muted">
                  {category.items.length === 0
                    ? 'No checklist items yet'
                    : `${category.items.length} checklist item${category.items.length === 1 ? '' : 's'}`}
                </div>
                {category.errorCategoryTitle && (
                  <div className="text-danger small mt-1">{category.errorCategoryTitle}</div>
                )}
              </div>
            </div>
          </div>

          <div className="d-flex flex-wrap align-items-center gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              style={{ borderRadius: '999px', whiteSpace: 'nowrap' }}
              disabled={isReadOnly || category.items.length === 0 || allItemsRequired}
              onClick={(event) => {
                event.stopPropagation();
                onRequireAllItems(category.id);
              }}
            >
              Require all
            </button>
            <button
              type="button"
              className="btn btn-outline-danger btn-sm su-icon-action"
              disabled={isReadOnly}
              aria-label={`Delete ${categoryLabel(category, index)}`}
              title="Delete category"
              onClick={(event) => {
                event.stopPropagation();
                onDeleteCategory(category.id);
              }}
            >
              <TrashIcon />
            </button>
          </div>
        </div>
      </div>

      {category.expanded && (
        <div className="px-3 pb-3 border-top" style={{ borderColor: '#e8eff5' }}>
          <div className="pt-3">
            <div className="small text-muted mb-2">Checklist Items</div>

            {category.items.length === 0 && (
              <div className="border rounded p-3 mb-2">
                <div className="row g-3 align-items-end">
                  <div className="col-lg-9">
                    <div className="small text-muted">No items yet. Add an item to this category.</div>
                  </div>
                  <div className="col-lg-3">
                    <label className="form-label small">Actions</label>
                    <div className="d-flex align-items-center gap-2 mt-1">
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        style={{ borderRadius: '999px', whiteSpace: 'nowrap' }}
                        disabled={isReadOnly}
                        onClick={() => onAddItem(category.id)}
                      >
                        Add Item
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="vstack gap-2">
              {category.items.map((item, itemIndex) => {
                const isNewestItem = itemIndex === category.items.length - 1;
                const matchingSuggestions = activeSuggestionItemId === item.id
                  ? reusableItemSuggestions(categories, category.id, item.id, item.title)
                  : [];

                return (
                  <ChecklistItemRow
                    key={item.id}
                    item={item}
                    isNewestItem={isNewestItem}
                    isReadOnly={isReadOnly}
                    highlightedSuggestionIndex={highlightedSuggestionIndex}
                    matchingSuggestions={matchingSuggestions}
                    onActivateSuggestions={() => {
                      onActivateSuggestionItem(item.id);
                      onSetHighlightedSuggestionIndex(0);
                    }}
                    onDeactivateSuggestions={() => onDeactivateSuggestionItem(item.id)}
                    onSetHighlightedSuggestionIndex={onSetHighlightedSuggestionIndex}
                    onTitleChange={(value) => onUpdateItem(category.id, item.id, { title: value })}
                    onGuidanceTextChange={(value) => onUpdateItem(category.id, item.id, { guidanceText: value })}
                    onRequiredChange={(value) => onUpdateItem(category.id, item.id, { isRequired: value })}
                    onDelete={() => onDeleteItem(category.id, item.id)}
                    onAddItem={() => onAddItem(category.id)}
                    onApplySuggestion={(suggestion) => onApplySuggestion(category.id, item.id, suggestion.key)}
                  />
                );
              })}
            </div>

            {category.errorAddItem && (
              <div className="text-danger small mt-2">{category.errorAddItem}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      className="flex-shrink-0"
      style={{ width: '0.95rem', height: '0.95rem' }}
    >
      <path
        d={expanded ? 'M3.5 6 8 10.5 12.5 6' : 'M6 3.5 10.5 8 6 12.5'}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="currentColor">
      <path d="M6.5 1.75h3A1.75 1.75 0 0 1 11.25 3H14a.75.75 0 0 1 0 1.5h-.56l-.58 8.11A2 2 0 0 1 10.87 14.5H5.13a2 2 0 0 1-1.99-1.89L2.56 4.5H2a.75.75 0 0 1 0-1.5h2.75A1.75 1.75 0 0 1 6.5 1.75Zm3.25 1.25a.25.25 0 0 0-.25-.25h-3a.25.25 0 0 0-.25.25V3h3.5ZM4.64 4.5l.57 7.99a.5.5 0 0 0 .5.47h5.16a.5.5 0 0 0 .5-.47l.57-7.99Zm2 1.25c.4 0 .72.32.72.72v4.06a.72.72 0 0 1-1.44 0V6.47c0-.4.32-.72.72-.72Zm2.72.72a.72.72 0 1 0-1.44 0v4.06a.72.72 0 0 0 1.44 0Z" />
    </svg>
  );
}
