import ShellLayout from '../../ShellLayout';
import { ChecklistEditorCard } from '../checklist-editor/ChecklistEditorCard';
import { useChecklistEditor } from '../checklist-editor/useChecklistEditor';

export default function AdminChecklistEditorPage() {
  const editor = useChecklistEditor();

  return (
    <ShellLayout title="Template Editor" subtitle="Manage checklist categories and items for this template version">
      <div className="mb-3">
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          style={{ borderRadius: '999px' }}
          onClick={editor.navigateBack}
        >
          Back to Templates
        </button>
      </div>

      {editor.isLoading && (
        <div className="text-center py-5">
          <div className="su-spinner mx-auto mb-3" />
          <div className="text-muted">Loading checklist template...</div>
        </div>
      )}
      {editor.error && <div className="alert alert-danger" style={{ borderRadius: '0.75rem' }}>{editor.error}</div>}
      {editor.message && <div className="alert alert-success" style={{ borderRadius: '0.75rem' }}>{editor.message}</div>}

      {!editor.isLoading && !editor.selectedTemplate && (
        <div className="su-card">
          <div className="card-body p-4 text-muted">
            This template could not be loaded.
          </div>
        </div>
      )}

      {editor.selectedTemplate && (
        <ChecklistEditorCard
          template={editor.selectedTemplate}
          categories={editor.categories}
          editingCategoryId={editor.editingCategoryId}
          activeSuggestionItemId={editor.activeSuggestionItemId}
          highlightedSuggestionIndex={editor.highlightedSuggestionIndex}
          hasOwnedLock={editor.hasOwnedLock}
          lockedByOther={editor.lockedByOther}
          isReadOnly={editor.isReadOnly}
          isMutating={editor.isMutating}
          onCreateDraftToEdit={editor.createDraftToEdit}
          onReleaseEditingLock={editor.releaseEditingLock}
          onResumeEditing={editor.resumeEditing}
          onAddCategory={editor.addCategory}
          onToggleCategory={editor.toggleCategory}
          onDeleteCategory={editor.deleteCategory}
          onRequireAllItems={editor.requireAllItems}
          onSetEditingCategoryId={editor.setEditingCategoryId}
          onUpdateCategoryTitle={editor.updateCategoryTitle}
          onAddItem={editor.addItem}
          onUpdateItem={editor.updateItem}
          onDeleteItem={editor.deleteItem}
          onActivateSuggestionItem={editor.activateSuggestionItem}
          onDeactivateSuggestionItem={editor.deactivateSuggestionItem}
          onSetHighlightedSuggestionIndex={editor.setHighlightedSuggestionIndex}
          onApplySuggestion={editor.applySuggestion}
          onSaveDraft={editor.saveDraft}
          onActivateTemplate={editor.activateFromEditor}
        />
      )}
      {editor.confirmDialog}
    </ShellLayout>
  );
}
