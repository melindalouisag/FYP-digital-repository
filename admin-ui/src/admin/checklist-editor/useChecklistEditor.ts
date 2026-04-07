import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { checklistApi, type ChecklistEditorItem } from '../../lib/api/checklist';
import { useConfirmDialog } from '../../lib/components/useConfirmDialog';
import type { ChecklistTemplateResponse } from '../../lib/workflowTypes';
import type { CategoryDraft, FocusTarget } from './types';
import {
  categoriesFromTemplate,
  newCategory,
  newItem,
  readLockFromError,
  categoryLabel,
  reusableItemSuggestions,
  validateChecklistCategories,
} from './utils';

export interface ChecklistEditorState {
  selectedTemplate: ChecklistTemplateResponse | null;
  categories: CategoryDraft[];
  editingCategoryId: string | null;
  activeSuggestionItemId: string | null;
  highlightedSuggestionIndex: number;
  isLoading: boolean;
  isMutating: boolean;
  error: string;
  message: string;
  hasOwnedLock: boolean;
  lockedByOther: boolean;
  isReadOnly: boolean;
  confirmDialog: ReactNode;
  navigateBack: () => void;
  releaseEditingLock: () => void;
  resumeEditing: () => void;
  createDraftToEdit: () => void;
  addCategory: () => void;
  toggleCategory: (categoryId: string) => void;
  deleteCategory: (categoryId: string) => void;
  requireAllItems: (categoryId: string) => void;
  setEditingCategoryId: (categoryId: string | null) => void;
  updateCategoryTitle: (categoryId: string, value: string) => void;
  addItem: (categoryId: string) => void;
  updateItem: (categoryId: string, itemId: string, patch: { title?: string; guidanceText?: string; isRequired?: boolean }) => void;
  deleteItem: (categoryId: string, itemId: string) => void;
  activateSuggestionItem: (itemId: string) => void;
  deactivateSuggestionItem: (itemId: string) => void;
  setHighlightedSuggestionIndex: (index: number) => void;
  applySuggestion: (categoryId: string, itemId: string, suggestionKey: string) => void;
  saveDraft: () => void;
  activateFromEditor: () => void;
}

function updateCategoryList(
  categories: CategoryDraft[],
  categoryId: string,
  update: (category: CategoryDraft) => CategoryDraft
) {
  return categories.map((category) => (
    category.id === categoryId ? update(category) : category
  ));
}

function updateCategoryItems(
  categories: CategoryDraft[],
  categoryId: string,
  update: (items: CategoryDraft['items']) => CategoryDraft['items']
) {
  return updateCategoryList(categories, categoryId, (category) => ({
    ...category,
    items: update(category.items),
  }));
}

function deleteCategoryPrompt(category: CategoryDraft, categoryIndex: number) {
  const categoryName = categoryLabel(category, categoryIndex);
  const itemCount = category.items.length;
  return itemCount > 0
    ? `Delete "${categoryName}" and its ${itemCount} checklist item${itemCount === 1 ? '' : 's'}?`
    : `Delete "${categoryName}"?`;
}

function appendItemToCategory(
  categories: CategoryDraft[],
  categoryId: string,
  createdItem: ReturnType<typeof newItem>
) {
  let addedItem = false;
  let needsCategoryTitle = false;

  const nextCategories = updateCategoryList(categories, categoryId, (category) => {
    if (!category.title.trim()) {
      needsCategoryTitle = true;
      return {
        ...category,
        expanded: true,
        errorCategoryTitle: 'Please enter a category title.',
      };
    }

    const lastItem = category.items[category.items.length - 1];
    if (lastItem && !lastItem.title.trim()) {
      return {
        ...category,
        expanded: true,
        items: category.items.map((item, index) => (
          index === category.items.length - 1
            ? { ...item, errorTitle: 'Please enter an item title before adding another.' }
            : item
        )),
      };
    }

    addedItem = true;
    return {
      ...category,
      expanded: true,
      errorCategoryTitle: undefined,
      errorAddItem: undefined,
      items: [...category.items, createdItem],
    };
  });

  return { nextCategories, addedItem, needsCategoryTitle };
}

