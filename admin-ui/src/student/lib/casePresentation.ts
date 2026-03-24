import type { CaseStatus } from '../../lib/types/workflow';

export type StudentWorkflowStepKey =
  | 'registration'
  | 'supervisor'
  | 'library'
  | 'clearance'
  | 'published';

export interface StudentWorkflowProgressStep {
  key: StudentWorkflowStepKey;
  label: string;
  shortLabel: string;
  state: 'completed' | 'active' | 'upcoming';
}

export interface StudentWorkflowProgressModel {
  currentStepKey: StudentWorkflowStepKey;
  currentStepLabel: string;
  steps: StudentWorkflowProgressStep[];
}

const WORKFLOW_STEPS: Array<{
  key: StudentWorkflowStepKey;
  label: string;
  shortLabel: string;
}> = [
  { key: 'registration', label: 'Registration', shortLabel: 'Reg' },
  { key: 'supervisor', label: 'Supervisor Review', shortLabel: 'Sup' },
  { key: 'library', label: 'Library Review', shortLabel: 'Lib' },
  { key: 'clearance', label: 'Clearance', shortLabel: 'Clr' },
  { key: 'published', label: 'Published', shortLabel: 'Pub' },
];

export function getStudentCaseWorkflowProgress(status: CaseStatus): StudentWorkflowProgressModel {
  const currentStepKey = getStudentWorkflowStepKey(status);
  const activeIndex = WORKFLOW_STEPS.findIndex((step) => step.key === currentStepKey);

  return {
    currentStepKey,
    currentStepLabel: WORKFLOW_STEPS[activeIndex]?.label ?? 'Registration',
    steps: WORKFLOW_STEPS.map((step, index) => ({
      ...step,
      state:
        index < activeIndex
          ? 'completed'
          : index === activeIndex
            ? 'active'
            : 'upcoming',
    })),
  };
}

export function getStudentCaseNextText(status: CaseStatus): string {
  switch (status) {
    case 'REGISTRATION_DRAFT':
      return 'Complete registration details';
    case 'REGISTRATION_PENDING':
      return 'Wait for registration approval';
    case 'REGISTRATION_APPROVED':
      return 'Wait for library verification';
    case 'REGISTRATION_VERIFIED':
      return 'Upload your submission';
    case 'UNDER_SUPERVISOR_REVIEW':
      return 'Wait for supervisor review';
    case 'NEEDS_REVISION_SUPERVISOR':
      return 'Revise and re-upload submission';
    case 'READY_TO_FORWARD':
      return 'Wait for library handoff';
    case 'FORWARDED_TO_LIBRARY':
    case 'UNDER_LIBRARY_REVIEW':
      return 'Wait for library review';
    case 'NEEDS_REVISION_LIBRARY':
      return 'Revise and re-upload submission';
    case 'APPROVED_FOR_CLEARANCE':
      return 'Submit clearance';
    case 'CLEARANCE_SUBMITTED':
      return 'Wait for clearance approval';
    case 'CLEARANCE_APPROVED':
    case 'READY_TO_PUBLISH':
      return 'Wait for publication';
    case 'PUBLISHED':
      return 'View published item';
    case 'REJECTED':
      return 'Revise and resubmit registration';
  }
}

function getStudentWorkflowStepKey(status: CaseStatus): StudentWorkflowStepKey {
  switch (status) {
    case 'REGISTRATION_DRAFT':
    case 'REGISTRATION_PENDING':
    case 'REGISTRATION_APPROVED':
    case 'REGISTRATION_VERIFIED':
    case 'REJECTED':
      return 'registration';
    case 'UNDER_SUPERVISOR_REVIEW':
    case 'NEEDS_REVISION_SUPERVISOR':
    case 'READY_TO_FORWARD':
      return 'supervisor';
    case 'FORWARDED_TO_LIBRARY':
    case 'UNDER_LIBRARY_REVIEW':
    case 'NEEDS_REVISION_LIBRARY':
    case 'APPROVED_FOR_CLEARANCE':
      return 'library';
    case 'CLEARANCE_SUBMITTED':
    case 'CLEARANCE_APPROVED':
    case 'READY_TO_PUBLISH':
      return 'clearance';
    case 'PUBLISHED':
      return 'published';
  }
}
