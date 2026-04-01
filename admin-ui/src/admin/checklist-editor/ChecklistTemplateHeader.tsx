import type { ChecklistTemplateResponse } from '../../lib/workflowTypes';

interface ChecklistTemplateHeaderProps {
  template: ChecklistTemplateResponse;
  hasOwnedLock: boolean;
  lockedByOther: boolean;
  isMutating: boolean;
  onCreateDraftToEdit: () => void;
  onReleaseEditingLock: () => void;
  onResumeEditing: () => void;
}

export function ChecklistTemplateHeader({
  template,
  hasOwnedLock,
  lockedByOther,
  isMutating,
  onCreateDraftToEdit,
  onReleaseEditingLock,
  onResumeEditing,
}: ChecklistTemplateHeaderProps) {
  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h3 className="h6 mb-0">
          Editing {template.template.publicationType} V{template.template.version}{' '}
          {template.template.active && <span className="badge bg-success ms-1">ACTIVE</span>}
          {!template.template.active && <span className="badge bg-secondary ms-1">DRAFT</span>}
        </h3>
        <div className="d-flex flex-wrap gap-2">
          {!template.template.active && hasOwnedLock && (
            <button
              className="btn btn-outline-secondary btn-sm"
              style={{ borderRadius: '999px' }}
              disabled={isMutating}
              onClick={onReleaseEditingLock}
            >
              Cancel Editing
            </button>
          )}
          {!template.template.active && !hasOwnedLock && !lockedByOther && (
            <button
              className="btn btn-outline-primary btn-sm"
              style={{ borderRadius: '999px' }}
              disabled={isMutating}
              onClick={onResumeEditing}
            >
              Resume Editing
            </button>
          )}
        </div>
      </div>

      {template.template.active && (
        <div className="alert alert-warning d-flex flex-wrap align-items-center justify-content-between gap-2 py-2">
          <div>Active templates are read-only.</div>
          <button className="btn btn-outline-primary btn-sm" disabled={isMutating} onClick={onCreateDraftToEdit}>
            Create Draft to Edit
          </button>
        </div>
      )}

      {!template.template.active && lockedByOther && (
        <div className="alert alert-danger py-2">
          This draft is currently being edited by {template.editLock?.lockedByEmail}.
          {template.editLock?.expiresAt && (
            <> The lock expires at {new Date(template.editLock.expiresAt).toLocaleTimeString()}.</>
          )}
        </div>
      )}

      {!template.template.active && !lockedByOther && !hasOwnedLock && (
        <div className="alert alert-info py-2">
          This draft is visible to all library admins. Click &quot;Resume Editing&quot; to acquire the exclusive edit lock before making changes.
        </div>
      )}
    </>
  );
}
