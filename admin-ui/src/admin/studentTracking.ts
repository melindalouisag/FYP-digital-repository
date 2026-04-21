import type {
  AdminCaseQueueItem,
  AdminStudentTrackingGroup,
  CaseDetailPayload,
  CaseStatus,
  ChecklistResult,
  TimelineItem,
  WorkflowComment,
} from '@/types/workflow';
import {
  formatStatus,
  getWorkflowStatusDescription,
  statusBadgeClass,
} from '@/utils/workflowUi';
import {
  formatFacultyName,
  getFacultyDisplayOptions,
  normalizeFacultyCode,
  type FacultyCode,
} from '@/utils/facultyLabel';

export interface FacultySummary {
  code: FacultyCode;
  label: string;
  totalStudents: number;
  activeCases: number;
  pendingReview: number;
  completed: number;
}

export interface StudentListRow {
  studentUserId: number;
  studentName: string;
  studentIdNumber: string;
  faculty: string;
  program: string;
  publicationTitle: string;
  status: CaseStatus | null;
  lastUpdated: string | null;
  primaryCaseId: number | null;
  caseCount: number;
}

export interface TrackingTimelineStage {
  id: string;
  title: string;
  statusLabel: string;
  timestamp: string | null;
  comment: string | null;
  actorLabel: string | null;
  isCurrent: boolean;
  isComplete: boolean;
}

type TimelineMatch = {
  timestamp: string | null;
  comment: string | null;
  actorLabel: string | null;
};

const TRACKING_TIMELINE_STAGES = [
  { id: 'registration-created', title: 'Registration Created' },
  { id: 'registration-submitted', title: 'Registration Submitted' },
  { id: 'registration-approved', title: 'Registration Approved' },
  { id: 'submission-uploaded', title: 'Submission Uploaded' },
  { id: 'supervisor-review', title: 'Supervisor Review' },
  { id: 'revision-requested', title: 'Revision Requested' },
  { id: 'revised-submission-uploaded', title: 'Revised Submission Uploaded' },
  { id: 'sent-to-library', title: 'Sent to Library' },
  { id: 'library-review', title: 'Library Review' },
  { id: 'clearance-submitted', title: 'Clearance Submitted' },
  { id: 'clearance-approved', title: 'Clearance Approved' },
  { id: 'published', title: 'Published' },
] as const;

export function buildFacultySummaries(groups: AdminStudentTrackingGroup[]): FacultySummary[] {
  return getFacultyDisplayOptions().map((faculty) => {
    const facultyGroups = groups.filter((group) => normalizeFacultyCode(group.faculty) === faculty.code);
    return {
      code: faculty.code,
      label: faculty.label,
      totalStudents: facultyGroups.length,
      activeCases: facultyGroups.reduce((total, group) => total + group.cases.filter((item) => isActiveCase(item.status)).length, 0),
      pendingReview: facultyGroups.reduce((total, group) => total + group.cases.filter((item) => isPendingReview(item.status)).length, 0),
      completed: facultyGroups.reduce((total, group) => total + group.cases.filter((item) => item.status === 'PUBLISHED').length, 0),
    };
  });
}

export function buildStudentListRows(
  groups: AdminStudentTrackingGroup[],
  facultyCode: FacultyCode
): StudentListRow[] {
  return groups
    .filter((group) => normalizeFacultyCode(group.faculty) === facultyCode)
    .map((group) => {
      const primaryCase = resolvePrimaryCase(group.cases);
      return {
        studentUserId: group.studentUserId,
        studentName: group.studentName || 'Student',
        studentIdNumber: group.studentIdNumber?.trim() || 'Not available',
        faculty: formatFacultyName(group.faculty),
        program: group.program?.trim() || 'Not available',
        publicationTitle: primaryCase?.title?.trim() || 'No submission recorded',
        status: primaryCase?.status ?? null,
        lastUpdated: resolveCaseTimestamp(primaryCase),
        primaryCaseId: primaryCase?.caseId ?? null,
        caseCount: group.cases.length,
      };
    })
    .sort((left, right) => compareDateStrings(right.lastUpdated, left.lastUpdated));
}

export function resolvePrimaryCase(cases: AdminCaseQueueItem[]) {
  return [...cases].sort((left, right) => {
    const activityDelta = compareDateStrings(resolveCaseTimestamp(right), resolveCaseTimestamp(left));
    if (activityDelta !== 0) {
      return activityDelta;
    }

    const statusDelta = Number(isActiveCase(right.status)) - Number(isActiveCase(left.status));
    if (statusDelta !== 0) {
      return statusDelta;
    }

    return right.caseId - left.caseId;
  })[0] ?? null;
}

