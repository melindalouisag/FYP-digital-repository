package com.example.thesisrepo.web;

import com.example.thesisrepo.publication.*;
import com.example.thesisrepo.publication.repo.*;
import com.example.thesisrepo.service.ChecklistTemplateService;
import com.example.thesisrepo.service.ClearanceService;
import com.example.thesisrepo.service.checklist.ChecklistImportService;
import com.example.thesisrepo.service.CurrentUserService;
import com.example.thesisrepo.service.LibraryReviewService;
import com.example.thesisrepo.service.PublishingService;
import com.example.thesisrepo.service.RegistrationService;
import com.example.thesisrepo.service.StorageService;
import com.example.thesisrepo.service.workflow.PublicationWorkflowGateService;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.AdminClearanceCaseSummaryResponse;
import com.example.thesisrepo.web.dto.AdminCaseDetailResponse;
import com.example.thesisrepo.web.dto.AdminPublishDetailDto;
import com.example.thesisrepo.web.dto.AdminPublishQueueDto;
import com.example.thesisrepo.web.dto.AdminRegistrationApprovalDto;
import com.example.thesisrepo.web.dto.AdminStudentGroupDto;
import com.example.thesisrepo.web.dto.CaseStatusResponse;
import com.example.thesisrepo.web.dto.ChecklistImportSummaryResponse;
import com.example.thesisrepo.web.dto.ChecklistTemplateActionResponse;
import com.example.thesisrepo.web.dto.ChecklistTemplateDetailResponse;
import com.example.thesisrepo.web.dto.ChecklistTemplateReleaseResponse;
import com.example.thesisrepo.web.dto.ChecklistTemplateSummaryResponse;
import com.example.thesisrepo.web.dto.ChecklistVersionResponse;
import com.example.thesisrepo.web.dto.OperationResultResponse;
import com.example.thesisrepo.web.dto.PagedResponse;
import com.example.thesisrepo.web.dto.PublishResultResponse;
import com.example.thesisrepo.web.dto.StudentCaseSummaryResponse;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.transaction.Transactional;
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

import java.time.Instant;
import java.util.*;

