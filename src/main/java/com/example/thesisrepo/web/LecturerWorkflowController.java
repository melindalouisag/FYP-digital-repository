package com.example.thesisrepo.web;

import com.example.thesisrepo.profile.StudentProfile;
import com.example.thesisrepo.profile.StudentProfileRepository;
import com.example.thesisrepo.publication.*;
import com.example.thesisrepo.publication.repo.*;
import com.example.thesisrepo.service.CurrentUserService;
import com.example.thesisrepo.service.LecturerReviewService;
import com.example.thesisrepo.service.RegistrationService;
import com.example.thesisrepo.service.StorageService;
import com.example.thesisrepo.service.workflow.PublicationWorkflowGateService;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.CaseStatusResponse;
import com.example.thesisrepo.web.dto.LecturerApprovalQueueRowDto;
import com.example.thesisrepo.web.dto.LecturerCaseWorkItemDto;
import com.example.thesisrepo.web.dto.LecturerStudentCaseResponse;
import com.example.thesisrepo.web.dto.LecturerStudentGroupDto;
import com.example.thesisrepo.web.dto.OperationResultResponse;
import com.example.thesisrepo.web.dto.PagedResponse;
import com.example.thesisrepo.web.dto.StudentCaseSummaryResponse;
import com.example.thesisrepo.web.dto.SubmissionSummaryResponse;
import com.example.thesisrepo.web.dto.TimelineItemDto;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/lecturer")
@RequiredArgsConstructor
@PreAuthorize("hasRole('LECTURER')")
public class LecturerWorkflowController {

  private static final int DEFAULT_PAGE_SIZE = 10;
  private static final int MAX_PAGE_SIZE = 100;

  private final CaseSupervisorRepository caseSupervisors;
  private final PublicationRegistrationRepository registrations;
  private final WorkflowCommentRepository comments;
  private final SubmissionVersionRepository submissionVersions;
  private final AuditEventRepository auditEventRepository;
  private final StudentProfileRepository studentProfiles;
  private final StorageService storageService;
  private final CurrentUserService currentUser;
  private final RegistrationService registrationService;
  private final LecturerReviewService lecturerReviewService;
  private final PublicationWorkflowGateService workflowGates;

  @GetMapping("/approvals")
  public List<StudentCaseSummaryResponse> approvalQueue() {
    User me = currentUser.requireCurrentUser();
    return lecturerReviewService.approvalQueue(me);
  }

