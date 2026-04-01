package com.example.thesisrepo.service.libraryreview;

import com.example.thesisrepo.profile.StudentProfile;
import com.example.thesisrepo.profile.StudentProfileRepository;
import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.ClearanceForm;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.PublicationRegistration;
import com.example.thesisrepo.publication.PublicationType;
import com.example.thesisrepo.publication.SubmissionVersion;
import com.example.thesisrepo.publication.WorkflowComment;
import com.example.thesisrepo.publication.repo.ClearanceFormRepository;
import com.example.thesisrepo.publication.repo.PublicationCaseRepository;
import com.example.thesisrepo.publication.repo.PublicationRegistrationRepository;
import com.example.thesisrepo.publication.repo.SubmissionVersionRepository;
import com.example.thesisrepo.publication.repo.WorkflowCommentRepository;
import com.example.thesisrepo.service.SubmissionService;
import com.example.thesisrepo.service.workflow.CaseTimelineService;
import com.example.thesisrepo.service.workflow.PublicationWorkflowGateService;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.AdminCaseDetailResponse;
import com.example.thesisrepo.web.dto.AdminCaseQueueDto;
import com.example.thesisrepo.web.dto.AdminStudentGroupDto;
import com.example.thesisrepo.web.dto.ClearanceResponse;
import com.example.thesisrepo.web.dto.PagedResponse;
import com.example.thesisrepo.web.dto.RegistrationDetailResponse;
import com.example.thesisrepo.web.dto.StudentCaseSummaryResponse;
import com.example.thesisrepo.web.dto.WorkflowCommentResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LibraryReviewReadService {

  private final PublicationCaseRepository cases;
  private final SubmissionVersionRepository submissionVersions;
  private final WorkflowCommentRepository comments;
  private final PublicationRegistrationRepository registrations;
  private final ClearanceFormRepository clearances;
  private final StudentProfileRepository studentProfiles;
  private final PublicationWorkflowGateService workflowGates;
  private final CaseTimelineService timelineService;
  private final SubmissionService submissionService;

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
      .filter(LibraryReviewReadService::hasText)
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

  private static boolean hasText(String value) {
    return value != null && !value.isBlank();
  }
}
