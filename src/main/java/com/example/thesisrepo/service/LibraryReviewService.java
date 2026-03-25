package com.example.thesisrepo.service;

import com.example.thesisrepo.profile.StudentProfile;
import com.example.thesisrepo.profile.StudentProfileRepository;
import com.example.thesisrepo.publication.AuditEventType;
import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.ChecklistItemV2;
import com.example.thesisrepo.publication.ClearanceForm;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.PublicationRegistration;
import com.example.thesisrepo.publication.PublicationType;
import com.example.thesisrepo.publication.ReviewOutcome;
import com.example.thesisrepo.publication.SubmissionStatus;
import com.example.thesisrepo.publication.SubmissionVersion;
import com.example.thesisrepo.publication.WorkflowComment;
import com.example.thesisrepo.publication.repo.ChecklistItemV2Repository;
import com.example.thesisrepo.publication.repo.ChecklistResultRepository;
import com.example.thesisrepo.publication.repo.ClearanceFormRepository;
import com.example.thesisrepo.publication.repo.PublicationCaseRepository;
import com.example.thesisrepo.publication.repo.PublicationRegistrationRepository;
import com.example.thesisrepo.publication.repo.SubmissionVersionRepository;
import com.example.thesisrepo.publication.repo.WorkflowCommentRepository;
import com.example.thesisrepo.service.workflow.AuditEventService;
import com.example.thesisrepo.service.workflow.CaseTimelineService;
import com.example.thesisrepo.service.workflow.PublicationWorkflowGateService;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.AdminCaseQueueDto;
import com.example.thesisrepo.web.dto.AdminCaseDetailResponse;
import com.example.thesisrepo.web.dto.AdminStudentGroupDto;
import com.example.thesisrepo.web.dto.CaseStatusResponse;
import com.example.thesisrepo.web.dto.ClearanceResponse;
import com.example.thesisrepo.web.dto.OperationResultResponse;
import com.example.thesisrepo.web.dto.PagedResponse;
import com.example.thesisrepo.web.dto.RegistrationDetailResponse;
import com.example.thesisrepo.web.dto.StudentCaseSummaryResponse;
import com.example.thesisrepo.web.dto.WorkflowCommentResponse;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;

@Service
@RequiredArgsConstructor
public class LibraryReviewService {

  private final PublicationCaseRepository cases;
  private final SubmissionVersionRepository submissionVersions;
  private final WorkflowCommentRepository comments;
  private final PublicationRegistrationRepository registrations;
  private final ChecklistItemV2Repository checklistItems;
  private final ChecklistResultRepository checklistResults;
  private final ClearanceFormRepository clearances;
  private final StudentProfileRepository studentProfiles;
  private final PublicationWorkflowGateService workflowGates;
  private final AuditEventService auditEvents;
  private final CaseTimelineService timelineService;
  private final SubmissionService submissionService;
  private final EntityManager entityManager;

  @Transactional(readOnly = true)
  public PagedResponse<StudentCaseSummaryResponse> reviewQueue(Pageable pageable, CaseStatus status, PublicationType type) {
    List<CaseStatus> defaultQueue = List.of(
      CaseStatus.FORWARDED_TO_LIBRARY,
      CaseStatus.UNDER_LIBRARY_REVIEW,
      CaseStatus.NEEDS_REVISION_LIBRARY
    );

    if (status != null && !defaultQueue.contains(status)) {
      return PagedResponse.from(Page.empty(pageable), List.of());
    }

    List<CaseStatus> statuses = status != null ? List.of(status) : defaultQueue;
    Page<PublicationCase> reviewCases = cases.findAdminReviewQueue(statuses, type, pageable);

    if (reviewCases.isEmpty()) {
      return PagedResponse.from(reviewCases, List.of());
    }

    Map<Long, PublicationRegistration> registrationByCase = registrations.findByPublicationCaseIn(reviewCases.getContent()).stream()
      .collect(Collectors.toMap(r -> r.getPublicationCase().getId(), Function.identity()));

    List<StudentCaseSummaryResponse> items = reviewCases.getContent().stream()
      .map(c -> toCaseSummaryResponse(c, registrationByCase.get(c.getId())))
      .toList();
    return PagedResponse.from(reviewCases, items);
  }