  @GetMapping("/approval-queue")
  public PagedResponse<LecturerApprovalQueueRowDto> approvalQueueDetail(
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "10") int size
  ) {
    User me = currentUser.requireCurrentUser();
    Page<PublicationRegistration> registrationsPage = registrations.findLecturerApprovalQueue(
      me.getId(),
      PageRequest.of(Math.max(page, 0), normalizePageSize(size))
    );

    List<PublicationRegistration> approvalRegistrations = registrationsPage.getContent();
    List<PublicationCase> approvalCases = approvalRegistrations.stream()
      .map(PublicationRegistration::getPublicationCase)
      .toList();
    Map<Long, StudentProfile> profileByUser = loadStudentProfiles(approvalCases);

    List<LecturerApprovalQueueRowDto> items = approvalRegistrations.stream()
      .map(registration -> toApprovalQueueRow(registration, profileByUser))
      .toList();
    return PagedResponse.from(registrationsPage, items);
  }

  @PostMapping("/approvals/{caseId}/approve")
  public ResponseEntity<CaseStatusResponse> approveRegistration(@PathVariable Long caseId) {
    User me = currentUser.requireCurrentUser();
    return ResponseEntity.ok(registrationService.approveRegistrationByLecturer(me, caseId));
  }

  @PostMapping("/approvals/{caseId}/reject")
  public ResponseEntity<CaseStatusResponse> rejectRegistration(@PathVariable Long caseId, @RequestBody DecisionRequest req) {
    User me = currentUser.requireCurrentUser();
    return ResponseEntity.ok(registrationService.rejectRegistrationByLecturer(me, caseId, req.getNote()));
  }

  @GetMapping("/review")
  public List<StudentCaseSummaryResponse> reviewQueue() {
    User me = currentUser.requireCurrentUser();
    return lecturerReviewService.reviewQueue(me);
  }

  @GetMapping("/pending-supervisor")
  public List<LecturerStudentGroupDto> pendingSupervisor(@RequestParam(required = false) Integer year) {
    User me = currentUser.requireCurrentUser();
    Set<CaseStatus> statuses = Set.of(
      CaseStatus.UNDER_SUPERVISOR_REVIEW,
      CaseStatus.NEEDS_REVISION_SUPERVISOR,
      CaseStatus.READY_TO_FORWARD
    );
    return groupCasesByStudent(filterCasesByStatusAndYear(me, statuses, year));
  }

  @GetMapping("/library-tracking")
  public List<LecturerStudentGroupDto> libraryTracking(@RequestParam(required = false) Integer year) {
    User me = currentUser.requireCurrentUser();
    Set<CaseStatus> statuses = Set.of(
      CaseStatus.FORWARDED_TO_LIBRARY,
      CaseStatus.UNDER_LIBRARY_REVIEW,
      CaseStatus.NEEDS_REVISION_LIBRARY,
      CaseStatus.APPROVED_FOR_CLEARANCE,
      CaseStatus.CLEARANCE_SUBMITTED,
      CaseStatus.CLEARANCE_APPROVED,
      CaseStatus.READY_TO_PUBLISH,
      CaseStatus.PUBLISHED
    );
    return groupCasesByStudent(filterCasesByStatusAndYear(me, statuses, year));
  }

  @GetMapping("/my-students")
  public List<LecturerStudentGroupDto> myStudents(@RequestParam(required = false) Integer year) {
    User me = currentUser.requireCurrentUser();
    return groupCasesByStudent(filterCasesByStatusAndYear(me, null, year));
  }

  @PostMapping("/cases/{caseId}/comment")
  public ResponseEntity<OperationResultResponse> addComment(@PathVariable Long caseId, @RequestBody CommentRequest req) {
    User me = currentUser.requireCurrentUser();
    return ResponseEntity.ok(lecturerReviewService.addComment(me, caseId, req.getBody()));
  }

  @PostMapping("/cases/{caseId}/request-revision")
  public ResponseEntity<CaseStatusResponse> requestRevision(@PathVariable Long caseId, @RequestBody RevisionRequest req) {
    User me = currentUser.requireCurrentUser();
    return ResponseEntity.ok(lecturerReviewService.requestRevision(me, caseId, req.getReason()));
  }

  @PostMapping("/cases/{caseId}/mark-ready")
  public ResponseEntity<CaseStatusResponse> markReady(@PathVariable Long caseId) {
    User me = currentUser.requireCurrentUser();
    return ResponseEntity.ok(lecturerReviewService.markReady(me, caseId));
  }

  @PostMapping("/cases/{caseId}/forward-to-library")
  public ResponseEntity<CaseStatusResponse> forwardToLibrary(@PathVariable Long caseId) {
    // Backward-compatible alias that keeps the transition logic centralized.
    return approveAndForward(caseId);
  }

  @PostMapping("/cases/{caseId}/approve-and-forward")
  public ResponseEntity<CaseStatusResponse> approveAndForward(@PathVariable Long caseId) {
    User me = currentUser.requireCurrentUser();
    return ResponseEntity.ok(lecturerReviewService.approveAndForward(me, caseId));
  }

  @GetMapping("/students")
  public List<LecturerStudentCaseResponse> students() {
    User me = currentUser.requireCurrentUser();
    return lecturerReviewService.students(me);
  }

  @GetMapping("/cases/{caseId}/timeline")
  public List<TimelineItemDto> caseTimeline(@PathVariable Long caseId) {
    User me = currentUser.requireCurrentUser();
    return lecturerReviewService.caseTimeline(me, caseId);
  }

  @GetMapping("/cases/{caseId}/submissions")
  public List<SubmissionSummaryResponse> caseSubmissions(@PathVariable Long caseId) {
    User me = currentUser.requireCurrentUser();
    return lecturerReviewService.caseSubmissions(me, caseId);
  }

  @GetMapping("/cases/{caseId}/submissions/latest/download")
  public ResponseEntity<Resource> downloadLatestSubmission(@PathVariable Long caseId) {
    PublicationCase c = supervisedCase(caseId);
    SubmissionVersion latest = submissionVersions.findTopByPublicationCaseOrderByVersionNumberDesc(c)
      .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "No submissions found"));
    return downloadSubmissionInternal(c, latest);
  }

  @GetMapping("/cases/{caseId}/submissions/{submissionId}/download")
  public ResponseEntity<Resource> downloadSubmission(@PathVariable Long caseId, @PathVariable Long submissionId) {
    PublicationCase c = supervisedCase(caseId);
    SubmissionVersion submission = submissionVersions.findById(submissionId)
      .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Submission not found"));
    if (!submission.getPublicationCase().getId().equals(c.getId())) {
      throw new ResponseStatusException(BAD_REQUEST, "Submission does not belong to this case");
    }
    return downloadSubmissionInternal(c, submission);
  }

  private ResponseEntity<Resource> downloadSubmissionInternal(PublicationCase c, SubmissionVersion submission) {
    try {
      String storedKey = submission.getFilePath();
      if (!storageService.exists(storedKey)) {
        throw new ResponseStatusException(NOT_FOUND, "Submission file is missing");
      }

      String contentType = submission.getContentType();
      MediaType mediaType = hasText(contentType)
        ? MediaType.parseMediaType(contentType)
        : MediaType.APPLICATION_OCTET_STREAM;

      String filename = sanitizeFilename(submission.getOriginalFilename(), "submission-" + submission.getId() + ".pdf");
      Resource resource = storageService.openAsResource(storedKey);
      ResponseEntity.BodyBuilder response = ResponseEntity.ok()
        .contentType(mediaType)
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
        .header(HttpHeaders.CACHE_CONTROL, "no-store");

      if (submission.getFileSize() != null && submission.getFileSize() > 0) {
        response.contentLength(submission.getFileSize());
      }

      return response.body(resource);
    } catch (ResponseStatusException ex) {
      throw ex;
    } catch (IOException ex) {
      throw new ResponseStatusException(INTERNAL_SERVER_ERROR, "Failed to read submission file", ex);
    }
  }

  private PublicationCase supervisedCase(Long caseId) {
    User me = currentUser.requireCurrentUser();
    return workflowGates.requireSupervisedCase(me, caseId);
  }

  private List<PublicationCase> filterCasesByStatusAndYear(User lecturer, Set<CaseStatus> statuses, Integer year) {
    List<PublicationCase> supervisedCases = caseSupervisors.findByLecturer(lecturer).stream()
      .map(CaseSupervisor::getPublicationCase)
      .distinct()
      .toList();

    Map<Long, PublicationRegistration> registrationByCase = registrations.findByPublicationCaseIn(supervisedCases).stream()
      .collect(Collectors.toMap(r -> r.getPublicationCase().getId(), r -> r));

    return supervisedCases.stream()
      .filter(c -> statuses == null || statuses.contains(c.getStatus()))
      .filter(c -> {
        if (year == null) {
          return true;
        }
        PublicationRegistration registration = registrationByCase.get(c.getId());
        return registration != null && Objects.equals(registration.getYear(), year);
      })
      .sorted(Comparator.comparing(PublicationCase::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
      .toList();
  }

  private List<LecturerStudentGroupDto> groupCasesByStudent(List<PublicationCase> publicationCases) {
    if (publicationCases.isEmpty()) {
      return List.of();
    }

    Map<Long, PublicationRegistration> registrationByCase = registrations.findByPublicationCaseIn(publicationCases).stream()
      .collect(Collectors.toMap(r -> r.getPublicationCase().getId(), r -> r));
    Map<Long, StudentProfile> profileByUser = loadStudentProfiles(publicationCases);

    Map<Long, List<LecturerCaseWorkItemDto>> grouped = new LinkedHashMap<>();
    for (PublicationCase c : publicationCases) {
      PublicationRegistration registration = registrationByCase.get(c.getId());
      grouped.computeIfAbsent(c.getStudent().getId(), key -> new ArrayList<>())
        .add(toCaseWorkItem(c, registration));
    }

    return grouped.entrySet().stream()
      .map(entry -> {
        Long studentUserId = entry.getKey();
        User student = publicationCases.stream()
          .map(PublicationCase::getStudent)
          .filter(user -> user.getId().equals(studentUserId))
          .findFirst()
          .orElseThrow();
        StudentProfile profile = profileByUser.get(studentUserId);
        return new LecturerStudentGroupDto(
          studentUserId,
          student.getEmail(),
          profile != null && hasText(profile.getName()) ? profile.getName() : student.getEmail(),
          profile != null ? profile.getStudentId() : null,
          profile != null ? profile.getFaculty() : null,
          profile != null ? profile.getProgram() : null,
          entry.getValue()
        );
      })
      .sorted(Comparator.comparing(LecturerStudentGroupDto::studentName, Comparator.nullsLast(String::compareToIgnoreCase)))
      .toList();
  }

  private LecturerCaseWorkItemDto toCaseWorkItem(PublicationCase c, PublicationRegistration registration) {
    Instant latestSubmissionAt = submissionVersions.findTopByPublicationCaseOrderByVersionNumberDesc(c)
      .map(SubmissionVersion::getCreatedAt)
      .orElse(null);

    Instant lastLecturerFeedbackAt = comments.findTopByPublicationCaseAndAuthorRoleOrderByCreatedAtDesc(c, Role.LECTURER)
      .map(WorkflowComment::getCreatedAt)
      .orElse(null);

    Instant lecturerForwardedAt = auditEventRepository
      .findTopByCaseIdAndEventTypeOrderByCreatedAtDesc(c.getId(), AuditEventType.SUPERVISOR_FORWARDED_TO_LIBRARY)
      .map(AuditEvent::getCreatedAt)
      .orElse(null);

    Instant lastLibraryFeedbackAt = comments.findTopByPublicationCaseAndAuthorRoleOrderByCreatedAtDesc(c, Role.ADMIN)
      .map(WorkflowComment::getCreatedAt)
      .orElse(null);

    Instant libraryApprovedAt = auditEventRepository
      .findTopByCaseIdAndEventTypeOrderByCreatedAtDesc(c.getId(), AuditEventType.LIBRARY_APPROVED_FOR_CLEARANCE)
      .map(AuditEvent::getCreatedAt)
      .orElse(null);

    return new LecturerCaseWorkItemDto(
      c.getId(),
      c.getType(),
      c.getStatus(),
      c.getUpdatedAt(),
      registration != null ? registration.getTitle() : null,
      registration != null ? registration.getYear() : null,
      latestSubmissionAt,
      lastLecturerFeedbackAt,
      lecturerForwardedAt,
      lastLibraryFeedbackAt,
      libraryApprovedAt
    );
  }

  private Map<Long, StudentProfile> loadStudentProfiles(List<PublicationCase> publicationCases) {
    List<Long> studentIds = publicationCases.stream()
      .map(c -> c.getStudent().getId())
      .distinct()
      .toList();
    return studentProfiles.findByUserIdIn(studentIds).stream()
      .collect(Collectors.toMap(StudentProfile::getUserId, profile -> profile));
  }

  private LecturerApprovalQueueRowDto toApprovalQueueRow(
    PublicationRegistration registration,
    Map<Long, StudentProfile> profileByUser
  ) {
    PublicationCase publicationCase = registration.getPublicationCase();
    StudentProfile profile = profileByUser.get(publicationCase.getStudent().getId());
    return new LecturerApprovalQueueRowDto(
      publicationCase.getId(),
      publicationCase.getType(),
      publicationCase.getStatus(),
      publicationCase.getUpdatedAt(),
      publicationCase.getStudent().getId(),
      publicationCase.getStudent().getEmail(),
      profile != null ? profile.getName() : publicationCase.getStudent().getEmail(),
      profile != null ? profile.getStudentId() : null,
      profile != null ? profile.getFaculty() : null,
      profile != null ? profile.getProgram() : null,
      registration.getTitle(),
      registration.getYear(),
      registration.getSubmittedAt()
    );
  }

  private static String sanitizeFilename(String candidate, String fallback) {
    String value = hasText(candidate) ? candidate.trim() : fallback;
    return value.replaceAll("[\\\\/\\r\\n\\t\"]", "_");
  }

  private static int normalizePageSize(int requestedSize) {
    if (requestedSize < 1) {
      return DEFAULT_PAGE_SIZE;
    }
    return Math.min(requestedSize, MAX_PAGE_SIZE);
  }

  private static boolean hasText(String value) {
    return value != null && !value.isBlank();
  }

  @Data
  public static class CommentRequest {
    private String body;
  }

  @Data
  public static class RevisionRequest {
    private String reason;
  }

  @Data
  public static class DecisionRequest {
    private String note;
  }
}
