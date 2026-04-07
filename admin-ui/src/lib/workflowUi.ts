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
    label: 'Waiting for supervisor approval',
    description: 'The registration has been submitted and is awaiting supervisor review.',
    nextAction: 'No student action is needed right now. Monitor this registration for supervisor feedback.',
    tone: 'warning',
    actor: 'Lecturer',
    stage: 'registration',
    progressPercent: 20,
    badgeClass: 'bg-warning-subtle text-warning-emphasis',
  },
  REGISTRATION_APPROVED: {
    label: 'Supervisor approved',
    description: 'Supervisor review is complete and a Library Administrator will verify the registration next.',
    nextAction: 'Wait for Library Administrator verification before the submission page opens.',
    tone: 'warning',
    actor: 'Library Administrator',
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
    label: 'Under supervisor review',
    description: 'Your latest submission is being reviewed by the assigned supervisor.',
    nextAction: 'Wait for supervisor review and check the activity timeline for updates.',
    tone: 'warning',
    actor: 'Lecturer',
    stage: 'supervisor',
    progressPercent: 55,
    badgeClass: 'bg-warning-subtle text-warning-emphasis',
  },
  NEEDS_REVISION_SUPERVISOR: {
    label: 'Supervisor revision requested',
    description: 'A supervisor requested changes to the uploaded submission.',
    nextAction: 'Review the feedback and upload a revised PDF submission.',
    tone: 'danger',
    actor: 'Student',
    stage: 'supervisor',
    progressPercent: 55,
    badgeClass: 'bg-danger-subtle text-danger-emphasis',
  },
  READY_TO_FORWARD: {
    label: 'Ready for library handoff',
    description: 'Supervisor review is complete and the publication is ready to move into library review.',
    nextAction: 'No student action is needed. This publication is waiting for the library handoff.',
    tone: 'warning',
    actor: 'Lecturer',
    stage: 'supervisor',
    progressPercent: 65,
    badgeClass: 'bg-warning-subtle text-warning-emphasis',
  },
  FORWARDED_TO_LIBRARY: {
    label: 'Forwarded to library',
    description: 'The publication has been handed to the library and will enter review.',
    nextAction: 'Wait for Library Administrator review.',
    tone: 'warning',
    actor: 'Library Administrator',
    stage: 'library',
    progressPercent: 70,
    badgeClass: 'bg-warning-subtle text-warning-emphasis',
  },
  UNDER_LIBRARY_REVIEW: {
    label: 'Under library review',
    description: 'A Library Administrator is checking the submission, metadata, and checklist requirements.',
    nextAction: 'Wait for Library Administrator review. Open the publication record if you need the latest checklist history.',
    tone: 'warning',
    actor: 'Library Administrator',
    stage: 'library',
    progressPercent: 75,
    badgeClass: 'bg-warning-subtle text-warning-emphasis',
  },
  NEEDS_REVISION_LIBRARY: {
    label: 'Library revision requested',
    description: 'Library review found changes that must be addressed before clearance.',
    nextAction: 'Review the checklist feedback and upload a revised PDF submission.',
    tone: 'danger',
    actor: 'Student',
    stage: 'library',
    progressPercent: 75,
    badgeClass: 'bg-danger-subtle text-danger-emphasis',
  },
  APPROVED_FOR_CLEARANCE: {
    label: 'Approved for clearance',
    description: 'Submission review is complete and the publication is ready for the final student clearance step.',
    nextAction: 'Open the clearance form and submit it.',
    tone: 'success',
    actor: 'Student',
    stage: 'library',
    progressPercent: 85,
    badgeClass: 'bg-success-subtle text-success-emphasis',
  },
  CLEARANCE_SUBMITTED: {
    label: 'Clearance submitted',
    description: 'The clearance form has been submitted and is waiting for approval.',
    nextAction: 'Wait for clearance approval.',
    tone: 'warning',
    actor: 'Library Administrator',
    stage: 'clearance',
    progressPercent: 90,
    badgeClass: 'bg-warning-subtle text-warning-emphasis',
  },
  CLEARANCE_APPROVED: {
    label: 'Clearance approved',
    description: 'All review and clearance steps are complete.',
    nextAction: 'Wait for the final publishing step.',
    tone: 'success',
    actor: 'Library Administrator',
    stage: 'clearance',
    progressPercent: 95,
    badgeClass: 'bg-success-subtle text-success-emphasis',
  },
  READY_TO_PUBLISH: {
    label: 'Ready to publish',
    description: 'The item is ready for repository publication.',
    nextAction: 'Wait for the Library Administrator to publish the repository item.',
    tone: 'success',
    actor: 'Library Administrator',
    stage: 'publish',
    progressPercent: 98,
    badgeClass: 'bg-success-subtle text-success-emphasis',
  },
  PUBLISHED: {
    label: 'Published',
    description: 'The repository item is live and the workflow is complete.',
    nextAction: 'Review the published result and share the repository link if needed.',
    tone: 'success',
    actor: 'Repository',
    stage: 'publish',
    progressPercent: 100,
    badgeClass: 'bg-success-subtle text-success-emphasis',
  },
  REJECTED: {
    label: 'Registration rejected',
    description: 'The registration was rejected and must be corrected on the same record.',
    nextAction: 'Review the feedback, update the registration details, and resubmit the same registration.',
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
