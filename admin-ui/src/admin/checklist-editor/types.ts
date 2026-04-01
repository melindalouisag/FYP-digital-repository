export type ItemDraft = {
  id: string;
  title: string;
  guidanceText: string;
  isRequired: boolean;
  errorTitle?: string;
};

export type CategoryDraft = {
  id: string;
  title: string;
  items: ItemDraft[];
  expanded: boolean;
  errorCategoryTitle?: string;
  errorAddItem?: string;
};

export type FocusTarget =
  | { kind: 'category'; categoryId: string }
  | { kind: 'item'; categoryId: string; itemId: string };

export type ReusableItemSuggestion = {
  key: string;
  title: string;
  guidanceText: string;
  isRequired: boolean;
  usageCount: number;
};
