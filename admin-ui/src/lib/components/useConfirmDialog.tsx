import { useState, type ReactNode } from 'react';
import ConfirmDialog from './ConfirmDialog';

type ConfirmDialogVariant = 'primary' | 'danger' | 'success' | 'secondary' | 'warning';
type CloseConfirmDialog = () => void;

interface ConfirmDialogRequest {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ConfirmDialogVariant;
  onConfirm?: (close: CloseConfirmDialog) => void | Promise<void>;
}

export function useConfirmDialog() {
  const [request, setRequest] = useState<ConfirmDialogRequest | null>(null);
  const [loading, setLoading] = useState(false);

  const closeDialog = () => {
    if (!loading) {
      setRequest(null);
    }
  };

  const openConfirm = (nextRequest: ConfirmDialogRequest) => {
    setRequest(nextRequest);
  };

  const handleConfirm = async () => {
    if (!request) {
      return;
    }

    if (!request.onConfirm) {
      setRequest(null);
      return;
    }

    setLoading(true);
    try {
      await request.onConfirm(() => setRequest(null));
    } finally {
      setLoading(false);
    }
  };

  return {
    openConfirm,
    closeConfirm: closeDialog,
    confirmDialog: (
      <ConfirmDialog
        open={request !== null}
        title={request?.title ?? ''}
        message={request?.message ?? ''}
        confirmLabel={request?.confirmLabel}
        cancelLabel={request?.cancelLabel}
        confirmVariant={request?.confirmVariant}
        loading={loading}
        onCancel={closeDialog}
        onConfirm={() => void handleConfirm()}
      />
    ),
  };
}
