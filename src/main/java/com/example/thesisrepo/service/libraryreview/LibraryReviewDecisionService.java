package com.example.thesisrepo.service.libraryreview;

import com.example.thesisrepo.publication.AuditEventType;
import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.ReviewOutcome;
import com.example.thesisrepo.publication.SubmissionStatus;
import com.example.thesisrepo.publication.SubmissionVersion;
import com.example.thesisrepo.publication.WorkflowComment;
import com.example.thesisrepo.publication.repo.ChecklistResultRepository;
import com.example.thesisrepo.publication.repo.PublicationCaseRepository;
import com.example.thesisrepo.publication.repo.SubmissionVersionRepository;
import com.example.thesisrepo.publication.repo.WorkflowCommentRepository;
import com.example.thesisrepo.service.workflow.AuditEventService;
import com.example.thesisrepo.service.workflow.PublicationWorkflowGateService;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.CaseStatusResponse;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;

@Service
@RequiredArgsConstructor
public class LibraryReviewDecisionService {

  private final PublicationCaseRepository cases;
  private final SubmissionVersionRepository submissionVersions;
  private final WorkflowCommentRepository comments;
  private final ChecklistResultRepository checklistResults;
  private final PublicationWorkflowGateService workflowGates;
  private final AuditEventService auditEvents;
  private final EntityManager entityManager;

  @Transactional
  public CaseStatusResponse requestRevision(User admin, Long caseId, String reason) {
    PublicationCase publicationCase = workflowGates.requireCase(caseId);
    workflowGates.ensureAdminCanRequestLibraryRevision(publicationCase);

    if (!hasText(reason) && !latestSubmissionHasFailedItems(publicationCase)) {
      throw new ResponseStatusException(BAD_REQUEST, "Reason is required when no failed checklist item exists");
    }

    String commentBody = hasText(reason) ? reason.trim() : "Revision requested due to failed checklist items.";
    publicationCase.setStatus(CaseStatus.NEEDS_REVISION_LIBRARY);
    cases.save(publicationCase);

    WorkflowComment comment = saveAdminComment(publicationCase, admin, commentBody);
    auditEvents.log(
      publicationCase.getId(),
      admin,
      Role.ADMIN,
      AuditEventType.LIBRARY_REQUESTED_REVISION,
      commentBody
    );
    auditEvents.log(
      publicationCase.getId(),
      comment.getSubmissionVersion() != null ? comment.getSubmissionVersion().getId() : null,
      admin,
      Role.ADMIN,
      AuditEventType.FEEDBACK_ADDED,
      summarizeComment(commentBody, "Admin feedback posted")
    );

    entityManager.flush();
    return new CaseStatusResponse(publicationCase.getId(), publicationCase.getStatus());
  }

  @Transactional
  public CaseStatusResponse approveCase(User admin, Long caseId) {
    PublicationCase publicationCase = workflowGates.requireCase(caseId);
    workflowGates.ensureAdminCanApproveLibraryReview(publicationCase);

    SubmissionVersion latest = submissionVersions.findTopByPublicationCaseOrderByVersionNumberDesc(publicationCase)
      .orElseThrow(() -> new ResponseStatusException(CONFLICT, "No submission version found"));
    latest.setStatus(SubmissionStatus.APPROVED);
    submissionVersions.save(latest);

    publicationCase.setStatus(CaseStatus.APPROVED_FOR_CLEARANCE);
    cases.save(publicationCase);

    auditEvents.log(
      publicationCase.getId(),
      latest.getId(),
      admin,
      Role.ADMIN,
      AuditEventType.LIBRARY_APPROVED_FOR_CLEARANCE,
      "Library approved submission for clearance"
    );

    entityManager.flush();
    return new CaseStatusResponse(publicationCase.getId(), publicationCase.getStatus());
  }

  @Transactional
  public CaseStatusResponse rejectCase(User admin, Long caseId, String reason) {
    String normalizedReason = requireText(reason, "Reason is required");

    PublicationCase publicationCase = workflowGates.requireCase(caseId);
    workflowGates.ensureAdminCanRejectLibraryReview(publicationCase);

    publicationCase.setStatus(CaseStatus.REJECTED);
    cases.save(publicationCase);

    WorkflowComment comment = saveAdminComment(publicationCase, admin, normalizedReason);
    auditEvents.log(
      publicationCase.getId(),
      admin,
      Role.ADMIN,
      AuditEventType.LIBRARY_REJECTED,
      normalizedReason
    );
    auditEvents.log(
      publicationCase.getId(),
      comment.getSubmissionVersion() != null ? comment.getSubmissionVersion().getId() : null,
      admin,
      Role.ADMIN,
      AuditEventType.FEEDBACK_ADDED,
      summarizeComment(normalizedReason, "Admin feedback posted")
    );

    entityManager.flush();
    return new CaseStatusResponse(publicationCase.getId(), publicationCase.getStatus());
  }

  private WorkflowComment saveAdminComment(PublicationCase publicationCase, User admin, String body) {
    return comments.save(WorkflowComment.builder()
      .publicationCase(publicationCase)
      .author(admin)
      .authorRole(Role.ADMIN)
      .authorEmail(admin.getEmail())
      .body(body)
      .build());
  }

  private boolean latestSubmissionHasFailedItems(PublicationCase publicationCase) {
    SubmissionVersion latest = submissionVersions.findTopByPublicationCaseOrderByVersionNumberDesc(publicationCase).orElse(null);
    if (latest == null) {
      return false;
    }
    return checklistResults.findBySubmissionVersion(latest).stream()
      .anyMatch(result -> result.getPassFail() == ReviewOutcome.FAIL);
  }

  private String requireText(String value, String message) {
    if (!hasText(value)) {
      throw new ResponseStatusException(BAD_REQUEST, message);
    }
    return value.trim();
  }

  private static boolean hasText(String value) {
    return value != null && !value.isBlank();
  }

  private static String summarizeComment(String body, String fallback) {
    if (!hasText(body)) {
      return fallback;
    }
    String trimmed = body.trim();
    return trimmed.length() <= 120 ? trimmed : trimmed.substring(0, 117) + "...";
  }
}