  @Transactional(readOnly = true)
  public List<AdminStudentGroupDto> reviewQueueGrouped() {
    List<CaseStatus> statuses = List.of(
      CaseStatus.FORWARDED_TO_LIBRARY,
      CaseStatus.UNDER_LIBRARY_REVIEW,
      CaseStatus.NEEDS_REVISION_LIBRARY
    );
    List<PublicationCase> reviewCases = cases.findByStatusInOrderByUpdatedAtDesc(statuses);
    if (reviewCases.isEmpty()) {
      return List.of();
    }

    Map<Long, PublicationRegistration> registrationByCase = registrations.findByPublicationCaseIn(reviewCases).stream()
      .collect(Collectors.toMap(r -> r.getPublicationCase().getId(), Function.identity()));
    Map<Long, StudentProfile> profileByUser = loadStudentProfiles(reviewCases);
    Map<Long, List<AdminCaseQueueDto>> groupedCases = new java.util.HashMap<>();
    for (PublicationCase publicationCase : reviewCases) {
      PublicationRegistration registration = registrationByCase.get(publicationCase.getId());
      groupedCases.computeIfAbsent(publicationCase.getStudent().getId(), key -> new ArrayList<>())
        .add(toAdminCaseQueueDto(publicationCase, registration));
    }

    return groupedCases.entrySet().stream()
      .map(entry -> {
        Long studentUserId = entry.getKey();
        StudentProfile profile = profileByUser.get(studentUserId);
        User student = reviewCases.stream()
          .map(PublicationCase::getStudent)
          .filter(user -> user.getId().equals(studentUserId))
          .findFirst()
          .orElseThrow();
        return new AdminStudentGroupDto(
          studentUserId,
          profile != null ? profile.getName() : student.getEmail(),
          profile != null ? profile.getStudentId() : null,
          profile != null ? profile.getFaculty() : null,
          profile != null ? profile.getProgram() : null,
          entry.getValue()
        );
      })
      .sorted(Comparator.comparing(AdminStudentGroupDto::studentName, Comparator.nullsLast(String::compareToIgnoreCase)))
      .toList();
  }

  @Transactional(readOnly = true)
  public AdminCaseDetailResponse caseDetail(Long caseId) {
    PublicationCase publicationCase = workflowGates.requireCase(caseId);
    PublicationRegistration registration = registrations.findByPublicationCase(publicationCase).orElse(null);

    return new AdminCaseDetailResponse(
      toCaseSummaryResponse(publicationCase, registration),
      toRegistrationResponse(registration),
      submissionService.listSubmissionDetails(publicationCase),
      comments.findByPublicationCaseOrderByCreatedAtAsc(publicationCase).stream()
        .map(this::toWorkflowCommentResponse)
        .toList(),
      clearances.findByPublicationCase(publicationCase)
        .map(this::toClearanceResponse)
        .orElse(null),
      timelineService.buildTimeline(publicationCase)
    );
  }

