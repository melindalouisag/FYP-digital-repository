import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ShellLayout from '../../layout/ShellLayout';
import { checklistApi, type ChecklistEditorItem } from '../../lib/api/checklist';
import { ApiError } from '../../lib/api/http';
import type { ChecklistTemplateResponse } from '../../lib/types/workflow';

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

type ReusableItemSuggestion = {
  key: string;
  title: string;
  guidanceText: string;
  isRequired: boolean;
  usageCount: number;
};

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

function normalizeSuggestionText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function suggestionKey(item: Pick<ItemDraft, 'title' | 'guidanceText' | 'isRequired'>): string {
  return [
    normalizeSuggestionText(item.title),
    normalizeSuggestionText(item.guidanceText),
    item.isRequired ? '1' : '0',
  ].join('::');
}

function reusableItemSuggestions(
  categories: CategoryDraft[],
  currentCategoryId: string,
  currentItemId: string,
  query: string,
): ReusableItemSuggestion[] {
  const normalizedQuery = normalizeSuggestionText(query);
  if (!normalizedQuery) {
    return [];
  }

  const unique = new Map<string, ReusableItemSuggestion>();

  categories.forEach((category) => {
    category.items.forEach((item) => {
      if (category.id === currentCategoryId && item.id === currentItemId) {
        return;
      }

      const title = item.title.trim();
      if (!title) {
        return;
      }

      const guidanceText = item.guidanceText.trim();
      const normalizedTitle = normalizeSuggestionText(title);
      const normalizedGuidance = normalizeSuggestionText(guidanceText);
      const matchesQuery = normalizedTitle.includes(normalizedQuery) || normalizedGuidance.includes(normalizedQuery);
      if (!matchesQuery) {
        return;
      }

      const key = suggestionKey({ title, guidanceText, isRequired: item.isRequired });
      const existing = unique.get(key);
      if (existing) {
        existing.usageCount += 1;
        return;
      }

      unique.set(key, {
        key,
        title,
        guidanceText,
        isRequired: item.isRequired,
        usageCount: 1,
      });
    });
  });

  return Array.from(unique.values())
    .sort((left, right) => {
      const leftTitle = normalizeSuggestionText(left.title);
      const rightTitle = normalizeSuggestionText(right.title);
      const leftStartsWith = leftTitle.startsWith(normalizedQuery);
      const rightStartsWith = rightTitle.startsWith(normalizedQuery);
      if (leftStartsWith !== rightStartsWith) {
        return leftStartsWith ? -1 : 1;
      }
      if (left.usageCount !== right.usageCount) {
        return right.usageCount - left.usageCount;
      }
      const byTitle = left.title.localeCompare(right.title);
      if (byTitle !== 0) {
        return byTitle;
      }
      return left.guidanceText.localeCompare(right.guidanceText);
    })
    .slice(0, 6);
}

