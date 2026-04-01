import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ShellLayout from '../../ShellLayout';
import { checklistApi, type ChecklistTemplateSummary } from '../../lib/api/checklist';
import { useConfirmDialog } from '../../lib/components/useConfirmDialog';
import type { PublicationType } from '../../lib/workflowTypes';

type TemplateMap = Record<PublicationType, ChecklistTemplateSummary[]>;

const TYPES: PublicationType[] = ['THESIS', 'ARTICLE'];

function emptyTemplates(): TemplateMap {
  return { THESIS: [], ARTICLE: [] };
}

export default function AdminChecklistPage() {
  const navigate = useNavigate();
  const [templatesByType, setTemplatesByType] = useState<TemplateMap>(emptyTemplates());
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const { openConfirm, confirmDialog } = useConfirmDialog();

  const activeByType = useMemo(() => ({
    THESIS: templatesByType.THESIS.find((template) => template.active) ?? null,
    ARTICLE: templatesByType.ARTICLE.find((template) => template.active) ?? null,
  }), [templatesByType]);

  const loadTemplates = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [thesis, article] = await Promise.all([
        checklistApi.listTemplates('THESIS'),
        checklistApi.listTemplates('ARTICLE'),
      ]);
      setTemplatesByType({ THESIS: thesis, ARTICLE: article });
    } catch (err) {
      setTemplatesByType(emptyTemplates());
      setError(err instanceof Error ? err.message : 'Failed to load checklist templates.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadTemplates();
  }, []);

  const runMutation = async (action: () => Promise<void>, successMessage: string) => {
    setIsMutating(true);
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checklist action failed.');
    } finally {
      setIsMutating(false);
    }
  };

  const createTemplate = async (type: PublicationType) => {
    setIsMutating(true);
    setError('');
    setMessage('');

    let navigated = false;
    try {
      const created = await checklistApi.newDraft(type);
      navigated = true;
      navigate(`/admin/checklists/${created.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create checklist draft.');
    } finally {
      if (!navigated) {
        setIsMutating(false);
      }
    }
  };

  const activateTemplate = (templateId: number) => {
    openConfirm({
      title: 'Activate Template',
      message: 'This becomes active for future reviews. Continue?',
      confirmLabel: 'Activate',
      confirmVariant: 'success',
      onConfirm: async (close) => {
        await runMutation(async () => {
          await checklistApi.activate(templateId);
          await loadTemplates();
        }, 'Template activated.');
        close();
      },
    });
  };

  const deleteTemplate = (templateId: number) => {
    const template = templatesByType.THESIS.find((entry) => entry.id === templateId)
      ?? templatesByType.ARTICLE.find((entry) => entry.id === templateId);
    const prompt = template?.active
      ? 'Delete this ACTIVE template? This cannot be undone.'
      : 'Delete this draft template version? This cannot be undone.';
    openConfirm({
      title: 'Delete Template',
      message: prompt,
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
      onConfirm: async (close) => {
        await runMutation(async () => {
          await checklistApi.deleteTemplate(templateId);
          await loadTemplates();
        }, 'Template version deleted.');
        close();
      },
    });
  };

  return (
    <ShellLayout title="Templates" subtitle="Create draft checklist versions, edit them safely, and activate one version for future reviews">
      {isLoading && (
        <div className="text-center py-5">
          <div className="su-spinner mx-auto mb-3" />
          <div className="text-muted">Loading checklist templates...</div>
        </div>
      )}
      {error && <div className="alert alert-danger" style={{ borderRadius: '0.75rem' }}>{error}</div>}
      {message && <div className="alert alert-success" style={{ borderRadius: '0.75rem' }}>{message}</div>}

      {!isLoading && (
        <div className="mb-3">
          <p className="text-muted small mb-0">
            Each publication type keeps one active template for future reviews, while draft versions remain available for editing and activation.
          </p>
        </div>
      )}

      {TYPES.map((type) => (
        <div className="su-card mb-3" key={type}>
          <div className="card-body p-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <div>
                <h3 className="h6 mb-1">{type}</h3>
                <div className="small text-muted">
                  {activeByType[type] ? `Active: V${activeByType[type]?.version}` : 'No active template'}
                </div>
              </div>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-outline-primary btn-sm"
                  style={{ borderRadius: '999px' }}
                  disabled={isMutating}
                  onClick={() => void createTemplate(type)}
                >
                  Create Draft
                </button>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>Version</th>
                    <th>Status</th>
                    <th>Items</th>
                    <th>Created</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {templatesByType[type].map((template) => (
                    <tr key={template.id}>
                      <td>V{template.version}</td>
                      <td><span className={`badge ${template.active ? 'bg-success' : 'bg-secondary'}`} style={{ borderRadius: '999px' }}>{template.active ? 'ACTIVE' : 'DRAFT'}</span></td>
                      <td>{template.itemCount}</td>
                      <td>{template.createdAt ? new Date(template.createdAt).toLocaleString() : 'N/A'}</td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          <button
                            className="btn btn-outline-primary"
                            onClick={() => navigate(`/admin/checklists/${template.id}/edit`)}
                          >
                            {template.active ? 'View Items' : 'Edit Items'}
                          </button>
                          <button className="btn btn-danger" onClick={() => deleteTemplate(template.id)} disabled={isMutating}>
                            Delete
                          </button>
                          {!template.active && (
                            <button className="btn btn-success" onClick={() => activateTemplate(template.id)} disabled={isMutating}>
                              Activate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {templatesByType[type].length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-muted">No template versions yet. Create a draft template above to begin.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}
      {confirmDialog}
    </ShellLayout>
  );
}
