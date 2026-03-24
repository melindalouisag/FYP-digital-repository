import type { CaseStatus } from '../../lib/types/workflow';

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
