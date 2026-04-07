import { ApiError } from '../../lib/api/http';
import type { ChecklistEditorItem } from '../../lib/api/checklist';
import type { ChecklistTemplateResponse } from '../../lib/workflowTypes';
import type { CategoryDraft, ItemDraft, ReusableItemSuggestion } from './types';

export function newCategory(partial?: Partial<CategoryDraft>): CategoryDraft {
  return {
    id: crypto.randomUUID(),
    title: partial?.title ?? '',
    items: partial?.items ?? [],
    expanded: partial?.expanded ?? true,
    errorAddItem: partial?.errorAddItem,
    errorCategoryTitle: partial?.errorCategoryTitle,
  };
}

export function newItem(partial?: Partial<ItemDraft>): ItemDraft {
  return {
    id: crypto.randomUUID(),
    title: partial?.title ?? '',
    guidanceText: partial?.guidanceText ?? '',
    isRequired: partial?.isRequired ?? true,
    errorTitle: partial?.errorTitle,
  };
}

export function readLockFromError(error: unknown): ChecklistTemplateResponse['editLock'] {
  if (!(error instanceof ApiError) || !error.details || typeof error.details !== 'object') {
    return null;
  }

  const maybeLock = (error.details as { lock?: ChecklistTemplateResponse['editLock'] }).lock;
  return maybeLock ?? null;
}

export function categoryLabel(category: CategoryDraft, index: number): string {
  const title = category.title.trim();
  return title || `Untitled Category ${index + 1}`;
}

export function normalizeSuggestionText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function suggestionKey(item: Pick<ItemDraft, 'title' | 'guidanceText' | 'isRequired'>): string {
  return [
    normalizeSuggestionText(item.title),
    normalizeSuggestionText(item.guidanceText),
    item.isRequired ? '1' : '0',
  ].join('::');
}

export function reusableItemSuggestions(
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

export function categoriesFromTemplate(detail: ChecklistTemplateResponse): CategoryDraft[] {
  const grouped = new Map<string, CategoryDraft>();
  detail.items
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .forEach((item) => {
      const section = item.section?.trim() || 'General';
      if (!grouped.has(section)) {
        grouped.set(section, newCategory({ title: section, expanded: false }));
      }
      grouped.get(section)?.items.push(
        newItem({
          title: item.itemText,
          guidanceText: item.guidanceText ?? '',
          isRequired: item.required,
        })
      );
    });

  return Array.from(grouped.values()).map((category, index) => ({
    ...category,
    expanded: index === 0,
  }));
}

export function validateChecklistCategories(
  categories: CategoryDraft[],
): {
  categories: CategoryDraft[];
  payload: ChecklistEditorItem[] | null;
  firstFocusTarget: { kind: 'category'; categoryId: string } | { kind: 'item'; categoryId: string; itemId: string } | null;
  firstMissingCategoryId: string | null;
} {
  let hasError = false;
  const payload: ChecklistEditorItem[] = [];
  let orderIndex = 1;
  let firstFocusTarget:
    | { kind: 'category'; categoryId: string }
    | { kind: 'item'; categoryId: string; itemId: string }
    | null = null;
  let firstMissingCategoryId: string | null = null;

  const nextCategories = categories.map((category) => {
    const nextCategory = { ...category, errorCategoryTitle: undefined, errorAddItem: undefined };
    let categoryHasError = false;
    const title = category.title.trim();

    if (!title) {
      nextCategory.errorCategoryTitle = 'Please enter a category title.';
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

  return {
    categories: nextCategories,
    payload: hasError ? null : payload,
    firstFocusTarget,
    firstMissingCategoryId,
  };
}
