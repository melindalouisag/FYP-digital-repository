import type { KeyboardEvent } from 'react';
import { canEditRegistration, canSubmitClearance, canUploadSubmission } from '../../lib/workflowUi';
import type { CaseStatus, CaseSummary } from '../../lib/types/workflow';

export type StudentCaseNavigationContext = 'dashboard' | 'registrations' | 'submissions';

export type StudentCaseNavigationIntent =
  | 'edit-registration'
  | 'open-submission'
  | 'open-case';

export interface StudentCaseNavigationTarget {
  intent: StudentCaseNavigationIntent;
  path: string;
  label: string;
}

const REGISTRATION_WORKSPACE_STATUSES = new Set<CaseStatus>([
  'REGISTRATION_DRAFT',
  'REGISTRATION_PENDING',
  'REGISTRATION_APPROVED',
  'REJECTED',
]);

const SUBMISSION_WORKSPACE_STATUSES = new Set<CaseStatus>([
  'REGISTRATION_VERIFIED',
  'UNDER_SUPERVISOR_REVIEW',
  'NEEDS_REVISION_SUPERVISOR',
  'READY_TO_FORWARD',
  'FORWARDED_TO_LIBRARY',
  'UNDER_LIBRARY_REVIEW',
  'NEEDS_REVISION_LIBRARY',
  'APPROVED_FOR_CLEARANCE',
  'CLEARANCE_SUBMITTED',
  'CLEARANCE_APPROVED',
  'READY_TO_PUBLISH',
]);

export function resolveStudentCaseNavigation(
  caseSummary: Pick<CaseSummary, 'id' | 'status'>,
  context: StudentCaseNavigationContext,
): StudentCaseNavigationTarget {
  if (context === 'submissions') {
    return resolveSubmissionNavigation(caseSummary);
  }

  if (context === 'registrations') {
    return resolveRegistrationNavigation(caseSummary);
  }

  return resolveDashboardNavigation(caseSummary);
}

export function isRegistrationWorkspaceCase(status: CaseStatus): boolean {
  return REGISTRATION_WORKSPACE_STATUSES.has(status);
}

export function isSubmissionWorkspaceCase(status: CaseStatus): boolean {
  return SUBMISSION_WORKSPACE_STATUSES.has(status);
}

export function sortCasesByRecentActivity(cases: CaseSummary[]): CaseSummary[] {
  return [...cases].sort(compareCaseActivity);
}

export function selectDashboardCases(cases: CaseSummary[], limit = 5): CaseSummary[] {
  const actionable = sortCasesByRecentActivity(
    cases.filter((c) => isStudentActionCase(c.status))
  );
  const recentInProgress = sortCasesByRecentActivity(
    cases.filter((c) => !isStudentActionCase(c.status) && isDashboardTrackingCase(c.status))
  );

  const uniqueCases: CaseSummary[] = [];
  const seen = new Set<number>();

  for (const item of [...actionable, ...recentInProgress]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    uniqueCases.push(item);
    if (uniqueCases.length >= limit) {
      break;
    }
  }

  return uniqueCases;
}

export function isNavigationActivationKey(event: Pick<KeyboardEvent, 'key'>): boolean {
  return event.key === 'Enter' || event.key === ' ';
}

function resolveDashboardNavigation(
  caseSummary: Pick<CaseSummary, 'id' | 'status'>,
): StudentCaseNavigationTarget {
  if (canEditRegistration(caseSummary.status)) {
    return buildTarget(
      caseSummary.id,
      'edit-registration',
      caseSummary.status === 'REJECTED' ? 'Fix registration details' : 'Continue registration',
    );
  }

  if (canUploadSubmission(caseSummary.status)) {
    return buildTarget(
      caseSummary.id,
      'open-submission',
      caseSummary.status === 'REGISTRATION_VERIFIED'
        ? 'Upload submission files'
        : 'Revise submission files',
    );
  }

  if (caseSummary.status === 'REGISTRATION_APPROVED') {
    return buildTarget(caseSummary.id, 'open-case', 'Track registration verification');
  }

  if (canSubmitClearance(caseSummary.status)) {
    return buildTarget(caseSummary.id, 'open-case', 'Continue to clearance tracking');
  }

  if (isSubmissionWorkspaceCase(caseSummary.status)) {
    return buildTarget(caseSummary.id, 'open-case', 'Track submission progress');
  }

  return buildTarget(caseSummary.id, 'open-case', 'Review case progress');
}

function resolveRegistrationNavigation(
  caseSummary: Pick<CaseSummary, 'id' | 'status'>,
): StudentCaseNavigationTarget {
  if (canEditRegistration(caseSummary.status)) {
    return buildTarget(
      caseSummary.id,
      'edit-registration',
      caseSummary.status === 'REJECTED' ? 'Fix registration details' : 'Continue registration',
    );
  }

  if (caseSummary.status === 'REGISTRATION_APPROVED') {
    return buildTarget(caseSummary.id, 'open-case', 'Track registration verification');
  }

  return buildTarget(caseSummary.id, 'open-case', 'Review registration status');
}

function resolveSubmissionNavigation(
  caseSummary: Pick<CaseSummary, 'id' | 'status'>,
): StudentCaseNavigationTarget {
  if (canUploadSubmission(caseSummary.status)) {
    return buildTarget(
      caseSummary.id,
      'open-submission',
      caseSummary.status === 'REGISTRATION_VERIFIED'
        ? 'Upload submission files'
        : 'Revise submission files',
    );
  }

  if (
    caseSummary.status === 'APPROVED_FOR_CLEARANCE' ||
    caseSummary.status === 'CLEARANCE_SUBMITTED' ||
    caseSummary.status === 'CLEARANCE_APPROVED' ||
    caseSummary.status === 'READY_TO_PUBLISH'
  ) {
    return buildTarget(caseSummary.id, 'open-case', 'Track final submission progress');
  }

  return buildTarget(caseSummary.id, 'open-case', 'Track submission review');
}

function isStudentActionCase(status: CaseStatus): boolean {
  return canEditRegistration(status) || canUploadSubmission(status) || canSubmitClearance(status);
}

function isDashboardTrackingCase(status: CaseStatus): boolean {
  return status !== 'PUBLISHED' && status !== 'READY_TO_PUBLISH';
}

function compareCaseActivity(a: CaseSummary, b: CaseSummary): number {
  const activityDiff = getCaseActivityValue(b) - getCaseActivityValue(a);
  if (activityDiff !== 0) {
    return activityDiff;
  }
  return b.id - a.id;
}

function getCaseActivityValue(caseSummary: CaseSummary): number {
  const rawValue = caseSummary.updatedAt ?? caseSummary.createdAt;
  return rawValue ? Date.parse(rawValue) || 0 : 0;
}

function buildTarget(
  caseId: number,
  intent: StudentCaseNavigationIntent,
  label: string,
): StudentCaseNavigationTarget {
  switch (intent) {
    case 'edit-registration':
      return { intent, path: `/student/registrations/${caseId}/edit`, label };
    case 'open-submission':
      return { intent, path: `/student/cases/${caseId}/submission`, label };
    case 'open-case':
      return { intent, path: `/student/cases/${caseId}`, label };
  }

  throw new Error(`Unsupported navigation intent: ${intent}`);
}
