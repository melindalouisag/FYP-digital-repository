package com.example.thesisrepo.service;

import com.example.thesisrepo.publication.AuditEventType;
import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.CaseSupervisor;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.PublicationRegistration;
import com.example.thesisrepo.publication.WorkflowComment;
import com.example.thesisrepo.publication.repo.CaseSupervisorRepository;
import com.example.thesisrepo.publication.repo.PublicationCaseRepository;
import com.example.thesisrepo.publication.repo.PublicationRegistrationRepository;
import com.example.thesisrepo.publication.repo.WorkflowCommentRepository;
import com.example.thesisrepo.service.workflow.AuditEventService;
import com.example.thesisrepo.service.workflow.CaseTimelineService;
import com.example.thesisrepo.service.workflow.PublicationWorkflowGateService;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.CaseStatusResponse;
import com.example.thesisrepo.web.dto.LecturerStudentCaseResponse;
import com.example.thesisrepo.web.dto.OperationResultResponse;
import com.example.thesisrepo.web.dto.PagedResponse;
import com.example.thesisrepo.web.dto.StudentCaseSummaryResponse;
import com.example.thesisrepo.web.dto.SubmissionSummaryResponse;
import com.example.thesisrepo.web.dto.TimelineItemDto;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

@Service
@RequiredArgsConstructor
public class LecturerReviewService {

  private final CaseSupervisorRepository caseSupervisors;
  private final PublicationCaseRepository cases;
  private final PublicationRegistrationRepository registrations;
  private final WorkflowCommentRepository comments;
  private final PublicationWorkflowGateService workflowGates;
  private final AuditEventService auditEvents;
  private final CaseTimelineService timelineService;
  private final SubmissionService submissionService;
  private final EntityManager entityManager;

  @Transactional(readOnly = true)
  public List<StudentCaseSummaryResponse> approvalQueue(User lecturer) {
    List<PublicationCase> approvalCases = caseSupervisors.findPendingApprovalsForLecturer(lecturer.getId()).stream()
      .map(CaseSupervisor::getPublicationCase)
      .toList();
    return mapCaseSummaries(approvalCases);
  }

  @Transactional(readOnly = true)
  public List<LecturerStudentCaseResponse> students(User lecturer) {
    return caseSupervisors.findByLecturer(lecturer).stream()
      .map(CaseSupervisor::getPublicationCase)
      .sorted((left, right) -> {
        if (left.getUpdatedAt() == null && right.getUpdatedAt() == null) {
          return 0;
        }
        if (left.getUpdatedAt() == null) {
          return 1;
        }
        if (right.getUpdatedAt() == null) {
          return -1;
        }
        return right.getUpdatedAt().compareTo(left.getUpdatedAt());
      })
      .map(c -> new LecturerStudentCaseResponse(
        c.getId(),
        c.getStudent().getId(),
        c.getStatus(),
        c.getType()
      ))
      .toList();
  }

  @Transactional(readOnly = true)
  public PagedResponse<StudentCaseSummaryResponse> reviewQueue(User lecturer, Pageable pageable) {
    List<CaseStatus> statuses = List.of(
      CaseStatus.UNDER_SUPERVISOR_REVIEW,
      CaseStatus.NEEDS_REVISION_SUPERVISOR
    );
    Page<PublicationCase> reviewCases = cases.findLecturerReviewQueue(lecturer.getId(), statuses, pageable);
    if (reviewCases.isEmpty()) {
      return PagedResponse.from(reviewCases, List.of());
    }
    return PagedResponse.from(reviewCases, mapCaseSummaries(reviewCases.getContent()));
  }

  @Transactional(readOnly = true)
  public List<TimelineItemDto> caseTimeline(User lecturer, Long caseId) {
    PublicationCase publicationCase = workflowGates.requireSupervisedCase(lecturer, caseId);
    return timelineService.buildTimeline(publicationCase);
  }

  @Transactional(readOnly = true)
  public List<SubmissionSummaryResponse> caseSubmissions(User lecturer, Long caseId) {
    PublicationCase publicationCase = workflowGates.requireSupervisedCase(lecturer, caseId);
    return submissionService.listSubmissionSummaries(publicationCase);
  }

  @Transactional
  public OperationResultResponse addComment(User lecturer, Long caseId, String body) {
    String normalizedBody = requireText(body, "Comment body is required");
    PublicationCase publicationCase = workflowGates.requireSupervisedCase(lecturer, caseId);

    WorkflowComment comment = comments.save(WorkflowComment.builder()
      .publicationCase(publicationCase)
      .author(lecturer)
      .authorRole(Role.LECTURER)
      .authorEmail(lecturer.getEmail())
      .body(normalizedBody)
      .build());

    auditEvents.log(
      publicationCase.getId(),
      comment.getSubmissionVersion() != null ? comment.getSubmissionVersion().getId() : null,
      lecturer,
      Role.LECTURER,
      AuditEventType.FEEDBACK_ADDED,
      summarizeComment(normalizedBody, "Lecturer feedback posted")
    );

    entityManager.flush();
    return new OperationResultResponse(true);
  }