function categoriesFromTemplate(detail: ChecklistTemplateResponse): CategoryDraft[] {
  const grouped = new Map<string, CategoryDraft>();
  detail.items
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .forEach((item) => {
      const section = item.section?.trim() || 'General';
      if (!grouped.has(section)) {
        grouped.set(section, newCategory({ title: section, expanded: false }));
      }
      grouped.get(section)?.items.push(newItem({
        title: item.itemText,
        guidanceText: item.guidanceText ?? '',
        isRequired: item.required,
      }));
    });

  return Array.from(grouped.values()).map((category, index) => ({
    ...category,
    expanded: index === 0,
  }));
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

export default function AdminChecklistEditorPage() {
  const navigate = useNavigate();
  const { templateId } = useParams();
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ChecklistTemplateResponse | null>(null);
  const [categories, setCategories] = useState<CategoryDraft[]>([]);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const [activeSuggestionItemId, setActiveSuggestionItemId] = useState<string | null>(null);
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

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
    if (target.type !== 'checkbox') {
      target.select();
    }
    setFocusTarget(null);
  }, [categories, editingCategoryId, focusTarget]);

  const loadTemplateDetail = async (nextTemplateId: number, requestEditLock = false) => {
    if (selectedTemplateId && selectedTemplateId !== nextTemplateId && selectedTemplate?.editLock?.ownedByCurrentUser) {
      try {
        await checklistApi.releaseLock(selectedTemplateId);
      } catch {
        // Ignore release failures while switching to another draft.
      }
    }

    setIsLoading(true);
    setError('');
    setSelectedTemplateId(nextTemplateId);
    try {
      let detail = await checklistApi.getTemplate(nextTemplateId);

      if (requestEditLock && !detail.template.active) {
        try {
          const response = await checklistApi.acquireLock(nextTemplateId);
          detail = { ...detail, editLock: response.lock ?? null };
        } catch (err) {
          const lock = readLockFromError(err);
          setError(err instanceof Error ? err.message : lock ? 'This draft is currently locked.' : 'Failed to acquire the edit lock.');
          try {
            detail = await checklistApi.getTemplate(nextTemplateId);
          } catch {
            // Preserve the initial template detail if the refresh fails.
          }
        }
      }

      setSelectedTemplate(detail);
      setCategories(categoriesFromTemplate(detail));
      setEditingCategoryId(null);
      setActiveSuggestionItemId(null);
      setHighlightedSuggestionIndex(-1);
    } catch (err) {
      setSelectedTemplate(null);
      setCategories([]);
      setEditingCategoryId(null);
      setActiveSuggestionItemId(null);
      setHighlightedSuggestionIndex(-1);
      setError(err instanceof Error ? err.message : 'Failed to load template detail.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const nextTemplateId = Number(templateId);
    if (!templateId || !Number.isInteger(nextTemplateId) || nextTemplateId <= 0) {
      setSelectedTemplateId(null);
      setSelectedTemplate(null);
      setCategories([]);
      setEditingCategoryId(null);
      setActiveSuggestionItemId(null);
      setHighlightedSuggestionIndex(-1);
      setError('Template version not found.');
      setIsLoading(false);
      return;
    }

    void loadTemplateDetail(nextTemplateId, true);
  }, [templateId]);

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

  const createDraftToEdit = async () => {
    if (!selectedTemplate) {
      return;
    }

    setIsMutating(true);
    setError('');
    setMessage('');

    try {
      const created = await checklistApi.newVersion(selectedTemplate.template.publicationType);
      setIsMutating(false);
      navigate(`/admin/checklists/${created.templateId}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create checklist draft.');
      setIsMutating(false);
    }
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

  const requireAllItems = (categoryId: string) => {
    setCategories((prev) =>
      prev.map((category) => {
        if (category.id !== categoryId) {
          return category;
        }
        return {
          ...category,
          items: category.items.map((item) => ({ ...item, isRequired: true })),
        };
      })
    );
  };

  const updateCategoryTitle = (categoryId: string, value: string) => {
    setCategories((prev) =>
      prev.map((category) => {
        if (category.id !== categoryId) {
          return category;
        }
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
        if (category.id !== categoryId) {
          return category;
        }

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
      setActiveSuggestionItemId(createdItem.id);
      setHighlightedSuggestionIndex(-1);
      setFocusTarget({ kind: 'item', categoryId, itemId: createdItem.id });
    } else if (needsCategoryTitle) {
      setEditingCategoryId(categoryId);
      setFocusTarget({ kind: 'category', categoryId });
    }
  };

  const updateItem = (categoryId: string, itemId: string, patch: Partial<ItemDraft>) => {
    setCategories((prev) =>
      prev.map((category) => {
        if (category.id !== categoryId) {
          return category;
        }
        return {
          ...category,
          items: category.items.map((item) => {
            if (item.id !== itemId) {
              return item;
            }
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
    if (activeSuggestionItemId === itemId) {
      setActiveSuggestionItemId(null);
      setHighlightedSuggestionIndex(-1);
    }
    setCategories((prev) =>
      prev.map((category) =>
        category.id === categoryId
          ? { ...category, items: category.items.filter((item) => item.id !== itemId) }
          : category
      )
    );
  };

  const applySuggestion = (categoryId: string, itemId: string, suggestion: ReusableItemSuggestion) => {
    updateItem(categoryId, itemId, {
      title: suggestion.title,
      guidanceText: suggestion.guidanceText,
      isRequired: suggestion.isRequired,
    });
    setActiveSuggestionItemId(null);
    setHighlightedSuggestionIndex(-1);
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
            required: item.isRequired,
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
    if (!selectedTemplateId || !selectedTemplate) {
      return false;
    }
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
    }, 'Draft checklist items saved. Editing lock released.');
  };

  const activateFromEditor = async () => {
    if (!selectedTemplateId || !selectedTemplate || selectedTemplate.template.active) {
      return;
    }
    const saved = await saveDraft();
    if (!saved) {
      return;
    }
    if (!window.confirm('This becomes active for future reviews. Continue?')) {
      return;
    }

    void runMutation(async () => {
      await checklistApi.activate(selectedTemplateId);
      await loadTemplateDetail(selectedTemplateId);
    }, 'Template activated.');
  };

  const hasOwnedLock = Boolean(selectedTemplate?.editLock?.ownedByCurrentUser);
  const lockedByOther = Boolean(selectedTemplate?.editLock && !selectedTemplate.editLock.ownedByCurrentUser);
  const isReadOnly = selectedTemplate ? (selectedTemplate.template.active || !hasOwnedLock) : false;

  return (
    <ShellLayout title="Template Editor" subtitle="Manage checklist categories and items for this template version">
      <div className="mb-3">
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          style={{ borderRadius: '999px' }}
          onClick={() => navigate('/admin/checklists')}
        >
          Back to Templates
        </button>
      </div>

      {isLoading && (
        <div className="text-center py-5">
          <div className="su-spinner mx-auto mb-3" />
          <div className="text-muted">Loading checklist template...</div>
        </div>
      )}
      {error && <div className="alert alert-danger" style={{ borderRadius: '0.75rem' }}>{error}</div>}
      {message && <div className="alert alert-success" style={{ borderRadius: '0.75rem' }}>{message}</div>}

      {!isLoading && !selectedTemplate && (
        <div className="su-card">
          <div className="card-body p-4 text-muted">
            This template could not be loaded.
          </div>
        </div>
      )}

      {selectedTemplate && (
        <div className="su-card fade-in">
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
                    onClick={() => void loadTemplateDetail(selectedTemplate.template.id, true)}
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

            <div className="vstack gap-3">
              {categories.length === 0 && (
                <div
                  className="rounded-3 border p-4 text-center text-muted"
                  style={{ background: '#f8fafc', borderColor: '#e8eff5' }}
                >
                  No categories yet. Add a category below to start this draft.
                </div>
              )}

              {categories.map((category, index) => {
                const allItemsRequired = category.items.length > 0 && category.items.every((item) => item.isRequired);
                return (
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

                      <div className="d-flex flex-wrap align-items-center gap-2">
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          style={{ borderRadius: '999px', whiteSpace: 'nowrap' }}
                          disabled={isReadOnly || category.items.length === 0 || allItemsRequired}
                          onClick={(event) => {
                            event.stopPropagation();
                            requireAllItems(category.id);
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
                            deleteCategory(category.id);
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
                                <div className="small text-muted">No items yet. Add the first item for this category.</div>
                              </div>
                              <div className="col-lg-3">
                                <label className="form-label small">Actions</label>
                                <div className="d-flex align-items-center gap-2 mt-1">
                                  <button
                                    type="button"
                                    className="btn btn-outline-primary btn-sm"
                                    style={{ borderRadius: '999px', whiteSpace: 'nowrap' }}
                                    disabled={isReadOnly}
                                    onClick={() => addItem(category.id)}
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
                            const showSuggestions = !isReadOnly && matchingSuggestions.length > 0;
                            return (
                              <div className="border rounded p-3" key={item.id}>
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
                                        onFocus={() => {
                                          setActiveSuggestionItemId(item.id);
                                          setHighlightedSuggestionIndex(0);
                                        }}
                                        onBlur={() => {
                                          window.setTimeout(() => {
                                            setActiveSuggestionItemId((current) => (current === item.id ? null : current));
                                            setHighlightedSuggestionIndex(-1);
                                          }, 120);
                                        }}
                                        onChange={(event) => {
                                          setActiveSuggestionItemId(item.id);
                                          setHighlightedSuggestionIndex(0);
                                          updateItem(category.id, item.id, { title: event.target.value });
                                        }}
                                        onKeyDown={(event) => {
                                          if (!showSuggestions) {
                                            if (event.key === 'Escape') {
                                              setActiveSuggestionItemId(null);
                                              setHighlightedSuggestionIndex(-1);
                                            }
                                            return;
                                          }

                                          if (event.key === 'ArrowDown') {
                                            event.preventDefault();
                                            setHighlightedSuggestionIndex((current) => (
                                              current >= matchingSuggestions.length - 1 ? 0 : current + 1
                                            ));
                                          } else if (event.key === 'ArrowUp') {
                                            event.preventDefault();
                                            setHighlightedSuggestionIndex((current) => (
                                              current <= 0 ? matchingSuggestions.length - 1 : current - 1
                                            ));
                                          } else if (event.key === 'Enter') {
                                            const suggestion = matchingSuggestions[highlightedSuggestionIndex] ?? matchingSuggestions[0];
                                            if (!suggestion) {
                                              return;
                                            }
                                            event.preventDefault();
                                            applySuggestion(category.id, item.id, suggestion);
                                          } else if (event.key === 'Escape') {
                                            event.preventDefault();
                                            setActiveSuggestionItemId(null);
                                            setHighlightedSuggestionIndex(-1);
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
                                                applySuggestion(category.id, item.id, suggestion);
                                              }}
                                              onMouseEnter={() => setHighlightedSuggestionIndex(suggestionIndex)}
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
                                      onChange={(event) => updateItem(category.id, item.id, { guidanceText: event.target.value })}
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
                                          onChange={(event) => updateItem(category.id, item.id, { isRequired: event.target.checked })}
                                        />
                                      </div>
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
                                      {isNewestItem && (
                                        <button
                                          type="button"
                                          className="btn btn-outline-primary btn-sm"
                                          style={{ borderRadius: '999px', whiteSpace: 'nowrap' }}
                                          disabled={isReadOnly}
                                          onClick={() => addItem(category.id)}
                                        >
                                          Add Item
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
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
              })}

              <div>
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  style={{ borderRadius: '999px' }}
                  disabled={isReadOnly}
                  onClick={addCategory}
                >
                  Add Category
                </button>
              </div>
            </div>

            <div className="mt-4 d-flex flex-wrap gap-2">
              <button className="btn btn-primary" style={{ borderRadius: '999px', padding: '0.5rem 1.5rem' }} disabled={isMutating || isReadOnly} onClick={() => void saveDraft()}>
                Save Draft
              </button>
              {!isReadOnly && (
                <button className="btn btn-success" style={{ borderRadius: '999px', padding: '0.5rem 1.5rem' }} disabled={isMutating} onClick={() => void activateFromEditor()}>
                  Activate
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </ShellLayout>
  );
}
