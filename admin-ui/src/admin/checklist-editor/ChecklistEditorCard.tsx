import type { ChecklistTemplateResponse } from '../../lib/workflowTypes';
import type { CategoryDraft } from './types';
import { ChecklistTemplateHeader } from './ChecklistTemplateHeader';
import { ChecklistCategoryCard } from './ChecklistCategoryCard';

interface ChecklistEditorCardProps {
  template: ChecklistTemplateResponse;
  categories: CategoryDraft[];
  editingCategoryId: string | null;
  activeSuggestionItemId: string | null;
  highlightedSuggestionIndex: number;
  hasOwnedLock: boolean;
  lockedByOther: boolean;
  isReadOnly: boolean;
  isMutating: boolean;
  onCreateDraftToEdit: () => void;
  onReleaseEditingLock: () => void;
  onResumeEditing: () => void;
  onAddCategory: () => void;
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
  onSaveDraft: () => void;
  onActivateTemplate: () => void;
}

export function ChecklistEditorCard({
  template,
  categories,
  editingCategoryId,
  activeSuggestionItemId,
  highlightedSuggestionIndex,
  hasOwnedLock,
  lockedByOther,
  isReadOnly,
  isMutating,
  onCreateDraftToEdit,
  onReleaseEditingLock,
  onResumeEditing,
  onAddCategory,
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
  onSaveDraft,
  onActivateTemplate,
}: ChecklistEditorCardProps) {
  return (
    <div className="su-card fade-in">
      <div className="card-body p-4">
        <ChecklistTemplateHeader
          template={template}
          hasOwnedLock={hasOwnedLock}
          lockedByOther={lockedByOther}
          isMutating={isMutating}
          onCreateDraftToEdit={onCreateDraftToEdit}
          onReleaseEditingLock={onReleaseEditingLock}
          onResumeEditing={onResumeEditing}
        />

        <div className="vstack gap-3">
          {categories.length === 0 && (
            <div
              className="rounded-3 border p-4 text-center text-muted"
              style={{ background: '#f8fafc', borderColor: '#e8eff5' }}
            >
              No categories yet. Add a category below to start this draft.
            </div>
          )}

          {categories.map((category, index) => (
            <ChecklistCategoryCard
              key={category.id}
              category={category}
              categories={categories}
              index={index}
              editingCategoryId={editingCategoryId}
              activeSuggestionItemId={activeSuggestionItemId}
              highlightedSuggestionIndex={highlightedSuggestionIndex}
              isReadOnly={isReadOnly}
              onToggleCategory={onToggleCategory}
              onDeleteCategory={onDeleteCategory}
              onRequireAllItems={onRequireAllItems}
              onSetEditingCategoryId={onSetEditingCategoryId}
              onUpdateCategoryTitle={onUpdateCategoryTitle}
              onAddItem={onAddItem}
              onUpdateItem={onUpdateItem}
              onDeleteItem={onDeleteItem}
              onActivateSuggestionItem={onActivateSuggestionItem}
              onDeactivateSuggestionItem={onDeactivateSuggestionItem}
              onSetHighlightedSuggestionIndex={onSetHighlightedSuggestionIndex}
              onApplySuggestion={onApplySuggestion}
            />
          ))}

          <div>
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              style={{ borderRadius: '999px' }}
              disabled={isReadOnly}
              onClick={onAddCategory}
            >
              Add Category
            </button>
          </div>
        </div>

        <div className="mt-4 d-flex flex-wrap gap-2">
          <button
            className="btn btn-primary"
            style={{ borderRadius: '999px', padding: '0.5rem 1.5rem' }}
            disabled={isMutating || isReadOnly}
            onClick={onSaveDraft}
          >
            Save Draft
          </button>
          {!isReadOnly && (
            <button
              className="btn btn-success"
              style={{ borderRadius: '999px', padding: '0.5rem 1.5rem' }}
              disabled={isMutating}
              onClick={onActivateTemplate}
            >
              Activate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
