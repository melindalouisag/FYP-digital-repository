import type { CaseStatus } from '../../lib/types/workflow';

export function getStudentCaseNextText(status: CaseStatus): string {
  switch (status) {
    case 'REGISTRATION_DRAFT':
      return 'Complete the registration and submit it';
    case 'REGISTRATION_PENDING':
      return 'Wait for supervisor approval';
    case 'REGISTRATION_APPROVED':
      return 'Wait for library verification';
    case 'REGISTRATION_VERIFIED':
      return 'Upload the first submission file';
    case 'UNDER_SUPERVISOR_REVIEW':
      return 'Wait for supervisor review';
    case 'NEEDS_REVISION_SUPERVISOR':
      return 'Upload a revised submission file';
    case 'READY_TO_FORWARD':
      return 'Wait for library handoff';
    case 'FORWARDED_TO_LIBRARY':
    case 'UNDER_LIBRARY_REVIEW':
      return 'Wait for library review';
    case 'NEEDS_REVISION_LIBRARY':
      return 'Upload a revised submission file';
    case 'APPROVED_FOR_CLEARANCE':
      return 'Submit the library clearance form';
    case 'CLEARANCE_SUBMITTED':
      return 'Wait for clearance approval';
    case 'CLEARANCE_APPROVED':
    case 'READY_TO_PUBLISH':
      return 'Wait for publication';
    case 'PUBLISHED':
      return 'Review the published result';
    case 'REJECTED':
      return 'Update the registration and resubmit it';
  }
}

export function getStudentCaseGuidance(status: CaseStatus): string {
  switch (status) {
    case 'REGISTRATION_DRAFT':
      return 'Finish the registration details, choose the correct supervisor, and submit the same case when you are ready.';
    case 'REGISTRATION_PENDING':
      return 'Your supervisor is reviewing the registration. You do not need to submit anything else right now.';
    case 'REGISTRATION_APPROVED':
      return 'Supervisor review is complete. The case is waiting for library verification before submission opens.';
    case 'REGISTRATION_VERIFIED':
      return 'Registration is complete. Upload the first PDF and confirm the repository metadata on the submission page.';
    case 'UNDER_SUPERVISOR_REVIEW':
      return 'Wait for supervisor review. Open the case sections below if you need the latest comments or history.';
    case 'NEEDS_REVISION_SUPERVISOR':
      return 'A supervisor revision is required. Upload a revised PDF from the submission page after reviewing the feedback.';
    case 'READY_TO_FORWARD':
      return 'Supervisor review is finished. The case is waiting to be forwarded into library review.';
    case 'FORWARDED_TO_LIBRARY':
      return 'Wait for library review. The case has reached the library and will move into review next.';
    case 'UNDER_LIBRARY_REVIEW':
      return 'Wait for library review. Library staff are reviewing the submission and checklist requirements.';
    case 'NEEDS_REVISION_LIBRARY':
      return 'Library staff requested changes. Review checklist notes and upload a revised PDF.';
    case 'APPROVED_FOR_CLEARANCE':
      return 'Submission review is complete. Your next student action is to submit the library clearance form.';
    case 'CLEARANCE_SUBMITTED':
      return 'Wait for clearance approval. No additional student action is required right now.';
    case 'CLEARANCE_APPROVED':
      return 'Wait for publication. Clearance is complete.';
    case 'READY_TO_PUBLISH':
      return 'Wait for publication. All review stages are complete.';
    case 'PUBLISHED':
      return 'The repository workflow is complete for this case.';
    case 'REJECTED':
      return 'Review the feedback on this case, update the registration details, and submit the same case again.';
  }
}
