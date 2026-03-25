import type { CaseStatus, CaseSummary, PagedResponse, PublicationType, TimelineItem } from '../types/workflow';
import { getJson, postJson } from './http';

export interface LecturerApprovalQueueRow {
  caseId: number;
  type: PublicationType;
  status: CaseStatus;
  updatedAt?: string;
  studentUserId: number;
  studentEmail?: string;
  studentName?: string;
  studentIdNumber?: string | null;
  faculty?: string | null;
  program?: string | null;
  registrationTitle?: string | null;
  registrationYear?: number | null;
  registrationSubmittedAt?: string | null;
}

export interface LecturerCaseWorkItem {
  caseId: number;
  type: PublicationType;
  status: CaseStatus;
  updatedAt?: string;
  registrationTitle?: string | null;
  registrationYear?: number | null;
  latestSubmissionAt?: string | null;
  lastLecturerFeedbackAt?: string | null;
  lecturerForwardedAt?: string | null;
  lastLibraryFeedbackAt?: string | null;
  libraryApprovedAt?: string | null;
}

export interface LecturerStudentGroup {
  studentUserId: number;
  studentEmail?: string;
  studentName?: string;
  studentIdNumber?: string | null;
  faculty?: string | null;
  program?: string | null;
  cases: LecturerCaseWorkItem[];
}

export interface LecturerSubmissionVersion {
  id: number;
  versionNumber: number;
  originalFilename: string;
  status: string;
  createdAt?: string | null;
}

function buildPageQuery(page?: number, size?: number): string {
  const query = new URLSearchParams();
  if (page !== undefined) {
    query.set('page', String(page));
  }
  if (size !== undefined) {
    query.set('size', String(size));
  }
  const raw = query.toString();
  return raw.length > 0 ? `?${raw}` : '';
}

export const lecturerApi = {
  approvals(): Promise<{ id: number; status: CaseStatus; type: PublicationType }[]> {
    return getJson('/api/lecturer/approvals');
  },

  approve(caseId: number): Promise<{ caseId: number; status: CaseStatus }> {
    return postJson(`/api/lecturer/approvals/${caseId}/approve`);
  },

  reject(caseId: number, note: string): Promise<{ caseId: number; status: CaseStatus }> {
    return postJson(`/api/lecturer/approvals/${caseId}/reject`, { note });
  },

  review(params?: { page?: number; size?: number }): Promise<PagedResponse<CaseSummary>> {
    return getJson(`/api/lecturer/review${buildPageQuery(params?.page, params?.size)}`);
  },

  comment(caseId: number, body: string): Promise<{ ok: boolean }> {
    return postJson(`/api/lecturer/cases/${caseId}/comment`, { body });
  },

  requestRevision(caseId: number, reason: string): Promise<{ caseId: number; status: CaseStatus }> {
    return postJson(`/api/lecturer/cases/${caseId}/request-revision`, { reason });
  },

  markReady(caseId: number): Promise<{ caseId: number; status: CaseStatus }> {
    return postJson(`/api/lecturer/cases/${caseId}/mark-ready`);
  },

  forward(caseId: number): Promise<{ caseId: number; status: CaseStatus }> {
    return postJson(`/api/lecturer/cases/${caseId}/forward-to-library`);
  },

  students(): Promise<{ caseId: number; studentId: number; status: CaseStatus; type: PublicationType }[]> {
    return getJson('/api/lecturer/students');
  },

  caseTimeline(caseId: number): Promise<TimelineItem[]> {
    return getJson(`/api/lecturer/cases/${caseId}/timeline`);
  },

  caseSubmissions(caseId: number): Promise<LecturerSubmissionVersion[]> {
    return getJson(`/api/lecturer/cases/${caseId}/submissions`);
  },

  approvalQueue(params?: { page?: number; size?: number }): Promise<PagedResponse<LecturerApprovalQueueRow>> {
    return getJson(`/api/lecturer/approval-queue${buildPageQuery(params?.page, params?.size)}`);
  },

  pendingSupervisor(year?: number): Promise<LecturerStudentGroup[]> {
    const query = year ? `?year=${year}` : '';
    return getJson(`/api/lecturer/pending-supervisor${query}`);
  },

  libraryTracking(year?: number): Promise<LecturerStudentGroup[]> {
    const query = year ? `?year=${year}` : '';
    return getJson(`/api/lecturer/library-tracking${query}`);
  },

  myStudents(year?: number): Promise<LecturerStudentGroup[]> {
    const query = year ? `?year=${year}` : '';
    return getJson(`/api/lecturer/my-students${query}`);
  },

  approveAndForward(caseId: number): Promise<{ caseId: number; status: CaseStatus }> {
    return postJson(`/api/lecturer/cases/${caseId}/approve-and-forward`);
  },
};
