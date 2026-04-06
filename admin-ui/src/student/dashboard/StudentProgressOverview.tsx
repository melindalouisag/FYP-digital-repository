import { useMemo, useState } from 'react';
import { getPublicationTypeLabel } from '../../calendar/calendarUtils';
import DashboardProgressRingCard from '../../lib/components/DashboardProgressRingCard';
import type { CaseSummary } from '../../lib/workflowTypes';
import {
  formatStatus,
  getWorkflowProgressPercent,
  isActiveWorkflowCase,
} from '../../lib/workflowUi';

interface StudentProgressOverviewProps {
  loading: boolean;
  orderedCases: CaseSummary[];
}

export function StudentProgressOverview({
  loading,
  orderedCases,
}: StudentProgressOverviewProps) {
  const [selectedType, setSelectedType] = useState<CaseSummary['type'] | ''>('');
  const availableTypes = useMemo(
    () => orderedCases.reduce<CaseSummary['type'][]>((types, item) => (
      types.includes(item.type) ? types : [...types, item.type]
    ), []),
    [orderedCases]
  );
  const activeType = useMemo(() => {
    if (selectedType && availableTypes.includes(selectedType)) {
      return selectedType;
    }
    return availableTypes[0] ?? '';
  }, [availableTypes, selectedType]);
  const casesForType = useMemo(
    () => orderedCases.filter((item) => item.type === activeType),
    [activeType, orderedCases]
  );
  const selectedCase = useMemo(
    () => casesForType.find((item) => isActiveWorkflowCase(item.status)) ?? casesForType[0] ?? null,
    [casesForType]
  );
  const typeSelector = availableTypes.length > 0 ? (
    <label className="su-progress-ring-select-wrap">
      <span className="visually-hidden">Publication type</span>
      <select
        className="form-select form-select-sm su-progress-ring-select"
        value={activeType}
        onChange={(event) => setSelectedType(event.target.value as CaseSummary['type'])}
        aria-label="Select publication type"
      >
        {availableTypes.map((type) => (
          <option key={type} value={type}>
            {getPublicationTypeLabel(type)}
          </option>
        ))}
      </select>
    </label>
  ) : null;
  const lastUpdated = selectedCase?.updatedAt ?? selectedCase?.createdAt;
  const recordCountLabel = activeType
    ? `${casesForType.length} ${casesForType.length === 1 ? 'record' : 'records'}`
    : undefined;

  return (
    <DashboardProgressRingCard
      title="Publication Progress"
      actions={typeSelector}
      progressPercent={selectedCase ? getWorkflowProgressPercent(selectedCase.status) : null}
      loading={loading}
      emptyText="No publication records yet."
      primaryText={selectedCase ? formatStatus(selectedCase.status) : undefined}
      secondaryText={selectedCase
        ? (lastUpdated
          ? `Updated ${new Date(lastUpdated).toLocaleString()}`
          : recordCountLabel)
        : undefined}
    />
  );
}
