package com.example.thesisrepo.service.lecturer;

import com.example.thesisrepo.profile.StudentProfile;
import com.example.thesisrepo.profile.StudentProfileRepository;
import com.example.thesisrepo.publication.AuditEvent;
import com.example.thesisrepo.publication.AuditEventType;
import com.example.thesisrepo.publication.CaseStatus;
import com.example.thesisrepo.publication.CaseSupervisor;
import com.example.thesisrepo.publication.PublicationCase;
import com.example.thesisrepo.publication.PublicationRegistration;
import com.example.thesisrepo.publication.SubmissionVersion;
import com.example.thesisrepo.publication.WorkflowComment;
import com.example.thesisrepo.publication.repo.AuditEventRepository;
import com.example.thesisrepo.publication.repo.CaseSupervisorRepository;
import com.example.thesisrepo.publication.repo.PublicationRegistrationRepository;
import com.example.thesisrepo.publication.repo.SubmissionVersionRepository;
import com.example.thesisrepo.publication.repo.WorkflowCommentRepository;
import com.example.thesisrepo.service.SubmissionDownloadResponseService;
import com.example.thesisrepo.service.workflow.PublicationWorkflowGateService;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.LecturerApprovalQueueRowDto;
import com.example.thesisrepo.web.dto.LecturerCaseWorkItemDto;
import com.example.thesisrepo.web.dto.LecturerStudentGroupDto;
import com.example.thesisrepo.web.dto.PagedResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
@RequiredArgsConstructor
public class LecturerStudentQueryService {

  private static final int DEFAULT_PAGE_SIZE = 10;
  private static final int MAX_PAGE_SIZE = 100;

  private static final Set<CaseStatus> PENDING_SUPERVISOR_STATUSES = Set.of(
    CaseStatus.UNDER_SUPERVISOR_REVIEW,
    CaseStatus.NEEDS_REVISION_SUPERVISOR,
    CaseStatus.READY_TO_FORWARD
  );

  private static final Set<CaseStatus> LIBRARY_TRACKING_STATUSES = Set.of(
    CaseStatus.FORWARDED_TO_LIBRARY,
    CaseStatus.UNDER_LIBRARY_REVIEW,
    CaseStatus.NEEDS_REVISION_LIBRARY,
    CaseStatus.APPROVED_FOR_CLEARANCE,
    CaseStatus.CLEARANCE_SUBMITTED,
    CaseStatus.CLEARANCE_APPROVED,
    CaseStatus.READY_TO_PUBLISH,
    CaseStatus.PUBLISHED
  );

  private final CaseSupervisorRepository caseSupervisors;
  private final PublicationRegistrationRepository registrations;
  private final WorkflowCommentRepository comments;
  private final SubmissionVersionRepository submissionVersions;
  private final AuditEventRepository auditEventRepository;
  private final StudentProfileRepository studentProfiles;
  private final PublicationWorkflowGateService workflowGates;
  private final SubmissionDownloadResponseService submissionDownloadResponseService;
  private final LecturerStudentResponseFactory responseFactory;

  @Transactional(readOnly = true)
  public PagedResponse<LecturerApprovalQueueRowDto> approvalQueueDetail(User lecturer, int page, int size) {
    Page<PublicationRegistration> registrationsPage = registrations.findLecturerApprovalQueue(
      lecturer.getId(),
      PageRequest.of(Math.max(page, 0), normalizePageSize(size))
    );

    List<PublicationRegistration> approvalRegistrations = registrationsPage.getContent();
    List<PublicationCase> approvalCases = approvalRegistrations.stream()
      .map(PublicationRegistration::getPublicationCase)
      .toList();
    Map<Long, StudentProfile> profileByUser = loadStudentProfiles(approvalCases);

    List<LecturerApprovalQueueRowDto> items = approvalRegistrations.stream()
      .map(registration -> responseFactory.toApprovalQueueRow(
        registration,
        profileByUser.get(registration.getPublicationCase().getStudent().getId())
      ))
      .toList();
    return PagedResponse.from(registrationsPage, items);
  }

  @Transactional(readOnly = true)
  public List<LecturerStudentGroupDto> pendingSupervisor(User lecturer, Integer year) {
    return groupCasesByStudent(filterCasesByStatusAndYear(lecturer, PENDING_SUPERVISOR_STATUSES, year));
  }

  @Transactional(readOnly = true)
  public List<LecturerStudentGroupDto> libraryTracking(User lecturer, Integer year) {
    return groupCasesByStudent(filterCasesByStatusAndYear(lecturer, LIBRARY_TRACKING_STATUSES, year));
  }

  @Transactional(readOnly = true)
  public List<LecturerStudentGroupDto> myStudents(User lecturer, Integer year) {
    return groupCasesByStudent(filterCasesByStatusAndYear(lecturer, null, year));
  }

