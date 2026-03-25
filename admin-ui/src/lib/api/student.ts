import type {
  CaseDetailPayload,
  CaseSummary,
  ChecklistResult,
  PagedResponse,
  PublicationType,
  SubmissionVersion,
} from '../types/workflow';
import { getJson, postJson, putJson, request } from './http';

export interface CreateRegistrationPayload {
  type: PublicationType;
  title: string;
  year?: number;
  articlePublishIn?: string;
  faculty?: string;
  studentIdNumber?: string;
  authorName?: string;

  // preferred (single supervisor)
  supervisorEmail?: string;
  supervisorUserId?: number;

  // legacy (keep temporarily)
  supervisorUserIds?: number[];    // deprecated
  supervisorEmails?: string[];     // deprecated
}

export interface UpdateRegistrationPayload {
  title: string;
  year?: number;
  articlePublishIn?: string;
  faculty?: string;
  studentIdNumber?: string;
  authorName?: string;
  supervisorEmail?: string;
  supervisorUserId?: number;
  supervisorUserIds?: number[];
  supervisorEmails?: string[];
}

export interface SubmissionMetaPayload {
  metadataTitle?: string;
  metadataAuthors?: string;
  metadataKeywords?: string;
  metadataFaculty?: string;
  metadataStudyProgram?: string;
  metadataYear?: number;
  abstractText?: string;
}

export interface SupervisorRow {
  id: number;
  email: string;
  name: string;
  faculty?: string | null;
  department?: string | null;
}

const STUDENT_CASES_PAGE_SIZE = 50;

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

export const studentApi = {
  async listCases(): Promise<CaseSummary[]> {
    const allItems: CaseSummary[] = [];
    let page = 0;

    while (true) {
      const response = await getJson<PagedResponse<CaseSummary>>(
        `/api/student/cases${buildPageQuery(page, STUDENT_CASES_PAGE_SIZE)}`
      );
      allItems.push(...response.items);

      if (!response.hasNext) {
        return allItems;
      }

      page += 1;
    }
  },

  listCasesPage(params?: { page?: number; size?: number }): Promise<PagedResponse<CaseSummary>> {
    return getJson(`/api/student/cases${buildPageQuery(params?.page, params?.size)}`);
  },

  listSupervisors(): Promise<SupervisorRow[]> {
    return getJson('/api/student/supervisors');
  },

  createRegistration(payload: CreateRegistrationPayload): Promise<{ caseId: number; status: string }> {
    return postJson('/api/student/registrations', payload);
  },

  updateRegistration(caseId: number, payload: UpdateRegistrationPayload): Promise<{ caseId: number; status: string }> {
    return putJson(`/api/student/registrations/${caseId}`, payload);
  },

  submitRegistration(caseId: number, permissionAccepted: boolean): Promise<{ caseId: number; status: string }> {
    return postJson(`/api/student/registrations/${caseId}/submit`, { permissionAccepted });
  },

  caseDetail(caseId: number): Promise<CaseDetailPayload> {
    return getJson(`/api/student/cases/${caseId}`);
  },

  listSubmissions(caseId: number): Promise<SubmissionVersion[]> {
    return getJson(`/api/student/cases/${caseId}/submissions`);
  },

  listChecklistResults(caseId: number): Promise<ChecklistResult[]> {
    return getJson(`/api/student/cases/${caseId}/checklist-results`);
  },

  submitClearance(caseId: number, note: string): Promise<{ caseId: number; status: string }> {
    return postJson(`/api/student/cases/${caseId}/clearance`, { note });
  },

  uploadSubmission(
    caseId: number,
    file: File,
    metadata: SubmissionMetaPayload
  ): Promise<{ submissionId: number; version: number }> {
    const form = new FormData();
    form.append('file', file);
    form.append('meta', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    return request(`/api/student/cases/${caseId}/submissions`, {
      method: 'POST',
      body: form,
    });
  },
};
