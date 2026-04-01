import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ConfirmDialogVariant = 'primary' | 'danger' | 'success' | 'secondary' | 'warning';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ConfirmDialogVariant;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  loading = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [loading, onCancel, open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className="modal d-block"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      style={{ background: 'rgba(15, 23, 42, 0.45)' }}
      onClick={() => {
        if (!loading) {
          onCancel();
        }
      }}
    >
      <div className="modal-dialog modal-dialog-centered" onClick={(event) => event.stopPropagation()}>
        <div className="modal-content" style={{ borderRadius: '1rem', border: '1px solid rgba(148, 163, 184, 0.25)' }}>
          <div className="modal-header border-0 pb-0">
            <h2 className="modal-title fs-5" id="confirm-dialog-title">{title}</h2>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              disabled={loading}
              onClick={onCancel}
            />
          </div>
          <div className="modal-body pt-2">
            <div className="text-muted" style={{ lineHeight: 1.6 }}>
              {message}
            </div>
          </div>
          <div className="modal-footer border-0 pt-0">
            <button type="button" className="btn btn-outline-secondary" onClick={onCancel} disabled={loading}>
              {cancelLabel}
            </button>
            <button type="button" className={`btn btn-${confirmVariant}`} onClick={onConfirm} disabled={loading}>
              {loading ? 'Working...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