  @Transactional(readOnly = true)
  public ResponseEntity<Resource> downloadLatestSubmission(User lecturer, Long caseId) {
    PublicationCase publicationCase = workflowGates.requireSupervisedCase(lecturer, caseId);
    SubmissionVersion latest = submissionVersions.findTopByPublicationCaseOrderByVersionNumberDesc(publicationCase)
      .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "No submissions found"));
    return submissionDownloadResponseService.buildResponse(latest);
  }

  @Transactional(readOnly = true)
  public ResponseEntity<Resource> downloadSubmission(User lecturer, Long caseId, Long submissionId) {
    PublicationCase publicationCase = workflowGates.requireSupervisedCase(lecturer, caseId);
    SubmissionVersion submission = submissionVersions.findById(submissionId)
      .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Submission not found"));
    if (!submission.getPublicationCase().getId().equals(publicationCase.getId())) {
      throw new ResponseStatusException(BAD_REQUEST, "Submission does not belong to this publication");
    }
    return submissionDownloadResponseService.buildResponse(submission);
  }

  private List<PublicationCase> filterCasesByStatusAndYear(User lecturer, Set<CaseStatus> statuses, Integer year) {
    List<PublicationCase> supervisedCases = caseSupervisors.findByLecturer(lecturer).stream()
      .map(CaseSupervisor::getPublicationCase)
      .distinct()
      .toList();

    Map<Long, PublicationRegistration> registrationByCase = loadRegistrations(supervisedCases);

    return supervisedCases.stream()
      .filter(publicationCase -> statuses == null || statuses.contains(publicationCase.getStatus()))
      .filter(publicationCase -> {
        if (year == null) {
          return true;
        }
        PublicationRegistration registration = registrationByCase.get(publicationCase.getId());
        return registration != null && Objects.equals(registration.getYear(), year);
      })
      .sorted(Comparator.comparing(PublicationCase::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
      .toList();
  }

  private List<LecturerStudentGroupDto> groupCasesByStudent(List<PublicationCase> publicationCases) {
    if (publicationCases.isEmpty()) {
      return List.of();
    }

    Map<Long, PublicationRegistration> registrationByCase = loadRegistrations(publicationCases);
    Map<Long, StudentProfile> profileByUser = loadStudentProfiles(publicationCases);
    Map<Long, User> studentById = new LinkedHashMap<>();
    Map<Long, List<LecturerCaseWorkItemDto>> groupedItems = new LinkedHashMap<>();

    for (PublicationCase publicationCase : publicationCases) {
      User student = publicationCase.getStudent();
      studentById.putIfAbsent(student.getId(), student);
      groupedItems.computeIfAbsent(student.getId(), key -> new ArrayList<>())
        .add(toCaseWorkItem(publicationCase, registrationByCase.get(publicationCase.getId())));
    }

    return groupedItems.entrySet().stream()
      .map(entry -> responseFactory.toStudentGroup(
        studentById.get(entry.getKey()),
        profileByUser.get(entry.getKey()),
        entry.getValue()
      ))
      .sorted(Comparator.comparing(LecturerStudentGroupDto::studentName, Comparator.nullsLast(String::compareToIgnoreCase)))
      .toList();
  }

  private LecturerCaseWorkItemDto toCaseWorkItem(PublicationCase publicationCase, PublicationRegistration registration) {
    Instant latestSubmissionAt = submissionVersions.findTopByPublicationCaseOrderByVersionNumberDesc(publicationCase)
      .map(SubmissionVersion::getCreatedAt)
      .orElse(null);

    Instant lastLecturerFeedbackAt = comments
      .findTopByPublicationCaseAndAuthorRoleOrderByCreatedAtDesc(publicationCase, Role.LECTURER)
      .map(WorkflowComment::getCreatedAt)
      .orElse(null);

    Instant lecturerForwardedAt = auditEventRepository
      .findTopByCaseIdAndEventTypeOrderByCreatedAtDesc(publicationCase.getId(), AuditEventType.SUPERVISOR_FORWARDED_TO_LIBRARY)
      .map(AuditEvent::getCreatedAt)
      .orElse(null);

    Instant lastLibraryFeedbackAt = comments
      .findTopByPublicationCaseAndAuthorRoleOrderByCreatedAtDesc(publicationCase, Role.ADMIN)
      .map(WorkflowComment::getCreatedAt)
      .orElse(null);

    Instant libraryApprovedAt = auditEventRepository
      .findTopByCaseIdAndEventTypeOrderByCreatedAtDesc(publicationCase.getId(), AuditEventType.LIBRARY_APPROVED_FOR_CLEARANCE)
      .map(AuditEvent::getCreatedAt)
      .orElse(null);

    return responseFactory.toCaseWorkItem(
      publicationCase,
      registration,
      latestSubmissionAt,
      lastLecturerFeedbackAt,
      lecturerForwardedAt,
      lastLibraryFeedbackAt,
      libraryApprovedAt
    );
  }

  private Map<Long, PublicationRegistration> loadRegistrations(List<PublicationCase> publicationCases) {
    if (publicationCases.isEmpty()) {
      return Map.of();
    }

    return registrations.findByPublicationCaseIn(publicationCases).stream()
      .collect(Collectors.toMap(
        registration -> registration.getPublicationCase().getId(),
        Function.identity()
      ));
  }

  private Map<Long, StudentProfile> loadStudentProfiles(List<PublicationCase> publicationCases) {
    if (publicationCases.isEmpty()) {
      return Map.of();
    }

    List<Long> studentIds = publicationCases.stream()
      .map(publicationCase -> publicationCase.getStudent().getId())
      .distinct()
      .toList();
    return studentProfiles.findByUserIdIn(studentIds).stream()
      .collect(Collectors.toMap(StudentProfile::getUserId, Function.identity()));
  }

  private static int normalizePageSize(int requestedSize) {
    if (requestedSize < 1) {
      return DEFAULT_PAGE_SIZE;
    }
    return Math.min(requestedSize, MAX_PAGE_SIZE);
  }
}
