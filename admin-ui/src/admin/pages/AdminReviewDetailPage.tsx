import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ShellLayout from '../../ShellLayout';
import { adminApi } from '../../lib/api/admin';
import CaseTimeline from '../../lib/components/CaseTimeline';
import type {
  CaseDetailPayload,
  ChecklistItem,
  ChecklistResult,
  ChecklistTemplateResponse,
  PublicationType,
  SubmissionVersion,
} from '../../lib/workflowTypes';
import {
  canAdminDecide,
  canAdminSaveChecklist,
  formatStatus,
  isAdminReviewStage,
  isFinalizedForLibrary,
} from '../../lib/workflowUi';

type ChecklistDraftRow = {
  checklistItemId: number;
  pass: boolean;
};

type ChecklistSection = {
  name: string;
  items: ChecklistItem[];
};

const ALERT_STYLE = { borderRadius: '0.75rem' } as const;
const PILL_BUTTON_STYLE = { borderRadius: '999px' } as const;

function toChecklistMap(items: ChecklistItem[]): Record<number, ChecklistDraftRow> {
  return items.reduce<Record<number, ChecklistDraftRow>>((acc, item) => {
    acc[item.id] = {
      checklistItemId: item.id,
      pass: true,
    };
    return acc;
  }, {});
}

function sectionName(value?: string | null) {
  return value?.trim() || 'General';
}

function groupChecklistItems(items: ChecklistItem[]): ChecklistSection[] {
  const sections = new Map<string, ChecklistItem[]>();

  items.forEach((item) => {
    const name = sectionName(item.section);
    if (!sections.has(name)) {
      sections.set(name, []);
    }
    sections.get(name)?.push(item);
  });

  return Array.from(sections.entries()).map(([name, groupedItems]) => ({
    name,
    items: groupedItems,
  }));
}

function buildChecklistState(
  items: ChecklistItem[],
  results: ChecklistResult[]
): {
  draft: Record<number, ChecklistDraftRow>;
  sectionNotes: Record<string, string>;
} {
  const resultByItemId = new Map(results.map((result) => [result.checklistItem.id, result]));
  const draft = toChecklistMap(items);
  const sectionNotes: Record<string, string> = {};

  items.forEach((item) => {
    const saved = resultByItemId.get(item.id);
    const name = sectionName(item.section);
    if (saved) {
      draft[item.id] = {
        checklistItemId: item.id,
        pass: saved.passFail === 'PASS',
      };
      if (!sectionNotes[name] && saved.note?.trim()) {
        sectionNotes[name] = saved.note.trim();
      }
    }
  });

  return { draft, sectionNotes };
}

function resolveTemplateForSubmission(
  templates: ChecklistTemplateResponse[],
  submission?: SubmissionVersion
): ChecklistTemplateResponse | null {
  if (!submission) return null;
  if (submission.checklistTemplate?.id) {
    return templates.find((entry) => entry.template.id === submission.checklistTemplate?.id) ?? null;
  }
  return templates.find((entry) => entry.template.active) ?? templates[0] ?? null;
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : 'N/A';
}

function displayCaseTitle(title?: string | null) {
  return title?.trim() || 'Untitled submission';
}

function updateDraftRow(
  current: Record<number, ChecklistDraftRow>,
  itemId: number,
  patch: Partial<ChecklistDraftRow>
) {
  return {
    ...current,
    [itemId]: {
      checklistItemId: itemId,
      pass: true,
      ...(current[itemId] ?? {}),
      ...patch,
    },
  };
}

function decisionActionTitle(decisionAllowed: boolean, hasReason: boolean, emptyReasonMessage: string) {
  if (!decisionAllowed) {
    return 'Review decisions are only available during library review.';
  }
  return hasReason ? undefined : emptyReasonMessage;
}

function reviewStatusNotice(
  status: string | undefined,
  reviewStage: boolean,
  finalized: boolean
): { variant: 'info' | 'danger' | 'secondary'; message: string } | null {
  if (!reviewStage && !finalized) {
    return {
      variant: 'info',
      message: 'This case is not yet in library review. Wait for lecturer forwarding before continuing checklist review.',
    };
  }
  if (finalized && status === 'REJECTED') {
    return {
      variant: 'danger',
      message: 'This case has been rejected and is finalized for the library stage.',
    };
  }
  if (finalized) {
    return {
      variant: 'secondary',
      message: 'This case is already finalized for the library stage.',
    };
  }
  return null;
}

