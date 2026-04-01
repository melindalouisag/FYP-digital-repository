package com.example.thesisrepo.web;

import com.example.thesisrepo.service.CurrentUserService;
import com.example.thesisrepo.service.LecturerReviewService;
import com.example.thesisrepo.service.RegistrationService;
import com.example.thesisrepo.service.dashboard.LecturerDashboardService;
import com.example.thesisrepo.service.lecturer.LecturerStudentTrackingService;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.CaseStatusResponse;
import com.example.thesisrepo.web.dto.LecturerDashboardResponse;
import com.example.thesisrepo.web.dto.LecturerApprovalQueueRowDto;
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
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/lecturer")
@RequiredArgsConstructor
@PreAuthorize("hasRole('LECTURER')")
public class LecturerWorkflowController {

  private static final int DEFAULT_PAGE_SIZE = 10;
  private static final int MAX_PAGE_SIZE = 100;

  private final CurrentUserService currentUser;
  private final RegistrationService registrationService;
  private final LecturerReviewService lecturerReviewService;
  private final LecturerDashboardService lecturerDashboardService;
  private final LecturerStudentTrackingService lecturerStudentTrackingService;

  @GetMapping("/dashboard")
  public LecturerDashboardResponse dashboard(@RequestParam(required = false) Integer year) {
    User me = currentUser.requireCurrentUser();
    return lecturerDashboardService.build(me, year);
  }

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
    return lecturerStudentTrackingService.approvalQueueDetail(currentUser.requireCurrentUser(), page, size);
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
  public PagedResponse<StudentCaseSummaryResponse> reviewQueue(
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "" + DEFAULT_PAGE_SIZE) int size
  ) {
    User me = currentUser.requireCurrentUser();
    return lecturerReviewService.reviewQueue(
      me,
      PageRequest.of(Math.max(page, 0), normalizePageSize(size))
    );
  }

  @GetMapping("/pending-supervisor")
  public List<LecturerStudentGroupDto> pendingSupervisor(@RequestParam(required = false) Integer year) {
    return lecturerStudentTrackingService.pendingSupervisor(currentUser.requireCurrentUser(), year);
  }

  @GetMapping("/library-tracking")
  public List<LecturerStudentGroupDto> libraryTracking(@RequestParam(required = false) Integer year) {
    return lecturerStudentTrackingService.libraryTracking(currentUser.requireCurrentUser(), year);
  }

  @GetMapping("/my-students")
  public List<LecturerStudentGroupDto> myStudents(@RequestParam(required = false) Integer year) {
    return lecturerStudentTrackingService.myStudents(currentUser.requireCurrentUser(), year);
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
    return lecturerStudentTrackingService.downloadLatestSubmission(currentUser.requireCurrentUser(), caseId);
  }

  @GetMapping("/cases/{caseId}/submissions/{submissionId}/download")
  public ResponseEntity<Resource> downloadSubmission(@PathVariable Long caseId, @PathVariable Long submissionId) {
    return lecturerStudentTrackingService.downloadSubmission(currentUser.requireCurrentUser(), caseId, submissionId);
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

  private static int normalizePageSize(int requestedSize) {
    if (requestedSize < 1) {
      return DEFAULT_PAGE_SIZE;
    }
    return Math.min(requestedSize, MAX_PAGE_SIZE);
  }
}