  @Transactional
  public CaseStatusResponse requestRevision(User lecturer, Long caseId, String reason) {
    String normalizedReason = requireText(reason, "Revision reason is required");

    PublicationCase publicationCase = workflowGates.requireCase(caseId);
    workflowGates.ensureLecturerCanRequestRevision(lecturer, publicationCase);

    publicationCase.setStatus(CaseStatus.NEEDS_REVISION_SUPERVISOR);
    cases.save(publicationCase);

    WorkflowComment comment = comments.save(WorkflowComment.builder()
      .publicationCase(publicationCase)
      .author(lecturer)
      .authorRole(Role.LECTURER)
      .authorEmail(lecturer.getEmail())
      .body(normalizedReason)
      .build());

    auditEvents.log(
      publicationCase.getId(),
      lecturer,
      Role.LECTURER,
      AuditEventType.SUPERVISOR_REQUESTED_REVISION,
      normalizedReason
    );
    auditEvents.log(
      publicationCase.getId(),
      comment.getSubmissionVersion() != null ? comment.getSubmissionVersion().getId() : null,
      lecturer,
      Role.LECTURER,
      AuditEventType.FEEDBACK_ADDED,
      summarizeComment(normalizedReason, "Lecturer revision feedback posted")
    );

    entityManager.flush();
    return toStatusResponse(publicationCase);
  }

  @Transactional
  public CaseStatusResponse markReady(User lecturer, Long caseId) {
    PublicationCase publicationCase = workflowGates.requireCase(caseId);
    workflowGates.ensureLecturerCanMarkReady(lecturer, publicationCase);

    publicationCase.setStatus(CaseStatus.READY_TO_FORWARD);
    cases.save(publicationCase);

    auditEvents.log(
      publicationCase.getId(),
      lecturer,
      Role.LECTURER,
      AuditEventType.SUPERVISOR_MARKED_READY,
      "Supervisor marked submission ready for library"
    );

    entityManager.flush();
    return toStatusResponse(publicationCase);
  }

  @Transactional
  public CaseStatusResponse approveAndForward(User lecturer, Long caseId) {
    PublicationCase publicationCase = workflowGates.requireCase(caseId);

    if (publicationCase.getStatus() == CaseStatus.UNDER_SUPERVISOR_REVIEW) {
      workflowGates.ensureLecturerCanMarkReady(lecturer, publicationCase);
      publicationCase.setStatus(CaseStatus.READY_TO_FORWARD);
      cases.save(publicationCase);

      auditEvents.log(
        publicationCase.getId(),
        lecturer,
        Role.LECTURER,
        AuditEventType.SUPERVISOR_MARKED_READY,
        "Supervisor marked submission ready for library"
      );
    }

    workflowGates.ensureLecturerCanForward(lecturer, publicationCase);
    publicationCase.setStatus(CaseStatus.FORWARDED_TO_LIBRARY);
    cases.save(publicationCase);

    auditEvents.log(
      publicationCase.getId(),
      lecturer,
      Role.LECTURER,
      AuditEventType.SUPERVISOR_FORWARDED_TO_LIBRARY,
      "Supervisor approved and forwarded case to library"
    );

    entityManager.flush();
    return toStatusResponse(publicationCase);
  }

  private List<StudentCaseSummaryResponse> mapCaseSummaries(List<PublicationCase> publicationCases) {
    if (publicationCases.isEmpty()) {
      return List.of();
    }

    Map<Long, PublicationRegistration> registrationByCase = registrations.findByPublicationCaseIn(publicationCases).stream()
      .collect(Collectors.toMap(r -> r.getPublicationCase().getId(), Function.identity()));

    return publicationCases.stream()
      .map(c -> toCaseSummaryResponse(c, registrationByCase.get(c.getId())))
      .toList();
  }

  private StudentCaseSummaryResponse toCaseSummaryResponse(PublicationCase publicationCase, PublicationRegistration registration) {
    return new StudentCaseSummaryResponse(
      publicationCase.getId(),
      publicationCase.getType(),
      publicationCase.getStatus(),
      registration != null ? registration.getTitle() : null,
      publicationCase.getUpdatedAt(),
      publicationCase.getCreatedAt()
    );
  }

  private CaseStatusResponse toStatusResponse(PublicationCase publicationCase) {
    return new CaseStatusResponse(publicationCase.getId(), publicationCase.getStatus());
  }

  private String requireText(String value, String message) {
    if (value == null || value.isBlank()) {
      throw new ResponseStatusException(BAD_REQUEST, message);
    }
    return value.trim();
  }

  private static String summarizeComment(String body, String fallback) {
    if (body == null || body.isBlank()) {
      return fallback;
    }
    String trimmed = body.trim();
    return trimmed.length() <= 120 ? trimmed : trimmed.substring(0, 117) + "...";
  }
}
