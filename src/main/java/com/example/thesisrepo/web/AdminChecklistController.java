package com.example.thesisrepo.web;

import com.example.thesisrepo.publication.ChecklistScope;
import com.example.thesisrepo.service.CurrentUserService;
import com.example.thesisrepo.service.ChecklistTemplateService;
import com.example.thesisrepo.service.checklist.ChecklistImportService;
import com.example.thesisrepo.user.User;
import com.example.thesisrepo.web.dto.ChecklistImportSummaryResponse;
import com.example.thesisrepo.web.dto.ChecklistTemplateActionResponse;
import com.example.thesisrepo.web.dto.ChecklistTemplateDetailResponse;
import com.example.thesisrepo.web.dto.ChecklistTemplateReleaseResponse;
import com.example.thesisrepo.web.dto.ChecklistTemplateSummaryResponse;
import com.example.thesisrepo.web.dto.ChecklistVersionResponse;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminChecklistController {

  private final ChecklistImportService checklistImportService;
  private final CurrentUserService currentUser;
  private final ChecklistTemplateService checklistTemplateService;

  @GetMapping("/checklists")
  public List<ChecklistTemplateSummaryResponse> checklists(@RequestParam("type") ChecklistScope type) {
    return checklistTemplateService.listTemplates(type);
  }

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
}
