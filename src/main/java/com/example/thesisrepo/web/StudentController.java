package com.example.thesisrepo.web;

import com.example.thesisrepo.profile.LecturerProfile;
import com.example.thesisrepo.profile.LecturerProfileRepository;
import com.example.thesisrepo.profile.StudentProfile;
import com.example.thesisrepo.profile.StudentProfileRepository;
import com.example.thesisrepo.publication.*;
import com.example.thesisrepo.publication.repo.*;
import com.example.thesisrepo.service.CurrentUserService;
import com.example.thesisrepo.service.RegistrationService;
import com.example.thesisrepo.service.StorageService;
import com.example.thesisrepo.service.SubmissionService;
import com.example.thesisrepo.service.workflow.AuditEventService;
import com.example.thesisrepo.service.workflow.CaseTimelineService;
import com.example.thesisrepo.service.workflow.PublicationWorkflowGateService;
import com.example.thesisrepo.user.Role;
import com.example.thesisrepo.user.StaffRegistry;
import com.example.thesisrepo.user.StaffRegistryRepository;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.AssignedSupervisorResponse;
import com.example.thesisrepo.web.dto.CaseStatusResponse;
import com.example.thesisrepo.web.dto.ChecklistResultResponse;
import com.example.thesisrepo.web.dto.ClearanceResponse;
import com.example.thesisrepo.web.dto.CreateRegistrationRequest;
import com.example.thesisrepo.web.dto.PagedResponse;
import com.example.thesisrepo.web.dto.RegistrationDetailResponse;
import com.example.thesisrepo.web.dto.StudentCaseDetailResponse;
import com.example.thesisrepo.web.dto.StudentCaseSummaryResponse;
import com.example.thesisrepo.web.dto.SubmissionDetailResponse;
import com.example.thesisrepo.web.dto.SubmissionSummaryResponse;
import com.example.thesisrepo.web.dto.SubmissionUploadMetadataRequest;
import com.example.thesisrepo.web.dto.SubmissionUploadResponse;
import com.example.thesisrepo.web.dto.SubmitRegistrationRequest;
import com.example.thesisrepo.web.dto.UpdateRegistrationRequest;
import com.example.thesisrepo.web.dto.WorkflowCommentResponse;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.Instant;
import java.util.*;

