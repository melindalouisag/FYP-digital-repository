import type { CaseStatus } from '../../lib/types/workflow';
import { getStudentCaseWorkflowProgress } from '../lib/casePresentation';

interface StudentCaseWorkflowProgressProps {
  status: CaseStatus;
  className?: string;
}

export default function StudentCaseWorkflowProgress({
  status,
  className = '',
}: StudentCaseWorkflowProgressProps) {
  const progress = getStudentCaseWorkflowProgress(status);

  return (
    <div
      className={className}
      aria-label={`Workflow progress. Current step: ${progress.currentStepLabel}.`}
    >
      <div className="su-case-progress-summary">
        Workflow: <span className="fw-semibold text-body-secondary">{progress.currentStepLabel}</span>
      </div>
      <div className="su-case-progress" aria-hidden="true">
        {progress.steps.map((step) => (
          <span key={step.key} className={`su-case-progress-pill ${step.state}`}>
            {step.shortLabel}
          </span>
        ))}
      </div>
    </div>
  );
}