export function buildTrackingTimeline(detail?: CaseDetailPayload | null): TrackingTimelineStage[] {
  if (!detail) {
    return [];
  }

  const currentStageId = currentTimelineStage(detail.case.status);
  const matches = resolveStageMatches(detail);

  return TRACKING_TIMELINE_STAGES.map((stage) => {
    const match = matches[stage.id] ?? emptyTimelineMatch();
    return {
      id: stage.id,
      title: stage.title,
      statusLabel: stage.id === currentStageId
        ? formatStatus(detail.case.status)
        : match.timestamp
          ? 'Completed'
          : 'Pending',
      timestamp: match.timestamp,
      comment: match.comment,
      actorLabel: match.actorLabel,
      isCurrent: stage.id === currentStageId,
      isComplete: Boolean(match.timestamp),
    };
  });
}

export function statusLabelClass(status: CaseStatus | null) {
  if (!status) {
    return 'status-badge bg-secondary-subtle text-secondary-emphasis';
  }
  return `status-badge ${statusBadgeClass(status)}`;
}

export function statusLabelText(status: CaseStatus | null) {
  return status ? formatStatus(status) : 'No Active Case';
}

export function statusDescriptionText(status: CaseStatus | null) {
  return status ? getWorkflowStatusDescription(status) : 'No publication workflow record is currently available.';
}

export function isRevisionStatus(status: CaseStatus | null) {
  return status === 'NEEDS_REVISION_SUPERVISOR'
    || status === 'NEEDS_REVISION_LIBRARY'
    || status === 'REJECTED';
}

export function caseReviewComments(comments: WorkflowComment[]) {
  return comments.filter((comment) => comment.authorRole === 'LECTURER' || comment.authorRole === 'ADMIN');
}

export function passedChecklistCount(results: ChecklistResult[]) {
  return results.filter((result) => result.passFail === 'PASS').length;
}

function resolveStageMatches(detail: CaseDetailPayload) {
  const timeline = [...(detail.timeline ?? [])].sort((left, right) => compareDateStrings(left.at ?? null, right.at ?? null));
  const submissions = [...(detail.submissions ?? detail.versions ?? [])].sort((left, right) => (
    (left.versionNumber ?? 0) - (right.versionNumber ?? 0)
  ));
  const matches: Record<string, TimelineMatch> = {};

  matches['registration-created'] = {
    timestamp: detail.case.createdAt ?? findEventTimestamp(timeline, ['REGISTRATION_DRAFT_SAVED']),
    comment: null,
    actorLabel: 'Student',
  };
  matches['registration-submitted'] = {
    timestamp: detail.registration?.submittedAt ?? findEventTimestamp(timeline, ['REGISTRATION_SUBMITTED']),
    comment: findEventComment(timeline, ['REGISTRATION_SUBMITTED']),
    actorLabel: 'Student',
  };
  matches['registration-approved'] = latestEventMatch(
    timeline,
    ['SUPERVISOR_APPROVED_REGISTRATION', 'LIBRARY_APPROVED_REGISTRATION'],
    detail.registration?.supervisorDecisionAt ?? null,
    'Reviewer'
  );
  matches['submission-uploaded'] = submissions[0]
    ? {
        timestamp: submissions[0].createdAt ?? null,
        comment: submissions[0].originalFilename || null,
        actorLabel: 'Student',
      }
    : emptyTimelineMatch();
  matches['supervisor-review'] = latestSupervisorReview(timeline);
  matches['revision-requested'] = latestEventMatch(
    timeline,
    [
      'SUPERVISOR_REQUESTED_REVISION',
      'LIBRARY_REQUESTED_REVISION',
      'SUPERVISOR_REJECTED_REGISTRATION',
      'LIBRARY_REJECTED_REGISTRATION',
      'CLEARANCE_CORRECTION_REQUESTED',
      'UNPUBLISHED_FOR_CORRECTION',
    ],
    null,
    'Reviewer'
  );
  matches['revised-submission-uploaded'] = submissions.length > 1
    ? {
        timestamp: submissions[submissions.length - 1].createdAt ?? null,
        comment: submissions[submissions.length - 1].originalFilename || null,
        actorLabel: 'Student',
      }
    : emptyTimelineMatch();
  matches['sent-to-library'] = latestEventMatch(
    timeline,
    ['SUPERVISOR_FORWARDED_TO_LIBRARY'],
    null,
    'Lecturer'
  );
  matches['library-review'] = latestLibraryReview(timeline);
  matches['clearance-submitted'] = latestEventMatch(
    timeline,
    ['CLEARANCE_SUBMITTED'],
    detail.clearance?.submittedAt ?? null,
    'Student'
  );
  matches['clearance-approved'] = latestEventMatch(
    timeline,
    ['CLEARANCE_APPROVED'],
    detail.clearance?.approvedAt ?? null,
    'Library'
  );
  matches['published'] = latestEventMatch(
    timeline,
    ['PUBLISHED'],
    null,
    'Repository'
  );

  return matches;
}