import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/student")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class StudentController {

  private static final int DEFAULT_PAGE_SIZE = 10;
  private static final int MAX_PAGE_SIZE = 50;

  private final PublicationCaseRepository cases;
  private final PublicationRegistrationRepository registrations;
  private final CaseSupervisorRepository caseSupervisors;
  private final SubmissionVersionRepository submissionVersions;
  private final WorkflowCommentRepository comments;
  private final ChecklistResultRepository checklistResults;
  private final ClearanceFormRepository clearances;
  private final LecturerProfileRepository lecturerProfiles;
  private final StudentProfileRepository studentProfiles;
  private final StaffRegistryRepository staffRegistry;
  private final CurrentUserService currentUser;
  private final RegistrationService registrationService;
  private final StorageService storageService;
  private final SubmissionService submissionService;
  private final PublicationWorkflowGateService workflowGates;
  private final AuditEventService auditEvents;
  private final CaseTimelineService timelineService;

  @GetMapping("/cases")
  public PagedResponse<StudentCaseSummaryResponse> listCases(
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "" + DEFAULT_PAGE_SIZE) int size
  ) {
    User me = currentUser.requireCurrentUser();
    Page<PublicationCase> casePage = cases.findByStudent(
      me,
      PageRequest.of(
        Math.max(page, 0),
        normalizePageSize(size),
        Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.desc("id"))
      )
    );
    List<StudentCaseSummaryResponse> items = casePage.getContent().stream()
      .map(this::toCaseSummary)
      .toList();
    return PagedResponse.from(casePage, items);
  }

  @GetMapping("/supervisors")
  public List<SupervisorDto> listSupervisors() {
    User me = currentUser.requireCurrentUser();
    StudentProfile studentProfile = studentProfiles.findByUserId(me.getId()).orElse(null);
    String studentProgram = normalize(studentProfile != null ? studentProfile.getProgram() : null);
    if (studentProgram.isBlank()) {
      return List.of();
    }

    // Read from staff_registry table — lecturers are available even before they login
    return staffRegistry.findAll().stream()
      .filter(s -> s.getRole() == Role.LECTURER)
      .filter(s -> normalizeStudyProgram(s.getStudyProgram()).equals(normalizeStudyProgram(studentProgram)))
      .map(this::toSupervisorDto)
      .sorted(Comparator.comparing(SupervisorDto::name, String.CASE_INSENSITIVE_ORDER))
      .toList();
  }

  @PostMapping("/registrations")
  public ResponseEntity<CaseStatusResponse> createRegistration(@RequestBody CreateRegistrationRequest req) {
    User me = currentUser.requireCurrentUser();
    RegistrationService.CreateRegistrationCommand command = new RegistrationService.CreateRegistrationCommand(
      req.getType(),
      req.getTitle(),
      req.getYear(),
      req.getArticlePublishIn(),
      req.getFaculty(),
      req.getStudentIdNumber(),
      req.getAuthorName(),
      req.getSupervisorEmail(),
      req.getSupervisorUserId(),
      req.getSupervisorUserIds(),
      req.getSupervisorEmails()
    );
    return ResponseEntity.ok(registrationService.createStudentRegistration(me, command));
  }

  @PutMapping("/registrations/{caseId}")
  public ResponseEntity<CaseStatusResponse> updateRegistration(@PathVariable Long caseId, @RequestBody UpdateRegistrationRequest req) {
    User me = currentUser.requireCurrentUser();
    RegistrationService.UpdateRegistrationCommand command = new RegistrationService.UpdateRegistrationCommand(
      req.getTitle(),
      req.getYear(),
      req.getArticlePublishIn(),
      req.getFaculty(),
      req.getStudentIdNumber(),
      req.getAuthorName(),
      req.getSupervisorEmail(),
      req.getSupervisorUserId(),
      req.getSupervisorUserIds(),
      req.getSupervisorEmails()
    );
    return ResponseEntity.ok(registrationService.updateStudentRegistration(me, caseId, command));
  }

  @PostMapping("/registrations/{caseId}/submit")
  public ResponseEntity<CaseStatusResponse> submitRegistration(@PathVariable Long caseId, @RequestBody SubmitRegistrationRequest req) {
    User me = currentUser.requireCurrentUser();
    return ResponseEntity.ok(registrationService.submitStudentRegistration(me, caseId, req.isPermissionAccepted()));
  }

  @GetMapping("/cases/{caseId}")
  public ResponseEntity<StudentCaseDetailResponse> caseDetail(@PathVariable Long caseId) {
    PublicationCase c = ownedCase(caseId);
    PublicationRegistration reg = registrations.findByPublicationCase(c).orElse(null);
    List<SubmissionSummaryResponse> versions = submissionService.listSubmissionSummaries(c);
    List<WorkflowCommentResponse> caseComments = comments.findByPublicationCaseOrderByCreatedAtAsc(c).stream()
      .map(this::toWorkflowCommentResponse)
      .toList();

    return ResponseEntity.ok(new StudentCaseDetailResponse(
      toCaseSummary(c),
      toRegistrationDetail(reg),
      caseSupervisors.findByPublicationCase(c).stream().map(this::toAssignedSupervisor).toList(),
      versions,
      caseComments,
      toClearanceResponse(clearances.findByPublicationCase(c).orElse(null)),
      timelineService.buildTimeline(c)
    ));
  }

  @PostMapping(value = "/cases/{caseId}/submissions", consumes = "multipart/form-data")
  public ResponseEntity<SubmissionUploadResponse> uploadSubmission(
    @PathVariable Long caseId,
    @RequestPart("file") MultipartFile file,
    @RequestPart(value = "meta", required = false) SubmissionUploadMetadataRequest meta
  ) {
    User me = currentUser.requireCurrentUser();
    SubmissionUploadResponse response = submissionService.uploadStudentSubmission(me, caseId, file, meta);
    return ResponseEntity.ok(response);
  }

  @GetMapping("/cases/{caseId}/submissions")
  public List<SubmissionDetailResponse> submissions(@PathVariable Long caseId) {
    User me = currentUser.requireCurrentUser();
    return submissionService.listStudentSubmissions(me, caseId);
  }

  @GetMapping("/cases/{caseId}/submissions/{submissionId}/download")
  public ResponseEntity<Resource> downloadSubmission(@PathVariable Long caseId, @PathVariable Long submissionId) {
    PublicationCase c = ownedCase(caseId);
    SubmissionVersion submission = submissionVersions.findById(submissionId)
      .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Submission not found"));
    if (!submission.getPublicationCase().getId().equals(c.getId())) {
      throw new ResponseStatusException(BAD_REQUEST, "Submission does not belong to this case");
    }
    return downloadSubmissionInternal(submission);
  }

  @GetMapping("/cases/{caseId}/checklist-results")
  public ResponseEntity<List<ChecklistResultResponse>> checklistResults(@PathVariable Long caseId) {
    PublicationCase c = ownedCase(caseId);
    SubmissionVersion latest = submissionVersions.findTopByPublicationCaseOrderByVersionNumberDesc(c)
      .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "No submissions"));

    return ResponseEntity.ok(checklistResults.findBySubmissionVersion(latest).stream()
      .map(this::toChecklistResultResponse)
      .toList());
  }

  @PostMapping("/cases/{caseId}/clearance")
  public ResponseEntity<CaseStatusResponse> submitClearance(@PathVariable Long caseId, @RequestBody ClearanceRequest req) {
    User me = currentUser.requireCurrentUser();
    PublicationCase c = ownedCase(caseId);
    workflowGates.ensureClearanceSubmittable(c);

    ClearanceForm clearance = clearances.findByPublicationCase(c).orElseGet(() -> ClearanceForm.builder()
      .publicationCase(c)
      .status(ClearanceStatus.DRAFT)
      .build());

    clearance.setStatus(ClearanceStatus.SUBMITTED);
    clearance.setSubmittedAt(Instant.now());
    clearance.setNote(req.getNote());
    clearances.save(clearance);

    c.setStatus(CaseStatus.CLEARANCE_SUBMITTED);
    cases.save(c);

    auditEvents.log(
      c.getId(),
      me,
      Role.STUDENT,
      AuditEventType.CLEARANCE_SUBMITTED,
      "Student submitted clearance form"
    );

    return ResponseEntity.ok(new CaseStatusResponse(c.getId(), c.getStatus()));
  }

  private PublicationCase ownedCase(Long caseId) {
    User me = currentUser.requireCurrentUser();
    return workflowGates.requireOwnedCase(me, caseId);
  }

  private ResponseEntity<Resource> downloadSubmissionInternal(SubmissionVersion submission) {
    try {
      String storedKey = submission.getFilePath();
      if (!hasText(storedKey) || !storageService.exists(storedKey)) {
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

  private int normalizePageSize(int requestedSize) {
    if (requestedSize < 1) {
      return DEFAULT_PAGE_SIZE;
    }
    return Math.min(requestedSize, MAX_PAGE_SIZE);
  }

  private static boolean hasText(String value) {
    return value != null && !value.isBlank();
  }

  private static String sanitizeFilename(String candidate, String fallback) {
    String value = hasText(candidate) ? candidate.trim() : fallback;
    return value.replaceAll("[\\\\/\\r\\n\\t\"]", "_");
  }

  private StudentCaseSummaryResponse toCaseSummary(PublicationCase c) {
    PublicationRegistration registration = registrations.findByPublicationCase(c).orElse(null);
    return new StudentCaseSummaryResponse(
      c.getId(),
      c.getType(),
      c.getStatus(),
      registration != null ? registration.getTitle() : null,
      c.getUpdatedAt(),
      c.getCreatedAt()
    );
  }

  private SupervisorDto toSupervisorDto(StaffRegistry staff) {
    String name = staff.getFullName() != null && !staff.getFullName().isBlank()
      ? staff.getFullName()
      : staff.getEmail();
    return new SupervisorDto(
      staff.getId(),
      staff.getEmail(),
      name,
      null,
      staff.getStudyProgram()
    );
  }

  private AssignedSupervisorResponse toAssignedSupervisor(CaseSupervisor supervisor) {
    User lecturer = supervisor.getLecturer();
    LecturerProfile profile = lecturerProfiles.findByUserId(lecturer.getId()).orElse(null);
    String name = profile != null && profile.getName() != null && !profile.getName().isBlank()
      ? profile.getName()
      : lecturer.getEmail();
    return new AssignedSupervisorResponse(
      lecturer.getId(),
      lecturer.getEmail(),
      name
    );
  }

  private static String normalize(String value) {
    return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
  }

  private static String normalizeStudyProgram(String value) {
    String normalized = normalize(value);
    // "information systems" == "information system"
    if (normalized.endsWith("systems")) {
      return normalized.substring(0, normalized.length() - 1);
    }
    return normalized;
  }


  private RegistrationDetailResponse toRegistrationDetail(PublicationRegistration registration) {
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
    String authorEmail = comment.getAuthorEmail() != null && !comment.getAuthorEmail().isBlank()
      ? comment.getAuthorEmail()
      : (comment.getAuthor() != null ? comment.getAuthor().getEmail() : null);
    return new WorkflowCommentResponse(
      comment.getId(),
      comment.getSubmissionVersion() != null ? comment.getSubmissionVersion().getId() : null,
      comment.getAuthorRole(),
      authorEmail,
      comment.getBody(),
      comment.getCreatedAt()
    );
  }

  private ChecklistResultResponse toChecklistResultResponse(ChecklistResult result) {
    ChecklistItemV2 item = result.getChecklistItem();
    return new ChecklistResultResponse(
      result.getId(),
      new ChecklistResultResponse.ChecklistItemResponse(
        item.getId(),
        item.getSection(),
        item.getItemText()
      ),
      result.getPassFail(),
      result.getNote()
    );
  }

  private ClearanceResponse toClearanceResponse(ClearanceForm clearance) {
    if (clearance == null) {
      return null;
    }
    return new ClearanceResponse(
      clearance.getId(),
      clearance.getStatus(),
      clearance.getNote(),
      clearance.getSubmittedAt(),
      clearance.getApprovedAt()
    );
  }

  public record SupervisorDto(
    Long id,
    String email,
    String name,
    String faculty,
    String department
  ) {}

  @Data
  public static class ClearanceRequest {
    private String note;
  }
}