export function useChecklistEditor(): ChecklistEditorState {
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
  const { openConfirm, confirmDialog } = useConfirmDialog();
  const lockRef = useRef({ templateId: null as number | null, ownedByCurrentUser: false });

  const clearSuggestionSelection = useCallback(() => {
    setActiveSuggestionItemId(null);
    setHighlightedSuggestionIndex(-1);
  }, []);

  useEffect(() => {
    lockRef.current = {
      templateId: selectedTemplateId,
      ownedByCurrentUser: Boolean(selectedTemplate?.editLock?.ownedByCurrentUser),
    };
  }, [selectedTemplate?.editLock?.ownedByCurrentUser, selectedTemplateId]);

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

    if (typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    target.focus();
    if (target.type !== 'checkbox') {
      target.select();
    }
    setFocusTarget(null);
  }, [categories, editingCategoryId, focusTarget]);

  const clearEditorState = useCallback((nextError = '') => {
    setSelectedTemplate(null);
    setCategories([]);
    setEditingCategoryId(null);
    clearSuggestionSelection();
    setError(nextError);
  }, [clearSuggestionSelection]);

  const loadTemplateDetail = useCallback(async (nextTemplateId: number, requestEditLock = false) => {
    const currentLock = lockRef.current;
    if (currentLock.templateId && currentLock.templateId !== nextTemplateId && currentLock.ownedByCurrentUser) {
      try {
        await checklistApi.releaseLock(currentLock.templateId);
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
      clearSuggestionSelection();
    } catch (err) {
      clearEditorState(err instanceof Error ? err.message : 'Failed to load template detail.');
    } finally {
      setIsLoading(false);
    }
  }, [clearEditorState, clearSuggestionSelection]);

  useEffect(() => {
    const nextTemplateId = Number(templateId);
    if (!templateId || !Number.isInteger(nextTemplateId) || nextTemplateId <= 0) {
      setSelectedTemplateId(null);
      clearEditorState('Template version not found.');
      setIsLoading(false);
      return;
    }

    void loadTemplateDetail(nextTemplateId, true);
  }, [clearEditorState, loadTemplateDetail, templateId]);

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
    const currentLock = lockRef.current;
    if (currentLock.templateId && currentLock.ownedByCurrentUser) {
      void checklistApi.releaseLock(currentLock.templateId);
    }
  }, []);

  const runMutation = useCallback(async (action: () => Promise<void>, successMessage: string): Promise<boolean> => {
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
  }, []);

  const createDraftToEdit = useCallback(async () => {
    if (!selectedTemplate) {
      return;
    }

    setIsMutating(true);
    setError('');
    setMessage('');

    try {
      const created = await checklistApi.newVersion(selectedTemplate.template.publicationType);
      navigate(`/admin/checklists/${created.templateId}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create checklist draft.');
    } finally {
      setIsMutating(false);
    }
  }, [navigate, selectedTemplate]);

  const addCategory = useCallback(() => {
    const created = newCategory({ expanded: true });
    setCategories((prev) => [...prev, created]);
    setEditingCategoryId(created.id);
    setFocusTarget({ kind: 'category', categoryId: created.id });
  }, []);

  const toggleCategory = useCallback((categoryId: string) => {
    const category = categories.find((item) => item.id === categoryId);
    if (!category) {
      return;
    }

    const nextExpanded = !category.expanded;
    setCategories((prev) => updateCategoryList(prev, categoryId, (item) => ({ ...item, expanded: nextExpanded })));

    if (!nextExpanded && editingCategoryId === categoryId) {
      setEditingCategoryId(null);
    }
  }, [categories, editingCategoryId]);

  const deleteCategory = useCallback((categoryId: string) => {
    const category = categories.find((item) => item.id === categoryId);
    if (!category) {
      return;
    }

    openConfirm({
      title: 'Delete Category',
      message: deleteCategoryPrompt(category, categories.indexOf(category)),
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
      onConfirm: (close) => {
        if (editingCategoryId === categoryId) {
          setEditingCategoryId(null);
        }
        setCategories((prev) => prev.filter((item) => item.id !== categoryId));
        close();
      },
    });
  }, [categories, editingCategoryId, openConfirm]);

  const requireAllItems = useCallback((categoryId: string) => {
    setCategories((prev) => updateCategoryItems(prev, categoryId, (items) => (
      items.map((item) => ({ ...item, isRequired: true }))
    )));
  }, []);

  const updateCategoryTitle = useCallback((categoryId: string, value: string) => {
    setCategories((prev) => updateCategoryList(prev, categoryId, (category) => ({
      ...category,
      title: value,
      errorCategoryTitle: value.trim() ? undefined : category.errorCategoryTitle,
    })));
  }, []);

  const addItem = useCallback((categoryId: string) => {
    const createdItem = newItem();
    let addedItem = false;
    let needsCategoryTitle = false;

    setCategories((prev) => {
      const result = appendItemToCategory(prev, categoryId, createdItem);
      addedItem = result.addedItem;
      needsCategoryTitle = result.needsCategoryTitle;
      return result.nextCategories;
    });

    if (addedItem) {
      setActiveSuggestionItemId(createdItem.id);
      setHighlightedSuggestionIndex(-1);
      setFocusTarget({ kind: 'item', categoryId, itemId: createdItem.id });
    } else if (needsCategoryTitle) {
      setEditingCategoryId(categoryId);
      setFocusTarget({ kind: 'category', categoryId });
    }
  }, []);

  const updateItem = useCallback((categoryId: string, itemId: string, patch: { title?: string; guidanceText?: string; isRequired?: boolean }) => {
    setCategories((prev) => updateCategoryItems(prev, categoryId, (items) => (
      items.map((item) => {
        if (item.id !== itemId) {
          return item;
        }
        const next = { ...item, ...patch };
        if (typeof patch.title === 'string' && patch.title.trim()) {
          next.errorTitle = undefined;
        }
        return next;
      })
    )));
  }, []);

  const deleteItem = useCallback((categoryId: string, itemId: string) => {
    if (activeSuggestionItemId === itemId) {
      clearSuggestionSelection();
    }

    setCategories((prev) => updateCategoryItems(prev, categoryId, (items) => (
      items.filter((item) => item.id !== itemId)
    )));
  }, [activeSuggestionItemId, clearSuggestionSelection]);

  const applySuggestion = useCallback((categoryId: string, itemId: string, suggestionKey: string) => {
    const item = categories
      .find((category) => category.id === categoryId)
      ?.items.find((entry) => entry.id === itemId);
    if (!item) {
      return;
    }

    const suggestion = reusableItemSuggestions(categories, categoryId, itemId, item.title)
      .find((entry) => entry.key === suggestionKey);
    if (!suggestion) {
      return;
    }

    updateItem(categoryId, itemId, {
      title: suggestion.title,
      guidanceText: suggestion.guidanceText,
      isRequired: suggestion.isRequired,
    });
    clearSuggestionSelection();
  }, [categories, clearSuggestionSelection, updateItem]);

  const validateAndBuildPayload = useCallback((): ChecklistEditorItem[] | null => {
    const validation = validateChecklistCategories(categories);
    setCategories(validation.categories);

    if (!validation.payload) {
      if (validation.firstMissingCategoryId) {
        setEditingCategoryId(validation.firstMissingCategoryId);
      }
      if (validation.firstFocusTarget) {
        setFocusTarget(validation.firstFocusTarget);
      }
      setError('Please fix checklist validation errors before saving.');
      return null;
    }

    setEditingCategoryId(null);
    return validation.payload;
  }, [categories]);

  const saveDraftInternal = useCallback(async (): Promise<boolean> => {
    if (!selectedTemplateId || !selectedTemplate) {
      return false;
    }
    if (selectedTemplate.template.active) {
      setError('Cannot edit active template; create a new draft to continue.');
      return false;
    }
    if (!selectedTemplate.editLock?.ownedByCurrentUser) {
      setError('Start editing this draft to acquire the lock.');
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
  }, [loadTemplateDetail, runMutation, selectedTemplate, selectedTemplateId, validateAndBuildPayload]);

  const activateFromEditor = useCallback(async () => {
    if (!selectedTemplateId || !selectedTemplate || selectedTemplate.template.active) {
      return;
    }

    const saved = await saveDraftInternal();
    if (!saved) {
      return;
    }

    openConfirm({
      title: 'Activate Template',
      message: 'This becomes active for future reviews. Continue?',
      confirmLabel: 'Activate',
      confirmVariant: 'success',
      onConfirm: async (close) => {
        await runMutation(async () => {
          await checklistApi.activate(selectedTemplateId);
          await loadTemplateDetail(selectedTemplateId);
        }, 'Template activated.');
        close();
      },
    });
  }, [loadTemplateDetail, openConfirm, runMutation, saveDraftInternal, selectedTemplate, selectedTemplateId]);

  const releaseEditingLock = useCallback(() => {
    if (!selectedTemplate) {
      return;
    }

    void runMutation(async () => {
      await checklistApi.releaseLock(selectedTemplate.template.id);
      await loadTemplateDetail(selectedTemplate.template.id);
    }, 'Editing lock released.');
  }, [loadTemplateDetail, runMutation, selectedTemplate]);

  const hasOwnedLock = Boolean(selectedTemplate?.editLock?.ownedByCurrentUser);
  const lockedByOther = Boolean(selectedTemplate?.editLock && !selectedTemplate.editLock.ownedByCurrentUser);
  const isReadOnly = useMemo(
    () => (selectedTemplate ? (selectedTemplate.template.active || !hasOwnedLock) : false),
    [hasOwnedLock, selectedTemplate]
  );

  return {
    selectedTemplate,
    categories,
    editingCategoryId,
    activeSuggestionItemId,
    highlightedSuggestionIndex,
    isLoading,
    isMutating,
    error,
    message,
    hasOwnedLock,
    lockedByOther,
    isReadOnly,
    confirmDialog,
    navigateBack: () => navigate('/admin/checklists'),
    releaseEditingLock,
    resumeEditing: () => {
      if (selectedTemplate) {
        void loadTemplateDetail(selectedTemplate.template.id, true);
      }
    },
    createDraftToEdit: () => void createDraftToEdit(),
    addCategory,
    toggleCategory,
    deleteCategory,
    requireAllItems,
    setEditingCategoryId,
    updateCategoryTitle,
    addItem,
    updateItem,
    deleteItem,
    activateSuggestionItem: (itemId) => {
      setActiveSuggestionItemId(itemId);
      setHighlightedSuggestionIndex(0);
    },
    deactivateSuggestionItem: (itemId) => {
      setActiveSuggestionItemId((current) => (current === itemId ? null : current));
      setHighlightedSuggestionIndex(-1);
    },
    setHighlightedSuggestionIndex,
    applySuggestion,
    saveDraft: () => {
      void saveDraftInternal();
    },
    activateFromEditor: () => {
      void activateFromEditor();
    },
  };
}
