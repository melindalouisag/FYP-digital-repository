import { useCallback, useEffect, useMemo, useState } from 'react';
import { studentApi } from '../../lib/api/student';
import type { CaseStatus, CaseSummary } from '../../lib/workflowTypes';
import {
  canSubmitClearance,
  canSubmitRegistration,
  canUploadSubmission,
  formatStageName,
  getStageKey,
  getWorkflowProgressPercent,
  isActiveWorkflowCase,
} from '../../lib/workflowUi';

export interface UseStudentDashboardResult {
  cases: CaseSummary[];
  loading: boolean;
  error: string;
  orderedCases: CaseSummary[];
  nextStepCases: CaseSummary[];
  progressPercent: number;
  progressSummary: string;
}

export function useStudentDashboard(): UseStudentDashboardResult {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setCases(await studentApi.listCases());
    } catch (err) {
      setCases([]);
      setError(err instanceof Error ? err.message : 'Failed to load student dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const activeCases = useMemo(
    () => cases.filter((caseSummary) => isActiveWorkflowCase(caseSummary.status)),
    [cases]
  );
  const orderedActiveCases = useMemo(
    () => sortStudentDashboardCases(activeCases),
    [activeCases]
  );
  const orderedCases = useMemo(
    () => sortStudentDashboardCases(cases),
    [cases]
  );
  const nextStepCases = useMemo(
    () => orderedActiveCases.slice(0, 2),
    [orderedActiveCases]
  );
  const furthestCase = useMemo(
    () => [...activeCases].sort(compareCaseProgress).at(0) ?? null,
    [activeCases]
  );
  const progressPercent = useMemo(() => {
    if (activeCases.length === 0) {
      return 0;
    }
    const total = activeCases.reduce((sum, caseSummary) => sum + getWorkflowProgressPercent(caseSummary.status), 0);
    return Math.round(total / activeCases.length);
  }, [activeCases]);
  const progressSummary = useMemo(() => {
    if (activeCases.length === 0) {
      return 'No active publications yet.';
    }

    const countLabel = `${activeCases.length} active publication${activeCases.length === 1 ? '' : 's'}`;
    if (!furthestCase) {
      return countLabel;
    }

    return `${countLabel} • current stage: ${formatStageName(getStageKey(furthestCase.status))}`;
  }, [activeCases.length, furthestCase]);

  return {
    cases,
    loading,
    error,
    orderedCases,
    nextStepCases,
    progressPercent,
    progressSummary,
  };
}

function sortStudentDashboardCases(cases: CaseSummary[]): CaseSummary[] {
  const actionable = sortCasesByRecentActivity(cases.filter((caseSummary) => isActionableCase(caseSummary.status)));
  const waiting = sortCasesByRecentActivity(
    cases.filter((caseSummary) => !isActionableCase(caseSummary.status) && isActiveWorkflowCase(caseSummary.status))
  );
  const completed = sortCasesByRecentActivity(
    cases.filter((caseSummary) => !isActionableCase(caseSummary.status) && !isActiveWorkflowCase(caseSummary.status))
  );

  return [...actionable, ...waiting, ...completed];
}

function sortCasesByRecentActivity(cases: CaseSummary[]): CaseSummary[] {
  return [...cases].sort((left, right) => compareTimestamps(right.updatedAt ?? right.createdAt, left.updatedAt ?? left.createdAt));
}

function compareCaseProgress(left: CaseSummary, right: CaseSummary): number {
  const progressDiff = getWorkflowProgressPercent(right.status) - getWorkflowProgressPercent(left.status);
  if (progressDiff !== 0) {
    return progressDiff;
  }
  return compareTimestamps(right.updatedAt ?? right.createdAt, left.updatedAt ?? left.createdAt);
}

function isActionableCase(status: CaseStatus): boolean {
  return canSubmitRegistration(status) || canUploadSubmission(status) || canSubmitClearance(status);
}

function compareTimestamps(left?: string, right?: string): number {
  const leftValue = left ? Date.parse(left) || 0 : 0;
  const rightValue = right ? Date.parse(right) || 0 : 0;
  return leftValue - rightValue;
}