import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminWorkflowController {

  private static final int DEFAULT_PAGE_SIZE = 10;
  private static final int MAX_PAGE_SIZE = 100;

  private final SubmissionVersionRepository submissionVersions;
  private final ChecklistImportService checklistImportService;
  private final CurrentUserService currentUser;
  private final RegistrationService registrationService;
  private final LibraryReviewService libraryReviewService;
  private final ClearanceService clearanceService;
  private final PublishingService publishingService;
  private final ChecklistTemplateService checklistTemplateService;
  private final PublicationWorkflowGateService workflowGates;
  private final StorageService storageService;

  @GetMapping("/review")
  public PagedResponse<StudentCaseSummaryResponse> reviewQueue(
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "" + DEFAULT_PAGE_SIZE) int size,
    @RequestParam(required = false) CaseStatus status,
    @RequestParam(required = false) PublicationType type
  ) {
    return libraryReviewService.reviewQueue(
      PageRequest.of(Math.max(page, 0), normalizePageSize(size)),
      status,
      type
    );
  }

  @GetMapping("/registration-approvals")
  public PagedResponse<AdminRegistrationApprovalDto> registrationApprovals(
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "" + DEFAULT_PAGE_SIZE) int size
  ) {
    return registrationService.adminApprovalQueue(
      PageRequest.of(Math.max(page, 0), normalizePageSize(size))
    );
  }

  @PostMapping("/registration-approvals/{caseId}/approve")
  public ResponseEntity<CaseStatusResponse> approveRegistration(@PathVariable Long caseId) {
    User admin = currentUser.requireCurrentUser();
    return ResponseEntity.ok(registrationService.approveRegistrationByAdmin(admin, caseId));
  }

  @PostMapping("/registration-approvals/{caseId}/reject")
  public ResponseEntity<CaseStatusResponse> rejectRegistration(@PathVariable Long caseId, @RequestBody DecisionRequest req) {
    User admin = currentUser.requireCurrentUser();
    return ResponseEntity.ok(registrationService.rejectRegistrationByAdmin(admin, caseId, req.getReason()));
  }

  @GetMapping("/review-queue-grouped")
  public List<AdminStudentGroupDto> reviewQueueGrouped() {
    return libraryReviewService.reviewQueueGrouped();
  }

  @GetMapping("/cases/{caseId}")
  public ResponseEntity<AdminCaseDetailResponse> caseDetail(@PathVariable Long caseId) {
    return ResponseEntity.ok(libraryReviewService.caseDetail(caseId));
  }

  @PostMapping("/cases/{caseId}/checklist-results")
  public ResponseEntity<OperationResultResponse> saveChecklistResults(@PathVariable Long caseId, @RequestBody ChecklistResultRequest req) {
    User admin = currentUser.requireCurrentUser();
    List<LibraryReviewService.ChecklistEntryCommand> entries = req.getResults().stream()
      .map(entry -> new LibraryReviewService.ChecklistEntryCommand(entry.getChecklistItemId(), entry.isPass(), entry.getNote()))
      .toList();
    return ResponseEntity.ok(libraryReviewService.saveChecklistResults(
      admin,
      caseId,
      new LibraryReviewService.SaveChecklistResultsCommand(req.getSubmissionVersionId(), entries)
    ));
  }

  @PostMapping("/cases/{caseId}/request-revision")
  public ResponseEntity<CaseStatusResponse> requestRevision(@PathVariable Long caseId, @RequestBody DecisionRequest req) {
    User admin = currentUser.requireCurrentUser();
    return ResponseEntity.ok(libraryReviewService.requestRevision(admin, caseId, req.getReason()));
  }

  @PostMapping("/cases/{caseId}/approve")
  public ResponseEntity<CaseStatusResponse> approveCase(@PathVariable Long caseId) {
    User admin = currentUser.requireCurrentUser();
    return ResponseEntity.ok(libraryReviewService.approveCase(admin, caseId));
  }

  @PostMapping("/cases/{caseId}/reject")
  public ResponseEntity<CaseStatusResponse> rejectCase(@PathVariable Long caseId, @RequestBody DecisionRequest req) {
    User admin = currentUser.requireCurrentUser();
    return ResponseEntity.ok(libraryReviewService.rejectCase(admin, caseId, req.getReason()));
  }

  @GetMapping("/clearance")
  public PagedResponse<AdminClearanceCaseSummaryResponse> clearanceQueue(
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "" + DEFAULT_PAGE_SIZE) int size
  ) {
    return clearanceService.clearanceQueue(
      PageRequest.of(
        Math.max(page, 0),
        normalizePageSize(size),
        Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.desc("id"))
      )
    );
  }

  @PostMapping("/clearance/{caseId}/approve")
  public ResponseEntity<CaseStatusResponse> approveClearance(@PathVariable Long caseId) {
    User admin = currentUser.requireCurrentUser();
    return ResponseEntity.ok(clearanceService.approveClearance(admin, caseId));
  }

  @PostMapping("/clearance/{caseId}/request-correction")
  public ResponseEntity<CaseStatusResponse> requestClearanceCorrection(@PathVariable Long caseId, @RequestBody DecisionRequest req) {
    User admin = currentUser.requireCurrentUser();
    return ResponseEntity.ok(clearanceService.requestCorrection(admin, caseId, req.getReason()));
  }

  @GetMapping("/publish")
  public PagedResponse<AdminPublishQueueDto> publishQueue(
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "" + DEFAULT_PAGE_SIZE) int size
  ) {
    return publishingService.publishQueue(
      PageRequest.of(
        Math.max(page, 0),
        normalizePageSize(size),
        Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.desc("id"))
      )
    );
  }

  @GetMapping("/publish/{caseId}")
  public AdminPublishDetailDto publishDetail(@PathVariable Long caseId) {
    return publishingService.publishDetail(caseId);
  }

  @GetMapping("/cases/{caseId}/file/latest")
  public ResponseEntity<Resource> downloadLatestSubmission(@PathVariable Long caseId) {
    PublicationCase c = getCase(caseId);
    SubmissionVersion version = submissionVersions.findTopByPublicationCaseOrderByVersionNumberDesc(c)
      .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "No submission version found"));
    if (version.getFilePath() == null || version.getFilePath().isBlank()) {
      throw new ResponseStatusException(NOT_FOUND, "No file attached");
    }

    try {
      String storedKey = version.getFilePath();
      if (!storageService.exists(storedKey)) {
        throw new ResponseStatusException(NOT_FOUND, "File not found");
      }

      Resource resource = storageService.openAsResource(storedKey);
      String fileName = version.getOriginalFilename() != null && !version.getOriginalFilename().isBlank()
        ? version.getOriginalFilename()
        : defaultFilename(storedKey, "submission.pdf");
      String safeFilename = sanitizeFilename(fileName, "submission.pdf");
      return ResponseEntity.ok()
        .contentType(MediaType.APPLICATION_OCTET_STREAM)
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + safeFilename + "\"")
        .body(resource);
    } catch (Exception e) {
      throw new ResponseStatusException(INTERNAL_SERVER_ERROR, "Cannot read file", e);
    }
  }

  private static String defaultFilename(String storedKey, String fallback) {
    if (!hasText(storedKey)) {
      return fallback;
    }
    int idx = storedKey.lastIndexOf('/');
    String name = idx >= 0 ? storedKey.substring(idx + 1) : storedKey;
    return hasText(name) ? name : fallback;
  }

  private static String sanitizeFilename(String candidate, String fallback) {
    String value = hasText(candidate) ? candidate.trim() : fallback;
    return value.replaceAll("[\\\\/\\r\\n\\t\"]", "_");
  }

  @PostMapping("/publish/{caseId}")
  public ResponseEntity<PublishResultResponse> publish(@PathVariable Long caseId) {
    User admin = currentUser.requireCurrentUser();
    return ResponseEntity.ok(publishingService.publish(admin, caseId));
  }

  @PostMapping("/publish/{caseId}/unpublish")
  @Transactional
  public ResponseEntity<CaseStatusResponse> unpublish(@PathVariable Long caseId, @RequestBody DecisionRequest req) {
    User admin = currentUser.requireCurrentUser();
    return ResponseEntity.ok(publishingService.unpublish(admin, caseId, req.getReason()));
  }

  @GetMapping("/checklists")
  public List<ChecklistTemplateSummaryResponse> checklists(@RequestParam("type") ChecklistScope type) {
    return checklistTemplateService.listTemplates(type);
  }

  // Backward-compatible endpoint used by existing review/detail pages that still need item payloads.
  @GetMapping("/checklists/full")
  public List<ChecklistTemplateDetailResponse> checklistsFull(@RequestParam("type") ChecklistScope type) {
    return checklistTemplateService.listTemplatesWithItems(type);
  }

  @PostMapping("/checklists/{type}/create-empty")
  @Transactional
  public ResponseEntity<ChecklistTemplateSummaryResponse> createEmptyTemplate(@PathVariable ChecklistScope type) {
    return ResponseEntity.ok(checklistTemplateService.createEmptyTemplate(type));
  }

  @PostMapping("/checklists/{type}/new-draft")
  @Transactional
  public ResponseEntity<ChecklistTemplateSummaryResponse> createNewDraftTemplate(@PathVariable ChecklistScope type) {
    return ResponseEntity.ok(checklistTemplateService.createNewDraftTemplate(type));
  }

  @PostMapping("/checklists/{type}/new-version")
  @Transactional
  public ResponseEntity<ChecklistVersionResponse> createNewVersion(@PathVariable ChecklistScope type) {
    return ResponseEntity.ok(checklistTemplateService.createNewVersion(type));
  }

  @PostMapping(value = "/checklists/{type}/import-xlsx", consumes = "multipart/form-data")
  @Transactional
  public ResponseEntity<ChecklistImportSummaryResponse> importChecklist(
    @PathVariable ChecklistScope type,
    @RequestPart("file") MultipartFile file,
    @RequestParam(defaultValue = "false") boolean activate,
    @RequestParam(required = false) String sheetName
  ) {
    ChecklistImportService.ImportSummary summary = checklistImportService.importChecklist(type, file, activate, sheetName);
    return ResponseEntity.ok(new ChecklistImportSummaryResponse(
      summary.type(),
      summary.newTemplateId(),
      summary.newVersion(),
      summary.itemsImported(),
      summary.sections()
    ));
  }

  @GetMapping("/checklists/templates/{templateId}")
  public ResponseEntity<ChecklistTemplateDetailResponse> checklistTemplateDetail(@PathVariable Long templateId) {
    User admin = currentUser.requireCurrentUser();
    return ResponseEntity.ok(checklistTemplateService.templateDetail(admin, templateId));
  }

  @PostMapping("/checklists/templates/{templateId}/lock")
  @Transactional
  public ResponseEntity<ChecklistTemplateActionResponse> acquireTemplateLock(@PathVariable Long templateId) {
    User admin = currentUser.requireCurrentUser();
    return checklistTemplateService.acquireLock(admin, templateId).toResponseEntity();
  }

  @DeleteMapping("/checklists/templates/{templateId}/lock")
  @Transactional
  public ResponseEntity<ChecklistTemplateReleaseResponse> releaseTemplateLock(@PathVariable Long templateId) {
    User admin = currentUser.requireCurrentUser();
    return ResponseEntity.ok(checklistTemplateService.releaseLock(admin, templateId));
  }

  @DeleteMapping("/checklists/templates/{templateId}")
  @Transactional
  public ResponseEntity<ChecklistTemplateActionResponse> deleteTemplate(@PathVariable Long templateId) {
    User admin = currentUser.requireCurrentUser();
    return checklistTemplateService.deleteTemplate(admin, templateId).toResponseEntity();
  }

  @PutMapping("/checklists/templates/{templateId}/items")
  @Transactional
  public ResponseEntity<ChecklistTemplateActionResponse> replaceTemplateItems(@PathVariable Long templateId, @RequestBody JsonNode payload) {
    User admin = currentUser.requireCurrentUser();
    return checklistTemplateService.replaceTemplateItems(admin, templateId, payload).toResponseEntity();
  }

  @PostMapping("/checklists/templates/{templateId}/activate")
  @Transactional
  public ResponseEntity<ChecklistTemplateActionResponse> activateTemplate(@PathVariable Long templateId) {
    User admin = currentUser.requireCurrentUser();
    return checklistTemplateService.activateTemplate(admin, templateId).toResponseEntity();
  }

  private PublicationCase getCase(Long caseId) {
    return workflowGates.requireCase(caseId);
  }

  private static boolean hasText(String value) {
    return value != null && !value.isBlank();
  }

  private static int normalizePageSize(int requestedSize) {
    if (requestedSize < 1) {
      return DEFAULT_PAGE_SIZE;
    }
    return Math.min(requestedSize, MAX_PAGE_SIZE);
  }
  @Data
  public static class ChecklistResultRequest {
    private Long submissionVersionId;
    private List<ChecklistEntry> results = new ArrayList<>();
  }

  @Data
  public static class ChecklistEntry {
    private Long checklistItemId;
    private boolean pass;
    private String note;
  }

  @Data
  public static class DecisionRequest {
    private String reason;
  }
}