function ReviewCard({
  title,
  description,
  delay = 0,
  spaced = true,
  children,
}: {
  title: string;
  description: string;
  delay?: number;
  spaced?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`su-card fade-in${spaced ? ' mb-3' : ''}`} style={{ animationDelay: `${delay}s` }}>
      <div className="card-body p-4">
        <h3 className="h6 su-page-title">{title}</h3>
        <div className="text-muted small mb-3">{description}</div>
        {children}
      </div>
    </div>
  );
}

export default function AdminReviewDetailPage() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<CaseDetailPayload | null>(null);
  const [templates, setTemplates] = useState<ChecklistTemplateResponse[]>([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<number, ChecklistDraftRow>>({});
  const [sectionNotes, setSectionNotes] = useState<Record<string, string>>({});
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [revisionReason, setRevisionReason] = useState('');
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const submissions = useMemo(
    () => detail?.submissions ?? detail?.versions ?? [],
    [detail?.submissions, detail?.versions]
  );
  const latestSubmission = submissions[0];

  const selectedSubmission = useMemo(
    () => submissions.find((submission) => submission.id === selectedSubmissionId) ?? submissions[0],
    [selectedSubmissionId, submissions]
  );

  const selectedSubmissionDownloadHref = detail && selectedSubmission
    ? `/api/admin/cases/${detail.case.id}/submissions/${selectedSubmission.id}/download`
    : '';

  const selectedTemplate = useMemo(
    () => resolveTemplateForSubmission(templates, selectedSubmission),
    [templates, selectedSubmission]
  );

  const checklistItems = useMemo(
    () => selectedTemplate?.items ?? [],
    [selectedTemplate?.items]
  );
  const checklistSections = useMemo(
    () => groupChecklistItems(checklistItems),
    [checklistItems]
  );
  const status = detail?.case.status;
  const reviewStage = status ? isAdminReviewStage(status) : false;
  const finalized = status ? isFinalizedForLibrary(status) : false;
  const hasActiveTemplate = templates.some((template) => template.template.active);
  const checklistAllowed = status ? canAdminSaveChecklist(status) : false;
  const checklistEditable = checklistAllowed && hasActiveTemplate && checklistItems.length > 0 && !working;
  const decisionAllowed = status ? canAdminDecide(status) : false;
  const trimmedRevisionReason = revisionReason.trim();
  const checklistSaved = selectedSubmission ? selectedSubmission.status !== 'SUBMITTED' : false;
  const statusNotice = reviewStatusNotice(status, reviewStage, finalized);
  const selectedSubmissionResults = useMemo(
    () => (selectedSubmission?.id === latestSubmission?.id ? detail?.checklistResults ?? [] : []),
    [detail?.checklistResults, latestSubmission?.id, selectedSubmission?.id]
  );

  const load = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError('');
    try {
      const payload = await adminApi.caseDetail(Number(caseId));
      setDetail(payload);

      const publicationType = payload.case.type as PublicationType;
      const templateRows = await adminApi.checklists(publicationType);
      setTemplates(templateRows);

      const submission = (payload.submissions ?? payload.versions ?? [])[0];
      if (submission) {
        setSelectedSubmissionId(submission.id);
      }
      const template = resolveTemplateForSubmission(templateRows, submission);
      const nextChecklistItems = template?.items ?? [];
      const { draft: nextDraft, sectionNotes: nextSectionNotes } = buildChecklistState(nextChecklistItems, payload.checklistResults ?? []);
      setDraft(nextDraft);
      setSectionNotes(nextSectionNotes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load review detail.');
      setDetail(null);
      setTemplates([]);
      setDraft({});
      setSectionNotes({});
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const { draft: nextDraft, sectionNotes: nextSectionNotes } = buildChecklistState(checklistItems, selectedSubmissionResults);
    setDraft(nextDraft);
    setSectionNotes(nextSectionNotes);
  }, [checklistItems, selectedSubmissionResults]);

  useEffect(() => {
    setOpenSections((prev) => {
      const next: Record<string, boolean> = {};
      checklistSections.forEach((section, index) => {
        next[section.name] = prev[section.name] ?? index === 0;
      });
      return next;
    });
  }, [checklistSections]);

  const runAction = async (action: () => Promise<void>, successMessage: string) => {
    setWorking(true);
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(successMessage);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setWorking(false);
    }
  };

  const saveChecklist = () => {
    if (!caseId || !selectedSubmission) return;
    const results = checklistItems.map((item) => ({
      checklistItemId: item.id,
      pass: draft[item.id]?.pass ?? true,
      note: sectionNotes[sectionName(item.section)]?.trim() || undefined,
    }));
    return runAction(
      () => adminApi.saveChecklistResults(Number(caseId), selectedSubmission.id, results),
      'Checklist results saved.'
    );
  };

  const requestRevision = () => {
    if (!caseId) return;
    return runAction(
      () => adminApi.requestRevision(Number(caseId), revisionReason.trim()),
      'Revision request sent.'
    );
  };

  const approveCase = () => {
    if (!caseId) return;
    return runAction(
      () => adminApi.approveCase(Number(caseId)),
      'Case approved for clearance.'
    );
  };

  return (
    <ShellLayout title="Submission Review Detail" subtitle="Review the submission, complete the checklist, and record the final library decision">
      {loading && (
        <div className="text-center py-5">
          <div className="su-spinner mx-auto mb-3" />
          <div className="text-muted">Loading case review detail...</div>
        </div>
      )}
      {error && <div className="alert alert-danger" style={ALERT_STYLE}>{error}</div>}
      {message && <div className="alert alert-success" style={ALERT_STYLE}>{message}</div>}

      {detail && (
        <>
          {statusNotice && <div className={`alert alert-${statusNotice.variant}`}>{statusNotice.message}</div>}
          <div className="su-card mb-3 fade-in">
            <div className="card-body p-4">
              <div className="fw-bold" style={{ fontSize: '1.1rem' }}>{displayCaseTitle(detail.case.title)}</div>
              <div className="text-muted small mt-1">
                {detail.case.type} • {formatStatus(detail.case.status)}
              </div>

              <div className="d-flex flex-wrap align-items-end gap-2 mt-3">
                <div style={{ minWidth: 280, flex: '1 1 320px' }}>
                  <label className="form-label mb-1">Submission version</label>
                  <select
                    className="form-select"
                    value={selectedSubmission?.id ?? ''}
                    onChange={(event) => setSelectedSubmissionId(Number(event.target.value))}
                  >
                    {submissions.map((submission) => (
                      <option key={submission.id} value={submission.id}>
                        v{submission.versionNumber} ({submission.status})
                        {submission.createdAt ? ` • ${new Date(submission.createdAt).toLocaleString()}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedSubmissionDownloadHref && (
                  <a
                    className="btn btn-outline-primary btn-sm"
                    href={selectedSubmissionDownloadHref}
                    style={PILL_BUTTON_STYLE}
                  >
                    Download file
                  </a>
                )}
              </div>

              <div className="text-muted small mt-2">
                Checklist template: {selectedTemplate ? `v${selectedTemplate.template.version}` : 'Not available'}
                {' • '}
                Uploaded: {formatDateTime(selectedSubmission?.createdAt)}
              </div>
            </div>
          </div>

          <ReviewCard
            title="Checklist Review"
            description="Use the active template for this publication type and save checklist results before recording the final library decision."
            delay={0.1}
          >
              {!hasActiveTemplate && (
                <div className="alert alert-warning d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <span>No active submission template exists for this publication type.</span>
                  <button
                    className="btn btn-outline-primary btn-sm"
                    type="button"
                    onClick={() => navigate('/admin/checklists')}
                  >
                    Open Template Setup
                  </button>
                </div>
              )}
              {!reviewStage && (
                <div className="alert alert-info mb-3">
                  Checklist review becomes available when the case enters library review.
                </div>
              )}
              {checklistItems.length === 0 && (
                <div className="alert alert-warning mb-0">
                  No checklist items found for this submission/template. Confirm template setup first.
                </div>
              )}
              {checklistSections.length > 0 && (
                <div className="vstack gap-3">
                  {checklistSections.map((section) => {
                    const checkedCount = section.items.filter((item) => draft[item.id]?.pass ?? true).length;
                    const isOpen = openSections[section.name] ?? false;

                    return (
                      <div key={section.name} className="border rounded-3 overflow-hidden">
                        <button
                          type="button"
                          className="w-100 text-start d-flex justify-content-between align-items-center gap-3 p-3 bg-transparent border-0"
                          onClick={() => setOpenSections((prev) => ({ ...prev, [section.name]: !isOpen }))}
                        >
                          <div>
                            <div className="fw-semibold">{section.name}</div>
                            <div className="text-muted small">{checkedCount}/{section.items.length} checked</div>
                          </div>
                          <span className="text-muted" aria-hidden="true">{isOpen ? '−' : '+'}</span>
                        </button>

                        {isOpen && (
                          <div className="px-3 pb-3">
                            <div className="vstack gap-2">
                              {section.items.map((item) => (
                                <label
                                  key={item.id}
                                  className="d-flex align-items-start gap-3 p-3 rounded-3"
                                  style={{ background: '#f8fafc', border: '1px solid #e8eff5', cursor: checklistEditable ? 'pointer' : 'default' }}
                                >
                                  <input
                                    className="form-check-input mt-1"
                                    type="checkbox"
                                    checked={draft[item.id]?.pass ?? true}
                                    disabled={!checklistEditable}
                                    onChange={(event) =>
                                      setDraft((prev) => updateDraftRow(prev, item.id, {
                                        pass: event.target.checked,
                                      }))
                                    }
                                  />
                                  <div>
                                    <div className="fw-semibold" style={{ fontSize: '0.95rem' }}>{item.itemText}</div>
                                    {item.guidanceText && (
                                      <div className="small text-muted mt-1">{item.guidanceText}</div>
                                    )}
                                  </div>
                                </label>
                              ))}
                            </div>

                            <div className="mt-3">
                              <label className="form-label">Notes</label>
                              <textarea
                                className="form-control"
                                rows={3}
                                disabled={!checklistEditable}
                                value={sectionNotes[section.name] ?? ''}
                                onChange={(event) =>
                                  setSectionNotes((prev) => ({
                                    ...prev,
                                    [section.name]: event.target.value,
                                  }))
                                }
                                placeholder="Add notes for this checklist section"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div>
                    <button
                      className="btn btn-primary btn-sm"
                      style={PILL_BUTTON_STYLE}
                      disabled={!checklistAllowed || !hasActiveTemplate || checklistItems.length === 0 || working}
                      onClick={() => void saveChecklist()}
                    >
                      Save Checklist Results
                    </button>
                  </div>
                </div>
              )}
          </ReviewCard>

          <ReviewCard
            title="Timeline"
            description="Review the timeline to confirm handoff order, feedback history, and recent workflow changes before making a decision."
            delay={0.15}
          >
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm mb-3"
              style={PILL_BUTTON_STYLE}
              onClick={() => setTimelineOpen((current) => !current)}
            >
              {timelineOpen ? 'Hide Timeline' : 'Show Timeline'}
            </button>
            {timelineOpen && <CaseTimeline items={detail.timeline ?? []} />}
          </ReviewCard>

          <ReviewCard
            title="Review Decision"
            description="Record the library decision here after reviewing the submission file, checklist results, and any existing comments."
            delay={0.2}
          >
              {!decisionAllowed && (
                <div className="alert alert-info">
                  Review decisions are available only while the case is in library review.
                </div>
              )}
              {decisionAllowed && !checklistSaved && (
                <div className="alert alert-warning">
                  Checklist results have not been saved yet. You can still approve the case, but saving the checklist first is recommended.
                </div>
              )}
              <div className="mb-3">
                  <label className="form-label">Reason for revision request</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={revisionReason}
                    onChange={(event) => setRevisionReason(event.target.value)}
                    placeholder="Explain what must be revised"
                    disabled={!decisionAllowed || working}
                  />
              </div>

              <div className="d-flex flex-wrap gap-2">
                <button
                  className="btn btn-outline-warning"
                  disabled={working || !decisionAllowed || trimmedRevisionReason.length === 0}
                  onClick={() => void requestRevision()}
                  title={decisionActionTitle(decisionAllowed, trimmedRevisionReason.length > 0, 'Provide a revision reason to continue.')}
                >
                  Request Revision
                </button>
                <button
                  className="btn btn-success"
                  style={PILL_BUTTON_STYLE}
                  disabled={working || !decisionAllowed}
                  onClick={() => void approveCase()}
                >
                  Approve for Clearance
                </button>
              </div>
          </ReviewCard>

          <ReviewCard
            title="Comments"
            description="Review comments here for supporting context from the workflow history and earlier review actions."
            delay={0.25}
            spaced={false}
          >
              {(detail.comments || []).length === 0 ? (
                <div className="text-muted small text-center py-3">No comments have been recorded for this case.</div>
              ) : (
                <div className="vstack gap-2">
                  {(detail.comments || []).map((comment) => (
                    <div className="p-3" key={comment.id}
                      style={{ background: '#f8fafc', borderRadius: '0.6rem', border: '1px solid #e8eff5' }}>
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <div className="fw-semibold small">
                          {comment.authorRole}
                          {comment.authorEmail ? ` — ${comment.authorEmail}` : ''}
                        </div>
                        <div className="text-muted small">{formatDateTime(comment.createdAt)}</div>
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{comment.body}</div>
                    </div>
                  ))}
                </div>
              )}
          </ReviewCard>
        </>
      )}
    </ShellLayout>
  );
}
