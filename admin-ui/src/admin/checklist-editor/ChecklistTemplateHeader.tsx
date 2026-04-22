import type { ChecklistTemplateResponse } from '@/types/workflow';

interface ChecklistTemplateHeaderProps {
  template: ChecklistTemplateResponse;
  hasOwnedLock: boolean;
  lockedByOther: boolean;
  isMutating: boolean;
  onCreateDraftToEdit: () => void;
  onResumeEditing: () => void;
}

export function ChecklistTemplateHeader({
  template,
  hasOwnedLock,
  lockedByOther,
  isMutating,
  onCreateDraftToEdit,
  onResumeEditing,
}: ChecklistTemplateHeaderProps) {
  return (
    <>
      <div className="su-template-editor-heading-row">
        <h2 className="su-template-editor-title mb-0">
          Editing {template.template.publicationType} V{template.template.version}
        </h2>
      </div>

      <div className="su-template-editor-status-row">
        {template.template.active ? (
          <span className="badge bg-success">ACTIVE</span>
        ) : (
          <span className="badge bg-secondary">DRAFT</span>
        )}
      </div>

      {template.template.active && (
        <div className="alert alert-warning d-flex flex-wrap align-items-center justify-content-between gap-2 py-2 su-template-editor-banner">
          <div>Active templates are read-only.</div>
          <button className="btn btn-outline-primary btn-sm su-checklist-pill-button" disabled={isMutating} onClick={onCreateDraftToEdit}>
            Create Draft to Edit
          </button>
        </div>
      )}

      {!template.template.active && lockedByOther && (
        <div className="alert alert-danger py-2 su-template-editor-banner">
          This draft is currently being edited by {template.editLock?.lockedByEmail}.
          {template.editLock?.expiresAt && (
            <> The lock expires at {new Date(template.editLock.expiresAt).toLocaleTimeString()}.</>
          )}
        </div>
      )}

      {!template.template.active && !lockedByOther && !hasOwnedLock && (
        <div className="alert alert-info d-flex flex-wrap align-items-center justify-content-between gap-2 py-2 su-template-editor-banner">
          <div>
            This draft is visible to all library admins. Click &quot;Resume Editing&quot; to acquire the exclusive edit lock before making changes.
          </div>
          <button
            className="btn btn-outline-primary btn-sm su-checklist-pill-button"
            disabled={isMutating}
            onClick={onResumeEditing}
          >
            Resume Editing
          </button>
        </div>
      )}
    </>
  );
}
