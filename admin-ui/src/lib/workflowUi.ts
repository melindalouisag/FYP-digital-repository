import type { CaseStatus } from './types/workflow';

export type WorkflowStageKey =
  | 'registration'
  | 'supervisor'
  | 'library'
  | 'clearance'
  | 'publish'
  | 'rejected';

export interface WorkflowStatusPresentation {
  label: string;
  description: string;
  nextAction: string;
  tone: 'neutral' | 'warning' | 'danger' | 'success';
  actor: string;
  stage: WorkflowStageKey;
  progressPercent: number;
  badgeClass: string;
}

const WORKFLOW_STATUS_PRESENTATION: Record<CaseStatus, WorkflowStatusPresentation> = {
  REGISTRATION_DRAFT: {
    label: 'Registration draft',
    description: 'Registration details are saved but not submitted yet.',
    nextAction: 'Complete the registration details, confirm the supervisor, and submit this registration for approval.',
    tone: 'neutral',
    actor: 'Student',
    stage: 'registration',
    progressPercent: 10,
    badgeClass: 'bg-secondary-subtle text-secondary-emphasis',
  },
  REGISTRATION_PENDING: {
    label: 'Registration under review',
    description: 'Wait for the review result.',
    nextAction: 'Wait for the review result.',
    tone: 'warning',
    actor: 'Supervisor',
    stage: 'registration',
    progressPercent: 20,
    badgeClass: 'bg-warning-subtle text-warning-emphasis',
  },
  REGISTRATION_APPROVED: {
    label: 'Supervisor approved',
    description: 'Wait for the review result.',
    nextAction: 'Wait for the review result.',
    tone: 'warning',
    actor: 'Library',
    stage: 'registration',
    progressPercent: 30,
    badgeClass: 'bg-warning-subtle text-warning-emphasis',
  },
  REGISTRATION_VERIFIED: {
    label: 'Registration verified',
    description: 'The registration is fully approved and the submission stage is open.',
    nextAction: 'Upload the PDF submission and confirm the repository metadata.',
    tone: 'success',
    actor: 'Student',
    stage: 'registration',
    progressPercent: 40,
    badgeClass: 'bg-success-subtle text-success-emphasis',
  },
  UNDER_SUPERVISOR_REVIEW: {
    label: 'File under review',
    description: 'Wait for the review result.',
    nextAction: 'Wait for the review result.',
    tone: 'warning',
    actor: 'Supervisor',
    stage: 'supervisor',
    progressPercent: 55,
    badgeClass: 'bg-warning-subtle text-warning-emphasis',
  },
  NEEDS_REVISION_SUPERVISOR: {
    label: 'File needs revision',
    description: 'Revise your file and upload the updated version.',
    nextAction: 'Revise your file and upload the updated version.',
    tone: 'danger',
    actor: 'Student',
    stage: 'supervisor',
    progressPercent: 55,
    badgeClass: 'bg-danger-subtle text-danger-emphasis',
  },
  READY_TO_FORWARD: {
    label: 'Ready for library handoff',
    description: 'Wait for the review result.',
    nextAction: 'Wait for the review result.',
    tone: 'warning',
    actor: 'Supervisor',
    stage: 'supervisor',
    progressPercent: 65,
    badgeClass: 'bg-warning-subtle text-warning-emphasis',
  },
  FORWARDED_TO_LIBRARY: {
    label: 'Sent for library review',
    description: 'Wait for the review result.',
    nextAction: 'Wait for the review result.',
    tone: 'warning',
    actor: 'Library',
    stage: 'library',
    progressPercent: 70,
    badgeClass: 'bg-warning-subtle text-warning-emphasis',
  },
  UNDER_LIBRARY_REVIEW: {
    label: 'File under review',
    description: 'Wait for the review result.',
    nextAction: 'Wait for the review result.',
    tone: 'warning',
    actor: 'Library',
    stage: 'library',
    progressPercent: 75,
    badgeClass: 'bg-warning-subtle text-warning-emphasis',
  },
  NEEDS_REVISION_LIBRARY: {
    label: 'File formatting needs revision',
    description: 'Revise your file formatting and upload the updated version.',
    nextAction: 'Revise your file formatting and upload the updated version.',
    tone: 'danger',
    actor: 'Student',
    stage: 'library',
    progressPercent: 75,
    badgeClass: 'bg-danger-subtle text-danger-emphasis',
  },
  APPROVED_FOR_CLEARANCE: {
    label: 'Ready for clearance',
    description: 'Complete the clearance step.',
    nextAction: 'Complete the clearance step.',
    tone: 'success',
    actor: 'Student',
    stage: 'library',
    progressPercent: 85,
    badgeClass: 'bg-success-subtle text-success-emphasis',
  },
  CLEARANCE_SUBMITTED: {
    label: 'Clearance submitted',
    description: 'Wait for the review result.',
    nextAction: 'Wait for the review result.',
    tone: 'warning',
    actor: 'Library',
    stage: 'clearance',
    progressPercent: 90,
    badgeClass: 'bg-warning-subtle text-warning-emphasis',
  },
  CLEARANCE_APPROVED: {
    label: 'Ready for publication',
    description: 'Wait for the review result.',
    nextAction: 'Wait for the review result.',
    tone: 'success',
    actor: 'Library',
    stage: 'clearance',
    progressPercent: 95,
    badgeClass: 'bg-success-subtle text-success-emphasis',
  },
  READY_TO_PUBLISH: {
    label: 'Ready to publish',
    description: 'Wait for the review result.',
    nextAction: 'Wait for the review result.',
    tone: 'success',
    actor: 'Library',
    stage: 'publish',
    progressPercent: 98,
    badgeClass: 'bg-success-subtle text-success-emphasis',
  },
  PUBLISHED: {
    label: 'Published',
    description: 'Your publication is now available in the repository.',
    nextAction: 'Your publication is now available in the repository.',
    tone: 'success',
    actor: 'Repository',
    stage: 'publish',
    progressPercent: 100,
    badgeClass: 'bg-success-subtle text-success-emphasis',
  },
  REJECTED: {
    label: 'Registration needs revision',
    description: 'Revise your registration and submit it again.',
    nextAction: 'Revise your registration and submit it again.',
    tone: 'danger',
    actor: 'Student',
    stage: 'rejected',
    progressPercent: 15,
    badgeClass: 'bg-danger-subtle text-danger-emphasis',
  },
};

