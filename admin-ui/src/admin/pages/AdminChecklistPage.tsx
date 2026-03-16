import { useEffect, useMemo, useRef, useState } from 'react';
import ShellLayout from '../../layout/ShellLayout';
import { checklistApi, type ChecklistEditorItem, type ChecklistTemplateSummary } from '../../lib/api/checklist';
import { ApiError } from '../../lib/api/http';
import type { ChecklistTemplateResponse, PublicationType } from '../../lib/types/workflow';

type ItemDraft = {
  id: string;
  title: string;
  guidanceText: string;
  isRequired: boolean;
  errorTitle?: string;
};

type CategoryDraft = {
  id: string;
  title: string;
  items: ItemDraft[];
  expanded: boolean;
  errorCategoryTitle?: string;
  errorAddItem?: string;
};

type FocusTarget =
  | { kind: 'category'; categoryId: string }
  | { kind: 'item'; categoryId: string; itemId: string };

type TemplateMap = Record<PublicationType, ChecklistTemplateSummary[]>;

const TYPES: PublicationType[] = ['THESIS', 'ARTICLE'];

function emptyTemplates(): TemplateMap {
  return { THESIS: [], ARTICLE: [] };
}

function newCategory(partial?: Partial<CategoryDraft>): CategoryDraft {
  return {
    id: crypto.randomUUID(),
    title: partial?.title ?? '',
    items: partial?.items ?? [],
    expanded: partial?.expanded ?? true,
    errorAddItem: partial?.errorAddItem,
    errorCategoryTitle: partial?.errorCategoryTitle,
  };
}

function newItem(partial?: Partial<ItemDraft>): ItemDraft {
  return {
    id: crypto.randomUUID(),
    title: partial?.title ?? '',
    guidanceText: partial?.guidanceText ?? '',
    isRequired: partial?.isRequired ?? true,
    errorTitle: partial?.errorTitle,
  };
}

function readLockFromError(error: unknown): ChecklistTemplateResponse['editLock'] {
  if (!(error instanceof ApiError) || !error.details || typeof error.details !== 'object') {
    return null;
  }

  const maybeLock = (error.details as { lock?: ChecklistTemplateResponse['editLock'] }).lock;
  return maybeLock ?? null;
}