function latestSupervisorReview(timeline: TimelineItem[]): TimelineMatch {
  const supervisorEvents = timeline.filter((item) => (
    item.type === 'SUPERVISOR_MARKED_READY'
      || (item.type === 'COMMENT' && item.actorRole === 'LECTURER')
  ));
  const latest = supervisorEvents[supervisorEvents.length - 1];
  if (!latest) {
    return emptyTimelineMatch();
  }

  return {
    timestamp: latest.at ?? null,
    comment: latest.message ?? null,
    actorLabel: 'Lecturer',
  };
}

function latestLibraryReview(timeline: TimelineItem[]): TimelineMatch {
  const libraryEvents = timeline.filter((item) => (
    item.type === 'LIBRARY_CHECKLIST_REVIEWED'
      || item.type === 'LIBRARY_APPROVED_FOR_CLEARANCE'
      || item.type === 'LIBRARY_REJECTED'
      || item.type === 'LIBRARY_REQUESTED_REVISION'
      || (item.type === 'COMMENT' && item.actorRole === 'ADMIN')
  ));
  const latest = libraryEvents[libraryEvents.length - 1];
  if (!latest) {
    return emptyTimelineMatch();
  }

  return {
    timestamp: latest.at ?? null,
    comment: latest.message ?? null,
    actorLabel: 'Library',
  };
}

function latestEventMatch(
  timeline: TimelineItem[],
  types: string[],
  fallbackTimestamp: string | null,
  actorLabel: string
): TimelineMatch {
  const matchingEvents = timeline.filter((item) => types.includes(item.type));
  const latest = matchingEvents[matchingEvents.length - 1];
  return {
    timestamp: latest?.at ?? fallbackTimestamp,
    comment: latest?.message ?? null,
    actorLabel: (latest?.actorRole ? roleLabel(latest.actorRole) : actorLabel) ?? null,
  };
}

function findEventTimestamp(timeline: TimelineItem[], types: string[]) {
  return timeline.find((item) => types.includes(item.type))?.at ?? null;
}

function findEventComment(timeline: TimelineItem[], types: string[]) {
  return timeline.find((item) => types.includes(item.type))?.message ?? null;
}

function emptyTimelineMatch(): TimelineMatch {
  return {
    timestamp: null,
    comment: null,
    actorLabel: null,
  };
}

function currentTimelineStage(status: CaseStatus): string {
  switch (status) {
    case 'REGISTRATION_DRAFT':
      return 'registration-created';
    case 'REGISTRATION_PENDING':
      return 'registration-submitted';
    case 'REGISTRATION_APPROVED':
      return 'registration-approved';
    case 'REGISTRATION_VERIFIED':
      return 'submission-uploaded';
    case 'UNDER_SUPERVISOR_REVIEW':
      return 'supervisor-review';
    case 'NEEDS_REVISION_SUPERVISOR':
    case 'NEEDS_REVISION_LIBRARY':
    case 'REJECTED':
      return 'revision-requested';
    case 'READY_TO_FORWARD':
    case 'FORWARDED_TO_LIBRARY':
      return 'sent-to-library';
    case 'UNDER_LIBRARY_REVIEW':
      return 'library-review';
    case 'APPROVED_FOR_CLEARANCE':
    case 'CLEARANCE_SUBMITTED':
      return 'clearance-submitted';
    case 'CLEARANCE_APPROVED':
    case 'READY_TO_PUBLISH':
      return 'clearance-approved';
    case 'PUBLISHED':
      return 'published';
  }
}

function isActiveCase(status: CaseStatus) {
  return status !== 'PUBLISHED' && status !== 'REJECTED';
}

function isPendingReview(status: CaseStatus) {
  return status === 'REGISTRATION_PENDING'
    || status === 'REGISTRATION_APPROVED'
    || status === 'UNDER_SUPERVISOR_REVIEW'
    || status === 'READY_TO_FORWARD'
    || status === 'FORWARDED_TO_LIBRARY'
    || status === 'UNDER_LIBRARY_REVIEW'
    || status === 'CLEARANCE_SUBMITTED'
    || status === 'READY_TO_PUBLISH';
}

function resolveCaseTimestamp(item?: Pick<AdminCaseQueueItem, 'updatedAt' | 'latestSubmissionAt'> | null) {
  if (!item) {
    return null;
  }
  return item.updatedAt ?? item.latestSubmissionAt ?? null;
}

function compareDateStrings(left?: string | null, right?: string | null) {
  const leftValue = left ? Date.parse(left) || 0 : 0;
  const rightValue = right ? Date.parse(right) || 0 : 0;
  return leftValue - rightValue;
}

function roleLabel(role?: TimelineItem['actorRole']) {
  switch (role) {
    case 'ADMIN':
      return 'Library';
    case 'LECTURER':
      return 'Lecturer';
    case 'STUDENT':
      return 'Student';
    default:
      return null;
  }
}