export function getWorkflowStatusPresentation(status: CaseStatus): WorkflowStatusPresentation {
  return WORKFLOW_STATUS_PRESENTATION[status];
}

export function formatStatus(status: CaseStatus): string {
  return getWorkflowStatusPresentation(status).label;
}

export function statusBadgeClass(status: CaseStatus): string {
  return getWorkflowStatusPresentation(status).badgeClass;
}

export function getWorkflowNextAction(status: CaseStatus): string {
  return getWorkflowStatusPresentation(status).nextAction;
}

export function getStudentCaseNextText(status: CaseStatus): string {
  return getWorkflowNextAction(status);
}

export function getWorkflowStatusDescription(status: CaseStatus): string {
  return getWorkflowStatusPresentation(status).description;
}

export function getStudentCaseGuidance(status: CaseStatus): string {
  return getWorkflowStatusDescription(status);
}

export function getWorkflowResponsibleActor(status: CaseStatus): string {
  return getWorkflowStatusPresentation(status).actor;
}

export function getStudentWorkflowOwnerLabel(status: CaseStatus): string | null {
  const actor = getWorkflowResponsibleActor(status);

  if (actor === 'Student') {
    return 'Action needed from you';
  }
  if (actor === 'Supervisor') {
    return 'Current reviewer: Supervisor';
  }
  if (actor === 'Library') {
    return 'Current reviewer: Library';
  }

  return null;
}

export function getWorkflowToneClass(status: CaseStatus): string {
  switch (getWorkflowStatusPresentation(status).tone) {
    case 'success':
      return 'bg-success-subtle text-success-emphasis';
    case 'warning':
      return 'bg-warning-subtle text-warning-emphasis';
    case 'danger':
      return 'bg-danger-subtle text-danger-emphasis';
    default:
      return 'bg-secondary-subtle text-secondary-emphasis';
  }
}

export function canSubmitRegistration(status: CaseStatus): boolean {
  return status === 'REGISTRATION_DRAFT' || status === 'REJECTED';
}

export function canEditRegistration(status: CaseStatus): boolean {
  return (
    status === 'REGISTRATION_DRAFT' ||
    status === 'REGISTRATION_PENDING' ||
    status === 'REJECTED'
  );
}

export function canUploadSubmission(status: CaseStatus): boolean {
  return (
    status === 'REGISTRATION_VERIFIED' ||
    status === 'NEEDS_REVISION_SUPERVISOR' ||
    status === 'NEEDS_REVISION_LIBRARY'
  );
}

export function canSubmitClearance(status: CaseStatus): boolean {
  return status === 'APPROVED_FOR_CLEARANCE';
}

export function isAdminReviewStage(status: CaseStatus): boolean {
  return (
    status === 'FORWARDED_TO_LIBRARY' ||
    status === 'UNDER_LIBRARY_REVIEW' ||
    status === 'NEEDS_REVISION_LIBRARY'
  );
}

export function isFinalizedForLibrary(status: CaseStatus): boolean {
  return (
    status === 'APPROVED_FOR_CLEARANCE' ||
    status === 'CLEARANCE_SUBMITTED' ||
    status === 'CLEARANCE_APPROVED' ||
    status === 'READY_TO_PUBLISH' ||
    status === 'PUBLISHED' ||
    status === 'REJECTED'
  );
}

export function canAdminSaveChecklist(status: CaseStatus): boolean {
  return isAdminReviewStage(status);
}

export function canAdminDecide(status: CaseStatus): boolean {
  return isAdminReviewStage(status);
}

export const workflowStageOrder: CaseStatus[] = [
  'REGISTRATION_DRAFT',
  'REGISTRATION_PENDING',
  'REGISTRATION_APPROVED',
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
  'PUBLISHED',
];

export function getStageKey(status: CaseStatus): WorkflowStageKey {
  return getWorkflowStatusPresentation(status).stage;
}

export function getStageIndex(status: CaseStatus): number {
  const stage = getStageKey(status);
  switch (stage) {
    case 'registration':
      return 0;
    case 'supervisor':
      return 1;
    case 'library':
      return 2;
    case 'clearance':
      return 3;
    case 'publish':
      return 4;
    case 'rejected':
      return -1;
  }
}

export function formatStageName(stage: WorkflowStageKey): string {
  switch (stage) {
    case 'registration':
      return 'Registration';
    case 'supervisor':
      return 'Supervisor Review';
    case 'library':
      return 'Library Review';
    case 'clearance':
      return 'Clearance';
    case 'publish':
      return 'Publish';
    case 'rejected':
      return 'Rejected';
  }
}

export function getWorkflowProgressPercent(status: CaseStatus): number {
  return getWorkflowStatusPresentation(status).progressPercent;
}

export function isActiveWorkflowCase(status: CaseStatus): boolean {
  return status !== 'PUBLISHED';
}