function categoryLabel(category: CategoryDraft, index: number): string {
  const title = category.title.trim();
  return title || `Untitled Category ${index + 1}`;
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

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
      <path d="m4 4 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function AdminChecklistPage() {
  const [templatesByType, setTemplatesByType] = useState<TemplateMap>(emptyTemplates());
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ChecklistTemplateResponse | null>(null);
  const [categories, setCategories] = useState<CategoryDraft[]>([]);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const editorRef = useRef<HTMLDivElement | null>(null);

  const activeByType = useMemo(() => ({
    THESIS: templatesByType.THESIS.find((template) => template.active) ?? null,
    ARTICLE: templatesByType.ARTICLE.find((template) => template.active) ?? null,
  }), [templatesByType]);

  useEffect(() => {
    if (!focusTarget) {
      return;
    }

    const targetId = focusTarget.kind === 'category'
      ? `category-title-${focusTarget.categoryId}`
      : `item-title-${focusTarget.itemId}`;
    const target = document.getElementById(targetId);
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.focus();
    if (target instanceof HTMLInputElement && target.type !== 'checkbox') {
      target.select();
    }
    setFocusTarget(null);
  }, [categories, editingCategoryId, focusTarget]);

  const loadTemplates = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [thesis, article] = await Promise.all([
        checklistApi.listTemplates('THESIS'),
        checklistApi.listTemplates('ARTICLE'),
      ]);
      setTemplatesByType({ THESIS: thesis, ARTICLE: article });
    } catch (err) {
      setTemplatesByType(emptyTemplates());
      setError(err instanceof Error ? err.message : 'Failed to load checklist templates.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTemplateDetail = async (templateId: number | null) => {
    if (!templateId) {
      if (selectedTemplateId && selectedTemplate?.editLock?.ownedByCurrentUser) {
        try {
          await checklistApi.releaseLock(selectedTemplateId);
        } catch {
          // Ignore release failures while clearing the editor state.
        }
      }
      setSelectedTemplateId(null);
      setSelectedTemplate(null);
      setCategories([]);
      setEditingCategoryId(null);
      setFocusTarget(null);
      return;
    }

    setIsLoading(true);
    setSelectedTemplateId(templateId);
    try {
      const detail = await checklistApi.getTemplate(templateId);
      setSelectedTemplate(detail);

      const grouped = new Map<string, CategoryDraft>();
      detail.items
        .slice()
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .forEach((item) => {
          const section = (item.section?.trim() || 'General');
          if (!grouped.has(section)) {
            grouped.set(section, newCategory({ title: section, expanded: false }));
          }
          grouped.get(section)?.items.push(newItem({
            title: item.itemText,
            guidanceText: item.guidanceText ?? '',
            isRequired: item.required,
          }));
        });

      const nextCategories = Array.from(grouped.values()).map((category, index) => ({
        ...category,
        expanded: index === 0,
      }));
      setCategories(nextCategories);
      setEditingCategoryId(null);
    } catch (err) {
      setSelectedTemplate(null);
      setCategories([]);
      setEditingCategoryId(null);
      setError(err instanceof Error ? err.message : 'Failed to load template detail.');
    } finally {
      setIsLoading(false);
    }
  };

  const openTemplate = async (template: ChecklistTemplateSummary, requestEditLock = !template.active) => {
    if (selectedTemplateId && selectedTemplateId !== template.id && selectedTemplate?.editLock?.ownedByCurrentUser) {
      try {
        await checklistApi.releaseLock(selectedTemplateId);
      } catch {
        // Ignore release failures during navigation between drafts.
      }
    }

    setError('');
    if (requestEditLock) {
      try {
        await checklistApi.acquireLock(template.id);
      } catch (err) {
        const lock = readLockFromError(err);
        if (lock) {
          setError(err instanceof Error ? err.message : 'This draft is currently locked.');
        }
      }
    }

    await loadTemplateDetail(template.id);
  };

  useEffect(() => {
    void loadTemplates();
  }, []);

  useEffect(() => {
    if (!selectedTemplateId || !selectedTemplate?.editLock?.ownedByCurrentUser || selectedTemplate.template.active) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void checklistApi.acquireLock(selectedTemplateId)
        .then((response) => {
          setSelectedTemplate((prev) => (
            prev
              ? { ...prev, editLock: response.lock ?? null }
              : prev
          ));
        })
        .catch(() => {
          // The next explicit action will surface the lock error.
        });
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, [selectedTemplate?.editLock?.ownedByCurrentUser, selectedTemplate?.template.active, selectedTemplateId]);

  useEffect(() => () => {
    if (selectedTemplateId && selectedTemplate?.editLock?.ownedByCurrentUser) {
      void checklistApi.releaseLock(selectedTemplateId);
    }
  }, [selectedTemplate?.editLock?.ownedByCurrentUser, selectedTemplateId]);

  const focusEditor = () => {
    if (!editorRef.current) return;
    editorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const firstInput = editorRef.current.querySelector('input');
    if (firstInput instanceof HTMLInputElement) {
      firstInput.focus();
    }
  };

  const runMutation = async (action: () => Promise<void>, successMessage: string): Promise<boolean> => {
    setIsMutating(true);
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(successMessage);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checklist action failed.');
      return false;
    } finally {
      setIsMutating(false);
    }
  };

  const createTemplate = (type: PublicationType) =>
    runMutation(async () => {
      const created = await checklistApi.newDraft(type);
      await loadTemplates();
      await openTemplate(created, true);
      focusEditor();
    }, `${type} template draft created.`);

  const createDraftToEdit = async () => {
    if (!selectedTemplate) return;
    const type = selectedTemplate.template.publicationType;
    await runMutation(async () => {
      const created = await checklistApi.newVersion(type);
      await loadTemplates();
      const draft = {
        id: created.templateId,
        publicationType: type,
        version: created.version,
        active: false,
        createdAt: undefined,
        itemCount: 0,
      };
      await openTemplate(draft, true);
      focusEditor();
    }, `${type} template draft created.`);
  };

  const addCategory = () => {
    const created = newCategory({ expanded: true });
    setCategories((prev) => [...prev, created]);
    setEditingCategoryId(created.id);
    setFocusTarget({ kind: 'category', categoryId: created.id });
  };

  const toggleCategory = (categoryId: string) => {
    const category = categories.find((item) => item.id === categoryId);
    if (!category) {
      return;
    }

    const nextExpanded = !category.expanded;
    setCategories((prev) =>
      prev.map((item) => (
        item.id === categoryId
          ? { ...item, expanded: nextExpanded }
          : item
      ))
    );

    if (!nextExpanded && editingCategoryId === categoryId) {
      setEditingCategoryId(null);
    }
  };

  const deleteCategory = (categoryId: string) => {
    const category = categories.find((item) => item.id === categoryId);
    if (!category) {
      return;
    }

    const prompt = category.items.length > 0
      ? `Delete "${categoryLabel(category, categories.indexOf(category))}" and its ${category.items.length} checklist item${category.items.length === 1 ? '' : 's'}?`
      : `Delete "${categoryLabel(category, categories.indexOf(category))}"?`;
    if (!window.confirm(prompt)) {
      return;
    }

    if (editingCategoryId === categoryId) {
      setEditingCategoryId(null);
    }
    setCategories((prev) => prev.filter((item) => item.id !== categoryId));
  };

  const updateCategoryTitle = (categoryId: string, value: string) => {
    setCategories((prev) =>
      prev.map((category) => {
        if (category.id !== categoryId) return category;
        return {
          ...category,
          title: value,
          errorCategoryTitle: value.trim() ? undefined : category.errorCategoryTitle,
        };
      })
    );
  };

  const addItem = (categoryId: string) => {
    const createdItem = newItem();
    let addedItem = false;
    let needsCategoryTitle = false;
    setCategories((prev) =>
      prev.map((category) => {
        if (category.id !== categoryId) return category;

        if (!category.title.trim()) {
          needsCategoryTitle = true;
          return {
            ...category,
            expanded: true,
            errorCategoryTitle: 'Please enter a category title first.',
          };
        }

        if (category.items.length > 0) {
          const lastIndex = category.items.length - 1;
          const lastItem = category.items[lastIndex];
          if (!lastItem.title.trim()) {
            const updatedItems = category.items.map((item, idx) =>
              idx === lastIndex ? { ...item, errorTitle: 'Please enter an item title before adding another.' } : item
            );
            return {
              ...category,
              expanded: true,
              items: updatedItems,
            };
          }
        }

        addedItem = true;
        return {
          ...category,
          expanded: true,
          errorCategoryTitle: undefined,
          errorAddItem: undefined,
          items: [...category.items, createdItem],
        };
      })
    );

    if (addedItem) {
      setFocusTarget({ kind: 'item', categoryId, itemId: createdItem.id });
    } else if (needsCategoryTitle) {
      setEditingCategoryId(categoryId);
      setFocusTarget({ kind: 'category', categoryId });
    }
  };

  const updateItem = (categoryId: string, itemId: string, patch: Partial<ItemDraft>) => {
    setCategories((prev) =>
      prev.map((category) => {
        if (category.id !== categoryId) return category;
        return {
          ...category,
          items: category.items.map((item) => {
            if (item.id !== itemId) return item;
            const next = { ...item, ...patch };
            if (typeof patch.title === 'string' && patch.title.trim()) {
              next.errorTitle = undefined;
            }
            return next;
          }),
        };
      })
    );
  };

  const deleteItem = (categoryId: string, itemId: string) => {
    setCategories((prev) =>
      prev.map((category) =>
        category.id === categoryId
          ? { ...category, items: category.items.filter((item) => item.id !== itemId) }
          : category
      )
    );
  };

  const validateAndBuildPayload = (): ChecklistEditorItem[] | null => {
    let hasError = false;
    const payload: ChecklistEditorItem[] = [];
    let orderIndex = 1;
    let firstFocusTarget: FocusTarget | null = null;
    let firstMissingCategoryId: string | null = null;

    const nextCategories = categories.map((category) => {
      const nextCategory = { ...category, errorCategoryTitle: undefined, errorAddItem: undefined };
      let categoryHasError = false;
      const title = category.title.trim();
      if (!title) {
        nextCategory.errorCategoryTitle = 'Please enter a category title first.';
        hasError = true;
        categoryHasError = true;
        if (!firstFocusTarget) {
          firstFocusTarget = { kind: 'category', categoryId: category.id };
        }
        if (!firstMissingCategoryId) {
          firstMissingCategoryId = category.id;
        }
      }
      if (category.items.length === 0) {
        nextCategory.errorAddItem = 'Each category must have at least 1 item.';
        hasError = true;
        categoryHasError = true;
      }

      nextCategory.items = category.items.map((item) => {
        const nextItem = { ...item, errorTitle: undefined };
        if (!item.title.trim()) {
          nextItem.errorTitle = 'Item title is required.';
          hasError = true;
          categoryHasError = true;
          if (!firstFocusTarget) {
            firstFocusTarget = { kind: 'item', categoryId: category.id, itemId: item.id };
          }
        } else if (title) {
          payload.push({
            orderIndex: orderIndex++,
            section: title,
            itemText: item.title.trim(),
            guidanceText: item.guidanceText.trim() || undefined,
            isRequired: item.isRequired,
          });
        }
        return nextItem;
      });

      nextCategory.expanded = category.expanded || categoryHasError;

      return nextCategory;
    });

    setCategories(nextCategories);

    if (hasError) {
      if (firstMissingCategoryId) {
        setEditingCategoryId(firstMissingCategoryId);
      }
      if (firstFocusTarget) {
        setFocusTarget(firstFocusTarget);
      }
      setError('Please fix checklist validation errors before saving.');
      return null;
    }

    setEditingCategoryId(null);
    return payload;
  };

  const saveDraft = async (): Promise<boolean> => {
    if (!selectedTemplateId || !selectedTemplate) return false;
    if (selectedTemplate.template.active) {
      setError('Cannot edit active template; create a new draft first.');
      return false;
    }
    if (!selectedTemplate.editLock?.ownedByCurrentUser) {
      setError('Start editing this draft first to acquire the lock.');
      return false;
    }

    const payload = validateAndBuildPayload();
    if (!payload) {
      return false;
    }

    return runMutation(async () => {
      await checklistApi.saveItems(selectedTemplateId, payload);
      await loadTemplateDetail(selectedTemplateId);
      await loadTemplates();
    }, 'Draft checklist items saved. Editing lock released.');
  };

  const activateTemplateFromTable = (templateId: number) => {
    if (!window.confirm('This becomes active for future reviews. Continue?')) {
      return;
    }
    void runMutation(async () => {
      await checklistApi.activate(templateId);
      await loadTemplates();
      if (selectedTemplateId) {
        await loadTemplateDetail(selectedTemplateId);
      }
    }, 'Template activated.');
  };

  const activateFromEditor = async () => {
    if (!selectedTemplateId || !selectedTemplate || selectedTemplate.template.active) return;
    const saved = await saveDraft();
    if (!saved) {
      return;
    }
    if (!window.confirm('This becomes active for future reviews. Continue?')) {
      return;
    }
    void runMutation(async () => {
      await checklistApi.activate(selectedTemplateId);
      await loadTemplates();
      await loadTemplateDetail(selectedTemplateId);
    }, 'Template activated.');
  };

  const deleteTemplate = async (templateId: number) => {
    const template = templatesByType.THESIS.find((t) => t.id === templateId)
      ?? templatesByType.ARTICLE.find((t) => t.id === templateId);
    const prompt = template?.active
      ? 'Delete this ACTIVE template? This cannot be undone.'
      : 'Delete this draft template version? This cannot be undone.';
    if (!window.confirm(prompt)) {
      return;
    }

    void runMutation(async () => {
      await checklistApi.deleteTemplate(templateId);
      if (selectedTemplateId === templateId) {
        await loadTemplateDetail(null);
      }
      await loadTemplates();
    }, 'Template version deleted.');
  };

  const hasOwnedLock = Boolean(selectedTemplate?.editLock?.ownedByCurrentUser);
  const lockedByOther = Boolean(selectedTemplate?.editLock && !selectedTemplate.editLock.ownedByCurrentUser);
  const isReadOnly = selectedTemplate ? (selectedTemplate.template.active || !hasOwnedLock) : false;

  return (
    <ShellLayout title="Templates" subtitle="Create draft versions, edit items safely, then activate">
      {isLoading && (
        <div className="text-center py-5">
          <div className="su-spinner mx-auto mb-3" />
          <div className="text-muted">Loading checklist templates...</div>
        </div>
      )}
      {error && <div className="alert alert-danger d-flex align-items-center gap-2" style={{ borderRadius: '0.75rem' }}><span>⚠️</span> {error}</div>}
      {message && <div className="alert alert-success d-flex align-items-center gap-2" style={{ borderRadius: '0.75rem' }}><span>✅</span> {message}</div>}

      {TYPES.map((type) => (
        <div className="su-card mb-3" key={type}>
          <div className="card-body p-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <div>
                <h3 className="h6 mb-1">{type}</h3>
                <div className="small text-muted">
                  {activeByType[type] ? `Active: V${activeByType[type]?.version}` : 'No active template'}
                </div>
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-primary btn-sm" style={{ borderRadius: '999px' }} disabled={isMutating} onClick={() => void createTemplate(type)}>
                  ➕ Create Template
                </button>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>Version</th>
                    <th>Status</th>
                    <th>Items</th>
                    <th>Created</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {templatesByType[type].map((template) => (
                    <tr key={template.id}>
                      <td>V{template.version}</td>
                      <td><span className={`badge ${template.active ? 'bg-success' : 'bg-secondary'}`} style={{ borderRadius: '999px' }}>{template.active ? '✅ ACTIVE' : 'DRAFT'}</span></td>
                      <td>{template.itemCount}</td>
                      <td>{template.createdAt ? new Date(template.createdAt).toLocaleString() : 'N/A'}</td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-primary" onClick={() => void openTemplate(template, !template.active)}>
                            {template.active ? 'View Items' : 'Edit Items'}
                          </button>
                          <button className="btn btn-danger" onClick={() => void deleteTemplate(template.id)} disabled={isMutating}>
                            Delete
                          </button>
                          {!template.active && (
                            <button className="btn btn-success" onClick={() => activateTemplateFromTable(template.id)} disabled={isMutating}>
                              Activate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {templatesByType[type].length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-muted">No template yet. Use "Create Template" above.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}

      {selectedTemplate && (
        <div className="su-card fade-in" ref={editorRef}>
          <div className="card-body p-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <h3 className="h6 mb-0">
                Editing {selectedTemplate.template.publicationType} V{selectedTemplate.template.version}{' '}
                {selectedTemplate.template.active && <span className="badge bg-success ms-1">ACTIVE</span>}
                {!selectedTemplate.template.active && <span className="badge bg-secondary ms-1">DRAFT</span>}
              </h3>
              <div className="d-flex flex-wrap gap-2">
                {!selectedTemplate.template.active && hasOwnedLock && (
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    style={{ borderRadius: '999px' }}
                    disabled={isMutating}
                    onClick={() => void runMutation(async () => {
                      await checklistApi.releaseLock(selectedTemplate.template.id);
                      await loadTemplateDetail(selectedTemplate.template.id);
                    }, 'Editing lock released.')}
                  >
                    Cancel Editing
                  </button>
                )}
                {!selectedTemplate.template.active && !hasOwnedLock && !lockedByOther && (
                  <button
                    className="btn btn-outline-primary btn-sm"
                    style={{ borderRadius: '999px' }}
                    disabled={isMutating}
                    onClick={() => void openTemplate({
                      id: selectedTemplate.template.id,
                      publicationType: selectedTemplate.template.publicationType,
                      version: selectedTemplate.template.version,
                      active: selectedTemplate.template.active,
                      createdAt: selectedTemplate.template.createdAt,
                      itemCount: selectedTemplate.items.length,
                    }, true)}
                  >
                    Resume Editing
                  </button>
                )}
              </div>
            </div>

            {selectedTemplate.template.active && (
              <div className="alert alert-warning d-flex flex-wrap align-items-center justify-content-between gap-2 py-2">
                <div>Active templates are read-only.</div>
                <button className="btn btn-outline-primary btn-sm" disabled={isMutating} onClick={() => void createDraftToEdit()}>
                  Create Draft to Edit
                </button>
              </div>
            )}

            {!selectedTemplate.template.active && lockedByOther && (
              <div className="alert alert-danger py-2">
                This draft is currently being edited by {selectedTemplate.editLock?.lockedByEmail}.
                {selectedTemplate.editLock?.expiresAt && (
                  <> The lock expires at {new Date(selectedTemplate.editLock.expiresAt).toLocaleTimeString()}.</>
                )}
              </div>
            )}

            {!selectedTemplate.template.active && !lockedByOther && !hasOwnedLock && (
              <div className="alert alert-info py-2">
                This draft is visible to all library admins. Click &quot;Resume Editing&quot; to acquire the exclusive edit lock before making changes.
              </div>
            )}

            <div className="mb-3">
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                style={{ borderRadius: '999px' }}
                disabled={isReadOnly}
                onClick={addCategory}
              >
                ➕ Add Category
              </button>
            </div>

            <div className="vstack gap-3">
              {categories.length === 0 && (
                <div
                  className="rounded-3 border p-4 text-center text-muted"
                  style={{ background: '#f8fafc', borderColor: '#e8eff5' }}
                >
                  No categories yet. Add a category above to start this draft.
                </div>
              )}

              {categories.map((category, index) => (
                <div
                  className="rounded-3 border"
                  style={{ background: '#f8fafc', borderColor: '#e8eff5' }}
                  key={category.id}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={category.expanded}
                    className="p-3 su-checklist-card-header"
                    onClick={() => toggleCategory(category.id)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) {
                        return;
                      }
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggleCategory(category.id);
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
                                onFocus={() => setEditingCategoryId(category.id)}
                                onBlur={() => setEditingCategoryId((current) => (current === category.id ? null : current))}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => updateCategoryTitle(category.id, event.target.value)}
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

                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm su-icon-action"
                        disabled={isReadOnly}
                        aria-label={`Delete ${categoryLabel(category, index)}`}
                        title="Delete category"
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteCategory(category.id);
                        }}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>

                  {category.expanded && (
                    <div className="px-3 pb-3 border-top" style={{ borderColor: '#e8eff5' }}>
                      <div className="pt-3">
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                          <div className="small text-muted">Checklist Items</div>
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm"
                            style={{ borderRadius: '999px' }}
                            disabled={isReadOnly}
                            onClick={() => addItem(category.id)}
                          >
                            Add Item
                          </button>
                        </div>

                        {category.items.length === 0 && (
                          <div className="small text-muted mb-2">No items yet.</div>
                        )}

                        <div className="vstack gap-2">
                          {category.items.map((item) => (
                            <div className="border rounded p-3" key={item.id}>
                              <div className="d-flex justify-content-end mb-2">
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary btn-sm su-icon-action su-icon-action-close"
                                  disabled={isReadOnly}
                                  aria-label="Delete item"
                                  title="Delete item"
                                  onClick={() => deleteItem(category.id, item.id)}
                                >
                                  <CloseIcon />
                                </button>
                              </div>
                              <div className="row g-2">
                                <div className="col-md-5">
                                  <label className="form-label small" htmlFor={`item-title-${item.id}`}>Item Title</label>
                                  <input
                                    id={`item-title-${item.id}`}
                                    className="form-control form-control-sm"
                                    value={item.title}
                                    disabled={isReadOnly}
                                    onChange={(event) => updateItem(category.id, item.id, { title: event.target.value })}
                                  />
                                  {item.errorTitle && <div className="text-danger small mt-1">{item.errorTitle}</div>}
                                </div>
                                <div className="col-md-5">
                                  <label className="form-label small">Guidance (optional)</label>
                                  <input
                                    className="form-control form-control-sm"
                                    value={item.guidanceText}
                                    disabled={isReadOnly}
                                    onChange={(event) => updateItem(category.id, item.id, { guidanceText: event.target.value })}
                                  />
                                </div>
                                <div className="col-md-2">
                                  <label className="form-label small">Required</label>
                                  <div className="form-check mt-1">
                                    <input
                                      type="checkbox"
                                      className="form-check-input"
                                      checked={item.isRequired}
                                      disabled={isReadOnly}
                                      onChange={(event) => updateItem(category.id, item.id, { isRequired: event.target.checked })}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {category.errorAddItem && (
                          <div className="text-danger small mt-2">{category.errorAddItem}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 d-flex flex-wrap gap-2">
              <button className="btn btn-primary" style={{ borderRadius: '999px', padding: '0.5rem 1.5rem' }} disabled={isMutating || isReadOnly} onClick={() => void saveDraft()}>
                💾 Save Draft
              </button>
              {!isReadOnly && (
                <button className="btn btn-success" style={{ borderRadius: '999px', padding: '0.5rem 1.5rem' }} disabled={isMutating} onClick={() => void activateFromEditor()}>
                  🚀 Activate
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </ShellLayout>
  );
}