  @Transactional
  public OperationResultResponse saveChecklistResults(User admin, Long caseId, SaveChecklistResultsCommand command) {
    PublicationCase publicationCase = workflowGates.requireCase(caseId);
    workflowGates.ensureAdminCanSaveChecklist(publicationCase);

    SubmissionVersion version = submissionVersions.findById(command.submissionVersionId())
      .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Submission version not found"));
    workflowGates.ensureSubmissionBelongsToCase(version, publicationCase);

    Long templateId = version.getChecklistTemplate() != null ? version.getChecklistTemplate().getId() : null;
    checklistResults.deleteBySubmissionVersion(version);

    for (ChecklistEntryCommand entry : command.results()) {
      ChecklistItemV2 item = checklistItems.findById(entry.checklistItemId())
        .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Checklist item not found"));
      if (templateId != null && !item.getTemplate().getId().equals(templateId)) {
        throw new ResponseStatusException(BAD_REQUEST, "Checklist item does not belong to this submission template version");
      }

      checklistResults.save(com.example.thesisrepo.publication.ChecklistResult.builder()
        .submissionVersion(version)
        .checklistItem(item)
        .passFail(entry.pass() ? ReviewOutcome.PASS : ReviewOutcome.FAIL)
        .note(entry.note())
        .build());
    }

    version.setStatus(SubmissionStatus.UNDER_REVIEW);
    submissionVersions.save(version);
    publicationCase.setStatus(CaseStatus.UNDER_LIBRARY_REVIEW);
    cases.save(publicationCase);

    auditEvents.log(
      publicationCase.getId(),
      version.getId(),
      admin,
      Role.ADMIN,
      AuditEventType.LIBRARY_CHECKLIST_REVIEWED,
      "Checklist results saved for submission v" + version.getVersionNumber()
    );

    entityManager.flush();
    return new OperationResultResponse(true);
  }

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
    return toStatusResponse(publicationCase);
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
    return toStatusResponse(publicationCase);
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
    return toStatusResponse(publicationCase);
  }

  private StudentCaseSummaryResponse toCaseSummaryResponse(PublicationCase publicationCase, PublicationRegistration registration) {
    return new StudentCaseSummaryResponse(
      publicationCase.getId(),
      publicationCase.getType(),
      publicationCase.getStatus(),
      resolveCaseTitle(publicationCase, registration),
      publicationCase.getUpdatedAt(),
      publicationCase.getCreatedAt()
    );
  }

  private String resolveCaseTitle(PublicationCase publicationCase, PublicationRegistration registration) {
    if (registration != null && hasText(registration.getTitle())) {
      return registration.getTitle();
    }
    return submissionVersions.findTopByPublicationCaseOrderByVersionNumberDesc(publicationCase)
      .map(SubmissionVersion::getMetadataTitle)
      .filter(LibraryReviewService::hasText)
      .orElse(null);
  }

  private Map<Long, StudentProfile> loadStudentProfiles(List<PublicationCase> publicationCases) {
    List<Long> studentIds = publicationCases.stream()
      .map(c -> c.getStudent().getId())
      .distinct()
      .toList();
    return studentProfiles.findByUserIdIn(studentIds).stream()
      .collect(Collectors.toMap(StudentProfile::getUserId, Function.identity()));
  }

  private AdminCaseQueueDto toAdminCaseQueueDto(PublicationCase publicationCase, PublicationRegistration registration) {
    Instant latestSubmissionAt = submissionVersions.findTopByPublicationCaseOrderByVersionNumberDesc(publicationCase)
      .map(SubmissionVersion::getCreatedAt)
      .orElse(null);
    return new AdminCaseQueueDto(
      publicationCase.getId(),
      registration != null ? registration.getTitle() : null,
      publicationCase.getType(),
      publicationCase.getStatus(),
      publicationCase.getUpdatedAt(),
      latestSubmissionAt
    );
  }

  private RegistrationDetailResponse toRegistrationResponse(PublicationRegistration registration) {
    if (registration == null) {
      return null;
    }
    return new RegistrationDetailResponse(
      registration.getId(),
      registration.getTitle(),
      registration.getYear(),
      registration.getArticlePublishIn(),
      registration.getFaculty(),
      registration.getStudentIdNumber(),
      registration.getAuthorName(),
      registration.getPermissionAcceptedAt(),
      registration.getSubmittedAt(),
      registration.getSupervisorDecisionAt(),
      registration.getSupervisorDecisionNote()
    );
  }

  private WorkflowCommentResponse toWorkflowCommentResponse(WorkflowComment comment) {
    return new WorkflowCommentResponse(
      comment.getId(),
      comment.getSubmissionVersion() != null ? comment.getSubmissionVersion().getId() : null,
      comment.getAuthorRole(),
      comment.getAuthorEmail(),
      comment.getBody(),
      comment.getCreatedAt()
    );
  }

  private ClearanceResponse toClearanceResponse(ClearanceForm clearanceForm) {
    return new ClearanceResponse(
      clearanceForm.getId(),
      clearanceForm.getStatus(),
      clearanceForm.getNote(),
      clearanceForm.getSubmittedAt(),
      clearanceForm.getApprovedAt()
    );
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

  private CaseStatusResponse toStatusResponse(PublicationCase publicationCase) {
    return new CaseStatusResponse(publicationCase.getId(), publicationCase.getStatus());
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

  public record SaveChecklistResultsCommand(
    Long submissionVersionId,
    List<ChecklistEntryCommand> results
  ) {
    public SaveChecklistResultsCommand {
      results = results == null ? List.of() : List.copyOf(results);
    }
  }

  public record ChecklistEntryCommand(
    Long checklistItemId,
    boolean pass,
    String note
  ) {
  }
}
