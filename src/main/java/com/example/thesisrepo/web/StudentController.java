package com.example.thesisrepo.web;

import com.example.thesisrepo.service.CurrentUserService;
import com.example.thesisrepo.service.RegistrationService;
import com.example.thesisrepo.service.SubmissionService;
import com.example.thesisrepo.service.student.StudentCaseService;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.CaseStatusResponse;
import com.example.thesisrepo.web.dto.CreateRegistrationRequest;
import com.example.thesisrepo.web.dto.PagedResponse;
import com.example.thesisrepo.web.dto.StudentCaseDetailResponse;
import com.example.thesisrepo.web.dto.StudentCaseSummaryResponse;
import com.example.thesisrepo.web.dto.StudentSupervisorResponse;
import com.example.thesisrepo.web.dto.SubmissionDetailResponse;
import com.example.thesisrepo.web.dto.SubmissionUploadMetadataRequest;
import com.example.thesisrepo.web.dto.SubmissionUploadResponse;
import com.example.thesisrepo.web.dto.SubmitRegistrationRequest;
import com.example.thesisrepo.web.dto.UpdateRegistrationRequest;
import jakarta.validation.Valid;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/student")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class StudentController {

  private final CurrentUserService currentUser;
  private final RegistrationService registrationService;
  private final StudentCaseService studentCaseService;
  private final SubmissionService submissionService;

  @GetMapping("/cases")
  public ResponseEntity<PagedResponse<StudentCaseSummaryResponse>> listCases(
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "10") int size
  ) {
    return ResponseEntity.ok(studentCaseService.listCases(currentUser.requireCurrentUser(), page, size));
  }

  @GetMapping("/supervisors")
  public List<StudentSupervisorResponse> listSupervisors() {
    return studentCaseService.listSupervisors(currentUser.requireCurrentUser());
  }

  @PostMapping("/registrations")
  public ResponseEntity<CaseStatusResponse> createRegistration(@Valid @RequestBody CreateRegistrationRequest req) {
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
  public ResponseEntity<CaseStatusResponse> updateRegistration(@PathVariable Long caseId, @Valid @RequestBody UpdateRegistrationRequest req) {
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
  public ResponseEntity<CaseStatusResponse> submitRegistration(@PathVariable Long caseId, @Valid @RequestBody SubmitRegistrationRequest req) {
    User me = currentUser.requireCurrentUser();
    return ResponseEntity.ok(registrationService.submitStudentRegistration(me, caseId, req.isPermissionAccepted()));
  }

  @GetMapping("/cases/{caseId}")
  public ResponseEntity<StudentCaseDetailResponse> caseDetail(@PathVariable Long caseId) {
    return ResponseEntity.ok(studentCaseService.caseDetail(currentUser.requireCurrentUser(), caseId));
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
    return studentCaseService.downloadSubmission(currentUser.requireCurrentUser(), caseId, submissionId);
  }

  @GetMapping("/cases/{caseId}/checklist-results")
  public ResponseEntity<List<com.example.thesisrepo.web.dto.ChecklistResultResponse>> checklistResults(@PathVariable Long caseId) {
    return ResponseEntity.ok(studentCaseService.checklistResults(currentUser.requireCurrentUser(), caseId));
  }

  @PostMapping("/cases/{caseId}/clearance")
  public ResponseEntity<CaseStatusResponse> submitClearance(@PathVariable Long caseId, @RequestBody ClearanceRequest req) {
    return ResponseEntity.ok(studentCaseService.submitClearance(currentUser.requireCurrentUser(), caseId, req.getNote()));
  }

  @Data
  public static class ClearanceRequest {
    private String note;
  }
}
