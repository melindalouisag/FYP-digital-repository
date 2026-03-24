import type { KeyboardEvent } from 'react';
import { canEditRegistration, canUploadSubmission } from '../../lib/workflowUi';
import type { CaseSummary } from '../../lib/types/workflow';

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

export function resolveStudentCaseNavigation(
  caseSummary: Pick<CaseSummary, 'id' | 'status'>,
  context: StudentCaseNavigationContext,
): StudentCaseNavigationTarget {
  if (context === 'submissions') {
    return canUploadSubmission(caseSummary.status)
      ? buildTarget(caseSummary.id, 'open-submission', 'Open submission page')
      : buildTarget(caseSummary.id, 'open-case', 'Open case details');
  }

  if (canEditRegistration(caseSummary.status)) {
    return buildTarget(caseSummary.id, 'edit-registration', context === 'dashboard'
      ? 'Continue registration'
      : 'Open registration form');
  }

  if (context === 'dashboard' && canUploadSubmission(caseSummary.status)) {
    return buildTarget(caseSummary.id, 'open-submission', 'Open submission page');
  }

  return buildTarget(caseSummary.id, 'open-case', context === 'dashboard'
    ? 'Track case progress'
    : 'Open case details');
}

export function isNavigationActivationKey(event: Pick<KeyboardEvent, 'key'>): boolean {
  return event.key === 'Enter' || event.key === ' ';
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
